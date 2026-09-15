function installGracefulShutdown({ processRef = process, server, children = () => [], exit = code => process.exit(code), forceExitAfterMs = 10000 }) {
  let closing = false;
  let timer = null;
  const finish = () => {
    if (timer) clearTimeout(timer);
    exit(0);
  };
  const shutdown = () => {
    if (closing) return;
    closing = true;
    for (const child of children()) {
      if (child && !child.killed && typeof child.kill === 'function') child.kill('SIGTERM');
    }
    if (forceExitAfterMs > 0) timer = setTimeout(() => exit(1), forceExitAfterMs).unref();
    server.close(finish);
  };
  processRef.once('SIGINT', shutdown);
  processRef.once('SIGTERM', shutdown);
  return () => {
    processRef.removeListener('SIGINT', shutdown);
    processRef.removeListener('SIGTERM', shutdown);
  };
}

module.exports = { installGracefulShutdown };
