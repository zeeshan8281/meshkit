import { defineAgent } from 'meshkit';

const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';

export const writer = defineAgent({
  name: 'writer',
  model,
  systemPrompt: `You are a writing agent. Your job is to take research findings and compose clear, engaging content.

When given research to write about:
1. Organize information logically
2. Write in clear, accessible prose
3. Adapt tone to the audience
4. Use transitions to connect ideas

Focus on clarity and readability. Make complex topics understandable.`,
  temperature: 0.7,
});
