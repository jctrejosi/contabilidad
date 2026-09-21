# Migración de datos — CONTABDSI

Registro de la **evaluación y el plan para migrar los datos** del legado
Advantage (VISION/FORTUNER) al modelo nuevo. El diseño del destino y la
validación funcional viven en [`../old_db/`](../old_db/) y
[`../general/`](../general/) (contexto congelado, no se edita); este directorio
los traslada a un plan de ejecución y los contrasta con la fuente que **hoy
existe realmente** en el repositorio.

## 1. Veredicto — ¿se puede usar `ADD_CONTAB` para migrar?

**Sirve para un piloto del núcleo contable; no para una migración completa.**

`ADD_CONTAB/` es una copia **parcial** del diccionario del legado: trae **15 de
las 139 tablas** documentadas en
[`../old_db/DICCIONARIO_DEPURADO_CONTABDSI.md`](../old_db/DICCIONARIO_DEPURADO_CONTABDSI.md),
unos 3.4 GB. Alcanza para construir y validar el ETL de la contabilidad general
(catálogos, terceros, cuentas, centros, comprobantes, documentos y los
movimientos de los dos períodos presentes), pero falta el resto: años
anteriores, impuestos, seguridad, activos, exógena, reembolsos, presupuesto…

| Pregunta | Respuesta |
|---|---|
| ¿Hay datos del legado en el repositorio? | Sí: `ADD_CONTAB/` (3.4 GB, fuera de Git por `.gitignore`) |
| ¿Alcanza para las 60 tablas del modelo nuevo? | **No**: solo 15 tablas fuente presentes |
| ¿Alcanza para el piloto del núcleo contable? | **Sí** — ver [`01_inventario_fuente.md`](01_inventario_fuente.md) |
| ¿Se puede extraer hoy? | **No**: falta el motor/proveedor de Advantage (ver §4) |
| ¿Basta migrar los datos para que el backend use PostgreSQL? | **No**: los servicios hablan ADS/ADO — ver [`04_transicion_del_backend.md`](04_transicion_del_backend.md) |
| ¿Se puede pasar a producción con esto? | **No**: el dictamen de `old_db` sigue en **NO-GO** (bloqueos B01–B15) |

## 2. Archivos de este directorio

| Archivo | Contenido |
|---|---|
| [`01_inventario_fuente.md`](01_inventario_fuente.md) | Qué trae y qué no trae `ADD_CONTAB`, con destino candidato y ausencias por impacto |
| [`02_consideraciones_previas.md`](02_consideraciones_previas.md) | Qué tener en cuenta **antes** de migrar: fuente, alcance, destino, transformaciones, conciliación y seguridad |
| [`03_plan_de_carga.md`](03_plan_de_carga.md) | Fases, orden de carga, contrato del cargador, pruebas, corte y reversión |
| [`04_transicion_del_backend.md`](04_transicion_del_backend.md) | Cómo llevar los servicios del backend de Advantage a PostgreSQL |
| [`05_montar_advantage_local.md`](05_montar_advantage_local.md) | Qué instalar (proveedor 11.1 de 64 bits) y cómo abrir `ADD_CONTAB` en local |
| [`extractor/`](extractor/README.md) | Inspector de cabeceras y contrato del extractor de datos desde los archivos |
| [`homologacion/`](homologacion/contrato_campos.json) | **Contrato campo a campo** (791 campos de las 20 tablas) cruzando el diccionario físico con la homologación |

## 3. Relación con `old_db/` (aquí no se duplica)

El plan maestro es
[`../old_db/PLAN_MIGRACION_POSTGRESQL.md`](../old_db/PLAN_MIGRACION_POSTGRESQL.md):
dictamen, bloqueos B01–B15, diseño destino recomendado, reglas de
transformación y preservación, plan por fases, contrato del cargador, pruebas
T01–T18 y condiciones GO/NO-GO. **Este directorio lo referencia y solo concreta
lo que depende de esta instalación.**

Complementos en `old_db/`:

| Documento | Aporte |
|---|---|
| `MATRIZ_TABLAS_Y_BRECHAS.md` | 98 tablas/familias del legado → destino candidato, estado y brecha, con códigos de proceso P01–P30 |
| `HOMOLOGACION_CAMPOS.md` | 2.663 nombres de campo: destino, estado y transformación |
| `MATRIZ_PROCESOS_Y_OPCIONES.md` | 36 familias de procesos y 161 acciones de menú |
| `TRAZABILIDAD_FUNCIONES_Y_BOTONES.md` | 969 funciones y 572 acciones adicionales del original |
| `EXCLUSIONES_CONTABDSI.md` | Qué se excluyó del inventario y con qué criterio |
| `ESQUEMA_DEPURADO_CONTABDSI.md` / `.json` | Esquema funcional depurado y catálogo legible por máquina |

> `old_db/` es **contexto congelado**: no se edita. Cualquier corrección o
> ampliación de este plan se escribe aquí, no allí.

## 4. Bloqueo inmediato: el motor de Advantage

El primer paso del plan (fase 5, «Extractor y staging», con un *lector
Advantage compatible*) **no se puede ejecutar todavía**: este equipo no tiene el
motor ni el proveedor OLEDB de Advantage instalado.

```
$ node dev.js --check
   Advantage      motor no instalado
   Diccionario    ADD_CONTAB/PUBLIDATA.add
```

La migración **no elimina** la dependencia de Advantage: la traslada. Se paga
una vez, al extraer; después el sistema nuevo corre sobre PostgreSQL. Es decir,
para leer `ADD_CONTAB` hace falta el motor igual que lo necesita hoy el backend.

Guía paso a paso para instalarlo y abrir el diccionario:
[`05_montar_advantage_local.md`](05_montar_advantage_local.md).

## 5. Estado y siguiente paso

| Fase del plan maestro | Estado |
|---|---|
| 0. Cerrar alcance | **Pendiente** — hay que definir empresas/años y qué módulos siguen en el legado |
| 1. Perfilado solo lectura | **Bloqueado** por §4 |
| 2. Homologación funcional | Parcial: 406 de 2.663 campos con candidato explícito |
| 3. Esquema y servicios | Pendiente: B01–B15 sin corregir |
| 4–10 | No iniciadas |

Avance paralelo: el backend ya alterna de motor (`CONTABDSI_STORE`) y tiene
`/api/health` y `/api/companias` leyendo de PostgreSQL — ver
[`04_transicion_del_backend.md`](04_transicion_del_backend.md) §8.

Siguiente paso concreto: **instalar el motor Advantage** (ver §4) y ejecutar el
perfilado de solo lectura sobre `ADD_CONTAB` para producir el inventario de
volúmenes, claves repetidas, huérfanos y fechas inválidas del que dependen
todas las fases siguientes. En paralelo, decidir el alcance de la fase 0 y
empezar la corrección del esquema (fase 3), que no requiere los datos.
