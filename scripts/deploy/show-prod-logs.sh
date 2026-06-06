#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/multi-cooperation}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.production.yml}"
SERVICE="${1:-server}"

cd "$APP_DIR"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs -f --tail=120 "$SERVICE"
