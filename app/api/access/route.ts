import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const respond = (body: unknown, status = 200) => Response.json(body, { status });
const clean = (value: unknown, max = 160) => String(value ?? "").trim().slice(0, max);
const roles = ["owner","buyer","seller","trader","legal","bank","insurer","logistics","viewer"];
const marginScopes = ["all","buyer","seller","summary","none"];
const permissionKeys = ["trade","documents","finance","insurance","logistics","approvals","comments"];
const approvalTypes = [
  { type: "commercial", role: "trader" },
  { type: "due_diligence", role: "legal" },
  { type: "finance", role: "bank" },
  { type: "insurance", role: "insurer" },
  { type: "operations", role: "logistics" },
];

async function audit(user: any, reference: string, action: string, subjectType: string, subjectId: string, detail: unknown) {
  const now = Date.now();
  return env.DB!.prepare(`INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), user.userId, reference, user.userId, user.email, action, subjectType, subjectId, JSON.stringify(detail), now).run();
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Access storage is unavailable" }, 503);
  const reference = clean(new URL(request.url).searchParams.get("reference"), 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const [members, approvals, events] = await Promise.all([
    env.DB.prepare(`SELECT id, email, name, organization, role, permissions_json AS permissionsJson, margin_scope AS marginScope, status, updated_at AS updatedAt FROM trade_members WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at ASC`).bind(user.userId, reference).all<any>(),
    env.DB.prepare(`SELECT id, approval_type AS approvalType, assigned_role AS assignedRole, status, note, decided_by AS decidedBy, decided_at AS decidedAt, updated_at AS updatedAt FROM trade_approvals WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at ASC`).bind(user.userId, reference).all<any>(),
    env.DB.prepare(`SELECT id, actor_email AS actorEmail, action, subject_type AS subjectType, subject_id AS subjectId, detail_json AS detailJson, created_at AS createdAt FROM audit_events WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at DESC LIMIT 30`).bind(user.userId, reference).all<any>(),
  ]);
  return respond({
    members: members.results.map((row: any) => ({ ...row, permissions: JSON.parse(row.permissionsJson) })),
    approvals: approvals.results,
    events: events.results.map((row: any) => ({ ...row, detail: JSON.parse(row.detailJson) })),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Access storage is unavailable" }, 503);
  const body = await request.json() as any;
  const reference = clean(body.reference, 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const now = Date.now();

  if (body.action === "add_member") {
    const email = clean(body.email, 254).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || !roles.includes(body.role) || !marginScopes.includes(body.marginScope)) return respond({ error: "Valid email, role and margin visibility are required" }, 400);
    const permissions = permissionKeys.reduce((result: Record<string, string>, key) => {
      const value = body.permissions?.[key];
      result[key] = ["none","view","edit","approve"].includes(value) ? value : "none";
      return result;
    }, {});
    const existing = await env.DB.prepare(`SELECT id, created_at AS createdAt FROM trade_members WHERE owner_id = ? AND trade_reference = ? AND email = ? LIMIT 1`).bind(user.userId, reference, email).first<any>();
    const id = existing?.id ?? crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO trade_members (id, owner_id, trade_reference, email, name, organization, role, permissions_json, margin_scope, status, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, organization=excluded.organization, role=excluded.role, permissions_json=excluded.permissions_json, margin_scope=excluded.margin_scope, status=excluded.status, updated_at=excluded.updated_at`).bind(id, user.userId, reference, email, clean(body.name, 120), clean(body.organization, 120), body.role, JSON.stringify(permissions), body.marginScope, "pending", now, existing?.createdAt ?? now).run();
    await audit(user, reference, existing ? "member_updated" : "member_added", "trade_member", id, { email, role: body.role, marginScope: body.marginScope });
    return respond({ id, status: "pending" }, existing ? 200 : 201);
  }

  if (body.action === "remove_member") {
    const id = clean(body.id, 80);
    const member = await env.DB.prepare(`SELECT email, role FROM trade_members WHERE id = ? AND owner_id = ? AND trade_reference = ?`).bind(id, user.userId, reference).first<any>();
    if (!member) return respond({ error: "Participant not found" }, 404);
    await env.DB.prepare(`DELETE FROM trade_members WHERE id = ? AND owner_id = ? AND trade_reference = ?`).bind(id, user.userId, reference).run();
    await audit(user, reference, "member_removed", "trade_member", id, member);
    return respond({ id });
  }

  if (body.action === "initialize_approvals") {
    const existing = await env.DB.prepare(`SELECT COUNT(*) AS count FROM trade_approvals WHERE owner_id = ? AND trade_reference = ?`).bind(user.userId, reference).first<any>();
    if (!existing?.count) {
      const statements = approvalTypes.map(item => env.DB!.prepare(`INSERT INTO trade_approvals (id, owner_id, trade_reference, approval_type, assigned_role, status, note, decided_by, decided_at, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), user.userId, reference, item.type, item.role, "pending", "", "", null, now, now));
      await env.DB.batch(statements);
      await audit(user, reference, "approval_chain_created", "trade_approval", "", { stages: approvalTypes.length });
    }
    return respond({ initialized: true });
  }

  if (body.action === "decide_approval") {
    const id = clean(body.id, 80);
    const status = clean(body.status, 20);
    if (!["pending","approved","rejected","changes_requested"].includes(status)) return respond({ error: "Invalid approval status" }, 400);
    const result = await env.DB.prepare(`UPDATE trade_approvals SET status = ?, note = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND trade_reference = ?`).bind(status, clean(body.note, 600), user.email, status === "pending" ? null : now, now, id, user.userId, reference).run();
    if (!result.meta.changes) return respond({ error: "Approval not found" }, 404);
    await audit(user, reference, "approval_decided", "trade_approval", id, { status, note: clean(body.note, 600) });
    return respond({ id, status });
  }
  return respond({ error: "Unsupported access action" }, 400);
}
