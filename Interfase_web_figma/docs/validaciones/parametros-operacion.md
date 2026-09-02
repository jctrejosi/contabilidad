# Validación 01 — Parámetros de operación

## Causa de la pantalla vacía

La ruta `config/parametros` estaba conectada a `PlaceholderPage`, no a un formulario. Se reemplazó por `ParametrosOperacion` sin modificar las demás opciones.

## Referencia original

- Proyecto: `C:\Xedit4\CONTABDSI\CONTABDSI.xpj`.
- `Source/DSITAB.PRG:1348`: `PARAMS()`, carga y enlaza controles.
- `Resource/VISION.RC:6757`: `PARAM_1`, rótulos y distribución del diálogo.
- `Source/DSITAB.PRG:1483`: `DIROK()`, selección/validación del directorio.
- `Source/DSITAB.PRG:1506`: `DSIGRABA6()`, guardado en `CONCTR`.
- `Source/MOVICON.prg:6744`: `HABIMES()`, semántica de los períodos.

## Cobertura del formulario

| ID original | Control | Campo original |
|---|---|---|
| 115 | Nombre Empresa | CTCIA |
| 116 | Nit | CTNIT |
| 118 | Dirección | CTDIRECC |
| 117 | Ciudad | CTCIUDAD |
| 101 / 113 | Directorio / selección de ubicación | CTDIREC / DIROK |
| 102 | Año Operación | CTANO |
| 105 | Contabilidad de Conciliación | CTCLAVE1 |
| 103 | Verifica Documentos en Lotes | CTVERDOC |
| 114 | Opera Terceros y Documentos Propios | CTTERDOC |
| 119 | Controla Usuario Lotes | CTPUC, '1' o espacio |
| 112 | Comentario del certificado | CTLEY1 |
| 104 / 111 | Retención → base / base → retención | MCR |
| 130 | Saldos Iniciales | CT00 |
| 131–142 | Enero a diciembre | CT01–CT12 |
| 109 | Grabar | DSIGRABA6 |
| 110 | Salir | Cierre del diálogo |

Se conservan los cuatro grupos: Datos Compañía, parámetros generales, comentario/manejo de retenciones y Bloqueo meses. No se añadieron los meses 13–18 a esta pantalla: el original sólo presenta 00–12.

## Diferencias y límites explícitos

- La disposición conserva los grupos y el orden del original, usando la marca y estilos de la interfaz nueva; no es una captura pixel a pixel de FiveWin.
- Los valores son de demostración; no se leyó ni modificó la base de datos real.
- Grabar conserva la configuración en el almacenamiento local del navegador por compañía y deja visible una confirmación. El original graba y cierra el diálogo.
- Salir vuelve al inicio; si hay cambios muestra confirmación para descartarlos. También se advierte al recargar/cerrar la página con cambios pendientes.
- El selector de directorio permite indicar una ruta Windows/UNC; no comprueba existencia ni accede al sistema de archivos. Esa verificación necesita el backend.
- Aunque el título legado dice “Bloqueo meses”, `HABIMES()` habilita cuando CTxx es verdadero. Por ello casilla marcada = habilitado; desmarcada = bloqueado.
- MCR se inicializa en 1 en `PARAMS()` pero no se lee/escribe en `DSIGRABA6()`. Los dos radios se conservan y funcionan en la demostración local; su persistencia real requiere definir el campo correspondiente.
- FDIA, TAMOBS, DCD y CCRET1 se leen internamente en el original pero no tienen controles activos en PARAM_1; no se añadieron como campos nuevos.
- El resto de la aplicación continúa usando sus datos mock. Guardar aquí no cambia todavía el encabezado, la captura ni las reglas de otros módulos.

## Verificación

- TypeScript sin errores.
- Compilación de producción correcta.
- Pruebas del modelo: períodos 00–12, reglas de validación, sintaxis Windows/UNC, round-trip de persistencia y rechazo de preferencias dañadas.
- Prueba de navegador: formulario visible, error por nombre vacío, guardado de radio/comentario/mes, persistencia al volver, selector de ruta inválida y confirmación de salida.

