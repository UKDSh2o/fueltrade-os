import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const respond = (body: unknown, status = 200) => Response.json(body, { status });

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Finance storage is unavailable" }, 503);
  const reference = new URL(request.url).searchParams.get("reference");
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const row = await env.DB.prepare(`SELECT instrument_type AS instrumentType, instrument_number AS instrumentNumber, issuing_bank AS issuingBank, advising_bank AS advisingBank, currency, amount_cents AS amountCents, issue_date AS issueDate, expiry_date AS expiryDate, escrow_bank AS escrowBank, performance_bond_bps AS performanceBondBps, bank_fees_cents AS bankFeesCents, milestones_json AS milestonesJson, status, updated_at AS updatedAt FROM trade_finance WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(user.userId, reference).first<any>();
  return respond({ finance: row ? { ...row, milestones: JSON.parse(row.milestonesJson) } : null });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Finance storage is unavailable" }, 503);
  const body = await request.json() as any;
  const reference = String(body.reference ?? "").trim();
  const validInstruments = ["documentary_lc","standby_lc","escrow","bank_guarantee","open_account","advance_payment"];
  if (!reference || !validInstruments.includes(body.instrumentType)) return respond({ error: "Trade reference and valid payment instrument are required" }, 400);
  const amountCents = Math.max(0, Math.round(Number(body.amount) * 100 || 0));
  const milestones = Array.isArray(body.milestones) ? body.milestones.slice(0,6).map((m: any) => ({ key: String(m.key).slice(0,40), percent: Math.max(0,Math.min(100,Number(m.percent)||0)), dueDate: String(m.dueDate??"").slice(0,10), status: ["pending","due","released","held"].includes(m.status)?m.status:"pending" })) : [];
  if (milestones.reduce((sum: number,m: any)=>sum+m.percent,0) > 100) return respond({ error: "Payment milestones cannot exceed 100%" }, 400);
  const now = Date.now();
  const existing = await env.DB.prepare(`SELECT id, created_at FROM trade_finance WHERE owner_id = ? AND trade_reference = ? ORDER BY updated_at DESC LIMIT 1`).bind(user.userId, reference).first<any>();
  const id = existing?.id ?? crypto.randomUUID();
  const createdAt = existing?.created_at ?? now;
  await env.DB.prepare(`INSERT INTO trade_finance (id, owner_id, trade_reference, instrument_type, instrument_number, issuing_bank, advising_bank, currency, amount_cents, issue_date, expiry_date, escrow_bank, performance_bond_bps, bank_fees_cents, milestones_json, status, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET instrument_type=excluded.instrument_type, instrument_number=excluded.instrument_number, issuing_bank=excluded.issuing_bank, advising_bank=excluded.advising_bank, currency=excluded.currency, amount_cents=excluded.amount_cents, issue_date=excluded.issue_date, expiry_date=excluded.expiry_date, escrow_bank=excluded.escrow_bank, performance_bond_bps=excluded.performance_bond_bps, bank_fees_cents=excluded.bank_fees_cents, milestones_json=excluded.milestones_json, status=excluded.status, updated_at=excluded.updated_at`).bind(id,user.userId,reference,body.instrumentType,String(body.instrumentNumber??"").slice(0,100),String(body.issuingBank??"").slice(0,120),String(body.advisingBank??"").slice(0,120),String(body.currency??"USD").slice(0,3),amountCents,body.issueDate?Date.parse(body.issueDate):null,body.expiryDate?Date.parse(body.expiryDate):null,String(body.escrowBank??"").slice(0,120),Math.max(0,Math.min(10000,Math.round(Number(body.performanceBondPct)*100||0))),Math.max(0,Math.round(Number(body.bankFees)*100||0)),JSON.stringify(milestones),String(body.status??"draft").slice(0,30),now,createdAt).run();
  return respond({ id, updatedAt: now, securedAmountCents: amountCents });
}
