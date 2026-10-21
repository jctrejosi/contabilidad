# Medios magnéticos — 6. Detalle por tercero

## Correspondencia con el original

Se revisaron MEDMAG06, NITOKL (TM=2), IMPREDETN, IMPREDET1N,
DETALLE1N y DETALLE2N de DSITAB.PRG; también IMPREGEN1 de VISION3.RC
y el índice CONMAGIN (NIT+FORMATO+CONCEPTO) de DSIINDEX.PRG.

- La selección es un tercero real de FADCLI, por código o búsqueda por nombre.
  TM=2 no excluye terceros inactivos; se conserva ese comportamiento.
- CONMAGIT es el origen de las partidas vigentes. Se añade CIA al filtro para
  separar compañías compartidas. No se agrega año, mes ni restricción de formato.
- Detallado: formato, concepto, cuenta, tipo documental, documento, comprobante,
  centro, fecha, valor y base; subtotales de valor por concepto y formato.
- Resumido: agrupación por formato/concepto, nombre del concepto, valor y base;
  subtotal de valor por formato con el nombre del formato.
- Ambas salidas presentan totales generales de valor y base. Los subtotales
  no vuelven a sumarse y su base queda vacía, como en el fuente.
- Catálogos separados de las partidas: un concepto repetido no duplica importes
  por un JOIN. Si falta su descripción queda vacía, nunca se arrastra la del
  concepto anterior por el estado del cursor Harbour.
- Se mantiene el comprobante completo en la salida web/XLSX. El PDF original
  truncaba a dos caracteres, mientras XLS imprimía el campo completo.
- WIN/DOS/disco se sustituyen por PDF imprimible; XLS por XLSX. Se reutilizan
  estilos DSI de revisión de medios, conservando las columnas de cada variante.

## Uso y arquitectura

Pantalla nueva MediosDetalleTercero, accesible desde la opción 6. Al entrar
no consulta movimientos. Buscar tercero, seleccionarlo con flechas/Enter,
escoger detallado/resumido y pulsar Consultar. Enter avanza entre controles;
F5 descarga PDF. La consulta no permite crear, corregir ni eliminar acumulados.

Rutas GET /api/medios/detalle-tercero, /pagina y /exportar. Consulta inicial
parametrizada por CIA/NIT. Se almacena una instantánea temporal reutilizando
report_snapshots; páginas y exportación usan el mismo resultado sin repetir
la consulta contable. Caduca a los 30 minutos y comprueba módulo/compañía.
El archivo incluye todas las páginas, con subtotales y total general.

## Verificación

47 pruebas unitarias correctas incluyendo las de revisión/generación previas.
Los 12 casos nuevos cubren cortes, columnas, decimal/signos, variantes,
referencias inexistentes, terceros inactivos, aislamiento CIA/NIT, exportación
completa de instantánea, expiración, texto en Excel y PDF legible.
TypeScript y compilación frontend correctos. Tres rutas presentes en OpenAPI.
Lectura real de Advantage correcta para CIA 027 y un tercero existente; no
se encontraron partidas para ese tercero. No se modificaron registros reales.
Falta homologar con movimientos generados y comparar contra Harbour.
No se requirieron campos o tablas adicionales.
