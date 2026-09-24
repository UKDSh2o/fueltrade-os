import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { classifyUrgency } from "../../../lib/deal-events.js";
import { requireTradePermission } from "../../access-control";

const respond = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const validReference = (value: string) => /^[\w-]{3,64}$/.test(value);

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Deal room unavailable" }, 503);
  const reference = new URL(request.url).searchParams.get("reference") || "";
  if (!validReference(reference)) return respond({ error: "Invalid trade reference" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "comments", "view");
  if (!access) return respond({ error: "Deal-room access denied" }, 403);
  const rows = await env.DB.prepare("SELECT id, actor_email AS author, body, created_at AS createdAt FROM deal_messages WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at DESC LIMIT 100").bind(access.ownerId, reference).all();
  return respond({ messages: rows.results.reverse(), access: { role: access.role, isOwner: access.isOwner } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Deal room unavailable" }, 503);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return respond({ error: "JSON required" }, 415);
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return respond({ error: "Origin rejected" }, 403);
  let value: any;
  try { value = await request.json(); } catch { return respond({ error: "Invalid JSON" }, 400); }
  const reference = value?.reference;
  const message = value?.body;
  if (typeof reference !== "string" || !validReference(reference) || typeof message !== "string" || !message.trim() || message.length > 4000) return respond({ error: "Invalid message" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "comments", "edit");
  if (!access) return respond({ error: "Deal-room posting permission required" }, 403);
  const id = crypto.randomUUID(), now = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO deal_messages (id, owner_id, trade_reference, actor_id, actor_email, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, access.ownerId, reference, user.userId, user.email, message.trim(), now),
    env.DB.prepare("INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), access.ownerId, reference, user.userId, user.email, "message_created", "deal_message", id, JSON.stringify({ urgency: classifyUrgency(message.trim()), role: access.role }), now)
  ]);
  return respond({ id, createdAt: now }, 201);
}
