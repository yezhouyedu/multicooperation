param(
  [string]$HostName = "49.233.203.108",
  [string]$User = "root",
  [string]$KeyPath = "E:\Own_program\multi_cooperation_secrets\ssh\first_try.pem"
)

$ErrorActionPreference = "Stop"

function Step($Text) {
  Write-Host ""
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Run-Remote($Command) {
  ssh -i $KeyPath -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "$User@$HostName" $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Remote command failed with exit code $LASTEXITCODE. Stop here and fix the error above before continuing."
  }
}

Step "[1/6] Checking SSH key"
if (!(Test-Path -LiteralPath $KeyPath)) {
  throw "SSH key not found: $KeyPath"
}
Get-Item -LiteralPath $KeyPath | Select-Object FullName,Length,LastWriteTime

Step "[2/6] Checking login and system"
Run-Remote "set -e; whoami; hostname; uname -a"

Step "[3/6] Checking CPU, memory, and disk"
Run-Remote "set -e; echo CPU:; nproc; echo Memory:; free -h; echo Disk:; df -h /"

Step "[4/6] Checking Docker"
Run-Remote "set -e; if command -v docker >/dev/null 2>&1; then docker --version; docker compose version || true; else echo 'Docker is not installed'; fi"

Step "[5/6] Checking important ports"
Run-Remote "set -e; if command -v ss >/dev/null 2>&1; then ss -lntp || true; else netstat -lntp || true; fi"

Step "[6/6] Checking firewall hints"
Run-Remote "set -e; (command -v ufw >/dev/null 2>&1 && (ufw status 2>/dev/null || sudo ufw status 2>/dev/null || true)) || true; (command -v firewall-cmd >/dev/null 2>&1 && (firewall-cmd --list-all 2>/dev/null || sudo firewall-cmd --list-all 2>/dev/null || true)) || true"

Write-Host ""
Write-Host "Server check finished." -ForegroundColor Green
