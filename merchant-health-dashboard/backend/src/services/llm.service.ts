import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import logger from "../utils/logger";
import CoralogixMCPClient from "../mcp/coralogix-mcp";
import { log } from "winston";

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
      this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    } else {
      logger.warn("Google API key not found. LLM features will be disabled.");
    }
  }

  public static getInstance(): LLMService {
    if (!this.instance) {
      this.instance = new LLMService();
    }
    return this.instance;
  }

  /**
   * Classify if a prompt requires MCP processing or is conversational
   */
  async classifyPrompt(
    prompt: string,
  ): Promise<{ needsMCP: boolean; reasoning: string }> {
    if (!this.model) {
      throw new Error("Google API key not configured");
    }

    const classificationPrompt = `Analyze this user prompt and determine if it requires querying log/metric data from Coralogix or if it's just conversational.

User Prompt: "${prompt}"

Respond with ONLY a JSON object:
{
  "needsMCP": true/false,
  "reasoning": "brief explanation"
}

Examples:
- "Hello" -> {"needsMCP": false, "reasoning": "Simple greeting"}
- "How are you?" -> {"needsMCP": false, "reasoning": "Conversational question"}
- "Show me transaction logs for merchant ABC" -> {"needsMCP": true, "reasoning": "Requires log data query"}
- "What errors occurred yesterday?" -> {"needsMCP": true, "reasoning": "Requires error log analysis"}
- "Find transaction 251004150441756E739681790" -> {"needsMCP": true, "reasoning": "Specific transaction lookup"}`;

    try {
      const result = await this.model.generateContent(classificationPrompt);
      const response = await result.response;
      const content = response.text().trim();

      // Clean JSON response
      let cleanContent = content;
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent
          .replace(/^```json\s*/, "")
          .replace(/\s*```$/, "");
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent
          .replace(/^```\s*/, "")
          .replace(/\s*```$/, "");
      }

      const classification = JSON.parse(cleanContent);
      logger.info(`Prompt classification: ${JSON.stringify(classification)}`);
      return classification;
    } catch (error) {
      logger.error("Error classifying prompt:", error);
      // Default to conversational for safety
      return {
        needsMCP: false,
        reasoning: "Classification failed, defaulting to conversational",
      };
    }
  }

  /**
   * Handle conversational prompts that don't need MCP
   */
  async handleConversationalPrompt(prompt: string): Promise<string> {
    if (!this.model) {
      throw new Error("Google API key not configured");
    }

    const conversationalPrompt = `You are a helpful assistant for the Merchant Health Dashboard system.

The user said: "${prompt}"

Respond in a friendly, helpful way. If they're greeting you, greet them back and explain what you can help with regarding merchant health monitoring, transaction analysis, and log investigation.

Keep your response concise and professional.`;

    try {
      const result = await this.model.generateContent(conversationalPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      logger.error("Error handling conversational prompt:", error);
      return "Hello! I'm here to help you analyze merchant health data, investigate transactions, and explore logs. What can I assist you with today?";
    }
  }

  /**
   * Convert natural language prompt to MCP request format
   */
  async convertPromptToMCPRequest(
    prompt: string,
    context?: any,
  ): Promise<MCPRequest> {
    if (!this.model) {
      throw new Error("Google API key not configured");
    }

    // Get MCP connection and available tools
    const mcpConnection = CoralogixMCPClient.getConnectionObject();
    const availableTools = mcpConnection.getAvailableTools();
    const dataprimeDocs = mcpConnection.getDataprimeDocs();

    // Build tools context
    const toolsContext = availableTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
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
- ALWAYS Use the exact tool names from the available tools list
- ALWAYS follow the Dataprime syntax for queries
- Use proper time formats (ISO 8601)
- Include all required parameters from the tool's inputSchema

SEARCH OPTIMIZATION STRATEGY:
- If users asks posting details about a transaction eg, 251004150442485E909395731; then check in 'prod-configapps' with 'txn_posting' as search param.
- If user asks for the peroformance of an orgcode, eg: How is TFSYAMUNA_78897285 orgcode performing in last 30 mins. Any major issues with transactions for this merchant. Then we should search using query like this: source logs last 30m | filter $d ~~ 'TFSYAMUNA_78897285' | filter $d ~~ 'error' || $d ~~ 'fail' || $d ~~ 'exception'
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
        { text: prompt },
      ]);

      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error("No response from Gemini");
      }

      // Clean the response - remove markdown formatting if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent
          .replace(/^```json\s*/, "")
          .replace(/\s*```$/, "");
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent
          .replace(/^```\s*/, "")
          .replace(/\s*```$/, "");
      }

      // Parse the JSON response
      const mcpRequest = JSON.parse(cleanContent);

      // Validate the structure
      if (!mcpRequest.method || !mcpRequest.params) {
        throw new Error("Invalid MCP request format from LLM");
      }

      logger.info(
        `Converted prompt to MCP request: ${JSON.stringify(mcpRequest)}`,
      );
      return mcpRequest;
    } catch (error) {
      logger.error("Error converting prompt to MCP request:", error);
      throw new Error(`Failed to convert prompt to MCP request: ${error}`);
    }
  }

  /**
   * Convert MCP response to natural language
   */
  async formatMCPResponse(
    mcpResponse: MCPResponse,
    originalPrompt: string,
  ): Promise<string> {
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
        logger.warn("MCP response is large, truncating for LLM processing");
        responseForLLM =
          mcpResponseStr.substring(0, 10000) + "\n... [truncated]";
      }

      // Add timeout to prevent hanging
      const formattingPromise = this.model.generateContent([
        { text: systemPrompt },
        { text: responseForLLM },
      ]);

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("LLM formatting timeout")), 30000); // 30 second timeout
      });

      const result = (await Promise.race([
        formattingPromise,
        timeoutPromise,
      ])) as any;
      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error("No response from Gemini");
      }

      logger.info("Formatted MCP response to natural language");
      return content;
    } catch (error) {
      logger.error("Error formatting MCP response:", error);
      // Fallback to simple formatting
      return this.simpleFormatResponse(mcpResponse);
    }
  }

  async generateMCPRequestForSummaryForOrg(
    orgCode: string,
    searchContext: any,
  ): Promise<MCPRequest> {
    // Get MCP connection and available tools
    const mcpConnection = CoralogixMCPClient.getConnectionObject();
    const dataprimeDocs = mcpConnection.getDataprimeDocs();
    const availableTools = mcpConnection.getAvailableTools();

    // Build tools context
    const toolsContext = availableTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    logger.info("Inside summary generation for organization code:", orgCode);

    const prompt = `You are a log analysis assistant that summarizes system behavior for an organization code.

    DATAPRIME DOCUMENTATION:
    ${dataprimeDocs}

    AVAILABLE TOOLS:
    ${JSON.stringify(toolsContext, null, 2)}

    CONTEXT: ${JSON.stringify(searchContext || {})}

    Input:
    - Organization Code: "${orgCode}"
    - Time Window: Last 1 hour

    Task:
    1. Very important you need to analyze the logs to understand what’s happening for this org_code.
    2. Provide **one positive insight** (e.g., successful payments : check this in api-server application, successful postings : check this in prod-configapps application, etc).
    3. Provide **one negative insight** (e.g., timeouts, failures, etc).
    4. Write a short summary in a **status-card style**, no more than 3 lines, with emoji indicators.
    5. To analyze logs you need to call get_logs tool
    6. If data is missing or empty, respond with: “No recent activity for this org_code.”


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
    - ALWAYS Use the exact tool names from the available tools list
    - ALWAYS follow the Dataprime syntax for queries
    - Use proper time formats (ISO 8601)
    - Include all required parameters from the tool's inputSchema
`;
    try {
      logger.info(`Prompt: ${prompt}`);
      const result = await this.model.generateContent([{ text: prompt }]);

      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error("No response from Gemini");
      }

      // Clean the response - remove markdown formatting if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent
          .replace(/^```json\s*/, "")
          .replace(/\s*```$/, "");
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent
          .replace(/^```\s*/, "")
          .replace(/\s*```$/, "");
      }

      // Parse the JSON response
      const mcpRequest = JSON.parse(cleanContent);

      // Validate the structure
      if (!mcpRequest.method || !mcpRequest.params) {
        throw new Error("Invalid MCP request format from LLM");
      }

      logger.info(
        `Converted prompt to MCP request: ${JSON.stringify(mcpRequest)}`,
      );
      return mcpRequest;
    } catch (error) {
      logger.error("Error converting prompt to MCP request:", error);
      throw new Error(`Failed to convert prompt to MCP request: ${error}`);
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

    return "✅ Request completed successfully";
  }

  /**
   * Check if LLM service is available
   */
  isAvailable(): boolean {
    return this.model !== null;
  }
}

export default LLMService;
