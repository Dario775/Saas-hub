$ErrorActionPreference = 'Continue'
$procs = Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'saas-hub') -or
  ($_.Name -eq 'cmd.exe' -and $_.CommandLine -match 'next dev')
}
foreach ($p in $procs) {
  Write-Output ("Deteniendo PID={0} {1}" -f $p.ProcessId, $p.Name)
  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 4
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k','cd /d D:\saas-hub && npx next dev' -WorkingDirectory 'D:\saas-hub'
Write-Output 'RESTART_DISPATCHED'
