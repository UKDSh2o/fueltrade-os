# FuelTrade OS roadmap and release truth

## Live now

- Trade economics and risk score; supplier quotation comparison and manual market data inputs.
- Multi-port route planning, voyage and port operations records.
- D1 trade records, workflow milestones, approvals, counterparties, finance/LC terms, insurance, downstream and retail reconciliation records.
- R2 document versions with secure permission-checked download, SHA-256 fingerprints, review/approval lifecycle and audit events.
- Role-scoped Full Deal summary, accepted participant invitations, route-level RBAC, buyer/seller margin redaction, notification rules, audit entries and Sites-managed sign-in.
- Audited internal conversations, safe email sandbox, Chatwoot transport adapter for email/WhatsApp/Telegram and Novu notification adapter. External delivery remains configuration-gated.
- Reviewable KYB/UBO/sanctions/vessel/bank/insurance evidence records, with an optional OpenSanctions or self-hosted yente matching adapter. Automated matches never make the final disposition.
- Approval-gated finance status and payment-instruction records. Beneficiary account references are fingerprinted then discarded, bank-detail changes need two distinct approvers, and instructions are explicitly records rather than transfers.
- Insurance evidence verification and activation gates, checksum-validated IMO records, range-checked vessel position evidence, an HTTPS-only tracking adapter boundary, and independently accepted or disputed port custody handoffs.

These are models and records; they do not independently verify a counterparty, policy, vessel, price, payment or document.

## Next dependency order

1. **Collaboration activation:** grant explicit Sites access to approved participants, complete a two-account deployment test and add per-user notification read state. Never use public access as an invitation shortcut.
2. **Document and DD depth:** templates, document retention, insurer/Q88 validation, periodic re-screening and deployment testing against a lawfully licensed OpenSanctions/yente dataset.
3. **Banking and logistics:** connect approved instructions to bank execution evidence and configure a lawful vessel-position provider. Insurance verification, the tracking adapter boundary and port custody handoff records are implemented; the provider itself remains configuration-gated. Never represent recorded amounts as completed transfers.
4. **Communications:** activate a patched self-hosted Chatwoot/Novu stack, then add attachment/search/mention UX and LiveKit self-hosted voice/video. External account connection needs owner authorization and provider credentials.
5. **Market intelligence and AI:** lawful data-source agreements, quote provenance and freshness, role-scoped Copilot retrieval, audit and human approval for consequential automation. Licensed price feeds need subscription rights.
6. **Deployment operations:** backups, monitoring, migration checks, rate limiting, retention policy, recovery exercises and CI-driven source mirror checks.

Each entry moves to “live” only after an end-to-end deployed test. The `UKDSh2o/fueltrade-os` GitHub repository is the public code checkpoint; never put actual transactions or secrets there.

## Command Centre layout

The Deal Command Centre offers trader, legal, vessel captain, port operator, finance and administrator layout lenses. Large buttons lead to working sections, and Full Deal is permanently visible. The signed-in user may customize and save a separate layout for each lens in D1. A lens only changes navigation; server-side permissions and margin scopes determine actual access.
