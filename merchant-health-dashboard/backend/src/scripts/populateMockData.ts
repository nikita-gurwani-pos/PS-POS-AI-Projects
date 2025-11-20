import dotenv from "dotenv";
dotenv.config();

import influxDBService from "../services/influxdb.service";
import logger from "../utils/logger";

// Org codes from the existing cron file
const ORG_CODES = [
  "TFSYAMUNA_78897285",
  "INNOVATION_78904818",
  "ADANI_DIGITAL_LABS_PRIVAT",
  "LENSKART_SOLUTIONS_PVT_LT",
  "ISKCON_9618440",
  "RIL_JIO_MART_623",
  "WATCO_9777530533",
  "RDPR_PAYMENT_SOLUTIONS",
  "WESCO_UTILITY_32",
  "TP_CENTRAL_ODISHA_DISTRIB",
];

// Request types used in the application
const REQUEST_TYPES = ["Normal", "Txn_posting", "Logtickets"];

// Fetch keys (API endpoints)
const FETCH_KEYS = [
  "txn_posting",
  "CONFIG_API",
  "PAYMENT_GATEWAY",
  "AUTH_API",
  "BALANCE_CHECK",
  "REFUND_API",
  "SETTLEMENT_API",
];

// Status codes with realistic distribution
const STATUS_CODES = {
  success: ["200", "201", "202"],
  clientError: ["400", "401", "403", "404"],
  serverError: ["500", "502", "503", "504"],
};

// Error messages for failed requests
const ERROR_MESSAGES = [
  "INSUFFICIENT_FUNDS",
  "TIMEOUT",
  "NETWORK_ERROR",
  "INVALID_REQUEST",
  "AUTHENTICATION_FAILED",
  "RATE_LIMIT_EXCEEDED",
];

