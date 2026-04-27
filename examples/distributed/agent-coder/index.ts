import 'dotenv/config';
import { defineAgent } from 'meshkit';
import { serveAgent } from '@meshkit/transport';

const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';

const coder = defineAgent({
  name: 'coder',
  model,
  systemPrompt: `You are a coding agent. You write clean, efficient code.
When given a task, produce working code with brief explanations.
Focus on correctness and readability.`,
});

// Serve this agent as a standalone HTTP service
serveAgent({
  name: 'coder',
  capabilities: ['write-code', 'refactor', 'debug'],
  model,
  invoke: async (input) => {
    const result = await coder.invoke(input);
    return result;
  },
}, {
  port: 3001,
});
