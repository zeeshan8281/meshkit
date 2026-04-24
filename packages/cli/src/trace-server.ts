import { createServer } from 'node:http';
import pc from 'picocolors';

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>meshkit Trace UI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      padding: 2rem;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: #fff;
    }
    .trace-container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .trace {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
    }
    .trace-header {
      background: #222;
      padding: 1rem;
      border-bottom: 1px solid #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .trace-id {
      font-family: monospace;
      font-size: 0.85rem;
      color: #888;
    }
    .span {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #222;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .span:last-child { border-bottom: none; }
    .span.child { padding-left: 2.5rem; }
    .span-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .span-status.ok { background: #22c55e; }
    .span-status.error { background: #ef4444; }
    .span-status.running { background: #f59e0b; animation: pulse 1s infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .span-name {
      flex: 1;
      font-family: monospace;
      font-size: 0.9rem;
    }
    .span-duration {
      font-size: 0.85rem;
      color: #888;
    }
    .span-tokens {
      font-size: 0.8rem;
      color: #666;
    }
    .empty {
      text-align: center;
      padding: 3rem;
      color: #666;
    }
    .refresh-btn {
      background: #333;
      border: 1px solid #444;
      color: #fff;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .refresh-btn:hover { background: #444; }
  </style>
</head>
<body>
  <div class="trace-container">
    <h1>🕸️ meshkit Trace UI</h1>
    <div id="traces">
      <div class="empty">No traces yet. Run your mesh to see traces here.</div>
    </div>
    <button class="refresh-btn" onclick="location.reload()">Refresh</button>
  </div>
  <script>
    async function loadTraces() {
      try {
        const res = await fetch('/api/traces');
        const traces = await res.json();
        if (traces.length === 0) return;

        const container = document.getElementById('traces');
        container.innerHTML = traces.map(trace => \`
          <div class="trace">
            <div class="trace-header">
              <span>Trace</span>
              <span class="trace-id">\${trace.traceId}</span>
            </div>
            \${trace.spans.map(span => \`
              <div class="span \${span.parentSpanId ? 'child' : ''}">
                <div class="span-status \${span.status}"></div>
                <div class="span-name">\${span.name}</div>
                <div class="span-duration">\${span.durationMs ?? 0}ms</div>
                \${span.attributes['tokens.input'] ? \`
                  <div class="span-tokens">\${span.attributes['tokens.input']} / \${span.attributes['tokens.output']} tokens</div>
                \` : ''}
              </div>
            \`).join('')}
          </div>
        \`).join('');
      } catch (e) {
        console.error('Failed to load traces:', e);
      }
    }
    loadTraces();
    setInterval(loadTraces, 2000);
  </script>
</body>
</html>`;

const traces: unknown[] = [];

export async function startTraceServer(port: number): Promise<void> {
  const server = createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(HTML_TEMPLATE);
      return;
    }

    if (req.url === '/api/traces') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(traces));
      return;
    }

    if (req.url === '/api/traces' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const trace = JSON.parse(body);
          traces.unshift(trace);
          if (traces.length > 100) traces.pop();
          res.writeHead(200);
          res.end('ok');
        } catch {
          res.writeHead(400);
          res.end('invalid json');
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  server.listen(port, () => {
    console.log(pc.cyan(`\n🕸️  meshkit Trace UI running at ${pc.bold(`http://localhost:${port}`)}\n`));
  });
}
