$projectRoot = 'E:\Own_program\multi cooperation'

Write-Host '[1/3] Starting PostgreSQL container...' -ForegroundColor Cyan
Set-Location $projectRoot
corepack pnpm run db:up

Write-Host '[2/3] Opening server dev window...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$projectRoot'; corepack pnpm run dev:server"
)

Write-Host '[3/3] Opening web dev window...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$projectRoot'; corepack pnpm run dev:web"
)

Write-Host 'Local environment launch commands were sent.' -ForegroundColor Green
Write-Host 'Server: http://localhost:3001' -ForegroundColor Green
Write-Host 'Web:    http://localhost:3000' -ForegroundColor Green
