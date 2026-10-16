@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===========================================
echo Dota Replay Analyzer - установка
echo ===========================================
where python >nul 2>nul
if errorlevel 1 (
  echo Python не найден. Установи Python 3.11 или 3.12 с сайта python.org и включи Add Python to PATH.
  pause
  exit /b 1
)
python -m venv .venv
if errorlevel 1 (
  echo Не удалось создать виртуальное окружение.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo Установка зависимостей завершилась с ошибкой.
  pause
  exit /b 1
)
echo.
echo Готово. Запусти run.bat
pause
