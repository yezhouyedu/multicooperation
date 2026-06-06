param(
  [string]$HostName = "49.233.203.108",
  [string]$User = "root",
  [string]$KeyPath = "E:\Own_program\multi_cooperation_secrets\ssh\first_try.pem",
  [string]$RemoteDir = "/opt/multi-cooperation",
  [string]$ProjectRoot = "E:\Own_program\multi cooperation"
)

$ErrorActionPreference = "Stop"

function Step($Text) {
  Write-Host ""
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Run-Native($Description, $ScriptBlock) {
  & $ScriptBlock
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE. Stop here and fix the error above before continuing."
  }
}

Step "[1/5] Checking local project and SSH key"
if (!(Test-Path -LiteralPath $ProjectRoot)) {
  throw "Project root not found: $ProjectRoot"
}
if (!(Test-Path -LiteralPath $KeyPath)) {
  throw "SSH key not found: $KeyPath"
}

Step "[2/5] Creating remote directory"
Run-Native "Creating remote directory" {
  ssh -i $KeyPath -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "$User@$HostName" "set -e; if mkdir -p '$RemoteDir' 2>/dev/null; then exit 0; fi; sudo mkdir -p '$RemoteDir'; sudo chown '${User}:${User}' '$RemoteDir'"
}

Step "[3/5] Creating local deployment archive"
$ArchivePath = Join-Path $env:TEMP ("multi-cooperation-deploy-" + (Get-Date -Format "yyyyMMddHHmmss") + ".tar.gz")
Push-Location -LiteralPath $ProjectRoot
try {
  tar `
    --exclude=".git" `
    --exclude="node_modules" `
    --exclude="apps/*/node_modules" `
    --exclude="apps/web/.next" `
    --exclude="apps/server/dist" `
    --exclude="storage" `
    --exclude="apps/server/storage" `
    --exclude=".env" `
    --exclude=".env.production" `
    --exclude=".env.local" `
    --exclude="apps/*/.env" `
    --exclude="apps/*/.env.local" `
    --exclude=".secrets" `
    --exclude="*.pem" `
    --exclude="*.key" `
    --exclude="*.crt" `
    -czf $ArchivePath .
} finally {
  Pop-Location
}
Get-Item -LiteralPath $ArchivePath | Select-Object FullName,Length,LastWriteTime

Step "[4/5] Uploading and extracting archive"
Run-Native "Uploading archive" {
  scp -i $KeyPath -o IdentitiesOnly=yes $ArchivePath "${User}@${HostName}:/tmp/multi-cooperation-deploy.tar.gz"
}
Run-Native "Extracting archive" {
  ssh -i $KeyPath -o IdentitiesOnly=yes "$User@$HostName" "set -e; STAGE_DIR='/tmp/multi-cooperation-deploy-new'; rm -rf `$STAGE_DIR; mkdir -p `$STAGE_DIR; tar -xzf /tmp/multi-cooperation-deploy.tar.gz -C `$STAGE_DIR; rsync -a --delete --exclude='.env.production' `$STAGE_DIR/ '$RemoteDir/'; rm -rf `$STAGE_DIR /tmp/multi-cooperation-deploy.tar.gz; rm -rf '$RemoteDir/.deploy-new'"
}

Step "[5/5] Cleaning local archive"
Remove-Item -LiteralPath $ArchivePath -Force

Write-Host ""
Write-Host "Upload finished: $RemoteDir" -ForegroundColor Green
