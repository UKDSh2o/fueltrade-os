import test from 'node:test';
import assert from 'node:assert/strict';
import { bankChangeDecision, canApprovePaymentInstruction, maskAccountReference, requiresFinanceApproval } from '../lib/finance-controls.js';

test('operative plans and released milestones require approval authority', () => {
  assert.equal(requiresFinanceApproval('operative', []), true);
  assert.equal(requiresFinanceApproval('requested', [{ status: 'released' }]), true);
  assert.equal(requiresFinanceApproval('requested', [{ status: 'due' }]), false);
});

test('bank-detail approval requires a distinct second actor', () => {
  const first = bankChangeDecision({ status: 'pending' }, 'user-a', 'approve');
  assert.deepEqual(first, { allowed: true, nextStatus: 'first_approved', stage: 'first' });
  const repeat = bankChangeDecision({ status: 'first_approved', firstApprovedBy: 'user-a' }, 'user-a', 'approve');
  assert.equal(repeat.allowed, false);
  const second = bankChangeDecision({ status: 'first_approved', firstApprovedBy: 'user-a' }, 'user-b', 'approve');
  assert.equal(second.nextStatus, 'approved');
});

test('bank-detail requester cannot approve their own request', () => {
  const result = bankChangeDecision({ status: 'pending', createdBy: 'requester' }, 'requester', 'approve');
  assert.equal(result.allowed, false);
});

test('payment instruction approval needs trade and bank-detail approvals', () => {
  assert.equal(canApprovePaymentInstruction({ financeApprovalStatus: 'pending', bankChangeStatus: 'approved' }).allowed, false);
  assert.equal(canApprovePaymentInstruction({ financeApprovalStatus: 'approved', bankChangeStatus: 'first_approved' }).allowed, false);
  assert.equal(canApprovePaymentInstruction({ financeApprovalStatus: 'approved', bankChangeStatus: 'approved' }).allowed, true);
});

test('account references are reduced to a last-four display value', () => {
  assert.equal(maskAccountReference('SYNTHETIC-DEMO-5432'), '•••• 5432');
  assert.equal(maskAccountReference('12'), '');
});
