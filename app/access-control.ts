import { normalizePermissions, permissionAllows } from "../lib/access-control.js";

type User = { userId: string; email: string };
type RequiredLevel = "view" | "edit" | "approve";

export type TradeAccess = {
  ownerId: string;
  reference: string;
  isOwner: boolean;
  memberId: string | null;
  role: string;
  marginScope: string;
  permissions: Record<string, string>;
};

export async function resolveTradeAccess(db: D1Database, user: User, reference: string): Promise<TradeAccess | null> {
  const owned = await db.prepare(
    "SELECT owner_id AS ownerId FROM trades WHERE owner_id = ? AND reference = ? LIMIT 1",
  ).bind(user.userId, reference).first<{ ownerId: string }>();
  if (owned) return ownerAccess(owned.ownerId, reference);

  const membership = await db.prepare(`
    SELECT tm.id, tm.owner_id AS ownerId, tm.role, tm.margin_scope AS marginScope,
      tm.permissions_json AS permissionsJson
    FROM trade_members tm
    INNER JOIN trades t ON t.owner_id = tm.owner_id AND t.reference = tm.trade_reference
    WHERE tm.member_user_id = ? AND tm.trade_reference = ? AND tm.status = 'active'
    LIMIT 2
  `).bind(user.userId, reference).all<any>();
  if (membership.results.length !== 1) return null;
  const row = membership.results[0];
  return {
    ownerId: row.ownerId,
    reference,
    isOwner: false,
    memberId: row.id,
    role: row.role,
    marginScope: row.marginScope,
    permissions: normalizePermissions(safeJson(row.permissionsJson)),
  };
}

export async function requireTradePermission(
  db: D1Database,
  user: User,
  reference: string,
  permission: string,
  required: RequiredLevel = "view",
): Promise<TradeAccess | null> {
  const access = await resolveTradeAccess(db, user, reference);
  if (!access) return null;
  return access.isOwner || permissionAllows(access.permissions, permission, required) ? access : null;
}

export function ownerAccess(ownerId: string, reference: string): TradeAccess {
  return {
    ownerId,
    reference,
    isOwner: true,
    memberId: null,
    role: "owner",
    marginScope: "all",
    permissions: normalizePermissions(Object.fromEntries(
      ["trade", "documents", "finance", "insurance", "logistics", "approvals", "comments"].map(key => [key, "approve"]),
    )),
  };
}

function safeJson(value: string) {
  try { return JSON.parse(value); } catch { return {}; }
}
