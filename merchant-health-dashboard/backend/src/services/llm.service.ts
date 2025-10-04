import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import CoraLogixMCPConnection from '../mcp/mcpConnect';

dotenv.config();

interface MCPRequest {
  method: string;
  params: any;
}

interface MCPResponse {
  result?: any;
  error?: string;
}

class LLMService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private static instance: LLMService | null = null;

  constructor() {
    if (process.env.GOOGLE_API_KEY) {
      this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    } else {
      logger.warn('Google API key not found. LLM features will be disabled.');
    }
  }

  public static getInstance(): LLMService {
    if (!this.instance) {
      this.instance = new LLMService();
    }
    return this.instance;
  }

  /**
   * Convert natural language prompt to MCP request format
   */
  async convertPromptToMCPRequest(prompt: string, context?: any): Promise<MCPRequest> {
    if (!this.model) {
      throw new Error('Google API key not configured');
    }

    // Get MCP connection and available tools
    const mcpConnection = CoraLogixMCPConnection.getConnectionObject();
    const availableTools = mcpConnection.getAvailableTools();
    const dataprimeDocs = mcpConnection.getDataprimeDocs();

    // Build tools context
    const toolsContext = availableTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    const systemPrompt = `You are an expert at converting natural language queries into MCP (Model Context Protocol) requests for Coralogix log analysis.

AVAILABLE TOOLS:
${JSON.stringify(toolsContext, null, 2)}

DATAPRIME DOCUMENTATION:
${dataprimeDocs}

CONTEXT: ${JSON.stringify(context || {})}

Convert the following natural language query into a proper MCP request JSON format:

User Query: "${prompt}"

Return ONLY a valid JSON object (no markdown, no code blocks, no explanations) with this structure:
{
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {
      // tool-specific parameters based on the tool's inputSchema
    }
  }
}

IMPORTANT:
- Use the exact tool names from the available tools list
- Follow the Dataprime syntax for queries
- Use proper time formats (ISO 8601)
- Include all required parameters from the tool's inputSchema

SEARCH OPTIMIZATION STRATEGY:
- For transaction searches, use ONLY the transaction ID: source logs | filter $d ~~ 'transaction_id_here'
- DO NOT add extra conditions like 'posted', 'success', etc. - just search for the transaction ID
- The $d namespace contains all user data fields including logRecord.body
- Use ~~ operator for regex pattern matching across all fields in $d
- For application-specific searches: source logs | filter $l.applicationname == 'prod-configapps' && $d ~~ 'transaction_id_here'
- Example: source logs | filter $d ~~ '251004150442485E909395731'
- Example with app filter: source logs | filter $l.applicationname == 'prod-configapps' && $d ~~ '251004150442485E909395731'
- IMPORTANT: Only search for the transaction ID itself, let the user interpret the results

TRANSACTION ID TIMESTAMP EXTRACTION:
- Transaction IDs follow format: yymmddhhmmss + additional characters
- Extract timestamp from first 12 characters: yymmddhhmmss
- Example: 251004150441756E739681790 -> 25-10-04 15:04:41 (2025-10-04 15:04:41)
- Use this timestamp to set appropriate startDate and endDate for the search
- Search window: 30 minutes before to 30 minutes after the transaction timestamp
- This ensures we capture logs around the actual transaction time, not JWT token time`;

    try {
      const result = await this.model.generateContent([
        { text: systemPrompt },
        { text: prompt }
      ]);

      const response = await result.response;
      const content = response.text();
      
      if (!content) {
        throw new Error('No response from Gemini');
      }

      // Clean the response - remove markdown formatting if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Parse the JSON response
      const mcpRequest = JSON.parse(cleanContent);
      
      // Validate the structure
      if (!mcpRequest.method || !mcpRequest.params) {
        throw new Error('Invalid MCP request format from LLM');
      }

      logger.info(`Converted prompt to MCP request: ${JSON.stringify(mcpRequest)}`);
      return mcpRequest;

    } catch (error) {
      logger.error('Error converting prompt to MCP request:', error);
      throw new Error(`Failed to convert prompt to MCP request: ${error}`);
    }
  }

  /**
   * Convert MCP response to natural language
   */
  async formatMCPResponse(mcpResponse: MCPResponse, originalPrompt: string): Promise<string> {
    if (!this.model) {
      // Fallback to simple formatting if no LLM
      return this.simpleFormatResponse(mcpResponse);
    }

    const systemPrompt = `You are an expert at converting technical MCP responses into clear, natural language explanations.

Your task is to take the raw MCP response data and format it into a user-friendly explanation that directly answers the user's original question.

Guidelines:
- Be concise but informative
- Use bullet points or numbered lists when appropriate
- Highlight important findings or anomalies
- If there are errors, explain them clearly
- If there's no data, explain why that might be
- Use business-friendly language, not technical jargon

Original User Question: "${originalPrompt}"

Format the following MCP response into a clear, natural language answer:`;

    try {
      // Log the MCP response size for debugging
      const mcpResponseStr = JSON.stringify(mcpResponse, null, 2);
      logger.info(`MCP response size: ${mcpResponseStr.length} characters`);
      
      // If response is too large, truncate it for LLM processing
      let responseForLLM = mcpResponseStr;
      if (mcpResponseStr.length > 10000) {
        logger.warn('MCP response is large, truncating for LLM processing');
        responseForLLM = mcpResponseStr.substring(0, 10000) + '\n... [truncated]';
      }

      // Add timeout to prevent hanging
      const formattingPromise = this.model.generateContent([
        { text: systemPrompt },
        { text: responseForLLM }
      ]);

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('LLM formatting timeout')), 30000); // 30 second timeout
      });

      const result = await Promise.race([formattingPromise, timeoutPromise]) as any;
      const response = await result.response;
      const content = response.text();
      
      if (!content) {
        throw new Error('No response from Gemini');
      }

      logger.info('Formatted MCP response to natural language');
      return content;

    } catch (error) {
      logger.error('Error formatting MCP response:', error);
      // Fallback to simple formatting
      return this.simpleFormatResponse(mcpResponse);
    }
  }

  /**
   * Simple fallback formatter when LLM is not available
   */
  private simpleFormatResponse(mcpResponse: MCPResponse): string {
    if (mcpResponse.error) {
      return `❌ Error: ${mcpResponse.error}`;
    }

    if (mcpResponse.result) {
      if (Array.isArray(mcpResponse.result)) {
        return `📊 Found ${mcpResponse.result.length} results:\n${JSON.stringify(mcpResponse.result, null, 2)}`;
      } else {
        return `📊 Result: ${JSON.stringify(mcpResponse.result, null, 2)}`;
      }
    }

    return '✅ Request completed successfully';
  }

  /**
   * Check if LLM service is available
   */
  isAvailable(): boolean {
    return this.model !== null;
  }
}

export default LLMService;
