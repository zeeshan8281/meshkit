export interface AgentRegistration {
  id: string;
  name: string;
  endpoint: string;
  capabilities: string[];
  model?: string;
  metadata?: Record<string, unknown>;
  registeredAt: number;
  lastHeartbeat: number;
}

export interface RegisterRequest {
  name: string;
  endpoint: string;
  capabilities: string[];
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface InvokeRequest {
  message: string;
  context?: Record<string, unknown>;
  parentSpanId?: string;
}

export interface InvokeResponse {
  message: string;
  toolCalls?: { tool: string; input: unknown; output: unknown; durationMs: number }[];
  usage?: { inputTokens: number; outputTokens: number };
  spanId: string;
}

export interface DiscoverQuery {
  name?: string;
  capability?: string;
}
