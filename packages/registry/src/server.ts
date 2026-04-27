#!/usr/bin/env node
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { AgentRegistration, RegisterRequest, DiscoverQuery } from './types.js';

const app = new Hono();
const agents = new Map<string, AgentRegistration>();

const HEARTBEAT_TIMEOUT = 30000; // 30 seconds

// Clean up dead agents periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, agent] of agents) {
    if (now - agent.lastHeartbeat > HEARTBEAT_TIMEOUT) {
      console.log(`[registry] Agent ${agent.name} (${id}) timed out`);
      agents.delete(id);
    }
  }
}, 10000);

// Register an agent
app.post('/register', async (c) => {
  const body = await c.req.json<RegisterRequest>();
  const id = `${body.name}_${Date.now().toString(36)}`;

  const registration: AgentRegistration = {
    id,
    name: body.name,
    endpoint: body.endpoint,
    capabilities: body.capabilities,
    model: body.model,
    metadata: body.metadata,
    registeredAt: Date.now(),
    lastHeartbeat: Date.now(),
  };

  agents.set(id, registration);
  console.log(`[registry] Agent registered: ${body.name} @ ${body.endpoint}`);

  return c.json(registration);
});

// Heartbeat to keep registration alive
app.post('/heartbeat/:id', (c) => {
  const id = c.req.param('id');
  const agent = agents.get(id);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  agent.lastHeartbeat = Date.now();
  return c.json({ ok: true });
});

// Unregister an agent
app.delete('/agents/:id', (c) => {
  const id = c.req.param('id');
  const agent = agents.get(id);

  if (agent) {
    agents.delete(id);
    console.log(`[registry] Agent unregistered: ${agent.name}`);
  }

  return c.json({ ok: true });
});

// List all agents
app.get('/agents', (c) => {
  return c.json(Array.from(agents.values()));
});

// Discover agents by name or capability
app.get('/discover', (c) => {
  const name = c.req.query('name');
  const capability = c.req.query('capability');

  let results = Array.from(agents.values());

  if (name) {
    results = results.filter(a => a.name === name || a.name.includes(name));
  }

  if (capability) {
    results = results.filter(a => a.capabilities.includes(capability));
  }

  return c.json(results);
});

// Get specific agent
app.get('/agents/:id', (c) => {
  const id = c.req.param('id');
  const agent = agents.get(id);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json(agent);
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', agents: agents.size });
});

const port = parseInt(process.env.MESHKIT_REGISTRY_PORT || '4200');

console.log(`
🕸️  meshkit registry

   Endpoint: http://localhost:${port}

   Agents can register at POST /register
   Discover agents at GET /discover?capability=xxx
`);

serve({ fetch: app.fetch, port });
