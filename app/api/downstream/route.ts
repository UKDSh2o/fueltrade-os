import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission } from "../../access-control";

const respond = (body: unknown, status = 200) => Response.json(body, { status });
const clean = (value: unknown, max = 120) => String(value ?? "").trim().slice(0, max);
const moneyCents = (value: unknown) => Math.round((Number(value) || 0) * 100);
const validStageTypes = ["port_storage","terminal_handling","trucking","destination_storage","retail_storage"];

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Downstream storage is unavailable" }, 503);
  const reference = clean(new URL(request.url).searchParams.get("reference"), 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "trade", "view");
  if (!access) return respond({ error: "Downstream access denied" }, 403);
  const row = await env.DB.prepare(`SELECT input_mt AS inputMt, litres_per_mt AS litresPerMt, stages_json AS stagesJson, retail_price_cents_per_litre AS retailPriceCentsPerLitre, taxes_cents_per_litre AS taxesCentsPerLitre, status, updated_at AS updatedAt FROM downstream_plans WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>();
  return respond({ plan: row ? { ...row, stages: JSON.parse(row.stagesJson) } : null });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Downstream storage is unavailable" }, 503);
  const body = await request.json() as any;
  const reference = clean(body.reference, 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "trade", "edit");
  if (!access) return respond({ error: "Downstream edit permission required" }, 403);
  const stages = Array.isArray(body.stages) ? body.stages.slice(0,8).map((stage: any) => ({
    key: clean(stage.key, 40),
    type: validStageTypes.includes(stage.type) ? stage.type : "port_storage",
    name: clean(stage.name, 100),
    owner: clean(stage.owner, 100),
    days: Math.max(0, Math.min(365, Number(stage.days) || 0)),
    freeDays: Math.max(0, Math.min(365, Number(stage.freeDays) || 0)),
    fixedCost: Math.max(0, Number(stage.fixedCost) || 0),
    dailyCost: Math.max(0, Number(stage.dailyCost) || 0),
    costPerMt: Math.max(0, Number(stage.costPerMt) || 0),
    lossPct: Math.max(0, Math.min(10, Number(stage.lossPct) || 0)),
    custodyConfirmed: Boolean(stage.custodyConfirmed),
  })) : [];
  if (!stages.length) return respond({ error: "At least one downstream stage is required" }, 400);
  const now = Date.now();
  const existing = await env.DB.prepare(`SELECT id, created_at AS createdAt FROM downstream_plans WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>();
  const id = existing?.id ?? crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO downstream_plans (id, owner_id, trade_reference, input_mt, litres_per_mt, stages_json, retail_price_cents_per_litre, taxes_cents_per_litre, status, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET input_mt=excluded.input_mt, litres_per_mt=excluded.litres_per_mt, stages_json=excluded.stages_json, retail_price_cents_per_litre=excluded.retail_price_cents_per_litre, taxes_cents_per_litre=excluded.taxes_cents_per_litre, status=excluded.status, updated_at=excluded.updated_at`).bind(id, access.ownerId, reference, Math.max(0, Math.round(Number(body.inputMt)||0)), Math.max(0, Math.round(Number(body.litresPerMt)||0)), JSON.stringify(stages), moneyCents(body.retailPricePerLitre), moneyCents(body.taxesPerLitre), ["draft","planned","active","reconciled"].includes(body.status)?body.status:"draft", now, existing?.createdAt ?? now).run();
  return respond({ id, updatedAt: now });
}
