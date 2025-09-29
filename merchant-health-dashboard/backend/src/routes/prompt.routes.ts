import express from 'express';
import { z } from 'zod';
import mcpClient from '../services/mcp-client.service';
import logger from '../utils/logger';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

// Validation schema
const promptSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().min(1).max(1000).optional()
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
 *           description: Start time for search
 *           example: "2025-09-28T18:00:00Z"
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: End time for search
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
 * /api/prompt:
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
  try {
    const { prompt, startDate, endDate, limit } = promptSchema.parse(req.body);

    logger.info(`Executing user prompt: "${prompt}"`);

    const result = await mcpClient.executeQuery(prompt, {
      startDate,
      endDate,
      limit
    });

    const response = {
      ...result,
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
    res.status(500).json({
      error: 'Failed to execute prompt',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/prompt/status:
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
    const connected = mcpClient.getConnectionStatus();
    
    res.json({
      connected,
      timestamp: new Date().toISOString()
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
 * /api/prompt/examples:
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
