param(
  [ValidateSet("all", "web", "server")]
  [string]$Service = "all",
  [string]$HostName = "49.233.203.108",
  [string]$User = "ubuntu",
  [string]$KeyPath = "E:\Own_program\multi_cooperation_secrets\ssh\first_try.pem",
  [string]$RemoteDir = "/opt/multi-cooperation",
  [string]$ProjectRoot = "E:\Own_program\multi cooperation",
  [switch]$AllowDirty,
  [switch]$SkipDeploy
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

Step "[1/6] Checking local project, git state, and SSH key"
if (!(Test-Path -LiteralPath $ProjectRoot)) {
  throw "Project root not found: $ProjectRoot"
}
if (!(Test-Path -LiteralPath $KeyPath)) {
  throw "SSH key not found: $KeyPath"
}

Push-Location -LiteralPath $ProjectRoot
try {
  Run-Native "Reading git commit" { git rev-parse --verify HEAD | Out-Host }
  $Commit = (git rev-parse --short HEAD).Trim()
  $Dirty = (git status --porcelain)
  if ($Dirty -and !$AllowDirty) {
    throw "Working tree is dirty. Commit or stash changes first, or pass -AllowDirty for an emergency source upload."
  }

  Step "[2/6] Creating git archive for commit $Commit"
  $ArchivePath = Join-Path $env:TEMP "multi-cooperation-$Commit.tar.gz"
  if (Test-Path -LiteralPath $ArchivePath) {
    Remove-Item -LiteralPath $ArchivePath -Force
  }
  Run-Native "Creating git archive" { git archive --format=tar.gz -o $ArchivePath HEAD }
  Get-Item -LiteralPath $ArchivePath | Select-Object FullName, Length, LastWriteTime | Format-List
} finally {
  Pop-Location
}

Step "[3/6] Uploading archive to server"
$RemoteArchive = "/tmp/multi-cooperation-$Commit.tar.gz"
Run-Native "Uploading archive" {
  scp -i $KeyPath -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new $ArchivePath "${User}@${HostName}:$RemoteArchive"
}

Step "[4/6] Syncing source into $RemoteDir"
$RemoteCommand = @"
set -e
STAGE_DIR="/tmp/multi-cooperation-$Commit-src"
rm -rf "`$STAGE_DIR"
mkdir -p "`$STAGE_DIR"
tar -xzf "$RemoteArchive" -C "`$STAGE_DIR"
sudo mkdir -p "$RemoteDir"
sudo rsync -a --delete \
  --exclude='.env.production' \
  --exclude='00_start_materials' \
  --exclude='storage' \
  --exclude='apps/server/storage' \
  "`$STAGE_DIR/" "$RemoteDir/"
sudo find "$RemoteDir/scripts/deploy" -type f -name '*.sh' -exec sed -i 's/\r$//' {} \;
sudo find "$RemoteDir/scripts/deploy" -type f -name '*.sh' -exec chmod +x {} \;
if [ -f "$RemoteDir/apps/server/docker-entrypoint.sh" ]; then
  sudo sed -i 's/\r$//' "$RemoteDir/apps/server/docker-entrypoint.sh"
  sudo chmod +x "$RemoteDir/apps/server/docker-entrypoint.sh"
fi
rm -rf "`$STAGE_DIR" "$RemoteArchive"
"@

Run-Native "Syncing source" {
  ssh -i $KeyPath -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20 "${User}@${HostName}" $RemoteCommand
}

if ($SkipDeploy) {
  Step "[5/6] Skipping deploy by request"
} else {
  Step "[5/6] Deploying service: $Service"
  Run-Native "Deploying $Service" {
    ssh -i $KeyPath -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20 "${User}@${HostName}" "cd '$RemoteDir' && sudo bash scripts/deploy/deploy-prod.sh '$Service'"
  }
}

Step "[6/6] Cleaning local archive"
Remove-Item -LiteralPath $ArchivePath -Force

Write-Host ""
Write-Host "Upload finished for commit $Commit. Service target: $Service" -ForegroundColor Green
