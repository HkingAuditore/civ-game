@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

rem ============================================================
rem One-click release script (Web OTA + optional Android APK)
rem Supports deploying OTA bundles to Tencent Cloud COS, local
rem directory, or remote server via SCP.
rem
rem Usage:
rem   release_oneclick.bat ota   (default) OTA only
rem   release_oneclick.bat all             OTA + Android APK
rem   release_oneclick.bat apk             Android APK only
rem ============================================================

set "ROOT_DIR=%~dp0"
pushd "%ROOT_DIR%" >nul

rem ======================== 用户配置区 ==========================

rem --- OTA 通用 ---
set "CHANNEL=production"
set "MANDATORY=false"
set "MIN_NATIVE_VERSION=2.3.0"
set "RELEASE_NOTES=Hotfix and balance updates"

rem --- 部署方式: cos / local / scp ---
set "DEPLOY_METHOD=cos"

rem --- COS 配置（DEPLOY_METHOD=cos 时生效）---
rem   COS_BUCKET / COS_REGION 需与 coscmd config 一致
rem   CDN_BASE_URL: CDN 或 COS 静态网站域名前缀（不含末尾 /）
set "COS_BUCKET=civ-game-ota-1258335979"
set "COS_REGION=ap-guangzhou"
set "CDN_BASE_URL=https://civ-game-ota-1258335979.cos-website.ap-guangzhou.myqcloud.com"

rem --- local 配置（DEPLOY_METHOD=local 时生效）---
set "LOCAL_OTA_ROOT=C:\deploy\civ-game-ota"

rem --- SCP 配置（DEPLOY_METHOD=scp 时生效）---
set "SCP_TARGET=user@your-server:/var/www/civ-game-ota"
set "SCP_KEY_PATH="

rem ======================== 配置结束 ============================

set "MODE=%~1"
if "%MODE%"=="" set "MODE=ota"

if /I "%MODE%"=="ota" goto :run_ota
if /I "%MODE%"=="all" goto :run_all
if /I "%MODE%"=="apk" goto :run_apk

echo [ERROR] Unknown mode: %MODE%
echo Usage: release_oneclick.bat ota ^| all ^| apk
goto :fail

:run_all
call :publish_ota || goto :fail
call :build_apk || goto :fail
goto :success

:run_ota
call :publish_ota || goto :fail
goto :success

:run_apk
call :build_apk || goto :fail
goto :success

rem ============================================================
rem  OTA publish flow
rem ============================================================
:publish_ota
echo.
echo [1/5] Reading version from package.json...
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-Content 'package.json' -Raw | ConvertFrom-Json).version"`) do set "APP_VERSION=%%i"
if "%APP_VERSION%"=="" (
    echo [ERROR] Cannot read version from package.json
    exit /b 1
)

for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')"`) do set "UTC_TAG=%%i"
set "WEB_VERSION=%APP_VERSION%-ota-%UTC_TAG%"
set "BUNDLE_FILE=civ-game-%WEB_VERSION%.zip"

set "TMP_DIR=%ROOT_DIR%.release_tmp"
set "TMP_BUNDLES=%TMP_DIR%\bundles"
set "TMP_CHANNEL=%TMP_DIR%\%CHANNEL%"
set "TMP_MANIFEST=%TMP_CHANNEL%\updates.json"
set "TMP_ZIP=%TMP_BUNDLES%\%BUNDLE_FILE%"

if exist "%TMP_DIR%" rd /s /q "%TMP_DIR%"
mkdir "%TMP_BUNDLES%" >nul 2>nul
mkdir "%TMP_CHANNEL%" >nul 2>nul

echo [2/5] Building web assets (npm run build)...
call npm run build
if errorlevel 1 exit /b 1
if not exist "%ROOT_DIR%dist\index.html" (
    echo [ERROR] dist\index.html not found after build
    exit /b 1
)

echo [3/5] Creating OTA zip bundle...
node scripts/create_ota_zip.cjs "%TMP_ZIP%" dist
if errorlevel 1 (
    echo [ERROR] Failed to create zip bundle
    exit /b 1
)

