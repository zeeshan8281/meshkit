import 'dotenv/config';
import { defineAgent } from '@zeeshan8281/meshkit';
import { serveAgent } from '@zeeshan8281/transport';

const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';

const reviewer = defineAgent({
  name: 'reviewer',
  model,
  systemPrompt: `You are a code review agent. You review code for:
- Bugs and logic errors
- Security issues
- Performance problems
- Code style and readability

Provide specific, actionable feedback.`,
});

serveAgent({
  name: 'reviewer',
  capabilities: ['code-review', 'security-audit'],
  model,
  invoke: async (input) => {
    const result = await reviewer.invoke(input);
    return result;
  },
}, {
  port: 3002,
});
