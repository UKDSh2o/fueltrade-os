import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardForRole, integrationRegistry, communicationChannels } from '../src/workspace.js';

test('trader dashboard includes messaging and full deal', () => {
  const ids=dashboardForRole('trader').map(x=>x.id);
  assert.ok(ids.includes('messaging'));
  assert.ok(ids.includes('full-deal'));
});

test('captain receives operational dashboard rather than finance defaults', () => {
  const ids=dashboardForRole('captain').map(x=>x.id);
  assert.ok(ids.includes('voyage'));
  assert.ok(ids.includes('cargo'));
  assert.ok(!ids.includes('banking'));
});

test('custom permitted tiles are de-duplicated and unknown tiles ignored', () => {
  const ids=dashboardForRole('legal',['messaging','insurance','does-not-exist']).map(x=>x.id);
  assert.equal(ids.filter(x=>x==='messaging').length,1);
  assert.ok(ids.includes('insurance'));
  assert.ok(!ids.includes('does-not-exist'));
});

test('communications registry exposes native and adapter channels', () => {
  assert.ok(communicationChannels.some(x=>x.id==='internal' && x.mode==='native'));
  assert.ok(communicationChannels.some(x=>x.id==='email'));
  assert.ok(communicationChannels.some(x=>x.id==='video'));
});

test('integration registry contains open source realtime option', () => {
  assert.ok(integrationRegistry.some(x=>x.id==='livekit' && x.cost==='open-source'));
});
