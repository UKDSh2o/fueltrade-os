import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentEvidenceDecision, paymentEvidenceGate } from '../lib/payment-evidence-controls.js';

test('execution evidence requires an exact approved instruction and document match', () => {
  const instruction = { status: 'approved', amountCents: 125000, currency: 'USD' };
  const document = { status: 'approved', category: 'Bank payment confirmation' };
  assert.equal(paymentEvidenceGate({ instruction, document, amountCents: 125000, currency: 'usd' }).allowed, true);
  assert.equal(paymentEvidenceGate({ instruction: { ...instruction, status: 'draft' }, document, amountCents: 125000, currency: 'USD' }).allowed, false);
  assert.equal(paymentEvidenceGate({ instruction, document, amountCents: 125001, currency: 'USD' }).allowed, false);
  assert.equal(paymentEvidenceGate({ instruction, document: { status: 'approved', category: 'Inspection report' }, amountCents: 125000, currency: 'USD' }).allowed, false);
});

test('execution evidence needs independent confirmation', () => {
  assert.equal(paymentEvidenceDecision('actor-a', 'actor-a', 'confirmed').allowed, false);
  assert.deepEqual(paymentEvidenceDecision('actor-a', 'actor-b', 'confirmed'), { allowed: true, status: 'confirmed' });
  assert.equal(paymentEvidenceDecision('actor-a', 'actor-a', 'rejected').allowed, true);
});
