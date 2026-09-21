<#
.SYNOPSIS
  Exporta a CSV las tablas del diccionario Advantage (ADS) de CONTABDSI.

.DESCRIPTION
  Se ejecuta EN LA MÁQUINA WINDOWS QUE TIENE EL MOTOR ADS. El formato .adt/.add
  es propietario y no se puede leer sin él (el driver ODBC solo existe para
  Windows), así que este es el camino probado — el mismo que se usó en el
  proyecto ecommerce con db/adt-reader/export-publidata.ps1.

  Deja un CSV por tabla y un manifiesto JSON con filas, bytes y SHA-256, que es
  lo que exige el contrato del extractor (README.md de esta misma carpeta).

.PARAMETER Mode
  List   = solo enumera las tablas del diccionario (rápido, sin exportar).
           Úsalo primero: confirma que las tablas contables están ahí.
  Export = exporta las tablas indicadas a CSV + manifiesto.

.EXAMPLE
  .\export_ads_to_csv.ps1 -Mode List -Dicc "C:\VISADS_25\ADD\Publidata.add"

.EXAMPLE
  .\export_ads_to_csv.ps1 -Mode Export -Dicc "C:\VISADS_25\ADD\Publidata.add" -Out "C:\export_contab"

.NOTES
  NO PROBADO en el entorno de desarrollo (aquí no hay ADS). Ajusta -Driver y
  -TableType si la conexión falla; ver README.md §3.
#>
param(
  [ValidateSet("List", "Export")]
  [string] $Mode = "List",

  # Diccionario .add. Si se omite, se busca en C:\ (puede tardar).
  [string] $Dicc = "",

  [string] $Out = "C:\export_contab",
  [string] $Driver = "Advantage ODBC Driver",
  [string] $TableType = "ADS_CDX",
  [string] $Uid = "AdsSys",
  [string] $Pwd = "Pubdata",
  [string] $ServerType = "ADS_LOCAL_SERVER",

  # Inventario de ADD_CONTAB: 15 documentadas + 5 que solo están en el .add.
  [string[]] $Tablas = @(
    "CONEMP", "CONCTR", "CONPUC", "CONMAE", "VISDOCUM", "CONTICOM",
    "FADCLI", "CONCECOS", "CONDOCUM", "MOV00", "MOV01", "CONTERCE",
    "COCENTRO", "CONMOVI", "TIDSAL",
    "CONLOTES", "CATALOGO2", "TIDEAN", "P_A_100_50", "P_A_102_50"
  )
)

$ErrorActionPreference = "Stop"

if (-not $Dicc) {
  Write-Host "Buscando Publidata.add en C:\ (puede tardar)..." -ForegroundColor Cyan
  $found = Get-ChildItem C:\ -Recurse -Filter "Publidata.add" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $found) { throw "No encontré Publidata.add. Pásalo con -Dicc." }
  $Dicc = $found.FullName
}
if (-not (Test-Path $Dicc)) { throw "No existe el diccionario: $Dicc" }
Write-Host "Diccionario: $Dicc" -ForegroundColor Cyan

$cs = "Driver={$Driver};DataDirectory=$Dicc;ServerTypes=$ServerType;UID=$Uid;PWD=$Pwd"
if ($TableType) { $cs += ";TableType=$TableType" }

$conn = New-Object System.Data.Odbc.OdbcConnection($cs)
$conn.Open()
Write-Host "Conectado a ADS OK" -ForegroundColor Green

function Invoke-AdsQuery {
  param([string] $Sql)
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = $Sql
  $reader = $cmd.ExecuteReader()
  $names = @()
  for ($i = 0; $i -lt $reader.FieldCount; $i++) { $names += $reader.GetName($i) }
  $rows = @()
  while ($reader.Read()) {
    $row = [ordered]@{}
    for ($i = 0; $i -lt $reader.FieldCount; $i++) {
      $value = $reader.GetValue($i)
      $row[$names[$i]] = if ($null -eq $value -or [DBNull]::Value.Equals($value)) { "" } else { $value.ToString() }
    }
    $rows += [pscustomobject]$row
  }
  $reader.Close()
  return , @{ Columns = $names; Rows = $rows }
}

