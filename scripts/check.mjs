import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const base = new URL('../src/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('Manifest V3 required');
if (manifest.permissions.includes('tabs')) throw new Error('Unnecessary broad tabs permission');
if (manifest.content_scripts) throw new Error('No always-on content scripts permitted');
if (manifest.host_permissions.includes('<all_urls>')) throw new Error('Broad host permission not permitted');
async function scan(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) await scan(path);
    else if (/\.(mjs|js)$/.test(item.name)) {
      execFileSync(process.execPath, ['--check', path]);
    }
  }
}
await scan(base.pathname);
console.log('Manifest, permissions, JavaScript syntax: OK');
