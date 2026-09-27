export function validSigner(email, name) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && typeof name === 'string' && name.trim().length > 0 && name.length <= 120;
}

export function providerConfig(settings) {
  const url = String(settings.DOCUMENSO_URL || '').replace(/\/$/, '');
  const token = String(settings.DOCUMENSO_API_TOKEN || '');
  if (!url || !token) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return { base: `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}/api/v2`, token };
  } catch { return null; }
}

export function envelopePayload(id, title, signerEmail, signerName) {
  return { type: 'DOCUMENT', title, externalId: id, recipients: [{
    email: signerEmail, name: signerName, role: 'SIGNER',
    fields: [{ identifier: 0, type: 'SIGNATURE', page: 1, positionX: 10, positionY: 82, width: 35, height: 8 }],
  }] };
}
