const HIGH_RISK_FINANCE_STATUSES = new Set(['operative', 'settled']);
const RELEASED_MILESTONE_STATUS = 'released';

export function requiresFinanceApproval(status, milestones = []) {
  return HIGH_RISK_FINANCE_STATUSES.has(String(status || '').toLowerCase())
    || milestones.some(item => String(item?.status || '').toLowerCase() === RELEASED_MILESTONE_STATUS);
}

export function bankChangeDecision(change, actorId, decision) {
  const status = String(change?.status || 'pending');
  if (!['approve', 'reject'].includes(decision)) return { allowed: false, reason: 'Invalid bank-detail decision' };
  if (!['pending', 'first_approved'].includes(status)) return { allowed: false, reason: 'Bank-detail request is already closed' };
  if (decision === 'approve' && change?.createdBy === actorId) return { allowed: false, reason: 'The requester cannot approve their own bank-detail change' };
  if (decision === 'reject') return { allowed: true, nextStatus: 'rejected', stage: 'rejection' };
  if (!change?.firstApprovedBy) return { allowed: true, nextStatus: 'first_approved', stage: 'first' };
  if (change.firstApprovedBy === actorId) return { allowed: false, reason: 'A different signed-in approver must provide the second approval' };
  return { allowed: true, nextStatus: 'approved', stage: 'second' };
}

export function canApprovePaymentInstruction({ financeApprovalStatus, bankChangeStatus }) {
  if (financeApprovalStatus !== 'approved') return { allowed: false, reason: 'The trade finance approval must be complete first' };
  if (bankChangeStatus !== 'approved') return { allowed: false, reason: 'The beneficiary bank details need two-person approval first' };
  return { allowed: true };
}

export function maskAccountReference(value = '') {
  const normalized = String(value).replace(/\s+/g, '').toUpperCase();
  if (normalized.length < 4) return '';
  return `•••• ${normalized.slice(-4)}`;
}
