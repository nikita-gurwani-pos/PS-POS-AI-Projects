import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import logger from '../utils/logger';
import { getMCPServerConfig, mcpConfig } from '../config/mcp.config';

interface MCPRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface QueryResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

class MCPClientService extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private readonly pendingRequests = new Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>();
  private isConnected = false;

  constructor() {
    super();
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('MCP client already connected');
      return;
    }

    const config = getMCPServerConfig(mcpConfig.defaultServer);
    if (!config) {
      throw new Error(`Unknown MCP server type: ${mcpConfig.defaultServer}`);
    }

    try {
      this.process = spawn(config.command, config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...config.env }
      });

      if (!this.process.stdout || !this.process.stdin) {
        throw new Error('Failed to create MCP process pipes');
      }

      // Handle process output
      this.process.stdout.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const response: MCPResponse = JSON.parse(line);
            this.handleResponse(response);
          } catch (error) {
            logger.error('Failed to parse MCP response:', error);
          }
        }
      });

      // Handle process errors
      this.process.stderr?.on('data', (data: Buffer) => {
        logger.error('MCP Server Error:', data.toString());
      });

      this.process.on('exit', (code) => {
        logger.info(`MCP Server exited with code ${code}`);
        this.isConnected = false;
        this.process = null;
      });

      // Initialize the connection
      await this.initialize();
      this.isConnected = true;
      logger.info('MCP Client connected successfully');
    } catch (error) {
      logger.error('Failed to connect to MCP server:', error);
      throw error;
    }
  }

  private async initialize(): Promise<void> {
    const initRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {
            listChanged: true
          },
          sampling: {}
        },
        clientInfo: {
          name: 'merchant-health-dashboard',
          version: '1.0.0'
        }
      }
    };

    await this.sendRequest(initRequest);
  }

  async executeQuery(prompt: string, options: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      // Ensure connection
      if (!this.isConnected) {
        await this.connect();
      }

      // Convert prompt to DataPrime query if needed
      let query = prompt;
      if (!prompt.toLowerCase().includes('source logs') && !prompt.toLowerCase().includes('source spans')) {
        query = this.convertToDataPrime(prompt);
      }

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: this.getNextRequestId(),
        method: 'tools/call',
        params: {
          name: 'get_logs',
          arguments: {
            query,
            startDate: options.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            endDate: options.endDate || new Date().toISOString(),
            limit: options.limit || 50
          }
        }
      };

      const response = await this.sendRequest(request);
      const executionTime = Date.now() - startTime;

      if (response.error) {
        return {
          success: false,
          error: response.error.message,
          executionTime
        };
      }

      return {
        success: true,
        data: response.result,
        executionTime
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        executionTime
      };
    }
  }

  private convertToDataPrime(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    let query = 'source logs';

    // Check for transaction ID patterns
    const transactionIdMatch = prompt.match(/\b\d{21}E\d{9}\b/);
    if (transactionIdMatch) {
      query += ` | wildfind '${transactionIdMatch[0]}'`;
    }

    // Check for application filters
    if (lowerPrompt.includes('configapps') || lowerPrompt.includes('config apps')) {
      query += ` | filter $l.applicationname == 'prod-configapps'`;
    }

    // Check for specific terms
    if (lowerPrompt.includes('error')) {
      query += ` | filter $m.severity == ERROR`;
    }

    if (lowerPrompt.includes('posting') || lowerPrompt.includes('posted')) {
      query += ` | wildfind 'Posting successful'`;
    }

    // If no specific filters were added, do a general search
    if (query === 'source logs' && !transactionIdMatch) {
      // Extract key terms from the prompt for searching
      const searchTerms = prompt.split(' ').filter(term => 
        term.length > 3 && 
        !['show', 'find', 'get', 'logs', 'for', 'the', 'and', 'with'].includes(term.toLowerCase())
      );
      
      if (searchTerms.length > 0) {
        query += ` | wildfind '${searchTerms[0]}'`;
      }
    }

    return query;
  }

  private sendRequest(request: MCPRequest): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('MCP process not connected'));
        return;
      }

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error('MCP request timeout'));
      }, mcpConfig.timeout);

      // Store the request
      this.pendingRequests.set(request.id, { resolve, reject, timeout });

      // Send the request
      const requestLine = JSON.stringify(request) + '\n';
      this.process.stdin.write(requestLine);
    });
  }

  private handleResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.id);
      
      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response);
      }
    }
  }

  private getNextRequestId(): number {
    return ++this.requestId;
  }

  async disconnect(): Promise<void> {
    // Clear all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('MCP connection closed'));
    }
    this.pendingRequests.clear();
    
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    
    this.isConnected = false;
    logger.info('MCP Client disconnected');
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export default new MCPClientService();