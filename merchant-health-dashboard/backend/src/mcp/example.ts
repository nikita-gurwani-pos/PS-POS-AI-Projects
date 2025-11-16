import { CoralogixMCPClient } from './coralogix-mcp';

async function runExample() {
  // Create client instance
  const client = new CoralogixMCPClient({
    apiKey: process.env.CORALOGIX_API_KEY!,
    region: 'ap1' // Change to your Coralogix region
  });

  try {
    // Connect to Coralogix MCP server
    console.log('Connecting to Coralogix...');
    await client.connect();

    // List available tools
    console.log('\n=== Available Tools ===');
    const tools = await client.listTools();
    console.log(JSON.stringify(tools, null, 2));

    // List available resources
    console.log('\n=== Available Resources ===');
    const resources = await client.listResources();
    console.log(JSON.stringify(resources, null, 2));

    // List available prompts
    console.log('\n=== Available Prompts ===');
    const prompts = await client.listPrompts();
    console.log(JSON.stringify(prompts, null, 2));

    // Example: Call a tool (uncomment and modify once you know the tool names)
    /*
    console.log('\n=== Calling Tool ===');
    const result = await client.callTool('query_logs', {
      query: 'error',
      limit: 10
    });
    console.log(JSON.stringify(result, null, 2));
    */

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Always close the connection
    await client.close();
  }
}

// Run the example
runExample().catch(console.error);
