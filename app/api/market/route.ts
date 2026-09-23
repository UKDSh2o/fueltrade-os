import { getChatGPTUser } from "../../chatgpt-auth";

const ECB_DAILY = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const response = await fetch(ECB_DAILY, { headers: { accept: "application/xml" } });
    if (!response.ok) throw new Error(`ECB returned ${response.status}`);
    const xml = await response.text();
    const date = xml.match(/time=['"]([^'"]+)['"]/)?.[1] ?? null;
    const read = (currency: string) => {
      const match = xml.match(new RegExp(`currency=['"]${currency}['"]\\s+rate=['"]([^'"]+)['"]`));
      return match ? Number(match[1]) : null;
    };
    const usd = read("USD");
    const gbp = read("GBP");
    if (!usd || !gbp) throw new Error("Required ECB rates were missing");
    return Response.json({
      asOf: date,
      retrievedAt: Date.now(),
      source: { name: "European Central Bank", url: "https://data.ecb.europa.eu/" },
      base: "EUR",
      rates: { EUR: 1, USD: usd, GBP: gbp, LKR: null },
      crosses: { USD_EUR: 1 / usd, GBP_USD: usd / gbp, USD_GBP: gbp / usd },
      status: "official_reference",
    }, { headers: { "cache-control": "public, max-age=1800" } });
  } catch (error) {
    console.error("ECB market feed unavailable", error);
    return Response.json({
      error: "Official FX feed is temporarily unavailable",
      source: { name: "European Central Bank", url: "https://data.ecb.europa.eu/" },
      status: "unavailable",
      retrievedAt: Date.now(),
    }, { status: 503 });
  }
}
