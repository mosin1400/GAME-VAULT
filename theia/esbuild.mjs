/**
 * This file can be edited to adjust the ESBuild build process.
 * To reset, delete this file and rerun theia build again.
 */
import { browserOptions, watch } from './gen-esbuild.browser.mjs';
import { nodeOptions } from './gen-esbuild.node.mjs';

import esbuild from 'esbuild';

const browserContext = await esbuild.context(browserOptions);
// Keep this optional Windows native certificate provider a runtime dependency.
// Bundling it otherwise requires a platform-specific .node binary at build time.
const optionalWindowsCertificates = { name: 'optional-windows-cert-provider', setup(build) {
    build.onResolve({ filter: /^@vscode\/windows-ca-certs$/ }, args => ({ path: args.path, external: true }));
} };
const nodeContext = await esbuild.context({ ...nodeOptions, external: [...(nodeOptions.external || []), '@vscode/windows-ca-certs'], plugins: [optionalWindowsCertificates, ...(nodeOptions.plugins || [])] });


if (watch) {
    await Promise.all([
        browserContext.watch(),
        nodeContext.watch(),
    ]);
} else {
    try {
        await browserContext.rebuild();
        await browserContext.dispose();
        await nodeContext.rebuild();
        await nodeContext.dispose();
    } catch {
        process.exit(1);
    }
}
