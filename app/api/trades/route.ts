import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { resolveTradeAccess, requireTradePermission } from "../../access-control";
import { redactTradeForMarginScope } from "../../../lib/access-control.js";

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Sign in required" }, 401);
  if (!env.DB) return json({ error: "Trade storage is unavailable" }, 503);
  const rows = await env.DB.prepare(`
    SELECT t.id, t.owner_id AS ownerId, t.reference, t.product, t.route, t.status,
      t.volume_mt AS volumeMt, t.net_profit_cents AS netProfitCents,
      t.trade_json AS tradeJson, t.updated_at AS updatedAt,
      'owner' AS role, 'all' AS marginScope, '{}' AS permissionsJson, 1 AS isOwner
    FROM trades t WHERE t.owner_id = ?
    UNION ALL
    SELECT t.id, t.owner_id AS ownerId, t.reference, t.product, t.route, t.status,
      t.volume_mt AS volumeMt, t.net_profit_cents AS netProfitCents,
      t.trade_json AS tradeJson, t.updated_at AS updatedAt,
      tm.role, tm.margin_scope AS marginScope, tm.permissions_json AS permissionsJson, 0 AS isOwner
    FROM trades t INNER JOIN trade_members tm
      ON tm.owner_id = t.owner_id AND tm.trade_reference = t.reference
    WHERE tm.member_user_id = ? AND tm.status = 'active'
    ORDER BY updatedAt DESC LIMIT 50
  `).bind(user.userId, user.userId).all();
  return json({ trades: rows.results.map((row: any) => {
    const isOwner = Boolean(row.isOwner);
    const trade = redactTradeForMarginScope(JSON.parse(row.tradeJson), row.marginScope, isOwner);
    const netProfitCents = isOwner || row.marginScope === "all" ? row.netProfitCents : null;
    return {
      id: row.id, ownerId: row.ownerId, reference: row.reference, product: row.product,
      route: row.route, status: row.status, volumeMt: row.volumeMt, netProfitCents,
      updatedAt: row.updatedAt, trade,
      access: { isOwner, role: row.role, marginScope: row.marginScope, permissions: JSON.parse(row.permissionsJson) },
    };
  }) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "Sign in required" }, 401);
  if (!env.DB) return json({ error: "Trade storage is unavailable" }, 503);
  const body = await request.json() as any;
  const trade = body.trade;
  if (!trade || !trade.reference || !trade.product || !Number.isFinite(Number(trade.volumeMt))) return json({ error: "Invalid trade model" }, 400);
  const now = Date.now();
  const reference = String(trade.reference);
  const resolved = await resolveTradeAccess(env.DB, user, reference);
  if (resolved && !await requireTradePermission(env.DB, user, reference, "trade", "edit")) return json({ error: "Trade edit permission required" }, 403);
  const ownerId = resolved?.ownerId ?? user.userId;
  const existing = await env.DB.prepare(`SELECT id, created_at FROM trades WHERE owner_id = ? AND reference = ? LIMIT 1`).bind(ownerId, reference).first<any>();
  const id = existing?.id ?? crypto.randomUUID();
  const createdAt = existing?.created_at ?? now;
  await env.DB.prepare(`INSERT INTO trades (id, owner_id, reference, product, route, status, volume_mt, buy_price_cents, sell_price_cents, trade_json, net_profit_cents, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET reference=excluded.reference, product=excluded.product, route=excluded.route, status=excluded.status, volume_mt=excluded.volume_mt, buy_price_cents=excluded.buy_price_cents, sell_price_cents=excluded.sell_price_cents, trade_json=excluded.trade_json, net_profit_cents=excluded.net_profit_cents, updated_at=excluded.updated_at`).bind(id,ownerId,reference,String(trade.product),String(trade.route),"draft",Math.round(Number(trade.volumeMt)),Math.round(Number(trade.buyPrice)*100),Math.round(Number(trade.sellPrice)*100),JSON.stringify(trade),Math.round(Number(body.netProfit)*100),now,createdAt).run();
  return json({ id, savedAt: now });
}
