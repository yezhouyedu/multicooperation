param(
  [string]$KeyPath = "E:\Own_program\multi_cooperation_secrets\ssh\first_try.pem"
)

$ErrorActionPreference = "Stop"

Write-Host "==> [1/3] Checking SSH key path" -ForegroundColor Cyan
if (!(Test-Path -LiteralPath $KeyPath)) {
  throw "SSH key not found: $KeyPath"
}
Get-Item -LiteralPath $KeyPath | Select-Object FullName,Length,LastWriteTime

Write-Host ""
Write-Host "==> [2/3] Restricting Windows ACL" -ForegroundColor Cyan
$currentUser = "$env:USERDOMAIN\$env:USERNAME"
icacls $KeyPath /inheritance:r | Out-Host
icacls $KeyPath /remove "Authenticated Users" "NT AUTHORITY\Authenticated Users" "BUILTIN\Users" "Everyone" 2>$null | Out-Host
icacls $KeyPath /grant:r "${currentUser}:R" | Out-Host

Write-Host ""
Write-Host "==> [3/3] Current ACL" -ForegroundColor Cyan
icacls $KeyPath | Out-Host

Write-Host ""
Write-Host "SSH key permission fix finished. Re-run check-server.ps1 next." -ForegroundColor Green
