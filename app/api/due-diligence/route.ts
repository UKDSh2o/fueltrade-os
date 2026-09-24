/* eslint-disable @typescript-eslint/no-explicit-any */
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission } from "../../access-control";
import { buildScreeningQuery, summarizeScreeningResponse } from "../../../lib/due-diligence.js";

const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const clean = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);
const runtime = () => env as unknown as Record<string, any>;
const checkTypes = new Set(["sanctions_pep", "kyb", "ubo", "vessel", "bank_details", "insurance"]);
const manualRisk = new Set(["clear", "low", "medium", "high", "critical", "unrated"]);

async function audit(user: any, ownerId: string, reference: string, action: string, subjectId: string, detail: unknown) {
  return env.DB!.prepare(`INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, 'due_diligence_check', ?, ?, ?)`).bind(crypto.randomUUID(), ownerId, reference, user.userId, user.email, action, subjectId, JSON.stringify(detail), Date.now()).run();
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Due-diligence storage is unavailable" }, 503);
  const reference = clean(new URL(request.url).searchParams.get("reference"), 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "trade", "view");
  if (!access) return respond({ error: "Due-diligence access denied" }, 403);
  const checks = await env.DB.prepare(`SELECT id, counterparty_id AS counterpartyId, check_type AS checkType, provider, subject_name AS subjectName, subject_country AS subjectCountry, status, risk_level AS riskLevel, result_json AS resultJson, evidence_url AS evidenceUrl, checked_at AS checkedAt, expires_at AS expiresAt, reviewed_by AS reviewedBy, reviewer_email AS reviewerEmail, review_note AS reviewNote, created_at AS createdAt, updated_at AS updatedAt FROM due_diligence_checks WHERE owner_id = ? AND trade_reference = ? ORDER BY checked_at DESC LIMIT 100`).bind(access.ownerId, reference).all<any>();
  const settings = runtime();
  return respond({
    checks: checks.results.map(row => ({ ...row, result: JSON.parse(row.resultJson || "{}") })),
    screening: { configured: Boolean(settings.OPEN_SANCTIONS_BASE_URL), provider: "OpenSanctions / yente", commercialLicenseRequired: true },
    access: { isOwner: access.isOwner, permissions: access.permissions },
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Due-diligence storage is unavailable" }, 503);
  const body = await request.json() as any;
  const reference = clean(body.reference, 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const now = Date.now();

  if (body.action === "review") {
    const access = await requireTradePermission(env.DB, user, reference, "approvals", "approve");
    if (!access) return respond({ error: "Due-diligence approval permission required" }, 403);
    const id = clean(body.id, 80);
    const status = clean(body.status, 30);
    if (!id || !["cleared", "false_positive", "escalated", "blocked"].includes(status)) return respond({ error: "A valid review decision is required" }, 400);
    const check = await env.DB.prepare(`SELECT counterparty_id AS counterpartyId, risk_level AS riskLevel, status FROM due_diligence_checks WHERE id = ? AND owner_id = ? AND trade_reference = ? LIMIT 1`).bind(id, access.ownerId, reference).first<any>();
    if (!check) return respond({ error: "Due-diligence check not found" }, 404);
    const riskLevel = status === "blocked" ? "critical" : status === "escalated" ? (check.riskLevel === "critical" ? "critical" : "high") : "clear";
    const note = clean(body.note, 1000);
    await env.DB.prepare(`UPDATE due_diligence_checks SET status = ?, risk_level = ?, reviewed_by = ?, reviewer_email = ?, review_note = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND trade_reference = ?`).bind(status, riskLevel, user.userId, user.email, note, now, id, access.ownerId, reference).run();
    if (check.counterpartyId) {
      const counterpartyStatus = ["cleared", "false_positive"].includes(status) ? "approved" : status === "blocked" ? "blocked" : "review";
      await env.DB.prepare(`UPDATE counterparties SET status = ?, risk_rating = ?, updated_at = ? WHERE id = ? AND owner_id = ?`).bind(counterpartyStatus, riskLevel, now, check.counterpartyId, access.ownerId).run();
    }
    await audit(user, access.ownerId, reference, "due_diligence_reviewed", id, { from: check.status, status, riskLevel, note });
    return respond({ id, status, riskLevel, reviewedBy: user.email, updatedAt: now });
  }

  const access = await requireTradePermission(env.DB, user, reference, "trade", "edit");
  if (!access) return respond({ error: "Due-diligence edit permission required" }, 403);
  const checkType = clean(body.checkType, 40);
  const subjectName = clean(body.subjectName, 240);
  const subjectCountry = clean(body.subjectCountry, 80);
  const counterpartyId = clean(body.counterpartyId, 80) || null;
  if (!checkTypes.has(checkType) || !subjectName) return respond({ error: "Check type and subject name are required" }, 400);
  if (counterpartyId) {
    const counterparty = await env.DB.prepare(`SELECT id FROM counterparties WHERE id = ? AND owner_id = ? LIMIT 1`).bind(counterpartyId, access.ownerId).first();
    if (!counterparty) return respond({ error: "Counterparty not found" }, 404);
  }

  let provider = "manual";
  let riskLevel = manualRisk.has(body.riskLevel) ? body.riskLevel : "unrated";
  let status = "pending_review";
  let query: Record<string, unknown> = {};
  let result: Record<string, unknown> = { note: clean(body.note, 1000) };
  let evidenceUrl = clean(body.evidenceUrl, 600) || null;
  if (evidenceUrl) {
    try { if (new URL(evidenceUrl).protocol !== "https:") throw new Error(); } catch { return respond({ error: "Evidence links must use HTTPS" }, 400); }
  }

  if (body.action === "run_screening") {
    if (checkType !== "sanctions_pep" && checkType !== "vessel") return respond({ error: "Automated matching is available for sanctions/PEP and vessel checks" }, 400);
    const settings = runtime();
    const baseValue = clean(settings.OPEN_SANCTIONS_BASE_URL, 500).replace(/\/$/, "");
    if (!baseValue) return respond({ error: "OpenSanctions or a self-hosted yente endpoint is not configured" }, 409);
    let base: URL;
    try { base = new URL(baseValue); } catch { return respond({ error: "Screening endpoint configuration is invalid" }, 503); }
    if (base.protocol !== "https:") return respond({ error: "Screening endpoint must use HTTPS" }, 503);
    query = buildScreeningQuery({ name: subjectName, country: subjectCountry, schema: checkType === "vessel" ? "Vessel" : clean(body.schema, 40) || "Company" });
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "FuelTrade-OS/1.0" };
    if (settings.OPEN_SANCTIONS_API_KEY) headers.authorization = `ApiKey ${settings.OPEN_SANCTIONS_API_KEY}`;
    let screeningResponse: Response;
    try {
      screeningResponse = await fetch(`${baseValue}/match/default`, { method: "POST", headers, body: JSON.stringify({ queries: { q: query } }), signal: AbortSignal.timeout(15000) });
    } catch {
      return respond({ error: "Screening provider is temporarily unavailable" }, 502);
    }
    if (!screeningResponse.ok) return respond({ error: `Screening provider rejected the request (${screeningResponse.status})` }, 502);
    const summary = summarizeScreeningResponse(await screeningResponse.json());
    provider = base.hostname === "api.opensanctions.org" ? "opensanctions" : "yente_self_hosted";
    riskLevel = summary.riskLevel;
    result = summary;
    const topId = summary.matches[0]?.id;
    evidenceUrl = topId && provider === "opensanctions" ? `https://www.opensanctions.org/entities/${encodeURIComponent(topId)}/` : null;
  } else if (body.action !== "record_manual") {
    return respond({ error: "Unsupported due-diligence action" }, 400);
  }

  const id = crypto.randomUUID();
  const expiresAt = body.expiresAt ? Date.parse(String(body.expiresAt)) : now + 90 * 86400000;
  await env.DB.prepare(`INSERT INTO due_diligence_checks (id, owner_id, trade_reference, counterparty_id, check_type, provider, subject_name, subject_country, status, risk_level, query_json, result_json, evidence_url, checked_at, expires_at, reviewed_by, reviewer_email, review_note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, '', ?, ?)`).bind(id, access.ownerId, reference, counterpartyId, checkType, provider, subjectName, subjectCountry, status, riskLevel, JSON.stringify(query), JSON.stringify(result), evidenceUrl, now, Number.isFinite(expiresAt) ? expiresAt : null, now, now).run();
  await audit(user, access.ownerId, reference, body.action === "run_screening" ? "screening_completed" : "due_diligence_recorded", id, { checkType, provider, riskLevel, counterpartyId });
  return respond({ id, checkType, provider, subjectName, subjectCountry, status, riskLevel, result, evidenceUrl, checkedAt: now, expiresAt: Number.isFinite(expiresAt) ? expiresAt : null }, 201);
}
