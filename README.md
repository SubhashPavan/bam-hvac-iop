# BAM HVAC IOP — Inventory Optimization

An MRO spare-parts **inventory optimization** accelerator. Upload stock and
consumption history and it classifies every material, sizes the full
replenishment policy, surfaces where working capital is trapped, and lets an
AI assistant analyze the portfolio — all in one standalone web app (no login).

## What it does

- **Stocking policy** — per material: unit rate, stock-ledger validation, FSN
  movement class, demand-variability (CV) band and the service level it implies,
  ABC value class, and the full policy: **safety stock, reorder level, reorder
  quantity, maximum & average stock** (with values).
- **Forecasting** — intermittent-demand models (Croston / SBA / TSB / SES) with
  auto method selection and backtested accuracy.
- **Savings Wizard** — an FSN × maintenance-criticality matrix showing where
  capital is trapped, plus grouped savings pockets (excess, obsolete, rebalance,
  supplier consolidation, reorder risk).
- **Network pooling & vendor analytics** — cover shortages from network surplus;
  see how much safety stock each supplier's lead time drives.
- **Sage assistant** — ask questions in plain language; it auto-detects a
  deep-analysis request and runs a multi-step report. Powered by Claude when
  configured, with a deterministic fallback.
- **Ingestion** — upload a wide-format CSV (opening stock, 24 months of receipts
  & consumption, closing stock/value, lead time); the whole app runs on it.

## Repository layout

```
bam-hvac-iop/
├── backend/      FastAPI + async SQLAlchemy + ML (forecasting, policy, agent, ingest)
├── frontend/     React 19 + Vite + Tailwind (the accelerator UI)
├── docs/
│   └── DEPLOYMENT.md   ← full Azure deploy guide
└── deploy.sh     build both images in ACR and restart the App Services
```

## Quick start (local)

```bash
# backend  → http://localhost:8020
cd backend && python -m venv .venv && . .venv/Scripts/activate
pip install -r requirements.txt && cp .env.example .env
uvicorn app.main:app --port 8020 --reload

# frontend → http://localhost:5173
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

SQLite seeds a demo dataset on first run — no database setup needed.

## Deploy

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the full Azure walkthrough
(App Service for Containers + ACR + PostgreSQL). TL;DR once resources exist:

```bash
export API_URL="https://bam-hvac-iop-api.azurewebsites.net"
./deploy.sh
```

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind, Zustand, React Router, Recharts
- **Backend:** FastAPI, SQLAlchemy 2 (async), NumPy, Claude via Azure AI Foundry
- **Data:** PostgreSQL (production) / SQLite (local)
- **Hosting:** Azure App Service for Containers + Azure Container Registry
