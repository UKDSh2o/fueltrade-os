export function parseEcbDailyXml(xml) {
  const asOf = xml.match(/time=['"]([^'"]+)['"]/)?.[1] ?? null;
  const rates = { EUR: 1 };
  const pattern = /currency=['"]([A-Z]{3})['"]\s+rate=['"]([^'"]+)['"]/g;
  for (const match of xml.matchAll(pattern)) {
    const value = Number(match[2]);
    if (Number.isFinite(value) && value > 0) rates[match[1]] = value;
  }
  if (!asOf || !rates.USD) throw new Error("Required ECB reference data was missing");
  return { asOf, rates };
}

export function crossRate(rates, base, quote) {
  const baseRate = rates?.[base];
  const quoteRate = rates?.[quote];
  if (!Number.isFinite(baseRate) || !Number.isFinite(quoteRate) || baseRate <= 0 || quoteRate <= 0) return null;
  return quoteRate / baseRate;
}

export function uniqueCurrencyCodes(values) {
  return [...new Set(values.map(value => String(value || "").trim().toUpperCase()).filter(value => /^[A-Z]{3}$/.test(value)))];
}
