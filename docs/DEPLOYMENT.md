# BAM HVAC IOP — Deployment Guide

Deploys the **Inventory Optimization accelerator** as a standalone web app (no
login) on **Azure App Service for Containers**, with images built in **Azure
Container Registry (ACR)** and data in **Azure Database for PostgreSQL**.

```
┌─────────────────────┐        ┌──────────────────────┐        ┌──────────────────┐
│  Frontend (nginx)   │  HTTPS │  Backend (FastAPI)   │  async │  PostgreSQL      │
│  bam-hvac-iop-app   │───────▶│  bam-hvac-iop-api    │───────▶│  flexible server │
│  React + Vite       │        │  ML + Sage agent     │        │  bam_hvac_iop DB │
└─────────────────────┘        └──────────────────────┘        └──────────────────┘
        :8080                          :8080
```

- **Frontend** is a static React build served by nginx. The standalone build
  boots straight into the accelerator — **no login** — and talks only to the
  backend (`VITE_INVENTORY_API_URL`).
- **Backend** is FastAPI (async SQLAlchemy). It runs the forecasting, stocking
  policy, optimization, network pooling, vendor analytics, ingestion, and the
  Sage assistant. Falls back to SQLite locally; uses Postgres in production.
- On first startup with an empty database it **seeds a demo dataset**; you then
  replace it by uploading your own file (Admin → Data sources).

> **Naming convention:** every Azure resource uses the `bam-hvac-iop-*` prefix
> and the database is `bam_hvac_iop`. Keep it consistent.

---

## 1. Prerequisites

| Tool | Check |
|------|-------|
| Azure CLI ≥ 2.60 | `az version` |
| Logged in | `az login` then `az account show` |
| Right subscription | `az account set --subscription "<SUBSCRIPTION>"` |
| Docker | **Not required** — images build in ACR |

You need permission to create resources in the target resource group (or ask
your Azure admin to run §2 once).

Set these once per shell (adjust to your environment):

```bash
export RG=RG-ESL-HVACAI-DEV          # resource group
export LOC=eastus2                   # region
export ACR=bamhvaciopacr             # registry (globally unique, lowercase)
export PLAN=bam-hvac-iop-plan        # app service plan
export API_APP=bam-hvac-iop-api      # backend web app
export APP_APP=bam-hvac-iop-app      # frontend web app
export PG=bam-hvac-iop-pg            # postgres server (globally unique)
export PG_ADMIN=bamadmin
export PG_PASSWORD='CHANGE-ME-strong-password'
```

---

## 2. One-time provisioning

Skip any resource that already exists. All commands are idempotent-ish; re-running
a `create` on an existing resource is usually a no-op or a harmless update.

### 2.1 Resource group + registry + plan

```bash
az group create -n "$RG" -l "$LOC"

az acr create -g "$RG" -n "$ACR" --sku Basic --admin-enabled true

# Linux plan. B2 is a comfortable demo size; scale later with `az appservice plan update`.
az appservice plan create -g "$RG" -n "$PLAN" --is-linux --sku B2
```

### 2.2 PostgreSQL flexible server + database

```bash
az postgres flexible-server create \
  -g "$RG" -n "$PG" -l "$LOC" \
  --admin-user "$PG_ADMIN" --admin-password "$PG_PASSWORD" \
  --sku-name Standard_B1ms --tier Burstable --version 16 \
  --storage-size 32 --public-access 0.0.0.0

az postgres flexible-server db create -g "$RG" -s "$PG" -d bam_hvac_iop
```

Build the connection string (the backend uses **asyncpg**). URL-encode any
special characters in the password — e.g. `@` → `%40`:

```bash
# example: password "bam@2027" -> "bam%402027"
export DATABASE_URL="postgresql+asyncpg://${PG_ADMIN}:<URL-ENCODED-PW>@${PG}.postgres.database.azure.com:5432/bam_hvac_iop"
```

### 2.3 Web Apps (containers)

Create both apps against a placeholder image first; the real image is pushed in §4.

```bash
ACR_LOGIN=$(az acr show -n "$ACR" --query loginServer -o tsv)

for APPNAME in "$API_APP" "$APP_APP"; do
  az webapp create -g "$RG" -p "$PLAN" -n "$APPNAME" \
    --deployment-container-image-name "mcr.microsoft.com/azuredocs/aci-helloworld:latest"
done

# Let the apps pull from ACR (admin creds).
ACR_PWD=$(az acr credential show -n "$ACR" --query "passwords[0].value" -o tsv)
for APPNAME in "$API_APP" "$APP_APP"; do
  az webapp config container set -g "$RG" -n "$APPNAME" \
    --container-registry-url "https://$ACR_LOGIN" \
    --container-registry-user "$ACR" \
    --container-registry-password "$ACR_PWD"
  az webapp config appsettings set -g "$RG" -n "$APPNAME" \
    --settings WEBSITES_PORT=8080 >/dev/null
done
```

