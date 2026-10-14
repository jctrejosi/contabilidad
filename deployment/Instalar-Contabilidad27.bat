@echo off
setlocal
title Instalar Contabilidad 27 DSI
set "PS_EXECUTABLE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "PS_EXECUTABLE=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
"%PS_EXECUTABLE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1" %*
set "INSTALL_RESULT=%ERRORLEVEL%"
echo.
if "%INSTALL_RESULT%"=="0" (
    echo Instalacion terminada. Fortuner27 es quien inicia Contabilidad.
) else (
    echo No se completo la instalacion. Revise el mensaje anterior.
)
if not defined CONTABDSI_UNATTENDED pause
endlocal & exit /b %INSTALL_RESULT%
