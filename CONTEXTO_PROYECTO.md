# CONTABDSI27 · Contexto para retomar el proyecto

Actualizado el 12 de noviembre de 2026. Estado de referencia: commit `a99cddc` en `master`, más el rediseño visual sin commit de la rama `rediseno-visual`. El estado actual se comprueba en Git al iniciar cada sesión.

## Cómo retomar el trabajo

1. Abre `contabilidad/`, la raíz Git dentro de la carpeta CONTABDSI27. Ejecuta `git status --short --branch` y revisa los commits recientes y los cambios locales.
2. Lee este archivo, las instrucciones `AGENTS.md` aplicables y la documentación del módulo. El [índice de documentación](docs/README.md) enlaza las especificaciones, planes y bitácoras. Distingue lo implementado en el código de lo planeado en documentos históricos.
3. Sigue el flujo de la pantalla a la API y al repositorio. Para cambios de lógica contable, contrasta validaciones, filtros, escrituras y totales con el original Harbour en `C:\Xedit4\CONTABDSI`, proyecto `CONTABDSI.xpj`. Esa ruta es local y puede variar entre equipos.
4. Al terminar un cambio funcional, registra qué quedó implementado, los archivos principales, cómo se verificó y qué falta probar. Usa `docs/sesiones/` para el detalle y actualiza este archivo cuando cambien decisiones compartidas o el punto de continuidad.

## Arquitectura y ejecución

| Componente | Ubicación y función |
| --- | --- |
| Interfaz | `Interface_web/`. React, TypeScript, Vite y Tailwind. `src/App.tsx` dirige la navegación, `src/components/Shell.tsx` dibuja la cabecera y los menús, `src/pages/` contiene las pantallas y `src/api/` consume el backend. Su identidad visual sigue la guía de Fortuner (ver "Estado de continuidad"). |
| API | `backend/app.py` con FastAPI. `backend/store.py` despacha operaciones según el motor. Los repositorios por módulo contienen las consultas y escrituras. |
| Motor operativo | Advantage Data Server (ADS), mediante ADO en Windows. `backend/ads_repository.py` centraliza conexiones. Las operaciones de lotes y reproceso usan ADO sobre ODBC. |
| PostgreSQL | `db/` y sus repositorios contienen el esquema alternativo y trabajo de migración. Verifica qué motor usa la operación antes de cambiarla. El objetivo operativo acordado es ADS. |
| Asistente | `ia-service/` contiene el servicio de Daisy y su integración con el asistente de la interfaz. |
| Producción | `deployment/` prepara e instala el paquete con ejecutable y frontend compilado. Fortuner27 inicia el módulo mediante su iniciador portable. |

Desde la raíz Git, `node dev.js --check` verifica el entorno y `node dev.js --db-advantage --no-db --no-ia` inicia el módulo local con Advantage. Los puertos habituales son **8443** para Vite y **8001** para la API. `Activar-Desarrollo.bat` prepara el entorno de desarrollo en Windows. Consulta [desarrollo en servidor](deployment/DESARROLLO-SERVIDOR.txt) y [protocolo de instalación](deployment/PROTOCOLO-INSTALACION.txt).

La conexión local se configura con variables de entorno o `backend/.env`. En producción se usa la configuración de la instalación. Las rutas del diccionario, las credenciales y los datos de clientes se administran fuera de este archivo. El acceso desde Fortuner y la identidad de auditoría se describen en [Integración de identidad](docs/INTEGRACION_IDENTIDAD_FORTUNER.md) y [bitácora de implementación](docs/sesiones/2026-10-22-identidad-fortuner.md).

## Reglas que comparten los módulos

| Datos | Regla |
| --- | --- |
| `CONEMP`, `CONCTR` | Selección de compañía y control del ejercicio y períodos habilitados. |
| `CONMAE`, `CONCECOS`, `CONTICOM` | Cuentas, centros y comprobantes aislados por `CIA`. |
| `FADCLI` | Maestro global de terceros. Llave funcional `CCODIGO`. |
| `VISDOCUM` | Tipos de documentos globales, sucursal predeterminada `SUC=1`. Contabilidad puede usar documentos de todos los módulos. |
| `CONMOVI`, `CONLOTES` | Cabecera y partidas de lotes por compañía. La importación crea un borrador para verificar y actualizar. |
| `CONDOCUM`, `MOV01` | Cabecera y detalle contabilizado. En ADS nuevo, `MOV01` consolida períodos y se filtra por `CONCIA`, `CONANO` y `CONMES`. |
| `CONTERCE`, `COCENTRO` | Auxiliares por tercero y centro. El modelo original almacenaba los terceros dentro de `CONMAE`. |

Conserva los importes y signos del modelo ADS. El crédito se almacena con signo negativo en movimiento y acumulados. Al actualizar una cuenta, se recorren los niveles existentes de 1, 2, 4, 6, 9 y 12 dígitos. Los cambios de contabilización y reproceso deben respetar el aislamiento por compañía y las transacciones existentes.

