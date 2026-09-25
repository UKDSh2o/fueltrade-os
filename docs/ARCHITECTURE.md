# One platform architecture

## Canonical source and runtime

This repository mirrors the source that powers the live FuelTrade OS Site. Make product changes here, then apply the same commit to the Sites source checkout and deploy its matching build. Sites retains a deployment source repository because its publishing service requires one; it is a deployment mirror, not an independent app. A commit is complete only when both source trees match and the Sites version is published. Never run the legacy `server/app.js` or deploy the legacy Vite bundle.

- UI: `app/dashboard.jsx`, `app/full-deal.jsx`, `app/deal-room.jsx`, and CSS.
- Server routes: `app/api/**` in the Sites Worker. Reads and writes resolve the authenticated user to an owner or accepted trade membership before using owner-scoped D1 statements.
- Identity: `app/chatgpt-auth.ts` reads Sites-provided signed-in identity. Do not substitute client-selected roles or duplicate password accounts.
- Storage: `db/schema.ts` and incremental `drizzle/*.sql` migrations for D1; R2 for versioned document bytes. Document downloads resolve trade permission before R2 lookup, force a safe attachment response, disable caching and expose the stored SHA-256 fingerprint. Production migrations are applied during Sites publication. For local preview run the pending SQL files in order using `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/NNNN_name.sql`.
- Approval policy: `lib/deal-events.js`. Urgency is recorded in the deal-room audit; it does not send external messages or authorize payments.

## Consolidation decisions

| Earlier prototype | Canonical implementation |
|---|---|
| Vite React dashboard and economics | Site dashboard, calculator and Full Deal view; prototype UI retired |
| Node `server/app.js`, `node:sqlite`, password sessions | Worker routes, D1 and Sites ChatGPT sign-in; prototype server retired |
| Local-only messages | Owner-scoped D1 deal room with audit record |
| Role catalog and outbound approval policy | Participant records in Access settings; outbound policy moved to `lib/deal-events.js` |
| Browser local autosave | Owner-scoped `/api/trades` records |

## Security boundary

The live Site access policy is still owner-only. Inside the application, `trade_members` now implements verified invitation acceptance: the signed-in email must match one pending invitation and the record is then bound to the stable Sites user ID. Every deal route resolves the owner or active membership, enforces module permission levels, and keeps database and object-storage access scoped to the owning trade. Trade responses redact buyer-side, seller-side and total economics according to the assigned margin scope. Ambiguous invitations fail closed.

Wider collaboration therefore requires two separate owner actions: grant the person access in Sites and create their trade invitation in FuelTrade. The application never makes the Site public as an invitation shortcut. Shared alert definitions remain owner-controlled, while `notification_read_states` keeps each signed-in participant's read/unread state independent.

Email, WhatsApp, Telegram, video, banks and AI remain server-side adapters with secrets stored in Sites runtime settings. Chatwoot and Novu connectors are implemented but remain inactive until an administrator supplies a current patched deployment and credentials. A UI label or manually entered record never implies a live provider connection, completed transfer or completed verification.

Due-diligence evidence follows the same rule. Manual records and OpenSanctions/yente candidate matches remain `pending_review` until a user with approval permission clears, escalates or blocks them. Configure `OPEN_SANCTIONS_BASE_URL` and, for the hosted service, `OPEN_SANCTIONS_API_KEY` only after confirming the applicable commercial data licence. Self-hosted endpoints must use HTTPS. Provider responses are reduced to the five review candidates needed by the deal rather than storing unrestricted source payloads.

Finance controls are records, not payment execution. `bank_detail_changes` stores a SHA-256 fingerprint and last-four display value, never the supplied full account reference. The requester cannot approve the change; two distinct signed-in users with both finance and approval authority must approve it. A payment instruction can only reference an approved bank-detail record, and a different user must approve it after the trade-level finance approval. Operative/settled plans and released milestones are rejected server-side until the finance approval gate is complete. Every decision is written to `audit_events`; no endpoint claims that funds moved.

`payment_execution_evidence` can link an approved banking/payment document to an approved instruction only when amount and currency match exactly. Provider references are duplicate-checked inside the trade. A different user with both finance and approval authority must confirm the evidence; confirmation is still an evidence state, never a claim that FuelTrade initiated or completed a transfer.

Insurance and logistics evidence is also approval-controlled. A policy cannot become bound or active until an approved insurance-category document has been verified by a user with both insurance and approval authority and the trade insurance approval is complete. Vessel IMO numbers use the current seven-digit checksum rule. Manual and provider position reports are range-checked and timestamped; a provider endpoint comes only from the server-side `VESSEL_TRACKING_BASE_URL`, must use HTTPS, and may use the secret `VESSEL_TRACKING_API_KEY`. Port custody handoffs can reference only approved documents, and the recorder cannot accept their own handoff. Provider position reports and custody decisions are reduced to operational fields and recorded in `audit_events`.
