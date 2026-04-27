import 'dotenv/config';
import { connectToAgent, discoverAgents } from '@meshkit/transport';
import { createRegistryClient } from '@meshkit/registry';

async function main() {
  const registry = createRegistryClient();

  console.log('🕸️  meshkit distributed runner\n');

  // Wait for agents to be available
  console.log('Discovering agents...\n');

  let agents = await registry.list();
  if (agents.length < 2) {
    console.log('Waiting for agents to register...');
    await new Promise(r => setTimeout(r, 2000));
    agents = await registry.list();
  }

  console.log('Available agents:');
  agents.forEach(a => console.log(`  - ${a.name} @ ${a.endpoint} [${a.capabilities.join(', ')}]`));
  console.log();

  // Connect to specific agents
  const coder = await connectToAgent('coder');
  const reviewer = await connectToAgent('reviewer');

  // Task: Write code, then review it
  const task = process.argv[2] || 'Write a TypeScript function to validate email addresses';

  console.log(`📝 Task: ${task}\n`);
  console.log('─'.repeat(50));

  // Step 1: Coder writes code
  console.log('\n🤖 [coder] Writing code...\n');
  const codeResult = await coder.invoke({ message: task });
  console.log(codeResult.message);

  console.log('\n' + '─'.repeat(50));

  // Step 2: Reviewer reviews the code
  console.log('\n🔍 [reviewer] Reviewing code...\n');
  const reviewResult = await reviewer.invoke({
    message: `Review this code:\n\n${codeResult.message}`,
  });
  console.log(reviewResult.message);

  console.log('\n' + '═'.repeat(50));
  console.log('\n✅ Done! Two agents collaborated across processes.\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
