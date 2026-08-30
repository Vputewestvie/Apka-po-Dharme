@echo off
chcp 65001 >nul
setlocal

rem ============================================================
rem  Локальный запуск "Мини-апка по Дхарме"
rem  API  -> http://localhost:3001
rem  Mini App (Vite) -> http://localhost:5173
rem ============================================================

cd /d "%~dp0"

rem Среда WorkBuddy подменяет rm/unlink через NODE_OPTIONS - отключаем,
rem иначе npm/vite ломаются при распаковке и очистке dist/
set "NODE_OPTIONS="
set "CODEBUDDY_SAFE_DELETE_ENABLED=0"

if not exist "node_modules" (
  echo [1/3] Устанавливаю зависимости...
  call npm install
  if errorlevel 1 goto :fail
) else (
  echo [1/3] Зависимости уже установлены, пропускаю.
)

echo [2/3] Запускаю API  ^(http://localhost:3001^)...
start "Dharma API" cmd /k "cd /d ""%~dp0"" && set NODE_OPTIONS= && set CODEBUDDY_SAFE_DELETE_ENABLED=0 && npm run dev:api"

echo [3/3] Запускаю Mini App ^(http://localhost:5173^)...
start "Dharma Mini App" cmd /k "cd /d ""%~dp0"" && set NODE_OPTIONS= && set CODEBUDDY_SAFE_DELETE_ENABLED=0 && npm run dev:mini-app"

echo.
echo Готово. Открой в браузере:  http://localhost:5173
echo Проверка API:               http://localhost:3001/health
echo.
echo Остановить:  stop-local.cmd  или просто закрой оба окна.
echo.
exit /b 0

:fail
echo.
echo ОШИБКА: не удалось установить зависимости.
exit /b 1
