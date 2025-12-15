@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  Event Image Generator using Google GenAI SDK
REM  Uses gemini-2.5-flash-image model
REM ============================================================

echo.
echo ============================================================
echo   Google GenAI Event Image Generator
echo   Model: gemini-2.5-flash-image
echo ============================================================
echo.

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"

REM Check for Python
where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python not found in PATH
    echo Please install Python 3.8+ and add it to PATH
    exit /b 1
)

REM Check for google-genai package
python -c "from google import genai" >nul 2>nul
if errorlevel 1 (
    echo [WARNING] google-genai package not installed
    echo Installing google-genai...
    pip install google-genai
    if errorlevel 1 (
        echo [ERROR] Failed to install google-genai
        exit /b 1
    )
)

REM Run the Python script with all arguments
python "%SCRIPT_DIR%generate_event_images_genai.py" %*

endlocal
