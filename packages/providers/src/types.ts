export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface ChatRequest {
  model: string;
  systemPrompt: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  tools?: { name: string; description: string; parameters: unknown }[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
  toolCalls?: { name: string; input: unknown }[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface Provider {
  chat: (request: ChatRequest) => Promise<ChatResponse>;
}
