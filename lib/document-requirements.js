export function requirementStatus(requirement, documents, now = Date.now()) {
  const matching = documents.filter(doc => doc.category === requirement.category);
  const latestGroups = new Map();
  for (const doc of matching) {
    const group = doc.groupId || doc.id;
    const previous = latestGroups.get(group);
    if (!previous || (doc.versionNumber || 1) > (previous.versionNumber || 1)) latestGroups.set(group, doc);
  }
  const latest = [...latestGroups.values()];
  if (latest.some(doc => doc.status === 'approved')) return 'approved';
  if (latest.some(doc => doc.status === 'in_review')) return 'in_review';
  if (latest.some(doc => doc.status === 'received')) return 'received';
  if (requirement.dueAt && requirement.dueAt < now) return 'overdue';
  return 'missing';
}

export function validRequirement(input) {
  return typeof input?.category === 'string' && input.category.trim().length > 0 && input.category.trim().length <= 120
    && (input.note === undefined || typeof input.note === 'string' && input.note.length <= 500)
    && (input.dueAt === undefined || input.dueAt === null || Number.isSafeInteger(input.dueAt) && input.dueAt > 0);
}
