@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM Event Image Generator Launcher (Gemini)
REM Usage: run_gemini_gen.bat [API_KEY] [OPTIONS]

set "SCRIPT_DIR=%~dp0"
set "PYTHON_SCRIPT=%SCRIPT_DIR%generate_event_images_gemini.py"

echo ===============================================
echo   Event Image Generator (Gemini 2.5 Flash)
echo ===============================================

REM Check for Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found. Please install Python.
    exit /b 1
)

REM Check first argument
set "FIRST_ARG_VAL=%~1"

if "%FIRST_ARG_VAL%"=="" goto no_args
if "!FIRST_ARG_VAL:~0,1!"=="-" goto use_env_key

REM Case: First arg is API Key
set "API_KEY=%~1"
shift
REM Collect remaining args
set "EXTRA_ARGS="
:collect_loop
if "%~1"=="" goto run_script
set "EXTRA_ARGS=!EXTRA_ARGS! %1"
shift
goto collect_loop

:use_env_key
set "API_KEY=%GOOGLE_API_KEY%"
set "EXTRA_ARGS=%*"
goto run_script

:no_args
if defined GOOGLE_API_KEY (
    set "API_KEY=%GOOGLE_API_KEY%"
    goto run_script
)
echo [ERROR] No API Key provided.
echo.
echo Usage: 
echo   run_gemini_gen.bat YOUR_API_KEY [options]
echo.
echo Or set GOOGLE_API_KEY environment variable.
echo.
echo Options:
echo   --dry-run    Test without generating images
echo   --only ID    Generate specific event only (e.g. good_harvest)
exit /b 1

:run_script
if "!API_KEY!"=="" (
    echo [ERROR] No API Key found in environment.
    exit /b 1
)

echo [INFO] Using API Key: ******!API_KEY:~-4!
echo [INFO] Running Gemini Generator...
echo.

set PYTHONIOENCODING=utf-8
python "!PYTHON_SCRIPT!" --api-key "!API_KEY!" !EXTRA_ARGS!

echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Batch generation finished.
) else (
    echo [FAILURE] Script exited with errors.
)

pause
endlocal
