# Acumulación general de IVA en Advantage

La opción `Informes → Informe de IVA → Acumulación general` reproduce
`INFOR05(2) → INFOR51 → INFOR52 → INFOR53I` de `CONINFOR.PRG`.

## Estructura requerida

`CONIVA` debe contener `CODIGO`, `NIT` y los cuatro campos por mes del 01 al
12: `BASEnn`, `VALORnn`, `BASEnnC`, `VALORnnC`. La instalación compartida
requiere además `CIA NUMERIC(3,0)` para aislar compañías. El proceso verifica
estos campos y rechaza una estructura incompleta.

En la base de desarrollo, la tabla copiada estaba vacía. Se ejecutó:

```sql
ALTER TABLE CONIVA ADD COLUMN CIA NUMERIC(3,0);
CREATE INDEX CONIVA_CIA ON CONIVA (CIA, CODIGO, NIT);
```

En otras instalaciones, comprobar primero si `CIA` y el índice ya existen.
Si la tabla contiene acumulados antiguos sin compañía, **no** asignarles una
compañía por conjetura: respaldar y clasificar esos registros antes de activar
el reproceso.

## Regla contable

- Se toma la compañía y el ejercicio activo; el usuario elige mes inicial y
  final entre 01 y 12. Los meses 13–18 quedan deshabilitados porque la tabla
  recibida no tiene esas columnas.
- Se leen de `MOV01` únicamente movimientos no nulos cuyas cuentas maestras
  de `CONMAE` tienen `MIVA_RET='I'` y `MTC=TRUE`.
- La base conserva el signo del valor: débito positivo en `BASEnn/VALORnn` y
  crédito negativo en `BASEnnC/VALORnnC`. Una base de signo contrario se
  normaliza durante el cálculo, sin modificar `MOV01`.
- Para la compañía activa se ponen en cero **solo los meses seleccionados** de
  `CONIVA` y se rehacen los acumulados por cuenta y tercero. Los otros meses y
  compañías permanecen intactos. El proceso se ejecuta en una transacción;
  si falla, se revierte completo. Repetirlo no duplica valores.
- El saldo por cuenta/tercero se puede revisar y exportar como PDF, XLSX o CSV.

El esquema actual tampoco contiene `ANO` en `CONIVA`; por ello solo se permite
el ejercicio activo de `CONCTR`. Para conservar varios ejercicios en paralelo
haría falta ampliar esa estructura y sus índices antes de habilitarlo.
