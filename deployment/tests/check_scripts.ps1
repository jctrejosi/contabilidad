param([Parameter(Mandatory=$true)][string]$Package)
$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $PSScriptRoot
$scriptFile = Join-Path $source 'instalar.ps1'
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($scriptFile, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'El instalador contiene errores de sintaxis.' }
# Solo cargar funciones puras; no ejecutar el cuerpo del instalador.
$hookFunction = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Hook-Text' }, $true)
. ([scriptblock]::Create($hookFunction.Extent.Text))
$fixture = '$configurationPath = if ($env:FORTUNER_MODULES_CONFIG) { "custom" } else { "default" }' + "`r`nexit 0`r`n"
$hooked = Hook-Text $fixture
if (-not $hooked.Contains('fortuner-contabilidad.ps1')) { throw 'No se agrego la integracion de Fortuner.' }
if ((Hook-Text $hooked) -ne $hooked) { throw 'La integracion se duplica al repetir la instalacion.' }
try { Hook-Text 'version incompatible' | Out-Null; throw 'Se acepto una version incompatible.' }
catch { if ($_.Exception.Message -eq 'Se acepto una version incompatible.') { throw } }
Write-Output 'PASS: integracion idempotente; versiones incompatibles rechazadas.'
foreach ($file in Get-ChildItem -LiteralPath $source -Filter '*.ps1') {
    $scriptErrors = $null
    [Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$null, [ref]$scriptErrors) | Out-Null
    if ($scriptErrors.Count) { throw "Sintaxis incorrecta: $($file.Name)" }
}
Write-Output 'PASS: sintaxis PowerShell de todos los scripts.'
& (Join-Path $Package 'instalar.ps1') -Plan
if ($LASTEXITCODE -ne 0) { throw 'El plan del instalador fallo.' }
