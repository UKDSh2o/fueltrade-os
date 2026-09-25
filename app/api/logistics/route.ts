import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission } from "../../access-control";
import { handoffDecision, isValidImo, normalizeImo, normalizePosition } from "../../../lib/logistics-controls.js";

const respond = (body: unknown, status = 200) => Response.json(body, { status });
const clean = (value: unknown, max = 160) => String(value ?? "").trim().slice(0, max);

async function audit(user: any, ownerId: string, reference: string, action: string, subjectType: string, subjectId: string, detail: unknown) {
  await env.DB!.prepare(`INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), ownerId, reference, user.userId, user.email, action, subjectType, subjectId, JSON.stringify(detail), Date.now()).run();
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Logistics storage is unavailable" }, 503);
  const reference = clean(new URL(request.url).searchParams.get("reference"), 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "logistics", "view");
  if (!access) return respond({ error: "Logistics access denied" }, 403);
  const [row, positions, handoffs] = await Promise.all([
    env.DB.prepare(`SELECT id, vessel_name AS vesselName, imo, mmsi, flag, load_port AS loadPort, discharge_port AS dischargePort, eta, cargo_mt AS cargoMt, tank_name AS tankName, tank_capacity_mt AS tankCapacityMt, checkpoints_json AS checkpointsJson, status, updated_at AS updatedAt FROM voyages WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>(),
    env.DB.prepare(`SELECT id, imo, provider, latitude_e6 AS latitudeE6, longitude_e6 AS longitudeE6, speed_tenths AS speedTenths, course_degrees AS courseDegrees, position_at AS positionAt, source_url AS sourceUrl, received_at AS receivedAt FROM vessel_position_reports WHERE owner_id = ? AND trade_reference = ? ORDER BY position_at DESC LIMIT 50`).bind(access.ownerId, reference).all<any>(),
    env.DB.prepare(`SELECT id, port_name AS portName, handoff_type AS handoffType, from_party AS fromParty, to_party AS toParty, quantity_mt AS quantityMt, document_id AS documentId, status, note, occurred_at AS occurredAt, recorded_by AS recordedBy, accepted_by AS acceptedBy, accepted_at AS acceptedAt, created_at AS createdAt FROM port_handoffs WHERE owner_id = ? AND trade_reference = ? ORDER BY occurred_at DESC LIMIT 50`).bind(access.ownerId, reference).all<any>(),
  ]);
  return respond({ voyage: row ? { ...row, checkpoints: JSON.parse(row.checkpointsJson) } : null, positions: positions.results.map((item: any) => ({ ...item, latitude: item.latitudeE6 / 1e6, longitude: item.longitudeE6 / 1e6, speedKnots: item.speedTenths / 10 })), handoffs: handoffs.results, trackingConfigured: Boolean((env as any).VESSEL_TRACKING_BASE_URL) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Logistics storage is unavailable" }, 503);
  const body = await request.json() as any;
  const reference = clean(body.reference, 100);
  const action = clean(body.action || "save_voyage", 40);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  if (action === "save_voyage") return saveVoyage(user, reference, body);

  if (action === "record_position") {
    const access = await requireTradePermission(env.DB, user, reference, "logistics", "edit");
    if (!access) return respond({ error: "Logistics edit permission required" }, 403);
    return storePosition(user, access.ownerId, reference, body, "manual");
  }

  if (action === "sync_tracking") {
    const access = await requireTradePermission(env.DB, user, reference, "logistics", "edit");
    if (!access) return respond({ error: "Logistics edit permission required" }, 403);
    const baseUrl = clean((env as any).VESSEL_TRACKING_BASE_URL, 500);
    if (!baseUrl) return respond({ error: "A vessel tracking provider has not been configured" }, 409);
    let configured: URL;
    try { configured = new URL(baseUrl); } catch { return respond({ error: "The configured tracking endpoint is invalid" }, 503); }
    if (configured.protocol !== "https:") return respond({ error: "The tracking provider must use HTTPS" }, 503);
    const voyage = await env.DB.prepare(`SELECT id, imo FROM voyages WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>();
    if (!voyage || !isValidImo(voyage.imo)) return respond({ error: "Save a vessel with a valid IMO number first" }, 409);
    configured.searchParams.set("imo", voyage.imo);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(configured, { headers: (env as any).VESSEL_TRACKING_API_KEY ? { Authorization: `Bearer ${(env as any).VESSEL_TRACKING_API_KEY}` } : {}, signal: controller.signal });
      if (!response.ok) return respond({ error: "The tracking provider did not return a usable position" }, 502);
      const payload = await response.json() as any;
      return storePosition(user, access.ownerId, reference, { ...payload, ...(payload.position || {}), sourceUrl: configured.origin }, "provider");
    } catch { return respond({ error: "The tracking provider could not be reached" }, 502); }
    finally { clearTimeout(timeout); }
  }

  if (action === "record_handoff") {
    const access = await requireTradePermission(env.DB, user, reference, "logistics", "edit");
    if (!access) return respond({ error: "Logistics edit permission required" }, 403);
    const handoffType = clean(body.handoffType, 40), portName = clean(body.portName, 120), fromParty = clean(body.fromParty, 160), toParty = clean(body.toParty, 160);
    if (!['loading', 'discharge', 'storage', 'transport'].includes(handoffType) || !portName || !fromParty || !toParty) return respond({ error: "Handoff type, port and both custody parties are required" }, 400);
    const documentId = clean(body.documentId, 80) || null;
    if (documentId) {
      const document = await env.DB.prepare(`SELECT id FROM documents WHERE id = ? AND owner_id = ? AND trade_reference = ? AND status = 'approved'`).bind(documentId, access.ownerId, reference).first<any>();
      if (!document) return respond({ error: "The handoff evidence document must be approved" }, 409);
    }
    const id = crypto.randomUUID(), now = Date.now();
    await env.DB.prepare(`INSERT INTO port_handoffs (id, owner_id, trade_reference, port_name, handoff_type, from_party, to_party, quantity_mt, document_id, status, note, occurred_at, recorded_by, accepted_by, accepted_at, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?, ?, ?, NULL, NULL, ?, ?)`).bind(id, access.ownerId, reference, portName, handoffType, fromParty, toParty, Math.max(0, Math.round(Number(body.quantityMt) || 0)), documentId, clean(body.note, 800), body.occurredAt ? Date.parse(body.occurredAt) : now, user.userId, now, now).run();
    await audit(user, access.ownerId, reference, "port_handoff_recorded", "port_handoff", id, { portName, handoffType, fromParty, toParty, documentId });
    return respond({ id, status: "recorded" }, 201);
  }

  if (action === "decide_handoff") {
    const access = await requireTradePermission(env.DB, user, reference, "logistics", "approve");
    if (!access) return respond({ error: "Logistics approval permission required" }, 403);
    const id = clean(body.id, 80), decision = clean(body.decision, 20);
    const handoff = await env.DB.prepare(`SELECT recorded_by AS recordedBy FROM port_handoffs WHERE id = ? AND owner_id = ? AND trade_reference = ? AND status = 'recorded'`).bind(id, access.ownerId, reference).first<any>();
    if (!handoff) return respond({ error: "Recorded custody handoff not found" }, 404);
    const gate = handoffDecision(handoff.recordedBy, user.userId, decision);
    if (!gate.allowed) return respond({ error: gate.reason }, 409);
    const now = Date.now();
    const result = await env.DB.prepare(`UPDATE port_handoffs SET status = ?, accepted_by = ?, accepted_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND trade_reference = ? AND status = 'recorded'`).bind(gate.status, user.userId, now, now, id, access.ownerId, reference).run();
    if (!result.meta.changes) return respond({ error: "Custody decision failed safely" }, 409);
    await audit(user, access.ownerId, reference, `port_handoff_${gate.status}`, "port_handoff", id, { decision: gate.status });
    return respond({ id, status: gate.status });
  }
  return respond({ error: "Unsupported logistics action" }, 400);
}

async function saveVoyage(user: any, reference: string, body: any) {
  const vesselName = clean(body.vesselName, 160), imo = normalizeImo(body.imo);
  if (!vesselName || !isValidImo(imo)) return respond({ error: "Vessel name and an IMO number with a valid check digit are required" }, 400);
  const access = await requireTradePermission(env.DB!, user, reference, "logistics", "edit");
  if (!access) return respond({ error: "Logistics edit permission required" }, 403);
  const now = Date.now();
  const existing = await env.DB!.prepare(`SELECT id, created_at FROM voyages WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>();
  const id = existing?.id ?? crypto.randomUUID(), checkpoints = Array.isArray(body.checkpoints) ? body.checkpoints.slice(0, 8).map((c: any) => ({ key: clean(c.key, 40), complete: Boolean(c.complete) })) : [];
  await env.DB!.prepare(`INSERT INTO voyages (id, owner_id, trade_reference, vessel_name, imo, mmsi, flag, load_port, discharge_port, eta, cargo_mt, tank_name, tank_capacity_mt, checkpoints_json, status, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET vessel_name=excluded.vessel_name, imo=excluded.imo, mmsi=excluded.mmsi, flag=excluded.flag, load_port=excluded.load_port, discharge_port=excluded.discharge_port, eta=excluded.eta, cargo_mt=excluded.cargo_mt, tank_name=excluded.tank_name, tank_capacity_mt=excluded.tank_capacity_mt, checkpoints_json=excluded.checkpoints_json, status=excluded.status, updated_at=excluded.updated_at`).bind(id, access.ownerId, reference, vesselName, imo, clean(body.mmsi, 20), clean(body.flag, 60), clean(body.loadPort, 100), clean(body.dischargePort, 100), body.eta ? Date.parse(body.eta) : null, Math.max(0, Math.round(Number(body.cargoMt) || 0)), clean(body.tankName, 100), Math.max(0, Math.round(Number(body.tankCapacityMt) || 0)), JSON.stringify(checkpoints), clean(body.status || "nominated", 30), now, existing?.created_at ?? now).run();
  await audit(user, access.ownerId, reference, "voyage_saved", "voyage", id, { vesselName, imo, status: clean(body.status || "nominated", 30) });
  return respond({ id, updatedAt: now });
}

async function storePosition(user: any, ownerId: string, reference: string, body: any, provider: string) {
  const voyage = await env.DB!.prepare(`SELECT id, imo FROM voyages WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(ownerId, reference).first<any>();
  if (!voyage) return respond({ error: "Save the nominated vessel first" }, 409);
  const normalized = normalizePosition(body);
  if (!normalized.valid) return respond({ error: normalized.reason }, 400);
  const id = crypto.randomUUID(), now = Date.now();
  await env.DB!.prepare(`INSERT INTO vessel_position_reports (id, owner_id, trade_reference, voyage_id, imo, provider, latitude_e6, longitude_e6, speed_tenths, course_degrees, position_at, source_url, created_by, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, ownerId, reference, voyage.id, voyage.imo, provider, Math.round(normalized.latitude! * 1e6), Math.round(normalized.longitude! * 1e6), Math.round(normalized.speedKnots! * 10), Math.round(normalized.courseDegrees!), normalized.positionAt, clean(body.sourceUrl, 500), user.userId, now).run();
  await audit(user, ownerId, reference, "vessel_position_recorded", "vessel_position", id, { imo: voyage.imo, provider, positionAt: normalized.positionAt });
  return respond({ id, provider, positionAt: normalized.positionAt }, 201);
}
