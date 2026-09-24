const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);

export function notificationRecipients(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(value => clean(value, 254).toLowerCase()).filter(value => /^\S+@\S+\.\S+$/.test(value)))].slice(0, 100);
}

export function buildNovuTrigger({ workflowId, recipients, title, message, severity, reference, transactionId }) {
  const emails = notificationRecipients(recipients);
  if (!clean(workflowId, 160) || !emails.length) return null;
  return {
    name: clean(workflowId, 160),
    to: emails.map(email => ({ subscriberId: email, email })),
    payload: {
      title: clean(title, 240),
      message: clean(message, 2000),
      severity: clean(severity, 40),
      tradeReference: clean(reference, 64),
    },
    transactionId: clean(transactionId, 160),
  };
}

export async function triggerNovu(settings, event) {
  const base = clean(settings.NOVU_API_URL, 500).replace(/\/$/, '');
  const apiKey = clean(settings.NOVU_API_KEY, 1000);
  const request = buildNovuTrigger({ ...event, workflowId: settings.NOVU_WORKFLOW_ID });
  if (!base || !apiKey || !request) return { delivered: false, reason: 'not_configured' };
  try {
    const response = await fetch(`${base}/v1/events/trigger`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `ApiKey ${apiKey}`, 'idempotency-key': request.transactionId },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(3500),
    });
    return response.ok ? { delivered: true, status: response.status } : { delivered: false, reason: `http_${response.status}` };
  } catch (error) {
    return { delivered: false, reason: error?.name === 'TimeoutError' ? 'timeout' : 'network_error' };
  }
}
