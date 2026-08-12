@echo off
title Servidor RamonNet Turbo
color 0B
echo ==================================================
echo   INICIADOR AUTOMATICO - RAMONNET TURBO BACKEND
echo ==================================================
echo.

:: Verificar si Bun está instalado en el sistema
where bun >nul 2>nul
if %errorlevel% neq 0 (
  color 0C
  echo ❌ [ERROR] Bun no esta instalado en este equipo.
  echo.
  echo Para que este servidor funcione:
  echo 1. Instala Bun desde https://bun.sh
  echo 2. O utiliza un binario compilado de Windows.
  echo.
  pause
  exit /b 1
)

:: Liberar el puerto 3001 si quedó ocupado por algún proceso colgado
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
  echo ⚠️ El puerto 3001 ya esta en uso por el proceso %%a. Liberando...
  taskkill /F /PID %%a >nul 2>&1
)

:: Iniciar el servidor
bun run server.js
