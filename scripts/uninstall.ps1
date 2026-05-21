param(
  [string]$InstallDir = $(if ($env:LUMESHELL_INSTALL_DIR) { $env:LUMESHELL_INSTALL_DIR } else { "$env:ProgramData\LumeShell" }),
  [string]$KeepData = $(if ($env:LUMESHELL_KEEP_DATA) { $env:LUMESHELL_KEEP_DATA } else { "true" })
)

$ErrorActionPreference = "Stop"
if ($KeepData -eq "true" -and (Test-Path "$InstallDir\data")) {
  $BackupDir = "$InstallDir.data.$(Get-Date -Format yyyyMMddHHmmss)"
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  Copy-Item -Recurse -Force "$InstallDir\data" "$BackupDir\data"
  Write-Host "Data preserved at $BackupDir\data"
}
if (Test-Path $InstallDir) {
  Remove-Item -Recurse -Force $InstallDir
}
Write-Host "LumeShell uninstalled"
