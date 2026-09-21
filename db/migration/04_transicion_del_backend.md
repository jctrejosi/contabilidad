# Transición del backend: de Advantage a PostgreSQL

Migrar los datos **no** cambia lo que usa la aplicación. Hoy los servicios leen y
escriben en Advantage con ADO; este documento describe qué hay que hacer para que
consuman el modelo nuevo, y en qué orden.

## 1. Situación actual

| Elemento | Estado |
|---|---|
| Capa de acceso | **15 módulos** `backend/*_repository.py` sobre ADO/OLEDB (`pythoncom`, `win32com.client`) |
| Candado de escritura | `backend/accounting_lock.py` (serializa captura directa y reproceso, que recalculan los mismos acumulados) |
| Driver PostgreSQL | **Ninguno**: `backend/requirements.txt` no incluye `psycopg`/`asyncpg`/SQLAlchemy |
| Origen de los datos | Advantage (`CONMAE`, `CONEMP`, `FADCLI`, `VISDOCUM`, `CONTICOM`, `MOV01`, `CONTERCE`, `COCENTRO`, `CONDOCUM`, `CONCTR`, `CONLOTES`…) |
| Contrato con la interfaz | JSON de `backend/app.py` (34 endpoints) — **el frontend depende de él tal cual** |

Los módulos no son genéricos: el SQL está en dialecto ADS (`SELECT TOP n`,
parámetros ADO con tipo y longitud, `f"CT{mes:02d}"` para las columnas mensuales,
créditos almacenados en negativo) y las escrituras usan transacciones ADO. No es
un cambio de cadena de conexión.

## 2. Qué NO se puede hacer

- **Cambiar `ADS_*` por una cadena de PostgreSQL**: el código no sabe hablar SQL
  estándar ni tiene driver.
- **Los dos motores a la vez**: legado y PostgreSQL como escritores simultáneos
  del mismo proceso es exactamente lo que prohíbe la regla 10.1 del plan maestro.
- **Migrar los datos y dejar el backend igual**: seguiría leyendo los `.ADT`.

## 3. Estrategia recomendada: por módulo, no por big-bang

Sustituir la capa de datos **módulo a módulo**, manteniendo intacto el contrato
HTTP para no tocar el frontend. Orden propuesto (de menos a más riesgo):

| Orden | Módulo | Endpoints | Comentario |
|---:|---|---|---|
| 1 | `ads_repository` (compañías) | `/api/companias` | El login; hoy resuelto con `ADS_DEV_FALLBACK=1` en desarrollo. En PostgreSQL sale de `companias` |
| 2 | `tipos_documento`, `centros`, `comprobantes`, `terceros` | catálogos | Solo lectura en su mayoría |
| 3 | `ads_repository` (plan de cuentas) | `/api/cuentas` | Requiere despivotar `MACMDEB/CRE` a filas |
| 4 | `movimiento_mensual`, `documentos`, `balance_comprobacion` | consultas | Lectura pura sobre el libro |
| 5 | `lotes`, `importaciones`, `contabilizacion` | **escritura** | El núcleo del riesgo: B01/B02/B06 |
| 6 | `anulacion`, `reproceso_mensual`, `parametros_operacion` | escritura | Depende de que los derivados sean reconstruibles (B02/B03) |

`balance_comprobacion_repository` es la pieza de contraste ideal: el mismo
informe sobre ADS y sobre PostgreSQL es una conciliación de migración lista para
usar.

## 4. Trabajo técnico requerido

1. **Driver y capa de datos**: añadir `psycopg` (o `asyncpg`) y una capa de
   conexión/pool con la misma interfaz que hoy exponen los repositorios.
2. **Configuración**: sustituir `ADS_*` por `DATABASE_URL` (o `PG*`) en
   `backend/.env`, sin borrar las claves de ADS hasta cerrar el corte.
3. **Traducir el SQL**, endpoint por endpoint:
   - `SELECT TOP 1` → `LIMIT 1`.
   - Columnas mensuales `MACMDEB01..12` → filas de `saldos_cuenta`.
   - Créditos negativos → `debito`/`credito` separados (`TVALOR` desdoblado).
   - `CONMAE.NITN` de 15 espacios o `NULL` → relación con `terceros` por id.
   - `HABILITA` → `companias.estado = 'Activa'` (el JSON debe seguir exponiendo
     `habilitada: boolean` para no romper la pantalla de selección).
