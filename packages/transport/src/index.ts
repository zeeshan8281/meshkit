import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createRegistryClient, type InvokeRequest, type InvokeResponse } from '@meshkit/registry';

export interface AgentHandler {
  name: string;
  capabilities: string[];
  model?: string;
  invoke: (input: InvokeRequest) => Promise<InvokeResponse>;
}

export interface ServeOptions {
  port?: number;
  registryUrl?: string;
}

export async function serveAgent(agent: AgentHandler, options: ServeOptions = {}) {
  const port = options.port || parseInt(process.env.PORT || '0') || 3000 + Math.floor(Math.random() * 1000);
  const registryUrl = options.registryUrl || process.env.MESHKIT_REGISTRY || 'http://localhost:4200';

  const app = new Hono();

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok', agent: agent.name }));

  // Agent info
  app.get('/info', (c) => c.json({
    name: agent.name,
    capabilities: agent.capabilities,
    model: agent.model,
  }));

  // Invoke the agent
  app.post('/invoke', async (c) => {
    const body = await c.req.json<InvokeRequest>();

    try {
      const result = await agent.invoke(body);
      return c.json(result);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  // Start server
  const server = serve({ fetch: app.fetch, port });

  const endpoint = `http://localhost:${port}`;

  // Register with registry
  const registry = createRegistryClient(registryUrl);

  try {
    const registration = await registry.register({
      name: agent.name,
      endpoint,
      capabilities: agent.capabilities,
      model: agent.model,
    });

    console.log(`
🤖 Agent: ${agent.name}
   Endpoint: ${endpoint}
   Registry: ${registryUrl}
   ID: ${registration.id}
   Capabilities: ${agent.capabilities.join(', ')}
`);

    // Handle shutdown
    const shutdown = async () => {
      console.log(`\n[${agent.name}] Shutting down...`);
      await registry.unregister();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    return { server, registry, endpoint, registration };
  } catch (error) {
    console.warn(`[${agent.name}] Could not register with registry: ${error}`);
    console.log(`
🤖 Agent: ${agent.name} (standalone mode)
   Endpoint: ${endpoint}
   Capabilities: ${agent.capabilities.join(', ')}
`);
    return { server, endpoint };
  }
}

export class RemoteAgent {
  private endpoint: string;
  public name: string;

  constructor(endpoint: string, name: string = 'remote') {
    this.endpoint = endpoint;
    this.name = name;
  }

  async invoke(input: InvokeRequest): Promise<InvokeResponse> {
    const res = await fetch(`${this.endpoint}/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error(`Remote agent error: ${res.statusText}`);
    }

    return res.json() as Promise<InvokeResponse>;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}

export async function connectToAgent(nameOrEndpoint: string, registryUrl?: string): Promise<RemoteAgent> {
  // If it's a URL, connect directly
  if (nameOrEndpoint.startsWith('http')) {
    const res = await fetch(`${nameOrEndpoint}/info`);
    const info = await res.json() as { name: string };
    return new RemoteAgent(nameOrEndpoint, info.name);
  }

  // Otherwise, discover via registry
  const registry = createRegistryClient(registryUrl);
  const agents = await registry.discover({ name: nameOrEndpoint });

  if (agents.length === 0) {
    throw new Error(`No agent found with name: ${nameOrEndpoint}`);
  }

  const agent = agents[0];
  return new RemoteAgent(agent.endpoint, agent.name);
}

export async function discoverAgents(capability: string, registryUrl?: string): Promise<RemoteAgent[]> {
  const registry = createRegistryClient(registryUrl);
  const agents = await registry.discover({ capability });

  return agents.map(a => new RemoteAgent(a.endpoint, a.name));
}
