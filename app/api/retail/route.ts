import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission } from "../../access-control";

const respond = (body: unknown, status = 200) => Response.json(body, { status });
const clean = (value: unknown, max = 120) => String(value ?? "").trim().slice(0, max);
const bounded = (value: unknown, max = 1_000_000_000) => Math.max(0, Math.min(max, Number(value) || 0));
const cents = (value: unknown) => Math.round(bounded(value, 100_000_000) * 100);

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Retail operations storage is unavailable" }, 503);
  const url = new URL(request.url);
  const reference = clean(url.searchParams.get("reference"), 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "trade", "view");
  if (!access) return respond({ error: "Retail access denied" }, 403);
  const row = await env.DB.prepare(`SELECT id, station_name AS stationName, business_date AS businessDate, products_json AS productsJson, operating_cost_cents AS operatingCostCents, variance_threshold_bps AS varianceThresholdBps, status, updated_at AS updatedAt FROM retail_reconciliations WHERE owner_id = ? AND trade_reference = ? ORDER BY business_date DESC, updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>();
  return respond({ reconciliation: row ? { ...row, products: JSON.parse(row.productsJson) } : null });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Retail operations storage is unavailable" }, 503);
  const body = await request.json() as any;
  const reference = clean(body.reference, 100);
  const stationName = clean(body.stationName, 100);
  const businessDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.businessDate ?? "")) ? body.businessDate : "";
  if (!reference || !stationName || !businessDate) return respond({ error: "Trade, station and business date are required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "trade", "edit");
  if (!access) return respond({ error: "Retail edit permission required" }, 403);
  const products = Array.isArray(body.products) ? body.products.slice(0, 8).map((item: any) => ({
    key: clean(item.key, 40) || crypto.randomUUID(),
    name: clean(item.name, 80),
    tankCapacityLitres: bounded(item.tankCapacityLitres),
    openingLitres: bounded(item.openingLitres),
    deliveriesLitres: bounded(item.deliveriesLitres),
    openingTotaliserLitres: bounded(item.openingTotaliserLitres),
    closingTotaliserLitres: bounded(item.closingTotaliserLitres),
    physicalClosingLitres: bounded(item.physicalClosingLitres),
    sellingPricePerLitre: bounded(item.sellingPricePerLitre, 10_000),
  })) : [];
  if (!products.length || products.some((item: any) => !item.name)) return respond({ error: "At least one named product is required" }, 400);
  const now = Date.now();
  const existing = await env.DB.prepare(`SELECT id, created_at AS createdAt FROM retail_reconciliations WHERE owner_id = ? AND trade_reference = ? AND station_name = ? AND business_date = ? LIMIT 1`).bind(access.ownerId, reference, stationName, businessDate).first<any>();
  const id = existing?.id ?? crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO retail_reconciliations (id, owner_id, trade_reference, station_name, business_date, products_json, operating_cost_cents, variance_threshold_bps, status, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET products_json=excluded.products_json, operating_cost_cents=excluded.operating_cost_cents, variance_threshold_bps=excluded.variance_threshold_bps, status=excluded.status, updated_at=excluded.updated_at`).bind(id, access.ownerId, reference, stationName, businessDate, JSON.stringify(products), cents(body.operatingCost), Math.round(bounded(body.varianceThresholdPct, 10) * 100), ["draft","submitted","reviewed","closed"].includes(body.status) ? body.status : "draft", now, existing?.createdAt ?? now).run();
  return respond({ id, updatedAt: now });
}
