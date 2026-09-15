#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# BAM HVAC IOP — build & deploy both containers to Azure App Service.
# Builds the images in ACR (no local Docker needed) and restarts the apps.
# Prereqs: `az login` done, and the resources from docs/DEPLOYMENT.md exist.
# Usage:   ./deploy.sh              (build + deploy both)
#          ./deploy.sh api          (backend only)
#          ./deploy.sh app          (frontend only)
# ─────────────────────────────────────────────────────────────────────────
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── config — override via environment if your names differ ───────────────
RG="${RG:-RG-ESL-HVACAI-DEV}"
ACR="${ACR:-bamhvaciopacr}"
API_APP="${API_APP:-bam-hvac-iop-api}"
APP_APP="${APP_APP:-bam-hvac-iop-app}"
API_URL="${API_URL:-https://bam-hvac-iop-api.azurewebsites.net}"

TARGET="${1:-all}"

build_api() {
  echo "### build backend → $ACR/$API_APP:latest ###"
  az acr build --no-logs -r "$ACR" -t "$API_APP:latest" "$ROOT/backend" --only-show-errors \
    || { echo "API BUILD FAILED"; exit 1; }
  az webapp restart -g "$RG" -n "$API_APP" >/dev/null && echo "api restarted"
}

build_app() {
  echo "### build frontend → $ACR/$APP_APP:latest (standalone, no login) ###"
  az acr build --no-logs -r "$ACR" -t "$APP_APP:latest" \
    --build-arg "VITE_INVENTORY_API_URL=$API_URL/api/v1" \
    --build-arg "VITE_STANDALONE_ACCELERATOR=true" \
    "$ROOT/frontend" --only-show-errors \
    || { echo "APP BUILD FAILED"; exit 1; }
  az webapp restart -g "$RG" -n "$APP_APP" >/dev/null && echo "app restarted"
}

case "$TARGET" in
  api) build_api ;;
  app) build_app ;;
  all) build_api; build_app ;;
  *)   echo "usage: ./deploy.sh [all|api|app]"; exit 1 ;;
esac

echo "========== DEPLOY COMPLETE =========="
echo "APP  = https://${APP_APP}.azurewebsites.net"
echo "API  = ${API_URL}/health"
