import esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { browserOptions } from '../gen-esbuild.browser.mjs';

await esbuild.build(browserOptions);
await esbuild.build({ entryPoints: [fileURLToPath(new URL('../../frontend/scripts/markdown-entry.js', import.meta.url))], outfile: fileURLToPath(new URL('../../frontend/scripts/markdown.js', import.meta.url)), bundle: true, minify: true, platform: 'browser' });
console.log('Game Vault Theia browser bundle built.');
