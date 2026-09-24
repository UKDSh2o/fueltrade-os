import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission } from "../../access-control";

const respond = (body: unknown, status = 200) => Response.json(body, { status });
const clean = (value: unknown, max = 180) => String(value ?? "").trim().slice(0, max);
const severities = ["critical","high","medium","low"];
const targets = ["market-intelligence","logistics","documents","due-diligence","finance","risk","approvals","downstream","retail-operations"];

async function list(ownerId: string, reference: string) {
  const result = await env.DB!.prepare(`SELECT id, event_key AS eventKey, category, severity, title, message, target, status, read_at AS readAt, last_seen_at AS lastSeenAt, created_at AS createdAt FROM notification_events WHERE owner_id = ? AND trade_reference = ? ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, last_seen_at DESC LIMIT 100`).bind(ownerId, reference).all<any>();
  const notifications = result.results ?? [];
  return { notifications, unreadCount: notifications.filter(item => item.status === "active" && !item.readAt).length };
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Notifications are unavailable" }, 503);
  const reference = clean(new URL(request.url).searchParams.get("reference"), 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "trade", "view");
  if (!access) return respond({ error: "Notification access denied" }, 403);
  return respond(await list(access.ownerId, reference));
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Notifications are unavailable" }, 503);
  const body = await request.json() as any;
  const reference = clean(body.reference, 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "trade", "view");
  if (!access) return respond({ error: "Notification access denied" }, 403);
  const now = Date.now();
  if (body.action === "sync") {
    if (!access.isOwner) return respond({ error: "Only the trade owner can synchronize notification rules" }, 403);
    const incoming = Array.isArray(body.events) ? body.events.slice(0, 30).map((event: any) => ({
      eventKey: clean(event.eventKey, 120), category: clean(event.category, 40),
      severity: severities.includes(event.severity) ? event.severity : "medium",
      title: clean(event.title, 120), message: clean(event.message, 300),
      target: targets.includes(event.target) ? event.target : "due-diligence",
    })).filter((event: any) => event.eventKey && event.title) : [];
    const existingResult = await env.DB.prepare(`SELECT id, event_key AS eventKey, status FROM notification_events WHERE owner_id = ? AND trade_reference = ?`).bind(access.ownerId, reference).all<any>();
    const existing = existingResult.results ?? [];
    const byKey = new Map(existing.map(item => [item.eventKey, item]));
    const activeKeys = new Set(incoming.map((item: any) => item.eventKey));
    const statements: any[] = [];
    for (const event of incoming) {
      const match: any = byKey.get(event.eventKey);
      if (match) statements.push(env.DB.prepare(`UPDATE notification_events SET category=?, severity=?, title=?, message=?, target=?, status='active', last_seen_at=? WHERE id=? AND owner_id=?`).bind(event.category,event.severity,event.title,event.message,event.target,now,match.id,access.ownerId));
      else statements.push(env.DB.prepare(`INSERT INTO notification_events (id, owner_id, trade_reference, event_key, category, severity, title, message, target, status, read_at, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)`).bind(crypto.randomUUID(),access.ownerId,reference,event.eventKey,event.category,event.severity,event.title,event.message,event.target,now,now));
    }
    for (const item of existing) if (item.status === "active" && !activeKeys.has(item.eventKey)) statements.push(env.DB.prepare(`UPDATE notification_events SET status='resolved', last_seen_at=? WHERE id=? AND owner_id=?`).bind(now,item.id,access.ownerId));
    if (statements.length) await env.DB.batch(statements);
  } else if (body.action === "mark_read") {
    if (!access.isOwner) return respond({ error: "Personal notification state for participants is not enabled yet" }, 403);
    await env.DB.prepare(`UPDATE notification_events SET read_at = ? WHERE id = ? AND owner_id = ? AND trade_reference = ?`).bind(now,clean(body.id,80),access.ownerId,reference).run();
  } else if (body.action === "mark_unread") {
    if (!access.isOwner) return respond({ error: "Personal notification state for participants is not enabled yet" }, 403);
    await env.DB.prepare(`UPDATE notification_events SET read_at = NULL WHERE id = ? AND owner_id = ? AND trade_reference = ?`).bind(clean(body.id,80),access.ownerId,reference).run();
  } else if (body.action === "mark_all_read") {
    if (!access.isOwner) return respond({ error: "Personal notification state for participants is not enabled yet" }, 403);
    await env.DB.prepare(`UPDATE notification_events SET read_at = ? WHERE owner_id = ? AND trade_reference = ? AND status = 'active' AND read_at IS NULL`).bind(now,access.ownerId,reference).run();
  } else return respond({ error: "Unsupported notification action" }, 400);
  return respond(await list(access.ownerId, reference));
}
