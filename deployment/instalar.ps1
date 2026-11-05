param(
    [string]$FortunerRoot = '',
    [string]$InstallRoot = '',
    [string]$ModulesConfiguration = '',
    [string]$FortunerAccount = '',
    [ValidateRange(1,65535)][int]$Port = 8443,
    [string]$BindHost = '0.0.0.0',
    [switch]$NoFirewall,
    [switch]$Plan,
    [switch]$ReconfigureConnection
)
# Un BAT ejecutado desde PowerShell 7 puede heredar su ruta de modulos.
# Priorizar los modulos nativos evita cargar versiones incompatibles en 5.1.
if ($PSVersionTable.PSEdition -eq 'Desktop') { $env:PSModulePath = "$PSHOME\Modules;$env:ProgramFiles\WindowsPowerShell\Modules;$env:PSModulePath" }
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)

function Write-Utf8([string]$Path, [string]$Text) {
    $temporary = $Path + '.' + [guid]::NewGuid().ToString('N') + '.tmp'
    [IO.File]::WriteAllText($temporary, $Text, $script:utf8)
    if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($temporary, $Path, [NullString]::Value) }
    else { [IO.File]::Move($temporary, $Path) }
}
function Set-Property($Object, [string]$Name, $Value) {
    $Object | Add-Member -MemberType NoteProperty -Name $Name -Value $Value -Force
}
function Read-Default([string]$Label, [string]$Default) {
    $value = Read-Host "$Label [$Default]"
    if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
    return $value.Trim()
}
function Lock-Secrets([string]$Directory, [string]$Account) {
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $inherit = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    foreach ($sid in @('S-1-5-18','S-1-5-32-544')) {
        $identity = New-Object Security.Principal.SecurityIdentifier($sid)
        $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', $inherit, 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($Account, 'ReadAndExecute', $inherit, 'None', 'Allow')
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $Directory -AclObject $acl
}
function Hook-Text([string]$Original) {
    if ($Original.Contains('# BEGIN CONTABDSI27 INSTALLED')) { return $Original }
    # Se acepta la entrada portable actual de Fortuner. Una version distinta
    # falla antes de modificar su configuracion, en lugar de parchear a ciegas.
    $pattern = '(?m)^exit 0\s*$'
    if ([regex]::Matches($Original, $pattern).Count -ne 1 -or -not $Original.Contains('$configurationPath')) {
        throw 'La version de start-fortuner.ps1 no es compatible con este instalador.'
    }
    $hook = @'
# BEGIN CONTABDSI27 INSTALLED
& (Join-Path $PSScriptRoot 'fortuner-contabilidad.ps1') -ConfigurationPath $configurationPath
# END CONTABDSI27 INSTALLED
exit 0
'@
    return [regex]::Replace($Original, $pattern, $hook)
}

function Hook-CompiledText([string]$Original, [string]$ConfigurationPath) {
    if ($Original.Contains('# BEGIN CONTABDSI27 COMPILED')) { return $Original }
    $pattern = '(?m)^if \(-not \(Test-AppHealth\)\) \{\r?$'
    if ([regex]::Matches($Original, $pattern).Count -ne 1) {
        throw 'La version compilada de INICIAR.ps1 no es compatible con este instalador.'
    }
    $safeConfiguration = $ConfigurationPath.Replace("'", "''")
    $hook = @"
# BEGIN CONTABDSI27 COMPILED
& (Join-Path `$root 'fortuner-contabilidad.ps1') -ConfigurationPath '$safeConfiguration'
# END CONTABDSI27 COMPILED
if (-not (Test-AppHealth)) {
"@
    return [regex]::Replace($Original, $pattern, $hook)
}

try {
    if ($Plan -and $ReconfigureConnection) { throw 'No combine -Plan y -ReconfigureConnection. Use -Plan en configurar-conexion.ps1.' }
    if (-not [Environment]::Is64BitOperatingSystem -or -not [Environment]::Is64BitProcess) {
        throw 'Ejecute el instalador con Windows PowerShell de 64 bits.'
    }
    if (-not $InstallRoot) { $InstallRoot = Join-Path $env:ProgramData 'DSI\CONTABDSI27' }
    $InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
    $previousInstallationPath = Join-Path $InstallRoot 'installation.json'
    if (Test-Path -LiteralPath $previousInstallationPath -PathType Leaf) {
        $previousInstallation = Get-Content -Raw -LiteralPath $previousInstallationPath -Encoding UTF8 | ConvertFrom-Json
        if ($previousInstallation.product -ne 'CONTABDSI27') { throw 'La carpeta de destino pertenece a otro producto.' }
        if (-not $FortunerRoot) { $FortunerRoot = [string]$previousInstallation.fortunerRoot }
        if (-not $ModulesConfiguration) { $ModulesConfiguration = [string]$previousInstallation.modulesConfiguration }
        if (-not $FortunerAccount) { $FortunerAccount = [string]$previousInstallation.account }
        $previousSettingsPath = [string]$previousInstallation.configuration
        if (-not $ReconfigureConnection -and (Test-Path -LiteralPath $previousSettingsPath)) {
            $previousSettings = Get-Content -Raw -LiteralPath $previousSettingsPath -Encoding UTF8 | ConvertFrom-Json
            if (-not $PSBoundParameters.ContainsKey('Port')) { $Port = [int]$previousSettings.port }
            if (-not $PSBoundParameters.ContainsKey('BindHost')) { $BindHost = [string]$previousSettings.bindHost }
        }
    }
    $bindAddress = $null
    if (-not [Net.IPAddress]::TryParse($BindHost, [ref]$bindAddress) -or $bindAddress.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'BindHost debe ser una direccion IPv4 valida.' }
    if (-not $FortunerAccount) { $FortunerAccount = [Security.Principal.WindowsIdentity]::GetCurrent().Name }
    $manifestPath = Join-Path $PSScriptRoot 'manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Falta manifest.json. Use el paquete generado por Preparar-Instalador.bat.' }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.product -ne 'CONTABDSI27' -or $manifest.architecture -ne 'x64') { throw 'El paquete no corresponde a Contabilidad x64.' }
    if ($manifest.version -notmatch '^\d{8}-\d{6}$') { throw 'La version declarada por el paquete no es valida.' }
    $listedFiles = @($manifest.files | ForEach-Object { ([string]$_.path).Replace('\','/') })
    $extraFiles = @(Get-ChildItem -LiteralPath $PSScriptRoot -Recurse -File | Where-Object {
        $_.Name -ne 'manifest.json' -and $_.FullName.Substring($PSScriptRoot.Length + 1).Replace('\','/') -notin $listedFiles
    })
    if ($extraFiles.Count) { throw 'El paquete contiene archivos no declarados por su manifiesto.' }
    foreach ($entry in $manifest.files) {
        $file = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ([string]$entry.path)))
        if (-not $file.StartsWith($PSScriptRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta invalida en el manifiesto.' }
        if (-not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $entry.sha256) {
            throw "El paquete esta incompleto o fue modificado: $($entry.path)"
        }
    }
    # Recuperacion desde el paquete: delegar en la MISMA utilidad sin ejecutar
    # actualizacion, cambiar version, puerto, firewall ni configuracion Fortuner.
    if ($ReconfigureConnection -and (Test-Path -LiteralPath $previousInstallationPath -PathType Leaf)) {
        & (Join-Path $PSScriptRoot 'configurar-conexion.ps1') -InstallRoot $InstallRoot
        exit $LASTEXITCODE
    }
    if ($Plan) {
        [ordered]@{ product='CONTABDSI27'; version=$manifest.version; destination=$InstallRoot;
                    port=$Port; startsService=$false; createsStartupTask=$false;
                    fortunerStartsService=$true; packageVerified=$true } | ConvertTo-Json
        exit 0
    }
    $administrator = (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $administrator) {
        $forward = @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"'),'-Port', $Port.ToString(),'-BindHost', $BindHost)
        foreach ($pair in @(@('FortunerRoot',$FortunerRoot),@('InstallRoot',$InstallRoot),@('ModulesConfiguration',$ModulesConfiguration),@('FortunerAccount',$FortunerAccount))) {
            if ($pair[1]) {
                if ($pair[1] -match '["\r\n]') { throw 'Los parametros contienen caracteres invalidos.' }
                $forward += @('-' + $pair[0], ('"' + $pair[1] + '"'))
            }
        }
        if ($NoFirewall) { $forward += '-NoFirewall' }
        # Esta ventana es el asistente interactivo de instalacion; debe quedar
        # visible para ingresar la conexion. Los servicios se inician ocultos.
        $elevated = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Verb RunAs -ArgumentList $forward -WindowStyle Normal -Wait -PassThru
        exit $elevated.ExitCode
    }
    if (-not $FortunerRoot) {
        $candidates = @((Join-Path (Split-Path -Parent $PSScriptRoot) 'Fortuner27'), (Join-Path $env:ProgramData 'DSI\Fortuner27'), 'C:\DSI\Fortuner27')
        $FortunerRoot = $candidates | Where-Object {
            (Test-Path -LiteralPath (Join-Path $_ 'start-fortuner.ps1')) -or
            (Test-Path -LiteralPath (Join-Path $_ 'backend\Fortuner27.exe'))
        } | Select-Object -First 1
        if (-not $FortunerRoot) { $FortunerRoot = Read-Host 'Carpeta donde esta instalado Fortuner27' }
    }
    $FortunerRoot = [IO.Path]::GetFullPath($FortunerRoot)
    if ($InstallRoot -eq [IO.Path]::GetPathRoot($InstallRoot) -or $InstallRoot -eq $FortunerRoot -or $InstallRoot -eq $PSScriptRoot) { throw 'Seleccione una carpeta exclusiva para instalar Contabilidad.' }
    $portableStartPath = Join-Path $FortunerRoot 'start-fortuner.ps1'
    $compiledStartPath = Join-Path $FortunerRoot 'INICIAR.ps1'
    $compiledExecutable = Join-Path $FortunerRoot 'backend\Fortuner27.exe'
    $portableFortuner = Test-Path -LiteralPath $portableStartPath -PathType Leaf
    $compiledFortuner = (
        (Test-Path -LiteralPath $compiledStartPath -PathType Leaf) -and
        (Test-Path -LiteralPath $compiledExecutable -PathType Leaf)
    )
    if (-not $portableFortuner -and -not $compiledFortuner) {
        throw 'La carpeta no contiene una instalacion compatible de Fortuner27.'
    }
    $startPath = if ($portableFortuner) { $portableStartPath } else { $compiledStartPath }
    $startText = [IO.File]::ReadAllText($startPath)
    if (-not $ModulesConfiguration) {
        $ModulesConfiguration = if ($env:FORTUNER_MODULES_CONFIG) { $env:FORTUNER_MODULES_CONFIG } else { Join-Path $FortunerRoot 'Config\modules.json' }
    }
    $ModulesConfiguration = [IO.Path]::GetFullPath($ModulesConfiguration)
    if (-not (Test-Path -LiteralPath $ModulesConfiguration -PathType Leaf)) {
        throw "No se encontro la configuracion de modulos de Fortuner: $ModulesConfiguration"
    }
    if ($portableFortuner) {
        $newStartText = Hook-Text $startText
        $overrideLine = '$env:FORTUNER_MODULES_CONFIG = ' + "'" + $ModulesConfiguration.Replace("'", "''") + "' # CONTABDSI27 CONFIG PATH"
        if ($newStartText.Contains('# CONTABDSI27 CONFIG PATH')) {
            $newStartText = [regex]::Replace($newStartText, '(?m)^.*# CONTABDSI27 CONFIG PATH\s*$', [Text.RegularExpressions.MatchEvaluator]{ param($match) $overrideLine })
        } else {
            $configDeclaration = '(?m)^\$configurationPath = if \(\$env:FORTUNER_MODULES_CONFIG\) \{'
            if ([regex]::Matches($newStartText, $configDeclaration).Count -ne 1) { throw 'El iniciador Fortuner no permite configurar el archivo de modulos automaticamente.' }
            $newStartText = [regex]::Replace($newStartText, $configDeclaration, [Text.RegularExpressions.MatchEvaluator]{ param($match) $overrideLine + "`r`n" + $match.Value })
        }
    } else {
        $newStartText = Hook-CompiledText $startText $ModulesConfiguration
    }
    $modules = Get-Content -LiteralPath $ModulesConfiguration -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($modules.schemaVersion -ne 1) { throw 'La configuracion de Fortuner tiene una version incompatible.' }
    $selected = @($modules.modules | Where-Object { $_.id -eq 'contabilidad' })
    if ($selected.Count -ne 1) { throw 'Fortuner debe tener exactamente un modulo identificado como contabilidad.' }
    $others = @($modules.fortuner.frontend, $modules.fortuner.backend)
    foreach ($other in $modules.modules | Where-Object { $_.id -ne 'contabilidad' -and $_.status -eq 'active' }) {
        $others += @($other.services.frontend, $other.services.backend)
    }
    if (@($others | Where-Object { $_ -and [int]$_.port -eq $Port }).Count) { throw "Otro modulo de Fortuner tiene asignado el puerto $Port." }
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "El puerto $Port esta activo. Detenga Contabilidad desde su administrador antes de instalar o actualizar." }
    $frontendEnv = $null
    if ($portableFortuner) {
        Get-Command npm.cmd -ErrorAction Stop | Out-Null
        $frontendEnv = Join-Path $FortunerRoot 'Frontend\.env.local'
        if (-not (Test-Path -LiteralPath (Split-Path -Parent $frontendEnv) -PathType Container)) { throw 'Esta version del instalador requiere la carpeta Frontend de Fortuner27.' }
    }
    if (-not $FortunerAccount) { $FortunerAccount = [Security.Principal.WindowsIdentity]::GetCurrent().Name }
    $accountIdentity = New-Object Security.Principal.NTAccount($FortunerAccount)
    $accountIdentity.Translate([Security.Principal.SecurityIdentifier]) | Out-Null
    $oleDb = New-Object -ComObject ADODB.Connection
    [Runtime.InteropServices.Marshal]::FinalReleaseComObject($oleDb) | Out-Null
    $driver = 'Advantage StreamlineSQL ODBC'
    if (-not (Test-Path -LiteralPath "HKLM:\SOFTWARE\ODBC\ODBCINST.INI\$driver")) { throw 'Falta Advantage StreamlineSQL ODBC x64 en el servidor.' }
    $provider = [Type]::GetTypeFromProgID('Advantage.OLEDB.1')
    if (-not $provider) { throw 'Falta registrar Advantage OLE DB x64 en el servidor.' }
    $release = Join-Path $InstallRoot "releases\$($manifest.version)"
    $secretDirectory = Join-Path $InstallRoot 'config'
    $configPath = Join-Path $secretDirectory 'service.json'
    $secretPath = Join-Path $secretDirectory 'credentials.dpapi'
    if (Test-Path -LiteralPath $configPath -PathType Leaf) {
        $existingSettings = Get-Content -Raw -LiteralPath $configPath -Encoding UTF8 | ConvertFrom-Json
        $relativeSecret = [string]$existingSettings.credentialsFile
        if (-not $relativeSecret -or [IO.Path]::IsPathRooted($relativeSecret) -or $relativeSecret -match '(^|[\\/])\.\.([\\/]|$)') {
            throw 'La ruta de credenciales de la instalacion no es valida.'
        }
        $secretPath = [IO.Path]::GetFullPath((Join-Path $secretDirectory $relativeSecret))
        if (-not $secretPath.StartsWith($secretDirectory + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Las credenciales deben permanecer dentro de config.' }
    }
    $hasConfiguration = (Test-Path -LiteralPath $configPath) -and (Test-Path -LiteralPath $secretPath)
    if ((Test-Path -LiteralPath $previousInstallationPath -PathType Leaf) -and -not $hasConfiguration) {
        throw 'La instalacion existente tiene una configuracion incompleta. Restaure su respaldo antes de actualizar.'
    }
    $newSecrets = $null
    if (-not $hasConfiguration) {
        $source = Read-Host 'Ruta completa del diccionario Advantage (.add)'
        $source = $source.Trim().Trim('"')
        if (-not (Test-Path -LiteralPath $source -PathType Leaf) -or [IO.Path]::GetExtension($source) -ne '.add') { throw 'El diccionario Advantage indicado no existe o no es un archivo ADD.' }
        $user = Read-Host 'Usuario de Advantage'
        $password = Read-Host 'Clave de Advantage' -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
        try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
        $invalidConnection = @(@($source,$user,$plain) | Where-Object { $_ -match '[;\r\n]' })
        if (-not $user -or -not $plain -or $invalidConnection.Count) { throw 'Los datos de conexion estan incompletos o contienen caracteres no admitidos.' }
        $referenceRoot = Split-Path -Parent (Split-Path -Parent $source)
        $referenceRoot = Read-Default 'Carpeta de catalogos y VISAUDI' $referenceRoot
        $newSecrets = [ordered]@{ ADS_PROVIDER='Advantage.OLEDB.1'; ADS_DATA_SOURCE=$source; ADS_USER_ID=$user;
            ADS_PASSWORD=$plain; ADS_SERVER_TYPE='ADS_REMOTE_SERVER'; ADS_ODBC_DRIVER=$driver;
            ADS_REFERENCE_ROOT=$referenceRoot; ADS_AUDIT_DATA_SOURCE=$referenceRoot }
    }

    # Se conservan las versiones anteriores. No se tocan tablas ni indices.
    New-Item -ItemType Directory -Path $InstallRoot,$release,$secretDirectory,(Join-Path $InstallRoot 'logs') -Force | Out-Null
    Lock-Secrets $secretDirectory $FortunerAccount
    $logAcl = Get-Acl -LiteralPath (Join-Path $InstallRoot 'logs')
    $logAcl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($FortunerAccount,'Modify','ContainerInherit, ObjectInherit','None','Allow')))
    Set-Acl -LiteralPath (Join-Path $InstallRoot 'logs') -AclObject $logAcl
    $backup = Join-Path $InstallRoot ('backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    $changes = @(
        @{ Path=$startPath; Backup=(Join-Path $backup 'start-fortuner.ps1') },
        @{ Path=$ModulesConfiguration; Backup=(Join-Path $backup 'modules.json') },
        @{ Path=(Join-Path $FortunerRoot 'fortuner-contabilidad.ps1'); Backup=(Join-Path $backup 'fortuner-contabilidad.ps1') },
        @{ Path=$configPath; Backup=(Join-Path $backup 'service.json') },
        @{ Path=$secretPath; Backup=(Join-Path $backup 'credentials.dpapi') },
        @{ Path=(Join-Path $InstallRoot 'package.json'); Backup=(Join-Path $backup 'package.json') },
        @{ Path=(Join-Path $InstallRoot 'installation.json'); Backup=(Join-Path $backup 'installation.json') }
    )
    foreach ($utility in @('Configurar-Conexion-Contabilidad27.bat','configurar-conexion.ps1','INSTALACION.txt')) {
        $changes += @{ Path=(Join-Path $InstallRoot $utility); Backup=(Join-Path $backup $utility) }
    }
    if ($frontendEnv) {
        $changes += @{ Path=$frontendEnv; Backup=(Join-Path $backup 'frontend.env.local') }
    }
    foreach ($change in $changes) {
        $change.Existed = Test-Path -LiteralPath $change.Path
        if ($change.Existed) { Copy-Item -LiteralPath $change.Path -Destination $change.Backup }
    }
    Lock-Secrets $backup $FortunerAccount
    $firewallCreated = $false
    $previousFirewallProgram = $null
    $oldTaskEnabled = $false
    $oldTask = $null
    try {
        foreach ($utility in @('Configurar-Conexion-Contabilidad27.bat','configurar-conexion.ps1')) {
            Copy-Item -LiteralPath (Join-Path $PSScriptRoot $utility) -Destination (Join-Path $InstallRoot $utility) -Force
        }
        $payloadRoot = Join-Path $PSScriptRoot 'payload\Contabilidad27'
        foreach ($file in Get-ChildItem -LiteralPath $payloadRoot -Recurse -File -Force) {
            $relative = $file.FullName.Substring($payloadRoot.Length + 1)
            $destination = Join-Path $release $relative
            # Reparar la misma version no exige reemplazar ejecutables/DLL
            # identicos que el antivirus puede estar revisando tras el check.
            if ((Test-Path -LiteralPath $destination -PathType Leaf) -and
                (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -eq
                (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash) { continue }
            New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
            Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
        }
        if ($newSecrets) {
            Add-Type -AssemblyName System.Security
            $bytes = [Text.Encoding]::UTF8.GetBytes(($newSecrets | ConvertTo-Json))
            $protected = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
            [IO.File]::WriteAllBytes($secretPath, $protected)
            [Array]::Clear($bytes, 0, $bytes.Length)
            $plain = $null; $newSecrets = $null
        }
        if ($hasConfiguration) {
            # Conservar tambien opciones de sesion/Fortuner que versiones mas
            # nuevas hayan añadido; no reducir el JSON a las claves antiguas.
            $settings = Get-Content -Raw -LiteralPath $configPath -Encoding UTF8 | ConvertFrom-Json
            Set-Property $settings 'bindHost' $BindHost
            Set-Property $settings 'port' $Port
            if (-not $settings.logDirectory) { Set-Property $settings 'logDirectory' (Join-Path $InstallRoot 'logs') }
        } else {
            $settings = [ordered]@{ schemaVersion=1; bindHost=$BindHost; port=$Port; credentialsFile='credentials.dpapi'; logDirectory=(Join-Path $InstallRoot 'logs') }
        }
        Write-Utf8 $configPath ($settings | ConvertTo-Json)
        $exe = Join-Path $release 'Contabilidad27.exe'
        & $exe check --config $configPath
        if ($LASTEXITCODE -ne 0) { throw 'La comprobacion de Advantage fallo. No se registrara el modulo.' }
        $relativeExe = ".\releases\$($manifest.version)\Contabilidad27.exe"
        $npmPackage = [ordered]@{ name='contabilidad27-runtime'; version='1.0.0'; private=$true;
            scripts=@{ 'start:fortuner'=($relativeExe + ' serve --config config\service.json') } }
        Write-Utf8 (Join-Path $InstallRoot 'package.json') ($npmPackage | ConvertTo-Json -Depth 5)
        $installation = [ordered]@{ product='CONTABDSI27'; version=$manifest.version; executable=$exe;
            configuration=$configPath; fortunerRoot=$FortunerRoot; modulesConfiguration=$ModulesConfiguration;
            account=$FortunerAccount; state='installed-stopped'; backup=$backup; installedAt=[DateTime]::UtcNow.ToString('o') }
        Write-Utf8 (Join-Path $InstallRoot 'installation.json') ($installation | ConvertTo-Json)
        $frontendService = [ordered]@{ kind='web'; runner='npm'; port=$Port; workingDirectory=$InstallRoot; npmScript='start:fortuner'; healthPath='/api/health' }
        Set-Property $selected[0] 'services' ([pscustomobject]@{ frontend=[pscustomobject]$frontendService })
        Set-Property $selected[0] 'status' 'active'
        Set-Property $selected[0] 'launch' ([pscustomobject]@{ service='frontend'; path='/' })
        Write-Utf8 $ModulesConfiguration ($modules | ConvertTo-Json -Depth 30)
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'fortuner-contabilidad.ps1') -Destination (Join-Path $FortunerRoot 'fortuner-contabilidad.ps1') -Force
        Write-Utf8 $startPath $newStartText
        $publicHost = if ($BindHost -in @('0.0.0.0','::')) { [Environment]::MachineName } else { $BindHost }
        $publicUrl = "http://${publicHost}:$Port/"
        if ($frontendEnv) {
            $envText = if (Test-Path -LiteralPath $frontendEnv) { [IO.File]::ReadAllText($frontendEnv) } else { '' }
            $envText = [regex]::Replace($envText, '(?m)^VITE_CONTABILIDAD_URL=.*(?:\r?\n|$)', '')
            Write-Utf8 $frontendEnv ($envText.TrimEnd() + "`r`nVITE_CONTABILIDAD_URL=$publicUrl`r`n")
        }
        if (-not $NoFirewall -and $BindHost -notin @('127.0.0.1','localhost','::1')) {
            $ruleName = "DSI-CONTABDSI27-$Port"
            if (-not (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue)) {
                New-NetFirewallRule -Name $ruleName -DisplayName "DSI Contabilidad 27 - $Port" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -RemoteAddress LocalSubnet -Profile Domain,Private -Program $exe | Out-Null
                $firewallCreated = $true
            } else {
                $applicationFilter = Get-NetFirewallRule -Name $ruleName | Get-NetFirewallApplicationFilter
                $previousFirewallProgram = $applicationFilter.Program
                $applicationFilter | Set-NetFirewallApplicationFilter -Program $exe | Out-Null
            }
        }
        # Retirar solo el arranque autonomo legado del modulo, si existe.
        $oldTask = Get-ScheduledTask -TaskName 'CONTABDSI27 - Inicio automatico' -ErrorAction SilentlyContinue
        if ($oldTask -and @($oldTask.Actions | Where-Object { $_.Arguments -match 'CONTABDSI27.*dev\.js' }).Count) {
            $oldTaskEnabled = [bool]$oldTask.Settings.Enabled
            Disable-ScheduledTask -InputObject $oldTask | Out-Null
        }
        $fortunerEntry = if ($portableFortuner) { 'Iniciar-Fortuner-Servidor.bat' } else { 'ABRIR_APLICACION.cmd' }
        Write-Utf8 (Join-Path $InstallRoot 'INSTALACION.txt') "Contabilidad instalada y detenida.`r`nVersion: $($manifest.version)`r`nInicio: Fortuner27 / $fortunerEntry`r`nURL: $publicUrl`r`nRespaldo: $backup`r`nCambiar conexion: Configurar-Conexion-Contabilidad27.bat (con el modulo detenido).`r`nDiagnostico: powershell.exe -NoProfile -ExecutionPolicy Bypass -File configurar-conexion.ps1 -Plan`r`nNo copie credentials.dpapi a otro servidor.`r`n"
        Write-Host "Instalado en: $InstallRoot" -ForegroundColor Green
        Write-Host "URL al iniciar desde Fortuner: $publicUrl"
        Write-Host 'ESTADO: INSTALADO Y DETENIDO. No se inicio ningun servicio.' -ForegroundColor Green
        exit 0
    } catch {
        foreach ($change in $changes) {
            if ($change.Existed) { Copy-Item -LiteralPath $change.Backup -Destination $change.Path -Force }
            elseif (Test-Path -LiteralPath $change.Path -PathType Leaf) { Remove-Item -LiteralPath $change.Path }
        }
        if ($firewallCreated) { Remove-NetFirewallRule -Name $ruleName }
        elseif ($previousFirewallProgram) { Get-NetFirewallRule -Name $ruleName | Get-NetFirewallApplicationFilter | Set-NetFirewallApplicationFilter -Program $previousFirewallProgram | Out-Null }
        if ($oldTaskEnabled -and $oldTask) { Enable-ScheduledTask -InputObject $oldTask | Out-Null }
        throw
    }
} catch {
    Write-Host "INSTALACION NO COMPLETADA: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
