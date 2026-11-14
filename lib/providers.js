// Single source of truth for every external integration.
//
// Each provider lists the runtime variables it needs. `dummy` values point at the local mock
// server (dummy/mock-providers.mjs). To go live, set the same variable names to real values in
// the Sites runtime and remove DUMMY_PROVIDERS. No application code changes are required.
// See docs/GO-LIVE.md.

export const DUMMY_FLAG = 'DUMMY_PROVIDERS';

export const PROVIDERS = [
  {
    id: 'documenso', label: 'Documenso e-signatures', feature: 'Signing drafts, send, status, signed PDF return',
    required: ['DOCUMENSO_URL', 'DOCUMENSO_API_TOKEN'], optional: [],
    dummy: base => ({ DOCUMENSO_URL: `${base}/documenso`, DOCUMENSO_API_TOKEN: 'dummy-documenso-token' }),
    live: 'HTTPS URL of your self-hosted Documenso (no /api/v2) and a team API token. See deploy/documenso and docs/e-signatures.md.',
  },
  {
    id: 'chatwoot', label: 'Chatwoot external messaging', feature: 'Link external conversations, send replies, receive webhooks',
    required: ['CHATWOOT_URL', 'CHATWOOT_ACCOUNT_ID', 'CHATWOOT_API_TOKEN'], optional: ['CHATWOOT_WEBHOOK_SECRET', 'CHATWOOT_WEBHOOK_TOKEN'],
    dummy: base => ({ CHATWOOT_URL: `${base}/chatwoot`, CHATWOOT_ACCOUNT_ID: '1', CHATWOOT_API_TOKEN: 'dummy-chatwoot-token', CHATWOOT_WEBHOOK_SECRET: 'dummy-webhook-secret', CHATWOOT_WEBHOOK_TOKEN: 'dummy-webhook-token' }),
    live: 'Self-hosted Chatwoot base URL, account ID, API access token and webhook secret. See docs/communications.md.',
  },
  {
    id: 'novu', label: 'Novu notifications', feature: 'Priority message notification delivery',
    required: ['NOVU_API_URL', 'NOVU_API_KEY', 'NOVU_WORKFLOW_ID'], optional: [],
    dummy: base => ({ NOVU_API_URL: `${base}/novu`, NOVU_API_KEY: 'dummy-novu-key', NOVU_WORKFLOW_ID: 'dummy-workflow' }),
    live: 'Novu API URL, API key and the workflow identifier to trigger.',
  },
  {
    id: 'screening', label: 'OpenSanctions / yente screening', feature: 'Sanctions, PEP and vessel match suggestions',
    required: ['OPEN_SANCTIONS_BASE_URL'], optional: ['OPEN_SANCTIONS_API_KEY'],
    dummy: base => ({ OPEN_SANCTIONS_BASE_URL: `${base}/yente`, OPEN_SANCTIONS_API_KEY: 'dummy-screening-key' }),
    live: 'api.opensanctions.org (licensed key) or your self-hosted yente HTTPS URL with a lawfully licensed dataset.',
  },
  {
    id: 'tracking', label: 'Vessel tracking provider', feature: 'Sync vessel position by IMO',
    required: ['VESSEL_TRACKING_BASE_URL'], optional: ['VESSEL_TRACKING_API_KEY'],
    dummy: base => ({ VESSEL_TRACKING_BASE_URL: `${base}/tracking/position`, VESSEL_TRACKING_API_KEY: 'dummy-tracking-key' }),
    live: 'HTTPS endpoint of a lawful vessel-position provider that returns the position JSON shape in dummy/mock-providers.mjs, plus its key.',
  },
  {
    id: 'ai', label: 'Reply-drafting AI', feature: 'Draft replies on conversations',
    required: ['COMMUNICATION_AI_BASE_URL'], optional: ['COMMUNICATION_AI_MODEL', 'COMMUNICATION_AI_API_KEY'],
    dummy: base => ({ COMMUNICATION_AI_BASE_URL: `${base}/ai/v1`, COMMUNICATION_AI_MODEL: 'dummy-model', COMMUNICATION_AI_API_KEY: 'dummy-ai-key' }),
    live: 'Any OpenAI-compatible /chat/completions endpoint (self-hosted recommended), model name and key.',
  },
  {
    id: 'eia', label: 'EIA petroleum benchmarks', feature: 'Brent/WTI/product prices and stocks',
    required: ['EIA_API_KEY'], optional: ['EIA_API_ROOT'],
    dummy: base => ({ EIA_API_KEY: 'dummy-eia-key', EIA_API_ROOT: `${base}/eia/v2` }),
    live: 'A free EIA API key (EIA_API_ROOT is only for the dummy server; leave it unset).',
  },
  {
    id: 'ecb', label: 'ECB FX reference rates', feature: 'Official euro reference rates',
    required: [], optional: ['ECB_DAILY_URL'],
    dummy: base => ({ ECB_DAILY_URL: `${base}/ecb/eurofxref-daily.xml` }),
    live: 'No configuration needed. ECB_DAILY_URL is only for the dummy server; leave it unset.',
  },
];

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const truthy = value => String(value ?? '').trim() === '1';

export function dummyEnabled(settings) {
  return truthy(settings?.[DUMMY_FLAG]);
}

/** HTTPS is required for every provider. Plain HTTP to loopback is allowed only when DUMMY_PROVIDERS=1. */
export function providerUrlAllowed(value, settings) {
  let url;
  try { url = new URL(String(value)); } catch { return false; }
  if (url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && dummyEnabled(settings) && LOOPBACK.has(url.hostname);
}

/** True when dummy mode is on and the URL points at loopback. Used to label stored records so simulated data is never mistaken for real. */
export function isDummyTarget(value, settings) {
  return dummyEnabled(settings) && isLoopbackValue(value);
}

export function dummyVariables(base) {
  const vars = { [DUMMY_FLAG]: '1' };
  for (const provider of PROVIDERS) Object.assign(vars, provider.dummy(base));
  return vars;
}

function isLoopbackValue(value) {
  try { return LOOPBACK.has(new URL(String(value)).hostname); } catch { return false; }
}

/** Reports each provider as `live`, `dummy` or `unconfigured`. Never returns a variable value. */
export function providerStatus(settings) {
  const dummyOn = dummyEnabled(settings);
  const providers = PROVIDERS.map(provider => {
    const missing = provider.required.filter(name => !String(settings?.[name] ?? '').trim());
    const configured = provider.required.length > 0 && missing.length === 0;
    const urlVars = [...provider.required, ...provider.optional].filter(name => /URL|BASE|ROOT/.test(name) && settings?.[name]);
    const pointsAtLoopback = urlVars.some(name => isLoopbackValue(settings[name]));
    let mode = 'unconfigured';
    if (provider.required.length === 0) mode = pointsAtLoopback ? 'dummy' : 'live';
    else if (configured) mode = dummyOn && pointsAtLoopback ? 'dummy' : 'live';
    return { id: provider.id, label: provider.label, feature: provider.feature, mode, missing };
  });
  const anyDummy = providers.some(item => item.mode === 'dummy');
  // A dummy flag with no dummy providers, or loopback URLs without the flag, is a misconfiguration worth surfacing.
  const warnings = [];
  if (dummyOn && !anyDummy) warnings.push('DUMMY_PROVIDERS is set but no provider points at the dummy server.');
  if (dummyOn) warnings.push('Dummy mode is on. Results are simulated and must not be treated as real verification, signing, screening or tracking.');
  return { dummyMode: dummyOn, providers, warnings };
}
