// This routeer is for 2nd page when user clicks on more details against the orgcode in the first page
import express from "express";
import { z } from "zod";
import influxDBService from "../services/influxdb.service";
import authenticateToken from "../middleware/auth.middleware";
import logger from "../utils/logger";

const router = express.Router();

// Apply authentication to all dashboard routes
router.use(authenticateToken);

// Validation schemas
const dashboardQuerySchema = z.object({
  orgCode: z.string().min(1, "Organization code is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  requestType: z.string().optional(),
  groupBy: z.string().default("1h"),
});

/**
 * @swagger
 * /api/dashboard/overview:
 *   get:
 *     summary: Get merchant health dashboard overview
 *     description: |
 *       Retrieve comprehensive health metrics for a specific merchant organization.
 *
 *       **Key Metrics:**
 *       - Total request volume and success rates
 *       - Average response times and performance indicators
 *       - Error counts and failure analysis
 *       - Request type breakdown (Normal, Txn_posting, Logtickets)
 *
 *       **Data Sources:**
 *       - InfluxDB time-series data
 *       - Real-time merchant transaction logs
 *       - Historical performance trends
 *
 *       **Use Cases:**
 *       - Monitor merchant health status
 *       - Identify performance bottlenecks
 *       - Track success rates and error patterns
 *       - Generate executive dashboards
 *     tags: [Dashboard & Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orgCode
 *         required: true
 *         schema:
 *           type: string
 *         example: TFSYAMUNA_78897285
 *         description: Unique organization/merchant code identifier
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *           format: date-time
 *         example: 2025-09-20T00:00:00Z
 *         description: Start time for data filtering (ISO 8601 format)
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *           format: date-time
 *         example: 2025-09-27T23:59:59Z
 *         description: End time for data filtering (ISO 8601 format)
 *       - in: query
 *         name: requestType
 *         schema:
 *           type: string
 *           enum: [Normal, Txn_posting, Logtickets]
 *         example: Normal
 *         description: Filter by specific request type
 *     responses:
 *       200:
 *         description: Dashboard overview data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardOverview'
 *       400:
 *         description: Validation error
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
router.get("/overview", async (req, res) => {
  try {
    const { orgCode, startTime, endTime } = dashboardQuerySchema.parse(
      req.query,
    );

    const timeFilter = influxDBService.buildTimeFilter(startTime, endTime);
    const overview = await influxDBService.getDashboardOverview(
      orgCode,
      timeFilter,
    );

    res.json({
      orgCode,
      timeRange: { startTime, endTime },
      metrics: overview,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }

    logger.error("Dashboard overview error:", error);
    res.status(500).json({
      error: "Failed to fetch dashboard overview",
    });
  }
});

/**
 * @swagger
 * /api/dashboard/timeseries:
 *   get:
 *     summary: Get time series data for charts
 *     description: Get time-based data points for visualization
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: orgCode
 *         required: true
 *         schema:
 *           type: string
 *         example: TFSYAMUNA_78897285
 *         description: Organization code
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *           format: date-time
 *         example: 2025-09-20T00:00:00Z
 *         description: Start time for data filtering
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *           format: date-time
 *         example: 2025-09-27T23:59:59Z
 *         description: End time for data filtering
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *         example: 1h
 *         description: Time grouping interval (1m, 5m, 1h, 1d)
 *     responses:
 *       200:
 *         description: Time series data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TimeSeriesData'
 *       400:
 *         description: Validation error
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
router.get("/timeseries", async (req, res) => {
  try {
    const { orgCode, startTime, endTime, groupBy } = dashboardQuerySchema.parse(
      req.query,
    );

    const timeFilter = influxDBService.buildTimeFilter(startTime, endTime);
    const timeSeriesData = await influxDBService.getTimeSeriesData(
      orgCode,
      timeFilter,
      groupBy,
    );

    res.json({
      orgCode,
      timeRange: { startTime, endTime },
      groupBy,
      data: timeSeriesData,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }

    logger.error("Time series data error:", error);
    res.status(500).json({
      error: "Failed to fetch time series data",
    });
  }
});

/**
 * @swagger
 * /api/dashboard/configSR:
 *   get:
 *     summary: Get configuration success rate data
 *     description: Get success and error counts for HTTP client requests grouped by fetch_key, org_code, and description for Normal and Txn_posting request types
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: orgCode
 *         required: true
 *         schema:
 *           type: string
 *         example: TFSYAMUNA_78897285
 *         description: Organization code to filter results
 *       - in: query
 *         name: filter
 *         required: true
 *         schema:
 *           type: string
 *         example: "7d"
 *         description: Time filter for data retrieval (e.g., 1h, 6h, 1d, 7d, 30d)
 *     responses:
 *       200:
 *         description: Configuration success rate data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 configSR:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       success:
 *                         type: number
 *                         description: Count of successful requests (2xx status codes)
 *                         example: 150
 *                       errors:
 *                         type: number
 *                         description: Count of error requests (non-2xx status codes)
 *                         example: 5
 *                       fetch_key:
 *                         type: string
 *                         description: API fetch key identifier
 *                         example: "CONFIG_API"
 *                       org_code:
 *                         type: string
 *                         description: Organization code
 *                         example: "TFSYAMUNA_78897285"
 *                       description:
 *                         type: string
 *                         description: Request description
 *                         example: "Configuration fetch"
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing required parameters: orgCode and filter"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/configSR", async (req, res) => {
  try {
    const orgCode = req.query.orgCode as string;
    const timeFilter: string = req.query.filter as string;

    if (!orgCode || !timeFilter) {
      return res.status(400).json({
        error: "Missing required parameters: orgCode and filter",
      });
    }

    const configSR = await influxDBService.getConfigSR(orgCode, timeFilter);
    res.json({
      configSR,
    });
  } catch (error: any) {
    logger.error("Config SR error:", error);
    res.status(500).json({
      error: "Failed to fetch configuration success rate data",
    });
  }
});

/**
 * @swagger
 * /api/dashboard/transactions/timeline:
 *   get:
 *     summary: Get recent transaction timeline
 *     description: |
 *       Retrieve a timeline of recent transactions for a specific merchant organization.
 *       
 *       **Transaction Information:**
 *       - Transaction status (SETTLED, AUTHORIZED, FAILED, PENDING)
 *       - Transaction amount
 *       - Response time in milliseconds
 *       - Error messages and codes for failed transactions
 *       - Timestamp for each transaction
 *       
 *       **Use Cases:**
 *       - Monitor recent transaction activity
 *       - Identify transaction failures and errors
 *       - Track transaction response times
 *       - Analyze transaction patterns
 *     tags: [Dashboard & Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orgCode
 *         required: true
 *         schema:
 *           type: string
 *         example: TFSYAMUNA_78897285
 *         description: Unique organization/merchant code identifier
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         example: 10
 *         description: Maximum number of transactions to return
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *           format: date-time
 *         example: 2025-09-20T00:00:00Z
 *         description: Start time for transaction filtering (ISO 8601 format). Defaults to last 24 hours if not provided.
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *           format: date-time
 *         example: 2025-09-27T23:59:59Z
 *         description: End time for transaction filtering (ISO 8601 format)
 *     responses:
 *       200:
 *         description: Recent transaction timeline retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orgCode:
 *                   type: string
 *                   example: TFSYAMUNA_78897285
 *                 timeRange:
 *                   type: object
 *                   properties:
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-09-27T14:30:00Z"
 *                         description: Transaction timestamp
 *                       status:
 *                         type: string
 *                         enum: [SETTLED, AUTHORIZED, FAILED, PENDING]
 *                         example: SETTLED
 *                         description: Transaction status
 *                       amount:
 *                         type: number
 *                         example: 125000
 *                         description: Transaction amount in paise/cents
 *                       responseTime:
 *                         type: number
 *                         example: 245
 *                         description: Response time in milliseconds
 *                       errorMessage:
 *                         type: string
 *                         example: INSUFFICIENT_FUNDS
 *                         description: Error message for failed transactions
 *                       errorCode:
 *                         type: string
 *                         example: ERR_TIMEOUT
 *                         description: Error code for failed transactions
 *       400:
 *         description: Validation error
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
router.get("/transactions/timeline", async (req, res) => {
  try {
    const { orgCode, startTime, endTime } = dashboardQuerySchema.parse(
      req.query,
    );
    const limit = parseInt(req.query.limit as string) || 10;

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        error: "Limit must be between 1 and 100",
      });
    }

    const timeFilter = influxDBService.buildTimeFilter(startTime, endTime);
    const transactions = await influxDBService.getRecentTransactions(
      orgCode,
      limit,
      timeFilter || undefined,
    );

    res.json({
      orgCode,
      timeRange: { startTime, endTime },
      transactions,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }

    logger.error("Transaction timeline error:", error);
    res.status(500).json({
      error: "Failed to fetch transaction timeline",
    });
  }
});

/**
 * @swagger
 * /api/dashboard/trends:
 *   get:
 *     summary: Get trend analysis data
 *     description: |
 *       Retrieve trend analysis including hourly volume data and today vs yesterday comparison.
 *       
 *       **Trend Metrics:**
 *       - Hourly transaction volume for the last 24 hours
 *       - Today's total transaction count
 *       - Yesterday's total transaction count
 *       - Percentage change between today and yesterday
 *       
 *       **Use Cases:**
 *       - Visualize transaction volume trends
 *       - Compare daily performance
 *       - Identify peak transaction hours
 *       - Monitor growth or decline patterns
 *     tags: [Dashboard & Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orgCode
 *         required: true
 *         schema:
 *           type: string
 *         example: TFSYAMUNA_78897285
 *         description: Unique organization/merchant code identifier
 *     responses:
 *       200:
 *         description: Trend analysis data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orgCode:
 *                   type: string
 *                   example: TFSYAMUNA_78897285
 *                 hourlyVolume:
 *                   type: array
 *                   description: Hourly transaction volume for the last 24 hours
 *                   items:
 *                     type: object
 *                     properties:
 *                       time:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-09-27T00:00:00Z"
 *                         description: Hour timestamp
 *                       volume:
 *                         type: number
 *                         example: 1250
 *                         description: Transaction volume for that hour
 *                 todayVsYesterday:
 *                   type: object
 *                   properties:
 *                     todayTotal:
 *                       type: number
 *                       example: 12450
 *                       description: Total transactions today
 *                     yesterdayTotal:
 *                       type: number
 *                       example: 11800
 *                       description: Total transactions yesterday
 *                     percentageChange:
 *                       type: number
 *                       example: 5.5
 *                       description: Percentage change (positive for increase, negative for decrease)
 *       400:
 *         description: Validation error
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
router.get("/trends", async (req, res) => {
  try {
    const { orgCode } = dashboardQuerySchema.parse(req.query);

    const trendAnalysis = await influxDBService.getTrendAnalysis(orgCode);

    res.json({
      orgCode,
      ...trendAnalysis,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }

    logger.error("Trend analysis error:", error);
    res.status(500).json({
      error: "Failed to fetch trend analysis",
    });
  }
});

export default router;
