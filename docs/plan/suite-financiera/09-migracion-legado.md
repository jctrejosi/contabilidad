# 09 — Migración desde Advantage y puesta en producción

## 1. Punto de partida

CONTABDSI convive hoy con dos motores:

- **Advantage Data Server (ADS):** origen legado, archivos `.ADT`, acceso por
  OLEDB/ODBC solo en Windows.
- **PostgreSQL:** modelo nuevo, 60 entidades, usado para desarrollo y validación.

El backend despacha por operación entre ambos (`CONTABDSI_STORE`). La suite
financiera no puede depender de esa dualidad: **PostgreSQL es el destino
canónico** y ADS queda como fuente de lectura para migración y convivencia.

## 2. Principios

1. **Sin doble escritura.** Un dato se escribe en un solo motor.
2. **Corte por módulo.** Cada módulo se migra, se concilia y se corta.
3. **Conciliación formal.** Contador/revisor firma antes de producir.
4. **Reversibilidad.** Cada corte tiene rollback documentado.
5. **Datos maestros primero.** Sin maestros confiables no se migran saldos.
6. **Historia completa.** Se migran documentos y saldos necesarios para
   trazabilidad y obligaciones legales; no se reconstruye lo que no existe.
7. **Idempotencia.** La carga se puede repetir sin duplicar.

## 3. Olas de migración

| Ola | Contenido | Depende de |
|---|---|---|
| M0 | Compañías, años, periodos, monedas, parámetros | — |
| M1 | PUC, terceros, centros, diarios, tipos de documento, condiciones | M0 |
| M2 | Saldos iniciales por cuenta/tercero/centro | M1 |
| M3 | Documentos históricos y asientos | M1, M2 |
| M4 | CxC/CxP abiertas y vencimientos | M3 |
| M5 | Bancos, extractos y conciliaciones abiertas | M3, M4 |
| M6 | Activos fijos y tablas de depreciación | M3 |
| M7 | Presupuesto y compromisos | M1 |
| M8 | Impuestos: acumulados, exógena, medios | M3 |
| M9 | Seguridad, usuarios y auditoría | M0 |
| M10 | Secuencias y resoluciones DIAN | M1 |

## 4. Pipeline ETL

```text
Advantage
   ↓ extracción (consultas por tabla, ventanas de fecha)
Staging PostgreSQL (tablas crudas, sin reglas)
   ↓ perfilado y calidad
Transformación (mapeo, normalización, deduplicación)
   ↓ validación de reglas contables
Carga al modelo destino (idempotente)
   ↓ conciliación
Reporte de diferencias → corrección → recarga
   ↓ firma del contador
Corte del módulo
```

### 4.1 Reglas del ETL

- Cada ejecución tiene `id`, parámetros, conteos y hash.
- Las tablas de staging no se mezclan con el modelo operativo.
- La carga usa claves naturales y `upsert` idempotente.
- Los errores se registran por fila con causa; no se detiene todo por una fila
  salvo que viole una regla crítica.
- Los archivos de origen se conservan con hash.
- No se transforman datos sin trazabilidad (origen → destino).

## 5. Mapeo de datos

| Origen ADS | Destino | Regla |
|---|---|---|
| `CONEMP` | `core.compania` | Normalizar NIT, DV, régimen, moneda |
| `CONMAE` | `mst.cuenta` | Jerarquía por código, flags, afectable |
| `FADCLI` | `mst.tercero` | NIT único, DV, municipio, responsabilidades |
| `CONCECOS` | `mst.centro` | Jerarquía por prefijo, estado |
| `CONTICOM` | `mst.diario` | Tipo, secuencia, cuenta contrapartida |
| `VISDOCUM` | `mst.tipo_documento` | Flujo, DIAN, contabiliza |
| `MOV01` | `led.asiento`/`linea` | Fecha, cuenta, tercero, centro, débito/crédito |
| `CONMOVI`/`CONLOTES` | `led.lote`/`linea` | Solo lotes abiertos; cerrados van a historia |
| `CONSALDO`/acumulados | `led.saldo_*` | Recalcular desde MOV01 y comparar |
| `CONTERCE` | `ar.cxc`/`ap.cxp` | Partidas abiertas y vencimientos |
| `CONIVA`/`CONRET` | `tax` | Acumulados y certificados |
| `CONMAG*` | `tax.media_*` | Generaciones y filas |
| `CONSOLID` | `cls.consolidacion` | Configuración y orígenes |
| `VISAUDI` | `sec.auditoria` | Conservar actor, fecha y acción |

Los nombres definitivos se ajustan contra el diccionario real; este mapa es el
compromiso de destino.

## 6. Calidad de datos

### 6.1 Perfilado obligatorio

