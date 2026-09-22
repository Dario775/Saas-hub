Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'node|cmd' -and $_.CommandLine -match 'next|saas-hub|n8n|Comfy' } | ForEach-Object {
  $cl = $_.CommandLine
  if ($cl.Length -gt 160) { $cl = $cl.Substring(0,160) }
  Write-Output ("PID={0} NAME={1} START={2} CMD={3}" -f $_.ProcessId, $_.Name, $_.CreationDate, $cl)
}
Write-Output "---LISTO---"
