import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, providerUrlAllowed, providerStatus, dummyVariables, dummyEnabled, isDummyTarget } from '../lib/providers.js';
import { providerConfig } from '../lib/signature-controls.js';

test('plain HTTP is refused unless dummy mode is on and the host is loopback', () => {
  assert.equal(providerUrlAllowed('https://sign.example.com', {}), true);
  assert.equal(providerUrlAllowed('http://sign.example.com', { DUMMY_PROVIDERS: '1' }), false);
  assert.equal(providerUrlAllowed('http://127.0.0.1:8799/x', {}), false);
  assert.equal(providerUrlAllowed('http://127.0.0.1:8799/x', { DUMMY_PROVIDERS: '0' }), false);
  assert.equal(providerUrlAllowed('http://127.0.0.1:8799/x', { DUMMY_PROVIDERS: '1' }), true);
  assert.equal(providerUrlAllowed('http://localhost:8799/x', { DUMMY_PROVIDERS: '1' }), true);
  assert.equal(providerUrlAllowed('http://user:pw@127.0.0.1/x', { DUMMY_PROVIDERS: '1' }), false);
  assert.equal(providerUrlAllowed('ftp://127.0.0.1/x', { DUMMY_PROVIDERS: '1' }), false);
  assert.equal(providerUrlAllowed('not a url', { DUMMY_PROVIDERS: '1' }), false);
});

test('Documenso config follows the same rule', () => {
  assert.equal(providerConfig({ DOCUMENSO_URL: 'http://127.0.0.1:1/documenso', DOCUMENSO_API_TOKEN: 't' }), null);
  assert.deepEqual(providerConfig({ DUMMY_PROVIDERS: '1', DOCUMENSO_URL: 'http://127.0.0.1:1/documenso', DOCUMENSO_API_TOKEN: 't' }), { base: 'http://127.0.0.1:1/documenso/api/v2', token: 't' });
  assert.ok(providerConfig({ DOCUMENSO_URL: 'https://sign.example.com', DOCUMENSO_API_TOKEN: 't' }));
});

test('dummy variables cover every required variable and point only at the mock', () => {
  const vars = dummyVariables('http://127.0.0.1:8799');
  assert.equal(vars.DUMMY_PROVIDERS, '1');
  for (const provider of PROVIDERS) for (const name of provider.required) assert.ok(vars[name], `${provider.id} ${name}`);
  for (const [name, value] of Object.entries(vars)) if (/URL|BASE|ROOT/.test(name)) assert.ok(value.startsWith('http://127.0.0.1:8799'), `${name}=${value}`);
});

test('status reports dummy, live and unconfigured without leaking values', () => {
  const dummy = providerStatus(dummyVariables('http://127.0.0.1:8799'));
  assert.equal(dummy.dummyMode, true);
  assert.ok(dummy.providers.every(p => p.mode === 'dummy'));
  assert.ok(dummy.warnings.some(w => /simulated/i.test(w)));
  const none = providerStatus({});
  assert.equal(none.dummyMode, false);
  assert.equal(none.providers.find(p => p.id === 'documenso').mode, 'unconfigured');
  assert.deepEqual(none.providers.find(p => p.id === 'documenso').missing, ['DOCUMENSO_URL', 'DOCUMENSO_API_TOKEN']);
  const live = providerStatus({ DOCUMENSO_URL: 'https://sign.example.com', DOCUMENSO_API_TOKEN: 'secret-value' });
  assert.equal(live.providers.find(p => p.id === 'documenso').mode, 'live');
  assert.ok(!JSON.stringify(live).includes('secret-value'));
  assert.ok(!JSON.stringify(live).includes('sign.example.com'));
});

test('loopback URLs without the dummy flag are never treated as dummy', () => {
  const status = providerStatus({ NOVU_API_URL: 'http://127.0.0.1:1', NOVU_API_KEY: 'k', NOVU_WORKFLOW_ID: 'w' });
  assert.equal(status.providers.find(p => p.id === 'novu').mode, 'live');
  assert.equal(dummyEnabled({}), false);
  assert.equal(isDummyTarget('http://127.0.0.1:1', {}), false);
  assert.equal(isDummyTarget('https://api.example.com', { DUMMY_PROVIDERS: '1' }), false);
});

test('a stray dummy flag with live providers raises a warning', () => {
  const status = providerStatus({ DUMMY_PROVIDERS: '1', DOCUMENSO_URL: 'https://sign.example.com', DOCUMENSO_API_TOKEN: 't' });
  assert.ok(status.warnings.some(w => /no provider points at the dummy server/.test(w)));
});

test('docs/GO-LIVE.md lists every provider variable so the swap table cannot drift', async () => {
  const { readFile } = await import('node:fs/promises');
  const doc = await readFile(new URL('../docs/GO-LIVE.md', import.meta.url), 'utf8');
  for (const provider of PROVIDERS) for (const name of [...provider.required, ...provider.optional]) assert.ok(doc.includes(`\`${name}\``), `${name} missing from docs/GO-LIVE.md`);
  assert.ok(doc.includes('DUMMY_PROVIDERS'));
});
