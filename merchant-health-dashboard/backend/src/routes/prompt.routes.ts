import express from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { authenticateToken } from '../middleware/auth.middleware';
import { coralogixMCP } from '../app';
import { getTokenExpiry } from '../routes/auth.routes';
import LLMService from '../services/llm.service';
const router = express.Router();

// Session management for automatic date initialization
interface McpSession {
  token: string;
  sessionStart: Date;
  sessionEnd: Date;
}

const mcpSessions = new Map<string, McpSession>();

// Helper function to get or create user session
function getMcpSession(token: string): McpSession {
  const existingSession = mcpSessions.get(token);
  if (!existingSession) {
    const sessionEnd = new Date(getTokenExpiry(token)!);
    const sessionStart = new Date(sessionEnd.getTime() - 6 * 60 * 60 * 1000);

    const newSession: McpSession = {
      token,
      sessionStart,
      sessionEnd
    };

    mcpSessions.set(token, newSession);
    logger.info(`Created new 6-hour session for Token: ${token}: ${sessionStart.toISOString()} to ${sessionEnd.toISOString()}`);
    return newSession;
  }
  return existingSession;
}

// Helper function to format date for Coralogix
function formatDateForCoralogix(date: Date): string {
  return date.toISOString();
}

// Helper function to extract timestamp from transaction ID
function extractTimestampFromTransactionId(transactionId: string): { startDate: Date; endDate: Date } | null {
  // Transaction ID format: yymmddhhmmss + additional characters
  // Example: 251004150441756E739681790 -> 25-10-04 15:04:41
  const match = transactionId.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);

  if (!match) {
    return null;
  }

  const [, yy, mm, dd, hh, min, ss] = match;
  const year = 2000 + parseInt(yy);
  const month = parseInt(mm) - 1; // JavaScript months are 0-indexed
  const day = parseInt(dd);
  const hour = parseInt(hh);
  const minute = parseInt(min);
  const second = parseInt(ss);

  // Create date in local timezone (assuming IST for transaction logs)
  const transactionTime = new Date(year, month, day, hour, minute, second);

  // Search window: 2 hours before to 2 hours after (broader range to catch timezone issues)
  const startDate = new Date(transactionTime.getTime() - 2 * 60 * 60 * 1000);
  const endDate = new Date(transactionTime.getTime() + 2 * 60 * 60 * 1000);

  return { startDate, endDate };
}

// Validation schema
const promptSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
});

/**
 * @swagger
 * components:
 *   schemas:
 *     PromptRequest:
 *       type: object
 *       required:
 *         - prompt
 *       properties:
 *         prompt:
 *           type: string
 *           description: Natural language query or DataPrime query
 *           example: "Show me logs for transaction 250928190448714E410380693"
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: Start time for session
 *           example: "2025-09-28T18:00:00Z"
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: End time for session
 *           example: "2025-09-28T20:00:00Z"
 *         limit:
 *           type: number
 *           minimum: 1
 *           maximum: 1000
 *           description: Maximum number of results
 *           example: 50
 *     
 *     PromptResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           description: Query results from MCP server
 *         error:
 *           type: string
 *           description: Error message if query failed
 *         executionTime:
 *           type: number
 *           description: Query execution time in milliseconds
 *           example: 1250
 *         prompt:
 *           type: string
 *           description: Original user prompt
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: When the query was executed
 */

