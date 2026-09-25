export function insuranceActivationGate({ status, verificationStatus, approvalStatus, expiryDate }, now = Date.now()) {
  if (!['bound', 'active'].includes(status)) return { allowed: true };
  if (verificationStatus !== 'verified') return { allowed: false, reason: "Verify the policy evidence before marking cover bound or active" };
  if (approvalStatus !== 'approved') return { allowed: false, reason: "Complete the trade insurance approval before activating cover" };
  if (expiryDate && Number(expiryDate) <= now) return { allowed: false, reason: "Expired cover cannot be marked bound or active" };
  return { allowed: true };
}

export function canVerifyInsuranceEvidence(document) {
  if (!document) return { allowed: false, reason: "Select approved insurance evidence" };
  if (document.status !== 'approved') return { allowed: false, reason: "Insurance evidence must complete document approval" };
  if (!String(document.category ?? '').toLowerCase().includes('insurance')) return { allowed: false, reason: "The selected document must be categorised as insurance evidence" };
  return { allowed: true };
}
