import test from 'node:test';
import assert from 'node:assert/strict';
import { requirementStatus, validRequirement } from '../lib/document-requirements.js';

test('a superseded approval does not satisfy a requirement', () => {
  const requirement = { category: 'Bill of Lading', dueAt: 100 };
  const versions = [
    { id: 'a', groupId: 'g', versionNumber: 1, category: 'Bill of Lading', status: 'approved' },
    { id: 'b', groupId: 'g', versionNumber: 2, category: 'Bill of Lading', status: 'in_review' },
  ];
  assert.equal(requirementStatus(requirement, versions, 200), 'in_review');
  assert.equal(requirementStatus(requirement, [], 200), 'overdue');
  assert.equal(requirementStatus(requirement, [{ ...versions[1], status: 'approved' }], 200), 'approved');
});

test('requirement input has bounded content and due date', () => {
  assert.equal(validRequirement({ category: 'Q88', dueAt: 123 }), true);
  assert.equal(validRequirement({ category: '', dueAt: 123 }), false);
  assert.equal(validRequirement({ category: 'Q88', dueAt: 'tomorrow' }), false);
});
