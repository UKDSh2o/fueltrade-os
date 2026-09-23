# FuelTrade OS

Decision and workflow software for refined-product trading. The first MVP models the full landed economics of a trade, compares sourcing scenarios, and surfaces margin, break-even, exposure, and approval signals.

## Run locally

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm test
npm run build
```

## Current scope

- Executive trading dashboard
- Configurable product, volume, route, Incoterm, buy and sell prices
- Freight, insurance, inspection, storage, port, finance, legal and contingency costs
- FX conversion for destination-market reporting
- Gross/net margin, ROI, break-even, working-capital and exposure calculations
- Supplier scenario comparison
- Risk and approval indicators
- Local autosave with no backend dependency

Market feeds and persistence are represented by clean interfaces so licensed Platts/Argus data and an authenticated backend can be connected next.


## Architecture roadmap

FuelTrade OS is evolving into a role-aware deal operating system.

### Current development targets
- Role-based Deal Command Centre and configurable dashboard
- Full Deal workspace with authorization-aware views
- Unified Deal Room for internal messaging and external communication adapters
- Integration registry for email, WhatsApp, Telegram, voice/video and MCP/API providers
- AI-assisted drafting, triage, extraction, alerts and workflow automation
- Auditable event timeline linking communications, documents, tasks and approvals to deals

### Integration principles
- Prefer open-source/self-hostable infrastructure and free tiers during development
- Keep external providers behind adapters
- OAuth/token-based account connection; never store credentials in source control
- Human approval gates for consequential outbound communications
- Test calculation and workflow logic continuously

## Authenticated API (development)

Requires Node.js 24 or newer for built-in SQLite. Copy `.env.example` to a private environment file, set a unique administrator email and a password of at least 12 characters, then launch the API with those environment variables in its process (`npm run api`). Launch `npm run dev` in another terminal; Vite proxies `/api` to port 3001. The bootstrap account is created only when the database has no users. Never commit the environment file or `data/`.

The API stores users, HTTP-only sessions, deal records, membership, messages and audit entries in SQLite. Administrators can add users with `POST /api/users` and grant access with `POST /api/deals/:id/members`. Deal reads and chat require deal membership, regardless of the displayed role. Traders can edit their own deals; other roles have read-only deal data and can participate in chat. Accounts, deal sharing, password recovery, backup and migration need an operational admin UI before general use.

**Deployment boundary:** This API currently listens on localhost for development. The Vite build is frontend assets only and does not deploy the API, its database, or sessions. Configure a persistent volume, TLS reverse proxy, backups, secret injection, rate limiting, and an authenticated deployment before using it with real transaction data. Email, WhatsApp, Telegram, calls, documents and AI remain unconnected; the interface labels those channels as planned. No provider keys belong in the repository.
