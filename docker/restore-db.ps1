# Restaura el respaldo real de CONTABDSI en el PostgreSQL del contenedor.
#
# - Une las partes de db/backups/partes, verifica tamaño y SHA-256 del manifiesto.
# - Crea la base destino si no existe.
# - Ejecuta pg_restore --clean --if-exists --no-owner --no-privileges.
# - Valida conteos y cuadratura de débitos/créditos.
#
# Uso (desde docker/):
#   powershell -ExecutionPolicy Bypass -File .\restore-db.ps1
#   powershell -ExecutionPolicy Bypass -File .\restore-db.ps1 -DbName contabdsi_datos
#
# Requisitos: contenedor `contabdsi_postgres` arriba y las partes versionadas en
# db/backups/partes. El dump contiene datos reales: el repositorio es privado.

[CmdletBinding()]
param(
    [string]$Container = "contabdsi_postgres",
    [string]$DbUser = "contabdsi",
    [string]$DbName = "contabdsi_datos",
    [string]$PartsDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "db\backups\partes"),
    [string]$ManifestName = "respaldo.json",
    [switch]$SkipChecksum
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    Write-Host "✘ $Message" -ForegroundColor Red
    exit 1
}

Write-Host "==> CONTABDSI · restauración de datos migrados"
Write-Host "    contenedor: $Container"
Write-Host "    base:       $DbName"
Write-Host "    respaldo:   $PartsDir"

# ── 1. Manifiesto y partes ─────────────────────────────────
$manifestPath = Join-Path $PartsDir $ManifestName
if (-not (Test-Path -LiteralPath $manifestPath)) {
    Fail "No existe el manifiesto: $manifestPath"
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if (-not $manifest.archivo -or -not $manifest.partes) {
    Fail "El manifiesto no declara archivo/partes."
}
$parts = @($manifest.partes | ForEach-Object { Join-Path $PartsDir $_ })
foreach ($part in $parts) {
    if (-not (Test-Path -LiteralPath $part)) {
        Fail "Falta una parte del respaldo: $part"
    }
}

# ── 2. Unir las partes ─────────────────────────────────────
$tempDir = if ($env:TEMP) { $env:TEMP } else { [System.IO.Path]::GetTempPath() }
$combined = Join-Path $tempDir $manifest.archivo
Write-Host "==> Uniendo $($parts.Count) partes → $combined"
if (Test-Path -LiteralPath $combined) {
    Remove-Item -LiteralPath $combined -Force
}
$output = [System.IO.File]::Create($combined)
try {
    foreach ($part in $parts) {
        $input = [System.IO.File]::OpenRead($part)
        try { $input.CopyTo($output) } finally { $input.Dispose() }
    }
}
finally {
    $output.Dispose()
}

# ── 3. Verificar tamaño y SHA-256 ──────────────────────────
$size = (Get-Item -LiteralPath $combined).Length
if ($manifest.bytes -and $size -ne [int64]$manifest.bytes) {
    Remove-Item -LiteralPath $combined -Force
    Fail "El respaldo unido pesa $size bytes y el manifiesto declara $($manifest.bytes)."
}
if (-not $SkipChecksum -and $manifest.sha256) {
    $hash = (Get-FileHash -LiteralPath $combined -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne $manifest.sha256.ToLowerInvariant()) {
        Remove-Item -LiteralPath $combined -Force
        Fail "El SHA-256 no coincide. Esperado $($manifest.sha256), obtenido $hash."
    }
    Write-Host "==> SHA-256 verificado: $hash"
}

# ── 4. Contenedor y base destino ───────────────────────────
$running = (docker inspect -f "{{.State.Running}}" $Container 2>$null)
if ($running -ne "true") {
    Remove-Item -LiteralPath $combined -Force
    Fail "El contenedor '$Container' no está corriendo. Levanta el stack primero."
}

$exists = (docker exec $Container psql -U $DbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DbName'").Trim()
if ($exists -ne "1") {
    Write-Host "==> La base '$DbName' no existe; se crea."
    docker exec $Container createdb -U $DbUser $DbName
    if ($LASTEXITCODE -ne 0) {
        Remove-Item -LiteralPath $combined -Force
        Fail "No se pudo crear la base '$DbName'."
    }
}

# ── 5. Restaurar ───────────────────────────────────────────
$remote = "/tmp/contabdsi-restore.dump"
Write-Host "==> Copiando respaldo al contenedor ($([math]::Round($size / 1MB)) MiB)"
docker cp $combined "${Container}:$remote"
if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $combined -Force
    Fail "docker cp falló."
}

Write-Host "==> Restaurando en '$DbName' (puede tardar varios minutos)"
docker exec $Container pg_restore -U $DbUser -d $DbName --clean --if-exists --no-owner --no-privileges $remote
$restoreExit = $LASTEXITCODE
docker exec $Container rm -f $remote | Out-Null
Remove-Item -LiteralPath $combined -Force
if ($restoreExit -ne 0) {
    Fail "pg_restore terminó con código $restoreExit. Revisa la salida anterior."
}

# ── 6. Validar ─────────────────────────────────────────────
Write-Host "==> Conteos restaurados"
docker exec $Container psql -U $DbUser -d $DbName -c @"
SELECT 'documentos' AS tabla, count(*) AS filas FROM documentos
UNION ALL SELECT 'documento_lineas', count(*) FROM documento_lineas
UNION ALL SELECT 'terceros', count(*) FROM terceros
ORDER BY tabla;
"@

Write-Host "==> Cuadratura del libro"
docker exec $Container psql -U $DbUser -d $DbName -c @"
SELECT COALESCE(SUM(debito), 0) AS debitos,
       COALESCE(SUM(credito), 0) AS creditos,
       COALESCE(SUM(debito), 0) - COALESCE(SUM(credito), 0) AS diferencia
FROM documento_lineas;
"@

Write-Host "✔ Restauración completada. Compara los conteos con db/backups/partes/README.md" -ForegroundColor Green
Write-Host "  Esperado: documentos=740689 · documento_lineas=5043942 · terceros=125993 · diferencia=0"
