param(
  [string]$HostName = "49.233.203.108",
  [string]$User = "ubuntu",
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

function Split-Archive($ArchivePath) {
  $chunkDir = Join-Path $env:TEMP ("multi-cooperation-upload-chunks-" + (Get-Date -Format "yyyyMMddHHmmss"))
  New-Item -ItemType Directory -Path $chunkDir | Out-Null
  $chunkSize = 512KB
  $buffer = New-Object byte[] $chunkSize
  $stream = [System.IO.File]::OpenRead($ArchivePath)
  try {
    $index = 0
    while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
      $chunkPath = Join-Path $chunkDir ("part-{0:D4}" -f $index)
      $out = [System.IO.File]::OpenWrite($chunkPath)
      try {
        $out.Write($buffer, 0, $read)
      } finally {
        $out.Close()
      }
      $index += 1
    }
  } finally {
    $stream.Close()
  }
  return $chunkDir
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
    --exclude="00_start_materials" `
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
Step "[4.1/5] Splitting archive for observable upload"
$ChunkDir = Split-Archive $ArchivePath
$Chunks = @(Get-ChildItem -LiteralPath $ChunkDir -File | Sort-Object Name)
Write-Host "Archive split into $($Chunks.Count) chunks at $ChunkDir"

Run-Native "Preparing remote upload chunks" {
  ssh -i $KeyPath -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 "$User@$HostName" "set -e; rm -rf /tmp/multi-cooperation-upload-chunks /tmp/multi-cooperation-deploy.tar.gz; mkdir -p /tmp/multi-cooperation-upload-chunks"
}

for ($i = 0; $i -lt $Chunks.Count; $i += 1) {
  $chunk = $Chunks[$i]
  Write-Host ("Uploading chunk {0}/{1}: {2}" -f ($i + 1), $Chunks.Count, $chunk.Name)
  Run-Native "Uploading chunk $($chunk.Name)" {
    scp -O -i $KeyPath -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 $chunk.FullName "${User}@${HostName}:/tmp/multi-cooperation-upload-chunks/$($chunk.Name)"
  }
}

Run-Native "Combining remote chunks" {
  ssh -i $KeyPath -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 "$User@$HostName" "set -e; cat /tmp/multi-cooperation-upload-chunks/part-* > /tmp/multi-cooperation-deploy.tar.gz; rm -rf /tmp/multi-cooperation-upload-chunks"
}

Run-Native "Extracting archive" {
  ssh -i $KeyPath -o IdentitiesOnly=yes "$User@$HostName" "set -e; STAGE_DIR='/tmp/multi-cooperation-deploy-new'; rm -rf `$STAGE_DIR; mkdir -p `$STAGE_DIR; tar -xzf /tmp/multi-cooperation-deploy.tar.gz -C `$STAGE_DIR; rsync -a --delete --exclude='.env.production' --exclude='00_start_materials' --exclude='storage' --exclude='apps/server/storage' `$STAGE_DIR/ '$RemoteDir/'; rm -rf `$STAGE_DIR /tmp/multi-cooperation-deploy.tar.gz; rm -rf '$RemoteDir/.deploy-new'"
}

Step "[5/5] Cleaning local archive"
Remove-Item -LiteralPath $ArchivePath -Force
Remove-Item -LiteralPath $ChunkDir -Recurse -Force

Write-Host ""
Write-Host "Upload finished: $RemoteDir" -ForegroundColor Green
