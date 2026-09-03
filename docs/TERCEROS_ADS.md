# Terceros conectados a Advantage Data Server

## Alcance actual

La opción **Configuración → Terceros** consulta el maestro real `FADCLI`.
Este archivo es global: sus registros se comparten entre todas las compañías y
por eso la consulta no utiliza `CONEMP.EMPCOD` ni un campo `CIA`.

La primera fase es de consulta. Crear, modificar, eliminar, bloquear, cambiar
cupos, importar, reasignar NIT e informes permanecen deshabilitados hasta
implementar las validaciones, réplicas y auditoría del sistema original.

## Identificación y volumen

- Clave funcional: `FADCLI.CCODIGO`, texto de 10 posiciones.
- Registros comprobados: 126.009.
- La clave se muestra sin espacios de relleno y no se modifica desde esta fase.
- Se consultan 100 registros por página; el máximo permitido por solicitud es 200.

## Campos presentados

| Campo FADCLI | Propiedad web | Significado |
|---|---|---|
| `CCODIGO` | `nit` | Código principal del tercero. |
| `CDIGITO` | `digito` | Dígito de verificación. |
| `CTIPOCLI` | `tipo` | `1`: natural; `2`: jurídica. Para registros antiguos sin valor, `CTIPDOC=31` identifica jurídica. |
| `CTIPDOC` | `tipoDoc` | Código del tipo de documento. |
| `CNOMBRE` | `nombre` | Nombre completo o razón social. |
| `CDIREC` | `direccion` | Dirección principal. |
| `CTELEF` | `telefono` | Teléfono principal. |
| `CCIUDAD` | `ciudad` | Ciudad descriptiva. |
| `CESTADO` | `estado` | `1`: activo; los demás valores se presentan inicialmente como bloqueado/no activo. |
| `CMOTIVO` | `motivoBloqueo` | Motivo registrado para bloqueo o inactivación. |
| `CSALDO` | `saldo` | Saldo del tercero. Solo lectura. |
| `CCUPO` | `cupo` | Cupo de cartera. Solo lectura en esta fase. |
| `CFCHCREA` | `fechaCreacion` | Fecha numérica heredada, convertida a `AAAA-MM-DD`. |

## Flujo y rendimiento

```text
Terceros.tsx
  → GET /api/terceros?page=1&pageSize=100&q=...&estado=...
  → FastAPI
  → terceros_repository.py
  → Advantage OLE DB
  → FADCLI global
```

La búsqueda se ejecuta en `CCODIGO`, `CNOMBRE` y `CCIUDAD`. Los filtros de
estado y la paginación también se resuelven en Advantage, evitando descargar
los 126.009 registros al navegador.

Mediciones locales:

| Operación | Tiempo aproximado |
|---|---:|
| Primera página de 100 registros | 0,24 s |
| Segunda página | 0,18 s |
| Consulta con búsqueda | 0,33 s |
| Filtro de no activos | 0,22 s |

## Reglas pendientes para escritura

Antes de habilitar operaciones debe conservarse el comportamiento original:

- Creación y modificación con auditoría y validación de catálogos relacionados.
- Estados `1` a `5`: activo, bloqueo de facturación, bloqueo de inventarios,
  inactivo e ignorar estado de cartera en POS.
- Eliminación solamente cuando el tercero no tenga movimientos.
- Cambio de cupo sujeto al máximo autorizado y permisos.
- Reasignación de NIT actualizando todas las referencias contables.
- Importación, informes, profesiones, cumpleaños y etiquetas usando campos
  reales, sin datos simulados.

## Verificación

- Consulta real de 126.009 terceros.
- Página inicial de 100 filas y 1.261 páginas.
- Búsqueda exacta por `CCODIGO` con una fila resultante.
- Selección y panel de detalle con datos reales.
- Acciones de escritura comprobadas como deshabilitadas.
- Pruebas unitarias de mapeo, fechas y escape de búsqueda.
