@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -m venv .venv
if errorlevel 1 goto error
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 goto error
echo.
echo Установка завершена. Запусти run.bat
pause
exit /b 0
:error
echo Не удалось установить зависимости. Проверь, что установлен Python.
pause
exit /b 1
