// Dummy provider server. Speaks the HTTP shapes FuelTrade OS expects from each external service.
// NOTHING here is real: no signatures, screening, tracking, messages or prices are genuine.
// Run: node dummy/mock-providers.mjs [port]     (default 8799, loopback only)

import http from 'node:http';
import crypto from 'node:crypto';

export const DEFAULT_PORT = 8799;

export function createMockProviders() {
  const state = { envelopes: new Map(), log: [], failing: new Set(), messages: [] };
  const log = (provider, method, path, extra = {}) => state.log.push({ at: Date.now(), provider, method, path, ...extra });

  const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const readBody = req => new Promise(resolve => { const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); });

  async function handle(req, res) {
    const url = new URL(req.url, 'http://mock');
    const path = url.pathname;
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : Buffer.alloc(0);

    // ---- control plane (tests only) ----
    if (path === '/__control/log') return json(res, 200, state.log);
    if (path === '/__control/reset') { state.envelopes.clear(); state.log.length = 0; state.failing.clear(); state.messages.length = 0; return json(res, 200, { ok: true }); }
    let m;
    if ((m = path.match(/^\/__control\/fail\/(\w+)$/))) { if (req.method === 'DELETE') state.failing.delete(m[1]); else state.failing.add(m[1]); return json(res, 200, { failing: [...state.failing] }); }
    if ((m = path.match(/^\/__control\/documenso\/complete\/([\w-]+)$/))) {
      const env = state.envelopes.get(m[1]);
      if (!env) return json(res, 404, { error: 'unknown envelope' });
      env.status = 'COMPLETED';
      return json(res, 200, { id: m[1], status: env.status });
    }
    if (path === '/health') return json(res, 200, { ok: true, dummy: true });

    const provider = path.split('/')[1];
    if (state.failing.has(provider)) { log(provider, req.method, path, { failed: true }); return json(res, 503, { error: 'simulated outage', dummy: true }); }

    // ---- Documenso: /documenso/api/v2 ----
    if (provider === 'documenso') {
      const sub = path.replace('/documenso/api/v2', '');
      log('documenso', req.method, sub);
      if (!req.headers.authorization) return json(res, 401, { error: 'missing token' });
      if (sub === '/envelope/create' && req.method === 'POST') {
        const text = body.toString('latin1');
        const pdfStart = text.indexOf('%PDF-');
        const id = `env_${crypto.randomUUID().slice(0, 8)}`;
        const original = pdfStart >= 0 ? Buffer.from(text.slice(pdfStart), 'latin1') : Buffer.from('%PDF-1.4\n%dummy\n');
        state.envelopes.set(id, { status: 'DRAFT', itemId: `item_${id}`, original });
        return json(res, 200, { id });
      }
      if (sub === '/envelope/distribute' && req.method === 'POST') {
        const { envelopeId } = JSON.parse(body.toString() || '{}');
        const env = state.envelopes.get(envelopeId);
        if (!env) return json(res, 404, { error: 'unknown envelope' });
        env.status = 'PENDING';
        return json(res, 200, { success: true });
      }
      if ((m = sub.match(/^\/envelope\/item\/([\w-]+)\/download$/))) {
        const env = [...state.envelopes.values()].find(e => e.itemId === m[1]);
        if (!env || env.status !== 'COMPLETED') return json(res, 409, { error: 'not completed' });
        const signed = Buffer.concat([env.original, Buffer.from('\n%DUMMY-SIGNED-NOT-A-REAL-SIGNATURE\n')]);
        res.writeHead(200, { 'content-type': 'application/pdf' }); return res.end(signed);
      }
      if ((m = sub.match(/^\/envelope\/([\w-]+)$/)) && req.method === 'GET') {
        const env = state.envelopes.get(m[1]);
        if (!env) return json(res, 404, { error: 'unknown envelope' });
        return json(res, 200, { id: m[1], status: env.status, envelopeItems: [{ id: env.itemId }] });
      }
      return json(res, 404, { error: 'unsupported documenso path' });
    }

    // ---- Chatwoot: /chatwoot/api/v1/accounts/:id/conversations/:cid[/messages] ----
    if (provider === 'chatwoot') {
      log('chatwoot', req.method, path.replace('/chatwoot', ''));
      if (!req.headers.api_access_token) return json(res, 401, { error: 'missing token' });
      if ((m = path.match(/\/conversations\/(\d+)\/messages$/)) && req.method === 'POST') {
        const payload = JSON.parse(body.toString() || '{}');
        const message = { id: 9000 + state.messages.length, conversation: m[1], content: payload.content };
        state.messages.push(message);
        return json(res, 200, message);
      }
      if ((m = path.match(/\/conversations\/(\d+)$/)) && req.method === 'GET') {
        if (Number(m[1]) < 1000 || Number(m[1]) > 1099) return json(res, 404, { error: 'not found' });
        return json(res, 200, { id: Number(m[1]), status: 'open', inbox_id: 1, meta: { sender: { name: 'Dummy Counterparty', email: 'counterparty@dummy.invalid' } } });
      }
      return json(res, 404, { error: 'unsupported chatwoot path' });
    }

    // ---- Novu: POST /novu/v1/events/trigger ----
    if (provider === 'novu') {
      log('novu', req.method, path.replace('/novu', ''), { transactionId: JSON.parse(body.toString() || '{}').transactionId });
      if (!String(req.headers.authorization || '').startsWith('ApiKey ')) return json(res, 401, { error: 'missing key' });
      return json(res, 201, { data: { acknowledged: true, status: 'processed', transactionId: JSON.parse(body.toString() || '{}').transactionId } });
    }

    // ---- yente / OpenSanctions: POST /yente/match/default ----
    if (provider === 'yente') {
      const query = JSON.parse(body.toString() || '{}')?.queries?.q ?? {};
      const name = String(query?.properties?.name?.[0] ?? '');
      log('yente', req.method, path.replace('/yente', ''), { name });
      const results = [];
      if (/sanction/i.test(name)) results.push({ id: 'dummy-ent-001', caption: `${name} (DUMMY SANCTIONED ENTITY)`, schema: query.schema || 'Company', score: 0.96, match: true, properties: { topics: ['sanction'] }, datasets: ['dummy_sanctions'] });
      else if (/similar/i.test(name)) results.push({ id: 'dummy-ent-002', caption: `${name} (DUMMY NAME-ALIKE)`, schema: query.schema || 'Company', score: 0.74, match: false, properties: { topics: [] }, datasets: ['dummy_watchlist'] });
      return json(res, 200, { responses: { q: { status: 200, results, total: { value: results.length } } } });
    }

    // ---- Vessel tracking: GET /tracking/position?imo= ----
    if (provider === 'tracking') {
      const imo = url.searchParams.get('imo') || '';
      log('tracking', req.method, '/position', { imo });
      if (!/^\d{7}$/.test(imo)) return json(res, 400, { error: 'imo required' });
      const seed = Number(imo.slice(-3));
      return json(res, 200, { position: { latitude: 25.2 + seed / 1000, longitude: 55.3 + seed / 1000, speedKnots: 12.4, courseDegrees: 118, positionAt: new Date().toISOString() } });
    }

    // ---- OpenAI-compatible: POST /ai/v1/chat/completions ----
    if (provider === 'ai') {
      log('ai', req.method, path.replace('/ai', ''));
      return json(res, 200, { choices: [{ message: { content: 'DUMMY DRAFT: Thank you for your message. We are reviewing it and will confirm any prices, dates or commitments in writing once verified.' } }] });
    }

    // ---- EIA: /eia/v2/petroleum/... ----
    if (provider === 'eia') {
      log('eia', req.method, path.replace('/eia/v2', ''));
      const stocks = path.includes('/wstk/');
      const series = stocks ? ['WCESTUS1', 'WGTSTUS1', 'WDISTUS1'] : ['RBRTE', 'RWTC', 'EER_EPD2DXL0_PF4_Y35NY_DPG', 'EER_EPMRU_PF4_Y35NY_DPG', 'EER_EPJK_PF4_RGC_DPG'];
      const days = stocks ? 12 : 40, step = stocks ? 7 : 1, data = [];
      series.forEach((id, si) => {
        for (let i = 0; i < days; i++) {
          const date = new Date(Date.UTC(2026, 10, 13) - i * step * 86400000).toISOString().slice(0, 10);
          const base = stocks ? 400000 + si * 50000 : id.startsWith('R') ? 80 + si : 2.5 + si * 0.1;
          data.push({ period: date, series: id, seriesDescription: `DUMMY ${id}`, value: String(+(base + Math.sin(i) * (stocks ? 2000 : 1.2)).toFixed(2)), units: stocks ? 'MBBL' : id.startsWith('R') ? '$/BBL' : '$/GAL' });
        }
      });
      return json(res, 200, { response: { data } });
    }

    // ---- ECB: GET /ecb/eurofxref-daily.xml ----
    if (provider === 'ecb') {
      log('ecb', req.method, '/eurofxref-daily.xml');
      res.writeHead(200, { 'content-type': 'application/xml' });
      return res.end(`<?xml version="1.0" encoding="UTF-8"?><gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><Cube><Cube time='2026-11-13'><Cube currency='USD' rate='1.0800'/><Cube currency='GBP' rate='0.8600'/><Cube currency='AED' rate='3.9660'/><Cube currency='CHF' rate='0.9400'/></Cube></Cube></gesmes:Envelope>`);
    }

    return json(res, 404, { error: 'unknown dummy provider', path });
  }

  const server = http.createServer((req, res) => { handle(req, res).catch(error => json(res, 500, { error: String(error) })); });
  return { server, state };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || DEFAULT_PORT);
  const { server } = createMockProviders();
  server.listen(port, '127.0.0.1', () => console.log(`Dummy providers listening on http://127.0.0.1:${port} (simulated; nothing here is real)`));
}
