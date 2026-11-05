# Medios magnéticos — 5. Revisión de medios

## Origen y alcance

Fuente revisada: `C:/Xedit4/CONTABDSI/Source/DSITAB.PRG`.
MEDMAG05 es un mantenimiento del resultado vigente, no otra acumulación.

| Original | Implementación |
|---|---|
| AYUDAFOR(2) | Selector real CONMAG1; consulta explícita por formato y CIA |
| Listado MEDMAG05 | Concepto, tercero, DV, nombre, tercero 2, valores 1–11, SALE; total de VALOR1 de todo el formato |
| CREAMAG/CREAMAG2 | Crear/modificar concepto, tercero, DV, VALOR1 y VALOR2; preservar demás campos |
| AYUDACON/AYUDACL | Conceptos de CONMAG2 del formato y búsqueda real FADCLI; opción de crear tercero con formulario existente |
| BORRAMAG | Confirmación propia; baja de una fila de CONMAGDT, nunca de las partidas de origen |
| DETAMAG | Partidas CONMAGIT por CIA + formato + concepto + NIT |
| IMPREDET, DETALLE1/2 | Exportación del detalle PDF y XLSX |
| GENEMAG2 | Informe legible con once columnas fijas, indicadores del formato, datos FADCLI, PDF y XLSX |
| GENEMAG/GENEMAGXLS/GENEMAGXLS2 | Archivo XLSX sin encabezados; código, ID o beneficiario; agrupación, redondeo y columnas del original |
| GENERAID | Vista previa obligatoria y confirmación para reemplazar TERCERO por FADCLI.CNIT |

No se migran aquí MEDMAG06–09 ni las depuraciones A/B.

## Persistencia y seguridad

- Tablas comprobadas con consultas de metadatos: CONMAG1/2, CONMAGDT,
  CONMAGIT y FADCLI. No se requirió alterar estructuras. CIA está disponible
  en los resultados. Los catálogos de formatos/conceptos/terceros siguen globales.
- CONMAGDT no tiene ID; ROWID identifica una fila física y un hash detecta
  modificaciones. ROWID no se guarda en configuraciones: se vuelve a consultar
  después de generar, reorganizar o recargar. No se selecciona solo por
  concepto/tercero, porque el original admite duplicados.
- UPDATE/DELETE verifican CIA, formato, ROWID y contenido original. Si no afecta
  exactamente una fila, se revierte. Operaciones en transacción y candado local.
- Alta inicializa campos adicionales, pero no suma ni consolida duplicados;
  la consolidación ocurre al exportar, como GENEMAGXLS2.
- Cambios manuales y reasignación no alteran CONMAGIT, MOV01 ni saldos contables.
- La auditoría se intenta después de confirmar; un fallo se comunica como
  advertencia sin afirmar que la operación confirmada fracasó.
- No se ejecutaron escrituras sobre la base activa durante la implementación.

## Archivo y adaptaciones explícitas

- XLS legado pasa a XLSX. Se fracciona en hojas cada 65.500 filas; no se limita
  la exportación a la página visible. El archivo fiscal no lleva adornos DSI
  ni encabezados: esos estilos se reservan al informe de revisión y al detalle.
- Se agrupa por formato/concepto/tercero y se aplica INT(suma + .5), incluido
  truncamiento hacia cero de negativos; no se usa round() bancario de Python.
- Configuración CONMAG1 de datos identificativos, nombres personales/razón
  social, dirección, departamento/municipio y país 169. Luego VALOR1/VALOR2
  del concepto o posiciones de base/IVA CxP y COMBO1–7. Se conservan los
  desplazamientos/sobrescrituras de posiciones CxP definidos en el original.
- Identificación para exportar: CCODIGO, CNIT o CCODBE con fallback a código.
  Búsqueda primaria por CCODIGO y alternativa CNIT, como la rama de origen.
- Se corrigen dos defectos de cursor/transcripción del fuente: DV calculado
  sobre la identificación exportada (no una fila posterior al DBskip), y
  COMBO3 reconoce Valor 10/11 según COMBO3, no COMBO2. Son correcciones
  explícitas, no una afirmación de equivalencia binaria con el XLS antiguo.
- Un concepto o tercero sin referencia bloquea el archivo final con un error
  específico; la revisión permite ver registros sin nombre para corregirlos.
- GENERAID conserva literalmente su efecto: cambia TERCERO, no DIGITO ni
  CONMAGIT. Por eso puede dejar de encontrarse el detalle y perderse el nombre
  por CCODIGO; la confirmación lo advierte y ofrece exportar por ID sin cambiar
  registros como alternativa. Una nueva generación sustituye estas correcciones.
- No genera XML ni certifica cumplimiento de resoluciones actuales: se migra
  la salida del código entregado. La aceptación fiscal requiere homologación.

## Interfaz

Menú propio, sin simulaciones. No consulta acumulados hasta elegir formato y
pulsar Consultar. Tabla con desplazamiento horizontal, búsqueda y páginas de
100 filas. Total de Valor1 corresponde a todo el formato, no al filtro local.
F2 nuevo, F3 modificar, F4 eliminar, F5 revisión, F6 archivo; Enter en una fila
abre detalle. Formularios avanzan con Enter; búsqueda de tercero con flechas
y Enter mantiene foco en DV. Errores de guardado dejan el formulario abierto.

## Verificación y pendientes de aceptación

- TypeScript sin errores, compilación frontend y Python correctos.
- 35 pruebas unitarias de revisión y generación correctas: transacciones,
  rollback, preservación de valores 3–11, filtros CIA, conflictos, detalle,
  vista previa de identificación, agrupación/redondeo/combos, salida XLSX
  segura de texto y PDF legible con pie DSI. No son pruebas de escritura real.
- OpenAPI registra las seis rutas del módulo.
- Lectura real de formatos y revisión para CIA 027 correcta. La tabla de
  liquidación consultada está vacía: falta comparar un formato generado con
  Harbour, probar crear/modificar/eliminar y recuperar con respaldo, validar
  ROWID y RecordsAffected con filas reales, y exportar un caso CxP de referencia.
