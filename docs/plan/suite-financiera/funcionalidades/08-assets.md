# Funcionalidades — `assets` (activos fijos)

Origen funcional (inventario de partida): `account_asset` (Enterprise):
categorías, modelos de depreciación, tabla de cuotas, bajas y ajustes.

## F-AST-001 — Categorías de activos

**Debe hacer.** Definir categorías con método de depreciación, vida útil
contable/fiscal, valor residual, cuentas de activo, depreciación y gasto.

**Reglas.** Código único por compañía; vida útil > 0; cuentas de la compañía;
una categoría con activos no se elimina; el cambio afecta solo activos nuevos.

**Datos/API.** `ast.categoria`; CRUD en `/api/v1/assets/categorias`.

**Aceptación.** No se crea sin cuentas; categoría en uso no se elimina; el
cambio no recalcula activos existentes.

---

## F-AST-002 — Alta de activo

**Debe hacer.** Registrar un activo con código, descripción, categoría, fecha de
adquisición, costo, residual, centro, tercero y documento de compra.

**Reglas.** Código único; costo > 0; residual < costo; fecha válida; si viene de
factura de compra, el costo coincide con la línea; el alta genera asiento de
activo.

**Datos/API.** `ast.activo`; `POST /api/v1/assets/activos`.

**Aceptación.** Activo sin categoría/costo se rechaza; el asiento usa la cuenta
de la categoría; el activo nace `activo` al postear el alta.

---

## F-AST-003 — Tabla de depreciación

**Debe hacer.** Generar la tabla de cuotas por periodo según método, vida útil,
costo y residual.

**Reglas.** Una cuota por activo/periodo; la suma = costo − residual; la última
cuota ajusta el redondeo; la tabla se congela al activar; un cambio de método
crea una nueva versión.

**Datos/API.** `ast.depreciacion`; `GET /api/v1/assets/activos/{id}/tabla`.

**Aceptación.** La suma de cuotas cuadra; no hay periodos duplicados; la tabla
coincide con el asiento mensual.

---

## F-AST-004 — Depreciación mensual

**Debe hacer.** Ejecutar el job mensual que calcula y contabiliza la cuota de cada
activo activo.

**Reglas.** Periodo abierto; no duplica si se ejecuta dos veces; el asiento
debita gasto y acredita depreciación acumulada; el estado pasa a
`totalmente_depreciado` al agotar la tabla; idempotente por activo/periodo.

**Datos/API.** `ast.depreciacion`, `led.asiento`;
`POST /api/v1/assets/depreciaciones/generar`.

**Aceptación.** Dos ejecuciones no duplican; la suma de asientos = tabla; un
periodo cerrado rechaza la ejecución.

---

## F-AST-005 — Depreciación fiscal

**Debe hacer.** Mantener una tabla fiscal paralela con vida útil y método
fiscales; comparar contable vs. fiscal.

**Reglas.** La fiscal no reemplaza la contable; se calcula con parámetros
vigentes; la diferencia se reporta; no genera asiento contable por sí sola.

**Datos/API.** `ast.activo.vida_fiscal`, `ast.depreciacion_fiscal`;
`GET /api/v1/assets/reporte/fiscal`.

**Aceptación.** La tabla fiscal suma costo − residual fiscal; el reporte de
diferencias cuadra; cambiar la vida fiscal no altera la contable.

---

## F-AST-006 — Baja de activo

**Debe hacer.** Dar de baja por venta, donación, pérdida o destrucción; calcular
valor en libros y resultado.

**Reglas.** Fecha y motivo obligatorios; no se deprecia después de la baja;
genera asiento de baja; cierra cuotas futuras; conserva historia.

**Datos/API.** `ast.baja`; `POST /api/v1/assets/activos/{id}/baja`.

**Aceptación.** El resultado = valor de venta − valor en libros; no quedan cuotas
futuras; el activo queda `dado_de_baja`.

---

## F-AST-007 — Revalorización

**Debe hacer.** Ajustar el valor del activo y recalcular la depreciación futura.

**Reglas.** Requiere avalúo/soporte y aprobación; el ajuste se contabiliza contra
patrimonio o resultado según política; la tabla futura se recalcula; el histórico
se conserva.

**Datos/API.** `ast.revaluacion`; `POST /api/v1/assets/activos/{id}/revaluacion`.

**Aceptación.** El valor nuevo queda registrado; las cuotas futuras cuadran; el
asiento es trazable.

---

## F-AST-008 — Deterioro

**Debe hacer.** Registrar pérdida por deterioro cuando el valor recuperable es
menor al valor en libros.

**Reglas.** Requiere evidencia y aprobación; el importe no supera el valor en
libros; genera asiento de pérdida; puede revertirse si cambian las condiciones.

**Datos/API.** `ast.deterioro`;
`POST /api/v1/assets/activos/{id}/deterioro`.

**Aceptación.** El valor en libros baja; el asiento cuadra; la reversión es
trazable.

---

## F-AST-009 — Mejoras y componentes

**Debe hacer.** Registrar mejoras que aumentan vida útil o capacidad y
componentes con depreciación separada.

**Reglas.** Una mejora capitalizable aumenta el costo y puede recalcular la tabla;
un componente tiene su propia vida/valor; no se duplica el activo principal.

**Datos/API.** `ast.activo_componente`, `ast.mejora`.

**Aceptación.** La suma de componentes ≤ costo total; la mejora genera nueva
tabla; el reporte consolidado cuadra.

---

## F-AST-010 — Reporte de activos

**Debe hacer.** Listar activos con costo, depreciación acumulada, valor en
libros, estado, centro y categoría; exportar.

**Reglas.** Solo compañía activa; incluye filtros por categoría/estado/centro;
cuadra con el libro; exportable a PDF/XLSX.

**Datos/API.** `GET /api/v1/assets/reporte/activos`.

**Aceptación.** La suma de valores en libros = saldo contable de activos; los
filtros funcionan; la exportación no trunca.
