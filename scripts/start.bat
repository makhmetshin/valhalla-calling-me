@echo off
cd /d "%~dp0.."
if not exist ".venv\Scripts\pythonw.exe" (
    echo Окружение не найдено. Сначала запусти scripts\setup.bat
    pause
    exit /b 1
)
start "" ".venv\Scripts\pythonw.exe" run.py
