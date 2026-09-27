import test from 'node:test';
import assert from 'node:assert/strict';
import { canSeeNotification } from '../lib/notification-visibility.js';

const access={isOwner:false,permissions:{trade:'view',comments:'view',finance:'none',insurance:'none'}};
test('financial events are hidden from a trade-only participant',()=>{
  assert.equal(canSeeNotification({category:'finance'},access,'captain@example.com'),false);
  assert.equal(canSeeNotification({category:'sourcing'},access,'captain@example.com'),true);
});
test('direct room alerts require thread participation',()=>{
  const event={category:'communications',eventKey:'communication:message-1'};
  const threads=new Map([['message-1',{threadKind:'direct',channel:'internal',participants:['lawyer@example.com']}]]);
  assert.equal(canSeeNotification(event,access,'captain@example.com',threads),false);
  assert.equal(canSeeNotification(event,access,'lawyer@example.com',threads),true);
  assert.equal(canSeeNotification(event,access,'lawyer@example.com'),false);
  assert.equal(canSeeNotification(event,{isOwner:true,permissions:{}},'owner@example.com'),true);
});
