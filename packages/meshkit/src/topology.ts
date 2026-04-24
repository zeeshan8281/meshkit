import type { Agent, Topology, MeshResult, MeshStep, TokenUsage } from './types.js';
import type { HubAndSpokeOptions } from './types.js';
import { trace } from './trace.js';
import { randomUUID } from 'node:crypto';

const DEFAULT_ORCHESTRATOR_PROMPT = `You are an orchestrator agent that coordinates a team of specialized agents to solve tasks.

Your job is to:
1. Analyze the user's request
2. Break it down into subtasks
3. Delegate each subtask to the most appropriate agent
4. Synthesize the results into a final response

Available agents and their capabilities will be provided in each message.

When delegating, respond with JSON in this format:
{
  "thinking": "your analysis of the task",
  "delegations": [
    { "agent": "agent_name", "task": "specific task description" }
  ]
}

When you have gathered enough information to provide a final answer, respond with:
{
  "thinking": "your synthesis",
  "final_answer": "the complete response to the user"
}

Be concise in your delegations. Each agent should receive a clear, focused task.`;

export function hubAndSpoke(options: HubAndSpokeOptions): Topology {
  const { orchestrator, maxRounds = 5 } = options;

  return {
    name: 'hub-and-spoke',

    async execute(input: string, agents: Agent[]): Promise<MeshResult> {
      const traceId = trace.startTrace();
      const startTime = Date.now();
      const steps: MeshStep[] = [];
      const totalTokens: TokenUsage = { inputTokens: 0, outputTokens: 0 };

      const agentDescriptions = agents
        .map(a => `- ${a.name}: ${a.systemPrompt.slice(0, 100)}...`)
        .join('\n');

      let currentInput = `User request: ${input}\n\nAvailable agents:\n${agentDescriptions}`;
      let round = 0;

      while (round < maxRounds) {
        round++;
        const orchestratorSpanId = randomUUID();

        trace.startSpan({
          spanId: orchestratorSpanId,
          name: `orchestrator.round_${round}`,
          attributes: { round },
        });

        const orchResponse = await orchestrator.invoke({
          message: currentInput,
          parentSpanId: orchestratorSpanId,
        });

        steps.push({
          agent: orchestrator.name,
          input: currentInput,
          output: orchResponse.message,
          tokens: orchResponse.usage ?? { inputTokens: 0, outputTokens: 0 },
          durationMs: 0,
          spanId: orchResponse.spanId,
        });

        if (orchResponse.usage) {
          totalTokens.inputTokens += orchResponse.usage.inputTokens;
          totalTokens.outputTokens += orchResponse.usage.outputTokens;
        }

        let parsed: { thinking?: string; delegations?: { agent: string; task: string }[]; final_answer?: string };
        try {
          const jsonMatch = orchResponse.message.match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        } catch {
          parsed = { final_answer: orchResponse.message };
        }

        trace.endSpan(orchestratorSpanId, {
          'has_delegations': !!parsed.delegations?.length,
          'is_final': !!parsed.final_answer,
        });

        if (parsed.final_answer) {
          const result: MeshResult = {
            output: parsed.final_answer,
            steps,
            totalTokens,
            durationMs: Date.now() - startTime,
            traceId,
          };
          trace.endTrace();
          return result;
        }

        if (parsed.delegations && parsed.delegations.length > 0) {
          const delegationResults: string[] = [];

          for (const delegation of parsed.delegations) {
            const agent = agents.find(a => a.name === delegation.agent);
            if (!agent) {
              delegationResults.push(`[${delegation.agent}]: Agent not found`);
              continue;
            }

            const agentResponse = await agent.invoke({
              message: delegation.task,
              parentSpanId: orchestratorSpanId,
            });

            steps.push({
              agent: agent.name,
              input: delegation.task,
              output: agentResponse.message,
              toolCalls: agentResponse.toolCalls,
              tokens: agentResponse.usage ?? { inputTokens: 0, outputTokens: 0 },
              durationMs: 0,
              spanId: agentResponse.spanId,
            });

            if (agentResponse.usage) {
              totalTokens.inputTokens += agentResponse.usage.inputTokens;
              totalTokens.outputTokens += agentResponse.usage.outputTokens;
            }

            delegationResults.push(`[${agent.name}]: ${agentResponse.message}`);
          }

          currentInput = `Results from delegated tasks:\n\n${delegationResults.join('\n\n')}\n\nBased on these results, either delegate more tasks or provide a final answer.`;
        } else {
          const result: MeshResult = {
            output: orchResponse.message,
            steps,
            totalTokens,
            durationMs: Date.now() - startTime,
            traceId,
          };
          trace.endTrace();
          return result;
        }
      }

      const result: MeshResult = {
        output: `Max rounds (${maxRounds}) exceeded. Last orchestrator output: ${steps[steps.length - 1]?.output ?? 'none'}`,
        steps,
        totalTokens,
        durationMs: Date.now() - startTime,
        traceId,
      };
      trace.endTrace();
      return result;
    },
  };
}

export function createOrchestratorAgent(
  model: string = 'claude-sonnet-4-6',
  customPrompt?: string
): Agent {
  const { defineAgent } = require('./agent.js');
  return defineAgent({
    name: 'orchestrator',
    model,
    systemPrompt: customPrompt ?? DEFAULT_ORCHESTRATOR_PROMPT,
    temperature: 0.3,
  });
}
