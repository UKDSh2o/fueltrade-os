import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScreeningQuery, canTransitionDocument, summarizeScreeningResponse } from '../lib/due-diligence.js';

test('screening query keeps only supported entity types and useful fields', () => {
  assert.deepEqual(buildScreeningQuery({ name: ' Example Energy ', country: 'GB', schema: 'Company' }), {
    schema: 'Company', properties: { name: ['Example Energy'], country: ['GB'] },
  });
  assert.equal(buildScreeningQuery({ name: 'Ship', schema: 'Unknown' }).schema, 'Company');
  assert.throws(() => buildScreeningQuery({ name: ' ' }));
});

test('screening summary escalates strong sanctions matches for human review', () => {
  const summary = summarizeScreeningResponse({ responses: { q: { results: [{ id: 'x', caption: 'Example', schema: 'Company', score: 0.91, match: true, properties: { topics: ['sanction'] }, datasets: ['test'] }] } } });
  assert.equal(summary.riskLevel, 'critical');
  assert.equal(summary.requiresReview, true);
  assert.equal(summary.matches[0].caption, 'Example');
});

test('document lifecycle separates submission from approval', () => {
  assert.equal(canTransitionDocument('received', 'in_review', false), true);
  assert.equal(canTransitionDocument('in_review', 'approved', false), false);
  assert.equal(canTransitionDocument('in_review', 'approved', true), true);
  assert.equal(canTransitionDocument('approved', 'received', true), false);
});
