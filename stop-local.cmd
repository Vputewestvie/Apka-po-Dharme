@echo off
chcp 65001 >nul
echo Останавливаю локальные серверы на портах 3001 и 5173...

for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":3001 .*LISTENING"') do (
  echo   kill PID %%p ^(порт 3001^)
  taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":5173 .*LISTENING"') do (
  echo   kill PID %%p ^(порт 5173^)
  taskkill /PID %%p /F >nul 2>&1
)

echo Готово.
timeout /t 2 >nul
