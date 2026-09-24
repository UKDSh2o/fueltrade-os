import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNovuTrigger, notificationRecipients } from '../lib/novu.js';

test('normalizes and deduplicates Novu email recipients', () => {
  assert.deepEqual(notificationRecipients(['Ops@Example.com', 'ops@example.com', 'bad', 'risk@example.com']), ['ops@example.com', 'risk@example.com']);
});

test('builds an idempotent self-hosted Novu trigger', () => {
  const request = buildNovuTrigger({ workflowId: 'urgent-deal-message', recipients: ['ops@example.com'], title: 'Vessel delay', message: 'ETA changed', severity: 'critical', reference: 'TRD-100', transactionId: 'communication:123' });
  assert.equal(request.name, 'urgent-deal-message');
  assert.equal(request.transactionId, 'communication:123');
  assert.deepEqual(request.to, [{ subscriberId: 'ops@example.com', email: 'ops@example.com' }]);
  assert.equal(request.payload.tradeReference, 'TRD-100');
});
