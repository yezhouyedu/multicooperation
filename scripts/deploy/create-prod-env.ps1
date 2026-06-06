param(
  [string]$HostName = "49.233.203.108",
  [string]$User = "ubuntu",
  [string]$KeyPath = "E:\Own_program\multi_cooperation_secrets\ssh\first_try.pem",
  [string]$RemoteDir = "/opt/multi-cooperation",
  [string]$ProjectRoot = "E:\Own_program\multi cooperation",
  [string]$ServerIp = "49.233.203.108",
  [string]$PostgresPassword = ""
)

$ErrorActionPreference = "Stop"

function Step($Text) {
  Write-Host ""
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Read-DotEnv($Path) {
  $values = @{}
  if (!(Test-Path -LiteralPath $Path)) {
    return $values
  }
  foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
    if ($line -match '^\s*#') { continue }
    if ($line -match '^\s*$') { continue }
    $idx = $line.IndexOf('=')
    if ($idx -le 0) { continue }
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    $values[$key] = $value
  }
  return $values
}

function New-RandomPassword() {
  $bytes = New-Object byte[] 24
  $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
  $rng.GetBytes($bytes)
  return "mc_prod_" + [Convert]::ToBase64String($bytes).Replace("+", "A").Replace("/", "B").Replace("=", "")
}

function Run-Native($Description, $ScriptBlock) {
  & $ScriptBlock
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE. Stop here and fix the error above before continuing."
  }
}

Step "[1/5] Reading local AI settings"
$serverEnvPath = Join-Path $ProjectRoot "apps/server/.env"
$localEnv = Read-DotEnv $serverEnvPath

$openAiBaseUrl = $localEnv["OPENAI_BASE_URL"]
$openAiApiKey = $localEnv["OPENAI_API_KEY"]
$openAiModel = $localEnv["OPENAI_MODEL"]

if (!$openAiBaseUrl) { Write-Host "OPENAI_BASE_URL is empty or missing in apps/server/.env" -ForegroundColor Yellow }
if (!$openAiApiKey) { Write-Host "OPENAI_API_KEY is empty or missing in apps/server/.env" -ForegroundColor Yellow }
if (!$openAiModel) { Write-Host "OPENAI_MODEL is empty or missing in apps/server/.env" -ForegroundColor Yellow }

Step "[2/5] Preparing production database password"
if (!$PostgresPassword) {
  $PostgresPassword = New-RandomPassword
  Write-Host "Generated a new PostgreSQL password. It will not be printed." -ForegroundColor Green
} else {
  Write-Host "Using provided PostgreSQL password. It will not be printed." -ForegroundColor Green
}

Step "[3/5] Writing temporary .env.production"
$tempEnv = Join-Path $env:TEMP ("multi-cooperation-env-production-" + (Get-Date -Format "yyyyMMddHHmmss") + ".tmp")
$content = @(
  "POSTGRES_DB=multi_cooperation",
  "POSTGRES_USER=postgres",
  "POSTGRES_PASSWORD=$PostgresPassword",
  "",
  "WEB_PUBLIC_PORT=3000",
  "SERVER_PUBLIC_PORT=3001",
  "",
  "NEXT_PUBLIC_SERVER_BASE_URL=http://${ServerIp}:3001",
  "",
  "OPENAI_BASE_URL=$openAiBaseUrl",
  "OPENAI_API_KEY=$openAiApiKey",
  "OPENAI_MODEL=$openAiModel",
  ""
)
Set-Content -LiteralPath $tempEnv -Value $content -Encoding UTF8

Step "[4/5] Uploading .env.production to server"
Run-Native "Ensuring remote directory" {
  ssh -i $KeyPath -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "$User@$HostName" "set -e; test -d '$RemoteDir' || (sudo mkdir -p '$RemoteDir' && sudo chown '${User}:${User}' '$RemoteDir')"
}
Run-Native "Uploading production env" {
  scp -i $KeyPath -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 $tempEnv "${User}@${HostName}:${RemoteDir}/.env.production"
}

Step "[5/5] Cleaning temporary file"
Remove-Item -LiteralPath $tempEnv -Force

Write-Host ""
Write-Host ".env.production uploaded to ${HostName}:${RemoteDir}/.env.production" -ForegroundColor Green
Write-Host "OPENAI_BASE_URL copied: $([bool]$openAiBaseUrl)"
Write-Host "OPENAI_API_KEY copied: $([bool]$openAiApiKey)"
Write-Host "OPENAI_MODEL copied: $([bool]$openAiModel)"
Write-Host "PostgreSQL password generated/uploaded: true"
