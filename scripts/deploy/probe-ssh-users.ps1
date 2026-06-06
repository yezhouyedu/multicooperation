param(
  [string]$HostName = "49.233.203.108",
  [string]$KeyPath = "E:\Own_program\multi_cooperation_secrets\ssh\first_try.pem",
  [string[]]$Users = @("root", "ubuntu", "debian", "centos", "rocky", "lighthouse", "tencentos")
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $KeyPath)) {
  throw "SSH key not found: $KeyPath"
}

Write-Host "==> Probing SSH usernames for $HostName" -ForegroundColor Cyan
Write-Host "Key: $KeyPath"
Write-Host ""

foreach ($User in $Users) {
  Write-Host "Trying user: $User" -ForegroundColor Yellow
  ssh `
    -i $KeyPath `
    -o IdentitiesOnly=yes `
    -o BatchMode=yes `
    -o ConnectTimeout=8 `
    -o StrictHostKeyChecking=accept-new `
    "$User@$HostName" `
    "whoami; hostname"

  if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SSH login succeeded with user: $User" -ForegroundColor Green
    exit 0
  }

  Write-Host "User $User failed." -ForegroundColor DarkGray
  Write-Host ""
}

throw "All tested users failed. Confirm the server username and whether this SSH key is bound to the instance."
