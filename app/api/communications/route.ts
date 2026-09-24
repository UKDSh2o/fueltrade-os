/* eslint-disable @typescript-eslint/no-explicit-any */
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { buildSafeDraft, classifyMessage, connectionCatalog, normalizeChannel, normalizeParticipants, safeConnector } from "../../../lib/communications.js";
import { normalizeChatwootConversationId } from "../../../lib/chatwoot-webhook.js";
import { requireTradePermission } from "../../access-control";

const respond = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const clean = (value: unknown, max = 4000) => String(value ?? "").trim().slice(0, max);
const validReference = (value: string) => /^[\w-]{3,64}$/.test(value);
const runtime = () => env as unknown as Record<string, any>;

async function audit(user: any, ownerId: string, reference: string, action: string, subjectType: string, subjectId: string, detail: unknown) {
  return env.DB!.prepare("INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), ownerId, reference, user.userId, user.email, action, subjectType, subjectId, JSON.stringify(detail), Date.now()).run();
}

async function aiDraft(message: string, context: string) {
  const settings = runtime();
  const base = clean(settings.COMMUNICATION_AI_BASE_URL, 500).replace(/\/$/, "");
  const model = clean(settings.COMMUNICATION_AI_MODEL, 120) || "llama3.1";
  if (!base) return { draft: buildSafeDraft(message, context), mode: "safe_assisted" };
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (settings.COMMUNICATION_AI_API_KEY) headers.authorization = `Bearer ${settings.COMMUNICATION_AI_API_KEY}`;
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Draft a concise professional fuel-trade reply. Do not invent facts, commitments, prices, approvals or dates. Flag anything requiring human confirmation. Return only the draft." },
        { role: "user", content: `Deal context: ${context || "Not supplied"}\n\nIncoming message:\n${message}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`AI endpoint returned ${response.status}`);
  const data: any = await response.json();
  const draft = clean(data?.choices?.[0]?.message?.content, 8000);
  if (!draft) throw new Error("AI endpoint returned an empty draft");
  return { draft, mode: "self_hosted_ai" };
}

async function chatwootConversation(conversationId: string) {
  const settings = runtime();
  const base = clean(settings.CHATWOOT_URL, 500).replace(/\/$/, "");
  const accountId = clean(settings.CHATWOOT_ACCOUNT_ID, 40);
  const token = clean(settings.CHATWOOT_API_TOKEN, 1000);
  if (!base || !accountId || !token) throw new Error("Chatwoot administrator configuration is incomplete");
  const response = await fetch(`${base}/api/v1/accounts/${encodeURIComponent(accountId)}/conversations/${conversationId}`, { headers: { api_access_token: token } });
  if (response.status === 404) throw new Error("Chatwoot conversation was not found");
  if (!response.ok) throw new Error(`Chatwoot connection check failed (${response.status})`);
  return response.json() as Promise<any>;
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Communications storage is unavailable" }, 503);
  const reference = clean(new URL(request.url).searchParams.get("reference"), 64);
  if (!validReference(reference)) return respond({ error: "Invalid trade reference" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "comments", "view");
  if (!access) return respond({ error: "Communications access denied" }, 403);

  const [connections, threads, members] = await Promise.all([
    access.isOwner ? env.DB.prepare("SELECT id, provider, display_name AS displayName, address, endpoint, status, capabilities_json AS capabilitiesJson, last_sync_at AS lastSyncAt, updated_at AS updatedAt FROM communication_connections WHERE owner_id = ? ORDER BY updated_at DESC").bind(access.ownerId).all<any>() : Promise.resolve({ results: [] }),
    env.DB.prepare("SELECT id, channel, thread_kind AS threadKind, external_id AS externalId, subject, participants_json AS participantsJson, priority, priority_reason AS priorityReason, status, summary, last_message_at AS lastMessageAt, updated_at AS updatedAt FROM communication_threads WHERE owner_id = ? AND trade_reference = ? ORDER BY last_message_at DESC LIMIT 100").bind(access.ownerId, reference).all<any>(),
    env.DB.prepare("SELECT email, name, organization, role, permissions_json AS permissionsJson, status FROM trade_members WHERE owner_id = ? AND trade_reference = ? AND status = 'active' ORDER BY created_at").bind(access.ownerId, reference).all<any>(),
  ]);

  const threadRows = threads.results.map((row: any) => ({ ...row, participants: JSON.parse(row.participantsJson) }));
  const messages = threadRows.length ? await env.DB.prepare(`SELECT id, thread_id AS threadId, direction, author, body, ai_priority AS aiPriority, ai_reason AS aiReason, draft_reply AS draftReply, sent_at AS sentAt FROM communication_messages WHERE owner_id = ? AND thread_id IN (${threadRows.map(() => "?").join(",")}) ORDER BY sent_at ASC LIMIT 500`).bind(access.ownerId, ...threadRows.map((row: any) => row.id)).all<any>() : { results: [] };
  const settings = runtime();
  const configured = new Set(connections.results.filter((item: any) => item.status === "connected").map((item: any) => item.provider));
  const prepared = new Set(connections.results.map((item: any) => item.provider));
  const missing = (items: string[]) => items.filter(key => !settings[key]);
  const configuration = {
    sandbox_email: { configured: true, missing: [] },
    chatwoot: { configured: Boolean(settings.CHATWOOT_URL && settings.CHATWOOT_API_TOKEN && settings.CHATWOOT_ACCOUNT_ID), missing: missing(["CHATWOOT_URL", "CHATWOOT_API_TOKEN", "CHATWOOT_ACCOUNT_ID"]), inboundReady: Boolean(settings.CHATWOOT_WEBHOOK_SECRET || settings.CHATWOOT_WEBHOOK_TOKEN), webhookUrl: `${new URL(request.url).origin}/api/communications/webhook` },
    novu: { configured: Boolean(settings.NOVU_API_URL && settings.NOVU_API_KEY && settings.NOVU_WORKFLOW_ID), missing: missing(["NOVU_API_URL", "NOVU_API_KEY", "NOVU_WORKFLOW_ID"]) },
    ollama: { configured: Boolean(settings.COMMUNICATION_AI_BASE_URL), missing: missing(["COMMUNICATION_AI_BASE_URL"]) },
  };
  const catalog = connectionCatalog.map(item => ({
    ...item,
    prepared: prepared.has(item.provider),
    configured: configured.has(item.provider) ||
      item.provider === "sandbox_email" ||
      (item.provider === "chatwoot" && Boolean(settings.CHATWOOT_URL && settings.CHATWOOT_API_TOKEN)) ||
      (item.provider === "novu" && Boolean(settings.NOVU_API_URL && settings.NOVU_API_KEY && settings.NOVU_WORKFLOW_ID)) ||
      (item.provider === "ollama" && Boolean(settings.COMMUNICATION_AI_BASE_URL)),
  }));
  return respond({
    catalog,
    connections: connections.results.map((row: any) => ({ ...row, capabilities: JSON.parse(row.capabilitiesJson) })),
    threads: threadRows,
    messages: messages.results,
    members: members.results.map((row: any) => ({ ...row, permissions: JSON.parse(row.permissionsJson) })),
    aiConfigured: Boolean(settings.COMMUNICATION_AI_BASE_URL),
    draftAvailable: true,
    configuration,
    access: { isOwner: access.isOwner, role: access.role, permissions: access.permissions },
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Communications storage is unavailable" }, 503);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return respond({ error: "JSON required" }, 415);
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return respond({ error: "Origin rejected" }, 403);
  let body: any;
  try { body = await request.json(); } catch { return respond({ error: "Invalid JSON" }, 400); }
  const reference = clean(body.reference, 64);
  if (!validReference(reference)) return respond({ error: "Invalid trade reference" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "comments", "view");
  if (!access) return respond({ error: "Communications access denied" }, 403);
  const now = Date.now();

  if (body.action === "save_connection") {
    if (!access.isOwner) return respond({ error: "Only the trade owner can configure external providers" }, 403);
    const provider = safeConnector(body.provider);
    if (!provider) return respond({ error: "Unsupported connector" }, 400);
    const template = connectionCatalog.find(item => item.provider === provider)!;
    const existing = await env.DB.prepare("SELECT id, created_at AS createdAt FROM communication_connections WHERE owner_id = ? AND provider = ? LIMIT 1").bind(access.ownerId, provider).first<any>();
    const id = existing?.id ?? crypto.randomUUID();
    await env.DB.prepare("INSERT INTO communication_connections (id, owner_id, provider, display_name, address, endpoint, status, capabilities_json, last_sync_at, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name, address=excluded.address, endpoint=excluded.endpoint, status=excluded.status, capabilities_json=excluded.capabilities_json, updated_at=excluded.updated_at")
      .bind(id, access.ownerId, provider, clean(body.displayName, 120) || template.name, clean(body.address, 254), clean(body.endpoint, 500), "needs_authorization", JSON.stringify(template.capabilities), null, now, existing?.createdAt ?? now).run();
    await audit(user, access.ownerId, reference, existing ? "communication_connection_updated" : "communication_connection_created", "communication_connection", id, { provider });
    return respond({ id, status: "needs_authorization" }, existing ? 200 : 201);
  }

  if (body.action === "create_thread") {
    if (!await requireTradePermission(env.DB, user, reference, "comments", "edit")) return respond({ error: "Conversation edit permission required" }, 403);
    const subject = clean(body.subject, 240);
    if (!subject) return respond({ error: "Conversation subject is required" }, 400);
    const id = crypto.randomUUID();
    const channel = normalizeChannel(body.channel);
    const threadKind = ["group", "direct", "ticket"].includes(body.threadKind) ? body.threadKind : "group";
    const participants = normalizeParticipants(body.participants);
    const externalId = channel === "email_sandbox" ? `sandbox:${id}` : "";
    await env.DB.prepare("INSERT INTO communication_threads (id, owner_id, trade_reference, channel, thread_kind, external_id, subject, participants_json, priority, priority_reason, status, summary, last_message_at, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, access.ownerId, reference, channel, threadKind, externalId, subject, JSON.stringify(participants), "normal", "", "open", "", now, now, now).run();
    await audit(user, access.ownerId, reference, "communication_thread_created", "communication_thread", id, { channel, threadKind, subject, participants });
    return respond({ id }, 201);
  }

  if (body.action === "link_chatwoot_conversation") {
    if (!access.isOwner) return respond({ error: "Only the trade owner can link external conversations" }, 403);
    const threadId = clean(body.threadId, 80);
    const conversationId = normalizeChatwootConversationId(body.conversationId);
    if (!threadId || !conversationId) return respond({ error: "Enter a valid Chatwoot conversation ID" }, 400);
    const thread = await env.DB.prepare("SELECT id, channel, external_id AS externalId FROM communication_threads WHERE id = ? AND owner_id = ? AND trade_reference = ?").bind(threadId, access.ownerId, reference).first<any>();
    if (!thread) return respond({ error: "Conversation not found" }, 404);
    if (["internal", "email_sandbox"].includes(thread.channel)) return respond({ error: "Only external conversations can be linked to Chatwoot" }, 409);
    const duplicate = await env.DB.prepare("SELECT id FROM communication_threads WHERE owner_id = ? AND external_id = ? AND id <> ? LIMIT 1").bind(access.ownerId, conversationId, threadId).first();
    if (duplicate) return respond({ error: "That Chatwoot conversation is already linked to another FuelTrade conversation" }, 409);
    try {
      const remote = await chatwootConversation(conversationId);
      await env.DB.prepare("UPDATE communication_threads SET external_id = ?, updated_at = ? WHERE id = ? AND owner_id = ?").bind(conversationId, now, threadId, access.ownerId).run();
      await audit(user, access.ownerId, reference, "chatwoot_conversation_linked", "communication_thread", threadId, { conversationId, remoteStatus: clean(remote?.status, 40) });
      return respond({ threadId, conversationId, status: clean(remote?.status, 40) || "linked" });
    } catch (error: any) { return respond({ error: error.message || "Unable to link Chatwoot conversation" }, 502); }
  }

  if (body.action === "send_message") {
    if (!await requireTradePermission(env.DB, user, reference, "comments", "edit")) return respond({ error: "Message send permission required" }, 403);
    const threadId = clean(body.threadId, 80), message = clean(body.message, 8000);
    if (!threadId || !message) return respond({ error: "Conversation and message are required" }, 400);
    const thread = await env.DB.prepare("SELECT channel, external_id AS externalId, subject, participants_json AS participantsJson FROM communication_threads WHERE id = ? AND owner_id = ? AND trade_reference = ?").bind(threadId, access.ownerId, reference).first<any>();
    if (!thread) return respond({ error: "Conversation not found" }, 404);
    if (!["internal", "email_sandbox"].includes(thread.channel)) {
      if (!access.isOwner && !await requireTradePermission(env.DB, user, reference, "comments", "approve")) return respond({ error: "External messages require owner or approval permission" }, 403);
      const settings = runtime();
      if (!settings.CHATWOOT_URL || !settings.CHATWOOT_API_TOKEN || !settings.CHATWOOT_ACCOUNT_ID || !thread.externalId) return respond({ error: "Connect Chatwoot and sync this external conversation before sending" }, 409);
      const result = await fetch(`${String(settings.CHATWOOT_URL).replace(/\/$/, "")}/api/v1/accounts/${settings.CHATWOOT_ACCOUNT_ID}/conversations/${thread.externalId}/messages`, { method: "POST", headers: { "content-type": "application/json", api_access_token: settings.CHATWOOT_API_TOKEN }, body: JSON.stringify({ content: message, message_type: "outgoing", private: false }) });
      if (!result.ok) return respond({ error: `Chatwoot delivery failed (${result.status})` }, 502);
    }
    const insight = classifyMessage(message), id = crypto.randomUUID();
    const statements = [
      env.DB.prepare("INSERT INTO communication_messages (id, owner_id, thread_id, external_id, direction, author, body, ai_priority, ai_reason, draft_reply, sent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, access.ownerId, threadId, "", "outgoing", user.email, message, insight.priority, insight.reason, "", now, now),
      env.DB.prepare("UPDATE communication_threads SET priority = ?, priority_reason = ?, last_message_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?").bind(insight.priority, insight.reason, now, now, threadId, access.ownerId),
    ];
    if (insight.priority !== "normal") {
      const recipients = JSON.parse(thread.participantsJson || "[]");
      statements.push(env.DB.prepare("INSERT INTO notification_events (id, owner_id, trade_reference, event_key, category, severity, title, message, target, status, read_at, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), access.ownerId, reference, `communication:${id}`, "communications", insight.priority === "urgent" ? "critical" : "high", `${insight.priority === "urgent" ? "Urgent" : "Priority"} message: ${thread.subject}`, message.slice(0, 300), recipients.join(", ") || user.email, "active", null, now, now));
    }
    await env.DB.batch(statements);
    await audit(user, access.ownerId, reference, "communication_message_sent", "communication_message", id, { threadId, channel: thread.channel, priority: insight.priority });
    return respond({ id, priority: insight.priority }, 201);
  }

  if (body.action === "receive_test_email") {
    if (!access.isOwner) return respond({ error: "Only the trade owner can inject test email" }, 403);
    const threadId = clean(body.threadId, 80), message = clean(body.message, 8000);
    const author = clean(body.author, 254).toLowerCase() || "sandbox.sender@example.test";
    if (!threadId || !message) return respond({ error: "Conversation and test email are required" }, 400);
    if (!/^\S+@\S+\.\S+$/.test(author)) return respond({ error: "Enter a valid test sender address" }, 400);
    const thread = await env.DB.prepare("SELECT channel, subject, participants_json AS participantsJson FROM communication_threads WHERE id = ? AND owner_id = ? AND trade_reference = ?").bind(threadId, access.ownerId, reference).first<any>();
    if (!thread) return respond({ error: "Conversation not found" }, 404);
    if (thread.channel !== "email_sandbox") return respond({ error: "Test email delivery is available only in an email sandbox conversation" }, 409);
    const insight = classifyMessage(message), id = crypto.randomUUID();
    const statements = [
      env.DB.prepare("INSERT INTO communication_messages (id, owner_id, thread_id, external_id, direction, author, body, ai_priority, ai_reason, draft_reply, sent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, access.ownerId, threadId, `sandbox-message:${id}`, "incoming", author, message, insight.priority, insight.reason, "", now, now),
      env.DB.prepare("UPDATE communication_threads SET priority = ?, priority_reason = ?, last_message_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?").bind(insight.priority, insight.reason, now, now, threadId, access.ownerId),
    ];
    if (insight.priority !== "normal") {
      const recipients = JSON.parse(thread.participantsJson || "[]");
      statements.push(env.DB.prepare("INSERT INTO notification_events (id, owner_id, trade_reference, event_key, category, severity, title, message, target, status, read_at, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), access.ownerId, reference, `communication:${id}`, "communications", insight.priority === "urgent" ? "critical" : "high", `${insight.priority === "urgent" ? "Urgent" : "Priority"} test email: ${thread.subject}`, message.slice(0, 300), recipients.join(", ") || user.email, "active", null, now, now));
    }
    await env.DB.batch(statements);
    await audit(user, access.ownerId, reference, "communication_test_email_received", "communication_message", id, { threadId, author, priority: insight.priority });
    return respond({ id, priority: insight.priority }, 201);
  }

  if (body.action === "draft_reply") {
    if (!await requireTradePermission(env.DB, user, reference, "comments", "edit")) return respond({ error: "Reply drafting permission required" }, 403);
    const threadId = clean(body.threadId, 80);
    const latest = await env.DB.prepare("SELECT m.id, m.body, t.subject, t.summary FROM communication_messages m JOIN communication_threads t ON t.id = m.thread_id WHERE m.thread_id = ? AND m.owner_id = ? AND t.trade_reference = ? ORDER BY m.sent_at DESC LIMIT 1").bind(threadId, access.ownerId, reference).first<any>();
    if (!latest) return respond({ error: "Add or sync a message before drafting a reply" }, 404);
    try {
      const result = await aiDraft(latest.body, `${latest.subject}. ${latest.summary || ""}`);
      await env.DB.prepare("UPDATE communication_messages SET draft_reply = ? WHERE id = ? AND owner_id = ?").bind(result.draft, latest.id, access.ownerId).run();
      await audit(user, access.ownerId, reference, result.mode === "self_hosted_ai" ? "ai_reply_drafted" : "assisted_reply_drafted", "communication_message", latest.id, { threadId, mode: result.mode });
      return respond(result);
    } catch (error: any) { return respond({ error: error.message || "AI draft failed" }, 503); }
  }

  return respond({ error: "Unsupported communications action" }, 400);
}
