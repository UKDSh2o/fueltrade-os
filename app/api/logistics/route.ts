import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const respond = (body: unknown, status = 200) => Response.json(body, { status });

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Logistics storage is unavailable" }, 503);
  const reference = new URL(request.url).searchParams.get("reference");
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const row = await env.DB.prepare(`SELECT vessel_name AS vesselName, imo, mmsi, flag, load_port AS loadPort, discharge_port AS dischargePort, eta, cargo_mt AS cargoMt, tank_name AS tankName, tank_capacity_mt AS tankCapacityMt, checkpoints_json AS checkpointsJson, status, updated_at AS updatedAt FROM voyages WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(user.userId, reference).first<any>();
  return respond({ voyage: row ? { ...row, checkpoints: JSON.parse(row.checkpointsJson) } : null });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Logistics storage is unavailable" }, 503);
  const body = await request.json() as any;
  const reference = String(body.reference ?? "").trim();
  const vesselName = String(body.vesselName ?? "").trim();
  const imo = String(body.imo ?? "").replace(/\D/g, "");
  if (!reference || !vesselName || (imo && imo.length !== 7)) return respond({ error: "Trade reference, vessel name and a valid seven-digit IMO are required" }, 400);
  const now = Date.now();
  const existing = await env.DB.prepare(`SELECT id, created_at FROM voyages WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(user.userId, reference).first<any>();
  const id = existing?.id ?? crypto.randomUUID();
  const createdAt = existing?.created_at ?? now;
  const checkpoints = Array.isArray(body.checkpoints) ? body.checkpoints.slice(0,8).map((c: any) => ({ key: String(c.key).slice(0,40), complete: Boolean(c.complete) })) : [];
  await env.DB.prepare(`INSERT INTO voyages (id, owner_id, trade_reference, vessel_name, imo, mmsi, flag, load_port, discharge_port, eta, cargo_mt, tank_name, tank_capacity_mt, checkpoints_json, status, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET vessel_name=excluded.vessel_name, imo=excluded.imo, mmsi=excluded.mmsi, flag=excluded.flag, load_port=excluded.load_port, discharge_port=excluded.discharge_port, eta=excluded.eta, cargo_mt=excluded.cargo_mt, tank_name=excluded.tank_name, tank_capacity_mt=excluded.tank_capacity_mt, checkpoints_json=excluded.checkpoints_json, status=excluded.status, updated_at=excluded.updated_at`).bind(id,user.userId,reference,vesselName,imo,String(body.mmsi??"").slice(0,20),String(body.flag??"").slice(0,60),String(body.loadPort??"").slice(0,100),String(body.dischargePort??"").slice(0,100),body.eta?Date.parse(body.eta):null,Math.max(0,Math.round(Number(body.cargoMt)||0)),String(body.tankName??"").slice(0,100),Math.max(0,Math.round(Number(body.tankCapacityMt)||0)),JSON.stringify(checkpoints),String(body.status??"nominated").slice(0,30),now,createdAt).run();
  return respond({ id, updatedAt: now });
}
