$ErrorActionPreference = "Stop"
$InstallDir = if ($env:LUMESHELL_INSTALL_DIR) { $env:LUMESHELL_INSTALL_DIR } else { (Resolve-Path "$PSScriptRoot\..").Path }
$Branch = if ($env:LUMESHELL_BRANCH) { $env:LUMESHELL_BRANCH } else { "main" }

function ProgressLine($Text) { Write-Host "[upgrade] $Text" }

Set-Location $InstallDir
ProgressLine "Preserving data directory"
New-Item -ItemType Directory -Force -Path data | Out-Null

ProgressLine "Fetching latest code"
git fetch origin $Branch
git checkout $Branch
git pull --ff-only origin $Branch

ProgressLine "Installing dependencies"
npm install

ProgressLine "Building frontend"
npm run build

ProgressLine "Done"
