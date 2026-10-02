# Reembolsos en Advantage

El formulario original (`REEMBOL01`, `MOVICON.prg`) guarda la cabecera en
`CONREMAE` y los gastos en `CONREITE`. La confirmación (`CONTAB_REEM`) usa las
cuentas `DEB01`, `CRE01`, `DEB02` y `CRE02` de los dos tipos documentales en
`VISDOCUM` para formar un lote. La contabilización en `MOV01` ocurre después,
mediante la verificación y actualización normal del lote.

## Cambio de esquema aplicado

Ambas tablas estaban presentes en `C:\VISADS\ADD_CONTAB`, pero no tenían
compañía. Se añadieron columnas nullable para preservar los registros previos:

```sql
ALTER TABLE CONREMAE ADD COLUMN CIA INTEGER;
ALTER TABLE CONREITE ADD COLUMN CIA INTEGER;
```

No ejecutar esas instrucciones de nuevo si `CIA` ya aparece en las dos tablas.
La aplicación exige `CIA` en todas las lecturas y escrituras de reembolsos.
Los 3 encabezados y 16 ítems existentes al momento del cambio conservaron
`CIA = NULL`; no se muestran ni se modifican desde ninguna compañía hasta que
se determine su titular y se asignen ambos lados con una operación controlada.

Antes de repetir la migración en otra instalación: verificar respaldo del
diccionario y de ambas tablas, aplicar el cambio con acceso exclusivo y
confirmar que el número de registros se conservó. La base activa tenía
respaldo declarado por el usuario; además se copiaron los cuatro archivos
`CONREMAE/CONREITE .ADT/.adi` a `tmp/reembolsos-cia-backup-20260928`.
El archivo del diccionario abierto por Advantage no admitió copia en caliente.

## Requisitos para confirmar

- Comprobante existente en `CONTICOM` para la compañía.
- Dos tipos diferentes de `VISDOCUM`, sucursal `SUC = 1`, con cuentas débito
  y crédito configuradas. Actualmente sus cuatro campos de cuentas estaban
  vacíos; la confirmación se bloqueará hasta que se configuren.
- Cuentas afectables de `CONMAE`, terceros activos de `FADCLI` y centros de
  `CONCECOS` de la compañía.
- Fecha en el ejercicio y mes habilitados en `CONCTR`.

La confirmación es transaccional: crea `CONMOVI` y `CONLOTES`, incrementa
los consecutivos usados en `VISION` y `VISDOCUM` y marca el reembolso aplicado
solo si todas las escrituras terminan correctamente. El lote queda en
`Borrador`; el usuario lo verifica y actualiza desde Lotes.
