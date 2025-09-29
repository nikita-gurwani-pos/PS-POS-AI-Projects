import express from "express";
import influxDBService from "../services/influxdb.service";
import authenticateToken from "../middleware/auth.middleware";
import logger from "../utils/logger";

const router = express.Router();

// Apply authentication to all merchant routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/merchants:
 *   get:
 *     summary: Get all available merchants/organizations
 *     description: Get list of all merchants with their basic information
 *     tags: [Merchants]
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: string
 *         example: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: string
 *         example: 10
 *     responses:
 *       200:
 *         description: List of merchants
 *         content:
 *           application/json:
 *             schema:
 *               type: 'object'
 *               properties:
 *                 merchants:
 *                   type: 'array'
 *                   items:
 *                     $ref: '#/components/schemas/Merchant'
 *                 total:
 *                   type: 'number'
 *                   example: 50
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
    const offset: number = page * limit - limit;
    const orgCodes = await influxDBService.getOrgCodes(offset, limit);

    // Transform the data to a more user-friendly format
    const merchants = orgCodes.map((row: any) => ({
      orgCode: row.value,
    }));

    res.json({
      merchants,
      total: merchants.length,
    });
  } catch (error: any) {
    logger.error("Get merchants error:", error);
    res.status(500).json({
      error: "Failed to fetch merchants",
    });
  }
});

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
