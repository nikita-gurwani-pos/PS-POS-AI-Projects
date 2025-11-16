import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import merchantRoutes from './routes/merchant.routes';
import promptRoutes from './routes/prompt.routes';
import errorMiddleware from './middleware/error.middleware';
import logger from './utils/logger';
import { setupSwagger } from './config/swagger';
import CoralogixMCPClient from './mcp/coralogix-mcp';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Setup Swagger documentation
setupSwagger(app);

const coralogixMCP = CoralogixMCPClient.getConnectionObject();
coralogixMCP.on('error', (err) => logger.error('MCP error:', err));

// Initialize MCP connection
coralogixMCP.initialize().then(() => {
  logger.info('MCP connection initialized successfully');
}).catch((error) => {
  logger.error('Failed to initialize MCP connection:', error);
});

export { coralogixMCP };

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/coralogix/prompt', promptRoutes);

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: System health check
 *     description: |
 *       Check the overall health and status of the AI-powered Merchant Health Dashboard API.
 *       
 *       **Health Indicators:**
 *       - API server status and uptime
 *       - Current timestamp for synchronization
 *       - System availability confirmation
 *       
 *       **Use Cases:**
 *       - Load balancer health checks
 *       - Monitoring system integration
 *       - Service discovery validation
 *       - API availability verification
 *       
 *       **Response Information:**
 *       - `status`: Always "OK" when API is running
 *       - `timestamp`: Current server time (ISO 8601 format)
 *       - `uptime`: Server uptime in seconds
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: System is healthy and operational
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                   description: System health status
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-10-04T19:07:34.510Z"
 *                   description: Current server timestamp
 *                 uptime:
 *                   type: number
 *                   example: 3600.123
 *                   description: Server uptime in seconds
 *             examples:
 *               healthy_system:
 *                 summary: Healthy system response
 *                 value:
 *                   status: "OK"
 *                   timestamp: "2025-10-04T19:07:34.510Z"
 *                   uptime: 3600.123
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Error handling middleware
app.use(errorMiddleware);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Merchant Health Dashboard API ready`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  server.close(async () => {
    logger.info('HTTP server closed.');
    await coralogixMCP.close();
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;