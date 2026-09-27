import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSafeDraft, classifyMessage, normalizeChannel, normalizeParticipants, safeConnector } from '../lib/communications.js';

test('classifies execution and compliance risks as urgent', () => {
  assert.equal(classifyMessage('Urgent: payment is blocked and the vessel is delayed').priority, 'urgent');
  assert.equal(classifyMessage('Cargo is off-spec and buyer may reject it').priority, 'urgent');
});

test('classifies milestones above ordinary correspondence', () => {
  assert.equal(classifyMessage('Please approve the commercial invoice').priority, 'high');
  assert.equal(classifyMessage('Thanks, received').priority, 'normal');
});

test('normalizes channels, participants and connector names', () => {
  assert.equal(normalizeChannel('whatsapp'), 'whatsapp');
  assert.equal(normalizeChannel('email_sandbox'), 'email_sandbox');
  assert.equal(normalizeChannel('sms'), 'internal');
  assert.deepEqual(normalizeParticipants([' A@EXAMPLE.COM ', 'a@example.com', 'bad']), ['a@example.com']);
  assert.equal(safeConnector('CHATWOOT'), 'chatwoot');
  assert.equal(safeConnector('paid-engine'), null);
});

test('safe drafts never accept payment changes without independent verification', () => {
  const draft = buildSafeDraft('Please change the bank account for this invoice immediately.', 'Cargo payment');
  assert.match(draft, /urgent update/i);
  assert.match(draft, /verified through our approved independent channel/i);
  assert.doesNotMatch(draft, /we (?:accept|approve|will pay)/i);
});

import { canAccessThread, prepareThreadParticipants } from '../lib/communications.js';

test('direct and ticket rooms exclude other deal members', () => {
  const direct={threadKind:'direct',channel:'internal',participants:['lawyer@example.com','owner@example.com']};
  assert.equal(canAccessThread(direct,'lawyer@example.com'),true);
  assert.equal(canAccessThread(direct,'captain@example.com'),false);
  assert.equal(canAccessThread(direct,'captain@example.com',true),true);
  assert.equal(canAccessThread({threadKind:'ticket',channel:'internal',participants:[]},'captain@example.com'),false);
  assert.equal(canAccessThread({threadKind:'group',channel:'internal',participants:[]},'captain@example.com'),true);
  assert.equal(canAccessThread({threadKind:'group',channel:'email',participants:[]},'captain@example.com'),false);
});

test('internal direct rooms require a verified active peer', () => {
  const args={available:['captain@example.com','lawyer@example.com'],author:'captain@example.com',kind:'direct',channel:'internal'};
  assert.deepEqual(prepareThreadParticipants({...args,requested:['lawyer@example.com']}),['lawyer@example.com','captain@example.com']);
  assert.throws(()=>prepareThreadParticipants({...args,requested:['outsider@example.com']}));
  assert.throws(()=>prepareThreadParticipants({...args,requested:[]}));
  assert.deepEqual(prepareThreadParticipants({...args,kind:'group',requested:[]}),[]);
  assert.deepEqual(prepareThreadParticipants({...args,kind:'group',channel:'email',requested:[]}),['captain@example.com']);
});
