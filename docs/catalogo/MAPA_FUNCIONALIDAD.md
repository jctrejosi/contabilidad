Auditoría de esta misma materia, con severidades y plan por dependencia: [AUDITORIA_FUNCIONALIDAD.md](../auditorias/AUDITORIA_FUNCIONALIDAD.md).

# Mapa funcional del aplicativo: control por control

Auditoria de la capa de interaccion de `Interface_web/src/` contra el backend
(`backend/app.py`). Complementa el inventario pantalla-cliente-ruta de
`PLAN_ASISTENTE.md` (seccion 3): aqui se baja al nivel de cada input y cada
boton.

Criterio de conteo y abreviatura de metodo:

- **Conectado**: el control dispara una llamada real (`api/*.ts`) a un endpoint
  que existe en `backend/app.py`.
- **Local o simulado**: el control hace algo solo en el navegador (estado,
  `localStorage`, `data/mock`, `data/config*`, CSV generado en el cliente,
  `window.print()`, navegacion entre pantallas, abrir/cerrar modal) o ejecuta un
  aviso del tipo "(simulado)" sin tocar el backend.
- **Inerte**: no tiene manejador, esta deshabilitado como marcador ("se
  habilitara cuando...", "No disponible"), o su manejador no produce ningun
  efecto util.

"Controles" cuenta `<input>`, `<select>`, `<textarea>` y `<button>`. Los conteos
de la columna conectados son conservadores: solo se marca conectado un control
cuyo manejador se pudo seguir hasta una funcion de `api/*`. La reparticion por
pantalla es una asignacion por inspeccion del manejador, no un analisis
automatico; puede diferir en mas o menos un control en las pantallas con muchos
campos de filtro identicos.

---

## 1. Pantalla por pantalla

### Maestros

| Pantalla | Controles | Conectados | Locales/simulados | Inertes |
|---|---:|---:|---:|---:|
| PlanCuentas | 31 | 18 | 13 | 0 |
| Terceros | 59 | 6 | 48 | 5 |
| ParametrosOperacion | 15 | 15 | 0 | 0 |
| RenglonesRenta | 23 | 0 | 23 | 0 |
| ConfigIVA | 11 | 0 | 11 | 0 |
| ConfigRetenciones | 29 | 0 | 29 | 0 |
| Plantillas | 22 | 0 | 22 | 0 |
| FormatosDocumentales | 23 | 0 | 23 | 0 |
| Companias | 27 | 0 | 27 | 0 |
| Especiales | 9 | 0 | 9 | 0 |
| TiposDocumento | 4 | 0 | 3 | 1 |
| Comprobantes | 3 | 1 | 1 | 1 |
| Centros | 3 | 0 | 2 | 1 |

### Movimientos

| Pantalla | Controles | Conectados | Locales/simulados | Inertes |
|---|---:|---:|---:|---:|
| Lotes | 52 | 40 | 12 | 0 |
| CapturaDirecta | 33 | 14 | 19 | 0 |
| Importaciones | 15 | 13 | 2 | 0 |
| Anulacion | 14 | 12 | 2 | 0 |
| Reembolsos | 19 | 0 | 19 | 0 |
| Reclasificaciones | 17 | 0 | 17 | 0 |
| Nomina | 10 | 0 | 10 | 0 |

### Consultas

| Pantalla | Controles | Conectados | Locales/simulados | Inertes |
|---|---:|---:|---:|---:|
| Comparativos | 17 | 16 | 1 | 0 |
| MovimientoMensual | 13 | 11 | 2 | 0 |
| ConsultaDocumentos | 12 | 12 | 0 | 0 |
| SaldosAnuales | 10 | 9 | 1 | 0 |
| DocumentoEspecifico | 7 | 7 | 0 | 0 |
| AnualCuenta | 7 | 7 | 0 | 0 |
| SaldosCuentaCentro | 6 | 6 | 0 | 0 |
| AnualTercero | 6 | 6 | 0 | 0 |
| AnualCentro | 6 | 6 | 0 | 0 |

### Informes

| Pantalla | Controles | Conectados | Locales/simulados | Inertes |
|---|---:|---:|---:|---:|
| Informes | 26 | 9 | 13 | 4 |
| BalanceComprobacion | 11 | 0 | 10 | 1 |
| DocumentoOficial | 4 | 0 | 3 | 1 |

### Procesos

| Pantalla | Controles | Conectados | Locales/simulados | Inertes |
|---|---:|---:|---:|---:|
| Reprocesos | 9 | 8 | 1 | 0 |
| Cierres | 8 | 0 | 5 | 3 |
| Reorganizacion | 8 | 0 | 8 | 0 |
| Consolidacion | 4 | 0 | 4 | 0 |

### Impuestos

| Pantalla | Controles | Conectados | Locales/simulados | Inertes |
|---|---:|---:|---:|---:|
| Impuestos | 69 | 0 | 69 | 0 |

### Administracion

| Pantalla | Controles | Conectados | Locales/simulados | Inertes |
|---|---:|---:|---:|---:|
| UsuariosPermisos | 13 | 0 | 13 | 0 |
| Bitacora | 5 | 0 | 5 | 0 |
| Integraciones | 3 | 0 | 3 | 0 |

### Transversal y componentes

| Pantalla | Controles | Conectados | Locales/simulados | Inertes |
|---|---:|---:|---:|---:|
| CrearTerceroModal | 19 | 19 | 0 | 0 |
| Shell | 8 | 0 | 8 | 0 |
| BotChat | 6 | 6 | 0 | 0 |
| SeleccionCompania | 4 | 1 | 3 | 0 |
| Dashboard | 3 | 0 | 3 | 0 |
| ConfirmarCrearTerceroModal | 2 | 0 | 2 | 0 |

---

## 2. Totales

| Metrica | Valor |
|---|---:|
| Controles revisados (input + select + textarea + button) | 705 |
| Conectados | 242 |
| Locales o simulados | 446 |
| Inertes | 17 |

Desglose por tipo: 219 `input`, 80 `select`, 5 `textarea`, 401 `button`.

Pantallas y componentes recorridos: 42 paginas de `src/pages/` mas 4
componentes de `src/components/` (Shell, BotChat, CrearTerceroModal,
ConfirmarCrearTerceroModal).

---

## 3. Funcionalidad que falta implementar

Deducida de los controles inertes y simulados. Cada entrada: control, pantalla,
que le falta.

### Maestros

1. **"+ Nuevo tercero" (Terceros)**: boton deshabilitado con nota "la creacion
   real se implementara en la siguiente fase". Falta que la propia pantalla
   abra el alta usando el `POST /api/terceros` que ya consumen
   `CrearTerceroModal` y las pantallas de captura.
2. **"Importar terceros" (Terceros)**: deshabilitado. Falta endpoint de
   importacion y mapeo de columnas.
3. **"Cupos" y "Guardar cupos" (Terceros)**: el boton de cabecera esta inerte y
   el de la ventana solo escribe estado local. Falta endpoint de actualizacion
   de cupo de cartera.
4. **"Reasignar NIT" (Terceros)**: asistente completo y deshabilitado. Falta
   endpoint que reescriba referencias contables del tercero.
5. **Pestana "Informes" (Terceros)**: deshabilitada, sin contenido.
6. **"Guardar", "Guardar cambios", "Eliminar" (Terceros)**: los modales del
   directorio aplican cambios solo en memoria; no existe lectura/escritura en
   `api/terceros.ts` (ese cliente solo tiene GET y POST). Faltan PUT y DELETE de
   tercero, o bien ocultar los modales mientras no existan.
7. **"+ Crear centro" (Centros)**, **"+ Crear comprobante" (Comprobantes)**,
   **"+ Crear tipo" (TiposDocumento)**: deshabilitados con nota "se habilitara
   despues de validar las reglas de escritura". Faltan los POST de esos tres
   maestros.
8. **Guardar / Crear / Eliminar en ConfigIVA, ConfigRetenciones, Plantillas,
   RenglonesRenta, FormatosDocumentales y Companias**: escriben y leen de
   `localStorage` con distintivo de "Datos de demostracion". Faltan tablas y
   endpoints de persistencia por compania.
9. **"Ejecutar funcion" (Especiales)**: la ventana de confirmacion valida motivo
   y texto pero la ejecucion es simulada (barra de progreso y aviso). Falta el
   endpoint de analisis/eliminacion de cuentas en cero.

### Movimientos

10. **"Guardar borrador" (CapturaDirecta)**: crea el lote solo en el estado de
    `App.tsx` (`onCrearLote`); no llega a `POST /api/lotes`. Falta crear el lote
    real antes de contabilizar.
11. **"Pegar"/"Insertar del portapapeles" y "Aplicar plantilla"
    (CapturaDirecta)**: insertan lineas fijas simuladas. Falta parseo real del
    portapapeles y de plantillas guardadas.
12. **"Generar lote" / "Crear lote" en Nomina, Reembolsos, Reclasificaciones y
    Plantillas**: arman el objeto `Lote` en memoria y llaman `onCrearLote`, que
    solo hace `setState`. Falta usar `POST /api/lotes` y
    `POST /api/lotes/{lote}/detalle`.
13. **"Simular" (Reclasificaciones)**: recalculo local sobre `data/mock`; falta
    la consulta de movimientos por documento contra el backend.

### Informes

14. **Boton "Generar"/"Abrir pantalla" de cada tarjeta (Informes)**: el boton no
    tiene manejador propio (el clic funciona solo por burbujeo al contenedor).
15. **Informes marcados como "Pendiente" (Informes)**: el parametro modal avisa
    que no estan implementados. Falta backend para esos informes.
16. **Pantalla BalanceComprobacion**: usa `SALDOS_BALANCE` de `data/mock` pese a
    que existen `api/balanceComprobacion.ts` y
    `/api/informes/balance-comprobacion` (los usa `Informes.tsx`). Falta cablear
    la pantalla suelta o eliminarla.
17. **"Imprimir" (BalanceComprobacion, DocumentoOficial)**: sin manejador. Falta
    impresion o exportacion.
18. **DocumentoOficial**: recibe `MOVIMIENTOS_FEB` del mock; falta consultar
    `/api/documentos/detalle` con la clave de la cabecera.

### Procesos

19. **"Generar lote de cierre" (Cierres)**: el boton de la vista previa solo
    cierra el modal; no genera lote ni llama a nada. Falta la ruta de cierre.
20. **"Iniciar asistente de traslado" y "No disponible" (Cierres)**: el primero
    no tiene manejador; el segundo es un boton deshabilitado (cierre anual en
    desarrollo).
21. **Pasos "Simulacion", "Respaldo y confirmacion", "Ejecucion", "Revalorizar",
    "Comparar totales" y chips de paso (Consolidacion)**: avanzan solo por
    estado; los chips son `cursor-pointer` sin manejador. Falta backend de
    consolidacion.
22. **"Iniciar mantenimiento" / "Volver al estado normal" (Reorganizacion)**:
    solo cambian estado local. Falta endpoint de modo mantenimiento.

### Impuestos

23. **Todos los controles de Impuestos (69)**: son simulados de forma explicita
    ("Retenciones exportadas en XLSX (simulado)", "Certificado cargado al portal
    DIAN (simulado)", "Medios magneticos generados ... (simulado)"). Faltan
    endpoints para acumulados de IVA y retenciones, medios magneticos,
    certificados y conceptos/formularios.

### Administracion

24. **Crear/Editar/Eliminar usuario (UsuariosPermisos)**: todo ocurre en estado
    local. Faltan tabla y endpoints de usuarios, roles y permisos.
25. **"Exportar XLSX" (Bitacora)**: `setTimeout` de 1 s y aviso "(simulado)". El
    backend ya escribe trazas (`auditoria_repository.py`) pero no las publica:
    falta la ruta que las exponga y consumirla desde la pantalla.
26. **"Probar conexion" y "Sincronizar" (Integraciones)**: `setTimeout` y avisos
    "(simulado)". Faltan conectores reales.

### Transversal

27. **Dashboard**: indicadores, lotes y "tareas pendientes" salen del mock.
    Podria usar rutas existentes (`/api/lotes`, `/api/documentos`).

---

## 4. Controles que prometen y no cumplen (detalle)

- **Botones que dicen guardar y solo escriben en `localStorage`**: Companias
  (linea 28), ConfigIVA (25), ConfigRetenciones (25), FormatosDocumentales (32),
  Plantillas (32), RenglonesRenta (25), Reembolsos (176). El aviso de exito es
  real para el navegador, no para la contabilidad.
- **Botones que dicen generar lote y no lo generan**: Cierres (linea 179,
  "Generar lote de cierre" solo `setShowCompCierre(false)`); Nomina (136),
  Plantillas (165), Reclasificaciones (235) y Reembolsos (224) via `onCrearLote`
  (estado local en `App.tsx`, linea 95). El texto posterior ("Borrador guardado
  en Lotes") no se corresponde con ningun lote del backend.
- **Botones inertes por falta de manejador**: BalanceComprobacion (linea 42,
  "Imprimir"); DocumentoOficial (156, "Imprimir documento"); Informes (695 y
  738, "Generar"/"Abrir pantalla"); Cierres (118, "Iniciar asistente de
  traslado").
- **Controles deshabilitados como marcador** (7 en total): Terceros 296
  (Importar), 298 (Cupos), 299-305 (Reasignar NIT), 306 (Nuevo tercero) y 328
  (pestana Informes); Centros 116; Comprobantes 79; TiposDocumento 104; Cierres
  132. Todos con `title` que reconoce la carencia.
- **Acciones simuladas con aviso explicito**: Bitacora 63, Especiales 67,
  Integraciones 116/120/124, Impuestos 214/237/253/268/309/436/598/672/754/1167,
  CapturaDirecta 431, Terceros 820.
- **Acciones sin `disabled` mientras cargan**: los flujos de consulta de
  Lotes, Anulacion, ConsultaDocumentos, MovimientoMensual, SaldosAnuales,
  AnualCuenta/Centro/Tercero, Comparativos e Informes si deshabilitan sus
  botones principales. Excepciones: en Lotes, "Ver detalle" (204) y las acciones
  de partida "Eliminar" (368) no se deshabilitan durante la carga, de modo que
  una doble pulsacion puede repetir la llamada.
- **Validacion solo en el frontend**: `CrearTerceroModal` exige primer nombre,
  primer apellido y segundo apellido (tipo documento 13) y un correo con un solo
  `@`; el modelo `ThirdPartyCreate` del backend
  (`backend/app.py:96-116`) los declara opcionales y no valida el formato del
  correo. Un cliente que no sea el modal puede crear terceros que la interfaz
  rechazaria.
- **Filtros contra el endpoint**: revisados los contratos de `/api/documentos`,
  `/api/movimiento-mensual`, `/api/consultas/comparativos`,
  `/api/consultas/saldos-anuales`, `/api/consultas/saldos-cuenta-centro/*`,
  `/api/consultas/documento-especifico`, `/api/terceros` y
  `/api/reprocesos/mensual/*` contra lo que envia `api/*.ts`. No se encontro
  ningun filtro que el endpoint no admita; en particular `Terceros` traduce
  "Activo"/"Bloqueado" a minusculas antes de enviar, y los tamanos de pagina
  usados (50, 100, 200) caen dentro de los limites del backend.

---

## 5. Sin determinar

- El conteo por pantalla de la columna conectados es una asignacion manual del
  manejador, no una traza automatica; en pantallas con decenas de campos de
  filtro (Lotes, Terceros, Impuestos) el limite entre conectado y local puede
  variar en uno o dos controles.
- No se ejecuto la interfaz ni los tests: la clasificacion sale de la lectura
  del codigo, no de una prueba en runtime contra el backend.
- No se revisaron `Interface_web/tests/` ni `Interface_web/scripts/smoke.mjs`.
- No se verifico si `BalanceComprobacion.tsx` se monta en algun punto fuera de
  `App.tsx` (no aparece importada alli, coincide con "pagina huerfana").
- No se audito la validacion campo por campo del resto de los formularios
  contra los `BaseModel` del backend, solo el caso de terceros.
- `Integraciones` muestra cuatro tablas de referencia (vehiculos, zonas, eventos,
  ciudades) declaradas como funciones compartidas; no se determino si su origen
  final sera el maestro contable o el ecommerce.
