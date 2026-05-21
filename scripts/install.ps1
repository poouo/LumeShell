param(
  [string]$Repo = $env:LUMESHELL_REPO,
  [string]$Branch = $(if ($env:LUMESHELL_BRANCH) { $env:LUMESHELL_BRANCH } else { "main" }),
  [string]$InstallDir = $(if ($env:LUMESHELL_INSTALL_DIR) { $env:LUMESHELL_INSTALL_DIR } else { "$env:ProgramData\LumeShell" }),
  [string]$Port = $(if ($env:LUMESHELL_PORT) { $env:LUMESHELL_PORT } else { "8090" })
)

$ErrorActionPreference = "Stop"
if (-not $Repo) { $Repo = "poouo/LumeShell" }

function Step($Text) { Write-Host "[$(Get-Date -Format HH:mm:ss)] $Text" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 20+ is required. Install Node.js first, then rerun this script."
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is required. Install Git first, then rerun this script."
}

Step "Fetching LumeShell"
New-Item -ItemType Directory -Force -Path (Split-Path $InstallDir) | Out-Null
if (Test-Path "$InstallDir\.git") {
  git -C $InstallDir fetch origin $Branch
  git -C $InstallDir checkout $Branch
  git -C $InstallDir pull --ff-only origin $Branch
} else {
  git clone --branch $Branch "https://github.com/$Repo.git" $InstallDir
}

Set-Location $InstallDir
New-Item -ItemType Directory -Force -Path data | Out-Null
if (-not (Test-Path ".env")) {
  $Password = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(18))
  @"
NODE_ENV=production
LUMESHELL_HOST=0.0.0.0
LUMESHELL_PORT=$Port
LUMESHELL_DATA_DIR=./data
LUMESHELL_ADMIN_PASSWORD=$Password
LUMESHELL_TOKEN_TTL_HOURS=24
LUMESHELL_GITHUB_REPO=$Repo
LUMESHELL_PUBLIC_URL=http://localhost:$Port
LUMESHELL_TRUST_PROXY=false
LUMESHELL_REQUIRE_HTTPS=false
LUMESHELL_SECURE_COOKIES=false
"@ | Set-Content -Path ".env"
  $Password | Set-Content -Path "data\initial-admin-password.txt"
}

Step "Installing dependencies"
npm install

Step "Building frontend"
npm run build

Step "Installed"
Write-Host "Run: npm start"
Write-Host "URL: http://localhost:$Port"
Write-Host "Initial password file: $InstallDir\data\initial-admin-password.txt"
