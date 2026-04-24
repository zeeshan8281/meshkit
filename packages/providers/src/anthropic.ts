import Anthropic from '@anthropic-ai/sdk';
import type { ProviderConfig, ChatRequest, ChatResponse, Provider } from './types.js';

export function createAnthropicProvider(config?: ProviderConfig): Provider {
  const client = new Anthropic({
    apiKey: config?.apiKey ?? process.env.ANTHROPIC_API_KEY,
    baseURL: config?.baseUrl,
  });

  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const tools = request.tools?.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool['input_schema'],
      }));

      const response = await client.messages.create({
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
