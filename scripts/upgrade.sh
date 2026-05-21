#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${LUMESHELL_INSTALL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SERVICE_NAME="${LUMESHELL_SERVICE_NAME:-lumeshell}"
BRANCH="${LUMESHELL_BRANCH:-main}"

progress() {
  printf '[upgrade] %s\n' "$*"
}

cd "$INSTALL_DIR"

progress "Preserving data directory"
mkdir -p data

progress "Fetching latest code"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

progress "Installing dependencies"
npm install

progress "Building frontend"
npm run build

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
  progress "Restarting ${SERVICE_NAME}"
  systemctl restart "$SERVICE_NAME"
else
  progress "No systemd service detected; restart LumeShell manually if needed"
fi

progress "Done"
