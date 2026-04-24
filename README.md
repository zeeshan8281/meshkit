# meshkit

The Express.js of agent meshes. A minimal, composable SDK for building multi-agent systems.

## Quick Start

```bash
npx create-mesh-app my-research-bot
cd my-research-bot
cp .env.example .env
# Add your API keys to .env
npm run dev
```

## Features

- **10-minute quickstart** — scaffolds a working 3-agent system
- **MCP-native** — any MCP server works as a tool provider
- **Orchestrator-agnostic** — hub-and-spoke topology shipped, interfaces designed for extensibility
- **First-class observability** — OpenTelemetry-compatible tracing with local dashboard
- **TypeScript-first** — full type safety, zero magic

## Core API

```ts
import { defineAgent, createMesh, hubAndSpoke, tool, trace } from 'meshkit';
import { mcp } from '@meshkit/mcp';

// Define agents
const researcher = defineAgent({
  name: 'researcher',
  model: 'claude-sonnet-4-6',
  systemPrompt: 'You research topics...',
  tools: [await mcp('npx:exa-mcp-server')],
});

const writer = defineAgent({
  name: 'writer',
  model: 'claude-sonnet-4-6',
  systemPrompt: 'You write content...',
});

// Create mesh
const mesh = createMesh({
  topology: hubAndSpoke({ orchestrator }),
  agents: [researcher, writer],
});

// Run
trace.enable({ exportFormat: 'console' });
const result = await mesh.run('Research AI agents and write a summary');
console.log(result.output);
```

## Packages

| Package | Description |
|---------|-------------|
| `meshkit` | Core SDK — agents, mesh, topology, tracing |
| `@meshkit/cli` | CLI for scaffolding and dev server |
| `@meshkit/mcp` | MCP tool integration |
| `@meshkit/providers` | LLM provider adapters |
| `@meshkit/trace-ui` | Trace visualization server |

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run example
cd examples/research-bot
cp .env.example .env
pnpm dev
```

## License

MIT
