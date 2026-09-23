// Shared workflow policy. Outbound integrations must enforce these gates server-side.
export const outboundPolicy = Object.freeze({
  internal: 'none',
  routineEmail: 'configurable',
  commercialCommitment: 'human-required',
  legalCommitment: 'human-required',
  bankingInstruction: 'human-required',
  bankDetailChange: 'dual-approval',
});

export function classifyUrgency(value = '') {
  const text = String(value).toLowerCase();
  if (['fraud','sanction','payment blocked','vessel detained','bank details changed','lc expired'].some(term=>text.includes(term))) return 'critical';
  if (['urgent','immediately','deadline','expires','overdue','delay','demurrage','missing document'].some(term=>text.includes(term))) return 'urgent';
  return 'normal';
}
