@echo off
cd /d "%~dp0"
start "Локальный сервер сайта" cmd /k "python -m http.server 4173 --directory dist"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:4173"
