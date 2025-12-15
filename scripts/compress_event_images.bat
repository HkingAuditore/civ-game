@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: PNG Image Lossless Compression Script
:: Target: public\images\events\*.png
:: Tools: pngquant (near-lossless) + oxipng (lossless optimization)
:: ============================================

echo ============================================
echo    PNG Image Compression Script
echo    Target: events folder PNG images
echo ============================================
echo.

:: Set paths
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
set "IMAGES_DIR=%PROJECT_DIR%\public\images\events"
set "TOOLS_DIR=%SCRIPT_DIR%tools"
set "BACKUP_DIR=%IMAGES_DIR%\backup_original"

:: Tool paths
set "PNGQUANT=%TOOLS_DIR%\pngquant.exe"
set "OXIPNG=%TOOLS_DIR%\oxipng.exe"

echo [INFO] Images directory: %IMAGES_DIR%
echo.

:: Check if images directory exists
if not exist "%IMAGES_DIR%" (
    echo [ERROR] Images directory not found: %IMAGES_DIR%
    pause
    exit /b 1
)

:: Create tools directory if not exists
if not exist "%TOOLS_DIR%" (
    echo [INFO] Creating tools directory...
    mkdir "%TOOLS_DIR%"
)

:: ============================================
:: Download compression tools if not exist
:: ============================================

:: Check and download pngquant
if not exist "%PNGQUANT%" (
    echo [INFO] Downloading pngquant...
    echo [INFO] Please download pngquant manually from: https://pngquant.org/
    echo [INFO] Extract pngquant.exe to: %TOOLS_DIR%
    echo.
    echo [Alternative] You can use winget to install:
    echo     winget install pngquant
    echo.
    set "PNGQUANT_AVAILABLE=0"
) else (
    echo [OK] pngquant found
    set "PNGQUANT_AVAILABLE=1"
)

:: Check and download oxipng
if not exist "%OXIPNG%" (
    echo [INFO] Downloading oxipng...
    echo [INFO] Please download oxipng manually from: https://github.com/shssoichern/oxipng/releases
    echo [INFO] Extract oxipng.exe to: %TOOLS_DIR%
    echo.
    echo [Alternative] You can use cargo to install:
    echo     cargo install oxipng
    echo.
    set "OXIPNG_AVAILABLE=0"
) else (
    echo [OK] oxipng found
    set "OXIPNG_AVAILABLE=1"
)

:: If no tools available, try to use system-installed versions
if "%PNGQUANT_AVAILABLE%"=="0" (
    where pngquant >nul 2>&1
    if !errorlevel! equ 0 (
        set "PNGQUANT=pngquant"
        set "PNGQUANT_AVAILABLE=1"
        echo [OK] Found system-installed pngquant
    )
)

if "%OXIPNG_AVAILABLE%"=="0" (
    where oxipng >nul 2>&1
    if !errorlevel! equ 0 (
        set "OXIPNG=oxipng"
        set "OXIPNG_AVAILABLE=1"
        echo [OK] Found system-installed oxipng
    )
)

:: If still no tools, try PowerShell with .NET
if "%PNGQUANT_AVAILABLE%"=="0" if "%OXIPNG_AVAILABLE%"=="0" (
    echo.
    echo [WARNING] No compression tools found!
    echo [INFO] Will try to use PowerShell built-in compression as fallback.
    echo.
)

echo.
echo ============================================
echo    Compression Options
echo ============================================
echo.
echo [1] Lossless compression only (oxipng) - Best quality, smaller reduction
echo [2] Near-lossless compression (pngquant) - High quality, better reduction
echo [3] Both tools combined - Maximum compression
echo [4] PowerShell fallback - Basic optimization
echo [5] Exit
echo.

set /p "CHOICE=Select option (1-5): "

if "%CHOICE%"=="5" (
    echo Exiting...
    exit /b 0
)

:: ============================================
:: Backup original files
:: ============================================

echo.
set /p "DO_BACKUP=Create backup of original files? (Y/N): "

if /i "%DO_BACKUP%"=="Y" (
    echo.
    echo [INFO] Creating backup...
    if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
    
    for %%f in ("%IMAGES_DIR%\*.png") do (
        if not "%%~dpf"=="%BACKUP_DIR%\" (
            copy "%%f" "%BACKUP_DIR%\" >nul
            echo [BACKUP] %%~nxf
        )
    )
    echo [OK] Backup completed to: %BACKUP_DIR%
)

