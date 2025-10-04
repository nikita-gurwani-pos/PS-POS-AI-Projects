import swaggerJsdoc from 'swagger-jsdoc';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Merchant Health Dashboard API',
      version: '2.0.0',
      description: 'AI-powered Merchant Health Dashboard with Coralogix MCP integration, LLM processing, and intelligent transaction analysis',
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
        },
        PromptRequest: {
          type: 'object',
          required: ['prompt'],
          properties: {
            prompt: {
              type: 'string',
              description: 'Natural language query for transaction analysis or log search',
              example: 'is this transaction 251004150441756E739681790 posted'
            }
          }
        },
        PromptResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
              description: 'Whether the request was successful'
            },
            data: {
              type: 'object',
              properties: {
                naturalLanguageResponse: {
                  type: 'string',
                  description: 'AI-generated natural language response',
                  example: 'Yes, the transaction with ID 251004150441756E739681790 was successfully posted on 2025-10-04 at 15:04:45.301.'
                },
                mcpRequest: {
                  type: 'object',
                  description: 'The MCP request that was generated from the natural language prompt',
                  properties: {
                    method: { type: 'string', example: 'tools/call' },
                    params: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', example: 'get_logs' },
                        arguments: {
                          type: 'object',
                          properties: {
                            query: { type: 'string', example: 'source logs | filter $d ~~ \'251004150441756E739681790\'' },
                            startDate: { type: 'string', format: 'date-time' },
                            endDate: { type: 'string', format: 'date-time' }
                          }
                        }
                      }
                    }
                  }
                },
                mcpResponse: {
                  type: 'object',
                  description: 'Raw response from the Coralogix MCP server'
                },
                executionTime: {
                  type: 'number',
                  description: 'Total execution time in milliseconds',
                  example: 17109
                }
              }
            },
            prompt: {
              type: 'string',
              description: 'Original user prompt',
              example: 'is this transaction 251004150441756E739681790 posted'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'When the query was executed'
            }
          }
        },
        MCPTool: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'get_logs',
              description: 'Name of the MCP tool'
            },
            description: {
              type: 'string',
              description: 'Description of what the tool does'
            },
            inputSchema: {
              type: 'object',
              description: 'JSON schema defining the required parameters'
            }
          }
        },
        TransactionAnalysis: {
          type: 'object',
          properties: {
            transactionId: {
              type: 'string',
              example: '251004150441756E739681790',
              description: 'Transaction ID in yymmddhhmmss format'
            },
            extractedTimestamp: {
              type: 'string',
              format: 'date-time',
              example: '2025-10-04T15:04:41.000Z',
              description: 'Timestamp extracted from transaction ID'
            },
            searchTimeRange: {
              type: 'object',
              properties: {
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' }
              },
              description: 'Time range used for searching (transaction timestamp ± 2 hours)'
            },
            status: {
              type: 'string',
              example: 'AUTHORIZED',
              description: 'Transaction status found in logs'
            },
            merchantInfo: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'M S KUMAR DAL MILL' },
                code: { type: 'string', example: 'M_S_KUMAR_DAL_MILL' }
              }
            },
            amount: {
              type: 'number',
              example: 128500,
              description: 'Transaction amount in paise'
            },
            cardInfo: {
              type: 'object',
              properties: {
                type: { type: 'string', example: 'VISA' },
                lastFour: { type: 'string', example: '3000' },
                holderName: { type: 'string', example: 'DASAPRAKASHBHAI' }
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