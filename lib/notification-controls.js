export function notificationReadStateId(eventId, userId) {
  const event = String(eventId ?? '').trim();
  const user = String(userId ?? '').trim();
  if (!event || !user) return '';
  return `${event}:${user}`;
}

export function effectiveNotificationReadAt({ personalStateExists, personalReadAt, legacyReadAt, isOwner }) {
  if (personalStateExists) return personalReadAt ?? null;
  return isOwner ? legacyReadAt ?? null : null;
}
