# meshkit

Multi-agent mesh SDK — "the Express.js of agent meshes"

## Project Structure

```
packages/
  meshkit/       Core SDK (defineAgent, createMesh, hubAndSpoke, trace)
  cli/           CLI (create-mesh-app, meshkit dev, meshkit trace)
  mcp/           MCP tool integration
  providers/     LLM provider adapters (Anthropic, OpenAI)
  trace-ui/      Trace visualization server
examples/
  research-bot/  3-agent example (researcher, writer, critic)
```

## Key Commands

```bash
pnpm install          # Install deps
pnpm build            # Build all packages
pnpm typecheck        # Type check all packages
pnpm test             # Run tests
```

## Architecture

- **Agent layer**: `defineAgent()` creates stateless agent specs
- **Transport layer**: in-process by default, pluggable for distributed
- **Orchestration layer**: `topology(input, agents) → output`, hub-and-spoke shipped
- **Observability layer**: OpenTelemetry spans on every invoke/route/tool call

## API Surface (~10 functions)

```ts
defineAgent(spec)           // Create agent
createMesh(config)          // Create mesh
mesh.run(input)             // Execute
hubAndSpoke(opts)           // Topology
tool(name, desc, schema, fn) // Custom tool
mcp(url, opts?)             // MCP tools
trace.enable(opts?)         // Enable tracing
trace.export(format)        // Export traces
provider.anthropic(cfg)     // Configure Anthropic
provider.openai(cfg)        // Configure OpenAI
```

## Testing

Run the research-bot example:
```bash
cd examples/research-bot
cp .env.example .env
# Add ANTHROPIC_API_KEY
pnpm dev "your query here"
```
