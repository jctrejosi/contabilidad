# Lotes contables en Advantage

## Lista principal

Al ingresar a **Movimientos > Lotes**, la aplicación consulta `CONMOVI`. La
condición `CIA = compañía activa` es obligatoria en el servidor y no depende de
un filtro visual del navegador.

La lista presenta:

- `LOTE`: código del lote;
- `NOMBRE`: descripción;
- `MES`: mes de trabajo;
- `FECHA` y `HORA`;
- `USUA_I` y `USUA_F`: usuarios inicial y final;
- `ITEMS`: cantidad de partidas;
- `DEBITOS`, `CREDITOS` y su diferencia;
- `ESTADO`, `HIST`, `BORRAR` y `ARCHOK` como controles heredados.

La consulta entrega hasta 100 lotes por página. La búsqueda de código, nombre
o usuario se aplica sobre la página visible y no elimina la condición de
compañía.

## Detalle del lote

Al seleccionar una fila se consulta `CONLOTES` usando la clave completa:

```text
CONMOVI.CIA  = CONLOTES.CIA
CONMOVI.LOTE = CONLOTES.LOTE
```

No se consulta el detalle de otros lotes ni de otras compañías. Se muestran
hasta 200 partidas por página con los campos:

- `CUENTA`, complementada con el nombre maestro de `CONMAE` para la misma CIA;
- `NITN` o `NIT`;
- `TFASE` como centro de costo;
- `TCOMPR`, `TIPODOC`, `TDOCUM` y `TFECHA`;
- `DEBITO`, `CREDITO` y `BASE`;
- `TDOCUM2` como documento afectado;
- `CONCEPTO` y `TINCON`.

Los totales de débito y crédito del pie corresponden a la página cargada. La
cabecera conserva los totales generales guardados en `CONMOVI`.

## Servicios

- `GET /api/lotes?cia=027`: lista `CONMOVI` de la compañía.
- `GET /api/lotes/detalle?cia=027&lote=...`: lista `CONLOTES` usando CIA y LOTE.

Actualmente las tablas `CONMOVI` y `CONLOTES` del diccionario conectado no
contienen registros. Por eso la interfaz muestra el estado vacío real en vez
de los lotes de demostración que existían anteriormente.
