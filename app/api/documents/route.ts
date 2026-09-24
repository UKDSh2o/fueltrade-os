import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission } from "../../access-control";
import { canTransitionDocument } from "../../../lib/due-diligence.js";

const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const clean = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);
const safeDownloadName = (value: unknown) => clean(value, 180).replace(/[\r\n"\\/]/g, "_") || "document";
const toHex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, "0")).join("");

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Document records are unavailable" }, 503);
  const url = new URL(request.url);
  const reference = clean(url.searchParams.get("reference"), 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "documents", "view");
  if (!access) return respond({ error: "Document access denied" }, 403);
  const id = clean(url.searchParams.get("id"), 80);
  if (id) {
    if (!env.BUCKET) return respond({ error: "Document storage is unavailable" }, 503);
    const record = await env.DB.prepare(`SELECT file_name AS fileName, content_type AS contentType, size_bytes AS sizeBytes, object_key AS objectKey, sha256, status FROM documents WHERE id = ? AND owner_id = ? AND trade_reference = ? LIMIT 1`).bind(id, access.ownerId, reference).first<{fileName:string;contentType:string;sizeBytes:number;objectKey:string;sha256:string;status:string}>();
    if (!record) return respond({ error: "Document not found" }, 404);
    const object = await env.BUCKET.get(record.objectKey);
    if (!object) return respond({ error: "Stored document bytes were not found" }, 404);
    const headers = new Headers({
      "Content-Type": record.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeDownloadName(record.fileName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "X-Document-SHA256": record.sha256 || "unavailable",
    });
    if (record.sizeBytes) headers.set("Content-Length", String(record.sizeBytes));
    return new Response(object.body, { headers });
  }
  const rows = await env.DB.prepare(`SELECT id, category, file_name AS fileName, content_type AS contentType, size_bytes AS sizeBytes, status, group_id AS groupId, version_number AS versionNumber, supersedes_id AS supersedesId, sha256, uploaded_by AS uploadedBy, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt, review_note AS reviewNote, created_at AS createdAt FROM documents WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at DESC LIMIT 200`).bind(access.ownerId, reference).all();
  return respond({ documents: rows.results, access: { isOwner: access.isOwner, permissions: access.permissions } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Document storage is unavailable" }, 503);
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.startsWith("application/json")) {
    const body = await request.json() as Record<string, unknown>;
    const reference = clean(body.reference, 100);
    const id = clean(body.id, 80);
    const targetStatus = clean(body.status, 30);
    if (body.action !== "transition" || !reference || !id) return respond({ error: "Document transition details are required" }, 400);
    const baseAccess = await requireTradePermission(env.DB, user, reference, "documents", "view");
    if (!baseAccess) return respond({ error: "Document access denied" }, 403);
    const current = await env.DB.prepare(`SELECT status FROM documents WHERE id = ? AND owner_id = ? AND trade_reference = ? LIMIT 1`).bind(id, baseAccess.ownerId, reference).first<{status:string}>();
    if (!current) return respond({ error: "Document not found" }, 404);
    const approvalRequired = ["approved", "rejected"].includes(targetStatus) || (current.status === "approved" && targetStatus === "archived");
    const access = await requireTradePermission(env.DB, user, reference, "documents", approvalRequired ? "approve" : "edit");
    if (!access) return respond({ error: approvalRequired ? "Document approval permission required" : "Document edit permission required" }, 403);
    const owned = await env.DB.prepare(`SELECT status FROM documents WHERE id = ? AND owner_id = ? AND trade_reference = ? LIMIT 1`).bind(id, access.ownerId, reference).first<{status:string}>();
    if (!owned) return respond({ error: "Document not found" }, 404);
    const canApprove = access.isOwner || access.permissions.documents === "approve";
    if (!canTransitionDocument(owned.status, targetStatus, canApprove)) return respond({ error: `Cannot move a document from ${owned.status} to ${targetStatus}` }, 409);
    const now = Date.now();
    const reviewNote = clean(body.reviewNote, 800);
    const reviewed = ["approved", "rejected"].includes(targetStatus);
    const result = await env.DB.prepare(`UPDATE documents SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ? AND owner_id = ? AND trade_reference = ? AND status = ?`).bind(targetStatus, reviewed ? user.email : null, reviewed ? now : null, reviewNote, id, access.ownerId, reference, owned.status).run();
    if (!result.meta.changes) return respond({ error: "Document changed before this action completed" }, 409);
    await env.DB.prepare(`INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, 'document', ?, ?, ?)`).bind(crypto.randomUUID(), access.ownerId, reference, user.userId, user.email, `document_${targetStatus}`, id, JSON.stringify({ from: owned.status, to: targetStatus, reviewNote }), now).run();
    return respond({ id, status: targetStatus, reviewedBy: reviewed ? user.email : null, reviewedAt: reviewed ? now : null, reviewNote });
  }

  if (!env.BUCKET) return respond({ error: "Document storage is unavailable" }, 503);
  const form = await request.formData();
  const file = form.get("file");
  const reference = clean(form.get("reference"), 100);
  const category = clean(form.get("category") || "Other", 120);
  const requestedGroupId = clean(form.get("groupId"), 80);
  const reviewNote = clean(form.get("reviewNote"), 800);
  if (!(file instanceof File) || !reference) return respond({ error: "A file and trade reference are required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "documents", "edit");
  if (!access) return respond({ error: "Document upload permission required" }, 403);
  if (file.size > 15 * 1024 * 1024) return respond({ error: "Files must be 15 MB or smaller" }, 413);
  const allowed = new Set(["application/pdf","image/jpeg","image/png","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
  if (!allowed.has(file.type)) return respond({ error: "Upload a PDF, DOCX, JPG or PNG file" }, 415);
  let groupId = requestedGroupId || crypto.randomUUID();
  let versionNumber = 1;
  let supersedesId: string | null = null;
  if (requestedGroupId) {
    const latest = await env.DB.prepare(`SELECT id, group_id AS groupId, version_number AS versionNumber FROM documents WHERE owner_id = ? AND trade_reference = ? AND (group_id = ? OR (group_id IS NULL AND id = ?)) ORDER BY version_number DESC LIMIT 1`).bind(access.ownerId, reference, requestedGroupId, requestedGroupId).first<{id:string;groupId:string|null;versionNumber:number}>();
    if (!latest) return respond({ error: "Document version group not found" }, 404);
    groupId = latest.groupId || latest.id;
    versionNumber = latest.versionNumber + 1;
    supersedesId = latest.id;
  }
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const bytes = await file.arrayBuffer();
  const sha256 = toHex(await crypto.subtle.digest("SHA-256", bytes));
  const objectKey = `${access.ownerId}/${reference}/${groupId}/v${versionNumber}-${id}-${safeName}`;
  await env.BUCKET.put(objectKey, bytes, { httpMetadata: { contentType: file.type }, customMetadata: { ownerId: access.ownerId, tradeReference: reference, category, uploadedBy: user.userId, sha256, groupId, versionNumber: String(versionNumber) } });
  const now = Date.now();
  try {
    await env.DB.prepare(`INSERT INTO documents (id, owner_id, trade_reference, category, file_name, content_type, size_bytes, object_key, status, group_id, version_number, supersedes_id, sha256, uploaded_by, reviewed_by, reviewed_at, review_note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`).bind(id, access.ownerId, reference, category, file.name, file.type, file.size, objectKey, groupId, versionNumber, supersedesId, sha256, user.userId, reviewNote, now).run();
  } catch (error) {
    await env.BUCKET.delete(objectKey);
    throw error;
  }
  return respond({ id, fileName: file.name, category, sizeBytes: file.size, status: "received", groupId, versionNumber, supersedesId, sha256, uploadedBy: user.userId, reviewNote, createdAt: now }, 201);
}
