import 'dotenv/config';
import { defineAgent, createMesh, hubAndSpoke, createOrchestratorAgent, trace } from './packages/meshkit/src/index.js';

const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';

// Define agents - this is all you write
const researcher = defineAgent({
  name: 'researcher',
  model,
  systemPrompt: 'You research topics thoroughly and provide accurate facts.',
});

const writer = defineAgent({
  name: 'writer',
  model,
  systemPrompt: 'You write clear, engaging content from research findings.',
});

const critic = defineAgent({
  name: 'critic',
  model,
  systemPrompt: 'You review content for accuracy and suggest improvements.',
});

// Wire them up
const mesh = createMesh({
  topology: hubAndSpoke({ orchestrator: createOrchestratorAgent(model) }),
  agents: [researcher, writer, critic],
});

// Run
trace.enable({ exportFormat: 'console' });

const query = process.argv[2] || 'What are the top 3 AI agent frameworks in 2026?';
console.log(`\n🕸️  meshkit demo\n`);
console.log(`Query: ${query}\n`);

const result = await mesh.run(query);

console.log('\n' + '═'.repeat(50));
console.log('\n' + result.output);
console.log('\n' + '─'.repeat(50));
console.log(`Tokens: ${result.totalTokens.inputTokens} in / ${result.totalTokens.outputTokens} out`);
console.log(`Duration: ${result.durationMs}ms\n`);
