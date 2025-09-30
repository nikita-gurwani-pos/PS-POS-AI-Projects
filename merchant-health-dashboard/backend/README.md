# Merchant Health Dashboard

This repository contains the backend API for the Merchant Health Dashboard.

## Overview

The backend is a Node.js application written in TypeScript. It uses Express.js as the web framework and connects to an InfluxDB time-series database to monitor merchant health metrics.

## Features

-   RESTful API for merchant and dashboard data
-   JWT-based authentication
-   Integration with InfluxDB for time-series data
-   Swagger UI for interactive API documentation
-   Rate limiting and security headers with Helmet

## Prerequisites

-   [Node.js](https://nodejs.org/) (v18.x or later recommended)
-   [npm](https://www.npmjs.com/)
-   [InfluxDB](https://www.influxdata.com/) (v1.x or v2.x)

## Getting Started

Follow these instructions to get the backend server up and running on your local machine.

### 1. Clone the Repository

```bash
git clone <repository-url>
cd merchant-health-dashboard/backend
```

### 2. Install Dependencies

Install the project dependencies using npm:

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `backend` directory by copying the example file:

```bash
cp .env.example .env
```

Now, open the `.env` file and update the variables with your specific configuration.

| Variable          | Description                                               | Default           |
| ----------------- | --------------------------------------------------------- | ----------------- |
| `PORT`            | The port the server will run on.                          | `3001`            |
| `NODE_ENV`        | The application environment.                              | `development`     |
| `FRONTEND_URL`    | The URL of the frontend application for CORS.             | `http://localhost:3000` |
| `JWT_SECRET`      | A secret key for signing JWTs. **Change this!**           | `your-super-secret-jwt-key...` |
| `INFLUXDB_HOST`   | The hostname or IP of your InfluxDB instance.             | `localhost`       |
| `INFLUXDB_PORT`   | The port for your InfluxDB instance.                      | `8086`            |
| `INFLUXDB_DATABASE`| The name of the database to use in InfluxDB.              | `config-db`       |
| `INFLUXDB_USERNAME`| The username for InfluxDB authentication (optional).      |                   |
| `INFLUXDB_PASSWORD`| The password for InfluxDB authentication (optional).      |                   |
| `LOG_LEVEL`       | The minimum level of logs to output.                      | `info`            |

### 4. Run the Application

You can run the server in development mode, which uses `nodemon` to automatically restart on file changes.

```bash
npm run dev
```

The server will start and be accessible at `http://localhost:3001`.

## Available Scripts

The `package.json` file includes several scripts for managing the application:

-   `npm start`: Starts the application from the compiled JavaScript files (for production).
-   `npm run dev`: Starts the application in development mode with hot-reloading.
-   `npm run build`: Compiles the TypeScript source code to JavaScript in the `dist/` directory.
-   `npm run kill`: Forcefully stops any process running on the application's port (`3001`).
-   `npm run debug`: Runs the application in debug mode, allowing you to attach a debugger.

## API Documentation

This project uses Swagger for API documentation. Once the server is running, you can access the interactive Swagger UI at:

[http://localhost:3001/api-docs](http://localhost:3001/api-docs)

## Further Documentation

For more specific setup guides, please refer to the following documents in the `backend` directory:

-   `ENV_EXAMPLE.md`: Detailed explanation of environment variables.
-   `MCP_SETUP.md`: Guide for setting up the MCP client.
-   `SIMPLE_MCP_GUIDE.md`: A simplified guide for the MCP client.

📌 License: This project is © 2025 Arshad Shafi Khan. All rights reserved. Unauthorized use or distribution is prohibited.
