# FuelTrade OS roadmap and release truth

## Live now

- Trade economics and risk score; supplier quotation comparison; and deal-aware official ECB FX references for route, finance, insurance and payment currencies, with optional currency activation and explicit separation of unsupported model assumptions.
- Multi-port route planning, voyage and port operations records.
- D1 trade records, workflow milestones, approvals, counterparties, finance/LC terms, insurance, downstream and retail reconciliation records.
- R2 document versions with secure permission-checked download, SHA-256 fingerprints, review/approval lifecycle and audit events.
- Per-deal document requirements with due dates and latest-version review status. This internal checklist does not assert bank presentation or acceptance.
- Role-scoped Full Deal summary, accepted participant invitations, route-level RBAC, buyer/seller margin redaction, per-user notification read state, audit entries and Sites-managed sign-in.
- Audited internal conversations, safe email sandbox, Chatwoot transport adapter for email/WhatsApp/Telegram and Novu notification adapter. External delivery remains configuration-gated.
- Reviewable KYB/UBO/sanctions/vessel/bank/insurance evidence records, with an optional OpenSanctions or self-hosted yente matching adapter. Automated matches never make the final disposition.
- Approval-gated finance status and payment-instruction records. Beneficiary account references are fingerprinted then discarded, bank-detail changes need two distinct approvers, and instructions are explicitly records rather than transfers.
- Bank execution-evidence records tied to an exact approved instruction and approved document, with duplicate-reference protection and independent confirmation. These records never claim or cause funds movement.
- Insurance evidence verification and activation gates, checksum-validated IMO records, range-checked vessel position evidence, an HTTPS-only tracking adapter boundary, and independently accepted or disputed port custody handoffs.

These are models and records; they do not independently verify a counterparty, policy, vessel, price, payment or document.

## Next dependency order

1. **Collaboration activation:** grant explicit Sites access to approved participants and complete a two-account deployment test. Per-user notification read state is implemented. Never use public access as an invitation shortcut.
2. **Document and DD depth:** reusable requirement templates, document retention, insurer/Q88 validation, periodic re-screening and deployment testing against a lawfully licensed OpenSanctions/yente dataset. Deal-specific document requirements and due dates are implemented.
3. **Banking and logistics:** configure a lawful vessel-position provider and, when authorized, a bank evidence adapter. Manual bank execution evidence, insurance verification, the tracking adapter boundary and port custody handoff records are implemented; providers remain configuration-gated. Never represent recorded amounts as completed transfers.
4. **Communications:** activate a patched self-hosted Chatwoot/Novu stack, then add attachment/search/mention UX and LiveKit self-hosted voice/video. External account connection needs owner authorization and provider credentials.
5. **Market intelligence and AI:** lawful data-source agreements, quote provenance and freshness, role-scoped Copilot retrieval, audit and human approval for consequential automation. Licensed price feeds need subscription rights.
6. **Deployment operations:** stable-checkpoint CI now runs locked installation, control tests, migration-drift detection and the production build. Backups, monitoring, rate limiting, retention policy, recovery exercises and automated Site/GitHub tree-parity checks remain.

Each entry moves to “live” only after an end-to-end deployed test. The `UKDSh2o/fueltrade-os` GitHub repository is the public code checkpoint; never put actual transactions or secrets there.

## Platform comparison (September 2026)

- Komgo Konsole models instrument issuance, amendments, document presentation and settlement in a shared bank/corporate workflow. Our internal finance and document records should eventually link a required document set to each LC amendment and record a separate bank presentation/response; our current checklist only tracks internal review.
- DCSA publishes bill of lading data and eBL platform interoperability specifications. A future eBL adapter should identify provider, standard/version, transferable title state and legal framework rather than treating an uploaded PDF as an electronic title document.
- Open source trade-finance demonstrations on GitHub show workflow concepts but need independent security, maintenance and licensing review before reuse. Keep the present narrow self-hosted components and audited adapter boundaries.

## Command Centre layout

The Deal Command Centre offers trader, legal, vessel captain, port operator, finance and administrator layout lenses. Large buttons lead to working sections, and Full Deal is permanently visible. The signed-in user may customize and save a separate layout for each lens in D1. A lens only changes navigation; server-side permissions and margin scopes determine actual access.

## Conversation visibility

Internal unaddressed group rooms are shared with accepted deal participants who have comments permission. Direct and ticket rooms, and groups with an explicit participant list, are visible only to listed participants and the owner. Server routes enforce this on reads, sends and AI drafts. Priority notifications are filtered by the participant's module permissions and conversation membership; hidden conversations do not leak through the bell. External channel activation remains configuration-gated.
