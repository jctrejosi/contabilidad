# Activador de fuentes para desarrollo. No instala servicios ni usa Fortuner27.
[CmdletBinding()]
param(
    [ValidateRange(1024,65535)][int]$WebPort = 8443,
    [ValidateRange(1024,65535)][int]$ApiPort = 8001,
    [switch]$Check,
    [switch]$Configurar,
    [switch]$Reload
)
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSEdition -eq 'Desktop') {
    $env:PSModulePath = "$PSHOME\Modules;$env:ProgramFiles\WindowsPowerShell\Modules;$env:PSModulePath"
}
$root = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $root 'backend'
$web = Join-Path $root 'Interface_web'
$logs = Join-Path $root 'logs\desarrollo'
$started = @()

function Assert-Native([string]$Message) {
    if ($LASTEXITCODE -ne 0) { throw $Message }
}
function Test-Python([string]$Executable) {
    $ErrorActionPreference = 'Continue'
    if (-not (Test-Path -LiteralPath $Executable)) { return $false }
    & $Executable -c "import sys,struct; sys.exit(0 if sys.version_info >= (3,11) and struct.calcsize('P') == 8 else 1)" 2>$null
    return $LASTEXITCODE -eq 0
}
function Test-Imports([string]$Executable, [string[]]$Arguments) {
    # PowerShell 5.1 convierte stderr nativo en errores: una dependencia
    # ausente debe provocar reparacion, no abortar antes de instalarla.
    $ErrorActionPreference = 'Continue'
    & $Executable @Arguments 2>$null
    return $LASTEXITCODE -eq 0
}
function Wait-Http([string]$Url, $Process) {
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        $Process.Refresh()
        if ($Process.HasExited) { throw "El proceso termino al iniciar. Revise los registros en $logs" }
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Seconds 1
    }
    throw "No respondio $Url. Revise los registros en $logs"
}
try {
    if (-not (Test-Path (Join-Path $backend 'app.py')) -or -not (Test-Path (Join-Path $web 'package.json'))) {
        throw 'Debe copiar el proyecto completo: backend e Interface_web junto al activador.'
    }
    if ($WebPort -eq $ApiPort) { throw 'Los puertos de pagina y API deben ser diferentes.' }
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $node = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:ProgramFiles 'nodejs\node.exe' }
    if (-not (Test-Path $node)) { throw 'Instale Node.js LTS x64 (22.12 o superior) y vuelva a ejecutar.' }
    $nodeVersion = & $node -p 'process.versions.node'
    Assert-Native 'No fue posible ejecutar Node.js.'
    if ([version]$nodeVersion -lt [version]'22.12.0') { throw 'Se requiere Node.js 22.12 o superior.' }
    $npm = Join-Path (Split-Path $node) 'npm.cmd'
    if (-not (Test-Path $npm)) { throw 'La instalacion de Node no incluye npm. Reinstale Node.js LTS.' }
    $python = Join-Path $backend '.venv\Scripts\python.exe'
    $pythonValid = Test-Python $python
    $envFile = Join-Path $backend '.env'
    if ($Check) {
        Write-Host "Proyecto: $root"
        Write-Host "Node: $nodeVersion"
        Write-Host "Entorno Python x64 valido: $pythonValid"
        Write-Host "Configuracion Advantage presente: $(Test-Path $envFile)"
        foreach ($port in @($ApiPort,$WebPort)) {
            $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
            Write-Host "Puerto ${port}: $(if ($listener) { 'ocupado' } else { 'disponible' })"
        }
        Write-Host 'Diagnostico finalizado; no se instalaron dependencias ni se iniciaron procesos.'
        exit 0
    }
    # Nunca liberar puertos matando procesos ajenos o una instancia anterior.
    foreach ($port in @($ApiPort,$WebPort)) {
        if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
            throw "El puerto $port esta ocupado. Cierre la instancia anterior o use -WebPort y -ApiPort distintos."
        }
    }
    New-Item -ItemType Directory -Path $logs -Force | Out-Null
    if (-not $pythonValid) {
        $basePython = $null
        $launcher = Get-Command py.exe -ErrorAction SilentlyContinue
        if ($launcher) {
            $savedPreference = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            $candidate = & $launcher.Source -3 -c 'import sys; print(sys.executable)' 2>$null
            $ErrorActionPreference = $savedPreference
            if ($LASTEXITCODE -eq 0 -and (Test-Python "$candidate")) { $basePython = "$candidate" }
        }
        if (-not $basePython) {
            $candidate = Get-Command python.exe -ErrorAction SilentlyContinue
            if ($candidate -and $candidate.Source -notmatch 'WindowsApps' -and (Test-Python $candidate.Source)) { $basePython = $candidate.Source }
        }
        if (-not $basePython) { throw 'Instale Python x64 3.11 o superior con py/pip y vuelva a ejecutar.' }
        $venv = Join-Path $backend '.venv'
        if (Test-Path -LiteralPath $venv) {
            # Se conserva el entorno copiado, nunca se elimina el proyecto.
            Move-Item -LiteralPath $venv -Destination (Join-Path $backend ('.venv-respaldo-' + [guid]::NewGuid().ToString('N')))
        }
        & $basePython -m venv $venv
        Assert-Native 'No fue posible crear el entorno Python.'
    }
    $requirements = Join-Path $backend 'requirements.txt'
    $signature = "$root|$nodeVersion|$((Get-FileHash $requirements).Hash)|$((Get-FileHash (Join-Path $web 'package.json')).Hash)|$((Get-FileHash (Join-Path $web 'pnpm-lock.yaml')).Hash)"
    $marker = Join-Path $logs 'dependencias.txt'
    $importsOk = Test-Imports $python @('-c','import fastapi,uvicorn,openpyxl,multipart,reportlab,pypdf,win32com.client')
    $previous = if (Test-Path $marker) { [IO.File]::ReadAllText($marker) } else { '' }
    if (-not $importsOk -or $previous -ne $signature) {
        Write-Host 'Preparando dependencias Python (la primera vez requiere Internet)...'
        & $python --version
        # Un pip antiguo puede no reconocer los wheels de un Python reciente.
        & $python -m pip install --upgrade --only-binary=:all: pip setuptools wheel
        Assert-Native 'No fue posible actualizar pip. Revise Internet o el repositorio de paquetes configurado.'
        # En el servidor no se compilan extensiones: evita exigir Visual C++.
        # Si no hay wheel compatible, se informa en lugar de intentar compilar.
        & $python -m pip install --only-binary=:all: -r $requirements
        Assert-Native 'Fallo la instalacion de paquetes precompilados. Revise el paquete indicado arriba y la version de Python. Recomendado: Python 3.13 x64 normal (no free-threaded). Si usa un repositorio privado, verifique que incluya los wheels compatibles.'
    }
    Push-Location $web
    try {
        $webOk = Test-Imports $node @('--input-type=module','-e',"await import('vite'); await import('@vitejs/plugin-react'); await import('@tailwindcss/vite')")
        if (-not $webOk -or $previous -ne $signature) {
            Write-Host 'Preparando dependencias web...'
            & $npm install --no-package-lock
            Assert-Native 'Fallo npm install. Revise Internet y el mensaje anterior.'
        }
    } finally { Pop-Location }
    [IO.File]::WriteAllText($marker, $signature)
    if ($Configurar -or -not (Test-Path $envFile)) {
        Write-Host 'Configure la conexion del servidor. La clave no se muestra en pantalla.'
        $source = Read-Host 'Ruta completa al diccionario .ADD (local o UNC)'
        $user = Read-Host 'Usuario Advantage'
        $secret = Read-Host 'Clave Advantage' -AsSecureString
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
        try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
        if (-not $source -or -not $user -or -not $password) { throw 'La conexion requiere ruta, usuario y clave.' }
        if (Test-Path $envFile) { Copy-Item $envFile "$envFile.respaldo-$(Get-Date -Format yyyyMMddHHmmss)" }
        $content = "ADS_PROVIDER=Advantage.OLEDB.1`r`nADS_DATA_SOURCE=$source`r`nADS_USER_ID=$user`r`nADS_PASSWORD=$password`r`nADS_SERVER_TYPE=ADS_REMOTE_SERVER`r`nADS_ODBC_DRIVER=Advantage StreamlineSQL ODBC`r`n"
        [IO.File]::WriteAllText($envFile,$content,(New-Object Text.UTF8Encoding($false)))
        $password = $null
        $content = $null
    }
    # La configuracion del proyecto prevalece sobre variables heredadas del equipo.
    Get-ChildItem Env:ADS_* | ForEach-Object { Remove-Item -LiteralPath ('Env:' + $_.Name) }
    $env:CONTABDSI_STORE = 'ads'
    Push-Location $root
    try {
        Write-Host 'Comprobando conexion ADO y ODBC con Advantage...'
        $probe = "from backend.ads_repository import ads_connection,ads_odbc_connection; a=ads_connection(); b=ads_odbc_connection(); a.__enter__(); b.__enter__(); b.__exit__(None,None,None); a.__exit__(None,None,None); print('Conexion Advantage correcta.')"
        & $python -c $probe 2> (Join-Path $logs 'conexion-error.log')
        Assert-Native "No fue posible conectar con Advantage. Revise $logs\conexion-error.log. Puede ejecutar con -Configurar para cambiar la conexion."
    } finally { Pop-Location }
    $apiArgs = @('-m','uvicorn','backend.app:app','--host','127.0.0.1','--port',"$ApiPort")
    if ($Reload) { $apiArgs += @('--reload','--reload-dir',('"' + $backend + '"')) }
    $api = Start-Process -FilePath $python -ArgumentList $apiArgs -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'api.log') -RedirectStandardError (Join-Path $logs 'api-error.log')
    $started += $api
    Wait-Http "http://127.0.0.1:$ApiPort/api/health" $api
    $env:ADS_API_URL = "http://127.0.0.1:$ApiPort"
    $env:PORT = "$WebPort"
    $vite = Join-Path $web 'node_modules\vite\bin\vite.js'
    $page = Start-Process -FilePath $node -ArgumentList @(('"' + $vite + '"'),'--host','0.0.0.0','--port',"$WebPort",'--strictPort') -WorkingDirectory $web -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'web.log') -RedirectStandardError (Join-Path $logs 'web-error.log')
    $started += $page
    Wait-Http "http://127.0.0.1:$WebPort/api/health" $page
    Write-Host "DESARROLLO ACTIVO: http://localhost:$WebPort"
    Write-Host "Desde otros equipos: http://$($env:COMPUTERNAME):$WebPort (permita TCP $WebPort en el firewall de la red privada)."
    Write-Host 'Mantenga esta ventana abierta. Pulse Q para detener pagina y API.'
    Write-Host 'El asistente IA no se inicia con este activador. No usar Vite expuesto a Internet.'
    while ($true) {
        foreach ($process in $started) {
            $process.Refresh()
            if ($process.HasExited) { throw "Un proceso se detuvo. Revise $logs" }
        }
        if ([Console]::KeyAvailable -and [Console]::ReadKey($true).Key -eq 'Q') { break }
        Start-Sleep -Milliseconds 500
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # Solo detener los PID creados por esta ejecucion, incluidos hijos de reload.
    foreach ($process in $started) {
        $process.Refresh()
        if (-not $process.HasExited) { & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null }
    }
}
