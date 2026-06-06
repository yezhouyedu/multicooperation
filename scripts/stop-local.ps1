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
      Write-Host ("Stopped node PID {0}" -f $_.ProcessId) -ForegroundColor Yellow
    } catch {
      Write-Host ("Skip node PID {0}: {1}" -f $_.ProcessId, $_.Exception.Message) -ForegroundColor DarkYellow
    }
  }

Write-Host '[2/2] Closing stale dev PowerShell windows...' -ForegroundColor Cyan
Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq 'powershell.exe' -and
    $_.ProcessId -ne $PID -and
    $_.CommandLine -match [regex]::Escape($projectRoot) -and (
      $_.CommandLine -match 'dev:web' -or
      $_.CommandLine -match 'dev:server' -or
      $_.CommandLine -match 'next dev' -or
      $_.CommandLine -match 'nest start --watch'
    )
  } |
  ForEach-Object {
    try {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
      Write-Host ("Closed PowerShell PID {0}" -f $_.ProcessId) -ForegroundColor Yellow
    } catch {
      Write-Host ("Skip PowerShell PID {0}: {1}" -f $_.ProcessId, $_.Exception.Message) -ForegroundColor DarkYellow
    }
  }

Write-Host 'Local dev processes stop command finished.' -ForegroundColor Green
