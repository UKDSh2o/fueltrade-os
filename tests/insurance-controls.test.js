import test from 'node:test';
import assert from 'node:assert/strict';
import { canVerifyInsuranceEvidence, insuranceActivationGate } from '../lib/insurance-controls.js';

test('active cover requires verified evidence and trade approval', () => {
  assert.equal(insuranceActivationGate({ status: 'draft' }).allowed, true);
  assert.equal(insuranceActivationGate({ status: 'active', verificationStatus: 'unverified', approvalStatus: 'approved' }).allowed, false);
  assert.equal(insuranceActivationGate({ status: 'active', verificationStatus: 'verified', approvalStatus: 'pending' }).allowed, false);
  assert.equal(insuranceActivationGate({ status: 'active', verificationStatus: 'verified', approvalStatus: 'approved', expiryDate: Date.parse('2025-01-01') }, Date.parse('2026-01-01')).allowed, false);
  assert.equal(insuranceActivationGate({ status: 'bound', verificationStatus: 'verified', approvalStatus: 'approved', expiryDate: Date.parse('2027-01-01') }, Date.parse('2026-01-01')).allowed, true);
});

test('verification accepts only approved insurance evidence', () => {
  assert.equal(canVerifyInsuranceEvidence(null).allowed, false);
  assert.equal(canVerifyInsuranceEvidence({ status: 'received', category: 'Insurance certificate' }).allowed, false);
  assert.equal(canVerifyInsuranceEvidence({ status: 'approved', category: 'Bill of lading' }).allowed, false);
  assert.equal(canVerifyInsuranceEvidence({ status: 'approved', category: 'CIF insurance certificate' }).allowed, true);
});
