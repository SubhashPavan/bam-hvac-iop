# Inventory Optimization — Backend

FastAPI backend for the Inventory Optimization accelerator. Serves the same
typed contract the frontend already uses (`types/inventory.ts`,
`store/requestStore.ts`), so the UI flips from mock → API with no shape changes.

Architecture: [`../docs/inventory-backend-architecture.md`](../docs/inventory-backend-architecture.md).

## Run (local, zero-config — SQLite)

```bash
cd inventory-backend
python -m venv .venv && .venv\Scripts\activate     # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8020
```

On first start it creates the DB and seeds the deterministic demo dataset
(13 plants, ~1,400 materials, recommendations) — the same numbers as the
frontend mock. Open http://localhost:8020/docs.

## Postgres

Set `DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/inventory` in `.env`.
Same async code path; no other change.

## Endpoints (v1, `/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/plants` · `/plants/{id}` | plant list / detail |
| GET | `/materials` | filter/search/paginate (plant_id, search, ved, fsn, xyz, category, sort, page) |
| GET | `/materials/{id}` | material by code |
| GET | `/recommendations` | AI recommendations (filter/paginate) |
| GET | `/kpis` | the 8 overview tiles (plant_id filter) |
| GET | `/forecast/{id}` | full forecast: history + horizon + prediction bands + accuracy + inventory policy (safety stock / reorder point) |
| GET | `/forecast` | per-material forecast summaries for the grid (pattern / method / accuracy / trend) |
| GET | `/forecast/aggregate` | aggregate demand outlook across a plant selection |
| GET | `/forecast/movers` | biggest demand shifts (growth / decline) |
| GET | `/opportunities` | six optimization plays grouped, each item with a workflow `action_seed` |
| GET | `/classification` | ABC / XYZ / FSN / VED buckets + matrices + performance scorecard |
| POST | `/simulate` | Monte Carlo what-if (demand surge / supplier delay / service target) → result + snapshot |
| GET | `/simulate/tradeoff` | service-level ↔ investment curve |
| POST/GET | `/simulate/snapshots` | persist / list scenario snapshots (workflow evidence) |
| POST | `/agent/query` | ask Sage — Claude tool-calling over all endpoints (+ rule fallback); returns answer + typed blocks |
| GET | `/agent/status` | whether the LLM is configured + model |
| POST | `/ingest/preview` | parse a CSV → headers, sample rows, auto-mapping |
| POST | `/ingest/csv` | validate + transform + activate (replaces the analytical dataset) |
| GET | `/ingest/sources` · `/ingest/template` | ingestion runs · CSV template |
| GET | `/requests` | workflow requests (stage / plant_id filter) |
| POST | `/requests` | create action request |
| POST | `/requests/{id}/decision` | approve / reject (advances the stage machine) |
| POST | `/requests/{id}/send-back` | send back one stage |

## Layout

```
app/
  api/v1/        routers (plants, materials, recommendations, kpis, forecast, workflow)
  ml/            forecasting engine:
                   methods.py   Croston / SBA / TSB / SES + Syntetos–Boylan classify + backtest
                   planning.py  safety stock / reorder point (probabilistic, service-level driven)
                   service.py   orchestration -> API response shapes
  services/      kpi_service (derived tiles)
  repositories/  inventory_repo (+ demand series), workflow_repo (+ state machine)
  schemas/       Pydantic = the TS types (+ forecast)
  db/            SQLAlchemy models + async session
  data/          generate.py (seeded port of inventoryMock.ts) + demand.py (series) + seed.py
```

## Forecasting engine

Intermittent-demand-aware (MRO spares are lumpy). Per material:
1. **Classify** the demand series by ADI / CV² into the Syntetos–Boylan quadrant
   (smooth / intermittent / erratic / lumpy).
2. **Auto-select** the method: SES (smooth), Croston SBA (intermittent/erratic),
   **TSB** (lumpy / obsolescence — decays discontinued parts toward zero).
3. **Backtest** rolling-origin → MAE / bias / **MASE** (accuracy shown to the UI).
4. **Plan**: safety stock = z(SL)·σ·√(lead), reorder point = demand·lead + SS.

Implemented directly in `app/ml` (numpy only). Production can swap in Nixtla
`statsforecast` / LightGBM behind `auto_forecast` without changing the API.

## Optimization + opportunity engine

`app/ml/optimize.py` derives the **optimal stock target** per material from the
forecast: `target = reorder_point + cycle_stock`. `app/services/opportunity_service.py`
compares that to on-hand and emits the six MRO plays, each with a ready
`action_seed` (POST it to `/requests` to start the approval workflow):

- **excess_inventory** — on-hand well above target → reduce to optimal
- **safety_stock_overstock** — coverage past the reorder point → trim policy
- **obsolete_stock** — no/near-zero demand (TSB≈0) holding value → write-off
- **stock_transfer** — same category/supplier: excess at plant A, deficit at B
- **duplicate_materials** — overlapping SKUs at a plant → rationalize
- **supplier_consolidation** — a category split across 4+ suppliers → consolidate

`app/services/classification_service.py` serves ABC (Pareto), XYZ/FSN/VED,
the ABC×XYZ / VED×FSN matrices, and the scorecard (turns, DIO, policy
compliance, obsolescence rate).

## Simulation

`app/ml/simulate.py` — Monte Carlo what-if. `tradeoff_curve` sweeps target
service levels → required investment (diminishing-returns curve).
`simulate_scenario` bootstraps demand-over-lead from history and counts
stockouts vs on-hand under a demand surge / supplier delay / service target;
returns attained service, stockout risk, at-risk count, and required
investment, plus a `snapshot` that attaches to a workflow request as evidence.
Deterministic (fixed RNG seed) so a scenario reproduces exactly.

## Sage agent (`app/agent`)

Natural-language layer over every endpoint. `POST /agent/query` returns an NL
answer plus typed UI blocks (kpis / opportunities / forecast / scenario / …).

- **LLM path** (`llm.py`): Claude via Azure AI Foundry runs a tool-calling loop
  over `tools.py` (get_kpis, find_opportunities, forecast_material, classify,
  run_simulation, tradeoff, search_materials, create_action). Creds are read
  from this service's `.env` or fall back to the platform backend's `.env`.
- **Rule path** (`nlu.py`): a deterministic intent router with the same tools —
  the offline fallback, always available. The orchestrator prefers the LLM and
  degrades to rules on any error.

Answers are grounded in real tool output (never invented); plant names resolve
to ids (from the **current** data, so it works after ingestion too);
`create_action` is side-effectful (raises a workflow request) and only fires
when the user explicitly asks.

## Ingestion (`app/ingest`)

Medallion pipeline that makes the backend run on real customer data:

- **bronze** — raw CSV (parsed; `IngestionSource` records the run)
- **silver** — `validate_transform`: coerce types, auto-map columns (fuzzy
  header matching, same 10 core fields as the Admin UI), derive missing fields
  (unit_cost, on-hand qty, monthly demand, criticality), build plants, and
  generate a demand history per material
- **gold** — `activate` replaces the analytical tables; every endpoint
  (kpis / forecast / opportunities / classification / simulate / agent) then
  operates on the ingested data. Workflow state is left untouched.

Flow: `POST /ingest/preview` (auto-map) → confirm mapping → `POST /ingest/csv`
(activate). CSV is passed as text, so no multipart dependency. Verified: a
messy-header file auto-mapped 10/10 core fields and lit up the whole stack.

## Roadmap

Phase 1 (this) → workflow engine → forecasting (statsforecast Croston/SBA/TSB)
→ optimization/opportunities → simulation → agent → ingestion → Databricks/MLOps.
