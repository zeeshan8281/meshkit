import { randomUUID } from 'node:crypto';
import type { Agent, AgentSpec, AgentInput, AgentOutput, Tool, ToolCallResult } from './types.js';
import { getProvider } from './provider.js';
import { trace } from './trace.js';

export function defineAgent(spec: AgentSpec): Agent {
  const id = `agent_${spec.name}_${randomUUID().slice(0, 8)}`;

  const invoke = async (input: AgentInput): Promise<AgentOutput> => {
    const spanId = randomUUID();
    const startTime = Date.now();

    trace.startSpan({
      spanId,
      parentSpanId: input.parentSpanId,
      name: `agent.${spec.name}.invoke`,
      attributes: {
        'agent.name': spec.name,
        'agent.model': spec.model,
        'input.length': input.message.length,
      },
    });

    try {
      const provider = getProvider(spec.model);
      const toolCalls: ToolCallResult[] = [];

      let messages: { role: 'user' | 'assistant'; content: string }[] = [
        { role: 'user', content: input.message },
      ];

      const tools = spec.tools?.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }));

      const response = await provider.chat({
        model: spec.model,
        systemPrompt: spec.systemPrompt,
        messages,
        tools,
        temperature: spec.temperature,
        maxTokens: spec.maxTokens,
      });

      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const call of response.toolCalls) {
          const tool = spec.tools?.find(t => t.name === call.name);
          if (tool) {
            const toolStart = Date.now();
            trace.startSpan({
              spanId: `${spanId}_tool_${call.name}`,
              parentSpanId: spanId,
              name: `tool.${call.name}`,
              attributes: { 'tool.name': call.name },
            });

            try {
              const output = await tool.execute(call.input);
              const durationMs = Date.now() - toolStart;

              toolCalls.push({
                tool: call.name,
                input: call.input,
                output,
                durationMs,
              });

              trace.endSpan(`${spanId}_tool_${call.name}`, { 'tool.success': true });
            } catch (error) {
              trace.endSpan(`${spanId}_tool_${call.name}`, {
                'tool.success': false,
                'tool.error': String(error),
              });
              throw error;
            }
          }
        }

        messages.push({ role: 'assistant', content: response.content });
        messages.push({
          role: 'user',
          content: `Tool results:\n${toolCalls.map(tc =>
            `${tc.tool}: ${JSON.stringify(tc.output)}`
          ).join('\n')}`
        });

        const finalResponse = await provider.chat({
          model: spec.model,
          systemPrompt: spec.systemPrompt,
          messages,
          temperature: spec.temperature,
          maxTokens: spec.maxTokens,
        });

        const durationMs = Date.now() - startTime;

        trace.endSpan(spanId, {
          'output.length': finalResponse.content.length,
          'duration_ms': durationMs,
          'tokens.input': (response.usage?.inputTokens ?? 0) + (finalResponse.usage?.inputTokens ?? 0),
          'tokens.output': (response.usage?.outputTokens ?? 0) + (finalResponse.usage?.outputTokens ?? 0),
        });

        return {
          message: finalResponse.content,
          toolCalls,
          usage: {
            inputTokens: (response.usage?.inputTokens ?? 0) + (finalResponse.usage?.inputTokens ?? 0),
            outputTokens: (response.usage?.outputTokens ?? 0) + (finalResponse.usage?.outputTokens ?? 0),
          },
          spanId,
        };
      }

      const durationMs = Date.now() - startTime;

      trace.endSpan(spanId, {
        'output.length': response.content.length,
        'duration_ms': durationMs,
        'tokens.input': response.usage?.inputTokens ?? 0,
        'tokens.output': response.usage?.outputTokens ?? 0,
      });

      return {
        message: response.content,
        toolCalls: [],
        usage: response.usage,
        spanId,
      };
    } catch (error) {
      trace.endSpan(spanId, {
        'error': true,
        'error.message': String(error),
      });
      throw error;
    }
  };

  return {
    ...spec,
    id,
    invoke,
  };
}

export function tool<T>(
  name: string,
  description: string,
  parameters: import('zod').ZodType<T>,
  execute: (input: T) => Promise<unknown>
): Tool {
  return {
    name,
    description,
    parameters,
    execute: execute as (input: unknown) => Promise<unknown>,
  };
}