for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-FileHash '%TMP_ZIP%' -Algorithm SHA256).Hash.ToLower()"`) do set "BUNDLE_SHA256=%%i"
if "%BUNDLE_SHA256%"=="" (
    echo [ERROR] Failed to compute SHA256
    exit /b 1
)

rem Determine download URL based on deploy method
if /I "%DEPLOY_METHOD%"=="cos" (
    set "DOWNLOAD_URL=%CDN_BASE_URL%/ota/bundles/%BUNDLE_FILE%"
) else if /I "%DEPLOY_METHOD%"=="local" (
    set "DOWNLOAD_URL=http://localhost/ota/bundles/%BUNDLE_FILE%"
) else if /I "%DEPLOY_METHOD%"=="scp" (
    set "DOWNLOAD_URL=https://your-server.com/ota/bundles/%BUNDLE_FILE%"
)

echo [4/5] Generating updates.json (capgo format)...
powershell -NoProfile -Command ^
    "$mandatory = ('%MANDATORY%' -match '^(1|true|yes)$');" ^
    "$obj = [ordered]@{" ^
    "  version='%WEB_VERSION%';" ^
    "  url='!DOWNLOAD_URL!';" ^
    "  checksum='%BUNDLE_SHA256%';" ^
    "};" ^
    "$json = $obj | ConvertTo-Json -Depth 5;" ^
    "[System.IO.File]::WriteAllText('%TMP_MANIFEST%', $json, (New-Object System.Text.UTF8Encoding $false))"
if errorlevel 1 (
    echo [ERROR] Failed to generate updates.json
    exit /b 1
)

echo [5/5] Deploying OTA files (%DEPLOY_METHOD%)...
if /I "%DEPLOY_METHOD%"=="cos" (
    call :deploy_cos || exit /b 1
) else if /I "%DEPLOY_METHOD%"=="local" (
    call :deploy_local || exit /b 1
) else if /I "%DEPLOY_METHOD%"=="scp" (
    call :deploy_scp || exit /b 1
) else (
    echo [ERROR] DEPLOY_METHOD must be cos, local, or scp
    exit /b 1
)

echo.
echo ============================== OTA Summary ==============================
echo   channel : %CHANNEL%
echo   version : %WEB_VERSION%
echo   bundle  : %BUNDLE_FILE%
echo   sha256  : %BUNDLE_SHA256%
echo   url     : !DOWNLOAD_URL!
echo   deploy  : %DEPLOY_METHOD%
echo =========================================================================
exit /b 0

rem ============================================================
rem  COS deployment via coscmd
rem ============================================================
:deploy_cos
where coscmd >nul 2>nul
if errorlevel 1 (
    echo [ERROR] coscmd not found. Install it: pip install coscmd
    echo         Then configure: coscmd config -a SecretID -s SecretKey -b Bucket -r Region
    exit /b 1
)

echo   Uploading bundle zip to COS...
coscmd upload "%TMP_ZIP%" "ota/bundles/%BUNDLE_FILE%"
if errorlevel 1 (
    echo [ERROR] coscmd upload bundle failed
    exit /b 1
)

echo   Uploading updates.json to COS...
coscmd upload -f "%TMP_MANIFEST%" "ota/%CHANNEL%/updates.json"
if errorlevel 1 (
    echo [ERROR] coscmd upload updates.json failed
    exit /b 1
)

echo   COS deployment successful.

rem Clean up old bundles: keep last 5
echo   Cleaning old bundles (keeping last 5)...
powershell -NoProfile -Command ^
    "$lines = (coscmd list -n 100 ota/bundles/) 2>$null;" ^
    "$zips = $lines | Where-Object { $_ -match 'civ-game-.*\.zip' } | ForEach-Object { ($_ -split '\s+')[-1] };" ^
    "if ($zips.Count -gt 5) { $toDelete = $zips | Select-Object -Skip 5; foreach ($f in $toDelete) { Write-Host \"  Deleting old bundle: $f\"; coscmd delete $f 2>$null } }" 2>nul
exit /b 0

