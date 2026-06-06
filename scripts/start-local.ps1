$projectRoot = 'E:\Own_program\multi cooperation'

Write-Host '[0/4] Cleaning stale local dev processes...' -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File (Join-Path $projectRoot 'scripts\stop-local.ps1')

Write-Host '[1/4] Starting PostgreSQL container...' -ForegroundColor Cyan
Set-Location $projectRoot
corepack pnpm run db:up

Write-Host '[2/4] Opening server dev window...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$projectRoot'; corepack pnpm run dev:server"
)

Write-Host '[3/4] Opening web dev window...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$projectRoot'; corepack pnpm run dev:web"
)

Write-Host '[4/4] Launch commands sent.' -ForegroundColor Cyan
Write-Host 'Local environment launch commands were sent.' -ForegroundColor Green
Write-Host 'Server: http://localhost:3001' -ForegroundColor Green
Write-Host 'Web:    http://localhost:3000' -ForegroundColor Green
