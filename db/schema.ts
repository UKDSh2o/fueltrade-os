import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const trades = sqliteTable("trades", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  reference: text("reference").notNull(),
  product: text("product").notNull(),
  route: text("route").notNull(),
  status: text("status").notNull().default("draft"),
  volumeMt: integer("volume_mt").notNull(),
  buyPriceCents: integer("buy_price_cents").notNull(),
  sellPriceCents: integer("sell_price_cents").notNull(),
  tradeJson: text("trade_json").notNull(),
  netProfitCents: integer("net_profit_cents").notNull(),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_trades_owner_updated").on(table.ownerId, table.updatedAt),
]);

export const counterparties = sqliteTable("counterparties", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  country: text("country").notNull(),
  status: text("status").notNull().default("pending"),
  riskRating: text("risk_rating").notNull().default("unrated"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_counterparties_owner_name").on(table.ownerId, table.name),
]);

export const tradeControls = sqliteTable("trade_controls", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  counterpartyId: text("counterparty_id"),
  controlsJson: text("controls_json").notNull(),
  approvalStatus: text("approval_status").notNull().default("not_ready"),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_trade_controls_owner_reference").on(table.ownerId, table.tradeReference),
]);

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  objectKey: text("object_key").notNull(),
  status: text("status").notNull().default("received"),
  groupId: text("group_id"),
  versionNumber: integer("version_number").notNull().default(1),
  supersedesId: text("supersedes_id"),
  sha256: text("sha256").notNull().default(""),
  uploadedBy: text("uploaded_by").notNull().default(""),
  reviewedBy: text("reviewed_by"),
  reviewedAt: integer("reviewed_at"),
  reviewNote: text("review_note").notNull().default(""),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_documents_owner_trade").on(table.ownerId, table.tradeReference),
  index("idx_documents_owner_trade_group_version").on(table.ownerId, table.tradeReference, table.groupId, table.versionNumber),
]);

export const dueDiligenceChecks = sqliteTable("due_diligence_checks", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  counterpartyId: text("counterparty_id"),
  checkType: text("check_type").notNull(),
  provider: text("provider").notNull().default("manual"),
  subjectName: text("subject_name").notNull(),
  subjectCountry: text("subject_country").notNull().default(""),
  status: text("status").notNull().default("pending_review"),
  riskLevel: text("risk_level").notNull().default("unrated"),
  queryJson: text("query_json").notNull().default("{}"),
  resultJson: text("result_json").notNull().default("{}"),
  evidenceUrl: text("evidence_url"),
  checkedAt: integer("checked_at").notNull(),
  expiresAt: integer("expires_at"),
  reviewedBy: text("reviewed_by"),
  reviewerEmail: text("reviewer_email"),
  reviewNote: text("review_note").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_due_diligence_owner_trade_checked").on(table.ownerId, table.tradeReference, table.checkedAt),
  index("idx_due_diligence_owner_counterparty_type").on(table.ownerId, table.counterpartyId, table.checkType),
]);

export const tradeWorkflows = sqliteTable("trade_workflows", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  currentStage: integer("current_stage").notNull().default(0),
  milestonesJson: text("milestones_json").notNull(),
  targetDelivery: integer("target_delivery"),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_trade_workflows_owner_reference").on(table.ownerId, table.tradeReference),
]);

export const voyages = sqliteTable("voyages", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  vesselName: text("vessel_name").notNull(),
  imo: text("imo").notNull(),
  mmsi: text("mmsi").notNull().default(""),
  flag: text("flag").notNull().default(""),
  loadPort: text("load_port").notNull(),
  dischargePort: text("discharge_port").notNull(),
  eta: integer("eta"),
  cargoMt: integer("cargo_mt").notNull().default(0),
  tankName: text("tank_name").notNull().default(""),
  tankCapacityMt: integer("tank_capacity_mt").notNull().default(0),
  checkpointsJson: text("checkpoints_json").notNull(),
  status: text("status").notNull().default("nominated"),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_voyages_owner_reference").on(table.ownerId, table.tradeReference),
]);

export const tradeFinance = sqliteTable("trade_finance", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  instrumentType: text("instrument_type").notNull().default("documentary_lc"),
  instrumentNumber: text("instrument_number").notNull().default(""),
  issuingBank: text("issuing_bank").notNull().default(""),
  advisingBank: text("advising_bank").notNull().default(""),
  currency: text("currency").notNull().default("USD"),
  amountCents: integer("amount_cents").notNull().default(0),
  issueDate: integer("issue_date"),
  expiryDate: integer("expiry_date"),
  escrowBank: text("escrow_bank").notNull().default(""),
  performanceBondPct: integer("performance_bond_bps").notNull().default(0),
  bankFeesCents: integer("bank_fees_cents").notNull().default(0),
  milestonesJson: text("milestones_json").notNull(),
  status: text("status").notNull().default("draft"),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_trade_finance_owner_reference").on(table.ownerId, table.tradeReference),
]);

