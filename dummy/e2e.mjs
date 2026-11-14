// End-to-end dummy-mode run: boots the dummy providers and the real built app, then exercises it as several dummy users.
// Usage: pnpm build && pnpm test:e2e        (nothing real is contacted; see docs/GO-LIVE.md)
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createMockProviders } from './mock-providers.mjs';
import { dummyVariables } from '../lib/providers.js';
import { USERS, headersFor } from './users.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_PORT = Number(process.env.E2E_APP_PORT || 8788), MOCK_PORT = Number(process.env.E2E_MOCK_PORT || 8799);
const APP = `http://127.0.0.1:${APP_PORT}`, MOCK = `http://127.0.0.1:${MOCK_PORT}`;
const wrangler = ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js'];

const results = [];
let current = '';
const check = (condition, message, detail) => { if (!condition) throw new Error(`${message}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`); };

async function api(user, method, url, body, extra = {}) {
  const headers = { ...(user ? headersFor(USERS[user]) : {}), ...extra };
  let payload = body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const response = await fetch(`${APP}${url}`, { method, headers, body: payload });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, data, headers: response.headers };
}
const get = (user, url) => api(user, 'GET', url);
const post = (user, url, body) => api(user, 'POST', url, body);
const mock = async (method, url) => (await fetch(`${MOCK}${url}`, { method })).json();

async function step(name, fn) {
  current = name;
  try { await fn(); results.push({ name, ok: true }); console.log(`  PASS  ${name}`); }
  catch (error) { results.push({ name, ok: false, error: error.message }); console.log(`  FAIL  ${name}\n        ${error.message}`); }
}

function minimalPdf(label) {
  return new File([`%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%${label}\ntrailer<</Root 1 0 R>>\n%%EOF\n`], `${label}.pdf`, { type: 'application/pdf' });
}

async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise(r => setTimeout(r, 500)); }
  throw new Error(`Timed out waiting for ${url}`);
}

const REF = 'DUMMY-0001';
const state = {};

