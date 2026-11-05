# Estado de migración CONTABDSI27 — 19 de octubre de 2026

## Resultado ejecutivo

Estimación de implementación funcional: **aproximadamente 70 %**; pendiente
aproximado: **30 %**. No es un porcentaje de certificación contable ni de
preparación para producción. Incertidumbre orientativa: ±5 puntos.

La revisión es estática y por familias de procesos; no se auditó función por
función todo el Harbour, ni se compararon todos los resultados con una copia
real del sistema original. Una opción visible no cuenta como implementación.
Un endpoint PostgreSQL no cuenta como migración operativa a Advantage.

## Método y estimación ponderada

Los pesos son una propuesta de importancia funcional, no horas estimadas ni
conteos de líneas, pantallas o endpoints. Los avances son juicios de cobertura
basados en las evidencias siguientes. No usar como medición exacta contractual.

| Familia | Peso | Implementación estimada | Aporte |
|---|---:|---:|---:|
| Movimiento y captura | 20 % | 90 % | 18,00 |
| Consultas | 10 % | 95 % | 9,50 |
| Informes | 25 % | 90 % | 22,50 |
| Definiciones ordinarias | 15 % | 80 % | 12,00 |
| Medios magnéticos | 10 % | 42 % | 4,20 |
| Reprocesos, auditoría y reorganización | 10 % | 40 % | 4,00 |
| Especiales y reclasificaciones | 5 % | 15 % | 0,75 |
| Cierres y consolidación | 5 % | 0 % | 0,00 |
| Total | 100 % | | 70,95 |

Comunicar como **70 %**, evitando la falsa precisión del decimal. El bloque
de informes tiene más peso por su extensión; no significa que esté certificado.
La integración transversal, seguridad y despliegue se evalúan como condiciones
de entrega y no como una familia equivalente del menú original.

## Evidencia revisada

- Origen: `C:/Xedit4/CONTABDSI/Source/CONTABDSI.PRG`, funciones ADM_LISTA,
  MENU_MOVI, MENU_CONSULTA, MENU_INFOR, MENU_REPRO, MENU_CIERRE, MENU_MEDIOS
  y MENU_CONSO.
- Destino: `Interface_web/src/components/Shell.tsx`, `src/App.tsx`, páginas
  correspondientes, clientes API, `backend/app.py` y repositorios citados.
- Auditoría del 21 de septiembre: útil como antecedente, pero desactualizada
  para varios catálogos y procesos posteriormente implementados. No se
  reutiliza su conteo de 705 controles como porcentaje actual.
- Hay 54 archivos `test_*.py` y 195 decoradores de rutas en app.py. Son
  inventario técnico, no una medida de avance ni una garantía de cobertura.

## Cobertura y brechas

### Movimiento

Captura, lotes, anulación, importaciones y reembolsos tienen integración real.
Faltan revisar y conectar ayudas secundarias de CapturaDirecta: guardar borrador
llama a onCrearLote y App mantiene ese lote en memoria; las plantillas,
portapapeles y listado de movimientos de apoyo conservan datos de muestra.
No confundir esas ayudas con la contabilización principal, que sí está migrada.
Importaciones acepta XLSX, CSV, TXT y ADT; resta comparar las variantes originales
y el ciclo completo con archivos representativos.

### Consultas

Las ocho primeras consultas originales tienen pantalla específica. Comparativos
reúne dos contabilidades, centros entre contabilidades y dos meses. Eso cubre
las once entradas originales a nivel de estructura funcional; queda comprobar
filtros, totales, búsquedas y rendimiento con casos equivalentes al original.

### Informes

Existe implementación extensa del menú 1–R: documentos, balances, auxiliares,
IVA, retenciones, terceros, centros, diarios, análisis anual y flujo. El código
excluye explícitamente dos salidas NIC (PENDING_NIC_IDS). El generador
personalizado y portal externo continúan fuera de la entrega acordada.
La impresión por defecto no equivale al editor de formatos original.
Una cobertura alta no acredita todavía igualdad numérica y visual de cada
variante: hace falta una matriz Harbour/web/PDF/XLSX con datos idénticos.

### Definiciones

