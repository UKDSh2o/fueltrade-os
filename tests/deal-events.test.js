import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyUrgency, outboundPolicy } from '../lib/deal-events.js';

test('material payment and sanctions concerns get critical audit severity',()=>{
  assert.equal(classifyUrgency('Bank details changed before payment'),'critical');
  assert.equal(classifyUrgency('Sanctions screening failed'),'critical');
  assert.equal(classifyUrgency('Demurrage deadline approaches'),'urgent');
  assert.equal(classifyUrgency('Daily vessel update'),'normal');
});
test('outbound financial instructions require human approval',()=>{
  assert.equal(outboundPolicy.bankingInstruction,'human-required');
  assert.equal(outboundPolicy.bankDetailChange,'dual-approval');
});
