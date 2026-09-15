// Trusted, administrator-approved JavaScript only. A process is not a security sandbox.
process.once('message', async ({ code, items, params, credential, vars }) => {
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction('$items', '$params', '$credential', '$vars', 'console', code);
    const output = await fn(items, params, credential, vars, { log() {}, warn() {}, error() {} });
    process.send({ ok: true, output }, () => process.exit(0));
  } catch { process.send({ ok: false }, () => process.exit(1)); }
});
