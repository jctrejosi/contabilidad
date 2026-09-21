# Base de datos — CONTABDSI

Modelo de datos de **CONTABDSI** (contabilidad general empresarial),
organizado en **modelo lógico neutro** (fuente de verdad) + **una carpeta de
implementación por motor**.

## Estructura

```
db/
  README.md                 # este índice
  VALIDACION_HALLAZGOS.md   # dictamen B01–B15 contra el plan de migración
  general/                  # ★ MODELO LÓGICO NEUTRO (fuente de verdad, sin atar a un motor)
    00_convenciones.md      #   tipos lógicos, esquema único, auditoría, catálogos
    01_entidades.md         #   las 60 entidades: campos, PK/UK/FK, checks
    02_indices.md           #   índices lógicos con propósito (sin sintaxis de motor)
    03_reglas_negocio.md    #   validar / contabilizar / anular / regenerar
    modelo.json             #   catálogo machine-readable (60 entidades, validado)
    diagrama.md             #   ERD neutro en Mermaid (9 módulos)
    mapeo_motores.md        #   tipo lógico → PostgreSQL / Advantage (+ futuros)
    referencia_ansi.sql     #   DDL ANSI de REFERENCIA (documentación, no ejecutable)
  postgresql/               # Implementación PostgreSQL 18 (validada end-to-end)
    schema/                 #   01_dominios … 11_ampliaciones (+ 10_indices)
    funciones.sql           #   validar_lote, contabilizar_lote, anular_documento, regenerar_acumulados
    seed.sql                #   datos demo (001 Demo S.A.S., NOM2, CE-000245)
    scripts/
      up.sh                 #   clúster local efímero: carga todo y valida (11 pruebas)
      validate.sql          #   validación funcional del flujo contable
    docker-compose.yml      #   PostgreSQL 18 para otros desarrolladores (opcional)
  advantage/                # Diccionario Advantage ADS (motor de ORIGEN del legado)
    README.md               #   propósito, limitaciones y relación con general/
    01_tablas.sql           #   las 60 tablas en DDL de diccionario ADS
    02_indices.sql          #   índices del diccionario (PK, UK, consulta)
  old_db/                   # Plan de migración desde el legado (fuente de hallazgos B01–B15)
  migration/                # Plan de migración DE DATOS (evaluación de la fuente y ejecución)
     README.md              #   veredicto, índice y bloqueo del motor Advantage
     01_inventario_fuente.md       #   qué trae y qué no trae ADD_CONTAB
     02_consideraciones_previas.md #   qué resolver antes de cargar un solo registro
     03_plan_de_carga.md           #   fases, orden, contrato del cargador, corte
     04_transicion_del_backend.md  #   de Advantage a PostgreSQL en los servicios
     05_montar_advantage_local.md  #   qué instalar y cómo abrir el diccionario en local
     extractor/                    #   inspector de cabeceras y contrato del extractor
```

> ⚠️ **`old_db/` es contexto congelado del legado**: no se edita. Sus referencias
> internas a `schema/`, `scripts/`, `funciones.sql`… corresponden al layout
> original (antes de la reorganización); hoy esos archivos viven en
> `db/postgresql/`. Si un documento necesita la ruta actual, se anota aquí, no
> se modifica el documento fuente.
>
> **`migration/` es el plan operativo de datos**: traduce `old_db/` al trabajo de
> carga y evalúa la fuente realmente disponible (`ADD_CONTAB/`). Las
> correcciones y ampliaciones se escriben allí, no en `old_db/`.

## Flujo de diseño (cómo se usa esto)

1. **`general/`** es el contrato: si una entidad, campo o regla cambia, cambia
   primero aquí (documentos + `modelo.json`) y después se propaga a los motores.
2. **`postgresql/`** es la implementación de referencia: completa, probada
   (11 pruebas funcionales) y la que usará el backend de producción.
3. **`advantage/`** documenta el diccionario equivalente para instalaciones
   que conserven ADS. Advantage es el motor de **origen** de la migración, no
   el destino recomendado.
4. Nuevos motores (MySQL, SQL Server…): copiar `general/` → carpeta nueva y
   traducir con la guía de `general/mapeo_motores.md`.

## Uso rápido (PostgreSQL)

```bash
cd db/postgresql
bash scripts/up.sh    # crea clúster local efímero en ./.pgdata (puerto 5433),
                      # carga esquema+funciones+seed y ejecuta las 11 validaciones
```

La validación recorre el flujo completo del lote NOM2: validación con 2
errores → corrección → verificación → aprobación → contabilización atómica
(CE-000245 / NOM-2026-02) → idempotencia → cuadratura → anulación con
reversión → restricciones de integridad.

```bash
psql -h localhost -p 5433 -U contabdsi -d contabdsi
```

> ⚠ `up.sh` hace `dropdb`: es bootstrap de demostración; NUNCA apuntarlo a
> producción (ver hallazgo B15). El migrador real es una unidad de trabajo
> separada (`old_db/`).

## Convenciones transversales

- Esquema **único** con `compania_id` (una tabla por entidad para todas las
  empresas; nada de un schema/carpeta por compañía como VISION).
- Nomenclatura en español; dinero `NUMERIC(18,2)` (nunca float); porcentajes
  como fracción `NUMERIC(9,6)`.
- Auditoría en toda fila (`creado_en/creado_por/actualizado_en/actualizado_por/
  version`) con disparador que avanza `version` (concurrencia optimista).
- Estados como `texto + CHECK` (no enums nativos): más fácil de migrar.
- **Saldos y acumulados son derivados del libro**: se reconstruyen con
  `regenerar_acumulados()`; "limpiar acumulados" nunca toca el libro.
- Idempotencia: `idempotency_key` en lotes y documentos + unicidad de
  `origen_referencia` (un archivo/operación no se carga dos veces).
- FK compuestas `(compania_id, id)`: a nivel de motor es imposible que una
  línea de la empresa 001 referencie maestros de la 002.
- Un documento contabilizado es **inmutable**; la corrección es anulación con
  reversión trazable (`REV-…`), nunca DELETE.

## Mapeo con el legado VISION/FORTUNER

El legado usaba un archivo DBF/ADT por tabla y una carpeta por compañía
(`C:\VISION20\CONTAB\001\`) sobre Advantage. El mapeo campo a campo está en
los comentarios de `postgresql/schema/*.sql` (`CONCTR.CTCIA`, `CTNIT`,
`VISDOCUM`, `CONPUC`, `CONMAE`, …) y la matriz completa en `old_db/`.