echo.
echo ============================================
echo    Starting Compression
echo ============================================
echo.

:: Initialize counters
set "TOTAL_ORIGINAL=0"
set "TOTAL_COMPRESSED=0"
set "FILE_COUNT=0"

:: Calculate original total size
for %%f in ("%IMAGES_DIR%\*.png") do (
    if not "%%~dpf"=="%BACKUP_DIR%\" (
        set /a "FILE_COUNT+=1"
        set /a "TOTAL_ORIGINAL+=%%~zf"
    )
)

echo [INFO] Found !FILE_COUNT! PNG files to compress
echo [INFO] Total original size: !TOTAL_ORIGINAL! bytes
echo.

:: ============================================
:: Compression based on choice
:: ============================================

if "%CHOICE%"=="1" goto :OXIPNG_ONLY
if "%CHOICE%"=="2" goto :PNGQUANT_ONLY
if "%CHOICE%"=="3" goto :BOTH_TOOLS
if "%CHOICE%"=="4" goto :POWERSHELL_FALLBACK

:OXIPNG_ONLY
if "%OXIPNG_AVAILABLE%"=="0" (
    echo [ERROR] oxipng not available
    goto :POWERSHELL_FALLBACK
)
echo [INFO] Using oxipng for lossless compression...
echo.
for %%f in ("%IMAGES_DIR%\*.png") do (
    if not "%%~dpf"=="%BACKUP_DIR%\" (
        echo [COMPRESS] %%~nxf
        "%OXIPNG%" -o 4 --strip safe "%%f"
    )
)
goto :SHOW_RESULTS

:PNGQUANT_ONLY
if "%PNGQUANT_AVAILABLE%"=="0" (
    echo [ERROR] pngquant not available
    goto :POWERSHELL_FALLBACK
)
echo [INFO] Using pngquant for near-lossless compression...
echo [INFO] Quality: 90-100 (near-lossless)
echo.
for %%f in ("%IMAGES_DIR%\*.png") do (
    if not "%%~dpf"=="%BACKUP_DIR%\" (
        echo [COMPRESS] %%~nxf
        "%PNGQUANT%" --quality=90-100 --speed 1 --force --ext .png "%%f"
    )
)
goto :SHOW_RESULTS

:BOTH_TOOLS
echo [INFO] Using both pngquant and oxipng for maximum compression...
echo.

:: First pass: pngquant (if available)
if "%PNGQUANT_AVAILABLE%"=="1" (
    echo [PASS 1] pngquant - Near-lossless quantization...
    for %%f in ("%IMAGES_DIR%\*.png") do (
        if not "%%~dpf"=="%BACKUP_DIR%\" (
            echo [COMPRESS] %%~nxf
            "%PNGQUANT%" --quality=90-100 --speed 1 --force --ext .png "%%f"
        )
    )
    echo.
)

:: Second pass: oxipng (if available)
if "%OXIPNG_AVAILABLE%"=="1" (
    echo [PASS 2] oxipng - Lossless optimization...
    for %%f in ("%IMAGES_DIR%\*.png") do (
        if not "%%~dpf"=="%BACKUP_DIR%\" (
            echo [OPTIMIZE] %%~nxf
            "%OXIPNG%" -o 4 --strip safe "%%f"
        )
    )
    echo.
)
goto :SHOW_RESULTS

:POWERSHELL_FALLBACK
echo [INFO] Using PowerShell fallback method...
echo [INFO] This method provides basic PNG optimization.
echo.

:: Create a PowerShell script for PNG optimization
set "PS_SCRIPT=%SCRIPT_DIR%optimize_png.ps1"

