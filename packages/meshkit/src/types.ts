import { z } from 'zod';

export type ModelId =
  | 'claude-opus-4-7'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | (string & {});

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodType<unknown>;
  execute: (input: unknown) => Promise<unknown>;
}

export interface McpTool extends Tool {
  type: 'mcp';
  serverUrl: string;
}

export interface AgentSpec {
  name: string;
  model: ModelId;
  systemPrompt: string;
  tools?: Tool[];
  temperature?: number;
  maxTokens?: number;
}

export interface Agent extends AgentSpec {
  id: string;
  invoke: (input: AgentInput) => Promise<AgentOutput>;
}

export interface AgentInput {
  message: string;
  context?: Record<string, unknown>;
  parentSpanId?: string;
}

export interface AgentOutput {
  message: string;
  toolCalls?: ToolCallResult[];
  usage?: TokenUsage;
  spanId: string;
}

export interface ToolCallResult {
  tool: string;
  input: unknown;
  output: unknown;
  durationMs: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface Topology {
  name: string;
  execute: (input: string, agents: Agent[], orchestrator?: Agent) => Promise<MeshResult>;
}

export interface MeshConfig {
  topology: Topology;
  agents: Agent[];
  trace?: TraceConfig;
}

export interface Mesh {
  run: (input: string | { message: string; context?: Record<string, unknown> }) => Promise<MeshResult>;
  agents: Agent[];
  topology: Topology;
}

export interface MeshResult {
  output: string;
  steps: MeshStep[];
  totalTokens: TokenUsage;
  durationMs: number;
  traceId: string;
}

export interface MeshStep {
  agent: string;
  input: string;
  output: string;
  toolCalls?: ToolCallResult[];
  tokens: TokenUsage;
  durationMs: number;
  spanId: string;
}

export interface TraceConfig {
  enabled?: boolean;
  serviceName?: string;
  endpoint?: string;
  exportFormat?: 'otlp' | 'json' | 'console';
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface HubAndSpokeOptions {
  orchestrator: Agent;
  maxRounds?: number;
}
