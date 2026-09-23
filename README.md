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
