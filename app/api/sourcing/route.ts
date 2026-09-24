import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission } from "../../access-control";

const respond = (body: unknown, status = 200) => Response.json(body, { status });
const clean = (value: unknown, max = 120) => String(value ?? "").trim().slice(0, max);
const bounded = (value: unknown, max = 1_000_000_000) => Math.max(0, Math.min(max, Number(value) || 0));
const allowedTypes = ["refinery","corporate","trader","agent"];
const allowedDd = ["pending","in_review","approved","blocked"];

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Sourcing storage is unavailable" }, 503);
  const reference = clean(new URL(request.url).searchParams.get("reference"), 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "trade", "view");
  if (!access) return respond({ error: "Sourcing access denied" }, 403);
  const row = await env.DB.prepare(`SELECT id, ranking_mode AS rankingMode, selected_quote_key AS selectedQuoteKey, quotes_json AS quotesJson, status, updated_at AS updatedAt FROM sourcing_comparisons WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>();
  return respond({ comparison: row ? { ...row, quotes: JSON.parse(row.quotesJson) } : null });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Sourcing storage is unavailable" }, 503);
  const body = await request.json() as any;
  const reference = clean(body.reference, 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "trade", "edit");
  if (!access) return respond({ error: "Sourcing edit permission required" }, 403);
  const quotes = Array.isArray(body.quotes) ? body.quotes.slice(0, 10).map((quote: any) => ({
    key: clean(quote.key, 40) || crypto.randomUUID(),
    supplierName: clean(quote.supplierName, 100),
    supplierType: allowedTypes.includes(quote.supplierType) ? quote.supplierType : "trader",
    counterpartyId: clean(quote.counterpartyId, 80),
    buyPrice: bounded(quote.buyPrice, 100_000),
    premium: bounded(quote.premium, 100_000),
    commission: bounded(quote.commission, 100_000),
    freightAdjustment: bounded(quote.freightAdjustment, 100_000),
    leadDays: Math.round(bounded(quote.leadDays, 365)),
    creditDays: Math.round(bounded(quote.creditDays, 365)),
    minimumVolumeMt: Math.round(bounded(quote.minimumVolumeMt)),
    validUntil: /^\d{4}-\d{2}-\d{2}$/.test(String(quote.validUntil ?? "")) ? quote.validUntil : "",
    confidence: Math.round(bounded(quote.confidence, 100)),
    dueDiligenceStatus: allowedDd.includes(quote.dueDiligenceStatus) ? quote.dueDiligenceStatus : "pending",
    notes: clean(quote.notes, 300),
  })) : [];
  if (!quotes.length || quotes.some((quote: any) => !quote.supplierName)) return respond({ error: "At least one named supplier quotation is required" }, 400);
  const now = Date.now();
  const existing = await env.DB.prepare(`SELECT id, created_at AS createdAt FROM sourcing_comparisons WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>();
  const id = existing?.id ?? crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO sourcing_comparisons (id, owner_id, trade_reference, ranking_mode, selected_quote_key, quotes_json, status, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET ranking_mode=excluded.ranking_mode, selected_quote_key=excluded.selected_quote_key, quotes_json=excluded.quotes_json, status=excluded.status, updated_at=excluded.updated_at`).bind(id, access.ownerId, reference, ["margin","risk","funding"].includes(body.rankingMode) ? body.rankingMode : "margin", clean(body.selectedQuoteKey, 40), JSON.stringify(quotes), ["draft","review","selected","approved"].includes(body.status) ? body.status : "draft", now, existing?.createdAt ?? now).run();
  return respond({ id, updatedAt: now });
}
