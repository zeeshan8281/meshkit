import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  attributes: Record<string, unknown>;
  status: 'running' | 'ok' | 'error';
}

interface Trace {
  traceId: string;
  spans: Span[];
}

const traces: Trace[] = [];

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>meshkit Trace UI</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --surface: #141414;
      --border: #262626;
      --text: #fafafa;
      --text-muted: #a1a1aa;
      --accent: #3b82f6;
      --success: #22c55e;
      --error: #ef4444;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 1.5rem; }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .badge {
      font-size: 0.75rem;
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      color: var(--text-muted);
    }
    .trace {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
    }
    .trace-header {
      padding: 0.75rem 1rem;
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .trace-id {
      font-family: ui-monospace, monospace;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .trace-meta {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .spans { padding: 0.5rem 0; }
    .span {
      padding: 0.5rem 1rem;
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.875rem;
    }
    .span:hover { background: rgba(255,255,255,0.02); }
    .span.nested { padding-left: 2.5rem; }
    .span.nested-2 { padding-left: 4rem; }
    .status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .status.ok { background: var(--success); }
    .status.error { background: var(--error); }
    .status.running { background: var(--warning); animation: pulse 1s infinite; }
    @keyframes pulse { 50% { opacity: 0.5; } }
    .span-name {
      font-family: ui-monospace, monospace;
      font-size: 0.85rem;
    }
    .span-duration {
      font-size: 0.8rem;
      color: var(--text-muted);
      text-align: right;
      min-width: 60px;
    }
    .span-tokens {
      font-size: 0.75rem;
      color: var(--text-muted);
      min-width: 100px;
      text-align: right;
    }
    .empty {
      text-align: center;
      padding: 4rem 2rem;
      color: var(--text-muted);
    }
    .empty-icon { font-size: 2rem; margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🕸️ meshkit traces</h1>
      <span class="badge" id="count">0 traces</span>
    </header>
    <div id="traces">
      <div class="empty">
        <div class="empty-icon">📭</div>
        <p>No traces yet. Run your mesh to see traces here.</p>
      </div>
    </div>
  </div>
  <script>
    async function load() {
      const res = await fetch('/api/traces');
      const data = await res.json();
      document.getElementById('count').textContent = data.length + ' trace' + (data.length !== 1 ? 's' : '');
      if (!data.length) return;
      document.getElementById('traces').innerHTML = data.map(t => \`
        <div class="trace">
          <div class="trace-header">
            <span class="trace-id">\${t.traceId.slice(0, 8)}</span>
            <span class="trace-meta">\${t.spans.length} spans</span>
          </div>
          <div class="spans">
            \${t.spans.map(s => {
              const nested = s.parentSpanId ? (s.name.includes('tool.') ? 'nested-2' : 'nested') : '';
              const tokens = s.attributes['tokens.input'] ? \`\${s.attributes['tokens.input']} / \${s.attributes['tokens.output']}\` : '';
              return \`
                <div class="span \${nested}">
                  <div class="status \${s.status}"></div>
                  <div class="span-name">\${s.name}</div>
                  <div class="span-tokens">\${tokens}</div>
                  <div class="span-duration">\${s.durationMs ?? 0}ms</div>
                </div>
              \`;
            }).join('')}
          </div>
        </div>
      \`).join('');
    }
    load();
    setInterval(load, 2000);
  </script>
</body>
</html>`;

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.url === '/' || req.url === '') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML);
    return;
  }

  if (req.url === '/api/traces' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(traces));
    return;
  }

  if (req.url === '/api/traces' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const trace = JSON.parse(body) as Trace;
        traces.unshift(trace);
        if (traces.length > 100) traces.pop();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

export function createTraceServer(port = 4000): ReturnType<typeof createServer> {
  const server = createServer(handleRequest);
  server.listen(port, () => {
    console.log(`🕸️  meshkit Trace UI: http://localhost:${port}`);
  });
  return server;
}

export function addTrace(trace: Trace): void {
  traces.unshift(trace);
  if (traces.length > 100) traces.pop();
}

export function getTraces(): Trace[] {
  return [...traces];
}

export function clearTraces(): void {
  traces.length = 0;
}
