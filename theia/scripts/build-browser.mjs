import esbuild from 'esbuild';
import { browserOptions } from '../gen-esbuild.browser.mjs';

await esbuild.build(browserOptions);
console.log('Game Vault Theia browser bundle built.');
