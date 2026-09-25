export function paymentEvidenceGate({ instruction, document, amountCents, currency }) {
  if (!instruction || instruction.status !== 'approved') return { allowed: false, reason: 'Only an approved payment instruction can receive execution evidence' };
  if (!document || document.status !== 'approved') return { allowed: false, reason: 'Select an approved supporting document' };
  const category = String(document.category ?? '').toLowerCase();
  if (!['payment', 'bank', 'finance', 'swift', 'lc'].some(term => category.includes(term))) return { allowed: false, reason: 'The supporting document must be categorised as banking or payment evidence' };
  if (Number(amountCents) !== Number(instruction.amountCents) || String(currency).toUpperCase() !== String(instruction.currency).toUpperCase()) return { allowed: false, reason: 'Evidence amount and currency must match the approved instruction exactly' };
  return { allowed: true };
}

export function paymentEvidenceDecision(receivedBy, actorId, decision) {
  if (!['confirmed', 'rejected'].includes(decision)) return { allowed: false, reason: 'Choose confirm or reject' };
  if (decision === 'confirmed' && receivedBy === actorId) return { allowed: false, reason: 'The evidence recorder cannot confirm their own record' };
  return { allowed: true, status: decision };
}
