@echo off
chcp 65001 >nul
:menu
cls
echo === Local model manager ===
echo Current VRAM state:
node "%~dp0model-toggle.mjs" status
echo.
echo 1 - Load qwen3.8-27b-q3xl (main local agent model - SMARTEST)
echo 2 - Load qwen3:14b        (lighter fallback)
echo 3 - Unload ALL models from VRAM (free for gaming)
echo 0 - Exit
set /p c="Number: "
if "%c%"=="1" node "%~dp0model-toggle.mjs" load qwen3.8-27b-q3xl
if "%c%"=="2" node "%~dp0model-toggle.mjs" load qwen3:14b
if "%c%"=="3" node "%~dp0model-toggle.mjs" unload-all
if "%c%"=="0" exit /b
echo.
pause
goto menu
