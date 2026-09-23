import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardRoles, dashboardTiles, normalizeDashboardTiles } from '../lib/dashboard-layout.js';

test('each role default opens an existing workspace section',()=>{
  for(const [role,definition] of Object.entries(dashboardRoles)){
    assert.deepEqual(normalizeDashboardTiles(role),definition.defaults);
    assert.ok(definition.defaults.every(id=>definition.allowed.includes(id)&&dashboardTiles[id]?.anchor));
  }
});
test('layout customization removes duplicate, unknown and unauthorized modules',()=>{
  assert.deepEqual(normalizeDashboardTiles('captain',['vessel','vessel','finance','made-up','documents']),['vessel','documents']);
  assert.throws(()=>normalizeDashboardTiles('unknown',[]));
});
