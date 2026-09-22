# 15 · Flujo de caja y rubros NIIF

## Objeto

Tres tablas nuevas que el modelo no tenía y que alimentan los informes que hoy
figuran "Pendiente" en `Informes.tsx`.

| Tabla | Qué guarda |
|---|---|
| `flujo_caja_renglones` | un renglón por línea del estado de flujo de efectivo, con la cuenta del plan que lo alimenta, su grupo (Operación/Inversión/Financiación) y su signo |
| `rubros_niif` | los rubros NIIF por compañía para ESFA y estado de resultados |
| `rubro_niif_cuentas` | la asignación de cuentas del plan a cada rubro |

## Motivo (evidencia)

- `backend/informes_adicionales_repository.py:433-441`: el flujo de caja "requiere
  la definición de cuentas del sistema original" y los informes NIC/NIIF
  "requieren configurar la clasificación contable y los tipos documentales".
- `db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md` (CONMAE): "faltan reglas/campos fiscales,
  NIIF, clasificación corriente".
- `db/migration/homologacion/PENDIENTES.md:98`: se cerró **no** modelar los 37
  campos NIIF de CONMAE en `cuentas`; la clasificación va como asignación aparte.

## DDL PostgreSQL

En `db/postgresql/schema/15_flujo_caja_niif.sql`. Aditivo: **ninguna columna nueva**
sobre tablas existentes.

## Endpoints que lo usan

| Endpoint | Tablas |
|---|---|
| `GET /api/flujo-caja-renglones`, `PUT /api/flujo-caja-renglones` | `flujo_caja_renglones` |
| `GET /api/rubros-niif`, `PUT /api/rubros-niif` | `rubros_niif`, `rubro_niif_cuentas` |

Bloque **A5** del plan. Es lo último que falta de los seis informes "Pendiente"
(el tercero, `acum-corriente`, usa `cuentas.clasificacion_corriente`, que ya
existe; el sexto queda fuera de alcance).

## Contraparte requerida en Advantage

**El legado no tiene estas tablas.** El plan las marca `requiere tabla nueva en
ADS`, así que mientras no se creen en Advantage, esas cuatro rutas son **solo
PostgreSQL**.

Para alcanzar paridad hay que crear en Advantage tres tablas equivalentes. Los
nombres son una **propuesta** (el legado usa el prefijo `CON` + 6–8 caracteres:
`CONMAE`, `CONTIIVA`, `CONDECLA`, `CONSOLID`, `CONREMAE`), y deben decidirse al
implementarlas:

| Tabla propuesta | Equivale a | Campos mínimos |
|---|---|---|
| `CONFLUJ` | `flujo_caja_renglones` | `CIA`, `CODIGO`, `NOMBRE`, `GRUPO`, `ORDEN`, `CUENTA`, `SIGNO` |
| `CONNIIF` | `rubros_niif` | `CIA`, `CODIGO`, `NOMBRE`, `INFORME`, `TIPO`, `ORDEN` |
| `CONNIIRC` | `rubro_niif_cuentas` | `CIA`, `CODIGO` (rubro), `CUENTA` |

Alternativa declarada: **dejar estos informes solo en PostgreSQL**. El plan ya lo
contempla; no es una carencia del código sino del esquema del legado.
