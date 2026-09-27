# E-signatures

FuelTrade OS integrates with the self-hosted Documenso Community Edition (AGPL-3.0). The signing engine runs as a separate service, while FuelTrade retains deal permissions, source-version identity, audit events and a copy of the completed signed PDF in R2. The integration uses Documenso's envelope API v2.

## Setup

Deploy a maintained Documenso release using its official production Docker Compose guide, with PostgreSQL, signing certificate, durable storage, HTTPS and SMTP configured. Create a team-scoped API token for FuelTrade. Configure these server-side runtime secrets in Sites:

| Variable | Purpose |
| --- | --- |
| `DOCUMENSO_URL` | HTTPS base URL of the self-hosted instance, without `/api/v2` |
| `DOCUMENSO_API_TOKEN` | Team API token, available only to the Worker |

No credential is stored in GitHub, D1 or the browser. A signing request can be drafted before this service exists. Preparing and sending remain disabled until both variables are configured.

## Lifecycle

1. Upload a PDF to the trade document vault. Create a signing draft tied to its document ID and SHA-256 fingerprint.
2. A member with document approval rights prepares the envelope. FuelTrade checks the source PDF bytes against the saved fingerprint, then uploads to Documenso as a draft. A first-page signature field is placed at 10% from the left and 82% from the top; inspect documents for clear space before sending.
3. An approver explicitly sends the invitation. Documenso emails the signer; FuelTrade does not sign on the recipient's behalf.
4. An approver checks provider status. After completion, FuelTrade downloads the signed PDF, checks its format and size, stores it in R2 with a new checksum and exposes a permission-checked download. The original PDF remains immutable.

The signed artifact's checksum confirms stored bytes, not signer identity or the legal sufficiency of a signature. Decide the identity-assurance level and governing law for each agreement. No request is represented as signed merely because an invitation was sent. The current adapter supports one PDF and one signer per request; multi-signer placement, provider reconciliation after uncertain network responses, cancellation, webhook verification and retention controls remain to be built and tested against a configured instance.

References: [Documenso Community Edition](https://docs.documenso.com/docs/policies/community-edition), [envelope API](https://docs.documenso.com/docs/developers/api/documents), [self-hosting](https://docs.documenso.com/docs/self-hosting).