- Nulos e inválidos en NIT, DV, municipio, cuenta y tercero.
- Cuentas sin padre o con nivel inconsistente.
- Terceros duplicados por NIT.
- Documentos descuadrados o sin detalle.
- Fechas fuera de periodo.
- Saldos que no cuadran con movimientos.
- Secuencias duplicadas o con huecos.

### 6.2 Reglas de limpieza

1. No se inventan datos faltantes: se marca y se decide con negocio.
2. Duplicados se unifican con regla documentada y auditoría.
3. Cuentas obsoletas se inactivan, no se borran.
4. Documentos incompletos se excluyen con reporte y aprobación.
5. Todo ajuste de migración se registra como asiento de apertura o nota.

## 7. Saldos y partidas abiertas

1. Saldo inicial por cuenta = suma de movimientos históricos conciliados.
2. Saldo por tercero y centro se reconcilia por separado.
3. CxC/CxP abiertas se migran con: documento, tercero, fecha, vencimiento,
   importe original, saldo y estado.
4. Los pagos parciales se migran como aplicaciones.
5. Anticipos y notas se migran con su referencia.
6. Los saldos se cargan en un asiento de apertura auditado, no editando saldos.
7. La suma de partidas abiertas debe igualar el saldo contable de la cuenta.

## 8. Secuencias y documentos fiscales

1. Se migran resoluciones DIAN vigentes con rango y prefijo.
2. El siguiente número se toma del último documento válido + 1.
3. No se reutilizan números; no se corrigen huecos históricos.
4. Los documentos electrónicos conservan CUFE/XML si están disponibles.
5. Las notas crédito mantienen referencia al documento original.

## 9. Conciliación

### 9.1 Criterios de aceptación

| Conciliación | Criterio |
|---|---|
| Totales | Débitos = créditos del periodo migrado |
| Por cuenta | Saldo migrado = saldo calculado desde movimientos |
| Por tercero | Saldo por tercero = suma de partidas |
| Por centro | Saldo por centro = movimientos del centro |
| Documentos | Conteo y totales por tipo/comprobante |
| Impuestos | IVA/retenciones = acumulados del libro |
| Cartera/CxP | Abiertas = saldo contable |
| Activos | Costo y depreciación acumulada = libro |

### 9.2 Reporte de conciliación

Debe incluir:

- Periodo y compañía.
- Fuente y destino.
- Conteos y sumas.
- Diferencias por cuenta/tercero/periodo.
- Causa y acción.
- Firma del contador/revisor.

Sin conciliación firmada no hay corte.

## 10. Cutover

### 10.1 Preparación

1. Congelar escrituras en el módulo a cortar.
2. Ejecutar ETL final y conciliación.
3. Respaldar origen y destino.
4. Verificar secuencias y resoluciones.
5. Aprobar acta de corte.

### 10.2 Ejecución

1. Detener escrituras del módulo en el legado.
2. Ejecutar carga final idempotente.
3. Verificar conciliación y pruebas de humo.
4. Activar el módulo en PostgreSQL.
5. Redirigir la interfaz/API.
6. Monitorear 24–72 horas.

### 10.3 Rollback

- Se conserva el respaldo previo y el estado del legado.
- Si falla una verificación crítica, se reactiva el legado y se documenta.
- El rollback no debe perder escrituras nuevas: se concilian o se reprocesan.
- El procedimiento se prueba antes del corte real.

## 11. Convivencia

Durante la transición:

- Los módulos ya cortados escriben en PostgreSQL.
- Los módulos no cortados siguen en Advantage (solo lectura para la suite).
- No se sincronizan escrituras entre motores.
- Las consultas que cruzan módulos se resuelven en la suite con datos migrados.
- Un módulo cortado no vuelve al legado sin un rollback formal.

## 12. Post-cutover

1. Verificar saldos y reportes del primer cierre.
2. Comparar contra el último cierre del legado.
3. Revisar partidas conciliatorias y diferencias de cambio.
4. Validar declaraciones y exógena.
5. Documentar lecciones y ajustar runbooks.
6. Archivar evidencia de migración y conciliación.

## 13. Riesgos de migración

| Riesgo | Mitigación |
|---|---|
| Datos sucios | Perfilado temprano y decisiones de negocio |
| Diferencias de saldo | Conciliación por cuenta/tercero/periodo |
| Secuencias DIAN | Migrar resolución y último número; no reutilizar |
| Corte largo | Congelamiento planificado y comunicación |
| Pérdida de historia | Migrar documentos necesarios y archivar evidencia |
| Rollback fallido | Probar rollback antes del corte |
| Doble escritura | Regla arquitectónica y bloqueo de endpoints |
