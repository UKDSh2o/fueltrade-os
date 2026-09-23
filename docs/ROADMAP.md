# FuelTrade OS roadmap and release truth

## Live now

- Trade economics and risk score; supplier quotation comparison and manual market data inputs.
- Multi-port route planning, voyage and port operations records.
- D1 trade records, workflow milestones, approvals, counterparties, finance/LC terms, insurance, downstream and retail reconciliation records.
- R2 document upload metadata and owner-only deal-room notes.
- Owner-scoped Full Deal summary, notification rules, audit entries, Sites-managed sign-in.

These are models and records; they do not independently verify a counterparty, policy, vessel, price, payment or document.

## Next dependency order

1. **Permissions:** verified invitations and acceptance, route-level RBAC, buyer/seller margin separation and test cases for cross-account access. Keep the Site owner-only until this is enforced.
2. **Deal collaboration:** authorized multi-user chat, attachments, search, mentions, event history and notification delivery. Require owner approval for inviting third parties.
3. **Documents and DD:** secure download, versioning, lifecycle gates, templates, insurer and Q88 checks with evidence provenance.
4. **Banking and logistics:** approval-gated LC/payment instructions, bank-detail change dual approval, insurance verification, ship-tracking adapter and port handoff records. Never represent recorded amounts as completed transfers.
5. **Communications:** OAuth email ingestion and drafted outbound messages with human send gates; Telegram Bot API; WhatsApp Business provider approval; LiveKit self-hosted voice/video. External account connection needs the owner's authorization and provider credentials.
6. **Market intelligence and AI:** lawful data-source agreements, quote provenance and freshness, role-scoped Copilot retrieval, audit and human approval for consequential automation. Licensed price feeds need subscription rights.
7. **Deployment operations:** backups, monitoring, migration checks, rate limiting, retention policy, recovery exercises and CI-driven source mirror checks.

Each entry moves to “live” only after an end-to-end deployed test. The `UKDSh2o/fueltrade-os` GitHub repository is the public code checkpoint; never put actual transactions or secrets there.