echo # PNG Optimization Script > "%PS_SCRIPT%"
echo $imagesDir = '%IMAGES_DIR%' >> "%PS_SCRIPT%"
echo $backupDir = '%BACKUP_DIR%' >> "%PS_SCRIPT%"
echo. >> "%PS_SCRIPT%"
echo Add-Type -AssemblyName System.Drawing >> "%PS_SCRIPT%"
echo. >> "%PS_SCRIPT%"
echo $pngFiles = Get-ChildItem -Path $imagesDir -Filter "*.png" ^| Where-Object { $_.DirectoryName -ne $backupDir } >> "%PS_SCRIPT%"
echo. >> "%PS_SCRIPT%"
echo foreach ($file in $pngFiles) { >> "%PS_SCRIPT%"
echo     Write-Host "[COMPRESS] $($file.Name)" >> "%PS_SCRIPT%"
echo     try { >> "%PS_SCRIPT%"
echo         $originalSize = $file.Length >> "%PS_SCRIPT%"
echo         $img = [System.Drawing.Image]::FromFile($file.FullName) >> "%PS_SCRIPT%"
echo         $tempPath = $file.FullName + ".tmp" >> "%PS_SCRIPT%"
echo. >> "%PS_SCRIPT%"
echo         # Get PNG encoder >> "%PS_SCRIPT%"
echo         $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() ^| Where-Object { $_.MimeType -eq 'image/png' } >> "%PS_SCRIPT%"
echo. >> "%PS_SCRIPT%"
echo         # Create encoder parameters >> "%PS_SCRIPT%"
echo         $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1) >> "%PS_SCRIPT%"
echo         $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 100L) >> "%PS_SCRIPT%"
echo. >> "%PS_SCRIPT%"
echo         # Save optimized image >> "%PS_SCRIPT%"
echo         $img.Save($tempPath, $encoder, $encoderParams) >> "%PS_SCRIPT%"
echo         $img.Dispose() >> "%PS_SCRIPT%"
echo. >> "%PS_SCRIPT%"
echo         # Replace original if smaller >> "%PS_SCRIPT%"
echo         $newSize = (Get-Item $tempPath).Length >> "%PS_SCRIPT%"
echo         if ($newSize -lt $originalSize) { >> "%PS_SCRIPT%"
echo             Remove-Item $file.FullName -Force >> "%PS_SCRIPT%"
echo             Rename-Item $tempPath $file.FullName >> "%PS_SCRIPT%"
echo             $saved = $originalSize - $newSize >> "%PS_SCRIPT%"
echo             Write-Host "  Saved: $([math]::Round($saved/1KB, 2)) KB" >> "%PS_SCRIPT%"
echo         } else { >> "%PS_SCRIPT%"
echo             Remove-Item $tempPath -Force >> "%PS_SCRIPT%"
echo             Write-Host "  Already optimized" >> "%PS_SCRIPT%"
echo         } >> "%PS_SCRIPT%"
echo     } catch { >> "%PS_SCRIPT%"
echo         Write-Host "  Error: $_" -ForegroundColor Red >> "%PS_SCRIPT%"
echo     } >> "%PS_SCRIPT%"
echo } >> "%PS_SCRIPT%"

powershell -ExecutionPolicy Bypass -File "%PS_SCRIPT%"
del "%PS_SCRIPT%" 2>nul
goto :SHOW_RESULTS

:SHOW_RESULTS
echo.
echo ============================================
echo    Compression Results
echo ============================================
echo.

:: Calculate new total size
set "TOTAL_COMPRESSED=0"
for %%f in ("%IMAGES_DIR%\*.png") do (
    if not "%%~dpf"=="%BACKUP_DIR%\" (
        set /a "TOTAL_COMPRESSED+=%%~zf"
    )
)

:: Calculate savings
set /a "SAVED=TOTAL_ORIGINAL-TOTAL_COMPRESSED"
set /a "SAVED_KB=SAVED/1024"
set /a "ORIGINAL_KB=TOTAL_ORIGINAL/1024"
set /a "COMPRESSED_KB=TOTAL_COMPRESSED/1024"

echo [RESULT] Original size:   !ORIGINAL_KB! KB
echo [RESULT] Compressed size: !COMPRESSED_KB! KB
echo [RESULT] Space saved:     !SAVED_KB! KB

:: Calculate percentage (approximate)
if !TOTAL_ORIGINAL! gtr 0 (
    set /a "PERCENT=(SAVED*100)/TOTAL_ORIGINAL"
    echo [RESULT] Reduction:        !PERCENT!%%
)

echo.
echo ============================================
echo    Individual File Sizes
echo ============================================
echo.

for %%f in ("%IMAGES_DIR%\*.png") do (
    if not "%%~dpf"=="%BACKUP_DIR%\" (
        set "SIZE=%%~zf"
        set /a "SIZE_KB=SIZE/1024"
        echo %%~nxf: !SIZE_KB! KB
    )
)

echo.
echo [OK] Compression completed!

if /i "%DO_BACKUP%"=="Y" (
    echo.
    echo [INFO] Original files backed up to: %BACKUP_DIR%
    echo [INFO] To restore originals, copy files from backup folder.
)

echo.
pause
exit /b 0
