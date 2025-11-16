import EventEmitter from 'events';
import path from 'path';
import { pathToFileURL } from 'url';
import logger from '../utils/logger';

// Dynamic imports for ESM modules in CommonJS
let SDKClient: any;
let SDKTransport: any;

async function loadSDK() {
  if (!SDKClient) {
    try {
      // Get the ESM file paths directly
      const sdkPackagePath = require.resolve("@modelcontextprotocol/sdk/package.json");
      let sdkRoot = path.dirname(sdkPackagePath);
      if (sdkRoot.endsWith("dist/cjs")) {
        sdkRoot = path.resolve(sdkRoot, "..", "..");
      }
      const sdkClientPath = path.resolve(sdkRoot, "dist", "esm", "client", "index.js");
      const sdkTransportPath = path.resolve(sdkRoot, "dist", "esm", "client", "streamableHttp.js");
      
      // Verify files exist
      const fs = require('fs');
      if (!fs.existsSync(sdkClientPath)) {
        throw new Error(`SDK client file not found: ${sdkClientPath}`);
      }
      if (!fs.existsSync(sdkTransportPath)) {
        throw new Error(`SDK transport file not found: ${sdkTransportPath}`);
      }
      
      // Use Function constructor to bypass ts-node's import interception
      // This creates a true dynamic import that Node.js handles natively
      logger.info(`Loading SDK from ESM files: ${sdkClientPath}`);
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const sdkClientUrl = pathToFileURL(sdkClientPath).href;
      const sdkTransportUrl = pathToFileURL(sdkTransportPath).href;
      
      const sdkClient = await dynamicImport(sdkClientUrl);
      const sdkTransport = await dynamicImport(sdkTransportUrl);
      SDKClient = sdkClient.Client;
      SDKTransport = sdkTransport.StreamableHTTPClientTransport;
      logger.info('SDK loaded successfully');
    } catch (error: any) {
      logger.error('Failed to load SDK:', error);
      throw error;
    }
  }
  return { Client: SDKClient, StreamableHTTPClientTransport: SDKTransport };
}

interface CoralogixMCPClientConfig {
  apiKey: string;
  region?: string; // Default: ap1
}

class CoralogixMCPClient extends EventEmitter {
  private transport: any = null;
  private config: CoralogixMCPClientConfig;
  private static connectionObject: CoralogixMCPClient | null = null;
  private isInitialized: boolean = false;
  private availableTools: any[] = [];
  private dataprimeDocs: string = '';

  private mcpClient: any = null;

  constructor(config: CoralogixMCPClientConfig) {
    super();
    this.config = config;
  }

