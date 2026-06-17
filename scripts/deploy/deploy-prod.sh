#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/multi-cooperation}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.production.yml}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-http://127.0.0.1:3000/login}"
SERVER_HEALTH_URL="${SERVER_HEALTH_URL:-http://127.0.0.1:3001/health}"
TARGET="${1:-all}"

case "$TARGET" in
  all|web|server) ;;
  *)
    echo "Usage: bash scripts/deploy/deploy-prod.sh [all|web|server]"
    exit 2
    ;;
esac

step() {
  echo
  echo "==> $1"
}

cd "$APP_DIR"

step "[1/8] Checking deployment files"
test -f "$COMPOSE_FILE" || { echo "Missing $COMPOSE_FILE"; exit 1; }
test -f "$ENV_FILE" || { echo "Missing $ENV_FILE. Copy .env.production.example and fill real values first."; exit 1; }
test -f "apps/server/Dockerfile" || { echo "Missing apps/server/Dockerfile"; exit 1; }
test -f "apps/web/Dockerfile" || { echo "Missing apps/web/Dockerfile"; exit 1; }

step "[2/8] Showing compose plan"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/tmp/multi-cooperation-compose.rendered.yml
echo "Compose config rendered to /tmp/multi-cooperation-compose.rendered.yml"

step "[3/8] Building images ($TARGET)"
if [ "$TARGET" = "all" ]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build
else
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build "$TARGET"
fi

step "[4/8] Starting services ($TARGET)"
if [ "$TARGET" = "all" ]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d
else
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d "$TARGET"
fi

step "[5/8] Waiting for containers"
sleep 10
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

step "[6/8] Checking server health"
for i in $(seq 1 30); do
  if curl -fsS "$SERVER_HEALTH_URL"; then
    echo
    echo "Server health OK"
    break
  fi
  echo "Waiting for server health... ($i/30)"
  sleep 3
  if [ "$i" = "30" ]; then
    echo "Server health check failed"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=120 server
    exit 1
  fi
done

step "[7/8] Checking web"
for i in $(seq 1 20); do
  if curl -fsSI "$WEB_HEALTH_URL" >/dev/null; then
    echo "Web health OK"
    break
  fi
  echo "Waiting for web... ($i/20)"
  sleep 3
  if [ "$i" = "20" ]; then
    echo "Web check failed"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=120 web
    exit 1
  fi
done

step "[8/8] Deployment summary"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
echo
echo "Deployment finished."
echo "Web:    $WEB_HEALTH_URL"
echo "Server: $SERVER_HEALTH_URL"
