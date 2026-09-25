import test from 'node:test';
import assert from 'node:assert/strict';
import { crossRate, parseEcbDailyXml, uniqueCurrencyCodes } from '../lib/fx-reference.js';

test('parses every valid ECB daily rate', () => {
  const xml = `<Cube><Cube time="2026-09-24"><Cube currency="USD" rate="1.18"/><Cube currency="GBP" rate="0.87"/><Cube currency="JPY" rate="174.20"/></Cube></Cube>`;
  assert.deepEqual(parseEcbDailyXml(xml), { asOf: '2026-09-24', rates: { EUR: 1, USD: 1.18, GBP: 0.87, JPY: 174.2 } });
});

test('calculates safe currency crosses from the EUR base', () => {
  const rates = { EUR: 1, USD: 1.2, GBP: 0.8 };
  assert.ok(Math.abs(crossRate(rates, 'USD', 'GBP') - (2 / 3)) < Number.EPSILON);
  assert.equal(crossRate(rates, 'USD', 'LKR'), null);
});

test('normalizes and deduplicates deal currency codes', () => {
  assert.deepEqual(uniqueCurrencyCodes(['usd', 'EUR', ' usd ', '', 'TOOLONG', 'lkr']), ['USD', 'EUR', 'LKR']);
});

test('rejects incomplete official feed data', () => {
  assert.throws(() => parseEcbDailyXml(`<Cube time="2026-09-24"><Cube currency="GBP" rate="0.87"/></Cube>`), /missing/);
});
