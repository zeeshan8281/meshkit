#!/usr/bin/env node
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import pc from 'picocolors';
import prompts from 'prompts';

interface CreateOptions {
  template: string;
  install: boolean;
}

const TEMPLATES = {
  'research-bot': {
    description: 'A 3-agent research system (researcher, writer, critic)',
    agents: ['researcher', 'writer', 'critic'],
  },
  'code-review': {
    description: 'Code review pipeline (analyzer, reviewer, summarizer)',
    agents: ['analyzer', 'reviewer', 'summarizer'],
  },
  'minimal': {
    description: 'Minimal single-agent setup',
    agents: ['assistant'],
  },
};

export async function createApp(name: string, options: CreateOptions): Promise<void> {
  const targetDir = join(process.cwd(), name);

  console.log(pc.cyan(`\n🕸️  Creating meshkit app: ${pc.bold(name)}\n`));

  const existingFiles = await readdir(process.cwd()).catch(() => [] as string[]);
  if (existingFiles.includes(name)) {
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `Directory ${name} already exists. Overwrite?`,
      initial: false,
    });
    if (!overwrite) {
      console.log(pc.red('Aborted.'));
      return;
    }
  }

  const template = TEMPLATES[options.template as keyof typeof TEMPLATES] ?? TEMPLATES['research-bot'];

  await mkdir(targetDir, { recursive: true });
  await mkdir(join(targetDir, 'src', 'agents'), { recursive: true });

  const packageJson = {
    name,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      meshkit: '^0.1.0',
      '@zeeshan8281/mcp': '^0.1.0',
    },
    devDependencies: {
      '@types/node': '^22.10.0',
      tsx: '^4.19.0',
      typescript: '^5.7.0',
    },
  };

  await writeFile(
    join(targetDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2022'],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: './dist',
      rootDir: './src',
    },
    include: ['src/**/*'],
  };

  await writeFile(
    join(targetDir, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  );

  for (const agentName of template.agents) {
    const agentCode = generateAgentCode(agentName, options.template);
    await writeFile(
      join(targetDir, 'src', 'agents', `${agentName}.ts`),
      agentCode
    );
  }

  const indexCode = generateIndexCode(template.agents, options.template);
  await writeFile(join(targetDir, 'src', 'index.ts'), indexCode);

  const envExample = `# LLM Provider API Keys
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key

# Optional: MCP server configurations
# EXA_API_KEY=your-exa-key
`;

  await writeFile(join(targetDir, '.env.example'), envExample);

  const gitignore = `node_modules
dist
.env
*.log
`;

  await writeFile(join(targetDir, '.gitignore'), gitignore);

  console.log(pc.green('✓ Created project structure'));

  if (options.install) {
    console.log(pc.cyan('\nInstalling dependencies...\n'));
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('npm', ['install'], {
        cwd: targetDir,
        stdio: 'inherit',
      });
      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`npm install failed with code ${code}`));
      });
    });
    console.log(pc.green('✓ Dependencies installed'));
  }

  console.log(pc.cyan('\n🎉 Done! Next steps:\n'));
  console.log(pc.dim(`  cd ${name}`));
  if (!options.install) {
    console.log(pc.dim('  npm install'));
  }
  console.log(pc.dim('  cp .env.example .env'));
  console.log(pc.dim('  # Add your API keys to .env'));
  console.log(pc.dim('  npm run dev'));
  console.log();
}

function generateAgentCode(name: string, template: string): string {
  const prompts: Record<string, Record<string, string>> = {
    'research-bot': {
      researcher: `You are a research agent. Your job is to find accurate, relevant information on any topic.
When given a research task, search for facts, cite sources when possible, and provide comprehensive findings.
Be thorough but concise.`,
      writer: `You are a writing agent. Your job is to take research findings and compose clear, engaging content.
Transform raw information into well-structured prose. Adapt your tone to the audience.
Focus on clarity and readability.`,
      critic: `You are a critic agent. Your job is to review content for accuracy, clarity, and completeness.
Identify gaps, suggest improvements, and flag any issues.
Be constructive but thorough in your feedback.`,
    },
    'code-review': {
      analyzer: `You are a code analyzer. Extract key patterns, dependencies, and structure from code.
Identify complexity hotspots and potential issues.`,
      reviewer: `You are a code reviewer. Review code for best practices, bugs, security issues, and maintainability.
Provide specific, actionable feedback.`,
      summarizer: `You are a summarizer. Condense review findings into clear, prioritized recommendations.
Focus on the most impactful improvements.`,
    },
    minimal: {
      assistant: `You are a helpful AI assistant. Answer questions clearly and accurately.`,
    },
  };

  const systemPrompt = prompts[template]?.[name] ?? `You are a ${name} agent.`;

  return `import { defineAgent } from '@zeeshan8281/meshkit';

export const ${name} = defineAgent({
  name: '${name}',
  model: 'claude-sonnet-4-6',
  systemPrompt: \`${systemPrompt}\`,
  temperature: 0.7,
});
`;
}

function generateIndexCode(agents: string[], template: string): string {
  const imports = agents.map(a => `import { ${a} } from './agents/${a}.js';`).join('\n');
  const agentList = agents.join(', ');

  const description = template === 'minimal'
    ? 'Run the assistant directly'
    : 'Create the mesh with hub-and-spoke topology';

  return `import { createMesh, hubAndSpoke, createOrchestratorAgent, trace } from '@zeeshan8281/meshkit';
${imports}

// Enable tracing
trace.enable({ exportFormat: 'console' });

// Create orchestrator agent
const orchestrator = createOrchestratorAgent('claude-sonnet-4-6');

// ${description}
const mesh = createMesh({
  topology: hubAndSpoke({ orchestrator }),
  agents: [${agentList}],
});

// Example: Run a query
async function main() {
  console.log('🕸️  meshkit is running...\\n');

  const result = await mesh.run('${template === 'research-bot'
    ? 'Research the latest developments in AI agents and write a brief summary'
    : template === 'code-review'
    ? 'Review this code snippet for best practices'
    : 'Hello, how can you help me today?'}');

  console.log('\\n📝 Result:\\n');
  console.log(result.output);
  console.log('\\n📊 Stats:');
  console.log(\`  Steps: \${result.steps.length}\`);
  console.log(\`  Tokens: \${result.totalTokens.inputTokens} in / \${result.totalTokens.outputTokens} out\`);
  console.log(\`  Duration: \${result.durationMs}ms\`);
}

main().catch(console.error);
`;
}

if (process.argv[1]?.endsWith('create.js') || process.argv[1]?.endsWith('create.ts')) {
  const name = process.argv[2];
  if (!name) {
    console.error(pc.red('Please provide a project name: npx create-mesh-app <name>'));
    process.exit(1);
  }
  createApp(name, { template: 'research-bot', install: true });
}
