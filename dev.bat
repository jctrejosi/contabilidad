@echo off
rem Lanzador de dev.js para Windows. Reenvía los argumentos tal cual:
rem   dev.bat            arranca todo
rem   dev.bat --init     reconstruye desde cero (pide confirmación)
rem   dev.bat --stop     detiene los servicios
setlocal
cd /d "%~dp0"

rem dev.js imprime acentos y caracteres de caja: sin UTF-8 se ven como basura.
chcp 65001 >nul

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado o no esta en PATH.
  echo Instala Node.js LTS x64 22.12 o superior y vuelve a ejecutar.
  if not defined CONTABDSI_UNATTENDED pause
  exit /b 1
)

node "%~dp0dev.js" %*
set "RESULT=%ERRORLEVEL%"

rem Al hacer doble clic la ventana se cerraria antes de leer el resultado.
if not defined CONTABDSI_UNATTENDED pause
exit /b %RESULT%
