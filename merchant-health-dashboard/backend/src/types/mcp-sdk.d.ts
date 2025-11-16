declare module '@modelcontextprotocol/sdk/client' {
  export class Client {
    constructor(clientInfo: any, capabilities: any);
    connect(transport: any): Promise<void>;
    listTools(): Promise<any>;
    callTool(request: { name: string; arguments: Record<string, any> }): Promise<any>;
    listResources(): Promise<any>;
    listPrompts(): Promise<any>;
    close(): Promise<void>;
  }
}

declare module '@modelcontextprotocol/sdk/client/streamableHttp' {
  export class StreamableHTTPClientTransport {
    sessionId?: string;
    onerror?: (error: any) => void;
    constructor(url: URL, options: { requestInit: { headers: Record<string, string> } });
  }
}

