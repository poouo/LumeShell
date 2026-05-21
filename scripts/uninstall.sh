#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${LUMESHELL_INSTALL_DIR:-/opt/lumeshell}"
SERVICE_NAME="${LUMESHELL_SERVICE_NAME:-lumeshell}"
KEEP_DATA="${LUMESHELL_KEEP_DATA:-true}"

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Please run as root or with sudo."
  exit 1
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  systemctl disable "$SERVICE_NAME" 2>/dev/null || true
  rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
fi

if [ "$KEEP_DATA" = "true" ] && [ -d "$INSTALL_DIR/data" ]; then
  BACKUP_DIR="${INSTALL_DIR}.data.$(date +%Y%m%d%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  cp -a "$INSTALL_DIR/data" "$BACKUP_DIR/"
  echo "Data preserved at $BACKUP_DIR/data"
fi

rm -rf "$INSTALL_DIR"
echo "LumeShell uninstalled"
