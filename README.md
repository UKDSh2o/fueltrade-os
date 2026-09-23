# FuelTrade OS

The live platform is a Vinext/React application with Cloudflare Worker routes, D1 structured records, R2 document storage and Sites-managed ChatGPT sign-in. This is the canonical application. The earlier Vite/Node/SQLite prototype is preserved in Git history for reference; it is not a second deployed product or a production API.

**Live site:** https://fueltrade-os.emailds.chatgpt.site (currently owner access only)

## Development

Node.js 24 is recommended. Run `npm run install:ci`, `npm test`, `npx tsc --noEmit`, and `npm run build`. For a local D1 preview, generate migrations with `npm run db:generate`, build, then apply pending migrations using the instructions in `docs/ARCHITECTURE.md`. Deploy the Sites checkout with the Sites workflow. Do not commit tokens, passwords, API keys, real deal data, or local D1 state.

## Status

See [platform architecture](docs/ARCHITECTURE.md) and [roadmap](docs/ROADMAP.md) for the exact boundaries between working features, owner-only records, and integrations that still need providers or permissions. UI records of proposed participants do not grant them access.
