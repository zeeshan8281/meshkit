# meshkit

**The Express.js of agent meshes.** A minimal SDK for building distributed multi-agent systems that actually work.

[![npm version](https://img.shields.io/npm/v/@zeeshan8281/meshkit.svg)](https://www.npmjs.com/package/@zeeshan8281/meshkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## The Problem

Building multi-agent systems today sucks:

1. **Heavyweight frameworks** (LangGraph, CrewAI) — productive but opinionated, overkill for 3-5 agent systems
2. **Hand-roll everything** — re-implement discovery, routing, tracing every single time
3. **No-code builders** — fast to start, impossible to extend

**The gap:** No minimal layer that handles *coordination* and gets out of the way.

## The Solution

meshkit gives you:

- **Distributed agents** — run agents as separate processes, they find each other
- **Registry + discovery** — agents register capabilities, discover by name or skill
- **Pluggable topology** — hub-and-spoke shipped, swap to flat mesh later
- **MCP-native tools** — any MCP server works out of the box
- **Built-in tracing** — every agent call traced, debug what went wrong
- **Any LLM provider** — Anthropic, OpenAI, OpenRouter, or custom

---

## Installation

```bash
npm install @zeeshan8281/meshkit
```

That's it. One package. Everything included.

---

## Quick Start: Single Process

```ts
import { defineAgent, createMesh, hubAndSpoke, createOrchestratorAgent, trace } from '@zeeshan8281/meshkit';

// Define agents
const researcher = defineAgent({
  name: 'researcher',
  model: 'anthropic/claude-sonnet-4', // OpenRouter format
  systemPrompt: 'You research topics thoroughly and provide accurate facts.',
});

const writer = defineAgent({
  name: 'writer',
  model: 'anthropic/claude-sonnet-4',
  systemPrompt: 'You write clear, engaging content from research findings.',
});

// Create mesh with hub-and-spoke topology
const orchestrator = createOrchestratorAgent('anthropic/claude-sonnet-4');
const mesh = createMesh({
  topology: hubAndSpoke({ orchestrator }),
  agents: [researcher, writer],
});

// Enable tracing
trace.enable({ exportFormat: 'console' });

// Run
const result = await mesh.run('Research AI agents and write a summary');
console.log(result.output);
console.log(`Tokens: ${result.totalTokens.inputTokens} in / ${result.totalTokens.outputTokens} out`);
```

---

## Distributed Agents (The Real Shit)

Run agents as **separate processes** on the same machine or different machines. They discover each other via registry.

### 1. Start the Registry

```bash
npx @zeeshan8281/registry
# or
import { startRegistry } from '@zeeshan8281/registry';
startRegistry({ port: 4200 });
```

```
🕸️  meshkit registry
   Endpoint: http://localhost:4200
```

### 2. Agent A (in /project-a/)

```ts
// coder-agent.ts
import { defineAgent, serveAgent } from '@zeeshan8281/meshkit';

const coder = defineAgent({
  name: 'coder',
  model: 'anthropic/claude-sonnet-4',
  systemPrompt: 'You write clean, efficient code.',
});

serveAgent({
  name: 'coder',
  capabilities: ['write-code', 'refactor', 'debug'],
  invoke: (input) => coder.invoke(input),
}, { port: 3001 });
```

```
🤖 Agent: coder
   Endpoint: http://localhost:3001
   Registry: http://localhost:4200
   Capabilities: write-code, refactor, debug
```

### 3. Agent B (in /project-b/)

```ts
// reviewer-agent.ts
import { defineAgent, serveAgent } from '@zeeshan8281/meshkit';

const reviewer = defineAgent({
  name: 'reviewer',
  model: 'anthropic/claude-sonnet-4',
  systemPrompt: 'You review code for bugs, security issues, and best practices.',
});

serveAgent({
  name: 'reviewer',
  capabilities: ['code-review', 'security-audit'],
  invoke: (input) => reviewer.invoke(input),
}, { port: 3002 });
```

### 4. Run a Task Using Both Agents

```ts
// runner.ts
import { connectToAgent, discoverAgents, createRegistryClient } from '@zeeshan8281/meshkit';

// Discover all available agents
const registry = createRegistryClient('http://localhost:4200');
const agents = await registry.list();
console.log('Available agents:', agents.map(a => a.name));

// Connect to specific agents
const coder = await connectToAgent('coder');
const reviewer = await connectToAgent('reviewer');

// Use them
const code = await coder.invoke({ message: 'Write a rate limiter in TypeScript' });
console.log('Code:', code.message);

const review = await reviewer.invoke({ message: `Review this code:\n${code.message}` });
console.log('Review:', review.message);
```

**Output:**
```
Available agents: ['coder', 'reviewer']

Code: [TypeScript rate limiter implementation]

Review: [Code review with bugs found, security issues, suggestions]
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         meshkit                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │   Agent A   │     │   Agent B   │     │   Agent C   │      │
│   │  (coder)    │     │ (reviewer)  │     │  (tester)   │      │
│   │  :3001      │     │   :3002     │     │   :3003     │      │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘      │
│          │                   │                   │              │
│          └───────────────────┼───────────────────┘              │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │     Registry      │                        │
│                    │      :4200        │                        │
│                    │                   │                        │
│                    │  - Registration   │                        │
│                    │  - Discovery      │                        │
│                    │  - Heartbeat      │                        │
│                    └─────────┬─────────┘                        │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │   Runner/Client   │                        │
│                    │                   │                        │
│                    │  connectToAgent() │                        │
│                    │  discoverAgents() │                        │
│                    └───────────────────┘                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## MCP Tool Integration

Any MCP server works as a tool provider:

```ts
import { defineAgent, mcp } from '@zeeshan8281/meshkit';

const researcher = defineAgent({
  name: 'researcher',
  model: 'anthropic/claude-sonnet-4',
  systemPrompt: 'You research topics using web search.',
  tools: await mcp('npx:exa-mcp-server'), // Exa search
});

// Or multiple MCP servers
const agent = defineAgent({
  name: 'assistant',
  model: 'anthropic/claude-sonnet-4',
  systemPrompt: '...',
  tools: [
    ...await mcp('npx:filesystem-mcp'),  // File system access
    ...await mcp('npx:shell-mcp'),        // Shell commands
    ...await mcp('http://localhost:8080'), // Custom MCP server
  ],
});
```

---

## LLM Providers

### OpenRouter (Recommended)

Access any model through one API:

```bash
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4
```

```ts
const agent = defineAgent({
  name: 'agent',
  model: 'anthropic/claude-sonnet-4',  // or 'openai/gpt-4o', 'google/gemini-2.0-flash'
  systemPrompt: '...',
});
```

### Direct Providers

```ts
import { provider } from '@zeeshan8281/meshkit';

// Anthropic
provider.anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// OpenAI
provider.openai({ apiKey: process.env.OPENAI_API_KEY });

// Custom endpoint
provider.custom({ endpoint: 'http://localhost:11434/v1', format: 'openai' });
```

---

## Tracing

Every agent call is traced automatically:

```ts
import { trace } from '@zeeshan8281/meshkit';

// Console output
trace.enable({ exportFormat: 'console' });

// Get trace data
const spans = trace.getSpans();

// Export as OTLP (OpenTelemetry)
const otlp = trace.export('otlp');
```

**Console output:**
```
--- Trace Summary ---
Trace ID: abc123
✓ orchestrator.round_1 (2340ms)
  ✓ agent.researcher.invoke (1823ms)
  ✓ agent.writer.invoke (1456ms)
✓ orchestrator.round_2 (1102ms)
-------------------
```

---

## API Reference

### Core (`@zeeshan8281/meshkit`)

```ts
// Define an agent
defineAgent(spec: AgentSpec): Agent

// Create a mesh of agents
createMesh(config: MeshConfig): Mesh

// Run the mesh
mesh.run(input: string): Promise<MeshResult>

// Hub-and-spoke topology
hubAndSpoke(opts: { orchestrator: Agent, maxRounds?: number }): Topology

// Create default orchestrator
createOrchestratorAgent(model?: string, customPrompt?: string): Agent

// Define a tool
tool(name: string, description: string, parameters: ZodSchema, execute: Function): Tool

// Tracing
trace.enable(opts?: TraceConfig)
trace.export(format: 'otlp' | 'json' | 'console')
```

### Registry (`@zeeshan8281/registry`)

```ts
// Create client
const registry = createRegistryClient(url?: string)

// Register an agent
await registry.register({ name, endpoint, capabilities, model? })

// Discover agents
await registry.discover({ name?, capability? })

// List all agents
await registry.list()

// Heartbeat (automatic when using serveAgent)
await registry.heartbeat()
```

### Transport (`@zeeshan8281/transport`)

```ts
// Serve an agent as HTTP service
serveAgent(handler: AgentHandler, opts?: { port?, registryUrl? })

// Connect to a remote agent
const agent = await connectToAgent(nameOrEndpoint: string)

// Discover agents by capability
const agents = await discoverAgents(capability: string)

// Invoke remote agent
await agent.invoke({ message: string, context?: object })
```

---

## Configuration

### Environment Variables

```bash
# LLM Providers
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4

# Registry
MESHKIT_REGISTRY=http://localhost:4200
MESHKIT_REGISTRY_PORT=4200
```

---

## Examples

### Research Bot (3 agents)

```bash
git clone https://github.com/zeeshan8281/meshkit
cd meshkit/examples/research-bot
cp .env.example .env
# Add your API key
pnpm install && pnpm dev "Your research query"
```

### Distributed Agents

```bash
cd meshkit/examples/distributed

# Terminal 1: Registry
pnpm registry

# Terminal 2: Coder agent
pnpm coder

# Terminal 3: Reviewer agent  
pnpm reviewer

# Terminal 4: Run task
pnpm runner "Write a debounce function"
```

---

## Why meshkit?

| Feature | meshkit | LangGraph | CrewAI |
|---------|---------|-----------|--------|
| Distributed agents | ✅ Built-in | ❌ | ❌ |
| Agent discovery | ✅ Registry | ❌ | ❌ |
| MCP-native | ✅ First-class | ❌ | ❌ |
| Tracing | ✅ Built-in | Plugin | Plugin |
| Setup time | 10 min | 30+ min | 30+ min |
| Lines of code | ~50 | ~200+ | ~150+ |
| Opinionated | Minimal | Heavy | Heavy |

---

## Roadmap

- [x] Hub-and-spoke topology
- [x] Distributed agent registry
- [x] HTTP transport
- [x] OpenRouter support
- [x] MCP tool integration
- [x] OpenTelemetry tracing
- [ ] Flat mesh topology
- [ ] WebSocket transport
- [ ] Agent-to-agent streaming
- [ ] Python SDK

---

## Contributing

```bash
git clone https://github.com/zeeshan8281/meshkit
cd meshkit
pnpm install
pnpm build
pnpm demo "test query"
```

---

## License

MIT

---

**Built for solo builders who ship.**
