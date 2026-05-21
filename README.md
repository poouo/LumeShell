# LumeShell

LumeShell is a modern self-hosted WebSSH workspace for individual developers. It saves encrypted SSH credentials locally, opens multiple terminal tabs, browses server files through SFTP, uploads files or folders by drag and drop, stores quick commands, shows lightweight server metrics, and includes one-click backup and upgrade flows.

![LumeShell logo](client/public/logo.svg)

## Features

- Password-protected admin console with configurable token lifetime.
- Encrypted local storage for server passwords, private keys, and passphrases.
- Multiple WebSSH terminal tabs with xterm.js.
- Buffered command input for unstable networks.
- SFTP file browser with drag-and-drop file/folder upload and file/folder download.
- Saved quick commands that can be sent to the active terminal.
- Server overview with CPU, memory, disk, and last-15-second network traffic.
- Light and dark modes.
- JSON export/import for complete data recovery.
- GitHub version checks and in-app upgrade progress.

## Security Notes

LumeShell stores data on the server in `data/`. Sensitive SSH fields are encrypted at rest with AES-256-GCM. Browser-to-server traffic must use HTTPS/WSS on public networks. You can either put LumeShell behind a TLS reverse proxy or set `LUMESHELL_HTTPS_KEY` and `LUMESHELL_HTTPS_CERT` for native HTTPS.

Backups contain `store.json` and `app-secret.key`, so a backup can restore all encrypted credentials. Treat backup files like password-vault exports.

## Quick Install

After replacing `OWNER/lumeshell` with your GitHub repository:

```bash
curl -fsSL https://raw.githubusercontent.com/OWNER/lumeshell/main/scripts/install.sh | sudo LUMESHELL_REPO=OWNER/lumeshell bash
```

Windows PowerShell:

```powershell
$env:LUMESHELL_REPO="OWNER/lumeshell"; iwr https://raw.githubusercontent.com/OWNER/lumeshell/main/scripts/install.ps1 -UseBasicParsing | iex
```

## Manual Development

```bash
npm install
npm run dev
```

The API listens on `http://localhost:8090`, and Vite listens on `http://localhost:5173`.

## Production

```bash
npm install
npm run build
npm start
```

Environment variables are documented in `.env.example`.

## Upgrade

Linux:

```bash
sudo LUMESHELL_INSTALL_DIR=/opt/lumeshell bash /opt/lumeshell/scripts/upgrade.sh
```

Windows:

```powershell
.\scripts\upgrade.ps1
```

The Settings page can also start an upgrade task and stream progress.

## Uninstall

Linux keeps data by default:

```bash
sudo bash /opt/lumeshell/scripts/uninstall.sh
```

Set `LUMESHELL_KEEP_DATA=false` to remove everything.

## Name

LumeShell combines "lume" for light and dark workspace modes with the shell at the center of the product. The project is small on purpose: a practical console for personal developers who want their own web terminal without a heavy platform.
