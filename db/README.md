# Base de datos — CONTABDSI

Esquema completo de la base de datos para **CONTABDSI** (contabilidad general empresarial).

- **Motor:** PostgreSQL 18
- **Modelo:** esquema único con `company_id` (una sola tabla por entidad, todas las compañías comparten las tablas y se distinguen por `company_id`)
- **Nomenclatura:** español (`companias`, `cuentas`, `terceros`, `lotes`, `documentos`, …)
- **Contratos preservados:** importes `NUMERIC(18,2)` (nunca float), claves por compañía/año, control de versión optimista (`version`), idempotencia (`idempotency_key`), contabilización atómica, bitácora de auditoría.

## Estructura

```
db/
  schema/
    01_dominios.sql        # dominios y disparadores de auditoría
    02_nucleo.sql          # companias, compania_anios, periodos, parametros
    03_maestros.sql        # cuentas, terceros, centros, comprobantes, retenciones, IVA, plantillas, formatos
    04_movimientos.sql     # lotes, líneas, validaciones, documentos, reversiones
    05_saldos.sql          # saldos y acumulados (derivados, regenerables)
    06_impuestos.sql       # medios magnéticos y conciliación
    07_procesos.sql        # reprocesos, cierres, consolidación
    08_seguridad.sql       # usuarios, roles, permisos, bitácora, integraciones
    09_presupuesto.sql     # presupuesto jerárquico (feature flag)
  funciones.sql            # validar_lote, contabilizar_lote, anular_documento, regenerar_acumulados
  seed.sql                 # datos de demostración (001 Demo, NOM2, CE-000245)
  diagrama.md              # ERD en Mermaid
  scripts/
    up.sh                  # levanta clúster local efímero y carga todo + valida
    validate.sql           # validación funcional del flujo contable
  docker-compose.yml       # PostgreSQL para otros desarrolladores (opcional)
```

## Uso rápido

```bash
cd db
bash scripts/up.sh          # crea clúster local, carga esquema+datos y ejecuta la validación
```

La validación recorre el **flujo completo del lote NOM2** en SQL:

1. Lote cuadrado con **2 errores** (centro en línea 3, tercero en línea 9).
2. Corregir → `validar_lote()` → estado **Verificado**.
3. Aprobar → `contabilizar_lote()` → documento **CE-000245 / NOM-2026-02** + saldos actualizados (atómico).
4. Reintento de contabilización → **rechazado por idempotencia**.
5. Cuadratura de libro y saldos.
6. `anular_documento()` → reversión trazable, original no se borra.
7. Restricción: no se puede borrar una cuenta con hijas.

Para conectarte manualmente:

```bash
psql -h localhost -p 5433 -U contabdsi -d contabdsi
```

## Convenciones transversales

- Toda tabla lleva columnas de auditoría: `creado_en`, `creado_por`, `actualizado_en`,
  `actualizado_por` y `version`. El disparador `auditoria_antes_update()` mantiene
  `actualizado_en` y avanza `version` (base para el control de concurrencia optimista).
- Maestros editables usan `eliminado_en` (borrado lógico) y restricciones que impiden
  eliminar registros con dependencias (p. ej. cuentas con hijas/saldo/movimiento).
- Estados como `TEXT + CHECK` (no enums nativos), más fáciles de migrar.
- Los **saldos y acumulados son derivados del libro** y se reconstruyen con
  `regenerar_acumulados()`; "limpiar acumulados" no toca el libro.
- Dinero: `dinero` = `NUMERIC(18,2)`; porcentajes: `porcentaje` = `NUMERIC(9,6)` (fracción).

## Mapeo con el legado VISION/FORTUNER

El sistema legado usaba un archivo DBF por tabla y una carpeta por compañía
(`C:\VISION20\CONTAB\001\`). El mapeo principal está en `schema/02_nucleo.sql`
(comentarios `CONCTR.CTCIA`, `CTNIT`, `CTDIREC`, `CTANO`, `CT00…CT12`, etc.).
La estructura aquí normaliza esas tablas planas a un modelo relacional.

## Decisiones pendientes de confirmar

- Servidor real (este esquema usa un clúster local efímero para validar).
- Autenticación y Row-Level Security por compañía si se expone a varios clientes.
