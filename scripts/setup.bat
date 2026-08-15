@echo off
cd /d "%~dp0.."
if not exist ".venv" (
    py -3.12 -m venv .venv 2>nul || python -m venv .venv
)
call .venv\Scripts\python.exe -m pip install --upgrade pip
call .venv\Scripts\python.exe -m pip install -r requirements.txt
call .venv\Scripts\python.exe tools\generate_presets.py
echo.
echo Готово. Запуск: scripts\start.bat
pause
