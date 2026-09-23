import test from 'node:test';
import assert from 'node:assert/strict';
import { eventTypes, createDealEvent, classifyUrgency, suggestedActions, outboundPolicy } from '../src/dealEvents.js';

test('creates an auditable event linked to a deal',()=>{
 const e=createDealEvent({dealId:'FT-001',type:eventTypes.MESSAGE,actor:'trader',summary:'Cargo update'});
 assert.equal(e.dealId,'FT-001'); assert.equal(e.type,'message'); assert.ok(e.createdAt);
});
test('rejects malformed deal events',()=>{
 assert.throws(()=>createDealEvent({type:eventTypes.MESSAGE,summary:'x'}),/dealId/);
 assert.throws(()=>createDealEvent({dealId:'X',type:'unknown',summary:'x'}),/unsupported/);
});
test('detects urgent and critical trade communications',()=>{
 assert.equal(classifyUrgency('URGENT: LC expires tomorrow'),'urgent');
 assert.equal(classifyUrgency('Warning: bank details changed'),'critical');
 assert.equal(classifyUrgency('Thanks for the update'),'normal');
});
test('email events generate extraction actions',()=>{
 const e={type:eventTypes.EMAIL,summary:'Deadline tomorrow'};
 const actions=suggestedActions(e);
 assert.ok(actions.some(x=>x.type==='extract'));
 assert.ok(actions.some(x=>x.type==='notify'));
});
test('bank detail changes require dual approval',()=>{
 assert.equal(outboundPolicy.bankDetailChange.approval,'dual-approval');
});
