# Validación de maestros en Captura directa

La grilla de **Movimientos > Captura directa** ya no valida sus líneas contra
los catálogos de demostración. Al abrirla consulta los maestros reales de la
compañía activa y aplica las reglas definidas en cada cuenta.

## Cuenta contable

- Fuente: `CONMAE`.
- Aislamiento obligatorio: `CONMAE.CIA = compañía activa` y cuenta maestra con
  `NIT` en blanco.
- Solo se ofrecen cuentas afectables (`MTC`).
- Un código escrito o seleccionado debe existir en el catálogo cargado para esa
  compañía; de lo contrario, la línea queda con error y no se puede guardar ni
  contabilizar.

## Tercero

- Regla de la cuenta: `CONMAE.MCTAPAGOS`.
- Cuando está activo, el campo abre un buscador que consulta `FADCLI` por NIT o
  nombre y solo acepta una fila seleccionada del resultado.
- Cuando está inactivo, el control queda bloqueado como **No aplica**. Cualquier
  tercero anterior se elimina automáticamente al cambiar de cuenta.
- `FADCLI` es global y no recibe filtro de compañía.

## Navegación por teclado

- Al abrir Captura directa, el foco inicia en **Fecha**.
- `Enter` confirma el campo actual y avanza al siguiente control habilitado.
- `Shift + Enter` vuelve al control habilitado anterior.
- Las flechas `↑` y `↓` recorren cuentas, comprobantes, terceros y centros.
- En Cuenta, escribir código o nombre filtra `CONMAE`; `Enter` confirma la
  coincidencia exacta o la opción resaltada.
- En Tercero, `Enter` abre el buscador. Después de escribir NIT o nombre,
  `Enter` consulta `FADCLI`, `↓` pasa al primer resultado y `Enter` lo elige.
- `Esc` cierra los buscadores sin cambiar el valor seleccionado.
- El recorrido omite automáticamente Tercero y Centro cuando la cuenta no los
  maneja.
- Al pulsar `Enter` en el concepto de la última línea se crea una línea nueva y
  el foco queda en su Cuenta.

## Centro de costo

- Regla de la cuenta: `CONMAE.MCOSTOS`.
- Fuente: `CONCECOS`, siempre filtrada por la compañía activa.
- Cuando la cuenta exige centro, solo se puede escoger un código del catálogo
  real cargado. Cuando no lo exige, el control queda bloqueado y se limpia.

## Comprobante y tipo de documento

- **Comprobante** se consulta en `CONTICOM` con `CIA = compañía activa`; solo se
  muestran los tipos de comprobante de la contabilidad elegida por el usuario.
- **Tipo de documento** se consulta en el maestro global `VISDOCUM`, sin filtro
  de compañía. Si `VISDOCUM.COMPROBA` coincide con el código elegido en
  `CONTICOM`, esos tipos se ordenan primero; el resto sigue disponible para
  respetar configuraciones históricas y otros módulos.
- El formulario no contiene copias locales de estos catálogos: los cambios
  realizados en Advantage se reflejan al volver a cargar la vista.

## Datos comunes de cabecera y partidas

- El **N.° documento** de la cabecera se replica en la columna Documento de
  todas las partidas.
- El **Concepto general** se replica en la columna Concepto de todas las
  partidas.
- Las columnas de detalle son informativas y de solo lectura. Al cambiar la
  cabecera se actualizan todas las partidas existentes, y cada línea nueva
  hereda ambos valores.
- Al recuperar un documento se toma el número y el concepto de su primera línea
  como cabecera y se normalizan en todas las partidas cargadas.

## Cambio de compañía

Al cambiar la compañía se descartan las líneas y los catálogos anteriores. La
pantalla vuelve a consultar `CONMAE`, `CONCECOS` y `CONTICOM` con el nuevo código
`CIA`, además de actualizar el catálogo global `VISDOCUM`. Esto evita mezclar
cuentas, centros o comprobantes pertenecientes a otra contabilidad.
