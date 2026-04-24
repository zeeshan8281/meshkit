#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { createApp } from './create.js';

const program = new Command();

program
  .name('meshkit')
  .description('CLI for meshkit - the Express.js of agent meshes')
  .version('0.1.0');

program
  .command('create <name>')
  .description('Create a new mesh app')
  .option('-t, --template <template>', 'Template to use', 'research-bot')
  .option('--no-install', 'Skip installing dependencies')
  .action(async (name: string, options: { template: string; install: boolean }) => {
    await createApp(name, options);
  });

program
  .command('dev')
  .description('Start the development server with tracing')
  .option('-p, --port <port>', 'Port for trace UI', '4000')
  .action(async (options: { port: string }) => {
    console.log(pc.cyan('Starting meshkit dev server...'));
    console.log(pc.dim(`Trace UI will be available at http://localhost:${options.port}`));
    const { spawn } = await import('node:child_process');
    spawn('npx', ['tsx', 'watch', 'src/index.ts'], {
      stdio: 'inherit',
      env: { ...process.env, MESHKIT_TRACE_PORT: options.port },
    });
  });

program
  .command('trace')
  .description('Open the trace UI')
  .option('-p, --port <port>', 'Port for trace UI', '4000')
  .action(async (options: { port: string }) => {
    const { startTraceServer } = await import('./trace-server.js');
    await startTraceServer(parseInt(options.port));
  });

program.parse();
