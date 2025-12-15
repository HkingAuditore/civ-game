@echo off
REM Event Image Generation Batch Script
REM This script generates images for game events using OpenAI DALL-E API
REM 
REM Usage:
REM   generate_event_images.bat YOUR_API_KEY
REM   generate_event_images.bat YOUR_API_KEY --dry-run
REM   generate_event_images.bat YOUR_API_KEY --only good_harvest,natural_disaster
REM   generate_event_images.bat YOUR_API_KEY --start-from bronze_age_bronze_vein

setlocal enabledelayedexpansion

REM Get the script directory
set "SCRIPT_DIR=%~dp0"
set "PYTHON_SCRIPT=%SCRIPT_DIR%generate_event_images.py"
set "OUTPUT_DIR=C:\Users\hkinghuang\Documents\GitHub\simple_nation_game\civ-game\public\images\events"

echo ====================================================
echo         Event Image Generator for Civ Game
echo ====================================================
echo.

REM Check if API key is provided
if "%~1"=="" (
    echo ERROR: Please provide your OpenAI API Key as the first argument
    echo.
    echo Usage:
    echo   %~nx0 YOUR_API_KEY [options]
    echo.
    echo Options:
    echo   --dry-run              Parse prompts without generating images
    echo   --list                 List all event IDs
    echo   --only ID1,ID2,...     Generate only specific event IDs
    echo   --start-from ID        Start from a specific event ID
    echo   --delay N              Delay between API calls in seconds ^(default: 2.0^)
    echo.
    echo Examples:
    echo   %~nx0 sk-xxxx
    echo   %~nx0 sk-xxxx --dry-run
    echo   %~nx0 sk-xxxx --only good_harvest,natural_disaster
    echo   %~nx0 sk-xxxx --start-from bronze_age_bronze_vein
    echo   %~nx0 sk-xxxx --list
    exit /b 1
)

set "API_KEY=%~1"

REM Check if Python is installed
where python >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    exit /b 1
)

REM Check if required packages are installed
echo Checking required packages...
python -c "import openai" >nul 2>nul
if errorlevel 1 (
    echo Installing openai package...
    pip install openai
)

python -c "import requests" >nul 2>nul
if errorlevel 1 (
    echo Installing requests package...
    pip install requests
)

REM Create output directory if it doesn't exist
if not exist "%OUTPUT_DIR%" (
    echo Creating output directory: %OUTPUT_DIR%
    mkdir "%OUTPUT_DIR%"
)

echo.
echo Starting image generation...
echo Output directory: %OUTPUT_DIR%
echo.

REM Shift the first argument (API key) and pass the rest to Python script
shift
set "EXTRA_ARGS="
:parse_args
if "%~1"=="" goto run_script
set "EXTRA_ARGS=%EXTRA_ARGS% %1"
shift
goto parse_args

:run_script
REM Run the Python script
python "%PYTHON_SCRIPT%" --api-key "%API_KEY%"%EXTRA_ARGS%

if errorlevel 1 (
    echo.
    echo Some errors occurred during generation.
    echo Check the output above for details.
) else (
    echo.
    echo All images generated successfully!
)

echo.
echo ====================================================
echo Done!
echo Images saved to: %OUTPUT_DIR%
echo ====================================================

endlocal
