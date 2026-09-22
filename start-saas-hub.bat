@echo off
setlocal
title SaaS Hub
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Instala Node.js 22 o superior antes de iniciar el panel.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando dependencias...
  call npm ci
  if errorlevel 1 exit /b 1
)
echo Panel disponible en http://127.0.0.1:3001
echo Motor de publicaciones nativo activo (Facebook, Instagram, LinkedIn, X).
echo ComfyUI y Canva se pueden iniciar desde el panel cuando los necesites.
echo Las publicaciones locales pendientes se procesan mientras este panel esta abierto.
call npm run dev -- --port 3001