4. **Escrituras y concurrencia**: `accounting_lock.py` existe porque dos
   operaciones recalculan las mismas filas de acumulados. En PostgreSQL eso se
   resuelve con transacción y bloqueo (`FOR UPDATE`) en las funciones
   `contabilizar_lote`/`anular_documento`/`regenerar_acumulados`, que además
   deben corregirse antes (B01–B03).
5. **Idempotencia**: el nuevo modelo ya define `idempotency_key` y
   `origen_referencia` únicos; hay que cablearlos en importaciones y lotes.
6. **`/api/health`**: pasa a comprobar la conexión a PostgreSQL en lugar de
   `CONMAE`.

## 5. Pruebas de equivalencia

- **Doble lectura temporal**: durante el piloto, cada endpoint migrado se ejecuta
  contra ambos motores y se comparan las respuestas (mismos filtros, mismos
  totales). Diferencias explicadas una por una, no promediadas.
- **Contrato intacto**: el frontend no debe requerir cambios; si un campo cambia
  de forma, se adapta en la capa HTTP, no en React.
- **Pruebas negativas**: período cerrado, cuenta de otra compañía, documento
  anulado, lote descuadrado (T03–T09).
- **Carga**: medir los informes más pesados (movimiento mensual, balance) contra
  volúmenes reales antes de prometer tiempos.

## 6. Durante la migración de datos

- El backend debe **dejar de escribir** en Advantage antes de la instantánea
  final (regla 10.1). Mientras el ETL corre, la aplicación entra en solo lectura
  o se detiene según la ventana aprobada.
- `ADS_DEV_FALLBACK` es una ayuda de desarrollo **temporal**: debe quitarse cuando
  `/api/companias` lea del modelo nuevo.
- No mezclar datos de demostración con reales: `seed.sql` y `scripts/up.sh`
  (que hace `dropdb`) son bootstrap, no migrador (B15).

## 7. Riesgos específicos

| Riesgo | Mitigación |
|---|---|
| Divergencia funcional silenciosa entre motores | Doble lectura + conciliaciones del §9 del plan maestro |
| Escritura doble (ambos motores) | Un único escritor por proceso, decidido en la ventana de corte |
| Campos del legado sin equivalente (B04/B11) | Completar el modelo **antes** de migrar, no después |
| Rendimiento distinto en informes | Pruebas de carga con volúmenes reales |
| Rollback imposible tras operaciones nuevas | Plan de retorno probado (regla 10.7) y autoridad de decisión fijada |

## 8. Estado de la implementación

El mecanismo de motor intercambiable **ya está implementado**, con el primer
módulo migrado:

| Pieza | Dónde |
|---|---|
| Selector de motor | `backend/store.py` (`CONTABDSI_STORE` = `ads` \| `postgres`) |
| Repositorio PostgreSQL | `backend/postgres_repository.py` (driver `psycopg`) |
| Driver declarado | `psycopg[binary]` en `backend/requirements.txt` |
| Endpoints migrados | `/api/health` y `/api/companias` |

Verificado con los dos motores:

| `CONTABDSI_STORE` | `/api/companias` | Origen informado |
|---|---|---|
| `postgres` (activo en `backend/.env`) | `200` con los datos de `companias` | `source: "companias"` |
| `ads` | `200` | `source: "CONEMP"`, o `"DEMO"` si no hay motor y `ADS_DEV_FALLBACK` está activo |

La variable del proceso tiene precedencia sobre `backend/.env`, así que alternar
en caliente es `set CONTABDSI_STORE=ads` (o `postgres`) antes de arrancar.

**Patrón para el resto de módulos:** añadir la operación a `store.py` con su
dispatcher y su implementación en `postgres_repository.py`, sin tocar el
contrato JSON ni React. El orden recomendado es el de la tabla de §3.

Lo que **no** cambia con esto: la migración de datos sigue bloqueada (leer
`ADD_CONTAB` exige el motor Advantage), y los módulos de escritura dependen de
corregir antes B01–B15, porque son los que cambian saldos y numeración.
