param([string]$Path)
$bytes = [System.IO.File]::ReadAllBytes($Path)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$bad = [char]0xFFFD
$lines = $text.Split("`n")
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].IndexOf($bad) -ge 0) {
        Write-Host (($i+1).ToString() + ":" + $lines[$i])
    }
}
