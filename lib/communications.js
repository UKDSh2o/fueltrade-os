const urgentPatterns = [
  /\burgent\b/i, /\bimmediately\b/i, /\basap\b/i, /\bdeadline\b/i,
  /\bpayment (?:overdue|failed|blocked)\b/i, /\bvessel (?:delay|delayed|deviation)\b/i,
  /\bexpired?\b/i, /\breject(?:ed|ion)?\b/i, /\bsanctions?\b/i,
  /\bbreach\b/i, /\bdispute\b/i, /\boff[- ]spec\b/i,
];

const highPatterns = [
  /\bapproval\b/i, /\bpayment\b/i, /\binvoice\b/i, /\blc\b/i,
  /\bETA\b/, /\binspection\b/i, /\bcontract\b/i, /\bSPA\b/,
];

export const connectionCatalog = [
  { provider: 'sandbox_email', name: 'Email sandbox', description: 'Safe test inbox; no message leaves FuelTrade', capabilities: ['email','sandbox'] },
  { provider: 'chatwoot', name: 'Chatwoot', description: 'Free self-hosted unified inbox and channel gateway', capabilities: ['email','internal','whatsapp','telegram'] },
  { provider: 'imap', name: 'IMAP / SMTP', description: 'Any standards-based business mailbox', capabilities: ['email'] },
  { provider: 'google', name: 'Google Workspace', description: 'Gmail with OAuth', capabilities: ['email'] },
  { provider: 'microsoft', name: 'Microsoft 365 / Exchange', description: 'Outlook and Exchange Online with OAuth', capabilities: ['email'] },
  { provider: 'whatsapp', name: 'WhatsApp Business', description: 'Deal messages through the official business channel', capabilities: ['whatsapp'] },
  { provider: 'telegram', name: 'Telegram', description: 'Bot-based deal alerts and replies', capabilities: ['telegram'] },
  { provider: 'novu', name: 'Novu', description: 'Free self-hosted notification workflows', capabilities: ['email','in_app','whatsapp','telegram','teams'] },
  { provider: 'ollama', name: 'Self-hosted AI', description: 'OpenAI-compatible local model endpoint for triage and drafts', capabilities: ['ai'] },
];

export function classifyMessage(text) {
  const body = String(text || '').slice(0, 12000);
  const urgent = urgentPatterns.find(pattern => pattern.test(body));
  if (urgent) return { priority: 'urgent', reason: 'Contains a time-critical, compliance, payment or execution risk signal.' };
  const high = highPatterns.find(pattern => pattern.test(body));
  if (high) return { priority: 'high', reason: 'Relates to a key approval, contract, payment or shipment milestone.' };
  return { priority: 'normal', reason: 'No urgent trade-execution signal detected.' };
}

export function buildSafeDraft(message, subject = 'this matter') {
  const insight = classifyMessage(message);
  const topic = String(subject || 'this matter').trim().slice(0, 160) || 'this matter';
  const opening = insight.priority === 'urgent'
    ? 'Thank you for the urgent update.'
    : insight.priority === 'high'
      ? 'Thank you for the important update.'
      : 'Thank you for the update.';
  const caution = /\b(payment|bank|account|invoice|lc|letter of credit)\b/i.test(String(message || ''))
    ? 'For security, any payment or banking change must be verified through our approved independent channel before action.'
    : 'Please confirm the latest verified details, the required action and any applicable deadline.';
  return `${opening}\n\nWe have recorded this against ${topic} and are reviewing the operational and contractual impact. ${caution}\n\nWe will respond with our approved position once that review is complete.\n\nRegards,`;
}

export function normalizeChannel(value) {
  return ['email','email_sandbox','internal','whatsapp','telegram'].includes(value) ? value : 'internal';
}

export function normalizeParticipants(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => String(item || '').trim().toLowerCase()).filter(item => /^\S+@\S+\.\S+$/.test(item)))].slice(0, 30);
}

export function safeConnector(value) {
  const provider = String(value || '').trim().toLowerCase();
  return connectionCatalog.some(item => item.provider === provider) ? provider : null;
}
