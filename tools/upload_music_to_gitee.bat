@echo off
setlocal EnableExtensions EnableDelayedExpansion

chcp 65001 >nul

echo.
echo ===== Music Compressor + Gitee Uploader =====
echo.

echo Remote: https://gitee.com/hkingauditore/civ-game-music.git
set "REMOTE_URL=https://gitee.com/hkingauditore/civ-game-music.git"
set "BRANCH=master"

echo.
set "SRC_DIR="
set /p SRC_DIR=请输入音乐文件夹路径(例如 D:\Music\bgm)：

if "%SRC_DIR%"=="" (
  echo [ERROR] 你没有输入路径
  exit /b 1
)

if not exist "%SRC_DIR%" (
  echo [ERROR] 路径不存在: "%SRC_DIR%"
  exit /b 1
)

echo.
set "REPO_DIR="
set /p REPO_DIR=请输入本地克隆仓库目录(例如 D:\repos\civ-game-music)：

if "%REPO_DIR%"=="" (
  echo [ERROR] 你没有输入仓库目录
  exit /b 1
)

echo.
set "OUT_SUBDIR=music"
set /p OUT_SUBDIR=输出到仓库中的子目录(默认music, 直接回车使用默认)：
if "%OUT_SUBDIR%"=="" set "OUT_SUBDIR=music"

set "OUT_DIR=%REPO_DIR%\%OUT_SUBDIR%"

echo.
echo [INFO] 源目录: "%SRC_DIR%"
echo [INFO] 本地仓库: "%REPO_DIR%"
echo [INFO] 输出目录: "%OUT_DIR%"
echo.

REM ---- ensure repo exists & has remote ----
if not exist "%REPO_DIR%" (
  echo [INFO] 目录不存在，将进行克隆...
  git clone "%REMOTE_URL%" "%REPO_DIR%"
  if errorlevel 1 (
    echo [ERROR] git clone 失败
    exit /b 1
  )
)

if not exist "%REPO_DIR%\.git" (
  echo [ERROR] 目标目录不是git仓库: "%REPO_DIR%"
  exit /b 1
)

REM ---- ensure output dir ----
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

REM ---- find ffmpeg ----
where ffmpeg >nul 2>&1
if errorlevel 1 (
  echo [ERROR] 未检测到ffmpeg。
  echo        请先安装ffmpeg并加入PATH（能在命令行运行 ffmpeg -version）。
  echo        下载: https://ffmpeg.org/download.html
  exit /b 1
)

echo [INFO] 开始转码/压缩 (mp3 128k)...
echo.

set /a COUNT=0
for %%F in ("%SRC_DIR%\*.mp3" "%SRC_DIR%\*.wav" "%SRC_DIR%\*.flac" "%SRC_DIR%\*.m4a" "%SRC_DIR%\*.aac" "%SRC_DIR%\*.ogg") do (
  if exist "%%~fF" (
    set /a COUNT+=1
    set "BASENAME=%%~nF"
    set "OUTFILE=%OUT_DIR%\!BASENAME!.mp3"

    echo [!COUNT!] %%~nxF  ^>  !OUTFILE!
    ffmpeg -y -hide_banner -loglevel error -i "%%~fF" -vn -ac 2 -ar 44100 -b:a 128k "!OUTFILE!"
    if errorlevel 1 (
      echo [ERROR] 转码失败: "%%~fF"
      exit /b 1
    )
  )
)

if %COUNT%==0 (
  echo [WARN] 没找到可处理的音频文件(支持 mp3/wav/flac/m4a/aac/ogg)
  exit /b 0
)

echo.
echo [INFO] 生成 tracks.json (包含Gitee raw直链)...
echo.

REM ---- parse user/repo from remote ----
set "GITEE_USER=hkingauditore"
set "GITEE_REPO=civ-game-music"

set "TRACKS_FILE=%REPO_DIR%\tracks.json"
(
  echo [
) > "%TRACKS_FILE%"

set /a IDX=0
for %%M in ("%OUT_DIR%\*.mp3") do (
  if exist "%%~fM" (
    set /a IDX+=1
    set "NAME=%%~nM"
    set "FILE=%%~nxM"

    set "URL=https://gitee.com/%GITEE_USER%/%GITEE_REPO%/raw/%BRANCH%/%OUT_SUBDIR%/!FILE!"

    if !IDX! gtr 1 (
      echo ,  {"name":"!NAME!","url":"!URL!"}>> "%TRACKS_FILE%"
    ) else (
      echo   {"name":"!NAME!","url":"!URL!"}>> "%TRACKS_FILE%"
    )
  )
)

(
  echo ]
) >> "%TRACKS_FILE%"

pushd "%REPO_DIR%" >nul

echo [INFO] git add ...
git add "%OUT_SUBDIR%" tracks.json
if errorlevel 1 (
  echo [ERROR] git add 失败
  popd >nul
  exit /b 1
)

echo [INFO] git commit ...
git commit -m "Update music" >nul 2>&1

echo [INFO] git push ...
git push origin "%BRANCH%"
if errorlevel 1 (
  echo [ERROR] git push 失败。常见原因：
  echo   1^) 未登录/无权限（HTTPS可能需要令牌或改用SSH）
  echo   2^) 仓库默认分支名不一致
  popd >nul
  exit /b 1
)

popd >nul

echo.
echo [OK] 完成：已压缩并上传到Gitee，并生成 tracks.json
exit /b 0
