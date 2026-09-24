import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { requireTradePermission } from "../../access-control";
import { bankChangeDecision, canApprovePaymentInstruction, maskAccountReference, requiresFinanceApproval } from "../../../lib/finance-controls.js";

const respond = (body: unknown, status = 200) => Response.json(body, { status });
const clean = (value: unknown, max = 160) => String(value ?? "").trim().slice(0, max);
const financeStatuses = ["draft", "requested", "issued", "operative", "discrepant", "settled"];

async function audit(user: any, ownerId: string, reference: string, action: string, subjectType: string, subjectId: string, detail: unknown) {
  await env.DB!.prepare(`INSERT INTO audit_events (id, owner_id, trade_reference, actor_id, actor_email, action, subject_type, subject_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), ownerId, reference, user.userId, user.email, action, subjectType, subjectId, JSON.stringify(detail), Date.now()).run();
}

async function fingerprint(value: string) {
  const bytes = new TextEncoder().encode(value.replace(/\s+/g, "").toUpperCase());
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Finance storage is unavailable" }, 503);
  const reference = clean(new URL(request.url).searchParams.get("reference"), 100);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const access = await requireTradePermission(env.DB, user, reference, "finance", "view");
  if (!access) return respond({ error: "Finance access denied" }, 403);
  const [row, bankChanges, instructions] = await Promise.all([
    env.DB.prepare(`SELECT instrument_type AS instrumentType, instrument_number AS instrumentNumber, issuing_bank AS issuingBank, advising_bank AS advisingBank, currency, amount_cents AS amountCents, issue_date AS issueDate, expiry_date AS expiryDate, escrow_bank AS escrowBank, performance_bond_bps AS performanceBondBps, bank_fees_cents AS bankFeesCents, milestones_json AS milestonesJson, status, updated_at AS updatedAt FROM trade_finance WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>(),
    env.DB.prepare(`SELECT id, beneficiary_name AS beneficiaryName, bank_name AS bankName, swift_bic AS swiftBic, masked_account AS maskedAccount, reason, status, first_approved_by AS firstApprovedBy, first_approved_at AS firstApprovedAt, second_approved_by AS secondApprovedBy, second_approved_at AS secondApprovedAt, created_by AS createdBy, updated_at AS updatedAt, created_at AS createdAt FROM bank_detail_changes WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at DESC LIMIT 30`).bind(access.ownerId, reference).all<any>(),
    env.DB.prepare(`SELECT id, bank_change_id AS bankChangeId, instruction_type AS instructionType, beneficiary_name AS beneficiaryName, bank_name AS bankName, masked_account AS maskedAccount, currency, amount_cents AS amountCents, purpose, status, created_by AS createdBy, submitted_by AS submittedBy, submitted_at AS submittedAt, approved_by AS approvedBy, approved_at AS approvedAt, updated_at AS updatedAt, created_at AS createdAt FROM payment_instructions WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at DESC LIMIT 30`).bind(access.ownerId, reference).all<any>(),
  ]);
  return respond({ finance: row ? { ...row, milestones: JSON.parse(row.milestonesJson) } : null, bankChanges: bankChanges.results, instructions: instructions.results, disclaimer: "Records are approval-controlled instructions only. FuelTrade OS does not move money." });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Finance storage is unavailable" }, 503);
  const body = await request.json() as any;
  const reference = clean(body.reference, 100);
  const action = clean(body.action || "save_plan", 40);
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  if (action === "save_plan") return savePlan(user, reference, body);

  if (action === "request_bank_change") {
    const access = await requireTradePermission(env.DB, user, reference, "finance", "edit");
    if (!access) return respond({ error: "Finance edit permission required" }, 403);
    const beneficiaryName = clean(body.beneficiaryName, 160);
    const bankName = clean(body.bankName, 160);
    const accountReference = clean(body.accountReference, 100).replace(/\s+/g, "").toUpperCase();
    const reason = clean(body.reason, 600);
    const maskedAccount = maskAccountReference(accountReference);
    if (!beneficiaryName || !bankName || !maskedAccount || !reason) return respond({ error: "Beneficiary, bank, account reference and change reason are required" }, 400);
    const id = crypto.randomUUID();
    const now = Date.now();
    const accountFingerprint = await fingerprint(accountReference);
    const duplicate = await env.DB.prepare(`SELECT id FROM bank_detail_changes WHERE owner_id = ? AND trade_reference = ? AND account_fingerprint = ? AND status IN ('pending','first_approved','approved') LIMIT 1`).bind(access.ownerId, reference, accountFingerprint).first<any>();
    if (duplicate) return respond({ error: "These bank details already have an open or approved record" }, 409);
    await env.DB.prepare(`INSERT INTO bank_detail_changes (id, owner_id, trade_reference, beneficiary_name, bank_name, swift_bic, masked_account, account_fingerprint, reason, status, first_approved_by, first_approved_at, second_approved_by, second_approved_at, rejected_by, rejected_at, created_by, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)`).bind(id, access.ownerId, reference, beneficiaryName, bankName, clean(body.swiftBic, 20).toUpperCase(), maskedAccount, accountFingerprint, reason, user.userId, now, now).run();
    await audit(user, access.ownerId, reference, "bank_detail_change_requested", "bank_detail_change", id, { beneficiaryName, bankName, maskedAccount, reason });
    return respond({ id, status: "pending", maskedAccount }, 201);
  }

  if (action === "decide_bank_change") {
    const financeAccess = await requireTradePermission(env.DB, user, reference, "finance", "approve");
    const approvalAccess = await requireTradePermission(env.DB, user, reference, "approvals", "approve");
    if (!financeAccess || !approvalAccess) return respond({ error: "Finance and approval authority are required" }, 403);
    const id = clean(body.id, 80);
    const decision = clean(body.decision, 20);
    const change = await env.DB.prepare(`SELECT id, status, created_by AS createdBy, first_approved_by AS firstApprovedBy FROM bank_detail_changes WHERE id = ? AND owner_id = ? AND trade_reference = ?`).bind(id, financeAccess.ownerId, reference).first<any>();
    if (!change) return respond({ error: "Bank-detail request not found" }, 404);
    const result = bankChangeDecision(change, user.userId, decision);
    if (!result.allowed) return respond({ error: result.reason }, 409);
    const now = Date.now();
    if (result.stage === "first") await env.DB.prepare(`UPDATE bank_detail_changes SET status = 'first_approved', first_approved_by = ?, first_approved_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'pending'`).bind(user.userId, now, now, id, financeAccess.ownerId).run();
    if (result.stage === "second") await env.DB.prepare(`UPDATE bank_detail_changes SET status = 'approved', second_approved_by = ?, second_approved_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'first_approved' AND first_approved_by <> ?`).bind(user.userId, now, now, id, financeAccess.ownerId, user.userId).run();
    if (result.stage === "rejection") await env.DB.prepare(`UPDATE bank_detail_changes SET status = 'rejected', rejected_by = ?, rejected_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND status IN ('pending','first_approved')`).bind(user.userId, now, now, id, financeAccess.ownerId).run();
    await audit(user, financeAccess.ownerId, reference, `bank_detail_change_${result.nextStatus}`, "bank_detail_change", id, { decision, stage: result.stage });
    return respond({ id, status: result.nextStatus });
  }

  if (action === "create_instruction") {
    const access = await requireTradePermission(env.DB, user, reference, "finance", "edit");
    if (!access) return respond({ error: "Finance edit permission required" }, 403);
    const bankChangeId = clean(body.bankChangeId, 80);
    const bank = await env.DB.prepare(`SELECT beneficiary_name AS beneficiaryName, bank_name AS bankName, masked_account AS maskedAccount FROM bank_detail_changes WHERE id = ? AND owner_id = ? AND trade_reference = ? AND status = 'approved'`).bind(bankChangeId, access.ownerId, reference).first<any>();
    if (!bank) return respond({ error: "Select bank details that have completed both approvals" }, 409);
    const amountCents = Math.round(Number(body.amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) return respond({ error: "A positive instruction amount is required" }, 400);
    const id = crypto.randomUUID();
    const now = Date.now();
    await env.DB.prepare(`INSERT INTO payment_instructions (id, owner_id, trade_reference, bank_change_id, instruction_type, beneficiary_name, bank_name, masked_account, currency, amount_cents, purpose, status, created_by, submitted_by, submitted_at, approved_by, approved_at, cancelled_by, cancelled_at, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`).bind(id, access.ownerId, reference, bankChangeId, ["payment", "lc_release", "fee"].includes(body.instructionType) ? body.instructionType : "payment", bank.beneficiaryName, bank.bankName, bank.maskedAccount, clean(body.currency || "USD", 3).toUpperCase(), amountCents, clean(body.purpose, 600), user.userId, now, now).run();
    await audit(user, access.ownerId, reference, "payment_instruction_created", "payment_instruction", id, { amountCents, currency: clean(body.currency || "USD", 3).toUpperCase(), beneficiaryName: bank.beneficiaryName });
    return respond({ id, status: "draft" }, 201);
  }

  if (action === "submit_instruction") {
    const access = await requireTradePermission(env.DB, user, reference, "finance", "edit");
    if (!access) return respond({ error: "Finance edit permission required" }, 403);
    const id = clean(body.id, 80);
    const now = Date.now();
    const result = await env.DB.prepare(`UPDATE payment_instructions SET status = 'pending_approval', submitted_by = ?, submitted_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND trade_reference = ? AND status = 'draft'`).bind(user.userId, now, now, id, access.ownerId, reference).run();
    if (!result.meta.changes) return respond({ error: "Only a draft instruction can be submitted" }, 409);
    await audit(user, access.ownerId, reference, "payment_instruction_submitted", "payment_instruction", id, {});
    return respond({ id, status: "pending_approval" });
  }

  if (action === "approve_instruction") {
    const access = await requireTradePermission(env.DB, user, reference, "finance", "approve");
    if (!access) return respond({ error: "Finance approval permission required" }, 403);
    const id = clean(body.id, 80);
    const instruction = await env.DB.prepare(`SELECT submitted_by AS submittedBy, bank_change_id AS bankChangeId FROM payment_instructions WHERE id = ? AND owner_id = ? AND trade_reference = ? AND status = 'pending_approval'`).bind(id, access.ownerId, reference).first<any>();
    if (!instruction) return respond({ error: "Pending payment instruction not found" }, 404);
    if (instruction.submittedBy === user.userId) return respond({ error: "The submitter cannot approve their own payment instruction" }, 409);
    const [tradeApproval, bankChange] = await Promise.all([
      env.DB.prepare(`SELECT status FROM trade_approvals WHERE owner_id = ? AND trade_reference = ? AND approval_type = 'finance' ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>(),
      env.DB.prepare(`SELECT status FROM bank_detail_changes WHERE id = ? AND owner_id = ? AND trade_reference = ?`).bind(instruction.bankChangeId, access.ownerId, reference).first<any>(),
    ]);
    const gate = canApprovePaymentInstruction({ financeApprovalStatus: tradeApproval?.status, bankChangeStatus: bankChange?.status });
    if (!gate.allowed) return respond({ error: gate.reason }, 409);
    const now = Date.now();
    const result = await env.DB.prepare(`UPDATE payment_instructions SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'pending_approval' AND submitted_by <> ?`).bind(user.userId, now, now, id, access.ownerId, user.userId).run();
    if (!result.meta.changes) return respond({ error: "Payment instruction approval failed safely" }, 409);
    await audit(user, access.ownerId, reference, "payment_instruction_approved", "payment_instruction", id, { disclaimer: "Approved instruction record; no funds transferred" });
    return respond({ id, status: "approved", fundsTransferred: false });
  }

  return respond({ error: "Unsupported finance action" }, 400);
}

async function savePlan(user: any, reference: string, body: any) {
  const validInstruments = ["documentary_lc", "standby_lc", "escrow", "bank_guarantee", "open_account", "advance_payment"];
  if (!validInstruments.includes(body.instrumentType) || !financeStatuses.includes(body.status || "draft")) return respond({ error: "A valid payment instrument and finance status are required" }, 400);
  const access = await requireTradePermission(env.DB!, user, reference, "finance", "edit");
  if (!access) return respond({ error: "Finance edit permission required" }, 403);
  const amountCents = Math.max(0, Math.round(Number(body.amount) * 100 || 0));
  const milestones = Array.isArray(body.milestones) ? body.milestones.slice(0, 6).map((item: any) => ({ key: clean(item.key, 40), percent: Math.max(0, Math.min(100, Number(item.percent) || 0)), dueDate: clean(item.dueDate, 10), status: ["pending", "due", "released", "held"].includes(item.status) ? item.status : "pending" })) : [];
  if (milestones.reduce((sum: number, item: any) => sum + item.percent, 0) > 100) return respond({ error: "Payment milestones cannot exceed 100%" }, 400);
  if (requiresFinanceApproval(body.status, milestones)) {
    const approver = await requireTradePermission(env.DB!, user, reference, "finance", "approve");
    if (!approver) return respond({ error: "Approval permission is required for operative, settled or released payment records" }, 403);
    const approval = await env.DB!.prepare(`SELECT status FROM trade_approvals WHERE owner_id = ? AND trade_reference = ? AND approval_type = 'finance' ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>();
    if (approval?.status !== "approved") return respond({ error: "Complete the trade finance approval before marking funds or an instrument operative" }, 409);
  }
  const now = Date.now();
  const existing = await env.DB!.prepare(`SELECT id, created_at FROM trade_finance WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(access.ownerId, reference).first<any>();
  const id = existing?.id ?? crypto.randomUUID();
  await env.DB!.prepare(`INSERT INTO trade_finance (id, owner_id, trade_reference, instrument_type, instrument_number, issuing_bank, advising_bank, currency, amount_cents, issue_date, expiry_date, escrow_bank, performance_bond_bps, bank_fees_cents, milestones_json, status, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET instrument_type=excluded.instrument_type, instrument_number=excluded.instrument_number, issuing_bank=excluded.issuing_bank, advising_bank=excluded.advising_bank, currency=excluded.currency, amount_cents=excluded.amount_cents, issue_date=excluded.issue_date, expiry_date=excluded.expiry_date, escrow_bank=excluded.escrow_bank, performance_bond_bps=excluded.performance_bond_bps, bank_fees_cents=excluded.bank_fees_cents, milestones_json=excluded.milestones_json, status=excluded.status, updated_at=excluded.updated_at`).bind(id, access.ownerId, reference, body.instrumentType, clean(body.instrumentNumber, 100), clean(body.issuingBank, 120), clean(body.advisingBank, 120), clean(body.currency || "USD", 3).toUpperCase(), amountCents, body.issueDate ? Date.parse(body.issueDate) : null, body.expiryDate ? Date.parse(body.expiryDate) : null, clean(body.escrowBank, 120), Math.max(0, Math.min(10000, Math.round(Number(body.performanceBondPct) * 100 || 0))), Math.max(0, Math.round(Number(body.bankFees) * 100 || 0)), JSON.stringify(milestones), body.status || "draft", now, existing?.created_at ?? now).run();
  await audit(user, access.ownerId, reference, "finance_plan_saved", "trade_finance", id, { status: body.status || "draft", amountCents, releasedMilestones: milestones.filter((item: any) => item.status === "released").map((item: any) => item.key) });
  return respond({ id, updatedAt: now, securedAmountCents: amountCents, fundsTransferred: false });
}
