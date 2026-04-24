import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';

export interface McpOpts {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpTool {
  name: string;
  description: string;
  parameters: z.ZodType<unknown>;
  execute: (input: unknown) => Promise<unknown>;
  type: 'mcp';
  serverUrl: string;
}

const clientCache = new Map<string, Client>();

async function getClient(url: string, opts?: McpOpts): Promise<Client> {
  const cacheKey = url;

  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  const isNpxServer = url.startsWith('npx:');
  const isHttpServer = url.startsWith('http://') || url.startsWith('https://');

  if (isNpxServer) {
    const packageName = url.replace('npx:', '');
    const env = Object.fromEntries(
      Object.entries({ ...process.env, ...opts?.env }).filter((entry): entry is [string, string] => entry[1] !== undefined)
    );
    const transport = new StdioClientTransport({
      command: 'npx',
      args: [packageName, ...(opts?.args ?? [])],
      env,
    });

    const client = new Client({ name: 'meshkit', version: '0.1.0' }, { capabilities: {} });
    await client.connect(transport);
    clientCache.set(cacheKey, client);
    return client;
  }

  if (isHttpServer) {
    const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');
    const transport = new SSEClientTransport(new URL(url));
    const client = new Client({ name: 'meshkit', version: '0.1.0' }, { capabilities: {} });
    await client.connect(transport);
    clientCache.set(cacheKey, client);
    return client;
  }

  if (opts?.command) {
    const cmdEnv = Object.fromEntries(
      Object.entries({ ...process.env, ...opts.env }).filter((entry): entry is [string, string] => entry[1] !== undefined)
    );
    const transport = new StdioClientTransport({
      command: opts.command,
      args: opts.args,
      env: cmdEnv,
    });

    const client = new Client({ name: 'meshkit', version: '0.1.0' }, { capabilities: {} });
    await client.connect(transport);
    clientCache.set(cacheKey, client);
    return client;
  }

  throw new Error(`Invalid MCP server URL: ${url}. Use npx:package-name, http(s):// URL, or provide command in opts.`);
}

function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodType<unknown> {
  const type = schema.type as string;

  if (type === 'string') {
    return z.string();
  }
  if (type === 'number' || type === 'integer') {
    return z.number();
  }
  if (type === 'boolean') {
    return z.boolean();
  }
  if (type === 'array') {
    const items = schema.items as Record<string, unknown> | undefined;
    return z.array(items ? jsonSchemaToZod(items) : z.unknown());
  }
  if (type === 'object') {
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
    const required = schema.required as string[] | undefined;

    if (!properties) {
      return z.record(z.unknown());
    }

    const shape: Record<string, z.ZodType<unknown>> = {};
    for (const [key, value] of Object.entries(properties)) {
      const propSchema = jsonSchemaToZod(value);
      shape[key] = required?.includes(key) ? propSchema : propSchema.optional();
    }
    return z.object(shape);
  }

  return z.unknown();
}

export async function mcp(url: string, opts?: McpOpts): Promise<McpTool[]> {
  const client = await getClient(url, opts);
  const toolsResult = await client.listTools();

  return toolsResult.tools.map(tool => ({
    name: tool.name,
    description: tool.description ?? '',
    parameters: jsonSchemaToZod(tool.inputSchema as Record<string, unknown>),
    type: 'mcp' as const,
    serverUrl: url,
    execute: async (input: unknown) => {
      const result = await client.callTool({
        name: tool.name,
        arguments: input as Record<string, unknown>,
      });
      return result.content;
    },
  }));
}

export async function mcpTool(url: string, toolName: string, opts?: McpOpts): Promise<McpTool> {
  const tools = await mcp(url, opts);
  const tool = tools.find(t => t.name === toolName);
  if (!tool) {
    throw new Error(`Tool "${toolName}" not found on MCP server ${url}`);
  }
  return tool;
}

export async function disconnectAll(): Promise<void> {
  for (const client of clientCache.values()) {
    await client.close();
  }
  clientCache.clear();
}
