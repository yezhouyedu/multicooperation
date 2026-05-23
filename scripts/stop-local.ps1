$projectRoot = 'E:\Own_program\multi cooperation'

Write-Host '[1/2] Stopping web/server node processes...' -ForegroundColor Cyan
Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq 'node.exe' -and (
      $_.CommandLine -match [regex]::Escape($projectRoot) -or
      $_.CommandLine -match 'next dev' -or
      $_.CommandLine -match 'nest start --watch' -or
      $_.CommandLine -match 'start:dev' -or
      $_.CommandLine -match 'dev:web' -or
      $_.CommandLine -match 'dev:server'
    )
  } |
  ForEach-Object {
    try {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
      Write-Host ("Stopped PID {0}" -f $_.ProcessId) -ForegroundColor Yellow
    } catch {
      Write-Host ("Skip PID {0}: {1}" -f $_.ProcessId, $_.Exception.Message) -ForegroundColor DarkYellow
    }
  }

Write-Host '[2/2] Local dev processes stop command finished.' -ForegroundColor Green
