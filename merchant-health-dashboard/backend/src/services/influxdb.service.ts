import { InfluxDB } from "influx";
import logger from "../utils/logger";

interface QueryResult {
  [key: string]: any;
}

interface TimeSeriesPoint {
  time: string;
  requests: number;
}

class InfluxDBService {
  private client: InfluxDB | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.init();
  }

  private init(): void {
    try {
      this.client = new InfluxDB({
        host: process.env.INFLUXDB_HOST || "localhost",
        port: parseInt(process.env.INFLUXDB_PORT || "8086"),
        database: process.env.INFLUXDB_DATABASE || "config-db",
        username: process.env.INFLUXDB_USERNAME || "",
        password: process.env.INFLUXDB_PASSWORD || "",
        protocol: "http",
      });

      this.testConnection();
    } catch (error) {
      logger.error("Failed to initialize InfluxDB client:", error);
    }
  }

  private async testConnection(): Promise<void> {
    try {
      await this.client!.ping(5000);
      this.isConnected = true;
      logger.info("InfluxDB connection established");
    } catch (error: any) {
      this.isConnected = false;
      logger.error("InfluxDB connection failed:", error.message);
    }
  }

  async query(sqlQuery: string): Promise<QueryResult[]> {
    if (!this.isConnected || !this.client) {
      throw new Error("InfluxDB not connected");
    }

    try {
      logger.info(`Executing InfluxDB query: ${sqlQuery}`);
      const result = await this.client.query(sqlQuery);
      logger.info(
        `Query executed successfully, returned ${result.length} results`,
      );
      return result;
    } catch (error: any) {
      logger.error("InfluxDB query failed:", error);
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  // Helper method to build time filter
  buildTimeFilter(startTime?: string, endTime?: string): string {
    if (startTime && endTime) {
      return `time >= '${startTime}' AND time <= '${endTime}'`;
    } else if (startTime) {
      return `time >= '${startTime}'`;
    } else if (endTime) {
      return `time <= '${endTime}'`;
    }
    return "";
  }

  // Get merchant requests data
  async getMerchantRequests(
    orgCode: string,
    timeFilter?: string,
    countOf2xx?: boolean,
  ): Promise<QueryResult[]> {
    let query = `
      SELECT sum("count") as total_requests
      FROM "http_client_requests"
      WHERE "org_code" = '${orgCode}'
    `;
    if (countOf2xx) {
      query += ` AND "status" =~ /^20.$/`;
    } else {
      query += ` AND "status" !~ /^20.$/`;
    }

    if (timeFilter) {
      query += ` AND ${timeFilter}`;
    }

    query += ` FILL(0)`;

    return await this.query(query);
  }

  async getMerchantAPIsAvgResponseTime(
    orgCode: string,
    timeFilter?: string,
    fetchKey?: string,
  ): Promise<QueryResult[]> {
    let query = `SELECT  max("mean")  / 1000 as avg_response_time FROM "http_client_requests" WHERE "org_code" = '${orgCode}'`;

    if (timeFilter) {
      query += ` AND ${timeFilter}`;
    }

    if (fetchKey) {
      query += ` AND "fetch_key" = '${fetchKey}'`;
      query += ` GROUP BY fetch_key`;
    }

    query += ` FILL(0)`;

    return await this.query(query);
  }

  // Get available org codes
  async getOrgCodes(offset: number, limit: number): Promise<QueryResult[]> {
    const query = `SHOW TAG VALUES FROM "http_client_requests" WITH KEY = "org_code" LIMIT ${limit} OFFSET ${offset}`;
    return await this.query(query);
  }

  async getOrgCodesWithRegex(regex: string): Promise<QueryResult[]> {
    const query = `SHOW TAG VALUES FROM "http_client_requests" WITH KEY = "org_code" WHERE "org_code" =~ /(?i)^${regex}.*/`;
    return await this.query(query);
  }

  // Get available request types for an org
  async getRequestTypes(orgCode: string): Promise<QueryResult[]> {
    const query = `SHOW TAG VALUES FROM "http_client_requests" WITH KEY = "type" WHERE "org_code" = '${orgCode}' LIMIT 20`;
    return await this.query(query);
  }

  async getFetchKeys(orgCode: string): Promise<QueryResult[]> {
    const query = `show tag values from http_client_requests with key= "fetch_key" WHERE fetch_key !~ /^EZETAP_.*$/ AND "org_code" =~ /${orgCode}/`;
    return await this.query(query);
  }
  // Get time series data for charts
  async getTimeSeriesData(
    orgCode: string,
    timeFilter?: string,
    groupBy: string = "1h",
  ): Promise<TimeSeriesPoint[]> {
    let query = `
      SELECT sum("count") as requests
      FROM "http_client_requests"
      WHERE "org_code" = '${orgCode}'
    `;

    if (timeFilter) {
      query += ` AND ${timeFilter}`;
    }

    query += ` GROUP BY time(${groupBy}) FILL(0) ORDER BY time ASC`;

    const result = await this.query(query);
    return result.map((row: any) => ({
      time: row.time,
      requests: row.requests || 0,
    }));
  }

  // Get dashboard overview data
  async getDashboardOverview(
    orgCode: string,
    timeFilter?: string,
  ): Promise<{
    totalSuccessRequests: number;
    successRate: number;
    avgResponseTime: number;
    errorCount: number;
  }> {
    try {
      const [totalSuccessRequestsResult, errorResult, avgResponseTimeResult] =
        await Promise.all([
          this.getMerchantRequests(orgCode, timeFilter, true),
          this.getMerchantRequests(orgCode, timeFilter, false),
          this.getMerchantAPIsAvgResponseTime(orgCode, timeFilter),
        ]);

      const totalSuccessRequests =
        totalSuccessRequestsResult[0]?.total_requests || 0;
      const errorCount = errorResult[0]?.total_requests || 0;
      const successRate =
        totalSuccessRequests > 0
          ? ((totalSuccessRequests - errorCount) / totalSuccessRequests) * 100
          : 100;

      return {
        totalSuccessRequests,
        successRate: Math.round(successRate * 100) / 100,
        avgResponseTime: avgResponseTimeResult[0]?.avg_response_time || 0,
        errorCount,
      };
    } catch (error) {
      logger.error("Error getting dashboard overview:", error);
      throw error;
    }
  }

  async getConfigSR(orgCode: string, timeFilter?: string): Promise<QueryResult[]> {

    let query = `
      SELECT sum("count") as success
FROM "http_client_requests"
WHERE
  "status" =~ /^20.$/
  AND "type" =~ /^(Normal|Txn_posting)$/
  AND "org_code" =~ /^${orgCode}$/
  AND time >= now() - ${timeFilter} AND time <= now()
GROUP BY "fetch_key", "org_code", "description"
fill(0);

SELECT sum("count") as errors
FROM "http_client_requests"
WHERE
  "status" !~ /^20.$/
  AND "type" =~ /^(Normal|Txn_posting)$/
  AND "org_code" =~ /^${orgCode}$/
  AND time >= now() - ${timeFilter} AND time <= now()
GROUP BY "fetch_key", "org_code", "description"
fill(0)`;

    const results = await this.query(query);
    const cleanedResults = results.map(({ time, ...rest }) => rest);
    return mergeSuccessAndErrors(cleanedResults);

  }
}

function mergeSuccessAndErrors(Results: any[]): any[] {
  const [successGroup, errorGroup] = Results;

  const extractData = (group: any, key: string) => {
    const results: Record<string, any> = {};

    for (const i in group) {
      if (!/^\d+$/.test(i)) continue;
      const item = group[i];
      const id = `${item.fetch_key}-${item.org_code}`;
      results[id] = {
        description: item.description,
        fetch_key: item.fetch_key,
        org_code: item.org_code,
        [key]: item[key]
      };
    }

    return results;
  };

  const successData = extractData(successGroup, "success");
  const errorData = extractData(errorGroup, "errors");

  const merged: any[] = [];

  const allKeys = new Set([
    ...Object.keys(successData),
    ...Object.keys(errorData)
  ]);

  for (const key of allKeys) {
    const successRate = successData[key].success * 100/((errorData[key].errors+successData[key].success) == 0 ? 1 : (errorData[key].errors+successData[key].success));
    merged.push({
      ...successData[key],
      ...errorData[key],
      successRate: Math.round(successRate)
    });
  }

  return merged;
}


export default new InfluxDBService();
