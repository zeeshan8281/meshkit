import type { Mesh, MeshConfig, MeshResult } from './types.js';
import { trace } from './trace.js';

export function createMesh(config: MeshConfig): Mesh {
  const { topology, agents, trace: traceConfig } = config;

  if (traceConfig?.enabled !== false) {
    trace.enable(traceConfig);
  }

  const run = async (
    input: string | { message: string; context?: Record<string, unknown> }
  ): Promise<MeshResult> => {
    const message = typeof input === 'string' ? input : input.message;
    const context = typeof input === 'string' ? undefined : input.context;

    const inputWithContext = context
      ? `${message}\n\nContext: ${JSON.stringify(context)}`
      : message;

    return topology.execute(inputWithContext, agents);
  };

  return {
    run,
    agents,
    topology,
  };
}
