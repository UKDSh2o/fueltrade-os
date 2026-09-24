import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission, resolveTradeAccess } from "../../access-control";

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

async function audit(user: any, ownerId: string, reference: string, action: string, subjectType: string, subjectId: string, detail: unknown) {
  const now = Date.now();
  return env.DB!.prepare(`INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), ownerId, reference, user.userId, user.email, action, subjectType, subjectId, JSON.stringify(detail), now).run();
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Access storage is unavailable" }, 503);
  const reference = clean(new URL(request.url).searchParams.get("reference"), 100);
  if (!reference) {
    const invitations = await env.DB.prepare(`SELECT tm.id, tm.trade_reference AS reference, tm.name, tm.organization, tm.role, tm.margin_scope AS marginScope, tm.created_at AS createdAt FROM trade_members tm INNER JOIN trades t ON t.owner_id = tm.owner_id AND t.reference = tm.trade_reference WHERE lower(tm.email) = ? AND tm.status = 'pending' AND tm.member_user_id IS NULL ORDER BY tm.created_at DESC LIMIT 25`).bind(user.email.toLowerCase()).all<any>();
    return respond({ invitations: invitations.results });
  }
  const access = await requireTradePermission(env.DB, user, reference, "trade", "view");
  if (!access) return respond({ error: "Trade access denied" }, 403);
  const memberFilter = access.isOwner ? "" : " AND id = ?";
  const memberQuery = env.DB.prepare(`SELECT id, email, name, organization, role, permissions_json AS permissionsJson, margin_scope AS marginScope, status, accepted_at AS acceptedAt, updated_at AS updatedAt FROM trade_members WHERE owner_id = ? AND trade_reference = ?${memberFilter} ORDER BY created_at ASC`);
  const [members, approvals, events] = await Promise.all([
    access.isOwner ? memberQuery.bind(access.ownerId, reference).all<any>() : memberQuery.bind(access.ownerId, reference, access.memberId).all<any>(),
    env.DB.prepare(`SELECT id, approval_type AS approvalType, assigned_role AS assignedRole, status, note, decided_by AS decidedBy, decided_at AS decidedAt, updated_at AS updatedAt FROM trade_approvals WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at ASC`).bind(access.ownerId, reference).all<any>(),
    env.DB.prepare(`SELECT id, actor_email AS actorEmail, action, subject_type AS subjectType, subject_id AS subjectId, detail_json AS detailJson, created_at AS createdAt FROM audit_events WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at DESC LIMIT 30`).bind(access.ownerId, reference).all<any>(),
  ]);
  return respond({
    members: members.results.map((row: any) => ({ ...row, permissions: JSON.parse(row.permissionsJson) })),
    approvals: approvals.results,
    events: events.results.map((row: any) => ({ ...row, detail: JSON.parse(row.detailJson) })),
    access: { isOwner: access.isOwner, role: access.role, marginScope: access.marginScope, permissions: access.permissions },
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

  if (body.action === "accept_invitation") {
    const invites = await env.DB.prepare(`SELECT id, owner_id AS ownerId, role FROM trade_members WHERE trade_reference = ? AND lower(email) = ? AND status = 'pending' AND member_user_id IS NULL LIMIT 2`).bind(reference, user.email.toLowerCase()).all<any>();
    if (invites.results.length !== 1) return respond({ error: invites.results.length ? "Invitation is ambiguous; ask the trade owner to issue a distinct reference" : "Pending invitation not found" }, invites.results.length ? 409 : 404);
    const invite = invites.results[0];
    const accepted = await env.DB.prepare(`UPDATE trade_members SET member_user_id = ?, status = 'active', accepted_at = ?, updated_at = ? WHERE id = ? AND status = 'pending' AND member_user_id IS NULL`).bind(user.userId, now, now, invite.id).run();
    if (!accepted.meta.changes) return respond({ error: "Invitation was already accepted or withdrawn" }, 409);
    await audit(user, invite.ownerId, reference, "invitation_accepted", "trade_member", invite.id, { role: invite.role });
    return respond({ id: invite.id, status: "active", role: invite.role });
  }

  const access = await resolveTradeAccess(env.DB, user, reference);
  if (!access) return respond({ error: "Trade access denied" }, 403);

  if (body.action === "add_member") {
    if (!access.isOwner) return respond({ error: "Only the trade owner can invite participants" }, 403);
    const email = clean(body.email, 254).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || !roles.includes(body.role) || !marginScopes.includes(body.marginScope)) return respond({ error: "Valid email, role and margin visibility are required" }, 400);
    const permissions = permissionKeys.reduce((result: Record<string, string>, key) => {
      const value = body.permissions?.[key];
      result[key] = ["none","view","edit","approve"].includes(value) ? value : "none";
      return result;
    }, {});
    const existing = await env.DB.prepare(`SELECT id, status, created_at AS createdAt FROM trade_members WHERE owner_id = ? AND trade_reference = ? AND email = ? LIMIT 1`).bind(access.ownerId, reference, email).first<any>();
    const id = existing?.id ?? crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO trade_members (id, owner_id, trade_reference, email, member_user_id, name, organization, role, permissions_json, margin_scope, status, accepted_at, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, organization=excluded.organization, role=excluded.role, permissions_json=excluded.permissions_json, margin_scope=excluded.margin_scope, updated_at=excluded.updated_at`).bind(id, access.ownerId, reference, email, null, clean(body.name, 120), clean(body.organization, 120), body.role, JSON.stringify(permissions), body.marginScope, "pending", null, now, existing?.createdAt ?? now).run();
    await audit(user, access.ownerId, reference, existing ? "member_updated" : "member_added", "trade_member", id, { email, role: body.role, marginScope: body.marginScope });
    return respond({ id, status: existing?.status ?? "pending" }, existing ? 200 : 201);
  }

  if (body.action === "remove_member") {
    if (!access.isOwner) return respond({ error: "Only the trade owner can remove participants" }, 403);
    const id = clean(body.id, 80);
    const member = await env.DB.prepare(`SELECT email, role FROM trade_members WHERE id = ? AND owner_id = ? AND trade_reference = ?`).bind(id, access.ownerId, reference).first<any>();
    if (!member) return respond({ error: "Participant not found" }, 404);
    await env.DB.prepare(`DELETE FROM trade_members WHERE id = ? AND owner_id = ? AND trade_reference = ?`).bind(id, access.ownerId, reference).run();
    await audit(user, access.ownerId, reference, "member_removed", "trade_member", id, member);
    return respond({ id });
  }

  if (body.action === "initialize_approvals") {
    if (!access.isOwner) return respond({ error: "Only the trade owner can initialize approvals" }, 403);
    const existing = await env.DB.prepare(`SELECT COUNT(*) AS count FROM trade_approvals WHERE owner_id = ? AND trade_reference = ?`).bind(access.ownerId, reference).first<any>();
    if (!existing?.count) {
      const statements = approvalTypes.map(item => env.DB!.prepare(`INSERT INTO trade_approvals (id, owner_id, trade_reference, approval_type, assigned_role, status, note, decided_by, decided_at, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), access.ownerId, reference, item.type, item.role, "pending", "", "", null, now, now));
      await env.DB.batch(statements);
      await audit(user, access.ownerId, reference, "approval_chain_created", "trade_approval", "", { stages: approvalTypes.length });
    }
    return respond({ initialized: true });
  }

  if (body.action === "decide_approval") {
    const id = clean(body.id, 80);
    const status = clean(body.status, 20);
    if (!["pending","approved","rejected","changes_requested"].includes(status)) return respond({ error: "Invalid approval status" }, 400);
    const canApprove = await requireTradePermission(env.DB, user, reference, "approvals", "approve");
    if (!canApprove) return respond({ error: "Approval permission required" }, 403);
    const approval = await env.DB.prepare(`SELECT assigned_role AS assignedRole FROM trade_approvals WHERE id = ? AND owner_id = ? AND trade_reference = ?`).bind(id, access.ownerId, reference).first<any>();
    if (!approval) return respond({ error: "Approval not found" }, 404);
    if (!access.isOwner && approval.assignedRole !== access.role) return respond({ error: "This approval is assigned to another role" }, 403);
    const result = await env.DB.prepare(`UPDATE trade_approvals SET status = ?, note = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND trade_reference = ?`).bind(status, clean(body.note, 600), user.email, status === "pending" ? null : now, now, id, access.ownerId, reference).run();
    if (!result.meta.changes) return respond({ error: "Approval not found" }, 404);
    await audit(user, access.ownerId, reference, "approval_decided", "trade_approval", id, { status, note: clean(body.note, 600), assignedRole: approval.assignedRole });
    return respond({ id, status });
  }
  return respond({ error: "Unsupported access action" }, 400);
}
