@echo off
echo Initializing Git Repository for LOM...

REM --- Auto-detect Git ---
set "GIT_CMD=git"
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo Git not found in PATH. Checking default locations...
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
        echo Found Git at C:\Program Files\Git\cmd\git.exe
    ) else (
        echo Error: Git not found. Please restart Antigravity or install Git manually.
        pause
        exit /b
    )
)

REM 1. Initialize
"%GIT_CMD%" init
if %errorlevel% neq 0 (
    echo Error running Git.
    pause
    exit /b
)

REM 2. Add and Commit
"%GIT_CMD%" add .
"%GIT_CMD%" commit -m "Initial commit of League of Memory (LOM) v1.0"
"%GIT_CMD%" branch -M main

REM 3. Link Remote
echo Linking to GitHub...
"%GIT_CMD%" remote remove origin 2>nul
"%GIT_CMD%" remote add origin https://github.com/obengfrancisjr/LOM.git

REM 4. Push
echo Pushing...
"%GIT_CMD%" push -u origin main

echo.
echo ========================================================
echo SUCCESS!
echo ========================================================
pause
