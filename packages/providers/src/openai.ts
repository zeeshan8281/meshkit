import OpenAI from 'openai';
import type { ProviderConfig, ChatRequest, ChatResponse, Provider } from './types.js';

export function createOpenAIProvider(config?: ProviderConfig): Provider {
  const client = new OpenAI({
    apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY,
    baseURL: config?.baseUrl,
  });

  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const tools = request.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters as Record<string, unknown>,
        },
      }));

      const response = await client.chat.completions.create({
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
