@echo off
setlocal
title Configurar conexion - Contabilidad 27 DSI
set "PS_EXECUTABLE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "PS_EXECUTABLE=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
"%PS_EXECUTABLE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-conexion.ps1" %*
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (echo Operacion finalizada correctamente.) else (echo No se completo el cambio. Revise el mensaje anterior.)
pause
endlocal & exit /b %RESULT%