async function scenarios() {
  console.log('\nAccess and providers');
  await step('unauthenticated requests are rejected', async () => {
    for (const url of ['/api/trades', '/api/providers', '/api/signatures?reference=' + REF]) check((await get(null, url)).status === 401, `${url} should be 401`);
  });
  await step('every integration reports dummy mode (no live provider in use)', async () => {
    const { status, data } = await get('owner', '/api/providers');
    check(status === 200 && data.dummyMode === true, 'dummy mode should be on', data);
    const modes = data.providers.map(p => `${p.id}:${p.mode}`);
    check(data.providers.every(p => p.mode === 'dummy'), 'all providers should be dummy', modes);
    check(JSON.stringify(data).includes('dummy-') === false, 'status must not leak variable values');
  });

  await step('owner saves a trade', async () => {
    const trade = { reference: REF, product: 'Diesel EN590', route: 'Fujairah to Rotterdam', status: 'Draft', volumeMt: 5000, buyPrice: 640, sellPrice: 690, netProfit: 120000 };
    const r = await post('owner', '/api/trades', { trade, netProfit: 120000 });
    check(r.status === 200 && r.data.id, 'trade should save', r);
  });

  await step('owner invites participants; each accepts with their own identity', async () => {
    const perms = (o) => ({ trade: 'view', documents: 'view', finance: 'none', insurance: 'none', logistics: 'none', approvals: 'none', comments: 'edit', ...o });
    const invites = [
      ['buyer', 'buyer', 'buyer', perms({ trade: 'view' })],
      ['legal', 'legal', 'all', perms({ documents: 'approve', approvals: 'approve', trade: 'edit' })],
      ['bank', 'bank', 'summary', perms({ finance: 'approve', documents: 'edit' })],
      ['captain', 'logistics', 'none', perms({ logistics: 'edit', documents: 'view' })],
    ];
    for (const [who, role, marginScope, permissions] of invites) {
      const add = await post('owner', '/api/access', { action: 'add_member', reference: REF, email: USERS[who].email, name: who, organization: 'Dummy Co', role, marginScope, permissions });
      check(add.status === 201, `add ${who}`, add);
      const accept = await post(who, '/api/access', { action: 'accept_invitation', reference: REF });
      check(accept.status === 200 && accept.data.status === 'active', `accept ${who}`, accept);
      state[`member_${who}`] = add.data.id;
    }
  });

  await step('an uninvited user cannot read or change the trade', async () => {
    for (const url of ['/api/documents?reference=' + REF, '/api/finance?reference=' + REF, '/api/logistics?reference=' + REF, '/api/signatures?reference=' + REF]) {
      const r = await get('outsider', url); check(r.status === 403 || r.status === 404, `${url} must be denied`, r.status);
    }
    const r = await get('outsider', '/api/trades'); check(r.status === 200 && r.data.trades.length === 0, 'outsider sees no trades', r.data);
  });

  await step('buyer margin scope hides seller-side and profit figures', async () => {
    const owner = (await get('owner', '/api/trades')).data.trades.find(t => t.reference === REF);
    const buyer = (await get('buyer', '/api/trades')).data.trades.find(t => t.reference === REF);
    check(owner && buyer, 'both should see the trade', { owner: !!owner, buyer: !!buyer });
    const text = JSON.stringify(buyer);
    check(owner.trade?.netProfit === 120000 || JSON.stringify(owner).includes('120000'), 'owner sees profit');
    check(buyer.trade?.netProfit == null && buyer.trade?.buyPrice == null, 'buyer must not see profit or buy price', buyer.trade);
    check(!text.includes('"netProfit":120000'), 'profit must be redacted');
  });

  console.log('\nDocuments and requirements');
  await step('upload a PDF and a second version; versions chain with SHA-256', async () => {
    const form = new FormData(); form.set('file', minimalPdf('spa-v1')); form.set('reference', REF); form.set('category', 'Sales contract');
    const v1 = await api('owner', 'POST', '/api/documents', form);
    check(v1.status === 201 || v1.status === 200, 'upload v1', v1);
    state.doc = v1.data;
    check(/^[0-9a-f]{64}$/.test(v1.data.sha256) && v1.data.versionNumber === 1, 'v1 fingerprint', v1.data);
    const form2 = new FormData(); form2.set('file', minimalPdf('spa-v2')); form2.set('reference', REF); form2.set('category', 'Sales contract'); form2.set('groupId', v1.data.groupId);
    const v2 = await api('owner', 'POST', '/api/documents', form2);
    check(v2.data.versionNumber === 2 && v2.data.supersedesId === v1.data.id, 'v2 chains to v1', v2.data);
    state.docV2 = v2.data;
  });
  await step('rejects non-allowed file types', async () => {
    const form = new FormData(); form.set('file', new File(['x'], 'bad.exe', { type: 'application/x-msdownload' })); form.set('reference', REF);
    check((await api('owner', 'POST', '/api/documents', form)).status === 415, 'exe must be rejected');
  });
  await step('only an approver can approve a document (buyer cannot, legal can)', async () => {
    const asReviewing = await post('owner', '/api/documents', { action: 'transition', reference: REF, id: state.docV2.id, status: 'in_review' });
    check(asReviewing.status === 200, 'move to review', asReviewing);
    const denied = await post('buyer', '/api/documents', { action: 'transition', reference: REF, id: state.docV2.id, status: 'approved' });
    check(denied.status === 403, 'buyer approval denied', denied);
    const ok = await post('legal', '/api/documents', { action: 'transition', reference: REF, id: state.docV2.id, status: 'approved', reviewNote: 'Dummy approval' });
    check(ok.status === 200 && ok.data.reviewedBy === USERS.legal.email, 'legal approves', ok);
  });
  await step('document requirement is created and tracked', async () => {
    const r = await post('owner', '/api/document-requirements', { reference: REF, category: 'Sales contract', note: 'Signed SPA', dueAt: Date.now() + 86400000 });
    check(r.status === 201, 'create requirement', r);
    const list = await get('owner', `/api/document-requirements?reference=${REF}`);
    check(list.status === 200 && JSON.stringify(list.data).includes('Sales contract'), 'requirement listed', list.data);
  });
  await step('document download is permission-checked and serves the same bytes', async () => {
    const ok = await get('legal', `/api/documents?reference=${REF}&id=${state.docV2.id}`);
    check(ok.status === 200 && Buffer.isBuffer(ok.data) && ok.data.subarray(0, 5).toString() === '%PDF-', 'legal downloads', ok.status);
    const denied = await get('outsider', `/api/documents?reference=${REF}&id=${state.docV2.id}`);
    check(denied.status === 403 || denied.status === 404, 'outsider denied', denied.status);
  });

  console.log('\nE-signatures (dummy Documenso)');
  await step('signing draft -> prepare -> send -> signer completes -> signed PDF returned', async () => {
    const create = await post('legal', '/api/signatures', { action: 'create', reference: REF, documentId: state.docV2.id, signerEmail: 'signer@dummy.invalid', signerName: 'Dummy Signer' });
    check(create.status === 201, 'draft', create); const id = create.data.id;
    { const p = await post('legal', '/api/signatures', { action: 'prepare', id, reference: REF }); check(p.data.status === 'prepared', 'prepare', { http: p.status, body: p.data, providerLog: await mock('GET', '/__control/log') }); }
    check((await post('legal', '/api/signatures', { action: 'sync', id, reference: REF })).data.status === 'prepared', 'still prepared until sent');
    check((await post('legal', '/api/signatures', { action: 'send', id, reference: REF })).data.status === 'sent', 'sent');
    check((await post('legal', '/api/signatures', { action: 'sync', id, reference: REF })).data.status === 'pending', 'pending at provider');
    const log = await mock('GET', '/__control/log'); const envelope = (await get('legal', `/api/signatures?reference=${REF}`)).data.requests.find(r => r.id === id).providerEnvelopeId;
    check(log.some(e => e.provider === 'documenso' && e.path === '/envelope/create'), 'provider received create');
    await mock('POST', `/__control/documenso/complete/${envelope}`);
    const done = await post('legal', '/api/signatures', { action: 'sync', id, reference: REF });
    check(done.data.status === 'completed', 'completed', done);
    const row = (await get('legal', `/api/signatures?reference=${REF}`)).data.requests.find(r => r.id === id);
    check(row.hasSignedCopy && /^[0-9a-f]{64}$/.test(row.signedSha256), 'signed copy stored with checksum', row);
    const pdf = await get('legal', `/api/signatures?reference=${REF}&download=${id}`);
    check(pdf.status === 200 && pdf.data.toString('latin1').includes('DUMMY-SIGNED'), 'signed PDF downloads');
    const orig = await get('legal', `/api/documents?reference=${REF}&id=${state.docV2.id}`);
    check(!orig.data.toString('latin1').includes('DUMMY-SIGNED'), 'original PDF remains unchanged');
  });
  await step('non-approvers cannot send; provider outage is reported not hidden', async () => {
    const create = await post('legal', '/api/signatures', { action: 'create', reference: REF, documentId: state.docV2.id, signerEmail: 'signer2@dummy.invalid', signerName: 'Signer Two' });
    check((await post('captain', '/api/signatures', { action: 'prepare', id: create.data.id, reference: REF })).status === 403, 'captain denied');
    await mock('POST', '/__control/fail/documenso');
    const r = await post('legal', '/api/signatures', { action: 'prepare', id: create.data.id, reference: REF });
    await mock('DELETE', '/__control/fail/documenso');
    check(r.status === 502, 'outage returns 502', r);
    check((await post('legal', '/api/signatures', { action: 'prepare', id: create.data.id, reference: REF })).data.status === 'prepared', 'retry succeeds after outage');
  });

  console.log('\nDue diligence (dummy yente)');
  await step('screening: name-alike is flagged for review; sanctioned name is critical; clean name is clear', async () => {
    const cp = await post('owner', '/api/operations', { action: 'create_counterparty', name: 'Dummy Trading FZE', country: 'AE', type: 'seller' });
    check(cp.status === 201, 'counterparty', cp); state.cp = cp.data.id;
    const run = async (name, extra = {}) => post('owner', '/api/due-diligence', { action: 'run_screening', reference: REF, checkType: 'sanctions_pep', subjectName: name, subjectCountry: 'AE', counterpartyId: state.cp, ...extra });
    const clean = await run('Harmless Oil Ltd'); check(clean.status === 201 || clean.status === 200, 'clean run', clean);
    const sanc = await run('Sanction Bunkering Co'); state.ddSanc = sanc.data.id;
    const alike = await run('Similar Name Ltd');
    const list = (await get('owner', `/api/due-diligence?reference=${REF}`)).data.checks;
    const by = n => list.find(c => c.subjectName === n);
    check(by('Harmless Oil Ltd')?.riskLevel === 'clear', 'clean is clear', by('Harmless Oil Ltd'));
    check(by('Sanction Bunkering Co')?.riskLevel === 'critical', 'sanctioned is critical', by('Sanction Bunkering Co'));
    check(by('Similar Name Ltd')?.riskLevel === 'medium', 'name-alike is medium', by('Similar Name Ltd'));
    check(list.filter(c => c.provider !== 'manual').every(c => c.provider === 'dummy'), 'screening records are labelled dummy, never as a real provider', list.map(c => c.provider));
  });
  await step('an automated match never clears itself; only an approver decides', async () => {
    check(['pending_review', 'review'].some(x => true), 'n/a');
    const list = (await get('owner', `/api/due-diligence?reference=${REF}`)).data.checks;
    check(list.find(c => c.id === state.ddSanc).status === 'pending_review', 'stays pending_review after screening', list.find(c => c.id === state.ddSanc));
    check((await post('buyer', '/api/due-diligence', { action: 'review', reference: REF, id: state.ddSanc, status: 'cleared' })).status === 403, 'buyer cannot review');
    const blocked = await post('legal', '/api/due-diligence', { action: 'review', reference: REF, id: state.ddSanc, status: 'blocked', note: 'dummy block' });
    check(blocked.status === 200 && blocked.data.riskLevel === 'critical', 'legal blocks', blocked);
  });
  await step('screening outage is reported as 502, not as a clean result', async () => {
    await mock('POST', '/__control/fail/yente');
    const r = await post('owner', '/api/due-diligence', { action: 'run_screening', reference: REF, checkType: 'sanctions_pep', subjectName: 'Outage Test Ltd' });
    await mock('DELETE', '/__control/fail/yente');
    check(r.status === 502, 'outage -> 502', r);
    const list = (await get('owner', `/api/due-diligence?reference=${REF}`)).data.checks;
    check(!list.some(c => c.subjectName === 'Outage Test Ltd'), 'no check recorded for a failed screen');
  });

  console.log('\nLogistics (dummy vessel tracking)');
  await step('voyage with checksum-valid IMO; invalid IMO rejected', async () => {
    check((await post('captain', '/api/logistics', { action: 'save_voyage', reference: REF, vesselName: 'MT DUMMY', imo: '1234568' })).status === 400, 'bad IMO rejected');
    const ok = await post('captain', '/api/logistics', { action: 'save_voyage', reference: REF, vesselName: 'MT DUMMY', imo: 'IMO 9074729', loadPort: 'Fujairah', dischargePort: 'Rotterdam', cargoMt: 5000 });
    check(ok.status === 200, 'save voyage', ok);
  });
  await step('tracking sync stores a provider position; outage and permission failures are explicit', async () => {
    const r = await post('captain', '/api/logistics', { action: 'sync_tracking', reference: REF });
    check(r.status === 200 || r.status === 201, 'sync', r);
    const view = (await get('captain', `/api/logistics?reference=${REF}`)).data;
    check(view.positions.length === 1 && view.positions[0].provider === 'dummy', 'position stored and labelled dummy', view.positions);
    check(Math.abs(view.positions[0].latitude - 25.2) < 1, 'dummy coordinates stored', view.positions[0]);
    check((await post('buyer', '/api/logistics', { action: 'sync_tracking', reference: REF })).status === 403, 'buyer cannot sync');
    await mock('POST', '/__control/fail/tracking');
    check((await post('captain', '/api/logistics', { action: 'sync_tracking', reference: REF })).status === 502, 'outage -> 502');
    await mock('DELETE', '/__control/fail/tracking');
  });
  await step('custody handoff: recorder cannot accept their own; an approver can', async () => {
    const rec = await post('captain', '/api/logistics', { action: 'record_handoff', reference: REF, handoffType: 'loading', portName: 'Fujairah', fromParty: 'Terminal', toParty: 'MT DUMMY', quantityMt: 5000 });
    check(rec.status === 201, 'record', rec);
    check((await post('captain', '/api/logistics', { action: 'decide_handoff', reference: REF, id: rec.data.id, decision: 'accepted' })).status === 403, 'captain lacks approve');
    const own = await post('owner', '/api/logistics', { action: 'record_handoff', reference: REF, handoffType: 'discharge', portName: 'Rotterdam', fromParty: 'MT DUMMY', toParty: 'Terminal', quantityMt: 4990 });
    check((await post('owner', '/api/logistics', { action: 'decide_handoff', reference: REF, id: own.data.id, decision: 'accepted' })).status === 409, 'self-acceptance blocked');
    check((await post('owner', '/api/logistics', { action: 'decide_handoff', reference: REF, id: rec.data.id, decision: 'accepted' })).data.status === 'accepted', 'independent acceptance');
  });

  console.log('\nCommunications (dummy Chatwoot, Novu, AI)');
  await step('internal group thread is visible to participants, hidden from non-participants', async () => {
    const t = await post('owner', '/api/communications', { action: 'create_thread', reference: REF, subject: 'Loading plan', channel: 'internal', threadKind: 'direct', participants: [USERS.legal.email] });
    check(t.status === 201, 'create direct thread', t); state.directThread = t.data.id;
    const ids = async who => (await get(who, `/api/communications?reference=${REF}`)).data.threads?.map(x => x.id) ?? [];
    check((await ids('legal')).includes(state.directThread), 'legal sees it');
    check(!(await ids('buyer')).includes(state.directThread), 'buyer does not see it');
  });
  await step('external thread links to a dummy Chatwoot conversation and sends a reply', async () => {
    const t = await post('owner', '/api/communications', { action: 'create_thread', reference: REF, subject: 'Buyer WhatsApp', channel: 'whatsapp', threadKind: 'group' });
    check(t.status === 201, 'create external thread', t); state.extThread = t.data.id;
    check((await post('owner', '/api/communications', { action: 'link_chatwoot_conversation', reference: REF, threadId: state.extThread, conversationId: '5000' })).status === 502, 'unknown conversation is refused');
    const link = await post('owner', '/api/communications', { action: 'link_chatwoot_conversation', reference: REF, threadId: state.extThread, conversationId: '1001' });
    check(link.status === 200, 'link', link);
    const sent = await post('owner', '/api/communications', { action: 'send_message', reference: REF, threadId: state.extThread, message: 'Dummy outbound update' });
    check(sent.status === 200 || sent.status === 201, 'send', sent);
    check((await mock('GET', '/__control/log')).some(e => e.provider === 'chatwoot' && e.method === 'POST' && e.path.endsWith('/messages')), 'dummy Chatwoot received the reply');
  });
  await step('inbound webhook: bad signature rejected; signed urgent message stored, deduplicated, notifies via dummy Novu', async () => {
    const payload = JSON.stringify({ event: 'message_created', message_type: 'incoming', id: 777, conversation: { id: 1001 }, content: 'URGENT: please confirm payment account change immediately', sender: { email: 'counterparty@dummy.invalid' }, created_at: Math.floor(Date.now() / 1000) });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = 'sha256=' + crypto.createHmac('sha256', 'dummy-webhook-secret').update(`${ts}.${payload}`).digest('hex');
    const send = (headers) => api(null, 'POST', '/api/communications/webhook', payload, { 'content-type': 'application/json', ...headers });
    check((await send({ 'x-chatwoot-timestamp': ts, 'x-chatwoot-signature': 'sha256=' + '0'.repeat(64) })).status === 401, 'bad signature rejected');
    check((await send({})).status === 401, 'unsigned rejected');
    const ok = await send({ 'x-chatwoot-timestamp': ts, 'x-chatwoot-signature': sig });
    check(ok.status === 201 && ok.data.priority !== 'normal', 'accepted as priority', ok);
    check(ok.data.notificationDelivered === true, 'dummy Novu delivered');
    const dup = await send({ 'x-chatwoot-timestamp': ts, 'x-chatwoot-signature': sig });
    check(dup.data.duplicate === true, 'duplicate ignored', dup);
    const tokenOk = await send({ 'x-fueltrade-webhook-token': 'dummy-webhook-token' });
    check(tokenOk.status === 202 || tokenOk.status === 200 || tokenOk.status === 201, 'shared-token fallback authorises', tokenOk.status);
    const msgs = (await get('owner', `/api/communications?reference=${REF}&threadId=${state.extThread}`)).data;
    check(JSON.stringify(msgs).includes('URGENT'), 'message visible in thread');
  });
  await step('AI draft reply uses the dummy OpenAI-compatible endpoint', async () => {
    const r = await post('owner', '/api/communications', { action: 'draft_reply', reference: REF, threadId: state.extThread, message: 'Can you confirm delivery dates?' });
    check(r.status === 200 && /DUMMY DRAFT/.test(JSON.stringify(r.data)), 'draft from dummy AI', r);
  });

  console.log('\nMarket data (dummy ECB and EIA)');
  await step('FX reference rates and petroleum benchmarks load from the dummy providers', async () => {
    const fx = await get('owner', '/api/market');
    check(fx.status === 200 && fx.data.rates.USD === 1.08 && fx.data.crosses.GBP_USD > 1, 'ECB dummy rates', fx.data);
    const oil = await get('owner', '/api/market/petroleum');
    check(oil.status === 200 && oil.data.configured === true, 'EIA configured', oil.data);
  });

  console.log('\nFinance controls (records only: no funds ever move)');
  await step('bank details need two distinct approvers; requester cannot approve their own', async () => {
    const perms = (o) => ({ trade: 'view', documents: 'view', finance: 'none', insurance: 'none', logistics: 'none', approvals: 'none', comments: 'edit', ...o });
    await post('owner', '/api/access', { action: 'add_member', reference: REF, email: USERS.bank.email, name: 'bank', organization: 'Dummy Bank', role: 'bank', marginScope: 'summary', permissions: perms({ finance: 'approve', documents: 'edit', approvals: 'approve' }) });
    await post('owner', '/api/access', { action: 'add_member', reference: REF, email: USERS.legal.email, name: 'legal', organization: 'Dummy Legal', role: 'legal', marginScope: 'all', permissions: perms({ finance: 'approve', documents: 'approve', approvals: 'approve', trade: 'edit' }) });
    const req = await post('bank', '/api/finance', { action: 'request_bank_change', reference: REF, beneficiaryName: 'Dummy Trading FZE', bankName: 'Dummy Bank', accountReference: 'DUMMY00112233445566', reason: 'Initial beneficiary' });
    check(req.status === 201 && req.data.maskedAccount.endsWith('5566') && !JSON.stringify(req.data).includes('00112233'), 'masked, never echoed in full', req);
    state.bankChange = req.data.id;
    check((await post('bank', '/api/finance', { action: 'decide_bank_change', reference: REF, id: state.bankChange, decision: 'approve' })).status === 409, 'requester blocked');
    check((await post('owner', '/api/finance', { action: 'decide_bank_change', reference: REF, id: state.bankChange, decision: 'approve' })).data.status === 'first_approved', 'first approval');
    check((await post('owner', '/api/finance', { action: 'decide_bank_change', reference: REF, id: state.bankChange, decision: 'approve' })).status === 409, 'same approver cannot give both');
    check((await post('legal', '/api/finance', { action: 'decide_bank_change', reference: REF, id: state.bankChange, decision: 'approve' })).data.status === 'approved', 'second approval by a different person');
    const dup = await post('bank', '/api/finance', { action: 'request_bank_change', reference: REF, beneficiaryName: 'Dummy Trading FZE', bankName: 'Dummy Bank', accountReference: 'dummy 0011 2233 4455 66', reason: 'dup' });
    check(dup.status === 409, 'duplicate account detected by fingerprint', dup);
    const view = JSON.stringify((await get('owner', `/api/finance?reference=${REF}`)).data);
    check(!view.includes('00112233445566'), 'full account reference is never stored or returned');
  });
  await step('payment instruction: gated on trade finance approval; submitter cannot approve; records fundsTransferred=false', async () => {
    const created = await post('bank', '/api/finance', { action: 'create_instruction', reference: REF, bankChangeId: state.bankChange, instructionType: 'advance', amount: 250000, currency: 'USD', purpose: 'Dummy advance' });
    check(created.status === 201, 'create', created); const id = created.data.id;
    check((await post('bank', '/api/finance', { action: 'submit_instruction', reference: REF, id })).data.status === 'pending_approval', 'submit');
    check((await post('bank', '/api/finance', { action: 'approve_instruction', reference: REF, id })).status === 409, 'submitter blocked');
    const early = await post('owner', '/api/finance', { action: 'approve_instruction', reference: REF, id });
    check(early.status === 409, 'blocked until finance approval stage is approved', early);
    await post('owner', '/api/access', { action: 'initialize_approvals', reference: REF });
    const fin = (await get('owner', `/api/access?reference=${REF}`)).data.approvals.find(a => a.approvalType === 'finance');
    check(fin, 'finance approval stage exists');
    check((await post('owner', '/api/access', { action: 'decide_approval', reference: REF, id: fin.id, status: 'approved' })).status === 200, 'finance stage approved');
    const ok = await post('owner', '/api/finance', { action: 'approve_instruction', reference: REF, id });
    check(ok.status === 200 && ok.data.status === 'approved' && ok.data.fundsTransferred === false, 'approved record, no transfer', ok);
    state.instruction = id;
  });
  await step('execution evidence needs an approved banking document, exact amount, and independent confirmation', async () => {
    const form = new FormData(); form.set('file', minimalPdf('swift-advice')); form.set('reference', REF); form.set('category', 'Bank payment advice');
    const doc = await api('bank', 'POST', '/api/documents', form); check(doc.status === 201, 'upload evidence', doc);
    const bad = await post('bank', '/api/finance', { action: 'record_execution_evidence', reference: REF, instructionId: state.instruction, evidenceDocumentId: doc.data.id, amount: 250000, currency: 'USD', provider: 'Dummy Bank', providerReference: 'DUMMY-REF-1' });
    check(bad.status === 409, 'unapproved evidence document refused', bad);
    await post('legal', '/api/documents', { action: 'transition', reference: REF, id: doc.data.id, status: 'in_review' });
    check((await post('legal', '/api/documents', { action: 'transition', reference: REF, id: doc.data.id, status: 'approved' })).status === 200, 'approve evidence doc');
    check((await post('bank', '/api/finance', { action: 'record_execution_evidence', reference: REF, instructionId: state.instruction, evidenceDocumentId: doc.data.id, amount: 1, currency: 'USD', provider: 'Dummy Bank', providerReference: 'DUMMY-REF-1' })).status === 409, 'wrong amount refused');
    const rec = await post('bank', '/api/finance', { action: 'record_execution_evidence', reference: REF, instructionId: state.instruction, evidenceDocumentId: doc.data.id, amount: 250000, currency: 'USD', provider: 'Dummy Bank', providerReference: 'DUMMY-REF-1' });
    check(rec.status === 201 && rec.data.fundsTransferred === false, 'recorded', rec);
    check((await post('bank', '/api/finance', { action: 'record_execution_evidence', reference: REF, instructionId: state.instruction, evidenceDocumentId: doc.data.id, amount: 250000, currency: 'USD', provider: 'Dummy Bank', providerReference: 'DUMMY-REF-1' })).status === 409, 'duplicate reference refused');
    check((await post('bank', '/api/finance', { action: 'decide_execution_evidence', reference: REF, id: rec.data.id, decision: 'confirmed' })).status === 409, 'recorder cannot confirm own');
    const done = await post('owner', '/api/finance', { action: 'decide_execution_evidence', reference: REF, id: rec.data.id, decision: 'confirmed' });
    check(done.status === 200 && done.data.fundsTransferred === false, 'independent confirmation', done);
  });

  console.log('\nNotifications and audit');
  await step('per-user notification read state is isolated', async () => {
    const before = (await get('owner', `/api/notifications?reference=${REF}`)).data;
    check(before.notifications.length > 0, 'owner has notifications from the urgent message', before);
    const target = before.notifications[0];
    const legalBefore = (await get('legal', `/api/notifications?reference=${REF}`)).data.notifications.find(n => n.id === target.id);
    check((await post('owner', '/api/notifications', { action: 'mark_read', reference: REF, id: target.id })).status === 200, 'owner marks read');
    const ownerAfter = (await get('owner', `/api/notifications?reference=${REF}`)).data.notifications.find(n => n.id === target.id);
    check(ownerAfter.readAt, 'read for owner', ownerAfter);
    if (legalBefore) { const legalAfter = (await get('legal', `/api/notifications?reference=${REF}`)).data.notifications.find(n => n.id === target.id); check(!legalAfter.readAt, 'still unread for legal', legalAfter); }
    check((await get('outsider', `/api/notifications?reference=${REF}`)).status === 403, 'outsider denied');
  });
  await step('audit trail records recent key actions with the real actor identity', async () => {
    const events = (await get('owner', `/api/access?reference=${REF}`)).data.events;
    const actions = events.map(e => e.action);
    for (const action of ['payment_execution_evidence_confirmed', 'payment_instruction_approved', 'bank_detail_change_approved']) check(actions.includes(action), `audit has ${action}`, actions);
    check(events.every(e => /@/.test(e.actorEmail) || e.actorEmail), 'every event has an actor');
    check(events.find(e => e.action === 'bank_detail_change_approved').actorEmail === USERS.legal.email, 'second approval attributed to legal');
  });
}

