import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission } from "../../access-control";

const respond = (body: unknown, status = 200) => Response.json(body, { status });
const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const cents = (value: unknown) => Math.max(0, Math.round(Number(value) * 100 || 0));

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Risk storage is unavailable" }, 503);
  const reference = new URL(request.url).searchParams.get("reference")?.trim();
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "insurance", "view");
  if (!access) return respond({ error: "Insurance and risk access denied" }, 403);
  const [policy, cases] = await Promise.all([
    env.DB.prepare(`SELECT policy_type AS policyType, insurer, broker, policy_number AS policyNumber, currency, limit_cents AS limitCents, deductible_cents AS deductibleCents, premium_cents AS premiumCents, inception_date AS inceptionDate, expiry_date AS expiryDate, coverage_json AS coverageJson, status, updated_at AS updatedAt FROM insurance_policies WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>(),
    env.DB.prepare(`SELECT id, case_type AS caseType, title, severity, status, amount_cents AS amountCents, counterparty, occurred_at AS occurredAt, description, resolution, updated_at AS updatedAt, created_at AS createdAt FROM risk_cases WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at DESC LIMIT 50`).bind(access.ownerId, reference).all<any>(),
  ]);
  return respond({ policy: policy ? { ...policy, coverage: JSON.parse(policy.coverageJson) } : null, cases: cases.results ?? [] });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Risk storage is unavailable" }, 503);
  const body = await request.json() as any;
  const reference = text(body.reference, 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "insurance", "edit");
  if (!access) return respond({ error: "Insurance and risk edit permission required" }, 403);
  const now = Date.now();

  if (body.action === "save_policy") {
    const validTypes = ["marine_cargo", "all_risks_cargo", "stock_throughput", "terminal_liability", "trade_credit"];
    const validStatuses = ["draft", "quoted", "bound", "active", "expired", "cancelled"];
    if (!validTypes.includes(body.policyType)) return respond({ error: "Select a valid policy type" }, 400);
    const coverage = ["cargo", "loading", "unloading", "storage", "trucking", "war", "strikes", "politicalRisk"].reduce((result: Record<string, boolean>, key) => ({ ...result, [key]: Boolean(body.coverage?.[key]) }), {});
    const existing = await env.DB.prepare(`SELECT id, created_at AS createdAt FROM insurance_policies WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>();
    const id = existing?.id ?? crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO insurance_policies (id, owner_id, trade_reference, policy_type, insurer, broker, policy_number, currency, limit_cents, deductible_cents, premium_cents, inception_date, expiry_date, coverage_json, status, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET policy_type=excluded.policy_type, insurer=excluded.insurer, broker=excluded.broker, policy_number=excluded.policy_number, currency=excluded.currency, limit_cents=excluded.limit_cents, deductible_cents=excluded.deductible_cents, premium_cents=excluded.premium_cents, inception_date=excluded.inception_date, expiry_date=excluded.expiry_date, coverage_json=excluded.coverage_json, status=excluded.status, updated_at=excluded.updated_at`).bind(id, access.ownerId, reference, body.policyType, text(body.insurer, 120), text(body.broker, 120), text(body.policyNumber, 100), text(body.currency || "USD", 3), cents(body.limit), cents(body.deductible), cents(body.premium), body.inceptionDate ? Date.parse(body.inceptionDate) : null, body.expiryDate ? Date.parse(body.expiryDate) : null, JSON.stringify(coverage), validStatuses.includes(body.status) ? body.status : "draft", now, existing?.createdAt ?? now).run();
    return respond({ id, updatedAt: now });
  }

  if (body.action === "create_case") {
    const validTypes = ["incident", "claim", "dispute"];
    const validSeverities = ["low", "medium", "high", "critical"];
    if (!validTypes.includes(body.caseType) || !text(body.title, 140)) return respond({ error: "Case type and title are required" }, 400);
    const id = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO risk_cases (id, owner_id, trade_reference, case_type, title, severity, status, amount_cents, counterparty, occurred_at, description, resolution, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, access.ownerId, reference, body.caseType, text(body.title, 140), validSeverities.includes(body.severity) ? body.severity : "medium", "open", cents(body.amount), text(body.counterparty, 120), body.occurredAt ? Date.parse(body.occurredAt) : now, text(body.description, 1200), "", now, now).run();
    return respond({ id, createdAt: now }, 201);
  }

  if (body.action === "update_case") {
    const validStatuses = ["open", "investigating", "submitted", "negotiating", "resolved", "closed"];
    const id = text(body.id, 80);
    if (!id || !validStatuses.includes(body.status)) return respond({ error: "Case and valid status are required" }, 400);
    const result = await env.DB.prepare(`UPDATE risk_cases SET status = ?, resolution = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND trade_reference = ?`).bind(body.status, text(body.resolution, 1200), now, id, access.ownerId, reference).run();
    if (!result.meta.changes) return respond({ error: "Case not found" }, 404);
    return respond({ id, updatedAt: now });
  }
  return respond({ error: "Unsupported risk action" }, 400);
}
