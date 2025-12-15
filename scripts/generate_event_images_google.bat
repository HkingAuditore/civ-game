@echo off
setlocal enabledelayedexpansion

REM Event Image Generator Launcher
REM Usage: generate_event_images_google.bat [API_KEY] [OPTIONS]

set "SCRIPT_DIR=%~dp0"
set "PYTHON_SCRIPT=%SCRIPT_DIR%generate_event_images_google.py"

echo ===============================================
echo   Event Image Generator (Gemini)
echo ===============================================

REM Check if first arg is an API Key (does not start with -)
set "FIRST_ARG=%~1"
set "API_KEY="
set "EXTRA_ARGS="

if "!FIRST_ARG:~0,1!"=="-" (
    REM First arg is a flag, assume API key is in env
    set "API_KEY=%GOOGLE_API_KEY%"
    set "EXTRA_ARGS=%*"
) else (
    REM First arg is likely API Key
    set "API_KEY=%~1"
    
    REM Collect remaining args
    shift
    :collect_args
    if "%~1"=="" goto done_args
    set "EXTRA_ARGS=!EXTRA_ARGS! %1"
    shift
    goto collect_args
    :done_args
)

if "%API_KEY%"=="" (
    echo [ERROR] No API Key provided.
    echo Usage: generate_event_images_google.bat YOUR_API_KEY [options]
    echo Or set GOOGLE_API_KEY environment variable.
    echo.
    echo Options:
    echo   --dry-run    Test without generating
    echo   --only ID    Generate specific event
    exit /b 1
)

REM Check Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found. Please install Python.
    exit /b 1
)

REM Run Script
python "%PYTHON_SCRIPT%" --api-key "%API_KEY%" !EXTRA_ARGS!

echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Script finished successfully.
) else (
    echo [FAILURE] Script exited with error.
)

endlocal
