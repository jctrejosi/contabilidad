# Plan de carga

Traducción operativa del plan maestro
([`../old_db/PLAN_MIGRACION_POSTGRESQL.md`](../old_db/PLAN_MIGRACION_POSTGRESQL.md) §7–§11)
para esta instalación. Las fases, el orden y el contrato del cargador **no se
redefinen aquí**: se concretan con lo que hay disponible en el repositorio.

## 1. Fases

| Fase | Trabajo | Condición de salida | Aquí |
|---|---|---|---|
| 0. Cerrar alcance | Empresas/años, rutas, módulos que siguen en el legado, historia requerida, ventana, RPO/RTO | Inventario firmado y decisiones registradas | **Pendiente** |
| 1. Perfilado solo lectura | Volúmenes, claves repetidas, huérfanos, borrados, fechas, signos, escalas | Informe por fuente y lista de excepciones | **Bloqueado** sin motor ADS |
| 2. Homologación funcional | Completar campo→destino→transformación→prueba | Ningún dato funcional sin destino aprobado | Parcial (406/2.663) |
| 3. Esquema y servicios | Corregir B01–B15, ampliar tablas, FK, índices, auditoría | Migraciones versionadas instalables en base vacía | **Pendiente** |
| 4. Ensayo del motor | PostgreSQL aislado, pruebas de lógica e integridad | Pruebas críticas en verde | No iniciada |
| 5. Extractor y staging | Instantánea consistente con lector Advantage + manifiesto | Extracción reproducible y sin modificar el origen | **Bloqueado** (§4 del README) |
| 6. Carga piloto | Una compañía/año representativos | Carga idempotente, rechazados explicados, conciliaciones exactas | No iniciada |
| 7. Validación de usuarios | Recorrer opciones y acciones con los mismos casos | Aceptación documentada por proceso | No iniciada |
| 8. Ensayo general | Todas las empresas/años, tiempos y restauración | Ventana y restauración probadas | No iniciada |
| 9. Corte productivo | Congelar, snapshot/delta, carga final, conciliación, habilitar | Acta GO firmada | No iniciada |
| 10. Estabilización | Legado en consulta, conciliación operativa, incidencias | Aceptación final y política de conservación | No iniciada |

## 2. Alcance del piloto con `ADD_CONTAB`

El piloto (fase 6) puede ejecutarse con la copia actual **limitado al núcleo**:

- **Entra**: `companias`/`compania_anios` (CONEMP), `periodos_contables` y
  `parametros_operacion` (CONCTR), `cuentas` y saldos (CONMAE/CONPUC),
  `terceros` (FADCLI), `centros_costos` (CONCECOS), `tipos_documento` y
  `comprobantes` (VISDOCUM/CONTICOM), `documentos`/`documento_lineas`
  (CONDOCUM + MOV00/MOV01), `lotes` (CONMOVI).
- **No entra** (sin fuente): impuestos, seguridad y auditoría, activos, exógena,
  formatos, reembolsos, presupuesto, consolidación, informes, años anteriores.
- Sirve para validar **transformaciones, conciliaciones y el contrato del
  cargador** con datos reales antes de pedir la copia completa.

## 3. Orden de carga

El del plan maestro (§7). Respetarlo importa porque las FK del destino son
compuestas `(compania_id, id)` y exigen que el maestro exista antes que el
movimiento:

1. Ejecución de migración, fuentes, compañías, años, períodos y usuarios.
2. Catálogos, terceros e identificadores, cuentas/jerarquía, centros,
   comprobantes/tipos y relaciones.
3. Parámetros, plantillas, reglas, formatos, exógena, presupuesto, activos y
   reembolsos.
4. Lotes pendientes y detalle; historia de estados.
5. Documentos y movimientos históricos **sin llamar a la contabilización normal**
   (no volver a publicar lo ya aplicado).
6. Aperturas, vínculo de reversiones/anulaciones y referencias cruzadas.
7. Reconstrucción completa de saldos/acumulados + comparación con instantáneas
   del origen.
8. Certificados, generaciones históricas, auditoría y archivos.
9. Consecutivos y secuencias ajustados **sin alterar la numeración histórica**.
10. Restricciones/índices restantes, estadísticas y pruebas.

