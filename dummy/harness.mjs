// Boots the mock providers and the real built app on a fresh local D1/R2. Shared by e2e.mjs and ui-smoke.mjs.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockProviders } from './mock-providers.mjs';
import { dummyVariables } from '../lib/providers.js';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js'];

async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise(r => setTimeout(r, 500)); }
  throw new Error(`Timed out waiting for ${url}`);
}

/** dummy:false boots the app with no provider variables at all (a production-like, unconfigured run). */
export async function startStack({ appPort = 8788, mockPort = 8799, dummy = true } = {}) {
  const stateDir = mkdtempSync(path.join(tmpdir(), 'fueltrade-e2e-'));
  const { server } = createMockProviders();
  await new Promise(resolve => server.listen(mockPort, '127.0.0.1', resolve));
  const appUrl = `http://127.0.0.1:${appPort}`, mockUrl = `http://127.0.0.1:${mockPort}`;
  for (const file of readdirSync(path.join(root, 'drizzle')).filter(f => f.endsWith('.sql')).sort()) {
    const r = spawnSync('node', [...wrangler, 'd1', 'execute', 'DB', '--local', '--config', 'dist/server/wrangler.json', '--persist-to', stateDir, '--file', `drizzle/${file}`], { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) { server.close(); throw new Error(`Migration ${file} failed:\n${r.stdout}\n${r.stderr}`); }
  }
  const vars = dummy ? Object.entries(dummyVariables(mockUrl)).flatMap(([k, v]) => ['--var', `${k}:${v}`]) : [];
  const app = spawn('node', [...wrangler, 'dev', '--config', 'dist/server/wrangler.json', '--local', '--persist-to', stateDir, '--ip', '127.0.0.1', '--port', String(appPort), '--inspector-port', '0', ...vars], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; app.stdout.on('data', d => { log += d; }); app.stderr.on('data', d => { log += d; });
  try { await waitFor(`${appUrl}/api/providers`); } catch (error) { app.kill('SIGTERM'); server.close(); throw new Error(`${error.message}\n${log.split('\n').slice(-20).join('\n')}`); }
  return { appUrl, mockUrl, stateDir, log: () => log, stop: () => { app.kill('SIGTERM'); server.close(); } };
}
