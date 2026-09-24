/* eslint-disable @typescript-eslint/no-explicit-any */
import { env } from "cloudflare:workers";
import { classifyMessage } from "../../../../lib/communications.js";
import { normalizeChatwootMessage } from "../../../../lib/chatwoot-webhook.js";
import { triggerNovu } from "../../../../lib/novu.js";

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const clean = (value: unknown, max = 8000) => String(value ?? "").trim().slice(0, max);
const runtime = () => env as unknown as Record<string, any>;

function constantEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function signed(rawBody: string, secret: string, request: Request) {
  const signature = clean(request.headers.get("x-chatwoot-signature"), 256);
  const timestamp = clean(request.headers.get("x-chatwoot-timestamp"), 32);
  if (!signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  return constantEqual(signature.toLowerCase(), `sha256=${toHex(digest)}`);
}

async function authorized(request: Request, rawBody: string) {
  const settings = runtime();
  const signatureSecret = clean(settings.CHATWOOT_WEBHOOK_SECRET, 500);
  if (signatureSecret && await signed(rawBody, signatureSecret, request)) return true;
  const sharedToken = clean(settings.CHATWOOT_WEBHOOK_TOKEN, 500);
  const supplied = clean(request.headers.get("x-fueltrade-webhook-token"), 500) || clean(new URL(request.url).searchParams.get("token"), 500);
  return Boolean(sharedToken && supplied && constantEqual(sharedToken, supplied));
}

export async function POST(request: Request) {
  if (!env.DB) return json({ error: "Communications storage is unavailable" }, 503);
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return json({ error: "Payload too large" }, 413);
  if (!await authorized(request, rawBody)) return json({ error: "Unauthorized webhook" }, 401);
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON" }, 400); }
  const message = normalizeChatwootMessage(payload);
  if (!message) return json({ accepted: true, ignored: "unsupported_or_incomplete_message" }, 202);
  const thread = await env.DB.prepare("SELECT id, owner_id AS ownerId, trade_reference AS tradeReference, subject, participants_json AS participantsJson FROM communication_threads WHERE external_id = ? LIMIT 1").bind(message.conversationId).first<any>();
  if (!thread) return json({ accepted: true, ignored: "unlinked_conversation" }, 202);
  const messageKey = `chatwoot:${message.externalMessageId}`;
  if (await env.DB.prepare("SELECT id FROM communication_messages WHERE external_id = ? LIMIT 1").bind(messageKey).first()) return json({ accepted: true, duplicate: true });

  const insight = classifyMessage(message.body), id = crypto.randomUUID(), now = Date.now();
  const statements = [
    env.DB.prepare("INSERT INTO communication_messages (id, owner_id, thread_id, external_id, direction, author, body, ai_priority, ai_reason, draft_reply, sent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, thread.ownerId, thread.id, messageKey, "incoming", message.author, message.body, insight.priority, insight.reason, "", message.sentAt, now),
    env.DB.prepare("UPDATE communication_threads SET priority = ?, priority_reason = ?, last_message_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?").bind(insight.priority, insight.reason, message.sentAt, now, thread.id, thread.ownerId),
    env.DB.prepare("INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), thread.ownerId, thread.tradeReference, "chatwoot", "chatwoot@system.local", "communication_message_received", "communication_message", id, JSON.stringify({ threadId: thread.id, externalMessageId: message.externalMessageId, priority: insight.priority }), now),
  ];
  let recipients: string[] = [];
  if (insight.priority !== "normal") {
    recipients = JSON.parse(thread.participantsJson || "[]");
    statements.push(env.DB.prepare("INSERT INTO notification_events (id, owner_id, trade_reference, event_key, category, severity, title, message, target, status, read_at, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), thread.ownerId, thread.tradeReference, `communication:${id}`, "communications", insight.priority === "urgent" ? "critical" : "high", `${insight.priority === "urgent" ? "Urgent" : "Priority"} external message: ${thread.subject}`, message.body.slice(0, 300), recipients.join(", ") || thread.ownerId, "active", null, now, now));
  }
  await env.DB.batch(statements);
  const delivery = insight.priority === "normal" ? { delivered: false, reason: "normal_priority" } : await triggerNovu(runtime(), { recipients, title: `${insight.priority === "urgent" ? "Urgent" : "Priority"} external message: ${thread.subject}`, message: message.body, severity: insight.priority === "urgent" ? "critical" : "high", reference: thread.tradeReference, transactionId: `communication:${id}` });
  await env.DB.prepare("INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), thread.ownerId, thread.tradeReference, "notification", "notification@system.local", delivery.delivered ? "communication_notification_delivered" : "communication_notification_skipped", "communication_message", id, JSON.stringify(delivery), Date.now()).run();
  return json({ accepted: true, messageId: id, priority: insight.priority, notificationDelivered: delivery.delivered }, 201);
}
