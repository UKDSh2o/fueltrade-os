import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission } from "../../access-control";
import { requirementStatus, validRequirement } from "../../../lib/document-requirements.js";

const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const referenceOf = (value: unknown) => typeof value === "string" && /^[\w-]{3,64}$/.test(value) ? value : null;

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Document requirements unavailable" }, 503);
  const reference = referenceOf(new URL(request.url).searchParams.get("reference"));
  if (!reference) return respond({ error: "Invalid trade reference" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "documents", "view");
  if (!access) return respond({ error: "Document access denied" }, 403);
  const [requirements, documents] = await Promise.all([
    env.DB.prepare("SELECT id, category, note, due_at AS dueAt, created_by AS createdBy, created_at AS createdAt FROM document_requirements WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at ASC LIMIT 100").bind(access.ownerId, reference).all(),
    env.DB.prepare("SELECT id, category, status, group_id AS groupId, version_number AS versionNumber FROM documents WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at DESC LIMIT 500").bind(access.ownerId, reference).all(),
  ]);
  return respond({ requirements: requirements.results.map((row: any) => ({ ...row, status: requirementStatus(row, documents.results) })) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Document requirements unavailable" }, 503);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return respond({ error: "JSON required" }, 415);
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return respond({ error: "Origin rejected" }, 403);
  let body: any;
  try { body = await request.json(); } catch { return respond({ error: "Invalid JSON" }, 400); }
  const reference = referenceOf(body?.reference);
  if (!reference || !validRequirement(body)) return respond({ error: "Invalid requirement" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "documents", "edit");
  if (!access) return respond({ error: "Document edit permission required" }, 403);
  const id = crypto.randomUUID(), now = Date.now();
  const category = body.category.trim(), note = (body.note || "").trim(), dueAt = body.dueAt ?? null;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO document_requirements (id, owner_id, trade_reference, category, note, due_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, access.ownerId, reference, category, note, dueAt, user.email, now),
    env.DB.prepare("INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, 'document_requirement_created', 'document_requirement', ?, ?, ?)").bind(crypto.randomUUID(), access.ownerId, reference, user.userId, user.email, id, JSON.stringify({ category, dueAt }), now),
  ]);
  return respond({ id, category, note, dueAt, status: "missing", createdBy: user.email, createdAt: now }, 201);
}
