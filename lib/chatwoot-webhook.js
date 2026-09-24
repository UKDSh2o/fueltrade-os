const clean = (value, max = 8000) => String(value ?? '').trim().slice(0, max);

export function normalizeChatwootConversationId(value) {
  const id = clean(value, 20);
  return /^\d{1,20}$/.test(id) && id !== '0' ? id : '';
}

export function normalizeChatwootMessage(payload) {
  if (!payload || payload.event !== 'message_created' || !['incoming', 0, '0'].includes(payload.message_type)) return null;
  const conversationId = normalizeChatwootConversationId(payload.conversation?.id ?? payload.conversation_id);
  const externalMessageId = clean(payload.id, 100);
  const body = clean(payload.content, 8000);
  if (!conversationId || !externalMessageId || !body) return null;
  const sender = payload.sender || payload.contact || payload.conversation?.meta?.sender || {};
  const sentAtValue = Number(payload.created_at);
  return {
    conversationId,
    externalMessageId,
    body,
    author: clean(sender.email || sender.name || sender.phone_number || 'External sender', 254),
    sentAt: Number.isFinite(sentAtValue) && sentAtValue > 0 ? sentAtValue * 1000 : Date.now(),
  };
}