function ConvertTo-CsvLine {
  param([string[]] $Values)
  $quoted = foreach ($value in $Values) { '"' + ($value -replace '"', '""') + '"' }
  return ($quoted -join ",")
}

if ($Mode -eq "List") {
  Write-Host "`nTablas del diccionario (system.tables):" -ForegroundColor Cyan
  try {
    $result = Invoke-AdsQuery "SELECT Name, Type FROM system.tables ORDER BY Name"
    $inventario = @{}
    foreach ($row in $result.Rows) { $inventario[$row.Name.ToUpper()] = $true }
    $result.Rows | Format-Table -AutoSize
    Write-Host "`nCruce con el inventario de ADD_CONTAB:"
    foreach ($tabla in $Tablas) {
      $estado = if ($inventario.ContainsKey($tabla.ToUpper())) { "PRESENTE" } else { "no aparece" }
      Write-Host ("  {0,-14} {1}" -f $tabla, $estado)
    }
  } catch {
    Write-Host "La consulta a system.tables falló: $_" -ForegroundColor Red
    Write-Host "Prueba a listar con: SELECT * FROM system.tables   (o revisa -TableType)" -ForegroundColor Yellow
  }
  $conn.Close()
  exit 0
}

# ── Mode = Export ────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$manifiesto = @()

foreach ($tabla in $Tablas) {
  $destino = Join-Path $Out "$tabla.csv"
  $inicio = Get-Date
  try {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT * FROM [$tabla]"
    $reader = $cmd.ExecuteReader()

    $writer = New-Object System.IO.StreamWriter($destino, $false, (New-Object System.Text.UTF8Encoding($false)))
    $columnas = @()
    for ($i = 0; $i -lt $reader.FieldCount; $i++) { $columnas += $reader.GetName($i) }
    $writer.WriteLine((ConvertTo-CsvLine $columnas))

    $filas = 0
    while ($reader.Read()) {
      $valores = @()
      for ($i = 0; $i -lt $reader.FieldCount; $i++) {
        $value = $reader.GetValue($i)
        $valores += if ($null -eq $value -or [DBNull]::Value.Equals($value)) { "" } else { $value.ToString() }
      }
      $writer.WriteLine((ConvertTo-CsvLine $valores))
      $filas++
      if ($filas % 50000 -eq 0) { Write-Host ("    {0}: {1:N0} filas..." -f $tabla, $filas) -ForegroundColor DarkGray }
    }
    $writer.Close(); $reader.Close()

    $hash = (Get-FileHash $destino -Algorithm SHA256).Hash.ToLower()
    $manifiesto += [pscustomobject]@{
      tabla = $tabla; archivo = "$tabla.csv"; filas = $filas; columnas = $columnas.Count
      bytes = (Get-Item $destino).Length; sha256 = $hash
      segundos = [int]((Get-Date) - $inicio).TotalSeconds; error = ""
    }
    Write-Host ("OK {0}: {1:N0} filas -> {2}" -f $tabla, $filas, $destino) -ForegroundColor Green
  } catch {
    $manifiesto += [pscustomobject]@{
      tabla = $tabla; archivo = ""; filas = 0; columnas = 0; bytes = 0; sha256 = ""
      segundos = [int]((Get-Date) - $inicio).TotalSeconds; error = "$_"
    }
    Write-Host ("ERROR en {0}: {1}" -f $tabla, $_) -ForegroundColor Red
  }
}

$conn.Close()
$rutaManifiesto = Join-Path $Out "manifiesto.json"
$manifiesto | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $rutaManifiesto

Write-Host "`n== Resumen ==" -ForegroundColor Cyan
$manifiesto | Format-Table tabla, filas, bytes, segundos -AutoSize
Write-Host "Manifiesto: $rutaManifiesto"
Write-Host "Siguiente paso: traer los CSV + manifiesto al repo y cargarlos en PostgreSQL."
