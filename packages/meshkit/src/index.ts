// Core
export { defineAgent, tool } from './agent.js';
export { createMesh } from './mesh.js';
export { hubAndSpoke, createOrchestratorAgent } from './topology.js';
export { provider } from './provider.js';
export { trace } from './trace.js';

// Registry
export { createRegistryClient, RegistryClient } from '@zeeshan8281/registry';
export type { AgentRegistration, RegisterRequest, DiscoverQuery } from '@zeeshan8281/registry';

// Transport
export { serveAgent, connectToAgent, discoverAgents, RemoteAgent } from '@zeeshan8281/transport';
export type { AgentHandler, ServeOptions } from '@zeeshan8281/transport';

// MCP
export { mcp, mcpTool, disconnectAll } from '@zeeshan8281/mcp';

// Types
export type {
  Agent,
  AgentSpec,
  AgentInput,
  AgentOutput,
  Tool,
  McpTool,
  ToolCallResult,
  TokenUsage,
  Topology,
  Mesh,
  MeshConfig,
  MeshResult,
  MeshStep,
  TraceConfig,
  ProviderConfig,
  HubAndSpokeOptions,
  ModelId,
} from './types.js';
