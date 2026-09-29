@echo off
chcp 65001 >nul
echo Останавливаю сайт АТОМ СЭИЛС...
taskkill /FI "WINDOWTITLE eq SiteDev*" /T /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":4321" ^| findstr "LISTENING"') do taskkill /PID %%p /T /F >nul 2>&1
echo Готово. Порт 4321 свободен.
pause
