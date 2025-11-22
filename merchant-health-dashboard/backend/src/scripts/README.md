# Mock Data Population Script

This script populates InfluxDB with comprehensive mock data for all screens in the Merchant Health Dashboard.

## Usage

Make sure your InfluxDB is running and configured in your `.env` file, then run:

```bash
npm run populate-mock-data
```

Or directly with ts-node:

```bash
ts-node -r dotenv/config src/scripts/populateMockData.ts
```

## What Data is Generated

The script generates mock data for:

- **10 merchant organizations** (org codes)
- **Last 30 days** of historical data
- **Multiple request types**: Normal, Txn_posting, Logtickets
- **Various API endpoints** (fetch_keys): txn_posting, CONFIG_API, PAYMENT_GATEWAY, etc.
- **Realistic status codes**: Success (200, 201, 202), Client Errors (400, 401, 403, 404), Server Errors (500, 502, 503, 504)
- **Realistic response times**: Based on status code (success: 50-500ms, errors: 20-5000ms)
- **Error messages and codes** for failed requests

## Data Distribution

- **Last 30 days**: Data points every 4 hours
- **Last 7 days**: Data points every 1 hour  
- **Last 24 hours**: Data points every 15 minutes
- **Last hour**: Data points every 5 minutes

This ensures all time filters (30d, 7d, 1d, 6h, 1hr, 10m, 1m) show meaningful data.

## Success Rate

The script generates data with approximately **92% success rate**, meaning:
- ~92% of requests have 2xx status codes
- ~8% of requests have error status codes (4xx or 5xx)

This creates realistic merchant health scenarios with some showing "Good" status, some "Warning", and some "Critical".

## Notes

- The script writes data in batches of 1000 points to avoid memory issues
- Progress is logged to the console
- The script will exit automatically when complete
- Existing data in InfluxDB will not be deleted - new data will be added

