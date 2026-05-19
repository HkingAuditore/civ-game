param([string]$Path)
$bytes = [System.IO.File]::ReadAllBytes($Path)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$bad = [char]0xFFFD
$count = ([regex]::Matches($text, $bad)).Count
Write-Host ("File: " + $Path)
Write-Host ("Replacement char count: " + $count)
Write-Host ("Total bytes: " + $bytes.Length)
