@echo off
set /p ver="Enter new version (e.g. 1.14.0): "
if "%ver%"=="" goto error
echo.
echo Starting build process for version %ver%...
echo.

node scripts/build_android_release.js %ver%

if %errorlevel% neq 0 (
    echo.
    echo -----------------------------------------------------------
    echo BUILD FAILED
    echo -----------------------------------------------------------
    pause
    exit /b %errorlevel%
)

echo.
echo -----------------------------------------------------------
echo BUILD COMPLETE
echo -----------------------------------------------------------
pause
goto :eof

:error
echo Error: No version provided.
pause
