const http = require('node:http');
function createStudioProxy({ port = 8081 } = {}) {
  return (req, res) => {
    if (!req.url.startsWith('/api/')) { res.writeHead(404); res.end('Not found'); return; }
    const parsedBody = req.body === undefined ? null : Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const headers = { ...req.headers, host: `127.0.0.1:${port}` };
    // Theia's Express JSON middleware may already have consumed the stream.
    // Forward the parsed body with its actual length instead of piping an empty
    // stream while retaining the old Content-Length (which hangs DELETE/POST).
    if (parsedBody) { headers['content-length'] = String(parsedBody.length); delete headers['transfer-encoding']; }
    const upstream = http.request({ hostname: '127.0.0.1', port, path: req.url, method: req.method, headers }, response => {
      res.writeHead(response.statusCode, response.headers); response.pipe(res);
    });
    upstream.setTimeout(180000, () => upstream.destroy(new Error('Studio API timeout')));
    upstream.on('error', () => {
      if (!res.headersSent) { res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'Dashboard API is unavailable. Open the dashboard on port 8081.' })); }
      else res.destroy();
    });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    if (parsedBody) upstream.end(parsedBody); else req.pipe(upstream);
  };
}
module.exports = { createStudioProxy };
