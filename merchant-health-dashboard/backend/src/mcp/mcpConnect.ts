import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import dotenv from 'dotenv';
import EventEmitter from 'events';
import logger from "../utils/logger";

dotenv.config();

class CoraLogixMCPConnection extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private apiKey: string;
  private static connectionObject: CoraLogixMCPConnection | null = null;
  private isInitialized: boolean = false;
  private availableTools: any[] = [];
  private dataprimeDocs: string = '';
  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  public static getConnectionObject(): CoraLogixMCPConnection{
    if (!this.connectionObject) {
      this.connectionObject = new CoraLogixMCPConnection(process.env.CORALOGIX_MCP_KEY as string);
      this.connectionObject.connect();
    }
    return this.connectionObject;
  }

  private connect() {
    if (this.proc) {
      console.warn('Already connected');
      return;
    }

    console.log("👉 Command:", [
      'npx',
      'mcp-remote',
      process.env.CORALOGIX_MCP_API as string,
      '--header',
      'Authorization:${CORALOGIX_API_KEY}'
    ]);
    console.log("👉 Env:", { CORALOGIX_API_KEY: this.apiKey });
    

    this.proc = spawn('npx', [
      'mcp-remote',
      process.env.CORALOGIX_MCP_API as string,
      '--header',
      `Authorization:${this.apiKey}`
    ], {
      env: {
        ...process.env,
        CORALOGIX_API_KEY: this.apiKey
      }
    });

    this.proc.stdout.on('data', (data) => {
      this.emit('stdout', data.toString());
    });

    this.proc.stderr.on('data', (data) => {
      this.emit('stderr', data.toString());
    });

    this.proc.on('close', (code) => {
      this.emit('close', code);
      this.proc = null;
    });

    this.proc.on('error', (err) => {
      this.emit('error', err);
    });
  }

  disconnect() {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
  }

  write(input: string) {
    if (this.proc && this.proc.stdin.writable) {
      this.proc.stdin.write(input);
    } else {
      throw new Error('Process is not connected or stdin not writable');
    }
  }

  /**
   * Initialize MCP session and fetch available tools
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Step 1: Initialize the MCP session
      const initRequest = {
        jsonrpc: "2.0",
        id: "init_1",
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {
            tools: true,
            prompts: true,
            resources: true,
            logging: false,
            elicitation: {},
            roots: {
              listChanged: false
            }
          },
          clientInfo: {
            name: "merchant-health-dashboard",
            version: "1.0.0"
          }
        }
      };

      const initResponse = await this.sendRawRequest(initRequest);
      logger.info("MCP session initialization response", initResponse);

      
      // Step 2: Get available tools
      const toolsRequest = {
        jsonrpc: "2.0",
        id: "tools_1",
        method: "tools/list",
        params: {}
      };

      const toolsResponse = await this.sendRawRequest(toolsRequest);
      this.availableTools = toolsResponse.tools || [];
      logger.info('[DEBUG] Raw tools/list response:', JSON.stringify(toolsResponse, null, 2));


      // Step 3: Read Dataprime documentation
      try {
        const docsRequest = {
          jsonrpc: "2.0",
          id: "docs_1",
          method: "tools/call",
          params: {
            name: "read_dataprime_intro_docs",
            arguments: {}
          }
        };

        const docsResponse = await this.sendRawRequest(docsRequest);
        this.dataprimeDocs = docsResponse.content?.[0]?.text || '';
      } catch (error) {
        console.warn('Could not fetch Dataprime docs:', error);
      }

      this.isInitialized = true;
      console.log('MCP session initialized successfully');
      console.log('Available tools:', this.availableTools.map(t => t.name));
      
    } catch (error) {
      console.error('Failed to initialize MCP session:', error);
      throw error;
    }
  }

  /**
   * Send raw MCP request (for initialization)
   */
  private async sendRawRequest(request: any): Promise<any> {

    logger.info("request to sendRawRequest", request);

    return new Promise((resolve, reject) => {
      if (!this.proc || !this.proc.stdin.writable) {
        reject(new Error('Process is not connected or stdin not writable'));
        return;
      }

      const requestId = request.id;
      let responseData = '';
      let hasResolved = false;

      const onStdout = (data: string) => {
        if (hasResolved) return;
        
        responseData += data;
        
        try {
          // Try to parse the complete response first
          const parsed = JSON.parse(responseData.trim());
          if (parsed.id === requestId) {
            hasResolved = true;
            cleanup();
            if (parsed.error) {
              reject(new Error(`MCP Error: ${parsed.error.message || parsed.error}`));
            } else {
              resolve(parsed.result);
            }
            return;
          }
        } catch (e) {
          // If complete parsing fails, try line by line
          try {
            const lines = responseData.split('\n').filter(line => line.trim());
            for (const line of lines) {
              const parsed = JSON.parse(line);
              if (parsed.id === requestId) {
                hasResolved = true;
                cleanup();
                if (parsed.error) {
                  reject(new Error(`MCP Error: ${parsed.error.message || parsed.error}`));
                } else {
                  resolve(parsed.result);
                }
                return;
              }
            }
          } catch (lineError) {
            // Continue accumulating data
          }
        }
      };

      const onStderr = (data: string) => {
        // Don't treat stderr as error for MCP - it's often just logging
        console.log('[MCP stderr]', data);
        // Only treat as error if it contains actual error messages
        if (data.includes('Error:') && !data.includes('[Local→Remote]') && !data.includes('[Remote→Local]')) {
          if (hasResolved) return;
          hasResolved = true;
          cleanup();
          reject(new Error(`MCP Process Error: ${data}`));
        }
      };

      const onError = (err: Error) => {
        if (hasResolved) return;
        hasResolved = true;
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        this.removeListener('stdout', onStdout);
        this.removeListener('stderr', onStderr);
        this.removeListener('error', onError);
      };

      this.on('stdout', onStdout);
      this.on('stderr', onStderr);
      this.on('error', onError);

      const timeout = setTimeout(() => {
        if (hasResolved) return;
        hasResolved = true;
        cleanup();
        reject(new Error('MCP request timeout (120 seconds)'));
      }, 120000);

      this.proc.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Send MCP request and wait for response
   */
  async sendMCPRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.proc || !this.proc.stdin.writable) {
        reject(new Error('Process is not connected or stdin not writable'));
        return;
      }

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const mcpRequest = {
        jsonrpc: "2.0",
        id: requestId,
        method: method,
        params: params
      };

      let responseData = '';
      let hasResolved = false;

      // Set up listener for this specific request
      const onStdout = (data: string) => {
        if (hasResolved) return;
        
        responseData += data;
        
        // Try to parse as JSON-RPC response
        try {
          // First try to parse the complete response as a single JSON object
          const trimmedData = responseData.trim();
          if (trimmedData) {
            try {
              const parsed = JSON.parse(trimmedData);
              if (parsed.id === requestId) {
                hasResolved = true;
                cleanup();
                clearTimeout(timeout);
                if (parsed.error) {
                  reject(new Error(`MCP Error: ${parsed.error.message || parsed.error}`));
                } else {
                  resolve(parsed.result);
                }
                return;
              }
            } catch (e) {
              // Not a single JSON object, try line by line
            }
          }
          
          // Try parsing line by line
          const lines = responseData.split('\n').filter(line => line.trim());
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line.trim());
              if (parsed.id === requestId) {
                hasResolved = true;
                cleanup();
                clearTimeout(timeout);
                if (parsed.error) {
                  reject(new Error(`MCP Error: ${parsed.error.message || parsed.error}`));
                } else {
                  resolve(parsed.result);
                }
                return;
              }
            } catch (parseError) {
              // Skip invalid JSON lines
              continue;
            }
          }
        } catch (e) {
          // Continue accumulating data
        }
      };

      const onStderr = (data: string) => {
        // Don't treat stderr as error for MCP - it's often just logging
        console.log('[MCP stderr]', data);
        // Only treat as error if it contains actual error messages
        if (data.includes('Error:') && !data.includes('[Local→Remote]') && !data.includes('[Remote→Local]')) {
          if (hasResolved) return;
          hasResolved = true;
          cleanup();
          reject(new Error(`MCP Process Error: ${data}`));
        }
      };

      const onError = (err: Error) => {
        if (hasResolved) return;
        hasResolved = true;
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        this.removeListener('stdout', onStdout);
        this.removeListener('stderr', onStderr);
        this.removeListener('error', onError);
      };

      // Set up listeners
      this.on('stdout', onStdout);
      this.on('stderr', onStderr);
      this.on('error', onError);

      // Set timeout
      const timeout = setTimeout(() => {
        if (hasResolved) return;
        hasResolved = true;
        cleanup();
        reject(new Error('MCP request timeout (120 seconds)'));
      }, 120000);

      // Send the request
      this.proc.stdin.write(JSON.stringify(mcpRequest) + '\n');
    });
  }

  /**
   * Get available tools
   */
  getAvailableTools(): any[] {
    return this.availableTools;
  }

  /**
   * Get Dataprime documentation
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


}

export default CoraLogixMCPConnection;
