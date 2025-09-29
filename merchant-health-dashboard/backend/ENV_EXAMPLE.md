# Environment Variables Configuration

Create a `.env` file in the backend directory with the following variables:

```bash
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# InfluxDB Configuration
INFLUXDB_HOST=localhost
INFLUXDB_PORT=8086
INFLUXDB_DATABASE=config-db
INFLUXDB_USERNAME=
INFLUXDB_PASSWORD=

# Logging Configuration
LOG_LEVEL=info

# ===========================================
# Coralogix MCP Configuration
# ===========================================

# Global MCP Settings
MCP_LOG_LEVEL=info
MCP_TIMEOUT=30000
MCP_RETRY_ATTEMPTS=3
MCP_RETRY_DELAY=1000
MCP_CONNECTION_TIMEOUT=10000
MCP_HEARTBEAT_INTERVAL=60000
MCP_DEFAULT_SERVER=coralogix

# Coralogix MCP Server Configuration
CORALOGIX_API_KEY=your-coralogix-api-key
CORALOGIX_DOMAIN=coralogix.com
CORALOGIX_REGION=us

# Optional: Override Coralogix MCP server command/args
MCP_CORALOGIX_COMMAND=npx
MCP_CORALOGIX_ARGS=-y,@coralogix/mcp-server
MCP_CORALOGIX_AUTO_CONNECT=true
```

## Required Variables

### Essential for Basic Functionality:
- `JWT_SECRET`: Used for JWT token signing
- `CORALOGIX_API_KEY`: Your Coralogix API key for log access
- `CORALOGIX_REGION`: Your Coralogix region (us, eu, ap, etc.)

### Optional but Recommended:
- `CORALOGIX_DOMAIN`: Usually coralogix.com unless using a custom domain
- `MCP_DEFAULT_SERVER`: Should be set to 'coralogix'

## Getting Your Coralogix API Key

1. Log into your Coralogix dashboard
2. Go to Settings → API Keys
3. Create a new API key with appropriate permissions
4. Copy the key and add it to your `.env` file

## Coralogix MCP Server Configuration

The Coralogix MCP server is configured through environment variables:

### Coralogix Server:
- Automatically uses the `@coralogix/mcp-server` package
- Requires `CORALOGIX_API_KEY` and `CORALOGIX_REGION`
- Can be customized with `MCP_CORALOGIX_*` variables

### Grafana Server:
- Uses the `@grafana/mcp-server` package (if available)
- Requires `GRAFANA_URL` and `GRAFANA_API_KEY`
- Can be customized with `MCP_GRAFANA_*` variables

## Testing Your Configuration

After setting up your `.env` file, you can test the MCP connection:

```bash
# Test with a specific transaction ID
npm run test-mcp 250928190448714E410380693

# Or test with the default transaction ID
npm run test-mcp
```

## Security Notes

- Never commit your `.env` file to version control
- Use strong, unique values for `JWT_SECRET`
- Rotate API keys regularly
- Use environment-specific configurations for different deployments