rem ============================================================
rem  Local file deployment
rem ============================================================
:deploy_local
if "%LOCAL_OTA_ROOT%"=="" (
    echo [ERROR] LOCAL_OTA_ROOT is empty
    exit /b 1
)
if not exist "%LOCAL_OTA_ROOT%\bundles" mkdir "%LOCAL_OTA_ROOT%\bundles" >nul 2>nul
if not exist "%LOCAL_OTA_ROOT%\%CHANNEL%" mkdir "%LOCAL_OTA_ROOT%\%CHANNEL%" >nul 2>nul

copy /y "%TMP_ZIP%" "%LOCAL_OTA_ROOT%\bundles\%BUNDLE_FILE%" >nul
if errorlevel 1 (
    echo [ERROR] Failed to copy bundle to local directory
    exit /b 1
)
copy /y "%TMP_MANIFEST%" "%LOCAL_OTA_ROOT%\%CHANNEL%\updates.json" >nul
if errorlevel 1 (
    echo [ERROR] Failed to copy updates.json to local directory
    exit /b 1
)
echo   Local deployment successful: %LOCAL_OTA_ROOT%
exit /b 0

rem ============================================================
rem  SCP deployment
rem ============================================================
:deploy_scp
where scp >nul 2>nul
if errorlevel 1 (
    echo [ERROR] scp not found. Install OpenSSH client or switch to cos/local deploy.
    exit /b 1
)
if "%SCP_TARGET%"=="" (
    echo [ERROR] SCP_TARGET is empty
    exit /b 1
)

if "%SCP_KEY_PATH%"=="" (
    scp "%TMP_ZIP%" "%SCP_TARGET%/bundles/%BUNDLE_FILE%"
    if errorlevel 1 exit /b 1
    scp "%TMP_MANIFEST%" "%SCP_TARGET%/%CHANNEL%/updates.json"
    if errorlevel 1 exit /b 1
) else (
    scp -i "%SCP_KEY_PATH%" "%TMP_ZIP%" "%SCP_TARGET%/bundles/%BUNDLE_FILE%"
    if errorlevel 1 exit /b 1
    scp -i "%SCP_KEY_PATH%" "%TMP_MANIFEST%" "%SCP_TARGET%/%CHANNEL%/updates.json"
    if errorlevel 1 exit /b 1
)
echo   SCP deployment successful: %SCP_TARGET%
exit /b 0

rem ============================================================
rem  Android APK build
rem ============================================================
:build_apk
echo.
echo [APK] Building Android release...
call npm run build
if errorlevel 1 exit /b 1

call npx cap sync android
if errorlevel 1 exit /b 1

if not exist "%ROOT_DIR%android\gradlew.bat" (
    echo [ERROR] android\gradlew.bat not found
    exit /b 1
)

pushd "%ROOT_DIR%android" >nul
call gradlew.bat assembleRelease
if errorlevel 1 (
    popd >nul
    exit /b 1
)
popd >nul

set "APK_PATH=%ROOT_DIR%android\app\build\outputs\apk\release\app-release.apk"
if not exist "%APK_PATH%" (
    set "APK_PATH=%ROOT_DIR%android\app\build\outputs\apk\release\app-release-unsigned.apk"
)
if not exist "%APK_PATH%" (
    echo [ERROR] APK not found after build
    exit /b 1
)

set "OUT_APK_DIR=%ROOT_DIR%release\apk"
if not exist "%OUT_APK_DIR%" mkdir "%OUT_APK_DIR%" >nul 2>nul
copy /y "%APK_PATH%" "%OUT_APK_DIR%\app-release-%APP_VERSION%.apk" >nul
if errorlevel 1 (
    echo [WARN] APK built but copy to release\apk failed
) else (
    echo APK output: %OUT_APK_DIR%\app-release-%APP_VERSION%.apk
)
exit /b 0

rem ============================================================
rem  Exit handlers
rem ============================================================
:success
if exist "%ROOT_DIR%.release_tmp" rd /s /q "%ROOT_DIR%.release_tmp"
echo.
echo ============================================================
echo  All done!
echo ============================================================
popd >nul
exit /b 0

:fail
echo.
echo ============================================================
echo  FAILED - check logs above
echo ============================================================
popd >nul
exit /b 1
