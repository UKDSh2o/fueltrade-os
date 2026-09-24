# FuelTrade communications

FuelTrade uses replaceable, self-hosted connectors. No paid-licence component is required.

## Recommended free stack

- Chatwoot community core: unified email, live chat, WhatsApp and Telegram inbox. Run a currently patched release and review its published security advisories before each upgrade.
- Novu community core: multi-channel notification workflows and in-app delivery. Run a currently patched release and validate all notification-link schemes before displaying or following them.
- LiveKit: Apache-2.0 self-hosted WebRTC rooms for the planned voice/video adapter; room tokens must be short-lived and issued only after FuelTrade permission checks.
- Any OpenAI-compatible self-hosted model endpoint, including Ollama-compatible gateways, for message triage and reply drafts.

FuelTrade remains the system of record for trade references, permissions, audit events, priority decisions and notification recipients. External systems transport messages; they do not decide who may see a deal.

## Built-in email sandbox

The Email sandbox channel provides a safe end-to-end test path before an external mailbox is connected. Users can inject incoming test emails, send captured replies, exercise priority detection and create notification and audit records. Sandbox messages remain inside FuelTrade and are never delivered to the public internet.

## Runtime configuration

Secrets must be supplied as deployment environment variables. They must never be entered into the browser or committed to source control.

| Variable | Purpose |
| --- | --- |
| `CHATWOOT_URL` | Base URL of the self-hosted Chatwoot instance |
| `CHATWOOT_API_TOKEN` | Server-side Chatwoot API token |
| `CHATWOOT_ACCOUNT_ID` | Chatwoot account identifier |
| `CHATWOOT_WEBHOOK_SECRET` | Signing secret for modern Chatwoot signed webhooks |
| `CHATWOOT_WEBHOOK_TOKEN` | Shared fallback token for self-hosted webhooks that cannot send signed headers |
| `NOVU_API_URL` | Base URL of the self-hosted Novu API |
| `NOVU_API_KEY` | Server-side Novu API key |
| `NOVU_WORKFLOW_ID` | Identifier of the Novu workflow used for priority deal-message alerts |
| `COMMUNICATION_AI_BASE_URL` | OpenAI-compatible self-hosted AI base URL |
| `COMMUNICATION_AI_API_KEY` | Optional key for the AI gateway |
| `COMMUNICATION_AI_MODEL` | Model name; defaults to `llama3.1` |

## Safety rules

- AI may classify, summarize and draft, but never sends automatically.
- Financial instructions, banking details and contractual commitments require human review.
- Urgent and high-priority messages create FuelTrade notification records for the deal.
- Every connection, conversation, message and AI draft is audit logged.
- External channels remain unavailable until their server-side credentials are configured.
- Only active trade members may appear as participants in an external conversation; external transports never widen FuelTrade permissions.
- Chatwoot should send `message_created` events to `/api/communications/webhook`. Signed webhooks use `CHATWOOT_WEBHOOK_SECRET`; older installations may append the configured `CHATWOOT_WEBHOOK_TOKEN` as the `token` query parameter.
- External FuelTrade conversations are linked by their numeric Chatwoot conversation ID. FuelTrade verifies the conversation through the server-side Chatwoot API before enabling inbound and outbound synchronization.
- Reply drafting always has a conservative built-in assisted mode. When `COMMUNICATION_AI_BASE_URL` is configured, FuelTrade automatically uses that self-hosted model instead; every draft still requires human review and an explicit send action.
- High and urgent inbound Chatwoot messages trigger the configured self-hosted Novu workflow for the conversation participants. A stable transaction ID prevents duplicate alerts, and delivery failures never discard the source message.
