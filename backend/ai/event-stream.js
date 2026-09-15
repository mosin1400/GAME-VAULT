// SSE framing is shared by the upstream model and the browser transport.
async function readEventStream(body, receive) {
  const decoder = new TextDecoder();
  let buffer = '';
  function consume(final = false) {
    buffer = buffer.replace(/\r\n/g, '\n');
    let index;
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const lines = frame.split('\n');
      const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || 'message';
      if (data && data !== '[DONE]') receive(JSON.parse(data), event);
    }
    if (final && buffer.trim()) throw new Error('Incomplete event stream');
  }
  for await (const chunk of body) { buffer += decoder.decode(chunk, { stream: true }); consume(); }
  buffer += decoder.decode(); consume(true);
}
module.exports = { readEventStream };
