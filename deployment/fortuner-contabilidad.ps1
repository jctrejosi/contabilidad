# Adaptador instalado en Fortuner. No se ejecuta durante la instalacion.
# Inicia el ejecutable instalado sin depender de Python, Node ni fuentes.
param([string]$ConfigurationPath = "")
if ($PSVersionTable.PSEdition -eq 'Desktop') { $env:PSModulePath = "$PSHOME\Modules;$env:ProgramFiles\WindowsPowerShell\Modules;$env:PSModulePath" }
$ErrorActionPreference = "Stop"
if (-not $ConfigurationPath) {
    $ConfigurationPath = if ($env:FORTUNER_MODULES_CONFIG) { $env:FORTUNER_MODULES_CONFIG } else { Join-Path $PSScriptRoot 'Config\modules.json' }
}
$settings = Get-Content -LiteralPath $ConfigurationPath -Raw | ConvertFrom-Json
$module = @($settings.modules | Where-Object { $_.id -eq 'contabilidad' -and $_.status -eq 'active' })
if ($module.Count -ne 1) { return }
$service = $module[0].services.frontend
$projectsRoot = [string]$settings.defaults.projectsRoot
if (-not [IO.Path]::IsPathRooted($projectsRoot)) { $projectsRoot = Join-Path $PSScriptRoot $projectsRoot }
$working = [string]$service.workingDirectory
if (-not [IO.Path]::IsPathRooted($working)) { $working = Join-Path $projectsRoot $working }
$working = [IO.Path]::GetFullPath($working)
$manifestFile = Join-Path $working 'installation.json'
if (-not (Test-Path -LiteralPath $manifestFile)) { throw 'La instalacion de Contabilidad esta incompleta.' }
$installation = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
if ($installation.product -ne 'CONTABDSI27') { throw 'El directorio configurado no corresponde a Contabilidad.' }
$executable = [string]$installation.executable
$configuration = [string]$installation.configuration
if (-not (Test-Path -LiteralPath $executable -PathType Leaf) -or -not (Test-Path -LiteralPath $configuration -PathType Leaf)) {
    throw 'La instalacion de Contabilidad no contiene el ejecutable o su configuracion.'
}
$port = [int]$service.port
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    $existing = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener[0].OwningProcess)"
    if ($existing.ExecutablePath -ne [string]$installation.executable) { throw "El puerto $port pertenece a otro proceso." }
    Write-Host "[ACTIVO] Contabilidad (puerto $port)" -ForegroundColor Green
    return
}
$logRoot = Join-Path $working 'logs'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$arguments = 'serve --config "' + $configuration + '" --port ' + $port.ToString()
Start-Process -FilePath $executable -ArgumentList $arguments -WorkingDirectory $working -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'fortuner.stdout.log') -RedirectStandardError (Join-Path $logRoot 'fortuner.stderr.log') | Out-Null
$deadline = (Get-Date).AddSeconds(30)
do {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        Write-Host "[INICIADO] Contabilidad (puerto $port)" -ForegroundColor Green
        return
    }
    Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $deadline)
throw "Contabilidad no inicio. Revise $logRoot."
