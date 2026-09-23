import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Sign in required" }, 401);
  if (!env.DB) return json({ error: "Trade storage is unavailable" }, 503);
  const rows = await env.DB.prepare(`SELECT id, reference, product, route, status, volume_mt AS volumeMt, net_profit_cents AS netProfitCents, trade_json AS tradeJson, updated_at AS updatedAt FROM trades WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 50`).bind(user.userId).all();
  return json({ trades: rows.results.map((row: any) => ({ ...row, trade: JSON.parse(row.tradeJson) })) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Sign in required" }, 401);
  if (!env.DB) return json({ error: "Trade storage is unavailable" }, 503);
  const body = await request.json() as any;
  const trade = body.trade;
  if (!trade || !trade.reference || !trade.product || !Number.isFinite(Number(trade.volumeMt))) return json({ error: "Invalid trade model" }, 400);
  const now = Date.now();
  const existing = await env.DB.prepare(`SELECT id, created_at FROM trades WHERE owner_id = ? AND reference = ? LIMIT 1`).bind(user.userId, String(trade.reference)).first<any>();
  const id = existing?.id ?? crypto.randomUUID();
  const createdAt = existing?.created_at ?? now;
  await env.DB.prepare(`INSERT INTO trades (id, owner_id, reference, product, route, status, volume_mt, buy_price_cents, sell_price_cents, trade_json, net_profit_cents, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET reference=excluded.reference, product=excluded.product, route=excluded.route, status=excluded.status, volume_mt=excluded.volume_mt, buy_price_cents=excluded.buy_price_cents, sell_price_cents=excluded.sell_price_cents, trade_json=excluded.trade_json, net_profit_cents=excluded.net_profit_cents, updated_at=excluded.updated_at`).bind(id,user.userId,String(trade.reference),String(trade.product),String(trade.route),"draft",Math.round(Number(trade.volumeMt)),Math.round(Number(trade.buyPrice)*100),Math.round(Number(trade.sellPrice)*100),JSON.stringify(trade),Math.round(Number(body.netProfit)*100),now,createdAt).run();
  return json({ id, savedAt: now });
}
