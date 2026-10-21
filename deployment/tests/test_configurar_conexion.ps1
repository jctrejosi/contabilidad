# Pruebas aisladas: DPAPI real; UAC, ACL y validacion del binario simuladas.
# No invoca el instalador, no inicia servicios ni abre la base activa.
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSEdition -eq 'Desktop') { $env:PSModulePath = "$PSHOME\Modules;$env:ProgramFiles\WindowsPowerShell\Modules;$env:PSModulePath" }
Add-Type -AssemblyName System.Security
$source = Join-Path (Split-Path -Parent $PSScriptRoot) 'configurar-conexion.ps1'
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($source, [ref]$null, [ref]$errors)
if ($errors.Count) { throw 'Error de sintaxis en la utilidad.' }
foreach ($definition in $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
    . ([scriptblock]::Create($definition.Extent.Text))
}
$script:OriginalReplace = ${function:Replace-ConnectionFile}
$script:OriginalAtomic = ${function:Write-ConnectionAtomic}
$script:OriginalReadNew = ${function:Read-NewConnection}
$script:RealAssertAcl = ${function:Assert-ConnectionAcl}
$script:RealAllowed = ${function:Get-ConnectionAllowedSids}
$script:RealCheck = ${function:Invoke-ConnectionCheck}
$script:Captured = New-Object 'Collections.Generic.List[string]'
$script:AclCalls = New-Object 'Collections.Generic.List[string]'
$script:CheckCalls = 0; $script:CheckOk = $true; $script:Stopped = $true
$script:FailReplace = $false; $script:FailMetadata = $false
function Write-Host { param($Object, $ForegroundColor) $script:Captured.Add([string]$Object) }
function Test-ConnectionAdministrator { return $true }
function Test-ConnectionStopped([int]$Port) { return $script:Stopped }
function Assert-ConnectionAcl([string]$Path, [string[]]$Allowed) {
    if (-not $Path.StartsWith($script:TestRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'ACL fuera del sandbox.' }
    if ('S-1-1-0' -in $Allowed -or 'S-1-5-32-545' -in $Allowed) { throw 'ACL demasiado amplia.' }
    $script:AclCalls.Add($Path)
}
function Set-ConnectionBackupAcl([string]$Directory, [string[]]$Allowed) {
    Assert-ConnectionAcl $Directory $Allowed
}
function Read-NewConnection($Current) {
    $data = ($Current | ConvertTo-Json) | ConvertFrom-Json
    $data.ADS_DATA_SOURCE = $script:NewAdd
    $data.ADS_USER_ID = 'usuario-candidato-no-publicar'
    $data.ADS_PASSWORD = 'clave-candidata-no-publicar'
    $data.ADS_REFERENCE_ROOT = $script:NewReference
    $data.ADS_AUDIT_DATA_SOURCE = $script:NewReference
    return $data
}
function Invoke-ConnectionCheck([string]$Executable, [string]$Configuration) {
    $script:CheckCalls++
    if ($Executable -ne $script:ExpectedExe) { throw 'No uso el ejecutable instalado.' }
    $settings = Get-Content -LiteralPath $Configuration -Raw | ConvertFrom-Json
    $secret = Read-ConnectionSecret (Join-Path (Split-Path -Parent $Configuration) $settings.credentialsFile)
    if ($secret.ADS_PASSWORD -ne 'clave-candidata-no-publicar') { throw 'Credencial candidata no descifrable.' }
    if ($settings.port -ne 19443 -or $settings.cookieSecure -ne $true -or $settings.fortunerApiUrl -ne 'http://127.0.0.1:8004') { throw 'Cambio la configuracion del servicio.' }
    if ($secret.ADS_REFERENCE_ROOT -ne $script:NewReference -or $secret.ADS_AUDIT_DATA_SOURCE -ne $script:NewReference) { throw 'Referencias incoherentes.' }
    return $script:CheckOk
}
function Replace-ConnectionFile([string]$Candidate, [string]$Destination) {
    & $script:OriginalReplace $Candidate $Destination
    if ($script:FailReplace) { throw 'Fallo inyectado despues de reemplazar.' }
}
function Write-ConnectionAtomic([string]$Path, [byte[]]$Bytes, [string]$TemporaryDirectory) {
    & $script:OriginalAtomic $Path $Bytes $TemporaryDirectory
    if ($script:FailMetadata -and [IO.Path]::GetFileName($Path) -eq 'installation.json') {
        $script:FailMetadata = $false
        throw 'Fallo inyectado despues de escribir metadatos.'
    }
}
function Assert-Test([bool]$Condition, [string]$Label) { if (-not $Condition) { throw "FALLO: $Label" } }
function Expect-Failure([scriptblock]$Action) {
    $failed = $false
    try { & $Action | Out-Null } catch { $failed = $true }
    Assert-Test $failed 'Se acepto una entrada no permitida.'
}
function Write-Json([string]$Path, $Data) { [IO.File]::WriteAllText($Path, ($Data | ConvertTo-Json -Depth 20)) }
function Fixture {
    $script:Captured.Clear(); $script:AclCalls.Clear()
    $script:CheckCalls=0; $script:CheckOk=$true; $script:Stopped=$true; $script:FailReplace=$false; $script:FailMetadata=$false
    $root = Join-Path $script:TestRoot ([guid]::NewGuid().ToString('N'))
    $config = Join-Path $root 'config'
    $reference = Join-Path $root 'referencia'
    $script:NewReference = Join-Path $root 'nueva-referencia'
    New-Item -ItemType Directory -Path $config,$reference,$script:NewReference,(Join-Path $root 'releases\activa') -Force | Out-Null
    $script:ExpectedExe = Join-Path $root 'releases\activa\Contabilidad27.exe'
    [IO.File]::WriteAllBytes($script:ExpectedExe, [byte[]]@(1,2,3))
    $script:NewAdd = Join-Path $root 'nuevo.ADD'
    [IO.File]::WriteAllText($script:NewAdd,'solo-fixture')
    $secret = [pscustomobject]@{ ADS_DATA_SOURCE=(Join-Path $root 'anterior.ADD'); ADS_USER_ID='usuario-anterior-no-publicar';
        ADS_PASSWORD='clave-anterior-no-publicar'; ADS_PROVIDER='Advantage.OLEDB.1'; ADS_SERVER_TYPE='ADS_REMOTE_SERVER';
        ADS_ODBC_DRIVER='Advantage StreamlineSQL ODBC'; ADS_REFERENCE_ROOT=$reference; ADS_AUDIT_DATA_SOURCE=$reference }
    Write-ConnectionSecret (Join-Path $config 'credentials.dpapi') $secret
    $settings = [ordered]@{ schemaVersion=1; port=19443; bindHost='127.0.0.1'; logDirectory=(Join-Path $root 'logs');
        credentialsFile='credentials.dpapi'; fortunerApiUrl='http://127.0.0.1:8004'; sessionTtlSeconds=1200; cookieSecure=$true }
    Write-Json (Join-Path $config 'service.json') $settings
    Write-Json (Join-Path $root 'installation.json') @{ product='CONTABDSI27'; version='version-activa'; executable=$script:ExpectedExe;
        configuration=(Join-Path $config 'service.json'); account=[Security.Principal.WindowsIdentity]::GetCurrent().Name; state='installed-stopped' }
    return $root
}
function Check-Clean([string]$Root) {
    Assert-Test (@(Get-ChildItem -LiteralPath (Join-Path $Root 'config') -Force | Where-Object { $_.Name -match 'candidate|\.tmp$|connection-change' }).Count -eq 0) 'Temporales sin limpiar'
    $output = $script:Captured -join "`n"
    foreach ($secret in @('usuario-anterior-no-publicar','clave-anterior-no-publicar','usuario-candidato-no-publicar','clave-candidata-no-publicar')) {
        Assert-Test (-not $output.Contains($secret)) 'Se imprimio un secreto'
    }
}
function Hash([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }

$script:TestRoot = Join-Path ([IO.Path]::GetTempPath()) ('contabilidad-connection-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $script:TestRoot | Out-Null
$passed = 0
try {
    $root = Fixture
    $metadataPath = Join-Path $root 'installation.json'
    $installation = Get-Content $metadataPath -Raw | ConvertFrom-Json
    $installation.product='INVEDSI27'; Write-Json $metadataPath $installation
    Assert-Test ((Invoke-AdsReconfiguration $root) -eq 1) 'Producto incorrecto'
    Assert-Test ($script:CheckCalls -eq 0) 'Se valido otro producto'; $passed++

    foreach ($file in @('releases\activa\Contabilidad27.exe','config\service.json')) {
        $root = Fixture; Remove-Item -LiteralPath (Join-Path $root $file)
        Assert-Test ((Invoke-AdsReconfiguration $root) -eq 1) 'Archivo obligatorio ausente'; $passed++
    }
    $root=Fixture
    Expect-Failure { Get-ConnectionInstallation '' }; Expect-Failure { Get-ConnectionInstallation 'C:\' }
    foreach ($path in @('..\credentials.dpapi','C:\otro\credentials.dpapi','sub\..\credentials.dpapi')) {
        Expect-Failure { Resolve-ConnectionChild (Join-Path $root 'config') $path -RelativeOnly }
    }; $passed++

    $root=Fixture
    Expect-Failure { Resolve-ConnectionDataPath (Join-Path $root 'ausente.add') }
    $text=Join-Path $root 'incorrecto.txt'; [IO.File]::WriteAllText($text,'x')
    Expect-Failure { Resolve-ConnectionDataPath $text }
    Assert-Test ((Resolve-ConnectionDataPath $script:NewAdd) -eq $script:NewAdd) 'Extension ADD mayuscula'
    foreach ($value in @('a;b', "a`nb", "a`rb")) { Expect-Failure { Assert-ConnectionValue $value } }; $passed++

    $root=Fixture
    $before=@{}; foreach($file in Get-ChildItem $root -Recurse -File){$before[$file.FullName]=Hash $file.FullName}
    Assert-Test ((Invoke-AdsReconfiguration $root -ReadOnly) -eq 0) 'Plan fallo'
    foreach($file in Get-ChildItem $root -Recurse -File){Assert-Test ($before[$file.FullName] -eq (Hash $file.FullName)) 'Plan modifico archivos'}
    Assert-Test ($script:CheckCalls -eq 0) 'Plan ejecuto check'; Check-Clean $root; $passed++

    $root=Fixture; $script:Stopped=$false
    Assert-Test ((Invoke-AdsReconfiguration $root) -eq 1) 'No rechazo puerto ocupado'
    Assert-Test ($script:CheckCalls -eq 0) 'Valido con modulo activo'; Check-Clean $root; $passed++

    $root=Fixture; $secretPath=Join-Path $root 'config\credentials.dpapi'; $configPath=Join-Path $root 'config\service.json'
    $configHash=Hash $configPath; $exeHash=Hash $script:ExpectedExe
    Assert-Test ((Invoke-AdsReconfiguration $root) -eq 0) 'Cambio valido fallo'
    $decoded=Read-ConnectionSecret $secretPath
    Assert-Test ($decoded.ADS_DATA_SOURCE -eq $script:NewAdd) 'No activo el ADD nuevo'
    Assert-Test ($decoded.ADS_PASSWORD -eq 'clave-candidata-no-publicar') 'No activo la clave'
    Assert-Test ((Hash $configPath) -eq $configHash) 'Reescribio service.json'
    Assert-Test ((Hash $script:ExpectedExe) -eq $exeHash) 'Cambio el ejecutable'
    $metadata=Get-Content (Join-Path $root 'installation.json') -Raw | ConvertFrom-Json
    Assert-Test ($metadata.version -eq 'version-activa' -and !!$metadata.connectionUpdatedAt) 'Cambio version o no registro fecha'
    Assert-Test (-not ([IO.File]::ReadAllText((Join-Path $root 'installation.json'))).Contains($script:NewAdd)) 'Ruta ADD en metadatos'
    Assert-Test (@(Get-ChildItem (Join-Path $root 'backups') -Recurse -Filter CAMBIO.txt).Count -eq 1) 'No creo respaldo'
    Check-Clean $root; $passed++
    Assert-Test ((Invoke-AdsReconfiguration $root) -eq 0) 'Repeticion fallo'; Check-Clean $root; $passed++

    foreach ($failure in @('check','replace','metadata')) {
        $root=Fixture; $secretPath=Join-Path $root 'config\credentials.dpapi'; $metadataPath=Join-Path $root 'installation.json'
        $oldHash=Hash $secretPath; $oldMetadata=Hash $metadataPath
        if($failure -eq 'check'){$script:CheckOk=$false}
        if($failure -eq 'replace'){$script:FailReplace=$true}
        if($failure -eq 'metadata'){$script:FailMetadata=$true}
        Assert-Test ((Invoke-AdsReconfiguration $root) -eq 1) 'Fallo inyectado no rechazo cambio'
        Assert-Test ((Hash $secretPath) -eq $oldHash) 'No restauro credenciales byte a byte'
        Assert-Test ((Hash $metadataPath) -eq $oldMetadata) 'No restauro metadatos'
        Check-Clean $root; $passed++
    }

    # Probar captura real: Enter conserva referencias/secretos sin mostrarlos;
    # ruta inexistente se rechaza ANTES de pedir usuario o clave.
    $root=Fixture; $current=Read-ConnectionSecret (Join-Path $root 'config\credentials.dpapi')
    $current.ADS_DATA_SOURCE=$script:NewAdd
    $script:PromptCalls=0; $script:InvalidInput=$false
    function Read-Host { param($Prompt,[switch]$AsSecureString)
        $script:PromptCalls++
        if($AsSecureString){return (New-Object Security.SecureString)}
        if($script:InvalidInput){return (Join-Path $script:TestRoot 'no-existe.add')}
        return ''
    }
    $same = & $script:OriginalReadNew $current
    Assert-Test ($same.ADS_USER_ID -eq $current.ADS_USER_ID -and $same.ADS_PASSWORD -eq $current.ADS_PASSWORD) 'Enter no conserva secretos'
    Assert-Test ($same.ADS_AUDIT_DATA_SOURCE -eq $current.ADS_AUDIT_DATA_SOURCE) 'Enter no conserva auditoria'; $passed++
    $script:InvalidInput=$true; $script:PromptCalls=0
    Expect-Failure { & $script:OriginalReadNew $current }
    Assert-Test ($script:PromptCalls -eq 1) 'Solicito secretos antes de validar ADD'; $passed++

    function Read-Host { param($Prompt,[switch]$AsSecureString)
        if($AsSecureString){return (New-Object Security.SecureString)}
        if($Prompt.StartsWith('Carpeta de catalogos')){return $script:NewReference}
        return ''
    }
    $changed = & $script:OriginalReadNew $current
    Assert-Test ($changed.ADS_REFERENCE_ROOT -eq $script:NewReference -and $changed.ADS_AUDIT_DATA_SOURCE -eq $script:NewReference) 'Cambio de referencia no sincroniza auditoria'; $passed++

    # Proceso de prueba real, no un servicio. Verifica argumentos y que stdout
    # y stderr quedan capturados en memoria, incluso si incluyen secretos.
    $root=Fixture
    $probe=Join-Path $root 'check-probe.exe'
    Add-Type -OutputAssembly $probe -OutputType ConsoleApplication -TypeDefinition @'
using System;
public class CheckProbe {
 public static int Main(string[] args) {
  Console.WriteLine("clave-candidata-no-publicar");
  Console.Error.WriteLine("usuario-candidato-no-publicar");
  if(args.Length != 3 || args[0] != "check" || args[1] != "--config") return 9;
  return args[2].EndsWith("fallo.json") ? 1 : 0;
 }
}
'@
    Assert-Test (& $script:RealCheck $probe (Join-Path $root 'config\service.json')) 'No acepta check exitoso'
    Assert-Test (-not (& $script:RealCheck $probe (Join-Path $root 'config\fallo.json'))) 'Acepta check fallido'
    Check-Clean $root; $passed++

    $installer=Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'instalar.ps1') -Raw
    Assert-Test ($installer.Contains('[switch]$ReconfigureConnection')) 'Falta opcion recuperacion'
    Assert-Test ($installer.Contains('& (Join-Path $PSScriptRoot ''configurar-conexion.ps1'') -InstallRoot $InstallRoot')) 'No comparte implementacion'
    $builder=Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'build-release.ps1') -Raw
    Assert-Test ($builder.Contains('Configurar-Conexion-Contabilidad27.bat') -and $builder.Contains('configurar-conexion.ps1')) 'Builder no empaqueta utilidad'
    $config=Get-Content -LiteralPath (Join-Path (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))) 'compilacion.json') -Raw | ConvertFrom-Json
    Assert-Test ('contabilidad/deployment/configurar-conexion.ps1' -in $config.extra_files) 'Compilacion no incluye utilidad'; $passed++
    Write-Output "PASS: $passed casos de reconfiguracion, DPAPI local, rollback, limpieza y empaquetado. Sin cambios reales."
} finally {
    # Solo borrar el sandbox creado por este test, verificando el destino exacto.
    $target=[IO.Path]::GetFullPath($script:TestRoot)
    $temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if($target.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($target).StartsWith('contabilidad-connection-test-')){
        Remove-Item -LiteralPath $target -Recurse -Force
    }
}