export const bankDetailChanges = sqliteTable("bank_detail_changes", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  beneficiaryName: text("beneficiary_name").notNull(),
  bankName: text("bank_name").notNull(),
  swiftBic: text("swift_bic").notNull().default(""),
  maskedAccount: text("masked_account").notNull(),
  accountFingerprint: text("account_fingerprint").notNull(),
  reason: text("reason").notNull().default(""),
  status: text("status").notNull().default("pending"),
  firstApprovedBy: text("first_approved_by"),
  firstApprovedAt: integer("first_approved_at"),
  secondApprovedBy: text("second_approved_by"),
  secondApprovedAt: integer("second_approved_at"),
  rejectedBy: text("rejected_by"),
  rejectedAt: integer("rejected_at"),
  createdBy: text("created_by").notNull(),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_bank_detail_changes_owner_trade_status").on(table.ownerId, table.tradeReference, table.status),
]);

export const paymentInstructions = sqliteTable("payment_instructions", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  bankChangeId: text("bank_change_id"),
  instructionType: text("instruction_type").notNull().default("payment"),
  beneficiaryName: text("beneficiary_name").notNull(),
  bankName: text("bank_name").notNull(),
  maskedAccount: text("masked_account").notNull(),
  currency: text("currency").notNull().default("USD"),
  amountCents: integer("amount_cents").notNull().default(0),
  purpose: text("purpose").notNull().default(""),
  status: text("status").notNull().default("draft"),
  createdBy: text("created_by").notNull(),
  submittedBy: text("submitted_by"),
  submittedAt: integer("submitted_at"),
  approvedBy: text("approved_by"),
  approvedAt: integer("approved_at"),
  cancelledBy: text("cancelled_by"),
  cancelledAt: integer("cancelled_at"),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_payment_instructions_owner_trade_status").on(table.ownerId, table.tradeReference, table.status),
]);

export const insurancePolicies = sqliteTable("insurance_policies", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  policyType: text("policy_type").notNull().default("marine_cargo"),
  insurer: text("insurer").notNull().default(""),
  broker: text("broker").notNull().default(""),
  policyNumber: text("policy_number").notNull().default(""),
  currency: text("currency").notNull().default("USD"),
  limitCents: integer("limit_cents").notNull().default(0),
  deductibleCents: integer("deductible_cents").notNull().default(0),
  premiumCents: integer("premium_cents").notNull().default(0),
  inceptionDate: integer("inception_date"),
  expiryDate: integer("expiry_date"),
  coverageJson: text("coverage_json").notNull(),
  status: text("status").notNull().default("draft"),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_insurance_policies_owner_reference").on(table.ownerId, table.tradeReference),
]);

export const riskCases = sqliteTable("risk_cases", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  caseType: text("case_type").notNull(),
  title: text("title").notNull(),
  severity: text("severity").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  amountCents: integer("amount_cents").notNull().default(0),
  counterparty: text("counterparty").notNull().default(""),
  occurredAt: integer("occurred_at"),
  description: text("description").notNull().default(""),
  resolution: text("resolution").notNull().default(""),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_risk_cases_owner_reference").on(table.ownerId, table.tradeReference),
]);

export const tradeMembers = sqliteTable("trade_members", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  email: text("email").notNull(),
  memberUserId: text("member_user_id"),
  name: text("name").notNull().default(""),
  organization: text("organization").notNull().default(""),
  role: text("role").notNull(),
  permissionsJson: text("permissions_json").notNull(),
  marginScope: text("margin_scope").notNull().default("none"),
  status: text("status").notNull().default("pending"),
  acceptedAt: integer("accepted_at"),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_trade_members_owner_reference").on(table.ownerId, table.tradeReference),
  index("idx_trade_members_user_reference_status").on(table.memberUserId, table.tradeReference, table.status),
  index("idx_trade_members_email_status").on(table.email, table.status),
]);