/**
 * @swagger
 * /api/coralogix/prompt:
 *   post:
 *     summary: Execute user prompt
 *     description: Execute a natural language query against the MCP server
 *     tags: [Prompt]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PromptRequest'
 *     responses:
 *       200:
 *         description: Query executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PromptResponse'
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authenticateToken, async (req, res) => {
  let prompt = '';
  try {
    const token: string = req.headers.authorization?.replace('Bearer ', '') as string;
    const parsedBody = promptSchema.parse(req.body);
    prompt = parsedBody.prompt;

    const mcpSession = getMcpSession(token);
    const llmService = LLMService.getInstance();

    // Ensure MCP is initialized
    if (!coralogixMCP.isMCPInitialized()) {
      logger.info('MCP not initialized, initializing now...');
      await coralogixMCP.initialize();
    }

    logger.info(`Executing user prompt: "${prompt}" for user ${token}`);

    const startTime = Date.now();

    // Check if prompt contains a transaction ID and extract timestamp
    const transactionIdMatch = prompt.match(/\b(\d{12,})\b/);
    let searchContext = {
      sessionStart: mcpSession.sessionStart,
      sessionEnd: mcpSession.sessionEnd
    };

    if (transactionIdMatch) {
      const transactionId = transactionIdMatch[1];
      const timestampRange = extractTimestampFromTransactionId(transactionId);

      if (timestampRange) {
        searchContext = {
          sessionStart: timestampRange.startDate,
          sessionEnd: timestampRange.endDate
        };
        logger.info(`Using transaction timestamp range: ${timestampRange.startDate.toISOString()} to ${timestampRange.endDate.toISOString()}`);
      }
    }

    // Step 1: Convert natural language to MCP request
    logger.info('Step 1: Converting prompt to MCP request...');
    const mcpRequest = await llmService.convertPromptToMCPRequest(prompt, searchContext);
    logger.info(`Converted to MCP request: ${JSON.stringify(mcpRequest)}`);

    // Step 2: Send MCP request and get response
    logger.info('Step 2: Sending MCP request...');
    const mcpResponse = await coralogixMCP.sendMCPRequest(mcpRequest.method, mcpRequest.params);
    logger.info(`Received MCP response: ${JSON.stringify(mcpResponse)}`);

    // Step 3: Format MCP response to natural language
    logger.info('Step 3: Formatting MCP response...');
    const naturalLanguageResponse = await llmService.formatMCPResponse(
      { result: mcpResponse },
      prompt
    );
    logger.info('Step 3: Completed formatting MCP response');

    const executionTime = Date.now() - startTime;

    const response = {
      success: true,
      data: {
        naturalLanguageResponse
      },
      prompt,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors
      });
    }

    logger.error('Prompt execution error:', error);

    // Handle different types of errors
    if (error.message.includes('MCP Error') || error.message.includes('timeout')) {
      return res.status(503).json({
        success: false,
        error: 'MCP server error',
        message: error.message,
        prompt,
        timestamp: new Date().toISOString()
      });
    }

    if (error.message.includes('Google') || error.message.includes('Gemini') || error.message.includes('LLM')) {
      return res.status(503).json({
        success: false,
        error: 'LLM service error',
        message: error.message,
        prompt,
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to execute prompt',
      message: error.message,
      prompt,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/coralogix/prompt/status:
 *   get:
 *     summary: Get MCP connection status
 *     description: Check if the MCP client is connected to the server
 *     tags: [Prompt]
 *     responses:
 *       200:
 *         description: Connection status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connected:
 *                   type: boolean
 *                   example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    // Check if coralogixMCP process is running
    const connected = coralogixMCP && coralogixMCP.listenerCount('stdout') > 0;

    res.json({
      connected,
      timestamp: new Date().toISOString(),
      message: connected ? 'MCP connection is active' : 'MCP connection is not active'
    });
  } catch (error: any) {
    logger.error('Failed to get connection status:', error);
    res.status(500).json({
      error: 'Failed to get connection status',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/coralogix/prompt/examples:
 *   get:
 *     summary: Get prompt examples
 *     description: Get example prompts for different use cases
 *     tags: [Prompt]
 *     responses:
 *       200:
 *         description: Examples retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 examples:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       prompt:
 *                         type: string
 */
router.get('/examples', authenticateToken, async (req, res) => {
  const examples = [
    {
      title: "Check Transaction Status",
      description: "Check if a specific transaction has been posted",
      prompt: "Show me logs for transaction 250928190448714E410380693"
    },
    {
      title: "Find Error Logs",
      description: "Find all error logs",
      prompt: "Show me all error logs"
    },
    {
      title: "ConfigApps Posting Logs",
      description: "Find all successful posting logs in ConfigApps",
      prompt: "Show me posting successful logs in configapps"
    },
    {
      title: "DataPrime Query",
      description: "Execute a direct DataPrime query",
      prompt: "source logs | filter $l.applicationname == 'prod-configapps' | filter $m.severity == ERROR | limit 10"
    },
    {
      title: "Search by Application",
      description: "Search logs for a specific application",
      prompt: "Show me logs from configapps"
    }
  ];

  res.json({
    examples,
    timestamp: new Date().toISOString()
  });
});

export default router;
