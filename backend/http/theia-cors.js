const theiaOrigin = 'http://127.0.0.1:3010';
const localhostTheiaOrigin = 'http://localhost:3010';
const allowedOrigins = new Set([theiaOrigin, localhostTheiaOrigin]);

function applyTheiaCors(request, response) {
  const origin = request.headers.origin;
  if (!allowedOrigins.has(origin)) return false;
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'content-type, x-gv-studio-token');
  return request.method === 'OPTIONS';
}

module.exports = { theiaOrigin, localhostTheiaOrigin, applyTheiaCors };
