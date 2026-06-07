#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/multi-cooperation}"
REPO_URL="${REPO_URL:-https://github.com/yezhouyedu/multicooperation.git}"
BRANCH="${BRANCH:-main}"
WORK_DIR="${WORK_DIR:-/tmp/multi-cooperation-git-sync}"

step() {
  echo
  echo "==> $1"
}

step "[1/4] Checking git"
if ! command -v git >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y git
fi
git --version

step "[2/4] Fetching source from GitHub"
rm -rf "$WORK_DIR"
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$WORK_DIR"

step "[3/4] Syncing source into app directory"
mkdir -p "$APP_DIR"
rsync -a --delete \
  --exclude='.env.production' \
  --exclude='00_start_materials' \
  --exclude='storage' \
  --exclude='apps/server/storage' \
  "$WORK_DIR/" "$APP_DIR/"

step "[4/4] Cleaning temporary checkout"
rm -rf "$WORK_DIR"

echo
echo "GitHub sync finished: $APP_DIR"
echo "Next: cd $APP_DIR && sudo bash scripts/deploy/deploy-prod.sh"