## 4. Contrato mínimo del cargador

(§8 del plan, resumido como lista de aceptación)

- Identificador de ejecución y huella del conjunto fuente/transformaciones.
- Registro por archivo: ruta, empresa, año, entidad, formato, tamaño, hash y
  fecha de extracción.
- Por fila: localizador en la instantánea, clave de negocio cruda, flags,
  valores originales, resultado y destino.
- Equivalencias `source-key → id` persistentes (ámbito global/local).
- Rechazos con causa y responsable; nunca sustituir por datos de demostración.
- Idempotencia: repetir la ejecución no duplica ni asigna números nuevos.
- Registro de transformaciones, redondeos y correcciones aprobadas.
- Cargas reanudables por entidad/empresa/año, con transacciones y puntos de control.
- Permisos mínimos y secretos fuera del repositorio.

## 5. Pruebas

Las T01–T18 del plan maestro aplican tal cual. Las de mayor riesgo con estos
datos:

| ID | Por qué es crítica aquí |
|---|---|
| T01/T02 | Un lote puede producir varios documentos (B01); la cuadratura por documento es la que suele fallar |
| T04 | Aislamiento entre compañías: FK compuestas + validación de pertenencia (B05) |
| T09 | Anular y regenerar: el efecto neto debe cuadrar por cuenta, tercero, centro e impuesto (B02) |
| T11 | Apertura desde MOV00: no volver a sumar `MSALDO` |
| T12 | Signo de `TVALOR`, ceros y fraccionarios; sin truncamientos silenciosos |
| T17 | Reimportar la misma carga: conteos e IDs iguales |

Además: perfilar **antes** de decidir tipos (escala/rango real de los importes) y
probar con una compañía/año representativos, no con el volumen completo.

## 6. Conciliaciones

Las del §9 del plan. Como mínimo, diferencia cero en:

- Conteos por empresa/año/entidad con resultado (cargado, fusionado, derivado,
  excluido autorizado, rechazado): la suma debe explicar el universo fuente.
- Documento original ↔ documentos destino, con renglones, tipos, fechas, tercero
  y referencias.
- Débitos/créditos y apertura por empresa/año/período/cuenta, **y también por
  tercero y centro**, incluido el cruce conjunto.
- Balance de comprobación con los mismos filtros (el backend ya genera uno en
  `/api/informes/balance-comprobacion`, útil como referencia de contraste).
- Consecutivos, anulaciones y documentos afectados sin colisiones ni huérfanos.

## 7. Corte y reversión

Reglas 10.1–10.8 del plan. Para esta instalación, dos concretas:

- **El backend actual es un escritor del legado.** El corte exige que deje de
  escribir en ADS antes de la instantánea final; si ya se migró la capa de datos,
  debe apuntar solo a PostgreSQL. Ver [`04_transicion_del_backend.md`](04_transicion_del_backend.md).
- **Conservar `ADD_CONTAB/` y las copias** en solo lectura por el plazo aprobado,
  aunque estén fuera de Git.

## 8. GO / NO-GO

**Hoy: NO-GO.** Por B01–B15 abiertos, homologación incompleta (2.257 campos
pendientes), ausencia de pruebas en motor y datos, y porque la copia disponible
no cubre el modelo.

Para autorizar producción se exige lo del §11 del plan: cero bloqueos críticos,
cada campo/opción con destino o sustitución aprobada, perfilado y reglas de
identidad aprobados, T01–T18 y conciliaciones en verde, integraciones y archivos
operativos, ensayo completo con restauración y reversión documentadas, y firma
del responsable contable y del técnico.

## 9. Trabajo que no depende de los datos

Se puede adelantar **hoy** sin la copia completa ni el motor ADS:

1. Corregir B01–B15 en el esquema y en las funciones (fase 3).
2. Completar la homologación campo a campo de las entidades del piloto.
3. Escribir el cargador contra el contrato del §4 y probarlo con el `seed.sql`
   de `db/postgresql/` en un entorno aislado.
4. Preparar el perfilado (consultas de conteo, claves repetidas, huérfanos,
   rangos) para ejecutarlo en cuanto haya motor.
