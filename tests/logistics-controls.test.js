import test from 'node:test';
import assert from 'node:assert/strict';
import { handoffDecision, isValidImo, normalizeImo, normalizePosition } from '../lib/logistics-controls.js';

test('validates the current seven-digit IMO checksum', () => {
  assert.equal(normalizeImo('IMO 9074729'), '9074729');
  assert.equal(isValidImo('IMO 9074729'), true);
  assert.equal(isValidImo('9074728'), false);
  assert.equal(isValidImo('123'), false);
});

test('normalizes bounded vessel positions', () => {
  const result = normalizePosition({ lat: 51.5, lon: -0.12, speed: 12.4, course: 270, positionAt: '2026-01-01T12:00:00Z' }, Date.parse('2026-01-01T12:05:00Z'));
  assert.deepEqual(result, { valid: true, latitude: 51.5, longitude: -0.12, speedKnots: 12.4, courseDegrees: 270, positionAt: Date.parse('2026-01-01T12:00:00Z') });
  assert.equal(normalizePosition({ lat: 91, lon: 0 }).valid, false);
  assert.equal(normalizePosition({ lat: 0, lon: 0, speed: 120 }).valid, false);
});

test('requires independent custody acceptance', () => {
  assert.equal(handoffDecision('actor-a', 'actor-a', 'accepted').allowed, false);
  assert.deepEqual(handoffDecision('actor-a', 'actor-b', 'accepted'), { allowed: true, status: 'accepted' });
  assert.equal(handoffDecision('actor-a', 'actor-a', 'disputed').allowed, true);
});
