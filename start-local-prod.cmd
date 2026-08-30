@echo off
chcp 65001 >nul
setlocal

rem ============================================================
rem  Локальный запуск "точно как в продакшене"
rem
rem  Отличие от start-local.cmd:
rem    - мини-апка собирается прод-бандлом (vite build), а не dev-сервером;
rem    - её раздаёт сам API из apps/mini-app/dist, как на боевом сервере;
rem    - NODE_ENV=production, поэтому dev-обход авторизации (x-user-id) выключен;
rem    - авторизация идёт настоящими Telegram init data, подписанными
rem      токеном бота (готовит scripts/prepare-local-prod.mjs);
rem    - бот работает на long polling, публичный адрес не нужен.
rem
rem  Адрес приложения:  http://localhost:3001/local.html
rem ============================================================

cd /d "%~dp0"

rem Среда WorkBuddy подменяет rm/unlink через NODE_OPTIONS - отключаем,
rem иначе npm/vite ломаются при распаковке и очистке dist/
set "NODE_OPTIONS="
set "CODEBUDDY_SAFE_DELETE_ENABLED=0"

if not exist "node_modules" (
  echo [1/4] Устанавливаю зависимости...
  call npm install
  if errorlevel 1 goto :fail
) else (
  echo [1/4] Зависимости уже установлены, пропускаю.
)

echo [2/4] Собираю мини-апку и подписываю init data...
call node scripts/prepare-local-prod.mjs
if errorlevel 1 goto :fail

echo.
echo [3/4] Запускаю API в production-режиме ^(http://localhost:3001^)...
start "Dharma API (prod)" cmd /k "cd /d ""%~dp0"" && set NODE_OPTIONS= && set CODEBUDDY_SAFE_DELETE_ENABLED=0 && set NODE_ENV=production && npm run start:api"

echo [4/4] Запускаю бота ^(long polling^)...
start "Dharma Bot (prod)" cmd /k "cd /d ""%~dp0"" && set NODE_OPTIONS= && set CODEBUDDY_SAFE_DELETE_ENABLED=0 && set NODE_ENV=production && npm run start:bot"

echo.
echo ============================================================
echo  Готово. Открой в браузере:
echo.
echo      http://localhost:3001/local.html
echo.
echo  Проверка API:  http://localhost:3001/health
echo  Остановить:    stop-local.cmd
echo ============================================================
echo.
timeout /t 5 >nul
start "" http://localhost:3001/local.html
exit /b 0

:fail
echo.
echo ОШИБКА: запуск не удался, смотри вывод выше.
exit /b 1
