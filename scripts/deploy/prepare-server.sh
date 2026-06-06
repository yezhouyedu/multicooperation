#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/multi-cooperation}"

step() {
  echo
  echo "==> $1"
}

step "[1/7] Detecting OS"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  echo "OS: ${PRETTY_NAME:-unknown}"
else
  echo "Cannot find /etc/os-release"
fi

step "[2/7] Checking hardware"
echo "CPU cores: $(nproc)"
free -h
df -h /

step "[3/7] Installing basic tools"
if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl gnupg rsync tar
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y ca-certificates curl gnupg2 rsync tar
elif command -v yum >/dev/null 2>&1; then
  yum install -y ca-certificates curl gnupg2 rsync tar
else
  echo "Unsupported package manager. Install curl, rsync, and tar manually."
fi

step "[4/7] Installing Docker if needed"
if command -v docker >/dev/null 2>&1; then
  docker --version
else
  if command -v apt-get >/dev/null 2>&1; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc || curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    . /etc/os-release
    if echo "${ID:-}" | grep -qi ubuntu; then
      DOCKER_DISTRO="ubuntu"
    else
      DOCKER_DISTRO="debian"
    fi
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${DOCKER_DISTRO} ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  else
    curl -fsSL https://get.docker.com | sh
  fi
fi

step "[5/7] Enabling Docker"
systemctl enable docker || true
systemctl start docker || true
docker --version
docker compose version

step "[6/7] Creating app directory"
mkdir -p "$APP_DIR"
echo "App directory: $APP_DIR"

step "[7/7] Final server check"
docker info >/dev/null
df -h "$APP_DIR"
echo "Server preparation finished."
