@echo off
title PlayRig Engine - Platform Server (MySQL 3307)
cd /d "%~dp0"

echo ===================================================
echo   PLAYRIG PLATFORM ENGINE - SERVER INITIALISIERUNG
echo   Datenbank: MySQL (Port 3307) - playrig_db
echo ===================================================

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [FEHLER] Node.js wurde nicht im System-Pfad gefunden!
    echo Bitte installiere Node.js von https://nodejs.org/
    pause
    exit /b 1
)

:: Check node_modules
if not exist "node_modules\" (
    echo [INFO] Erstinstallation: Installiere Abhaengigkeiten...
    call npm install
)

echo [INFO] Starte PlayRig Engine Server auf Port 8882...
echo        - Deck:   http://localhost:8882
echo        - Studio: http://localhost:8882/studio
echo        - Admin:  http://localhost:8882/admin
echo.

:: Open Browser after 2 seconds in background
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8882"

:: Start Node Server
node server/server.js
pause
