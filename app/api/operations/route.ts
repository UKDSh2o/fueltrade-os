import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission } from "../../access-control";

const respond = (body: unknown, status = 200) => Response.json(body, { status });
const controlKeys = ["loi","spa","proofOfFunds","productSpec","q88","insurance","inspection","sanctions","kyc","performanceBond"];

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Operations storage is unavailable" }, 503);
  const reference = new URL(request.url).searchParams.get("reference") ?? "";
  const access = reference ? await requireTradePermission(env.DB, user, reference, "trade", "view") : null;
  if (reference && !access) return respond({ error: "Due-diligence access denied" }, 403);
  const ownerId = access?.ownerId ?? user.userId;
  const [counterparties, control] = await Promise.all([
    env.DB.prepare(`SELECT id, name, type, country, status, risk_rating AS riskRating FROM counterparties WHERE owner_id = ? ORDER BY name LIMIT 100`).bind(ownerId).all(),
    reference ? env.DB.prepare(`SELECT counterparty_id AS counterpartyId, controls_json AS controlsJson, approval_status AS approvalStatus, updated_at AS updatedAt FROM trade_controls WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(ownerId, reference).first<any>() : null,
  ]);
  return respond({ counterparties: counterparties.results, controls: control ? { ...control, values: JSON.parse(control.controlsJson) } : null });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Operations storage is unavailable" }, 503);
  const body = await request.json() as any;
  const now = Date.now();
  if (body.action === "create_counterparty") {
    const name = String(body.name ?? "").trim();
    const country = String(body.country ?? "").trim();
    const type = String(body.type ?? "").trim();
    if (!name || !country || !type) return respond({ error: "Name, country and type are required" }, 400);
    const id = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO counterparties (id, owner_id, name, type, country, status, risk_rating, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', 'unrated', ?, ?)`).bind(id, user.userId, name, type, country, now, now).run();
    return respond({ id, name, country, type }, 201);
  }
  if (body.action === "save_controls") {
    const reference = String(body.reference ?? "").trim();
    if (!reference || !body.values) return respond({ error: "Trade reference and controls are required" }, 400);
    const access = await requireTradePermission(env.DB, user, reference, "trade", "edit");
    if (!access) return respond({ error: "Due-diligence edit permission required" }, 403);
    const values = Object.fromEntries(controlKeys.map(key => [key, Boolean(body.values[key])]));
    const existing = await env.DB.prepare(`SELECT id, created_at FROM trade_controls WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>();
    const id = existing?.id ?? crypto.randomUUID();
    const createdAt = existing?.created_at ?? now;
    const complete = Object.values(values).filter(Boolean).length;
    let approvalStatus = complete >= 8 ? "ready_for_approval" : "not_ready";
    if (body.approvalStatus === "approved") {
      if (complete !== controlKeys.length) return respond({ error: "Every due-diligence control must be complete before approval" }, 409);
      const approvalAccess = await requireTradePermission(env.DB, user, reference, "approvals", "approve");
      if (!approvalAccess) return respond({ error: "Approval permission required" }, 403);
      approvalStatus = "approved";
    }
    await env.DB.prepare(`INSERT INTO trade_controls (id, owner_id, trade_reference, counterparty_id, controls_json, approval_status, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET counterparty_id=excluded.counterparty_id, controls_json=excluded.controls_json, approval_status=excluded.approval_status, updated_at=excluded.updated_at`).bind(id,access.ownerId,reference,body.counterpartyId||null,JSON.stringify(values),approvalStatus,now,createdAt).run();
    await env.DB.prepare(`INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, 'trade_controls', ?, ?, ?)`).bind(crypto.randomUUID(), access.ownerId, reference, user.userId, user.email, approvalStatus === "approved" ? "trade_controls_approved" : "trade_controls_saved", id, JSON.stringify({ complete, total: controlKeys.length, approvalStatus }), now).run();
    return respond({ id, approvalStatus, updatedAt: now });
  }
  return respond({ error: "Unsupported operation" }, 400);
}
