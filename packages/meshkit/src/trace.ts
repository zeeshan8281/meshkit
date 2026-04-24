import { randomUUID } from 'node:crypto';
import type { TraceConfig } from './types.js';

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, unknown>;
  status: 'running' | 'ok' | 'error';
}

interface TraceState {
  enabled: boolean;
  config: TraceConfig;
  currentTraceId: string | null;
  spans: Map<string, Span>;
  completedSpans: Span[];
}

const state: TraceState = {
  enabled: false,
  config: {},
  currentTraceId: null,
  spans: new Map(),
  completedSpans: [],
};

export const trace = {
  enable(opts?: TraceConfig) {
    state.enabled = true;
    state.config = opts ?? {};
  },

  disable() {
    state.enabled = false;
  },

  startTrace(): string {
    const traceId = randomUUID();
    state.currentTraceId = traceId;
    state.spans.clear();
    state.completedSpans = [];
    return traceId;
  },

  endTrace(): { traceId: string; spans: Span[] } | null {
    if (!state.currentTraceId) return null;

    const result = {
      traceId: state.currentTraceId,
      spans: [...state.completedSpans],
    };

    if (state.config.exportFormat === 'console') {
      console.log('\n--- Trace Summary ---');
      console.log(`Trace ID: ${result.traceId}`);
      for (const span of result.spans) {
        const duration = span.endTime ? span.endTime - span.startTime : 0;
        const indent = span.parentSpanId ? '  ' : '';
        const status = span.status === 'error' ? '✗' : '✓';
        console.log(`${indent}${status} ${span.name} (${duration}ms)`);
      }
      console.log('-------------------\n');
    }

    state.currentTraceId = null;
    return result;
  },

  startSpan(opts: {
    spanId: string;
    parentSpanId?: string;
    name: string;
    attributes?: Record<string, unknown>;
  }) {
    if (!state.enabled) return;

    const span: Span = {
      traceId: state.currentTraceId ?? randomUUID(),
      spanId: opts.spanId,
      parentSpanId: opts.parentSpanId,
      name: opts.name,
      startTime: Date.now(),
      attributes: opts.attributes ?? {},
      status: 'running',
    };

    state.spans.set(opts.spanId, span);
  },

  endSpan(spanId: string, attributes?: Record<string, unknown>) {
    if (!state.enabled) return;

    const span = state.spans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.status = attributes?.error ? 'error' : 'ok';
    if (attributes) {
      span.attributes = { ...span.attributes, ...attributes };
    }

    state.spans.delete(spanId);
    state.completedSpans.push(span);
  },

  getSpans(): Span[] {
    return [...state.completedSpans];
  },

  export(format: 'otlp' | 'json' | 'console' = 'json') {
    const spans = [...state.completedSpans];

    if (format === 'json') {
      return JSON.stringify({
        traceId: state.currentTraceId,
        spans: spans.map(s => ({
          ...s,
          durationMs: s.endTime ? s.endTime - s.startTime : undefined,
        })),
      }, null, 2);
    }

    if (format === 'otlp') {
      return {
        resourceSpans: [{
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: state.config.serviceName ?? 'meshkit' } },
            ],
          },
          scopeSpans: [{
            scope: { name: 'meshkit' },
            spans: spans.map(s => ({
              traceId: s.traceId,
              spanId: s.spanId,
              parentSpanId: s.parentSpanId,
              name: s.name,
              startTimeUnixNano: s.startTime * 1_000_000,
              endTimeUnixNano: (s.endTime ?? s.startTime) * 1_000_000,
              attributes: Object.entries(s.attributes).map(([k, v]) => ({
                key: k,
                value: { stringValue: String(v) },
              })),
              status: { code: s.status === 'error' ? 2 : 1 },
            })),
          }],
        }],
      };
    }

    for (const span of spans) {
      const duration = span.endTime ? span.endTime - span.startTime : 0;
      const indent = span.parentSpanId ? '  ' : '';
      const status = span.status === 'error' ? '✗' : '✓';
      console.log(`${indent}${status} ${span.name} (${duration}ms)`);
    }

    return null;
  },
};
