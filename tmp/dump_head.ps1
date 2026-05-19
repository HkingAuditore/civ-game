$p = Start-Process -FilePath "git" -ArgumentList @("cat-file","-p","HEAD:src/hooks/useGameState.js") -NoNewWindow -RedirectStandardOutput "tmp/head_raw.js" -PassThru -Wait
Write-Host ("ExitCode=" + $p.ExitCode)
$info = Get-Item "tmp/head_raw.js"
Write-Host ("Bytes=" + $info.Length)
