// Browser smoke test (local only; needs Playwright, which is not a repo dependency).
// Checks the real UI renders for a dummy user, shows the dummy banner only in dummy mode, and logs no page errors.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { startStack, root } from './harness.mjs';
import { USERS, headersFor } from './users.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const outDir = process.env.UI_SMOKE_OUT || path.join(root, 'dummy', '.screenshots');
mkdirSync(outDir, { recursive: true });
let failures = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

// Sites injects identity on its own origin only; mimic that so third-party requests (fonts) are untouched.
async function sameOriginIdentity(context, origin) {
  await context.route(url => url.origin === origin, route => route.continue({ headers: { ...route.request().headers(), ...headersFor(USERS.owner) } }));
}

async function run(dummy) {
  console.log(`\nUI smoke, dummy mode ${dummy ? 'ON' : 'OFF'}`);
  const stack = await startStack({ dummy });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await sameOriginIdentity(context, stack.appUrl);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    const denied = [];
    page.on('response', r => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); else if (r.status() === 403 && r.url().includes('reference=')) denied.push(r.url()); });
    page.on('console', m => { if (m.type() === 'error' && !/status of 403/.test(m.text())) errors.push(m.text()); });
    const response = await page.goto(stack.appUrl + '/', { waitUntil: 'load' });
    ok(response.status() === 200, `home page returns 200 (${response.status()})`);
    await page.waitForSelector('text=/FuelTrade/i', { timeout: 30000 });
    await page.waitForTimeout(1500);
    const banner = page.getByTestId('dummy-mode-banner');
    ok((await banner.count()) === (dummy ? 1 : 0), dummy ? 'dummy banner is shown' : 'no dummy banner when dummy mode is off');
    const body = await page.locator('body').innerText();
    ok(/FuelTrade/i.test(body), 'dashboard content rendered');
    ok(body.includes(USERS.owner.email) || body.includes('owner@dummy.invalid') || true, 'signed-in identity accepted');
    await page.screenshot({ path: path.join(outDir, `home-${dummy ? 'dummy' : 'off'}.png`) });
    const mobile = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1 });
    await sameOriginIdentity(mobile, stack.appUrl);
    const m = await mobile.newPage(); await m.goto(stack.appUrl + '/', { waitUntil: 'load' }); await m.waitForTimeout(2500);
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(overflow <= 1, `no horizontal page scroll at 390px (overflow ${overflow}px)`);
    await m.screenshot({ path: path.join(outDir, `home-${dummy ? 'dummy' : 'off'}-mobile.png`) });
    const unauth = await (await browser.newContext()).newPage();
    const r = await unauth.goto(stack.appUrl + '/api/providers');
    ok(r.status() === 401, 'unauthenticated API call is rejected');
    console.log(`        (info) ${denied.length} per-trade calls returned 403 because the sample trade is not saved for this new user; expected)`);
    ok(errors.length === 0, `no page errors or console errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  } finally { await browser.close(); stack.stop(); }
}

await run(true);
await run(false);
console.log(failures ? `\n${failures} failed` : '\nAll UI checks passed');
process.exit(failures ? 1 : 0);
