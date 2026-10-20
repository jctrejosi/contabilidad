@echo off
setlocal
title Preparar instalador Contabilidad 27 DSI
set "PS_EXECUTABLE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "PS_EXECUTABLE=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
"%PS_EXECUTABLE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-release.ps1" %*
set "BUILD_RESULT=%ERRORLEVEL%"
if not defined CONTABDSI_UNATTENDED pause
endlocal & exit /b %BUILD_RESULT%
