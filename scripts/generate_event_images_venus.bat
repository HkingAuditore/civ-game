@echo off
REM ============================================================
REM Event Image Generator - Venus Platform (OpenAI-compatible API)
REM Uses gemini-2.5-flash-image (Nano Banana) model
REM ============================================================

setlocal

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python first.
    exit /b 1
)

REM Install dependencies if needed
python -c "import requests" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing requests...
    pip install requests -q
)

REM Get script directory
set SCRIPT_DIR=%~dp0

REM Check if first argument exists and is not an option
if "%~1"=="" goto show_help
set "FIRST_ARG=%~1"
if "%FIRST_ARG:~0,1%"=="-" goto show_help

REM First argument is API key
set API_KEY=%~1
shift

REM Collect remaining arguments
set EXTRA_ARGS=
:collect_args
if "%~1"=="" goto run
set EXTRA_ARGS=%EXTRA_ARGS% %1
shift
goto collect_args

:show_help
echo.
echo ============================================================
echo   Venus Event Image Generator
echo   Model: gemini-2.5-flash-image (Nano Banana)
echo ============================================================
echo.
echo Usage:
echo   generate_event_images_venus.bat YOUR_VENUS_TOKEN [options]
echo.
echo Options:
echo   --dry-run, -n       Preview mode, don't generate images
echo   --list, -l          List all event IDs
echo   --only, -o IDS      Only generate specified events (comma-separated)
echo   --start-from, -s ID Start from specified event ID
echo   --delay, -d SECS    Delay between API calls (default: 2)
echo   --aspect-ratio, -a  Image aspect ratio (default: 16:9)
echo   --force, -f         Force regenerate even if image exists
echo.
echo Examples:
echo   generate_event_images_venus.bat YOUR_TOKEN --dry-run
echo   generate_event_images_venus.bat YOUR_TOKEN --list
echo   generate_event_images_venus.bat YOUR_TOKEN --only good_harvest,plague_outbreak
echo   generate_event_images_venus.bat YOUR_TOKEN --start-from bronze_age_bronze_vein
echo   generate_event_images_venus.bat YOUR_TOKEN --aspect-ratio 4:3
echo.
echo Environment:
echo   VENUS_API_KEY       Set this to avoid passing token each time
echo.
echo Get your Venus token at:
echo   https://venus.woa.com/#/openapi/accountManage/personalAccount
echo.
exit /b 1

:run
echo.
echo ============================================================
echo   Venus Event Image Generator
echo   Model: gemini-2.5-flash-image (Nano Banana)
echo ============================================================
echo.

python "%SCRIPT_DIR%generate_event_images_venus.py" --api-key "%API_KEY%" %EXTRA_ARGS%

endlocal
