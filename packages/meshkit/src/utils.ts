import type { ZodType } from 'zod';

export function zodToJsonSchema(schema: ZodType<unknown>): Record<string, unknown> {
  const def = (schema as { _def?: { typeName?: string; shape?: () => Record<string, ZodType<unknown>>; innerType?: ZodType<unknown>; options?: ZodType<unknown>[]; values?: string[]; minLength?: number; maxLength?: number } })._def;

  if (!def) {
    return { type: 'object' };
  }

  const typeName = def.typeName;

  switch (typeName) {
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodArray':
      return {
        type: 'array',
        items: def.innerType ? zodToJsonSchema(def.innerType) : {},
      };
    case 'ZodObject': {
      const shape = def.shape?.() ?? {};
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value);
        const valueDef = (value as { _def?: { typeName?: string } })._def;
        if (valueDef?.typeName !== 'ZodOptional') {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }
    case 'ZodOptional':
      return def.innerType ? zodToJsonSchema(def.innerType) : {};
    case 'ZodEnum':
      return {
        type: 'string',
        enum: def.values,
      };
    case 'ZodUnion':
      return {
        oneOf: def.options?.map(opt => zodToJsonSchema(opt)) ?? [],
      };
    default:
      return { type: 'object' };
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
