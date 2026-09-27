import test from 'node:test';
import assert from 'node:assert/strict';
import { validSigner, providerConfig, envelopePayload } from '../lib/signature-controls.js';

test('signer and provider boundaries reject malformed values', () => {
  assert.equal(validSigner('signer@example.com', 'Signer'), true);
  assert.equal(validSigner('not-an-email', 'Signer'), false);
  assert.equal(providerConfig({ DOCUMENSO_URL: 'http://localhost', DOCUMENSO_API_TOKEN: 'x' }), null);
  assert.equal(providerConfig({ DOCUMENSO_URL: 'https://sign.example.com', DOCUMENSO_API_TOKEN: 'x' }).base, 'https://sign.example.com/api/v2');
});

test('envelope ties one signer and signature field to a request', () => {
  const payload = envelopePayload('request-id', 'Agreement', 'signer@example.com', 'Signer');
  assert.equal(payload.externalId, 'request-id');
  assert.equal(payload.recipients[0].fields[0].type, 'SIGNATURE');
});
