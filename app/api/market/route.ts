import { getChatGPTUser } from "../../chatgpt-auth";
import { crossRate, parseEcbDailyXml } from "../../../lib/fx-reference.js";

const ECB_DAILY = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const response = await fetch(ECB_DAILY, { headers: { accept: "application/xml" } });
    if (!response.ok) throw new Error(`ECB returned ${response.status}`);
    const xml = await response.text();
    const { asOf, rates } = parseEcbDailyXml(xml);
    const availableCurrencies = Object.keys(rates).sort();
    return Response.json({
      asOf,
      retrievedAt: Date.now(),
      source: { name: "European Central Bank", url: "https://data.ecb.europa.eu/" },
      base: "EUR",
      rates,
      availableCurrencies,
      crosses: {
        USD_EUR: crossRate(rates, "USD", "EUR"),
        GBP_USD: crossRate(rates, "GBP", "USD"),
        USD_GBP: crossRate(rates, "USD", "GBP"),
      },
      status: "official_reference",
      usage: "reference_only",
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
