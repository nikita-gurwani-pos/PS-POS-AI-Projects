export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  autoConnect?: boolean;
}

export const getMCPServerConfig = (serverType: string): MCPServerConfig | null => {
  if (serverType.toLowerCase() === 'coralogix') {
    return {
      name: 'coralogix-server',
      command: process.env.MCP_CORALOGIX_COMMAND || 'npx',
      args: [
        'mcp-remote',
        'https://api.ap1.coralogix.com/mgmt/api/v1/mcp',
        '--header',
        `Authorization:${process.env.CORALOGIX_API_KEY || ''}`
      ],
      env: {
        CORALOGIX_API_KEY: process.env.CORALOGIX_API_KEY || '',
      },
      autoConnect: process.env.MCP_CORALOGIX_AUTO_CONNECT === 'true'
    };
  }
  
  return null;
};

export const mcpConfig = {
  // Global MCP client configuration
  timeout: parseInt(process.env.MCP_TIMEOUT || '30000'), // 30 seconds
  retryAttempts: parseInt(process.env.MCP_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.MCP_RETRY_DELAY || '1000'), // 1 second
  
  // Logging configuration
  logLevel: process.env.MCP_LOG_LEVEL || 'info',
  
  // Connection settings
  connectionTimeout: parseInt(process.env.MCP_CONNECTION_TIMEOUT || '10000'), // 10 seconds
  heartbeatInterval: parseInt(process.env.MCP_HEARTBEAT_INTERVAL || '60000'), // 1 minute
  
  // Default server
  defaultServer: process.env.MCP_DEFAULT_SERVER || 'coralogix',
};
