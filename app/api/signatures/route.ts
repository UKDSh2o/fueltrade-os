import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission } from "../../access-control";
import { validSigner, providerConfig, envelopePayload } from "../../../lib/signature-controls.js";

const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const refOf = (v: unknown) => typeof v === "string" && /^[\w-]{3,64}$/.test(v) ? v : null;
const settings = env as unknown as Record<string, string>;
const toHex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map(v => v.toString(16).padStart(2, "0")).join("");
type SignatureRow = { id:string; documentId:string; documentSha256:string; signerEmail:string; signerName:string; status:string; providerEnvelopeId:string|null; signedObjectKey:string|null; signedSha256:string|null; createdAt:number };
async function providerFetch(config: {base:string;token:string}, path: string, init?: RequestInit) {
  return fetch(`${config.base}${path}`, { ...init, headers: { Authorization: config.token, ...(init?.headers || {}) }, redirect: "error", signal: AbortSignal.timeout(15000) });
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Signature records unavailable" }, 503);
  const url = new URL(request.url), reference = refOf(url.searchParams.get("reference"));
  if (!reference) return respond({ error: "Invalid trade reference" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "documents", "view");
  if (!access) return respond({ error: "Document access denied" }, 403);
  const id = url.searchParams.get("download");
  if (id) {
    if (!env.BUCKET) return respond({ error: "Storage unavailable" }, 503);
    const row = await env.DB.prepare("SELECT signed_object_key AS objectKey, signed_sha256 AS sha256 FROM signature_requests WHERE id = ? AND owner_id = ? AND trade_reference = ? AND status = 'completed' LIMIT 1").bind(id, access.ownerId, reference).first<{objectKey:string|null;sha256:string|null}>();
    if (!row?.objectKey) return respond({ error: "Signed PDF unavailable" }, 404);
    const object = await env.BUCKET.get(row.objectKey);
    if (!object) return respond({ error: "Signed PDF bytes unavailable" }, 404);
    return new Response(object.body, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="signed-${id.replace(/[^a-zA-Z0-9-]/g, "")}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Document-SHA256": row.sha256 || "unavailable" } });
  }
  const rows = await env.DB.prepare("SELECT id, document_id AS documentId, document_sha256 AS documentSha256, signer_email AS signerEmail, signer_name AS signerName, status, provider_envelope_id AS providerEnvelopeId, signed_object_key AS signedObjectKey, signed_sha256 AS signedSha256, created_at AS createdAt FROM signature_requests WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at DESC LIMIT 100").bind(access.ownerId, reference).all();
  return respond({ requests: rows.results.map((row:any) => ({ ...row, signedObjectKey: undefined, hasSignedCopy: Boolean(row.signedObjectKey) })), configured: Boolean(providerConfig(settings)) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Signature records unavailable" }, 503);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return respond({ error: "JSON required" }, 415);
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return respond({ error: "Origin rejected" }, 403);
  let body:any;
  try { body = await request.json(); } catch { return respond({ error: "Invalid JSON" }, 400); }
  const reference = refOf(body?.reference);
  if (!reference) return respond({ error: "Invalid trade reference" }, 400);
  const action = body.action;
  const access = await requireTradePermission(env.DB, user, reference, "documents", action === "create" ? "edit" : "approve");
  if (!access) return respond({ error: "Document permission required" }, 403);
  const now = Date.now();
  if (action === "create") {
    if (!validSigner(body.signerEmail, body.signerName) || typeof body.documentId !== "string") return respond({ error: "Signer and PDF are required" }, 400);
    const doc = await env.DB.prepare("SELECT id, sha256, content_type AS contentType FROM documents WHERE id = ? AND owner_id = ? AND trade_reference = ? LIMIT 1").bind(body.documentId, access.ownerId, reference).first<{id:string;sha256:string;contentType:string}>();
    if (!doc || doc.contentType !== "application/pdf" || !doc.sha256) return respond({ error: "Choose a stored PDF document" }, 400);
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO signature_requests (id, owner_id, trade_reference, document_id, document_sha256, signer_email, signer_name, status, requested_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)").bind(id, access.ownerId, reference, doc.id, doc.sha256, body.signerEmail.trim().toLowerCase(), body.signerName.trim(), user.email, now, now),
      env.DB.prepare("INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, 'signature_draft_created', 'signature_request', ?, ?, ?)").bind(crypto.randomUUID(), access.ownerId, reference, user.userId, user.email, id, JSON.stringify({ documentId: doc.id, sha256: doc.sha256, signerEmail: body.signerEmail.trim().toLowerCase() }), now),
    ]);
    return respond({ id, status: "draft" }, 201);
  }
  if (!["prepare", "send", "sync"].includes(action) || typeof body.id !== "string") return respond({ error: "Unknown signature action" }, 400);
  const row = await env.DB.prepare("SELECT id, document_id AS documentId, document_sha256 AS documentSha256, signer_email AS signerEmail, signer_name AS signerName, status, provider_envelope_id AS providerEnvelopeId, signed_object_key AS signedObjectKey, signed_sha256 AS signedSha256, created_at AS createdAt FROM signature_requests WHERE id = ? AND owner_id = ? AND trade_reference = ? LIMIT 1").bind(body.id, access.ownerId, reference).first<SignatureRow>();
  if (!row) return respond({ error: "Signature request not found" }, 404);
  const config = providerConfig(settings);
  if (!config) return respond({ error: "A self-hosted Documenso HTTPS URL and API token must be configured" }, 503);
  if (action === "prepare") {
    if (row.status !== "draft" || !env.BUCKET) return respond({ error: "Request is not ready for preparation" }, 409);
    const doc = await env.DB.prepare("SELECT file_name AS fileName, object_key AS objectKey, sha256 FROM documents WHERE id = ? AND owner_id = ? AND trade_reference = ? AND content_type = 'application/pdf' LIMIT 1").bind(row.documentId, access.ownerId, reference).first<{fileName:string;objectKey:string;sha256:string}>();
    if (!doc || doc.sha256 !== row.documentSha256) return respond({ error: "Source document changed" }, 409);
    const object = await env.BUCKET.get(doc.objectKey);
    if (!object) return respond({ error: "Source PDF unavailable" }, 404);
    const bytes = await object.arrayBuffer();
    if (toHex(await crypto.subtle.digest("SHA-256", bytes)) !== row.documentSha256) return respond({ error: "Source PDF checksum mismatch" }, 409);
    const form = new FormData();
    form.set("payload", JSON.stringify(envelopePayload(row.id, doc.fileName, row.signerEmail, row.signerName)));
    form.set("files", new File([bytes], doc.fileName, { type: "application/pdf" }));
    try {
      const response = await providerFetch(config, "/envelope/create", { method: "POST", body: form });
      if (!response.ok) return respond({ error: "Signing provider rejected the draft" }, 502);
      const result:any = await response.json();
      const envelopeId = String(result.id || result.envelopeId || "");
      if (!envelopeId || envelopeId.length > 150) return respond({ error: "Signing provider did not return an envelope ID; inspect provider before retrying" }, 502);
      const updated = await env.DB.prepare("UPDATE signature_requests SET provider_envelope_id = ?, status = 'prepared', updated_at = ? WHERE id = ? AND status = 'draft'").bind(envelopeId, now, row.id).run();
      if (!updated.meta.changes) return respond({ error: "Draft changed while preparing; inspect provider for duplicate envelope" }, 409);
      await audit(access.ownerId, reference, user, "signature_prepared", row.id, { envelopeId }, now);
      return respond({ id: row.id, status: "prepared" });
    } catch { return respond({ error: "Signing provider unavailable; inspect provider before retrying" }, 502); }
  }
  if (!row.providerEnvelopeId) return respond({ error: "Prepare the request first" }, 409);
  if (action === "send") {
    if (row.status !== "prepared") return respond({ error: "Request is not ready to send" }, 409);
    try {
      const response = await providerFetch(config, "/envelope/distribute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ envelopeId: row.providerEnvelopeId }) });
      if (!response.ok) return respond({ error: "Signing provider did not confirm delivery; check status before retrying" }, 502);
      await env.DB.prepare("UPDATE signature_requests SET status = 'sent', updated_at = ? WHERE id = ? AND status = 'prepared'").bind(now, row.id).run();
      await audit(access.ownerId, reference, user, "signature_sent", row.id, { envelopeId: row.providerEnvelopeId, signerEmail: row.signerEmail }, now);
      return respond({ id: row.id, status: "sent" });
    } catch { return respond({ error: "Signing provider response unavailable; check status before retrying" }, 502); }
  }
  // A distribution response may be lost after the provider accepts the request.
  if (!["prepared", "sent", "pending", "completed"].includes(row.status)) return respond({ error: "Request has not been prepared" }, 409);
  try {
    const response = await providerFetch(config, `/envelope/${encodeURIComponent(row.providerEnvelopeId)}`);
    if (!response.ok) return respond({ error: "Unable to verify signing status" }, 502);
    const envelope:any = await response.json();
    const providerStatus = String(envelope.status || "");
    if (row.status === "prepared" && providerStatus === "DRAFT") return respond({ id: row.id, status: "prepared" });
    if (!(["PENDING", "COMPLETED", "REJECTED", "CANCELLED"].includes(providerStatus))) return respond({ error: "Unexpected signing status" }, 502);
    if (providerStatus === "COMPLETED" && !row.signedObjectKey) {
      if (!env.BUCKET || !envelope.envelopeItems?.[0]?.id) return respond({ error: "Signed PDF not available from provider" }, 502);
      const pdfResponse = await providerFetch(config, `/envelope/item/${encodeURIComponent(envelope.envelopeItems[0].id)}/download?version=signed`);
      if (!pdfResponse.ok) return respond({ error: "Unable to retrieve signed PDF" }, 502);
      const bytes = await pdfResponse.arrayBuffer();
      if (bytes.byteLength < 5 || bytes.byteLength > 15*1024*1024 || new TextDecoder().decode(bytes.slice(0,5)) !== "%PDF-") return respond({ error: "Invalid signed PDF response" }, 502);
      const sha256 = toHex(await crypto.subtle.digest("SHA-256", bytes));
      const objectKey = `${access.ownerId}/${reference}/signed/${row.id}.pdf`;
      await env.BUCKET.put(objectKey, bytes, { httpMetadata: { contentType: "application/pdf" }, customMetadata: { sha256, sourceDocumentId: row.documentId, sourceSha256: row.documentSha256, providerEnvelopeId: row.providerEnvelopeId } });
      await env.DB.prepare("UPDATE signature_requests SET status = 'completed', signed_object_key = ?, signed_sha256 = ?, updated_at = ? WHERE id = ? AND status IN ('prepared', 'sent', 'pending')").bind(objectKey, sha256, now, row.id).run();
      await audit(access.ownerId, reference, user, "signature_completed_imported", row.id, { sha256, envelopeId: row.providerEnvelopeId }, now);
    } else if (row.status !== "completed") {
      await env.DB.prepare("UPDATE signature_requests SET status = ?, updated_at = ? WHERE id = ? AND status IN ('prepared', 'sent', 'pending')").bind(providerStatus.toLowerCase(), now, row.id).run();
    }
    return respond({ id: row.id, status: providerStatus.toLowerCase() });
  } catch { return respond({ error: "Signing provider unavailable" }, 502); }
}

async function audit(ownerId:string, reference:string, user:{userId:string;email:string}, action:string, id:string, detail:unknown, now:number) {
  await env.DB!.prepare("INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, 'signature_request', ?, ?, ?)").bind(crypto.randomUUID(), ownerId, reference, user.userId, user.email, action, id, JSON.stringify(detail), now).run();
}
