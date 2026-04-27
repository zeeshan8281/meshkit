import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ModelId, TokenUsage } from './types.js';
import type { ZodType } from 'zod';
import { zodToJsonSchema } from './utils.js';

interface ChatRequest {
  model: ModelId;
  systemPrompt: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  tools?: { name: string; description: string; parameters: ZodType<unknown> }[];
  temperature?: number;
  maxTokens?: number;
}

interface ChatResponse {
  content: string;
  toolCalls?: { name: string; input: unknown }[];
  usage?: TokenUsage;
}

interface Provider {
  chat: (request: ChatRequest) => Promise<ChatResponse>;
}

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;
let openrouterClient: OpenAI | null = null;

const providerConfig: {
  anthropic?: { apiKey?: string };
  openai?: { apiKey?: string };
  openrouter?: { apiKey?: string };
} = {};

export const provider = {
  anthropic(config: { apiKey?: string }) {
    providerConfig.anthropic = config;
    anthropicClient = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY
    });
  },
  openai(config: { apiKey?: string }) {
    providerConfig.openai = config;
    openaiClient = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY
    });
  },
  openrouter(config: { apiKey?: string }) {
    providerConfig.openrouter = config;
    openrouterClient = new OpenAI({
      apiKey: config.apiKey || process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/zeeshan8281/meshkit',
        'X-Title': 'meshkit',
      },
    });
  },
  custom(config: { endpoint: string; format: 'anthropic' | 'openai' }) {
    if (config.format === 'anthropic') {
      anthropicClient = new Anthropic({ baseURL: config.endpoint });
    } else {
      openaiClient = new OpenAI({ baseURL: config.endpoint });
    }
  },
};

function isAnthropicModel(model: ModelId): boolean {
  return model.startsWith('claude');
}

function isOpenAIModel(model: ModelId): boolean {
  return model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3');
}

function isOpenRouterModel(model: ModelId): boolean {
  return model.includes('/');
}

function getAnthropicProvider(): Provider {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const tools = request.tools?.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: zodToJsonSchema(t.parameters) as Anthropic.Tool['input_schema'],
      }));

      const response = await anthropicClient!.messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature,
        system: request.systemPrompt,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        ...(tools && tools.length > 0 ? { tools } : {}),
      });

      const textContent = response.content.find(c => c.type === 'text');
      const toolUseContent = response.content.filter(c => c.type === 'tool_use');

      return {
        content: textContent?.type === 'text' ? textContent.text : '',
        toolCalls: toolUseContent.map(tc => ({
          name: tc.type === 'tool_use' ? tc.name : '',
          input: tc.type === 'tool_use' ? tc.input : {},
        })),
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    },
  };
}

function getOpenAIProvider(): Provider {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const tools = request.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: zodToJsonSchema(t.parameters),
        },
      }));

      const response = await openaiClient!.chat.completions.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature,
        messages: [
          { role: 'system', content: request.systemPrompt },
          ...request.messages,
        ],
        ...(tools && tools.length > 0 ? { tools } : {}),
      });

      const choice = response.choices[0];
      const toolCalls = choice.message.tool_calls?.map(tc => ({
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments),
      }));

      return {
        content: choice.message.content ?? '',
        toolCalls,
        usage: response.usage ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        } : undefined,
      };
    },
  };
}

function getOpenRouterProvider(): Provider {
  if (!openrouterClient) {
    openrouterClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/zeeshan8281/meshkit',
        'X-Title': 'meshkit',
      },
    });
  }

  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const tools = request.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: zodToJsonSchema(t.parameters),
        },
      }));

      const response = await openrouterClient!.chat.completions.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature,
        messages: [
          { role: 'system', content: request.systemPrompt },
          ...request.messages,
        ],
        ...(tools && tools.length > 0 ? { tools } : {}),
      });

      const choice = response.choices[0];
      const toolCalls = choice.message.tool_calls?.map(tc => ({
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments),
      }));

      return {
        content: choice.message.content ?? '',
        toolCalls,
        usage: response.usage ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        } : undefined,
      };
    },
  };
}

export function getProvider(model: ModelId): Provider {
  if (isOpenRouterModel(model)) {
    return getOpenRouterProvider();
  }
  if (isAnthropicModel(model)) {
    return getAnthropicProvider();
  }
  if (isOpenAIModel(model)) {
    return getOpenAIProvider();
  }
  if (openrouterClient) {
    return getOpenRouterProvider();
  }
  if (anthropicClient) {
    return getAnthropicProvider();
  }
  if (openaiClient) {
    return getOpenAIProvider();
  }
  if (process.env.OPENROUTER_API_KEY) {
    return getOpenRouterProvider();
  }
  throw new Error(`No provider configured for model: ${model}`);
}