  private async ensureClient() {
    if (!this.mcpClient) {
      const { Client: ClientClass } = await loadSDK();
      this.mcpClient = new ClientClass(
        {
          name: "coralogix-mcp-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );
    }
    return this.mcpClient;
  }

  public static getConnectionObject(): CoralogixMCPClient {
    if (!this.connectionObject) {
      const apiKey = process.env.CORALOGIX_MCP_KEY || process.env.CORALOGIX_API_KEY || '';
      if (!apiKey) {
        throw new Error('CORALOGIX_MCP_KEY or CORALOGIX_API_KEY environment variable is required');
      }
      this.connectionObject = new CoralogixMCPClient({
        apiKey,
        region: "ap1",
      });
    }
    return this.connectionObject;
  }

  private getEndpointUrl(): string {
    const region = this.config.region || "ap1";
    return `https://api.${region}.coralogix.com/mgmt/api/v1/mcp`;
  }

  async connect(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const client = await this.ensureClient();
    const { StreamableHTTPClientTransport: TransportClass } = await loadSDK();

    const url = this.getEndpointUrl();
    logger.info(`Connecting to Coralogix MCP: ${url}`);
    logger.info(`Using API key: ${this.config.apiKey.substring(0, 10)}...`);

    // Use StreamableHTTPClientTransport which supports session IDs
    this.transport = new TransportClass(new URL(url), {
      requestInit: {
        headers: {
          Authorization: this.config.apiKey,
        },
      },
    });

    // Add error handler
    this.transport.onerror = (error: any) => {
      logger.error('Transport error:', error);
      this.emit('error', error);
    };

    await client.connect(this.transport);
    logger.info(`Connected to Coralogix MCP server (Session ID: ${this.transport.sessionId || 'none'})`);
  }

  /**
   * Initialize MCP session and fetch available tools
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.connect();

      // Get available tools
      const client = await this.ensureClient();
      const toolsResponse = await client.listTools();
      this.availableTools = toolsResponse.tools || [];
      logger.info(`[DEBUG] Available tools: ${this.availableTools.map(t => t.name).join(', ')}`);

      // Try to get Dataprime documentation
      try {
        const client = await this.ensureClient();
        const docsResult = await client.callTool({
          name: "read_dataprime_intro_docs",
          arguments: {},
        });
        this.dataprimeDocs = docsResult.content?.[0]?.text || '';
      } catch (error) {
        logger.warn('Could not fetch Dataprime docs:', error);
      }

      this.isInitialized = true;
      logger.info('MCP session initialized successfully');
      logger.info(`Available tools: ${this.availableTools.map(t => t.name).join(', ')}`);
    } catch (error) {
      logger.error('Failed to initialize MCP session:', error);
      throw error;
    }
  }

  /**
   * Send MCP request (compatible with old interface)
   */
  async sendMCPRequest(method: string, params: any): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      return await this.callTool(name, args);
    }

    // Handle other methods
    switch (method) {
      case 'tools/list':
        return await this.listTools();
      case 'resources/list':
        return await this.listResources();
      case 'prompts/list':
        return await this.listPrompts();
      default:
        throw new Error(`Unsupported MCP method: ${method}`);
    }
  }

  async listTools(): Promise<any> {
    const client = await this.ensureClient();
    const response = await client.listTools();
    return response;
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    const client = await this.ensureClient();
    const response = await client.callTool({
      name,
      arguments: args,
    });
    return response;
  }

  async listResources(): Promise<any> {
    const client = await this.ensureClient();
    const response = await client.listResources();
    return response;
  }

  async listPrompts(): Promise<any> {
    const client = await this.ensureClient();
    const response = await client.listPrompts();
    return response;
  }

  /**
   * Get available tools (cached)
   */
  getAvailableTools(): any[] {
    return this.availableTools;
  }

  /**
   * Get Dataprime documentation (cached)
   */
  getDataprimeDocs(): string {
    return this.dataprimeDocs;
  }

  /**
   * Check if MCP is initialized
   */
  isMCPInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Disconnect (compatible with old interface)
   */
  disconnect(): void {
    this.close();
  }

  async close(): Promise<void> {
    if (this.transport && this.mcpClient) {
      await this.mcpClient.close();
      this.isInitialized = false;
      this.mcpClient = null;
      logger.info("Disconnected from Coralogix MCP server");
    }
  }
}

// Example usage
async function main() {
  const apiKey = process.env.CORALOGIX_API_KEY || "cxup_Sci0wGpw2mR5BCEeDvEm27iG5Dg6vi";
  console.log(apiKey);


  if (!apiKey) {
    throw new Error("CORALOGIX_API_KEY environment variable is required");
  }

  const client = new CoralogixMCPClient({
    apiKey,
    region: "ap1", // Change to your region: eu1, eu2, us1, us2, ap1, ap2, etc.
  });

  try {
    await client.connect();

    // List available tools
    console.log("\nAvailable Tools:");
    const tools = await client.listTools();
    console.log(JSON.stringify(tools, null, 2));

    // List available resources
    console.log("\nAvailable Resources:");
    const resources = await client.listResources();
    console.log(JSON.stringify(resources, null, 2));

    // Example: Call a tool (adjust based on actual available tools)
    // const result = await client.callTool("tool-name", { param: "value" });
    // console.log(result);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

// Run if this is the main module (only in direct execution)
if (require.main === module) {
  main().catch(console.error);
}

export { CoralogixMCPClient, CoralogixMCPClientConfig };
export default CoralogixMCPClient;