const failed = () => results.filter(r => !r.ok);

async function main() {
  const stateDir = mkdtempSync(path.join(tmpdir(), 'fueltrade-e2e-'));
  const { server } = createMockProviders();
  await new Promise(resolve => server.listen(MOCK_PORT, '127.0.0.1', resolve));
  console.log(`Dummy providers on ${MOCK}; app state in ${stateDir}`);
  let app;
  try {
    console.log('Applying migrations to a fresh local D1...');
    for (const file of readdirSync(path.join(root, 'drizzle')).filter(f => f.endsWith('.sql')).sort()) {
      const r = spawnSync('node', [...wrangler, 'd1', 'execute', 'DB', '--local', '--config', 'dist/server/wrangler.json', '--persist-to', stateDir, '--file', `drizzle/${file}`], { cwd: root, encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`Migration ${file} failed:\n${r.stdout}\n${r.stderr}`);
    }
    const vars = Object.entries(dummyVariables(MOCK)).flatMap(([k, v]) => ['--var', `${k}:${v}`]);
    app = spawn('node', [...wrangler, 'dev', '--config', 'dist/server/wrangler.json', '--local', '--persist-to', stateDir, '--ip', '127.0.0.1', '--port', String(APP_PORT), '--inspector-port', '0', ...vars], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let appLog = ''; app.stdout.on('data', d => { appLog += d; }); app.stderr.on('data', d => { appLog += d; });
    await waitFor(`${APP}/api/providers`);
    await scenarios();
    if (failed().length) console.log('\nApp log tail:\n' + appLog.split('\n').slice(-25).join('\n'));
  } finally {
    app?.kill('SIGTERM'); server.close();
  }
  console.log(`\n${results.length - failed().length}/${results.length} passed`);
  process.exit(failed().length ? 1 : 0);
}

main().catch(error => { console.error(error); process.exit(1); });
