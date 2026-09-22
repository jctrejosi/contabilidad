# Cambios pendientes en la base Advantage

Lo que habría que implementar en los `.ADT` del legado para que las rutas que hoy
quedan **solo PostgreSQL** funcionen también en Advantage. Es un backlog de
esquema, no un plan de trabajo: cada fila se puede ejecutar por separado y ninguna
bloquea al modelo nuevo (que ya funciona sin ella).

Regla de lectura: mientras un cambio no esté aplicado, la ruta afectada **no
falla en silencio**; responde 409/422/503 con la causa (R10 del plan).

---

## 1. Columnas faltantes en tablas existentes

| Tabla ADS | Falta | Para qué rutas | Evidencia |
|---|---|---|---|
| `CONTIIVA` | `CUENTA` | tarifas-iva (GET/POST/PUT) | `backend/tarifas_iva_repository.py:171` |
| `CONTIRET` | `CUENTA`, `BASEMIN` | conceptos-retención | `backend/conceptos_retencion_repository.py:194,199` |
| `CONDECLA` | `CUENTA`, `SIGNO` | renglones-renta | `backend/renglones_renta_repository.py:153,158` |
| `CONGENF` | `COMPRO` (comprobante) | formatos-documentales | `backend/formatos_documentales_repository.py:262` |
| `CONFORMA` | geometría (`ANCHO`, `ALTO`) y catálogo de los 8 tipos | formatos-documentales (elementos) | cabecera de `backend/formatos_documentales_repository.py` |
| `VISDOCUM` | columnas de tercero/centro obligatorio | tipos-documento | `backend/tipos_documento_repository.py:147` |
| `CONEMP` | `soloConsolidacion` y tabla de años | compañías | `backend/ads_repository.py:330` |
| `CONMAG1` | `CIA`, `VIGENCIA`, `ESTADO` | impuestos/formatos | `backend/impuestos_repository.py:747,810,842,859` |
| `CONMAG2` | `CIA`, `CUENTA` | impuestos/conceptos | `backend/impuestos_repository.py:958,1156` |
| `CONMAG3` | `CIA` (y rango `CUENTA..CUENTA2`) | impuestos/asignaciones | `backend/impuestos_repository.py:1086` |
| `CONMAGDT` | `CIA`, número de generación, `ESTADO` | impuestos/medios | `backend/impuestos_repository.py` (mensaje de medios) |
| `CONIVA` | `CIA`, tarifa, período, generado/descontable | impuestos/acumulados-iva | `backend/impuestos_repository.py:138,637` |
| `CONRET` | `CIA`, concepto, tarifa | impuestos/acumulados-retenciones | `backend/impuestos_repository.py:708` |
| `CONCECOS` | `PADRE` | centros (hoy se **deriva** del prefijo de 2 caracteres) | `backend/centros_repository.py:156` |
| `CONMAE` | clasificación NIIF y corriente (37 campos descartados en la migración) | informes NIIF (A5) | `backend/informes_adicionales_repository.py:433-441` |

Nota `CONCECOS`: no es un bloqueo. La jerarquía se deriva del prefijo y el alta
declara la limitación; añadir `PADRE` sólo la haría explícita.

## 2. Banderas de baja lógica ausentes

En el modelo nuevo las bajas son **lógicas** (`eliminado_en`), pero estas tablas
del legado no tienen bandera, así que en Advantage la baja es **física** (y el
código queda reutilizable, al contrario que en PostgreSQL). Añadir la bandera
alinearía el comportamiento:

| Tabla ADS | Ruta | Evidencia |
|---|---|---|
| `FADCLI` | terceros | `backend/terceros_repository.py:531` |
| `CONTIIVA` | tarifas-iva | `backend/tarifas_iva_repository.py:317` |
| `CONTIRET` | conceptos-retención | `backend/conceptos_retencion_repository.py` |
| `CONDECLA` | renglones-renta | `backend/renglones_renta_repository.py:16,298` |
| `CONMAG1` | impuestos/formatos | `backend/impuestos_repository.py:935` |
| `VISDOCUM` | plantillas-contables, tipos-documento | `backend/plantillas_contables_repository.py` |
| `CONCECOS`, `CONTICOM` | centros, comprobantes (la baja no está pedida por ningún control) | sección 6 del plan |

## 3. Tablas nuevas requeridas

Sin contraparte legada; mientras no existan, la ruta es solo PostgreSQL.

| Tabla(s) propuesta(s) | Para | Registro | Estado legado |
|---|---|---|---|
| `CONFLUJ`, `CONNIIF`, `CONNIIRC` | informes de flujo de caja y NIIF (A5) | `15_flujo_caja_niif.md` | no existen |
| ampliar `CONSOLID` (identidad, año, estado, orígenes) y añadir las correspondencias | consolidación (D3) | `16_consolidacion_homologacion.md` | `CONSOLID` es "Parcial" y tiene **4 campos** (`CODIGO, NOMBRE, HIST, VALOR`): sin id, año, estado ni orígenes. Por eso **las 5 rutas de D3 son 503 en ADS** (P27) |
| reembolsos y su detalle | reembolsos (E2) | — | `CONREMAE`/`CONREITE`: "Sin estructura, estructura física no localizada" (P12, `db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md:58-59`) |
| `cierres`, `cierre_traslados` | cierres (D2) | — | sin contraparte |
| acceso por compañía del usuario | usuarios y permisos (D5) | — | aporte del modelo (`db/postgresql/schema/08_seguridad.sql:94-101`) |
| `integraciones` | integraciones (D7) | — | la contraparte del legado guarda configuración, no los registros del módulo (P30) |

## 4. No es esquema (código del lado ADS)

No se resuelven con DDL, pero dejan rutas solo PostgreSQL:

| Falta | Ruta | Nota |
|---|---|---|
| una operación `delete_account` sobre `CONMAE` | Especiales (cuentas en cero) | no existe en ningún repositorio de ADS |
| lectura de `VISAUDI` | D6 bitácora | `backend/auditoria_repository.py` hoy **solo escribe** en `VISAUDI` |

---

## Cómo se relaciona con el registro de cambios

- Los cambios **§3 de este archivo** que ya tienen DDL PostgreSQL están detallados
  en `15_flujo_caja_niif.md` y `16_consolidacion_homologacion.md`.
- Los **§1 y §2** nacen de las diferencias declaradas al implementar los bloques
  **B1, B2, B3 y D1**; su efecto visible es que esas rutas rechazan o degradan en
  Advantage con la causa declarada.
- El diccionario del legado y las brechas por proceso están en
  `db/old_db/DICCIONARIO_DEPURADO_CONTABDSI.md` y
  `db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`.
