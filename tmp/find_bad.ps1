$bytes = [System.IO.File]::ReadAllBytes('src/hooks/useGameState.js')
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$bad = [char]0xFFFD
$count = ([regex]::Matches($text, $bad)).Count
Write-Host ("Replacement char count: " + $count)
$lines = $text.Split("`n")
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].IndexOf($bad) -ge 0) {
        Write-Host (($i+1).ToString() + ": " + $lines[$i])
    }
}
