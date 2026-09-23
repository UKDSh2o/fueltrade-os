import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

const API_ROOT = "https://api.eia.gov/v2";

type EiaRow = { period?: string; series?: string; seriesDescription?: string; value?: string | number; units?: string };

async function eia(path: string, key: string) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${API_ROOT}${path}${separator}api_key=${encodeURIComponent(key)}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`EIA returned ${response.status}`);
  return response.json() as Promise<any>;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const key = String((env as any).EIA_API_KEY ?? "").trim();
  if (!key) {
    return Response.json({
      configured: false,
      source: { name: "U.S. Energy Information Administration", url: "https://www.eia.gov/opendata/" },
      message: "A free EIA API key is required for live petroleum benchmarks.",
    });
  }
  try {
    const priceSeries: Record<string,string> = {
      RBRTE: "brent",
      RWTC: "wti",
      EER_EPD2DXL0_PF4_Y35NY_DPG: "ulsd",
      EER_EPMRU_PF4_Y35NY_DPG: "gasoline",
      EER_EPJK_PF4_RGC_DPG: "jet",
    };
    const stockSeries: Record<string,string> = { WCESTUS1: "crude", WGTSTUS1: "gasoline", WDISTUS1: "distillate" };
    const priceFacets = Object.keys(priceSeries).map(series => `facets[series][]=${encodeURIComponent(series)}`).join("&");
    const stockFacets = Object.keys(stockSeries).map(series => `facets[series][]=${encodeURIComponent(series)}`).join("&");
    const pricesPath = `/petroleum/pri/spt/data/?frequency=daily&data[0]=value&${priceFacets}&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=400`;
    const stocksPath = `/petroleum/stoc/wstk/data/?frequency=weekly&data[0]=value&${stockFacets}&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=180`;
    const [pricePayload, stockPayload] = await Promise.all([eia(pricesPath, key), eia(stocksPath, key)]);
    const rows: EiaRow[] = pricePayload?.response?.data ?? [];
    const stockRows: EiaRow[] = stockPayload?.response?.data ?? [];
    const grouped = rows.reduce((result: Record<string, any[]>, row) => {
      const series = priceSeries[String(row.series)] ?? row.series ?? "other";
      (result[series] ??= []).push({ date: row.period, value: Number(row.value), unit: row.units });
      return result;
    }, {});
    const groupedStocks = stockRows.reduce((result: Record<string, any[]>, row) => {
      const series = stockSeries[String(row.series)] ?? row.series ?? "other";
      (result[series] ??= []).push({ date: row.period, value: Number(row.value), unit: row.units });
      return result;
    }, {});
    const summarize = (items: any[] = []) => {
      const clean = items.filter(item => Number.isFinite(item.value)).sort((a,b) => String(a.date).localeCompare(String(b.date)));
      const latest = clean.at(-1) ?? null;
      const prior = clean.at(-2) ?? null;
      const thirty = clean.slice(-30);
      return {
        latest,
        change: latest && prior ? latest.value - prior.value : null,
        changePct: latest && prior && prior.value ? (latest.value - prior.value) / prior.value * 100 : null,
        high30: thirty.length ? Math.max(...thirty.map(item => item.value)) : null,
        low30: thirty.length ? Math.min(...thirty.map(item => item.value)) : null,
        history: clean.slice(-30),
      };
    };
    const summarizeStock = (items: any[] = []) => {
      const clean = items.filter(item => Number.isFinite(item.value)).sort((a,b) => String(a.date).localeCompare(String(b.date)));
      const latest = clean.at(-1) ?? null;
      const prior = clean.at(-2) ?? null;
      const trailing = clean.slice(-5,-1);
      const average4 = trailing.length ? trailing.reduce((sum,item)=>sum+item.value,0)/trailing.length : null;
      return { latest, prior, change: latest && prior ? latest.value-prior.value : null, average4, vsAverage4: latest && average4 ? latest.value-average4 : null, history: clean.slice(-26) };
    };
    const brent = summarize(grouped.brent);
    const products = { ulsd: summarize(grouped.ulsd), gasoline: summarize(grouped.gasoline), jet: summarize(grouped.jet) };
    const crack = (product: any) => product?.latest && brent?.latest ? product.latest.value * 42 - brent.latest.value : null;
    return Response.json({
      configured: true,
      retrievedAt: Date.now(),
      source: { name: "U.S. Energy Information Administration", url: "https://www.eia.gov/opendata/" },
      benchmarks: { brent, wti: summarize(grouped.wti) },
      products,
      cracks: { diesel: crack(products.ulsd), gasoline: crack(products.gasoline), jet: crack(products.jet) },
      inventories: { crude: summarizeStock(groupedStocks.crude), gasoline: summarizeStock(groupedStocks.gasoline), distillate: summarizeStock(groupedStocks.distillate) },
    }, { headers: { "cache-control": "private, max-age=900" } });
  } catch (error) {
    console.error("EIA petroleum feed unavailable", error);
    return Response.json({ configured: true, error: "EIA petroleum feed is temporarily unavailable", retrievedAt: Date.now() }, { status: 503 });
  }
}
