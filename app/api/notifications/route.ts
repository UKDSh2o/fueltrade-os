import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission } from "../../access-control";
import { notificationReadStateId } from "../../../lib/notification-controls.js";
import { canSeeNotification } from "../../../lib/notification-visibility.js";

const respond = (body: unknown, status = 200) => Response.json(body, { status });
const clean = (value: unknown, max = 180) => String(value ?? "").trim().slice(0, max);
const severities = ["critical","high","medium","low"];
const targets = ["market-intelligence","logistics","documents","due-diligence","finance","risk","approvals","downstream","retail-operations"];

async function list(ownerId: string, reference: string, userId: string, access: any, email: string) {
  const result = await env.DB!.prepare(`SELECT ne.id, ne.event_key AS eventKey, ne.category, ne.severity, ne.title, ne.message, ne.target, ne.status, CASE WHEN nrs.id IS NOT NULL THEN nrs.read_at WHEN ? = ne.owner_id THEN ne.read_at ELSE NULL END AS readAt, ne.last_seen_at AS lastSeenAt, ne.created_at AS createdAt FROM notification_events ne LEFT JOIN notification_read_states nrs ON nrs.event_id = ne.id AND nrs.user_id = ? WHERE ne.owner_id = ? AND ne.trade_reference = ? ORDER BY CASE ne.status WHEN 'active' THEN 0 ELSE 1 END, CASE ne.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, ne.last_seen_at DESC LIMIT 100`).bind(userId, userId, ownerId, reference).all<any>();
  const rows = result.results ?? [];
  const messageIds = access.isOwner ? [] : rows.filter(item => item.category === 'communications').map(item => String(item.eventKey).match(/^communication:(.+)$/)?.[1]).filter(Boolean);
  const threadMap = new Map();
  if (messageIds.length) {
    for (let index=0; index<messageIds.length; index+=80) {
      const batch=messageIds.slice(index,index+80);
      const linked = await env.DB!.prepare(`SELECT m.id AS messageId,t.thread_kind AS threadKind,t.channel,t.participants_json AS participantsJson FROM communication_messages m JOIN communication_threads t ON t.id=m.thread_id WHERE m.owner_id=? AND t.owner_id=? AND t.trade_reference=? AND m.id IN (${batch.map(()=>'?').join(',')})`).bind(ownerId,ownerId,reference,...batch).all<any>();
      for (const row of linked.results) {
        try { threadMap.set(row.messageId,{threadKind:row.threadKind,channel:row.channel,participants:JSON.parse(row.participantsJson)}); } catch { /* fail closed */ }
      }
    }
  }
  const notifications = rows.filter(item => canSeeNotification(item,access,email,threadMap)).slice(0,100);
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
  return respond(await list(access.ownerId, reference, user.userId, access, user.email));
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
    const eventId = clean(body.id,80);
    const visible = await list(access.ownerId,reference,user.userId,access,user.email);
    if (!visible.notifications.some((item:any)=>item.id===eventId)) return respond({ error: "Notification not found" }, 404);
    await env.DB.prepare(`INSERT INTO notification_read_states (id, owner_id, trade_reference, event_id, user_id, is_read, read_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET is_read=1, read_at=excluded.read_at, updated_at=excluded.updated_at`).bind(notificationReadStateId(eventId,user.userId),access.ownerId,reference,eventId,user.userId,now,now).run();
  } else if (body.action === "mark_unread") {
    const eventId = clean(body.id,80);
    const visible = await list(access.ownerId,reference,user.userId,access,user.email);
    if (!visible.notifications.some((item:any)=>item.id===eventId)) return respond({ error: "Notification not found" }, 404);
    await env.DB.prepare(`INSERT INTO notification_read_states (id, owner_id, trade_reference, event_id, user_id, is_read, read_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, NULL, ?) ON CONFLICT(id) DO UPDATE SET is_read=0, read_at=NULL, updated_at=excluded.updated_at`).bind(notificationReadStateId(eventId,user.userId),access.ownerId,reference,eventId,user.userId,now).run();
  } else if (body.action === "mark_all_read") {
    const active = await list(access.ownerId,reference,user.userId,access,user.email);
    const statements = active.notifications.filter((item:any)=>item.status==='active').map((event: any) => env.DB!.prepare(`INSERT INTO notification_read_states (id, owner_id, trade_reference, event_id, user_id, is_read, read_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET is_read=1, read_at=excluded.read_at, updated_at=excluded.updated_at`).bind(notificationReadStateId(event.id,user.userId),access.ownerId,reference,event.id,user.userId,now,now));
    if (statements.length) await env.DB.batch(statements);
  } else return respond({ error: "Unsupported notification action" }, 400);
  return respond(await list(access.ownerId, reference, user.userId, access, user.email));
}
