import swaggerJsdoc from 'swagger-jsdoc';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Merchant Health Dashboard API',
      version: '1.0.0',
      description: 'API documentation for Merchant Health Dashboard with InfluxDB integration',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://api.merchant-dashboard.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token'
        }
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              example: 'admin',
              description: 'Username for authentication'
            },
            password: {
              type: 'string',
              example: 'password',
              description: 'Password for authentication'
            }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Login successful'
            },
            token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              description: 'JWT token for authentication'
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 1 },
                username: { type: 'string', example: 'admin' },
                role: { type: 'string', example: 'admin' }
              }
            }
          }
        },
        DashboardOverview: {
          type: 'object',
          properties: {
            orgCode: {
              type: 'string',
              example: 'TFSYAMUNA_78897285'
            },
            timeRange: {
              type: 'object',
              properties: {
                startTime: { type: 'string', format: 'date-time' },
                endTime: { type: 'string', format: 'date-time' }
              }
            },
            metrics: {
              type: 'object',
              properties: {
                totalRequests: { type: 'number', example: 1250 },
                successRate: { type: 'number', example: 98.5 },
                avgResponseTime: { type: 'number', example: 245 },
                errorCount: { type: 'number', example: 19 }
              }
            }
          }
        },
        TimeSeriesData: {
          type: 'object',
          properties: {
            orgCode: { type: 'string', example: 'TFSYAMUNA_78897285' },
            timeRange: {
              type: 'object',
              properties: {
                startTime: { type: 'string', format: 'date-time' },
                endTime: { type: 'string', format: 'date-time' }
              }
            },
            groupBy: { type: 'string', example: '1h' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  time: { type: 'string', format: 'date-time' },
                  requests: { type: 'number' }
                }
              }
            }
          }
        },
        Merchant: {
          type: 'object',
          properties: {
            orgCode: { type: 'string', example: 'TFSYAMUNA_78897285' },
            name: { type: 'string', example: 'TFS Yamuna' },
            status: { type: 'string', example: 'active' },
            requestTypes: {
              type: 'array',
              items: { type: 'string' },
              example: ['Normal', 'Txn_posting', 'Logtickets']
            },
            recentActivity: {
              type: 'object',
              properties: {
                totalRequests: { type: 'number', example: 1250 },
                lastUpdated: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Error message' },
            details: { type: 'array', items: { type: 'string' } }
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Validation error'
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  expected: { type: 'string' },
                  received: { type: 'string' },
                  path: { type: 'array', items: { type: 'string' } },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.ts', './src/app.ts']
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Merchant Health Dashboard API'
  }));

  // JSON endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

export default specs;