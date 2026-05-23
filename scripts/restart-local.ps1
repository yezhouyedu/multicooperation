$projectRoot = 'E:\Own_program\multi cooperation'

Write-Host '[restart] Stopping old local processes...' -ForegroundColor Cyan
& "$projectRoot\scripts\stop-local.ps1"

Start-Sleep -Seconds 2

Write-Host '[restart] Starting local environment...' -ForegroundColor Cyan
& "$projectRoot\scripts\start-local.ps1"
