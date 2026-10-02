# Consulta de documentos en Advantage

## Comportamiento de la pantalla

La opción **Consultas > Documentos** inicia sin resultados y no consulta
`CONDOCUM` automáticamente. El usuario debe diligenciar al menos uno de estos
criterios y pulsar **Consultar**:

- período;
- comprobante;
- tipo de documento;
- NIT;
- número de documento;
- fecha inicial o fecha final.

Cambiar un filtro oculta el resultado anterior para evitar que se confunda con
la nueva selección. La consulta está limitada a la compañía activa y entrega
50 cabeceras por página.

## Relación de datos

La lista principal procede de `CONDOCUM`:

- `CIA`: compañía activa;
- `DFECHA`: fecha;
- `DCOMPRO`: comprobante;
- `DTIPODOC`: tipo documental;
- `DDOCUM`: documento;
- `DNIT`: tercero;
- `DDETALLE`: descripción;
- `DVALOR`: valor de cabecera.

El nombre del tercero se complementa desde `FADCLI.CNOMBRE`, relacionándolo
con `CONDOCUM.DNIT = FADCLI.CCODIGO`.

Al pulsar **Ver detalle**, se ejecuta una consulta separada sobre `MOV01`. La
relación utiliza compañía, año, mes, documento, comprobante y tipo documental:

```text
CONDOCUM.CIA       = MOV01.CONCIA
año(DFECHA)        = MOV01.CONANO
mes(DFECHA)        = MOV01.CONMES
CONDOCUM.DDOCUM    = MOV01.TDOCUM
CONDOCUM.DCOMPRO   = MOV01.TCOMPR
CONDOCUM.DTIPODOC  = MOV01.TIPODOC
```

El detalle muestra cuenta, nombre de `CONMAE`, NIT, centro, documento afectado,
débito, crédito, base y concepto. `MOV01.TVALOR` positivo se presenta como
débito y el valor negativo como crédito. Al final se calculan los totales y se
indica si el documento está cuadrado.

Una cabecera histórica puede existir en `CONDOCUM` sin filas relacionadas en
`MOV01`. En ese caso la pantalla informa la inconsistencia en lugar de inventar
un detalle.

## Servicios

- `GET /api/documentos`: consulta paginada y filtrada de `CONDOCUM`.
- `GET /api/documentos/detalle`: consulta puntual de partidas en `MOV01`.

Ambos servicios exigen la compañía activa y ejecutan las condiciones en
Advantage mediante ADO; el navegador no descarga las tablas completas.
