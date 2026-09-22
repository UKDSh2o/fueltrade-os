import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTrade, riskLevel } from '../src/calculate.js';

const trade = { volumeMt:1000,buyPrice:700,sellPrice:800,freight:20,insurancePct:1,inspection:2,port:3,storage:4,trucking:1,legal:0,financePct:0,contingencyPct:0,days:30 };

test('calculates full landed economics', () => {
  const r = calculateTrade(trade);
  assert.equal(r.buyValue,700000); assert.equal(r.insurance,7000); assert.equal(r.operatingCosts,30000); assert.equal(r.totalCost,737000); assert.equal(r.netProfit,63000); assert.equal(r.unitCost,737);
});
test('handles zero-volume trades safely', () => { const r=calculateTrade({...trade,volumeMt:0}); assert.equal(r.unitCost,0); assert.equal(r.unitMargin,0); assert.ok(Number.isFinite(r.roiPct)); });
test('flags thin-margin trades without contingency as high risk', () => { const r=calculateTrade({...trade,sellPrice:738}); assert.equal(riskLevel(trade,r).label,'High'); });
