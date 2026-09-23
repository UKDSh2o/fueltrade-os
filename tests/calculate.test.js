import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTrade, riskLevel } from '../app/calculate.js';
import { initialTrade } from '../app/data.js';

test('landed profit includes freight, insurance, finance, legal and contingency',()=>{
  const result=calculateTrade(initialTrade);
  assert.ok(result.netProfit>0);
  assert.ok(result.totalCost>result.buyValue);
  assert.equal(result.revenue-result.totalCost,result.netProfit);
});
test('zero volume does not create infinite unit economics',()=>{
  const result=calculateTrade({...initialTrade,volumeMt:0});
  assert.equal(result.unitCost,0);
  assert.equal(result.netMarginPct,0);
});
test('thin margin escalates risk',()=>{
  const loss=calculateTrade({...initialTrade,sellPrice:initialTrade.buyPrice});
  assert.equal(riskLevel(initialTrade,loss).label,'Moderate');
});