Parámetros, cuentas, terceros, comprobantes, centros, documentos, retenciones,
IVA, plantillas originales y creación de compañías tienen integración.
RenglonesRenta y FormatosDocumentales aún usan localStorage. Faltan reasignación
de NIT, traslado/limpieza de compañías y análisis adicionales del plan/movimiento.
Una ruta genérica de backend no cierra el pendiente si la web no la utiliza o
si su rama Advantage no está operativa.

### Medios magnéticos

Hay integración de formatos, conceptos, asignación manual, copia de definiciones
y generación: cinco de las doce hojas operativas del menú original. Las otras
siete entradas se encaminan al componente MediosMagneticos, que muestra
«pendiente de migración»: revisión, detalle por tercero, totales por tercero,
formato/tercero, documento, depuración por topes y cruce de terceros.
La generación sola no completa el circuito de preparación y revisión de medios.

### Reprocesos y mantenimiento

Reprocesos.tsx habilita reproceso mensual y análisis documentos/movimiento.
Las demás tarjetas no están disponibles. Reorganización e índices constituyen
avance real, pero deben validarse recuperación de ADI, bloqueo y concurrencia
en copia de la base. Es necesario mapear REPRO01/REPRO02 y sus variantes antes
de duplicar algoritmos ya cubiertos por el modelo consolidado.

### Especiales y reclasificación

Especiales solo permite ejecutar la extracción unificada de comprobante,
documento y movimiento completo. El resto aparece pendiente. Reclasificaciones
usa datos mock y genera un lote en memoria. Revisar qué utilidades de carpetas
o meses separados ya no aplican y acordar su sustitución; no descontarlas
silenciosamente del alcance original.

### Cierres y consolidación

Las páginas actuales son asistentes locales. Los repositorios de backend
declaran su rama Advantage no soportada; tener rutas o pruebas de contratos
PostgreSQL no implica que estos procesos funcionen con las tablas actuales.
Falta cierre anual, comprobante de cierre, traslado 13–18 y consolidación
adaptada al aislamiento por CIA.

### Condiciones transversales para entregar

Existen AccessGate y access_session para Fortuner y administrador. Falta
verificar protección efectiva de todos los endpoints: en app.py se ve el router
de acceso, pero no una dependencia/middleware global de autorización. No basta
el bloqueo de React. UsuariosPermisos sigue declarando operaciones simuladas;
definir responsabilidades de Fortuner para no duplicar administración.
Revisar bitácora e integraciones antes de anunciarlas como operativas.
Instaladores de producción/desarrollo existen; la conexión en cada servidor,
conectores x64, credenciales, HTTPS y recuperación deben ser pruebas de aceptación.

## Verificación ejecutada

28 pruebas unitarias correctas mediante unittest: test_medios_generacion,
test_auditoria_documentos_movimiento, test_informes_k_m_original,
test_informes_terceros_repository, test_informes_centros_repository y
test_report_snapshots. Son pruebas con cálculos/mocks y temporales, no
contabilizaciones reales. No se modificaron tablas Advantage.
La ejecución con pytest no se pudo realizar porque no está instalado en el
entorno actual; no se instalaron dependencias para esta auditoría.

## Plan de entrega recomendado

1. Depurar promesas: ocultar o marcar demostraciones; persistir el borrador real;
   probar el flujo documento/lote/anulación y aislamiento CIA; cerrar acceso API.
2. Completar cierres y saldos iniciales, con conciliación antes/después y respaldo.
3. Completar las siete etapas restantes de medios magnéticos.
4. Migrar reclasificaciones y especiales prioritarios, no utilidades obsoletas
   automáticamente. Acordar equivalencias para el modelo compartido.
5. Completar definiciones pendientes y consolidación si se incluye en la entrega.
6. Homologar todos los informes y consultas y probar volumen/concurrencia,
   instalación limpia, reinicio y recuperación.

No asignar fechas ni prometer 100 % antes de estimar cada pendiente. Mantener
por separado «implementado», «probado en Advantage» y «aceptado por contabilidad».
Los informes NIC, generador personalizado y otras exclusiones requieren una
decisión expresa para definir qué significa el 100 % del alcance contratado.
