# LumeShell Architecture

LumeShell is a self-hosted WebSSH console for individual developers. It favors a small operational surface: one Node.js process, one static React app, JSON persistence with encrypted secrets, and shell scripts for install/upgrade.

## Core Goals

- Password-protected admin console with configurable token validity.
- Encrypted storage for SSH hosts, passwords, private keys, passphrases, and quick commands.
- Browser terminal over WebSocket with an optional buffered input box for unstable networks.
- SFTP file browser with upload, folder upload, file download, and directory ZIP download.
- One-click install, uninstall, and upgrade scripts suitable for GitHub raw execution.
- Light and dark themes with a focused developer-tool UI.

## Runtime Shape

```text
Browser
  React/Vite SPA
  xterm.js terminal
  Drag/drop file manager
       |
       | HTTPS/WSS API + WebSocket on public networks
       v
Node.js Express process
  Auth middleware
  SSH2 terminal bridge
  SFTP file service
  Upgrade task runner
  Static client hosting
       |
       v
data/
  store.json          non-secret metadata + encrypted credential blobs
  app-secret.key      encryption and token signing secret
  upload-tmp/         transient upload chunks
  backups/            optional local backup staging
```

## Security Model

- On first run, LumeShell creates an admin password from `LUMESHELL_ADMIN_PASSWORD` or a generated random value stored in `data/initial-admin-password.txt`.
- Login returns an HttpOnly token cookie signed with `data/app-secret.key`.
- Token lifetime defaults to 24 hours and can be changed in Settings.
- Connection passwords, private keys, and private-key passphrases are encrypted with AES-256-GCM before being written to `store.json`.
- Browser-to-server traffic must use HTTPS/WSS on public networks. LumeShell can either run native HTTPS through `LUMESHELL_HTTPS_KEY` and `LUMESHELL_HTTPS_CERT`, or run behind a TLS reverse proxy with `LUMESHELL_TRUST_PROXY=true`.
- HTTPS redirects can be enforced with `LUMESHELL_REQUIRE_HTTPS=true`, and production secure cookies can be enabled with `LUMESHELL_SECURE_COOKIES=true`.

## Data Model

```text
settings
  tokenTtlHours
  githubRepo
  publicUrl

security
  passwordHash
  passwordSalt
  passwordIterations

connections[]
  id, name, host, port, username, authType
  encrypted password/privateKey/passphrase
  remoteBase

commands[]
  id, title, command, connectionId, tags
```

## API Surface

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET/PUT /api/settings`
- `PUT /api/settings/password`
- `GET/POST/PUT/DELETE /api/connections`
- `GET/POST/PUT/DELETE /api/commands`
- `GET /api/files/list`
- `POST /api/files/mkdir`
- `POST /api/files/rename`
- `POST /api/files/delete`
- `POST /api/files/upload`
- `GET /api/files/download`
- `GET /api/system/version`
- `GET /api/system/metrics`
- `POST /api/system/upgrade`
- `GET /api/system/upgrade/:id/events`
- `GET /api/backup/export`
- `POST /api/backup/import`
- `WS /ws/terminal`

## Backup And Restore

Data export returns one JSON backup containing `store.json` plus `app-secret.key`. The backup can restore encrypted credentials, saved hosts, settings, quick commands, and admin password hash. Because it contains the encryption key, a downloaded backup is sensitive and should be stored like a password-vault export.

## Upgrade Flow

The backend checks GitHub Releases first and falls back to `release.json` on the default branch. A browser-triggered upgrade starts a server-side task that runs `scripts/upgrade.sh` or `scripts/upgrade.ps1`. Progress is streamed to the UI with Server-Sent Events.

Production upgrades should be installed from a Git tag or GitHub Release. During development, `release.json` keeps the same interface available.
