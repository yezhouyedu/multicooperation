$projectRoot = 'E:\Own_program\multi cooperation'
$devPorts = @(3000, 3001, 3002)

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

Write-Host '[extra] Releasing local dev ports 3000/3001/3002...' -ForegroundColor Cyan
$portProcessIds = @()
foreach ($port in $devPorts) {
  $lines = netstat -ano | Select-String (":$port\s")
  foreach ($line in $lines) {
    $parts = ($line.Line -split '\s+') | Where-Object { $_ }
    if ($parts.Count -lt 5) { continue }
    if ($parts[0] -notin @('TCP', 'UDP')) { continue }
    if ($parts[1] -notmatch ":$port$") { continue }
    $processIdText = $parts[-1]
    $processIdValue = 0
    if ([int]::TryParse($processIdText, [ref]$processIdValue) -and $processIdValue -gt 0 -and $processIdValue -ne $PID) {
      $portProcessIds += $processIdValue
    }
  }
}

$portProcessIds |
  Sort-Object -Unique |
  ForEach-Object {
    try {
      $process = Get-Process -Id $_ -ErrorAction Stop
      if ($process.ProcessName -notin @('node', 'powershell', 'pwsh')) {
        Write-Host ("Skip PID {0} on dev port: process is {1}" -f $_, $process.ProcessName) -ForegroundColor DarkYellow
        return
      }
      Stop-Process -Id $_ -Force -ErrorAction Stop
      Write-Host ("Released dev port by stopping PID {0} ({1})" -f $_, $process.ProcessName) -ForegroundColor Yellow
    } catch {
      Write-Host ("Skip PID {0}: {1}" -f $_, $_.Exception.Message) -ForegroundColor DarkYellow
    }
  }

Write-Host 'Local dev processes stop command finished.' -ForegroundColor Green
