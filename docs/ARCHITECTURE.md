# One platform architecture

## Canonical source and runtime

This repository mirrors the source that powers the live FuelTrade OS Site. Make product changes here, then apply the same commit to the Sites source checkout and deploy its matching build. Sites retains a deployment source repository because its publishing service requires one; it is a deployment mirror, not an independent app. A commit is complete only when both source trees match and the Sites version is published. Never run the legacy `server/app.js` or deploy the legacy Vite bundle.

- UI: `app/dashboard.jsx`, `app/full-deal.jsx`, `app/deal-room.jsx`, and CSS.
- Server routes: `app/api/**` in the Sites Worker. Reads and writes use the authenticated ChatGPT user ID and owner-scoped D1 statements.
- Identity: `app/chatgpt-auth.ts` reads Sites-provided signed-in identity. Do not substitute client-selected roles or duplicate password accounts.
- Storage: `db/schema.ts` and incremental `drizzle/*.sql` migrations for D1; R2 for document bytes. Production migrations are applied during Sites publication. For local preview run the pending SQL files in order using `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/NNNN_name.sql`.
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

Currently the live Site is owner-only. `trade_members` rows are proposed participant records; they do not create accounts, invite users, or authorize access. Each deployed route checks the signed-in user and scopes records to owner ID. The Full Deal view shows owner data only. Before wider access, add verified invitations, server-side permission checks for every route, margin-specific response filtering, and an access-policy change for approved members. Do not change the site to public to work around invitations.

Email, WhatsApp, Telegram, video, banks and AI are adapters to add server-side with secrets stored in Sites runtime settings. A UI label or manually entered record does not imply a live provider connection or a completed verification.
