import { defineAgent } from 'meshkit';

const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';

export const critic = defineAgent({
  name: 'critic',
  model,
  systemPrompt: `You are a critic agent. Your job is to review content for accuracy, clarity, and completeness.

When reviewing content:
1. Check facts and claims for accuracy
2. Identify gaps or missing information
3. Suggest improvements to clarity
4. Flag any issues or concerns

Be constructive but thorough. Prioritize the most important improvements.`,
  temperature: 0.3,
});
