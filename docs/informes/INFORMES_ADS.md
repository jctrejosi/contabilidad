# Informes visibles del centro de informes

## Alcance

Este módulo ofrece únicamente **consulta, previsualización, impresión y exportación**. No ejecuta las rutinas fiscales ni las acciones de mantenimiento de acumulados del programa Harbour. La compañía activa (`CIA`/`CONCIA`) delimita todas las consultas contables. `FADCLI` es un maestro global de terceros.

La API de lectura está en `GET /api/informes/adicionales/{id}` y la exportación en `GET /api/informes/adicionales/{id}/exportar`. El front no usa datos de demostración; un informe sin implementación muestra un error explícito. PDF, XLSX y CSV se generan a partir de las mismas filas consultadas.

## Fuentes y opciones implementadas

| Familia | Opciones visibles | Fuente principal |
| --- | --- | --- |
| Documentos | Documento por formato, documento por planilla | `MOV01`; el primero imprime un solo documento con formato predeterminado |
| Plan de cuentas | Listado de cuentas | `CONMAE` |
| Balances y saldos | Balance de comprobación acumulado (dos accesos del menú), balance mensual, inventario y balance, mayor y balance, saldos por cuenta, balance general/resultados, análisis anual acumulado, balance de prueba anual, balance comparativo mensual, análisis anual mensual | `CONMAE`; el balance acumulado usa `MSALDO`, `MACMDEBxx`, `MACMCRExx` y excluye filas auxiliares |
| Movimientos y auxiliares | Auxiliar general, auxiliar por documento afectado, movimiento por comprobante, tipo de documento o cuenta, diario por cuenta, caja diario por comprobante o cuenta | `MOV01` consolidado, filtrado por `CONCIA`, `CONANO`, `CONMES` |
| Terceros | General, acumulación, cuenta-tercero, tercero específico, cumpleaños, etiquetas por zona, comparativo cuenta-tercero, resumen por tipo de tercero | `FADCLI`, `CONTERCE` y `MOV01` |
| Centros | Diario de rangos continuos/fijos, balance acumulado/mensual, clasificación por centro y por centro-tercero, discriminados por mes | `MOV01` y `COCENTRO` |

**Alcance de equivalencia:** las opciones de inventario/mayor, balance general/resultados, comparativo cuenta-tercero y diario por rangos ya consultan datos reales, pero su disposición y algunos subtotales impresos aún no reproducen todos los renglones y cortes del formulario Harbour. Los nombres de la interfaz se conservan para facilitar la validación funcional. No considerar estas variantes certificadas hasta cotejarlas con salidas del sistema original para el mismo período.

## Pendientes por definiciones no disponibles o lógica especializada

| Opción visible | Pendiente |
| --- | --- |
| Acumulado corriente/no corriente | El original divide el saldo según `RENGLON` en las filas auxiliares de `CONMAE`. En el modelo actual los auxiliares están en `CONTERCE`, pero esa tabla no tiene `RENGLON`; falta definir cómo asignar cada tercero a corriente/no corriente. No se reemplaza por un balance sin clasificar. |
| Definición de cuentas de flujo y comparativo anual de flujo | La rutina original utiliza `CONINF1`; no existe en el directorio Advantage configurado. Se requiere copia de su definición/estructura y criterios contables. |
| ESFA apertura/convergencia e información NIC de saldos y movimientos | Requieren migrar las reglas especializadas `NICAPER`/`NICSALMOV`, incluida la selección de hasta tres tipos documentales y clasificación NIIF. En la compañía 027 casi todas las filas de `CONMAE.CTCTABASE` y `TIPONIIF` están vacías; generar un estado NIIF con ellas sería engañoso. No se sustituyen por un balance genérico. |
| Generador personalizado | Requiere las definiciones guardadas del generador original (`INFORMES`), ausentes en la instalación configurada. |

Se encontraron copias de `CONINF1` e `INFORMES` en `C:\VISADS\CONTAB`, una ruta distinta de la conexión activa. No se mezclan con los datos de la instalación actual hasta confirmar que corresponden a la compañía y configuración vigentes.

`CONGENF` y `CONFORMA` se empleaban para formatos documentales configurables. Por indicación del usuario, la impresión de documento utiliza mientras tanto un formato predeterminado con compañía, NIT, fecha, comprobante, tipo, partidas y totales; acepta un rango de números y crea una página/sección por documento. Los filtros de la planilla incluyen rangos de tipo documental, comprobante y número.

## Reglas técnicas

- `MOV01` reúne los meses que Harbour leía de `MOV01` a `MOV12`. No se mezclan años ni compañías.
- Los créditos en acumulados `CONMAE`, `CONTERCE` y `COCENTRO` están almacenados con signo negativo; se muestran como créditos positivos y se suman con signo al saldo neto.
- Los acumulados sin campo de año se consultan solo cuando el año solicitado coincide con `CONCTR.CTANO`.
- Las consultas de detalle devuelven un máximo de 5.000 filas. Si se excede, se solicita acotar filtros; nunca se entrega un informe truncado como si estuviera completo.
- `FADCLI` puede superar 100.000 registros; sus listados amplios deben acotarse con la búsqueda de código o nombre.
- Las exportaciones vuelven a consultar con los mismos filtros, por lo que pueden reflejar cambios contables efectuados entre la previsualización y la descarga.
