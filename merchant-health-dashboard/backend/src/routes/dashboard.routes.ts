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
 *     summary: Get dashboard overview metrics
 *     description: Get high-level metrics for a specific organization
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
        error: "Missing required parameters: orgCode and filter"
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

export default router;
