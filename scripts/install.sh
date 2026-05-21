#!/usr/bin/env bash
set -euo pipefail

REPO="${LUMESHELL_REPO:-poouo/LumeShell}"
BRANCH="${LUMESHELL_BRANCH:-main}"
INSTALL_DIR="${LUMESHELL_INSTALL_DIR:-/opt/lumeshell}"
SERVICE_NAME="${LUMESHELL_SERVICE_NAME:-lumeshell}"
PORT="${LUMESHELL_PORT:-8090}"

step() {
  printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

need_root() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    echo "Please run as root or with sudo."
    exit 1
  fi
}

need_root

step "Installing dependencies"
if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y curl git ca-certificates
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y curl git ca-certificates
elif command -v yum >/dev/null 2>&1; then
  yum install -y curl git ca-certificates
fi

if ! command -v node >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    step "Installing Node.js 22"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  else
    echo "Node.js 20+ is required. Install Node.js first, then rerun this script."
    exit 1
  fi
fi

step "Fetching LumeShell"
mkdir -p "$(dirname "$INSTALL_DIR")"
if [ -d "$INSTALL_DIR/.git" ]; then
  git -C "$INSTALL_DIR" fetch origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout "$BRANCH"
  git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"
else
  git clone --branch "$BRANCH" "https://github.com/${REPO}.git" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
mkdir -p data

if [ ! -f .env ]; then
  ADMIN_PASSWORD="$(openssl rand -base64 18 2>/dev/null || date +%s%N)"
  cat > .env <<EOF_ENV
NODE_ENV=production
LUMESHELL_HOST=0.0.0.0
LUMESHELL_PORT=${PORT}
LUMESHELL_DATA_DIR=./data
LUMESHELL_ADMIN_PASSWORD=${ADMIN_PASSWORD}
LUMESHELL_TOKEN_TTL_HOURS=24
LUMESHELL_GITHUB_REPO=${REPO}
LUMESHELL_PUBLIC_URL=http://localhost:${PORT}
LUMESHELL_TRUST_PROXY=false
LUMESHELL_REQUIRE_HTTPS=false
LUMESHELL_SECURE_COOKIES=false
EOF_ENV
  chmod 600 .env
  printf '%s\n' "$ADMIN_PASSWORD" > data/initial-admin-password.txt
  chmod 600 data/initial-admin-password.txt
else
  ADMIN_PASSWORD="$(grep '^LUMESHELL_ADMIN_PASSWORD=' .env | head -n 1 | cut -d= -f2- || true)"
  if [ -z "$ADMIN_PASSWORD" ] && [ -f data/initial-admin-password.txt ]; then
    ADMIN_PASSWORD="$(tail -n 1 data/initial-admin-password.txt)"
  fi
fi

step "Installing npm dependencies"
npm install

step "Building frontend"
npm run build

step "Installing systemd service"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF_SERVICE
[Unit]
Description=LumeShell WebSSH
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=$(command -v node) server/index.js
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF_SERVICE

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"

step "Installed"
echo "URL: http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT}"
if [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "Initial admin password: ${ADMIN_PASSWORD}"
fi
echo "Initial password file: ${INSTALL_DIR}/data/initial-admin-password.txt"
echo "For public networks, enable HTTPS through a reverse proxy or LUMESHELL_HTTPS_KEY/CERT."
