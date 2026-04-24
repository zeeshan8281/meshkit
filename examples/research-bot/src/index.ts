import { createMesh, hubAndSpoke, createOrchestratorAgent, trace } from 'meshkit';
import { researcher } from './agents/researcher.js';
import { writer } from './agents/writer.js';
import { critic } from './agents/critic.js';

trace.enable({ exportFormat: 'console' });

const orchestrator = createOrchestratorAgent('claude-sonnet-4-6');

const mesh = createMesh({
  topology: hubAndSpoke({ orchestrator, maxRounds: 3 }),
  agents: [researcher, writer, critic],
});

async function main() {
  console.log('🕸️  meshkit research-bot\n');

  const query = process.argv[2] || 'Research the latest developments in AI agents and write a brief summary';

  console.log(`📝 Query: ${query}\n`);
  console.log('⏳ Running mesh...\n');

  const startTime = Date.now();
  const result = await mesh.run(query);

  console.log('\n' + '═'.repeat(60));
  console.log('\n📄 Result:\n');
  console.log(result.output);

  console.log('\n' + '─'.repeat(60));
  console.log('\n📊 Stats:');
  console.log(`  Agents invoked: ${result.steps.length}`);
  console.log(`  Total tokens: ${result.totalTokens.inputTokens} in / ${result.totalTokens.outputTokens} out`);
  console.log(`  Duration: ${Date.now() - startTime}ms`);
  console.log(`  Trace ID: ${result.traceId}`);
  console.log();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
