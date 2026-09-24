import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChatwootConversationId, normalizeChatwootMessage } from '../lib/chatwoot-webhook.js';

test('accepts only positive numeric Chatwoot conversation IDs', () => {
  assert.equal(normalizeChatwootConversationId(72), '72');
  assert.equal(normalizeChatwootConversationId(' 105 '), '105');
  assert.equal(normalizeChatwootConversationId('0'), '');
  assert.equal(normalizeChatwootConversationId('../accounts'), '');
});

test('normalizes an inbound Chatwoot message webhook', () => {
  const message = normalizeChatwootMessage({
    event: 'message_created',
    id: 501,
    message_type: 'incoming',
    content: 'Urgent vessel delay',
    created_at: 1_700_000_000,
    sender: { email: 'supplier@example.com' },
    conversation: { id: 72 },
  });
  assert.deepEqual(message, {
    conversationId: '72',
    externalMessageId: '501',
    body: 'Urgent vessel delay',
    author: 'supplier@example.com',
    sentAt: 1_700_000_000_000,
  });
});

test('ignores outgoing and incomplete Chatwoot events', () => {
  assert.equal(normalizeChatwootMessage({ event: 'message_created', id: 1, message_type: 'outgoing', content: 'Hello', conversation: { id: 2 } }), null);
  assert.equal(normalizeChatwootMessage({ event: 'message_created', id: 1, message_type: 'incoming', content: '', conversation: { id: 2 } }), null);
  assert.equal(normalizeChatwootMessage({ event: 'conversation_updated' }), null);
});