---

## 3. Backend configuration (app settings)

```bash
az webapp config appsettings set -g "$RG" -n "$API_APP" --settings \
  DATABASE_URL="$DATABASE_URL" \
  SEED_ON_STARTUP=true \
  CORS_ORIGINS='["https://'"$APP_APP"'.azurewebsites.net"]' \
  ANTHROPIC_FOUNDRY_KEY="<foundry-key>" \
  ANTHROPIC_FOUNDRY_URL="<foundry-url>" \
  ANTHROPIC_AGENT_MODEL="claude-haiku-4-5"
```

- **`ANTHROPIC_FOUNDRY_*`** power the Sage assistant + LLM narration. Omit them
  and the app still works — Sage falls back to a deterministic rule engine and
  narration uses static templates.
- **`CORS_ORIGINS`** must include the frontend URL, or the browser blocks calls.

---

## 4. Build & deploy

The images build **in ACR** (no local Docker). From the repo root:

```bash
export API_URL="https://${API_APP}.azurewebsites.net"
./deploy.sh          # builds + restarts both; or `./deploy.sh api` / `app`
```

What `deploy.sh` does:
1. `az acr build` the **backend** from `backend/` → `$ACR/bam-hvac-iop-api:latest`, restart the api app.
2. `az acr build` the **frontend** from `frontend/` with build args
   `VITE_INVENTORY_API_URL=$API_URL/api/v1` and `VITE_STANDALONE_ACCELERATOR=true`
   → `$ACR/bam-hvac-iop-app:latest`, restart the app.

The frontend is a **build-time**-configured static bundle, so the API URL is
baked in at build. If the backend URL changes, rebuild the frontend.

---

## 5. Verify

```bash
# backend (allow ~60s after restart for container pull + startup migration)
curl -s https://${API_APP}.azurewebsites.net/health
curl -s -o /dev/null -w "%{http_code}\n" https://${API_APP}.azurewebsites.net/api/v1/kpis

# frontend
open "https://${APP_APP}.azurewebsites.net"     # boots straight into the accelerator
```

Healthy looks like: `{"status":"ok",...}` and `200`. If the data endpoints 500
briefly right after a restart, that's the startup DB migration finishing — retry
after a few seconds.

---

## 6. Loading your own data

The app ships with a seeded demo dataset. To run on real data:

1. Open the app → switch persona to **Admin** → **Data sources**.
2. Upload a CSV in the wide MRO layout: `Material Code`, `Material Description`,
   `Opening stock quantity (...)`, 24× `Receipt quantity(Mon-YYYY)`, 24×
   `Consumption quantity (Mon-YYYY)` (negative), `Closing Stock quantity (...)`,
   `Closing Value (...)`, `Lead time (Months)`.
3. **Ingest & activate** — the pipeline validates, classifies, and computes the
   full stocking policy; the whole accelerator then runs on your data.

Columns the file doesn't carry (plant, category, supplier, VED) are filled with
deterministic placeholder values.

---

## 7. Local development

```bash
# backend
cd backend
python -m venv .venv && . .venv/Scripts/activate   # or source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                                # SQLite default = zero config
uvicorn app.main:app --port 8020 --reload

# frontend (new shell)
cd frontend
cp .env.example .env.local                          # VITE_INVENTORY_API_URL + standalone flag
npm install
npm run dev                                          # http://localhost:5173
```

Open `http://localhost:5173` — it boots into the accelerator. SQLite seeds a demo
dataset on first run; delete `backend/inventory.db` to reseed.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Frontend loads but data is empty / calls fail | `CORS_ORIGINS` missing the frontend URL, or the frontend was built with the wrong `VITE_INVENTORY_API_URL` (rebuild the frontend). |
| All API endpoints 500 after a deploy | Startup DB migration still running (retry in ~30–60s). If it persists, check `az webapp log tail` — usually a bad `DATABASE_URL`. |
| `column ... does not exist` in logs | A model changed but the additive migration didn't run — restart the api; migrations run at startup (`ADD COLUMN IF NOT EXISTS`). |
| Sage gives generic answers / no LLM narration | `ANTHROPIC_FOUNDRY_KEY` / `_URL` not set — the app falls back to rules by design. |
| Container won't start | `WEBSITES_PORT=8080` not set, or ACR pull creds wrong (§2.3). |
| Postgres connection refused | Password not URL-encoded in `DATABASE_URL`, or the flexible server's firewall blocks Azure services. |

Logs:

```bash
az webapp log tail -g "$RG" -n "$API_APP"      # backend
az webapp log tail -g "$RG" -n "$APP_APP"      # frontend (nginx)
```
