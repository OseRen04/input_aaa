import { build } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const out = new URL('../dist/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(new URL('wasm/', out), { recursive: true });

for (const name of ['manifest.json', 'popup.html', 'offscreen.html', 'popup.css']) {
  await copyFile(new URL(`../src/${name}`, import.meta.url), new URL(name, out));
}

for (const name of ['background', 'content', 'offscreen', 'popup']) {
  await build({
    entryPoints: [new URL(`../src/${name}.js`, import.meta.url).pathname],
    outfile: new URL(`${name}.js`, out).pathname,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome116',
    minify: false,
    legalComments: 'none',
    sourcemap: false
  });
}

const wasmSource = join(process.cwd(), 'node_modules', '@wllama', 'wllama', 'esm', 'wasm', 'wllama.wasm');
await copyFile(wasmSource, new URL('wasm/wllama.wasm', out));
console.log('dist/ を作成しました。chrome://extensions から「パッケージ化されていない拡張機能」を読み込みます。');
