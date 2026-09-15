const defaultJsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function serializeResponse(body, headers = defaultJsonHeaders) {
  return { body: Buffer.isBuffer(body) ? body : typeof body === 'string' ? body : JSON.stringify(body), headers };
}

function send(response, status, body, headers = defaultJsonHeaders) {
  const payload = serializeResponse(body, headers);
  response.writeHead(status, payload.headers);
  response.end(payload.body);
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

module.exports = { defaultJsonHeaders, serializeResponse, send, readJsonBody };