const ERROR_CODES = [
  "ERR_TIMEOUT",
  "ERR_NETWORK",
  "ERR_VALIDATION",
  "ERR_AUTH",
  "ERR_RATE_LIMIT",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Generate a realistic status code based on success rate
function generateStatus(successRate: number = 0.92): string {
  if (Math.random() < successRate) {
    return randomItem(STATUS_CODES.success);
  } else if (Math.random() < 0.7) {
    // 70% of errors are server errors
    return randomItem(STATUS_CODES.serverError);
  } else {
    return randomItem(STATUS_CODES.clientError);
  }
}

// Generate realistic response time based on status
function generateResponseTime(status: string): number {
  if (status.startsWith("2")) {
    // Success: 50-500ms
    return randomFloat(50, 500);
  } else if (status.startsWith("4")) {
    // Client error: 20-200ms (fail fast)
    return randomFloat(20, 200);
  } else {
    // Server error: 500-5000ms (timeouts, etc.)
    return randomFloat(500, 5000);
  }
}

function generateRecord(
  orgCode: string,
  timestamp: Date,
  requestType?: string,
  fetchKey?: string,
): any {
  const status = generateStatus();
  const responseTime = generateResponseTime(status);
  const type = requestType || randomItem(REQUEST_TYPES);
  const key = fetchKey || randomItem(FETCH_KEYS);

  const isSuccess = status.startsWith("2");
  const isError = !isSuccess;

  // Build tags object, excluding empty values (InfluxDB doesn't allow empty tag values)
  const tags: any = {
    org_code: orgCode,
    appName: "Config",
    method: "POST",
    type: type,
    metric_type: "histogram",
    externalApiRespStatus: status,
    status: status,
    username: `user${randomInt(1, 10)}`,
    instance: `C0${randomInt(1, 5)}`,
    description: `${type} request for ${key}`,
    fetch_key: key,
  };

  // Only add errorCode and errorMessage if they have values
  if (isError) {
    tags.errorCode = randomItem(ERROR_CODES);
    tags.errorMessage = randomItem(ERROR_MESSAGES);
  }

  return {
    measurement: "http_client_requests",
    tags: tags,
    fields: {
      count: 1,
      mean: responseTime,
      sum: responseTime,
      upper: responseTime + randomFloat(0, 100),
    },
    // InfluxDB expects timestamp in milliseconds, but the library might need it as a Date object
    // or we need to ensure it's in the right format. Let's use the Date object directly.
    timestamp: timestamp, // Use Date object instead of milliseconds
  };
}

// Generate data for a specific time range
async function generateDataForTimeRange(
  orgCode: string,
  startTime: Date,
  endTime: Date,
  intervalMinutes: number = 5,
  requestsPerInterval: number = 5,
): Promise<any[]> {
  const points: any[] = [];
  const currentTime = new Date(startTime);

  while (currentTime <= endTime) {
    for (let i = 0; i < requestsPerInterval; i++) {
      // Add some randomness to the timestamp within the interval
      const recordTime = new Date(
        currentTime.getTime() + randomInt(0, intervalMinutes * 60 * 1000),
      );

      // For transaction posting, generate more records (40% chance)
      if (Math.random() < 0.4) {
        points.push(generateRecord(orgCode, recordTime, "Txn_posting", "txn_posting"));
      }

      // Generate other request types (30% chance for Normal)
      if (Math.random() < 0.3) {
        points.push(generateRecord(orgCode, recordTime, "Normal", randomItem(FETCH_KEYS)));
      }

      // Generate Logtickets (10% chance)
      if (Math.random() < 0.1) {
        points.push(generateRecord(orgCode, recordTime, "Logtickets", "LOG_API"));
      }
    }

    // Move to next interval
    currentTime.setMinutes(currentTime.getMinutes() + intervalMinutes);
  }

  return points;
}

// Main function to populate mock data
async function populateMockData() {
  try {
    logger.info("Starting mock data population...");
    logger.info("Connecting to InfluxDB...");

    // Wait for InfluxDB connection with retry
    let client;
    let retries = 5;
    while (retries > 0) {
      try {
        client = await influxDBService.getConnection();
        await client.ping(5000);
        logger.info("Connected to InfluxDB successfully!");
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error("Failed to connect to InfluxDB after multiple attempts");
        }
        logger.warn(`Connection attempt failed, retrying... (${retries} attempts left)`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!client) {
      throw new Error("Failed to establish InfluxDB connection");
    }

    const allPoints: any[] = [];
    const now = new Date();

    // Generate data for different time ranges:
    // - Last 30 days (hourly intervals for performance)
    // - Last 7 days (15-minute intervals)
    // - Last 24 hours (5-minute intervals)
    // - Last hour (1-minute intervals)

    for (const orgCode of ORG_CODES) {
      logger.info(`Generating data for ${orgCode}...`);

      // Last 30 days - hourly data
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Generate data for last 30 days (4-hour intervals for performance)
      const points30d = await generateDataForTimeRange(
        orgCode,
        thirtyDaysAgo,
        sevenDaysAgo,
        240, // 4 hour intervals
        20, // 20 requests per interval
      );
      allPoints.push(...points30d);
      logger.info(`  Generated ${points30d.length} points for last 30 days`);

      // Generate data for last 7 days (1-hour intervals)
      const points7d = await generateDataForTimeRange(
        orgCode,
        sevenDaysAgo,
        oneDayAgo,
        60, // 1 hour intervals
        15, // 15 requests per interval
      );
      allPoints.push(...points7d);
      logger.info(`  Generated ${points7d.length} points for last 7 days`);

      // Generate data for last 24 hours (15-minute intervals)
      const points1d = await generateDataForTimeRange(
        orgCode,
        oneDayAgo,
        oneHourAgo,
        15, // 15 minute intervals
        10, // 10 requests per interval
      );
      allPoints.push(...points1d);
      logger.info(`  Generated ${points1d.length} points for last 24 hours`);

      // Generate data for last hour (5-minute intervals)
      const points1h = await generateDataForTimeRange(
        orgCode,
        oneHourAgo,
        now,
        5, // 5 minute intervals
        8, // 8 requests per interval
      );
      allPoints.push(...points1h);
      logger.info(`  Generated ${points1h.length} points for last hour`);
    }

    logger.info(`Total points to insert: ${allPoints.length}`);

    // Write in batches to avoid memory issues
    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < allPoints.length; i += batchSize) {
      const batch = allPoints.slice(i, i + batchSize);
      await client.writePoints(batch);
      inserted += batch.length;
      logger.info(`Inserted ${inserted}/${allPoints.length} points...`);
    }

    logger.info(`Successfully inserted ${allPoints.length} mock data points!`);
    logger.info("Mock data population completed!");
  } catch (error: any) {
    logger.error("Error populating mock data:", error);
    throw error;
  }
}

// Run the script
(async () => {
  try {
    await populateMockData();
    process.exit(0);
  } catch (error) {
    logger.error("Failed to populate mock data:", error);
    process.exit(1);
  }
})();

