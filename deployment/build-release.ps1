param([string]$OutputDirectory = '', [switch]$NoDependencyInstall)
if ($PSVersionTable.PSEdition -eq 'Desktop') { $env:PSModulePath = "$PSHOME\Modules;$env:ProgramFiles\WindowsPowerShell\Modules;$env:PSModulePath" }
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$python = Join-Path $project 'backend\.venv\Scripts\python.exe'
$web = Join-Path $project 'Interface_web'
if (-not [Environment]::Is64BitOperatingSystem) { throw 'El paquete requiere Windows x64.' }
if (-not (Test-Path -LiteralPath $python)) { throw 'Prepare primero el entorno Python del proyecto.' }
$architecture = & $python -c "import struct; print(struct.calcsize('P')*8)"
if ($architecture -ne '64') { throw 'El Python de compilacion debe ser de 64 bits.' }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $project 'release' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$version = Get-Date -Format 'yyyyMMdd-HHmmss'
$package = Join-Path $OutputDirectory "CONTABDSI27-$version"
if (Test-Path -LiteralPath $package) { throw 'La carpeta de esta version ya existe.' }
New-Item -ItemType Directory -Path $package -Force | Out-Null
if (-not $NoDependencyInstall) {
    & $python -m pip install -r (Join-Path $PSScriptRoot 'requirements-build.txt')
    if ($LASTEXITCODE -ne 0) { throw 'No fue posible preparar PyInstaller.' }
}
Push-Location $web
try {
    if (-not (Test-Path -LiteralPath 'node_modules')) {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'No fue posible instalar las dependencias web.' }
    }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'No fue posible compilar la interfaz.' }
} finally { Pop-Location }
$work = Join-Path $OutputDirectory "build-$version"
$dist = Join-Path $package 'payload'
$arguments = @('-m', 'PyInstaller', '--onedir', '--name', 'Contabilidad27',
    '--distpath', $dist, '--workpath', $work, '--specpath', $work,
    '--paths', $project, '--collect-submodules', 'backend',
    '--exclude-module', 'backend.tests', '--collect-submodules', 'uvicorn',
    '--hidden-import', 'win32crypt', '--hidden-import', 'pythoncom',
    '--hidden-import', 'win32com.client', '--hidden-import', 'win32timezone',
    '--collect-data', 'reportlab',
    '--add-data', "$(Join-Path $web 'dist');site", (Join-Path $PSScriptRoot 'runtime.py'))
Push-Location $project
try {
    & $python @arguments
    if ($LASTEXITCODE -ne 0) { throw 'No fue posible empaquetar el ejecutable.' }
} finally { Pop-Location }
$executable = Join-Path $dist 'Contabilidad27\Contabilidad27.exe'
& $executable inspect
if ($LASTEXITCODE -ne 0) { throw 'El ejecutable no supero la comprobacion de carga.' }
# La distribucion no incluye fuentes, .env, bases ni mapas de codigo.
$forbidden = @(Get-ChildItem -LiteralPath $dist -Recurse -File | Where-Object {
    $_.Extension -in @('.py','.pyw','.tsx','.ts','.map','.prg','.adt','.add','.adi') -or $_.Name -eq '.env'
})
if ($forbidden.Count) { throw "La distribucion contiene archivos no permitidos: $($forbidden.Name -join ', ')" }
foreach ($file in @('Instalar-Contabilidad27.bat','instalar.ps1','fortuner-contabilidad.ps1','PROTOCOLO-INSTALACION.txt','Configurar-Conexion-Contabilidad27.bat','configurar-conexion.ps1')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $package $file)
}
$manifest = [ordered]@{ product = 'CONTABDSI27'; version = $version; architecture = 'x64'; files = @() }
foreach ($file in Get-ChildItem -LiteralPath $package -Recurse -File) {
    $relative = $file.FullName.Substring($package.Length + 1).Replace('\','/')
    $manifest.files += [ordered]@{ path = $relative; sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash }
}
$json = $manifest | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText((Join-Path $package 'manifest.json'), $json, (New-Object Text.UTF8Encoding($false)))
Compress-Archive -LiteralPath $package -DestinationPath "$package.zip"
Write-Host "Paquete listo: $package.zip" -ForegroundColor Green
Write-Host 'No se instalo ni se inicio ningun servicio.'
