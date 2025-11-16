import influxDBService from "../services/influxdb.service";
import logger from "../utils/logger";

// Selected org_codes (you can adjust)
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

const method = "POST";
const STATUS_CODES = ["200", "500", "504", "400"];
const uri = "";

function randomItem(arr: String[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRecord(org: string) {
  const status = randomItem(STATUS_CODES);
  const latency = Math.random() * 1000; // ms

  return {
    measurement: "http_client_requests",
    tags: {
      org_code: org,
      appName: "Config",
      clientName: "",
      method,
      uri,
      type: "api",
      metric_type: "histogram",
      externalApiRespStatus: status,
      status,
      username: `user${Math.ceil(Math.random() * 10)}`,
      instance: "C02",
      description: "simulated request event",
      errorCode: status === "200" ? "" : "ERR_TIMEOUT",
      errorMessage: status === "200" ? "" : "Timeout while calling gateway",
      fetch_key: "txn_posting",
    },
    fields: {
      count: 1,
      mean: latency,
      sum: latency,
      upper: latency + Math.random() * 100,
    },
    timestamp: Date.now(),
  };
}

async function writeBatch() {
  const points: any = [];
  for (const org of ORG_CODES) {
    for (let i = 0; i < 5; i++) {
      const record = generateRecord(org);
      points.push(record);
    }
  }
  const influxDbInstance = await influxDBService.getConnection();
  await influxDbInstance.writePoints(points);
  logger.info(
    `Inserted ${points.length} records at ${new Date().toLocaleTimeString()}`,
  );
}

(async () => {
  logger.info("Starting influxDB live data generator...");
  await writeBatch(); // write immediately
  setInterval(writeBatch, 5 * 60 * 1000); // repeat every 5 mins
})();