## Estado de continuidad

- **Apertura contable, período 00.** Actualizar un lote 00 valida `CT00`, registra `CONMES=0` en `MOV01`, conserva la fecha real y suma el saldo firmado a `MSALDO` en las cuentas, sus padres y sus terceros. La contabilización y la anulación también mantienen `DEB00/CRE00` para centros afectados. [Detalle y prueba de aceptación](docs/sesiones/2026-11-06-saldos-iniciales-msaldo.md).
- **Revalorización.** El rango admite 00–12. El período 00 reconstruye `MSALDO` de `CONMAE` y `CONTERCE` a partir del movimiento de apertura de la compañía y el ejercicio. Los períodos 01–12 reconstruyen sus columnas mensuales. La escritura es diferencial, con actualizaciones de auxiliares por bloques y barra de progreso. El reproceso 00 reemplaza saldos sin respaldo por cero, así que antes de ejecutarlo con datos migrados comprueba si la apertura está en `MOV01`. [Código del reproceso](backend/reproceso_mensual_repository.py).
- **Pendiente de la apertura.** El commit de referencia incluyó 92 pruebas automatizadas de los flujos relacionados y una compilación de la interfaz. Quedó pendiente la prueba de aceptación contra Advantage con la nueva versión. La generación de un lote de apertura desde otra compañía y la corrección de aperturas históricas requieren trabajo independiente. [Bitácora](docs/sesiones/2026-11-06-saldos-iniciales-msaldo.md).
- **Terceros.** La pantalla de Contabilidad usa el mantenimiento completo para crear y modificar en `FADCLI`. Para el traslado a Fortuner27 se dejó `CONTEXTO_MIGRACION_TERCEROS_CONTABDSI27.md` en la carpeta de ese proyecto. Ese documento describe el código extraído y distingue las operaciones reales de las opciones de demostración.

- **Rediseño visual con la identidad de Fortuner.** Trabajo sin commit en la rama `rediseno-visual`, sobre el commit `a99cddc`. Solo cambia la apariencia de `Interface_web/`; rutas, API, autenticación, puertos y variables de entorno no se tocaron. [Bitácora](docs/sesiones/2026-11-12-rediseno-visual-fortuner.md).
  - **Guía.** `GUIA_REDISENO_MODULOS.md`, en la carpeta CONTABDSI27 fuera del repositorio (hay una copia idéntica en Fortuner27). Rige la revisión 2: logo y navegación solo en la cabecera, sin barra lateral. No modifiques `..\Fortuner27` desde este módulo.
  - **Cabecera.** `src/components/Shell.tsx` dibuja dos filas. La fila 1 tiene el logo, el nombre del módulo, los chips de compañía y período, las notificaciones, el asistente y el usuario. La fila 2 tiene Inicio, los grupos con desplegable, Reprocesos y auditoría, y "Más" con Administración, Cierres y Consolidación. `NavPage` y `NAV_GROUPS` conservan identificadores, orden y `onNavigate`. Si agregas una pantalla, añádela ahí.
  - **Estilos globales.** `src/index.css` define las variables `--fx-*`, los colores `fortuner-*` y Poppins. Reasigna los grises, rojos, verdes y azules de Tailwind y la escala heredada `petroleum-*` a la paleta de la guía, de modo que las clases existentes ya heredan los colores. La clase `.btn-fx` es el botón principal.
  - **Componentes.** Los botones principales usan `.btn-fx` y los destructivos llevan texto y borde `#B42318`. Las tarjetas tienen radio de 18 px y los modales de 20 px. No uses violeta fuera de Analítica.
  - **Verificación.** `npm run build`, `tsc --noEmit` y `test:parametros` pasan. Lo revisé en el navegador a 1440 y 375 px con respuestas simuladas de la API.
  - **Pendiente.** Abrir el módulo desde el catálogo de Fortuner con datos reales de Advantage. Recorrer Captura directa, Lotes, Movimiento mensual, Informes y los modales de eliminar. Confirmar qué grupos van en "Más". Hacer el commit y actualizar la tabla de la sección 15 de la guía.

## Verificación y entrega

- Ejecuta las pruebas pertinentes de `backend/tests/` con `python -m pytest` desde la raíz Git y con las dependencias del backend instaladas. Para apertura, empieza por `backend/tests/test_saldos_iniciales_ads.py` y las pruebas de lotes, contabilización, anulación y reproceso.
- Para cambios de interfaz, ejecuta `npm run build` en `Interface_web/`. Comprueba por separado los flujos que requieran una sesión de Fortuner o datos reales de Advantage.
- En el traspaso, indica el commit o rama, lo que se modificó, las pruebas ejecutadas y el siguiente paso concreto. Distingue una prueba con ADO simulado de una prueba contra el diccionario real.
