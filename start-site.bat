@echo off
chcp 65001 >nul
title SiteDev АТОМ СЭИЛС
cd /d "%~dp0site"
echo ==================================================
echo   Сайт АТОМ СЭИЛС - запуск dev-сервера
echo   ПК (эта машина): http://localhost:4321/DesignStudio/
echo   Телефон/ноут (Tailscale): http://100.68.240.52:4321/DesignStudio/
echo   Остановка: запусти stop-site.bat (или закрой это окно)
echo ==================================================
call npm run dev -- --host
if errorlevel 1 pause