export const tradeApprovals = sqliteTable("trade_approvals", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  approvalType: text("approval_type").notNull(),
  assignedRole: text("assigned_role").notNull(),
  status: text("status").notNull().default("pending"),
  note: text("note").notNull().default(""),
  decidedBy: text("decided_by").notNull().default(""),
  decidedAt: integer("decided_at"),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_trade_approvals_owner_reference").on(table.ownerId, table.tradeReference),
]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  actorId: text("actor_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull().default(""),
  detailJson: text("detail_json").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_audit_events_owner_reference_created").on(table.ownerId, table.tradeReference, table.createdAt),
]);

export const downstreamPlans = sqliteTable("downstream_plans", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  inputMt: integer("input_mt").notNull().default(0),
  litresPerMt: integer("litres_per_mt").notNull().default(0),
  stagesJson: text("stages_json").notNull(),
  retailPriceCentsPerLitre: integer("retail_price_cents_per_litre").notNull().default(0),
  taxesCentsPerLitre: integer("taxes_cents_per_litre").notNull().default(0),
  status: text("status").notNull().default("draft"),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_downstream_plans_owner_reference").on(table.ownerId, table.tradeReference),
]);

export const retailReconciliations = sqliteTable("retail_reconciliations", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  stationName: text("station_name").notNull(),
  businessDate: text("business_date").notNull(),
  productsJson: text("products_json").notNull(),
  operatingCostCents: integer("operating_cost_cents").notNull().default(0),
  varianceThresholdBps: integer("variance_threshold_bps").notNull().default(50),
  status: text("status").notNull().default("draft"),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_retail_reconciliations_owner_trade_date").on(table.ownerId, table.tradeReference, table.businessDate),
]);

export const sourcingComparisons = sqliteTable("sourcing_comparisons", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  rankingMode: text("ranking_mode").notNull().default("margin"),
  selectedQuoteKey: text("selected_quote_key").notNull().default(""),
  quotesJson: text("quotes_json").notNull(),
  status: text("status").notNull().default("draft"),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_sourcing_comparisons_owner_reference").on(table.ownerId, table.tradeReference),
]);

export const notificationEvents = sqliteTable("notification_events", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  eventKey: text("event_key").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull().default("medium"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  target: text("target").notNull(),
  status: text("status").notNull().default("active"),
  readAt: integer("read_at"),
  lastSeenAt: integer("last_seen_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_notification_events_owner_reference_status").on(table.ownerId, table.tradeReference, table.status),
  index("idx_notification_events_owner_reference_key").on(table.ownerId, table.tradeReference, table.eventKey),
]);

export const dealMessages = sqliteTable("deal_messages", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull(),
  actorId: text("actor_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_deal_messages_owner_reference_created").on(table.ownerId, table.tradeReference, table.createdAt),
]);

export const communicationConnections = sqliteTable("communication_connections", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  provider: text("provider").notNull(),
  displayName: text("display_name").notNull(),
  address: text("address").notNull().default(""),
  endpoint: text("endpoint").notNull().default(""),
  status: text("status").notNull().default("needs_authorization"),
  capabilitiesJson: text("capabilities_json").notNull(),
  lastSyncAt: integer("last_sync_at"),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_communication_connections_owner_provider").on(table.ownerId, table.provider),
]);

export const communicationThreads = sqliteTable("communication_threads", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  tradeReference: text("trade_reference").notNull().default(""),
  channel: text("channel").notNull(),
  threadKind: text("thread_kind").notNull().default("group"),
  externalId: text("external_id").notNull().default(""),
  subject: text("subject").notNull(),
  participantsJson: text("participants_json").notNull(),
  priority: text("priority").notNull().default("normal"),
  priorityReason: text("priority_reason").notNull().default(""),
  status: text("status").notNull().default("open"),
  summary: text("summary").notNull().default(""),
  lastMessageAt: integer("last_message_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_communication_threads_owner_trade_updated").on(table.ownerId, table.tradeReference, table.updatedAt),
]);

export const communicationMessages = sqliteTable("communication_messages", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  threadId: text("thread_id").notNull(),
  externalId: text("external_id").notNull().default(""),
  direction: text("direction").notNull(),
  author: text("author").notNull(),
  body: text("body").notNull(),
  aiPriority: text("ai_priority").notNull().default("normal"),
  aiReason: text("ai_reason").notNull().default(""),
  draftReply: text("draft_reply").notNull().default(""),
  sentAt: integer("sent_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_communication_messages_owner_thread_sent").on(table.ownerId, table.threadId, table.sentAt),
]);

export const dashboardPreferences = sqliteTable("dashboard_preferences", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  roleKey: text("role_key").notNull(),
  tilesJson: text("tiles_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_dashboard_preferences_owner_role").on(table.ownerId, table.roleKey),
]);
