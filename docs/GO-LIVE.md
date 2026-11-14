# Dummy mode and go-live

FuelTrade OS can run end to end against **simulated** providers, so the whole system can be tested before any real account, API key or licence exists. Every external service is reached through the same runtime variables in dummy mode and in live mode. Going live means changing those values. No application code changes.

## What dummy mode proves, and what it does not

It proves the application's own behaviour: permissions, margin redaction, dual control, document fingerprints, the signing lifecycle, webhook signature checks, outage handling, audit entries and notification isolation. It also proves that each adapter speaks the HTTP shape we expect.

It does **not** prove that any real provider behaves the same way. The mock is written from the documented shapes. The first real call to each provider is still a test, and its failures are likely to be about credentials, licensing, account configuration or small differences in the provider's responses. Nothing simulated is a real signature, sanctions result, vessel position, message or price. Dummy records are labelled `dummy` in the database and the audit log.

## Where everything dummy lives

| Piece | Location |
| --- | --- |
| Every integration, its variables, dummy values and the live notes | `lib/providers.js` (the single manifest) |
| The simulated providers | `dummy/mock-providers.mjs` |
| Dummy users (sign-in headers) | `dummy/users.mjs` |
| The end-to-end run | `dummy/e2e.mjs` |
| Dummy-mode switch | the runtime variable `DUMMY_PROVIDERS=1` |

Dummy mode is on only when `DUMMY_PROVIDERS=1`. With it off, plain HTTP and loopback addresses are refused exactly as before, and the market routes ignore `ECB_DAILY_URL` and `EIA_API_ROOT`.

## Run it

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test:e2e        # starts the mock providers and the real built app, runs every scenario
pnpm dummy:mock      # optional: run only the mock server on 127.0.0.1:8799
```

`GET /api/providers` (signed in) reports each integration as `dummy`, `live` or `unconfigured`, lists missing variable names and warns when dummy mode is on. It never returns a value.

## Dummy access

Sites normally injects the signed-in identity after real sign-in. The end-to-end run sends the same identity headers directly for seven dummy users (`dummy/users.mjs`): owner, buyer, seller, legal, bank, captain and an uninvited outsider. This tests the real permission code. It is not a login system. Real participants must be invited in the Access tab and given Sites access, as described in the roadmap.

## Simulated behaviours worth knowing

- Screening: a name containing `sanction` returns a critical match, `similar` returns a medium name-alike, anything else is clear.
- Signing: the envelope stays pending until the test calls `POST /__control/documenso/complete/<id>`. The returned PDF ends with a `DUMMY-SIGNED` marker.
- Chatwoot: conversation IDs 1000 to 1099 exist.
- Outages: `POST /__control/fail/<provider>` makes that provider return 503 until `DELETE`d.

## Go-live: swap the dummy values for real ones

Set these in the Sites runtime (never in GitHub, D1 or the browser). Do them one integration at a time.

| Integration | Variables to set | What to put there |
| --- | --- | --- |
| **Documenso e-signatures** (Signing drafts, send, status, signed PDF return) | `DOCUMENSO_URL`<br>`DOCUMENSO_API_TOKEN` | HTTPS URL of your self-hosted Documenso (no /api/v2) and a team API token. See deploy/documenso and docs/e-signatures.md. |
| **Chatwoot external messaging** (Link external conversations, send replies, receive webhooks) | `CHATWOOT_URL`<br>`CHATWOOT_ACCOUNT_ID`<br>`CHATWOOT_API_TOKEN`<br>`CHATWOOT_WEBHOOK_SECRET` (optional)<br>`CHATWOOT_WEBHOOK_TOKEN` (optional) | Self-hosted Chatwoot base URL, account ID, API access token and webhook secret. See docs/communications.md. |
| **Novu notifications** (Priority message notification delivery) | `NOVU_API_URL`<br>`NOVU_API_KEY`<br>`NOVU_WORKFLOW_ID` | Novu API URL, API key and the workflow identifier to trigger. |
| **OpenSanctions / yente screening** (Sanctions, PEP and vessel match suggestions) | `OPEN_SANCTIONS_BASE_URL`<br>`OPEN_SANCTIONS_API_KEY` (optional) | api.opensanctions.org (licensed key) or your self-hosted yente HTTPS URL with a lawfully licensed dataset. |
| **Vessel tracking provider** (Sync vessel position by IMO) | `VESSEL_TRACKING_BASE_URL`<br>`VESSEL_TRACKING_API_KEY` (optional) | HTTPS endpoint of a lawful vessel-position provider that returns the position JSON shape in dummy/mock-providers.mjs, plus its key. |
| **Reply-drafting AI** (Draft replies on conversations) | `COMMUNICATION_AI_BASE_URL`<br>`COMMUNICATION_AI_MODEL` (optional)<br>`COMMUNICATION_AI_API_KEY` (optional) | Any OpenAI-compatible /chat/completions endpoint (self-hosted recommended), model name and key. |
| **EIA petroleum benchmarks** (Brent/WTI/product prices and stocks) | `EIA_API_KEY`<br>`EIA_API_ROOT` (optional) | A free EIA API key (EIA_API_ROOT is only for the dummy server; leave it unset). |
| **ECB FX reference rates** (Official euro reference rates) | `ECB_DAILY_URL` (optional) | No configuration needed. ECB_DAILY_URL is only for the dummy server; leave it unset. |

### Steps

1. Obtain the access for one integration (see the right-hand column and the linked docs).
2. In the Sites runtime, set its variables. **Remove `DUMMY_PROVIDERS` and any `ECB_DAILY_URL` or `EIA_API_ROOT` once no integration still uses the dummy server.** Do not set `DUMMY_PROVIDERS` in production.
3. Open `/api/providers`. The integration must read `live`, and `dummyMode` must be `false` when everything is live.
4. Run one real transaction for that integration with test data and a person watching: send one real signing invitation, run one screening, sync one vessel, send one message.
5. Only then record the feature as live in `docs/ROADMAP.md`, which requires an end-to-end deployed test.

### Provider-specific reminders

- **Chatwoot:** register the webhook URL `/api/communications/webhook` with the same `CHATWOOT_WEBHOOK_SECRET`. The signature header is `x-chatwoot-signature`.
- **Documenso:** needs working SMTP and a signing certificate before invitations reach recipients. See `deploy/documenso`.
- **Screening:** a licensed dataset is required for commercial use. A screening match never clears itself; an approver decides.
- **Tracking:** the provider must return latitude, longitude, speed, course and a timestamp. Adjust the adapter if a provider uses another shape; `dummy/mock-providers.mjs` shows the expected one.
