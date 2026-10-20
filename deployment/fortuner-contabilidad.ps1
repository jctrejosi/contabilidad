# Adaptador instalado en Fortuner. No se ejecuta durante la instalacion.
# Respeta el contrato npm ya admitido por modules.json; el script npm inicia
# el ejecutable empaquetado. No depende de Python ni de fuentes contables.
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
if ($service.npmScript -ne 'start:fortuner') { return }
$projectsRoot = [string]$settings.defaults.projectsRoot
if (-not [IO.Path]::IsPathRooted($projectsRoot)) { $projectsRoot = Join-Path $PSScriptRoot $projectsRoot }
$working = [string]$service.workingDirectory
if (-not [IO.Path]::IsPathRooted($working)) { $working = Join-Path $projectsRoot $working }
$working = [IO.Path]::GetFullPath($working)
$manifestFile = Join-Path $working 'installation.json'
if (-not (Test-Path -LiteralPath $manifestFile)) { throw 'La instalacion de Contabilidad esta incompleta.' }
$installation = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
if ($installation.product -ne 'CONTABDSI27') { throw 'El directorio configurado no corresponde a Contabilidad.' }
$port = [int]$service.port
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    $existing = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener[0].OwningProcess)"
    if ($existing.ExecutablePath -ne [string]$installation.executable) { throw "El puerto $port pertenece a otro proceso." }
    Write-Host "[ACTIVO] Contabilidad (puerto $port)" -ForegroundColor Green
    return
}
$npm = Get-Command npm.cmd -ErrorAction Stop
$logRoot = Join-Path $working 'logs'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
Start-Process -FilePath $npm.Source -ArgumentList @('run', 'start:fortuner', '--', '--port', $port.ToString()) -WorkingDirectory $working -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'fortuner.stdout.log') -RedirectStandardError (Join-Path $logRoot 'fortuner.stderr.log') | Out-Null
$deadline = (Get-Date).AddSeconds(30)
do {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        Write-Host "[INICIADO] Contabilidad (puerto $port)" -ForegroundColor Green
        return
    }
    Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $deadline)
throw "Contabilidad no inicio. Revise $logRoot."
