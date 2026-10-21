param([string]$InstallRoot = $PSScriptRoot, [switch]$Plan)
# Utilidad instalada: no depende de fuentes, Python del sistema ni del ZIP.
if ($PSVersionTable.PSEdition -eq 'Desktop') {
    $env:PSModulePath = "$PSHOME\Modules;$env:ProgramFiles\WindowsPowerShell\Modules;$env:PSModulePath"
}
$ErrorActionPreference = 'Stop'

function Assert-ConnectionPlatform {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or
        -not [Environment]::Is64BitOperatingSystem -or -not [Environment]::Is64BitProcess) {
        throw 'Se requiere Windows PowerShell de 64 bits.'
    }
}
function Assert-NoConnectionReparse([string]$Path) {
    $cursor = $Path
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw 'No se admiten enlaces o redirecciones en las rutas de instalacion.'
            }
        }
        $parent = Split-Path -Parent $cursor
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
}
function Resolve-ConnectionChild([string]$Base, [string]$Value, [switch]$RelativeOnly) {
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -match '["\r\n]' -or
        ($RelativeOnly -and [IO.Path]::IsPathRooted($Value)) -or
        $Value -match '(^|[\\/])\.\.([\\/]|$)') { throw 'Ruta de configuracion no permitida.' }
    $resolved = if ([IO.Path]::IsPathRooted($Value)) { [IO.Path]::GetFullPath($Value) }
                else { [IO.Path]::GetFullPath((Join-Path $Base $Value)) }
    if (-not $resolved.StartsWith($Base.TrimEnd('\','/') + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'La ruta sale de la carpeta autorizada.'
    }
    Assert-NoConnectionReparse $resolved
    return $resolved
}
function Get-ConnectionInstallation([string]$Root, [switch]$MetadataOnly) {
    if ([string]::IsNullOrWhiteSpace($Root)) { throw 'Indique la carpeta de una instalacion existente.' }
    $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\','/')
    if ($rootPath -eq [IO.Path]::GetPathRoot($rootPath).TrimEnd('\','/') -or $rootPath -match '["\r\n]') {
        throw 'No se admite una raiz de unidad.'
    }
    Assert-NoConnectionReparse $rootPath
    $installationPath = Join-Path $rootPath 'installation.json'
    $installation = Get-Content -LiteralPath $installationPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($installation.product -ne 'CONTABDSI27' -or -not $installation.version) {
        throw 'La instalacion no corresponde a CONTABDSI27.'
    }
    # El primer paso no lee config: un usuario sin elevar no tiene permiso.
    if ($MetadataOnly) { return [pscustomobject]@{ Root=$rootPath; Installation=$installation } }
    $exe = Resolve-ConnectionChild $rootPath ([string]$installation.executable)
    $config = Resolve-ConnectionChild $rootPath ([string]$installation.configuration)
    $directory = Join-Path $rootPath 'config'
    if ($config -ne (Join-Path $directory 'service.json') -or
        [IO.Path]::GetFileName($exe) -ne 'Contabilidad27.exe' -or
        -not (Test-Path -LiteralPath $exe -PathType Leaf) -or
        -not (Test-Path -LiteralPath $config -PathType Leaf)) { throw 'La instalacion esta incompleta o sus rutas no son validas.' }
    $settings = Get-Content -LiteralPath $config -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($settings.schemaVersion -ne 1 -or [int]$settings.port -lt 1 -or [int]$settings.port -gt 65535) {
        throw 'La configuracion del servicio no es compatible.'
    }
    $secret = Resolve-ConnectionChild $directory ([string]$settings.credentialsFile) -RelativeOnly
    if (-not (Test-Path -LiteralPath $secret -PathType Leaf)) { throw 'No existen credenciales de la instalacion.' }
    return [pscustomobject]@{ Root=$rootPath; InstallationPath=$installationPath; Installation=$installation;
        Executable=$exe; Config=$config; Directory=$directory; Settings=$settings; Secret=$secret }
}
function Test-ConnectionAdministrator {
    return (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
function Test-ConnectionStopped([int]$Port) {
    # No usar SilentlyContinue: un fallo del diagnostico no equivale a detenido.
    return -not @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq $Port }).Count
}
function Assert-ConnectionStopped([int]$Port) {
    if (-not (Test-ConnectionStopped $Port)) {
        throw "Contabilidad esta activa en el puerto $Port. Cierre Fortuner y el servicio del modulo antes de cambiar la conexion."
    }
}
function Get-ConnectionAllowedSids([string]$Account) {
    if (-not $Account) { throw 'Falta la cuenta Windows de la instalacion.' }
    $identity = New-Object Security.Principal.NTAccount($Account)
    $sid = $identity.Translate([Security.Principal.SecurityIdentifier]).Value
    if ($sid -in @('S-1-1-0','S-1-5-11','S-1-5-32-545')) { throw 'La cuenta registrada no puede ser un grupo de acceso general.' }
    return @('S-1-5-18','S-1-5-32-544',$sid) | Select-Object -Unique
}
function Assert-ConnectionAcl([string]$Path, [string[]]$Allowed) {
    $acl = Get-Acl -LiteralPath $Path
    foreach ($rule in $acl.Access) {
        $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
        if ($rule.AccessControlType -eq 'Allow' -and $sid -notin $Allowed) {
            throw 'Los permisos de configuracion no son restrictivos. Solicite su revision al administrador.'
        }
    }
}
function Set-ConnectionBackupAcl([string]$Directory, [string[]]$Allowed) {
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in $Allowed) {
        $rights = if ($sid -in @('S-1-5-18','S-1-5-32-544')) { 'FullControl' } else { 'ReadAndExecute' }
        $identity = New-Object Security.Principal.SecurityIdentifier($sid)
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity, $rights, 'ContainerInherit, ObjectInherit', 'None', 'Allow')))
    }
    Set-Acl -LiteralPath $Directory -AclObject $acl
}
function Read-ConnectionSecret([string]$Path) {
    $clear = $null; $json = $null
    try {
        Add-Type -AssemblyName System.Security
        $clear = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($Path), $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
        $json = [Text.Encoding]::UTF8.GetString($clear)
        $data = $json | ConvertFrom-Json
        foreach ($key in @('ADS_DATA_SOURCE','ADS_USER_ID','ADS_PASSWORD')) {
            if ([string]::IsNullOrWhiteSpace([string]$data.$key)) { throw 'La conexion protegida esta incompleta.' }
        }
        return $data
    } finally {
        if ($clear) { [Array]::Clear($clear, 0, $clear.Length) }
        $json = $null
    }
}
function Write-ConnectionSecret([string]$Path, $Data) {
    $clear = $null; $json = $null
    try {
        $json = $Data | ConvertTo-Json -Depth 20 -Compress
        $clear = [Text.Encoding]::UTF8.GetBytes($json)
        $protected = [Security.Cryptography.ProtectedData]::Protect($clear, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
        [IO.File]::WriteAllBytes($Path, $protected)
    } finally {
        if ($clear) { [Array]::Clear($clear, 0, $clear.Length) }
        $json = $null
    }
}
function Assert-ConnectionValue([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -match '[;\r\n]') { throw 'La conexion contiene valores vacios o caracteres no admitidos.' }
}
function Resolve-ConnectionDataPath([string]$Value, [switch]$Directory) {
    Assert-ConnectionValue $Value
    $path = [IO.Path]::GetFullPath($Value.Trim().Trim('"'))
    if ($Directory) {
        if (-not (Test-Path -LiteralPath $path -PathType Container)) { throw 'La carpeta de referencia no existe.' }
    } elseif ([IO.Path]::GetExtension($path) -ine '.add' -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw 'El diccionario indicado no existe o no es un archivo ADD.'
    }
    return $path
}
function Read-ConnectionDefault([string]$Label, [string]$Default) {
    $value = Read-Host "$Label [$Default]"
    if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
    return $value.Trim()
}
function Read-ConnectionHidden([string]$Label, [string]$Default) {
    $secret = $null; $pointer = [IntPtr]::Zero
    try {
        $secret = Read-Host "$Label [Enter conserva el actual]" -AsSecureString
        if ($secret.Length -eq 0) { return $Default }
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally {
        if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
        if ($secret) { $secret.Dispose() }
    }
}
function Read-NewConnection($Current) {
    $candidate = ($Current | ConvertTo-Json -Depth 20) | ConvertFrom-Json
    # Resolver las rutas antes de solicitar datos sensibles.
    $source = Resolve-ConnectionDataPath (Read-ConnectionDefault 'Ruta completa del diccionario Advantage (.ADD)' $Current.ADS_DATA_SOURCE)
    $oldReference = if ($Current.ADS_REFERENCE_ROOT) { [string]$Current.ADS_REFERENCE_ROOT }
                    elseif ($Current.ADS_AUDIT_DATA_SOURCE) { [string]$Current.ADS_AUDIT_DATA_SOURCE } else { 'C:\VISADS' }
    $reference = Resolve-ConnectionDataPath (Read-ConnectionDefault 'Carpeta de catalogos y VISAUDI' $oldReference) -Directory
    $auditDefault = if ($reference -ne $oldReference -or -not $Current.ADS_AUDIT_DATA_SOURCE) { $reference } else { [string]$Current.ADS_AUDIT_DATA_SOURCE }
    $audit = Resolve-ConnectionDataPath (Read-ConnectionDefault 'Carpeta VISAUDI (si es diferente)' $auditDefault) -Directory
    $provider = Read-ConnectionDefault 'Proveedor OLE DB' $(if ($Current.ADS_PROVIDER) { $Current.ADS_PROVIDER } else { 'Advantage.OLEDB.1' })
    $server = Read-ConnectionDefault 'Tipo de servidor Advantage' $(if ($Current.ADS_SERVER_TYPE) { $Current.ADS_SERVER_TYPE } else { 'ADS_REMOTE_SERVER' })
    $driver = Read-ConnectionDefault 'Controlador ODBC' $(if ($Current.ADS_ODBC_DRIVER) { $Current.ADS_ODBC_DRIVER } else { 'Advantage StreamlineSQL ODBC' })
    if ($provider -notmatch '^Advantage\.OLEDB\.\d+$' -or $server -notin @('ADS_REMOTE_SERVER','ADS_LOCAL_SERVER','ADS_INTERNET_SERVER')) {
        throw 'El proveedor o tipo de servidor Advantage no es valido.'
    }
    $user = Read-ConnectionHidden 'Usuario Advantage (oculto)' $Current.ADS_USER_ID
    $password = Read-ConnectionHidden 'Nueva clave Advantage' $Current.ADS_PASSWORD
    $values = @{ ADS_DATA_SOURCE=$source; ADS_REFERENCE_ROOT=$reference; ADS_AUDIT_DATA_SOURCE=$audit;
        ADS_PROVIDER=$provider; ADS_SERVER_TYPE=$server; ADS_ODBC_DRIVER=$driver; ADS_USER_ID=$user; ADS_PASSWORD=$password }
    try {
        foreach ($key in $values.Keys) {
            Assert-ConnectionValue ([string]$values[$key])
            $candidate | Add-Member -MemberType NoteProperty -Name $key -Value $values[$key] -Force
        }
        return $candidate
    } finally { $values.Clear(); $user = $null; $password = $null }
}
function Invoke-ConnectionCheck([string]$Executable, [string]$Configuration) {
    # Capturar ambos canales en memoria. No crear archivos de salida con una
    # posible excepcion COM ni mostrarla. El proceso es el binario instalado.
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $Executable
    $info.Arguments = 'check --config "' + $Configuration + '"'
    $info.WorkingDirectory = Split-Path -Parent $Executable
    $info.UseShellExecute = $false; $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $info
    $output = $null; $errorOutput = $null
    try {
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        $output = $stdout.GetAwaiter().GetResult(); $errorOutput = $stderr.GetAwaiter().GetResult()
        return $process.ExitCode -eq 0
    } finally { $output=$null; $errorOutput=$null; $stdout=$null; $stderr=$null; $process.Dispose() }
}
function Replace-ConnectionFile([string]$Candidate, [string]$Destination) {
    [IO.File]::Replace($Candidate, $Destination, [NullString]::Value)
}
function Write-ConnectionAtomic([string]$Path, [byte[]]$Bytes, [string]$TemporaryDirectory) {
    $temporary = Join-Path $TemporaryDirectory ([guid]::NewGuid().ToString('N') + '.restore.tmp')
    try {
        [IO.File]::WriteAllBytes($temporary, $Bytes)
        if (Test-Path -LiteralPath $Path -PathType Leaf) { [IO.File]::Replace($temporary, $Path, [NullString]::Value) }
        else { [IO.File]::Move($temporary, $Path) }
    } finally { if (Test-Path -LiteralPath $temporary -PathType Leaf) { Remove-Item -LiteralPath $temporary -Force } }
}
function Get-ConnectionHash([byte[]]$Bytes) {
    $hash = [Security.Cryptography.SHA256]::Create()
    try { return [Convert]::ToBase64String($hash.ComputeHash($Bytes)) } finally { $hash.Dispose() }
}
function Invoke-AdsReconfiguration([string]$Root, [switch]$ReadOnly) {
    $stage = 'identificacion de instalacion'; $temporary = @(); $current = $null; $candidate = $null
    $lock = $null; $lockPath = $null; $activationAttempted = $false; $metadataTouched = $false
    $completed = $false; $backup = $null; $restored = $true
    try {
        Assert-ConnectionPlatform
        $context = Get-ConnectionInstallation $Root -MetadataOnly
        $stage = 'elevacion'
        if (-not (Test-ConnectionAdministrator)) {
            $arguments = @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"'),'-InstallRoot',('"' + $context.Root + '"'))
            if ($ReadOnly) { $arguments += '-Plan' }
            # Asistente visible para las preguntas; no es un servicio oculto.
            $child = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList $arguments -Verb RunAs -WindowStyle Normal -Wait -PassThru
            return $child.ExitCode
        }
        $stage = 'identificacion de instalacion'
        $context = Get-ConnectionInstallation $context.Root
        $stage = 'permisos'
        $allowed = @(Get-ConnectionAllowedSids ([string]$context.Installation.account))
        Assert-ConnectionAcl $context.Directory $allowed
        Assert-ConnectionAcl $context.Secret $allowed
        $stage = 'lectura protegida'
        $current = Read-ConnectionSecret $context.Secret
        if ($ReadOnly) {
            Write-Host 'Producto: CONTABDSI27'
            Write-Host "Instalacion: $($context.Root)"
            Write-Host "Version activa: $($context.Installation.version)"
            Write-Host "Puerto: $($context.Settings.port)"
            Write-Host "Diccionario actual: $($current.ADS_DATA_SOURCE)"
            Write-Host "Ejecutable de validacion: $($context.Executable)"
            Write-Host "Modulo detenido: $(Test-ConnectionStopped ([int]$context.Settings.port))"
            return 0
        }
        $stage = 'servicio detenido'
        Assert-ConnectionStopped ([int]$context.Settings.port)
        $lockPath = Join-Path $context.Directory '.connection-change.lock'
        Assert-NoConnectionReparse $lockPath
        $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        $current = Read-ConnectionSecret $context.Secret
        $oldBytes = [IO.File]::ReadAllBytes($context.Secret)
        $installationBytes = [IO.File]::ReadAllBytes($context.InstallationPath)
        $serviceBytes = [IO.File]::ReadAllBytes($context.Config)
        $stage = 'captura y validacion de datos'
        $candidate = Read-NewConnection $current
        $guid = [guid]::NewGuid().ToString('N')
        $secretCandidate = Join-Path $context.Directory "credentials.$guid.candidate.dpapi"
        $serviceCandidate = Join-Path $context.Directory "service.$guid.candidate.json"
        $temporary += @($secretCandidate, $serviceCandidate)
        Write-ConnectionSecret $secretCandidate $candidate
        Assert-ConnectionAcl $secretCandidate $allowed
        $settingsCandidate = ($context.Settings | ConvertTo-Json -Depth 30) | ConvertFrom-Json
        $settingsCandidate.credentialsFile = [IO.Path]::GetFileName($secretCandidate)
        [IO.File]::WriteAllText($serviceCandidate, ($settingsCandidate | ConvertTo-Json -Depth 30), (New-Object Text.UTF8Encoding($false)))
        $stage = 'comprobacion del ejecutable instalado (OLE DB y ODBC)'
        Write-Host 'Comprobando la nueva conexion sin iniciar el servicio...'
        if (-not (Invoke-ConnectionCheck $context.Executable $serviceCandidate)) { throw 'La conexion candidata no supero la comprobacion.' }
        $stage = 'comprobacion previa a la activacion'
        Assert-ConnectionStopped ([int]$context.Settings.port)
        foreach ($pair in @(@($context.Secret,$oldBytes),@($context.Config,$serviceBytes),@($context.InstallationPath,$installationBytes))) {
            if ((Get-ConnectionHash ([IO.File]::ReadAllBytes($pair[0]))) -ne (Get-ConnectionHash $pair[1])) {
                throw 'La instalacion cambio durante la validacion.'
            }
        }
        $stage = 'respaldo'
        $backup = Resolve-ConnectionChild $context.Root ('backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-conexion-' + $guid.Substring(0,8))
        New-Item -ItemType Directory -Path $backup | Out-Null
        Set-ConnectionBackupAcl $backup $allowed
        Copy-Item -LiteralPath $context.Secret -Destination (Join-Path $backup 'credentials.dpapi')
        Copy-Item -LiteralPath $context.Config -Destination (Join-Path $backup 'service.json')
        Copy-Item -LiteralPath $context.InstallationPath -Destination (Join-Path $backup 'installation.json')
        $note = "Producto: CONTABDSI27`r`nVersion: $($context.Installation.version)`r`nFecha UTC: $([DateTime]::UtcNow.ToString('o'))`r`nCuenta Windows: $([Security.Principal.WindowsIdentity]::GetCurrent().Name)`r`n"
        [IO.File]::WriteAllText((Join-Path $backup 'CAMBIO.txt'), $note, (New-Object Text.UTF8Encoding($false)))
        Assert-ConnectionAcl $backup $allowed
        $stage = 'sustitucion atomica'
        $candidateHash = Get-ConnectionHash ([IO.File]::ReadAllBytes($secretCandidate))
        $activationAttempted = $true
        Replace-ConnectionFile $secretCandidate $context.Secret
        if (-not (Test-Path -LiteralPath $context.Secret -PathType Leaf) -or (Get-Item -LiteralPath $context.Secret).Length -eq 0) { throw 'No se pudo confirmar el archivo activo.' }
        if ((Get-ConnectionHash ([IO.File]::ReadAllBytes($context.Secret))) -ne $candidateHash) { throw 'El archivo activo no coincide con el validado.' }
        Assert-ConnectionAcl $context.Secret $allowed
        $stage = 'metadatos'
        $metadata = ($context.Installation | ConvertTo-Json -Depth 30) | ConvertFrom-Json
        $metadata | Add-Member -MemberType NoteProperty -Name 'connectionUpdatedAt' -Value ([DateTime]::UtcNow.ToString('o')) -Force
        $metadataTouched = $true
        Write-ConnectionAtomic $context.InstallationPath ([Text.Encoding]::UTF8.GetBytes(($metadata | ConvertTo-Json -Depth 30))) $context.Directory
        $completed = $true
        Write-Host 'CONEXION ACTUALIZADA CORRECTAMENTE' -ForegroundColor Green
        Write-Host 'Producto: CONTABDSI27'
        Write-Host "Diccionario: $($candidate.ADS_DATA_SOURCE)"
        Write-Host "Respaldo: $backup"
        Write-Host 'Abra nuevamente Fortuner27 para iniciar el modulo.'
        return 0
    } catch {
        # Nunca propagar mensajes de COM, datos ingresados ni cadenas de conexion.
        if ($activationAttempted -and -not $completed) {
            try {
                Write-ConnectionAtomic $context.Secret $oldBytes $context.Directory
                if ($metadataTouched) { Write-ConnectionAtomic $context.InstallationPath $installationBytes $context.Directory }
                if ((Get-ConnectionHash ([IO.File]::ReadAllBytes($context.Secret))) -ne (Get-ConnectionHash $oldBytes)) { throw 'La restauracion no coincide con el original.' }
                Assert-ConnectionAcl $context.Secret $allowed
            } catch { $restored = $false }
        }
        Write-Host "ERROR en la etapa: $stage." -ForegroundColor Red
        switch ($stage) {
            'identificacion de instalacion' { Write-Host 'Verifique la carpeta instalada de CONTABDSI27, installation.json, el ejecutable y config\service.json.' }
            'elevacion' { Write-Host 'No se obtuvo permiso administrativo. Acepte la solicitud de Windows o consulte al administrador.' }
            'permisos' { Write-Host 'Revise que config este protegida para SYSTEM, administradores y la cuenta registrada de Fortuner.' }
            'captura y validacion de datos' { Write-Host 'Revise que el ADD y las carpetas existan y que los datos ingresados sean validos.' }
            'comprobacion del ejecutable instalado (OLE DB y ODBC)' { Write-Host 'La conexion no fue aceptada. Verifique acceso al diccionario, credenciales y ambos conectores Advantage de 64 bits.' }
        }
        if ($stage -eq 'servicio detenido') { Write-Host "Contabilidad esta activa en el puerto $($context.Settings.port) o no se pudo verificar. Cierre Fortuner y el servicio antes de continuar." }
        if ($restored) { Write-Host 'La configuracion anterior sigue activa o fue restaurada. No se inicio el servicio.' }
        else { Write-Host "No se pudo confirmar la restauracion. No inicie el modulo; solicite soporte con el respaldo: $backup" -ForegroundColor Red }
        return 1
    } finally {
        foreach ($path in $temporary) {
            if (Test-Path -LiteralPath $path -PathType Leaf) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
        }
        if ($lock) {
            $lock.Dispose()
            Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
        }
        foreach ($data in @($current,$candidate)) {
            if ($data) { foreach ($key in @('ADS_PASSWORD','ADS_USER_ID')) { if ($data.PSObject.Properties[$key]) { $data.$key = $null } } }
        }
        $current=$null; $candidate=$null
    }
}

exit (Invoke-AdsReconfiguration -Root $InstallRoot -ReadOnly:$Plan)
