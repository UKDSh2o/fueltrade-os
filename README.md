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
