$commits = @("86c2f298","436635cc","bd9a67f2","a68e90c0","03fe7171","dd991d8d","76009863","271ef349","da1f703a","97cda1ad","3d283fe3","8a102cab")
foreach ($c in $commits) {
    $null = Start-Process -FilePath "git" -ArgumentList @("cat-file","-p","$($c):src/hooks/useGameState.js") -NoNewWindow -RedirectStandardOutput "tmp/c_$c.js" -PassThru -Wait
    $bytes = [System.IO.File]::ReadAllBytes("tmp/c_$c.js")
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    $count = ([regex]::Matches($text, [char]0xFFFD)).Count
    Write-Host ("$c  bytes=$($bytes.Length)  bad=$count")
    Remove-Item "tmp/c_$c.js"
}
