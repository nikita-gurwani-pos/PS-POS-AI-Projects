/*
This is the Router used for all the apis in first page post login for merchant dashboard
*/

import express from "express";
import influxDBService from "../services/influxdb.service";
import authenticateToken from "../middleware/auth.middleware";
import logger from "../utils/logger";
import { post } from "../utils/restUtils";
import {
  processEzetapResponse,
  EzetapApiResponse,
  ProcessedMerchantData,
} from "../utils/utils";

const router = express.Router();

// Apply authentication to all merchant routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/merchants/filter:
 *   get:
 *     summary: Search and filter merchants
 *     description: |
 *       Search for merchants using organization code pattern matching with regex support.
 *
 *       **Search Features:**
 *       - Regex pattern matching for flexible searches
 *       - Case-insensitive organization code lookup
 *       - Real-time merchant discovery
 *       - Integration with InfluxDB merchant data
 *
 *       **Use Cases:**
 *       - Find merchants by partial organization code
 *       - Discover related merchant organizations
 *       - Validate merchant existence
 *       - Build merchant selection interfaces
 *
 *       **Search Patterns:**
 *       - Exact match: `ORG_123`
 *       - Partial match: `ORG_12` (finds ORG_123, ORG_124, etc.)
 *       - Wildcard: `ORG_*` (finds all ORG_ prefixed merchants)
 *     tags: [Merchant Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: org
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization code pattern to search for (supports regex matching)
 *         example: "ORG_123"
 *     responses:
 *       200:
 *         description: Successfully retrieved filtered merchants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 merchants:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Array of organization codes matching the filter
 *                   example: ["ORG_12345", "ORG_12346", "ORG_12390"]
 *       400:
 *         description: Missing required 'org' query parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing 'org' query parameter"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch merchants filter"
 */
router.get("/filter", async (req, res) => {
  try {
    const org = req.query.org as string; // Extract the 'org' query parameter

    if (!org) {
      return res.status(400).json({
        error: "Missing 'org' query parameter",
      });
    }

    const orgCodes = await influxDBService.getOrgCodesWithRegex(org);
    const merchants = orgCodes.map((row: any) => row.value);

    res.status(200).json({
      merchants,
    });
  } catch (error: any) {
    logger.error("Get merchants filter error:", error);
    res.status(500).json({
      error: "Failed to fetch merchants filter",
    });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     MerchantHealth:
 *       type: object
 *       properties:
 *         orgCode:
 *           type: string
 *           example: "ORG_12345"
 *         successfulTxns:
 *           type: number
 *           description: Sum of AUTHORIZED and SETTLED transactions
 *           example: 1245
 *         failedTxns:
 *           type: number
 *           description: Number of FAILED transactions
 *           example: 12
 *         pendingTxns:
 *           type: number
 *           description: Number of PENDING transactions
 *           example: 5
 *         healthStatus:
 *           type: string
 *           enum: [Good, Warning, Critical, Unknown]
 *           example: "Good"
 *         healthColor:
 *           type: string
 *           description: Hex color code for health status
 *           example: "#4CAF50"
 */

/**
 * @swagger
 * /api/merchants:
 *   get:
 *     summary: Get merchant health dashboard data
 *     description: Get list of merchants with transaction health information including success/failure counts and health status. Supports filtering by organization code and time range.
 *     tags: [Merchants]
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: number
 *         example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: number
 *         example: 10
 *         description: Number of merchants per page
 *       - in: query
 *         name: orgCode
 *         required: false
 *         schema:
 *           type: string
 *         example: "ORG_12345"
 *         description: Filter by specific organization code. If provided, only data for this merchant will be returned.
 *       - in: query
 *         name: filter
 *         required: false
 *         schema:
 *           type: string
 *           enum: [30d, 7d, 1d, 6h, 1hr, 10m, 1m]
 *         example: "1d"
 *         description: Time filter for transaction data
 *     responses:
 *       200:
 *         description: Merchant health data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 merchants:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MerchantHealth'
 *                 total:
 *                   type: number
 *                   example: 50
 *                 page:
 *                   type: number
 *                   example: 1
 *                 limit:
 *                   type: number
 *                   example: 10
 *                 timeFilter:
 *                   type: string
 *                   example: "1d"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", async (req, res) => {
  try {
    const page: number = parseInt(req.query.page as string) || 1;
    const limit: number = parseInt(req.query.limit as string) || 10;
    const orgCodeFIlter = (req.query.orgCode as string) || "";
    const offset: number = page * limit - limit;
    const timeFilter: string = req.query.filter as string;
    let orgCodeString = "";
    if (orgCodeFIlter === "") {
      const orgCodes = await influxDBService.getOrgCodes(offset, limit);
      orgCodeString = orgCodes.map((row: any) => row.value).join(",");
    } else {
      orgCodeString = orgCodeFIlter;
    }
    const ezetapResponse: EzetapApiResponse = (await post(
      `${process.env.EZETAP_API_URL}/transactions/getTxnsHealthByOrg`,
      {
        username: `${process.env.EZETAP_USERNAME}`,
        password: `${process.env.EZETAP_PASSWORD}`,
      },
      {
        orgCodes: orgCodeString,
        filter: timeFilter,
      },
    )) as EzetapApiResponse;

    // Process the EZETAP response to match UI requirements
    const processedMerchants: ProcessedMerchantData[] =
      processEzetapResponse(ezetapResponse);

    res.json({
      merchants: processedMerchants,
      total: processedMerchants.length,
      page,
      limit,
      timeFilter,
    });
  } catch (error: any) {
    logger.error("Get merchants error:", error);
    res.status(500).json({
      error: "Failed to fetch merchants",
    });
  }
});

// the below api is redundant and can be used later
/**
 * @swagger
 * /api/merchants/{orgCode}:
 *   get:
 *     summary: Get specific merchant details
 *     description: Get detailed information about a specific merchant/organization
 *     tags: [Merchants]
 *     parameters:
 *       - in: path
 *         name: orgCode
 *         required: true
 *         schema:
 *           type: string
 *         example: TFSYAMUNA_78897285
 *         description: Organization code
 *     responses:
 *       200:
 *         description: Merchant details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Merchant'
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
router.get("/:orgCode", async (req, res) => {
  try {
    const { orgCode } = req.params;

    if (!orgCode) {
      return res.status(400).json({
        error: "Organization code is required",
      });
    }

    // Get merchant info and request types
    const [requestTypes, recentActivity, fetchKeys] = await Promise.all([
      influxDBService.getRequestTypes(orgCode),
      influxDBService.getMerchantRequests(
        orgCode,
        influxDBService.buildTimeFilter(
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        ),
      ),
      influxDBService.getFetchKeys(orgCode),
    ]);

    const merchant = {
      orgCode,
      requestTypes: requestTypes.map((row: any) => row.value),
      fetchKeys: fetchKeys.map((row) => row.value),
      recentActivity: {
        totalRequests: recentActivity[0]?.total_requests || 0,
        lastUpdated: new Date().toISOString(),
      },
    };

    res.json(merchant);
  } catch (error: any) {
    logger.error("Get merchant details error:", error);
    res.status(500).json({
      error: "Failed to fetch merchant details",
    });
  }
});

export default router;
