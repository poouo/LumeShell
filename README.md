# LumeShell

LumeShell 是一个面向个人开发者的现代化自托管 WebSSH 工作台。它支持加密保存 SSH 登录信息、多标签终端、SFTP 文件管理、拖拽上传文件/文件夹、快捷命令、服务器资源监控、数据备份恢复，以及后台一键升级。

English summary: LumeShell is a modern self-hosted WebSSH workspace for individual developers, with encrypted credentials, multi-tab terminals, SFTP file management, quick commands, metrics, backup/restore, themes, and self-upgrade.

![LumeShell logo](client/public/logo.svg)

## 功能特性

- 默认中文界面，支持中文 / English 切换。
- 后台密码保护，Token 有效期可配置，默认 24 小时。
- SSH 密码、私钥、密钥口令本地 AES-256-GCM 加密保存。
- 支持多个服务器、多标签页同时连接。
- 终端支持缓冲输入框，适合网络波动时一次性发送命令。
- SFTP 文件浏览、文件/文件夹拖拽上传、文件下载、文件夹 ZIP 下载。
- 快捷命令保存与一键发送。
- 服务器 CPU、内存、硬盘、最近 15 秒网络上传/下载监控。
- 黑夜 / 白天主题。
- 完整数据导出 / 导入，可恢复连接、设置、快捷命令和加密密钥。
- GitHub 版本检查、后台一键升级和进度日志。
- Linux / Windows 一键安装、升级、卸载脚本。

## 安全说明

LumeShell 的数据保存在服务器本地 `data/` 目录。敏感 SSH 字段会加密落盘。公网访问时请使用 HTTPS/WSS，可以通过反向代理提供 TLS，也可以设置 `LUMESHELL_HTTPS_KEY` 和 `LUMESHELL_HTTPS_CERT` 使用内置 HTTPS。

备份文件包含 `store.json` 和 `app-secret.key`，可以完整恢复加密凭据。请像保存密码库导出文件一样保存备份。

## 快速安装

Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/poouo/LumeShell/main/scripts/install.sh | sudo LUMESHELL_REPO=poouo/LumeShell bash
```

Windows PowerShell:

```powershell
$env:LUMESHELL_REPO="poouo/LumeShell"; iwr https://raw.githubusercontent.com/poouo/LumeShell/main/scripts/install.ps1 -UseBasicParsing | iex
```

安装完成时脚本会直接显示初始后台密码，并写入：

```text
data/initial-admin-password.txt
```

登录后建议立即在 Settings / 设置中修改后台密码。

## 本地开发

```bash
npm install
npm run dev
```

API 默认监听 `http://localhost:8090`，Vite 默认监听 `http://localhost:5173`。

## 生产运行

```bash
npm install
npm run build
npm start
```

环境变量见 `.env.example`。

## 升级

Linux:

```bash
sudo LUMESHELL_INSTALL_DIR=/opt/lumeshell bash /opt/lumeshell/scripts/upgrade.sh
```

Windows:

```powershell
.\scripts\upgrade.ps1
```

也可以在后台 Settings / 设置 页面中检查版本并执行升级。

## 卸载

Linux 默认保留数据：

```bash
sudo bash /opt/lumeshell/scripts/uninstall.sh
```

设置 `LUMESHELL_KEEP_DATA=false` 可删除全部安装数据。

## English Quick Start

Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/poouo/LumeShell/main/scripts/install.sh | sudo LUMESHELL_REPO=poouo/LumeShell bash
```

Windows PowerShell:

```powershell
$env:LUMESHELL_REPO="poouo/LumeShell"; iwr https://raw.githubusercontent.com/poouo/LumeShell/main/scripts/install.ps1 -UseBasicParsing | iex
```

The installer prints the generated initial admin password when installation completes and stores it in `data/initial-admin-password.txt`.

## License

MIT
