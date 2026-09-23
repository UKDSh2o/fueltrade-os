import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const respond = (body: unknown, status = 200) => Response.json(body, { status });

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Workflow storage is unavailable" }, 503);
  const reference = new URL(request.url).searchParams.get("reference");
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const row = await env.DB.prepare(`SELECT current_stage AS currentStage, milestones_json AS milestonesJson, target_delivery AS targetDelivery, updated_at AS updatedAt FROM trade_workflows WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(user.userId, reference).first<any>();
  return respond({ workflow: row ? { ...row, milestones: JSON.parse(row.milestonesJson) } : null });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Workflow storage is unavailable" }, 503);
  const body = await request.json() as any;
  const reference = String(body.reference ?? "").trim();
  if (!reference || !Array.isArray(body.milestones) || body.milestones.length !== 8) return respond({ error: "A complete eight-stage workflow is required" }, 400);
  const currentStage = Math.max(0, Math.min(7, Number(body.currentStage) || 0));
  const now = Date.now();
  const existing = await env.DB.prepare(`SELECT id, created_at FROM trade_workflows WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(user.userId, reference).first<any>();
  const id = existing?.id ?? crypto.randomUUID();
  const createdAt = existing?.created_at ?? now;
  const sanitized = body.milestones.map((m: any, index: number) => ({ stage: index, status: ["pending","active","complete","blocked"].includes(m.status) ? m.status : "pending", owner: String(m.owner ?? "").slice(0,80), dueDate: String(m.dueDate ?? "").slice(0,10), note: String(m.note ?? "").slice(0,300) }));
  const targetDelivery = body.targetDelivery ? Date.parse(body.targetDelivery) : null;
  await env.DB.prepare(`INSERT INTO trade_workflows (id, owner_id, trade_reference, current_stage, milestones_json, target_delivery, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET current_stage=excluded.current_stage, milestones_json=excluded.milestones_json, target_delivery=excluded.target_delivery, updated_at=excluded.updated_at`).bind(id,user.userId,reference,currentStage,JSON.stringify(sanitized),targetDelivery,now,createdAt).run();
  return respond({ id, currentStage, updatedAt: now });
}
