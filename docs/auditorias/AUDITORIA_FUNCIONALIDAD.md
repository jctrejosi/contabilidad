# Auditoria de funcionalidad: control por control contra el backend

Deriva de `docs/catalogo/MAPA_FUNCIONALIDAD.md` (auditoria control por control ya
hecha) y verifica en codigo los hallazgos que ese documento senala. No repite el
mapa completo: lo evalua, lo corrige donde la lectura del codigo lo exige y lo
ordena por severidad y por dependencia para que sirva de plan de trabajo.

---

## 1. Ficha

| Campo | Valor |
|---|---|
| Objeto | Controles de la interfaz web (`Interface_web/src/`) frente a las rutas de `backend/app.py` |
| Alcance auditado | 42 paginas de `Interface_web/src/pages/`, 4 componentes de `Interface_web/src/components/`, 22 clientes de `Interface_web/src/api/`, y las rutas de `backend/app.py` que esos clientes invocan |
| Controles cubiertos | 705 (`input`, `select`, `textarea`, `button`) |
| Materia prima | `docs/catalogo/MAPA_FUNCIONALIDAD.md`, leido completo (300 lineas) |
| No auditado | `Interface_web/tests/` y `Interface_web/scripts/smoke.mjs`; no se ejecuto la interfaz ni ninguna prueba contra el backend; no se auditaron `ia-service/`, `db/` ni los `.mjs` de datos |
| Limite de los conteos | La columna "conectados" del mapa es una asignacion manual del manejador a un cliente de `api/*.ts`, no una traza en runtime. En pantallas con decenas de filtros identicos (Lotes, Terceros, Impuestos) el limite puede variar en uno o dos controles |
| Metodo | Lectura del mapa; localizacion de cada hallazgo con `grep` sobre `Interface_web/src/pages`, `Interface_web/src/api` y `backend/app.py`; lectura puntual del tramo de codigo con `read_file` y `start_line`/`end_line`. Cuando el mapa afirma algo que el codigo no confirma, se documenta la diferencia en el hallazgo |
| Fecha | 2026-09-21 |

Correspondencia de rutas con el mapa: donde el mapa dice "linea N", este informe
cita `archivo:linea`; se verificaron y coinciden las lineas de Terceros (296, 298,
299-305, 306, 328), Centros (116), Comprobantes (79), TiposDocumento (104),
Cierres (132, 179), BalanceComprobacion (42), DocumentoOficial (156),
Informes (695, 738), Bitacora (63), Especiales (67), Integraciones (116/120/124),
CapturaDirecta (431) y Terceros (820).

---

## 2. Resumen ejecutivo

Totales del mapa (no recalculados): **705 controles** en 42 pantallas y 4
componentes; **242 conectados** a un endpoint real, **446 locales o simulados**,
**17 inertes**.

La conclusion corta: el problema no es el volumen de control sin backend, es que
**los 446 controles locales son indistinguibles a simple vista de los 242
conectados**. Solo una parte de las pantallas simuladas lleva el distintivo
"Datos de demostracion" en la cabecera; donde no lo lleva (CapturaDirecta,
Terceros, DocumentoOficial, Dashboard, BalanceComprobacion, Cierres) el usuario no
tiene forma de saber que lo que acaba de hacer no existe fuera del navegador.

| Id | Hallazgo | Pantallas | Severidad |
|---|---|---|---|
| H1 | "Guardar borrador" anuncia un lote en Lotes que no se crea | CapturaDirecta | Critico |
| H2 | "Generar lote"/"Usar plantilla" anuncian un lote que no se crea | Nomina, Plantillas, Reclasificaciones, Reembolsos | Alto |
| H3 | Guardar/crear/eliminar solo en `localStorage`, con aviso de exito | Companias, ConfigIVA, ConfigRetenciones, FormatosDocumentales, Plantillas, RenglonesRenta | Alto |
| H4 | La compania creada no existe para el backend ni aparece en el selector | Companias | Alto |
| H5 | "Generar lote de cierre" solo cierra el modal; "Iniciar asistente de traslado" no tiene manejador | Cierres | Alto |
| H6 | "Ejecutar funcion" simula la ejecucion y afirma un registro en bitacora que no ocurre | Especiales | Alto |
| H7 | Crear/editar/eliminar usuario solo en estado local | UsuariosPermisos | Alto |
| H8 | Exportar bitacora y probar/sincronizar integraciones con `setTimeout` y "(simulado)" | Bitacora, Integraciones | Alto |
| H9 | Mantenimiento, reorganizacion y pasos de consolidacion solo cambian estado | Reorganizacion, Consolidacion | Alto |
| H10 | Los 69 controles de Impuestos son simulacion declarada, sin endpoint ni cliente | Impuestos | Medio |
| H11 | "Documento oficial" siempre muestra el mismo mock de febrero | DocumentoOficial (desde ConsultaDocumentos, MovimientoMensual, DocumentoEspecifico) | Medio |
| H12 | Balance de comprobacion sobre mock existiendo cliente y endpoint | BalanceComprobacion (pagina huerfana) | Medio |
| H13 | Indicadores, lotes y tareas del tablero salen del mock | Dashboard | Medio |
| H14 | Modales de escritura del directorio de Terceros: codigo que simula persistir y no es alcanzable | Terceros | Medio |
| H15 | Portapapeles y plantillas de CapturaDirecta insertan lineas fijas; Reembolsos guarda en el navegador | CapturaDirecta, Reembolsos | Medio |
| H16 | "Editar"/"Eliminar" del detalle de lote no se deshabilitan durante la carga | Lotes | Bajo |
| H17 | Los botones de las tarjetas de informes no tienen manejador propio | Informes | Bajo |
| H18 | Validacion exigente solo en la interfaz; el modelo del backend no la replica | CrearTerceroModal / `backend/app.py` | Bajo |

Reparto: 1 critico, 8 altos, 6 medios, 3 bajos.

No son hallazgos, y conviene decirlo: los **17 controles inertes** son en su
mayoria marcadores honestos (botones `disabled` con `title` que reconoce la
carencia, como Centros 116, Comprobantes 79, TiposDocumento 104, Terceros 296/298/306,
Cierres 132). Tampoco es hallazgo que los filtros enviados a los endpoints
existan en el backend: el mapa reviso los contratos de `/api/documentos`,
`/api/movimiento-mensual`, `/api/consultas/comparativos`,
`/api/consultas/saldos-anuales`, `/api/consultas/saldos-cuenta-centro/*`,
`/api/consultas/documento-especifico`, `/api/terceros` y
`/api/reprocesos/mensual/*` sin encontrar filtro no admitido; este informe **no
volvio a verificar contrato por contrato**, lo da por bueno del mapa.

---

## 3. Hallazgos por severidad

### 3.1 Escala y su justificacion

| Severidad | Criterio |
|---|---|
| Critico | La interfaz promete persistir y no persiste, o muestra como real una funcionalidad que no existe |
| Alto | El usuario cree que ejecuto una accion y esa accion no llego al backend |
| Medio | Se usa un dato simulado existiendo el endpoint real |
| Bajo | Robustez o validacion de interfaz |

Se usa esta escala, y no una por tamano del modulo, porque lo que decide el dano
no es cuantos controles fallan sino **si el fallo se puede detectar desde la
pantalla**. De ahi un criterio de desempate que se aplica de forma uniforme en
todo el informe:

- **Critico** cuando el aviso de exito afirma persistencia y la pantalla **no**
  lleva el distintivo "Datos de demostracion". Nada en pantalla permite dudar.
- **Alto** cuando ocurre lo mismo pero la pantalla **si** lleva el distintivo, o
  cuando el control no muestra confirmacion alguna pero el usuario queda con la
  impresion de haber ejecutado (por ejemplo, un modal que se cierra).

Dos notas de honestidad sobre la escala:

1. **Medio** no cubre bien el caso de Impuestos (H10): alli no existe el endpoint
   real, de modo que el supuesto "existiendo el endpoint real" no se cumple. Se
   clasifica Medio porque la simulacion esta **declarada** en el propio texto
   ("(simulado)") y en el distintivo de la cabecera: entera al usuario, y por eso
   no es Alto, pero tampoco es una funcionalidad terminada.
2. **H14** (modales de Terceros) tampoco encaja en la escala: es codigo que simula
   persistir y hoy **no es alcanzable**. Se clasifica Medio por el riesgo de
   mantenimiento (el dia que alguien habilite el boton, el fallo pasa a Critico),
   no porque el usuario lo sufra hoy.

### 3.2 Critico

#### H1. CapturaDirecta: "Guardar borrador" anuncia un lote que no se crea

**Que pasa.** El boton construye el objeto `Lote` en el navegador, lo entrega al
manejador de `App.tsx` y muestra un aviso de exito que nombra la pantalla Lotes.
Ninguna llamada sale a `POST /api/lotes`.

**Donde.** CapturaDirecta.tsx (boton en 583-585, manejador 469-517, aviso en 515)
y App.tsx:95-97.

Evidencia:

```
// Interface_web/src/App.tsx:95-97
function crearLote(lote: Lote) {
  setLotes(prev => [lote, ...prev]);
}
```

```
// Interface_web/src/pages/CapturaDirecta.tsx:513-516
      lineas: lineasLote,
    };
    onCrearLote(lote);
    setAviso({ tipo: 'success', texto: `Borrador ${codigo} guardado en Lotes con ${lineasLote.length} línea(s).` });
```

**Impacto.** Es el peor caso del informe porque la pantalla que el aviso nombra
(Lotes) **si** lee del backend (`consultarLotes` en Lotes.tsx:74-84). El usuario
termina la captura, lee que el borrador quedo en Lotes, navega a Lotes y no
existe. A diferencia de las pantallas simuladas, CapturaDirecta no lleva
distintivo de demostracion: nada advierte. El dano es de confianza en la parte
que si funciona (contabilizacion, que si llega al backend).

**Para cerrarlo.** Crear el lote real antes de contabilizar: `POST /api/lotes`
con el encabezado y `POST /api/lotes/{lote}/detalle` con las lineas; el cliente
`api/lotes.ts` ya expone esas operaciones. El aviso debe usar el codigo devuelto
por el backend, no el `CD-nn` generado en el navegador.

### 3.3 Alto

#### H2. Generacion de lote en Nomina, Plantillas, Reclasificaciones y Reembolsos

**Que pasa.** El mismo mecanismo de H1, repetido. Cada pantalla arma el `Lote` en
memoria, llama `onCrearLote` (que solo hace `setState` en App.tsx:95) y anuncia un
lote "creado como Borrador". Reclasificaciones ademas ofrece un boton "Abrir
lotes" que navega a la pantalla real: la promesa se puede comprobar y falla.

**Donde.** Nomina.tsx:134-138; Plantillas.tsx:158-168; Reclasificaciones.tsx:232-238;
Reembolsos.tsx (via `onCrearLote`, App.tsx:130-131); estado en App.tsx:95-97.

Evidencia:

```
// Interface_web/src/pages/Reclasificaciones.tsx:232-237
  function generarLote() {
    if (!resultado || simulando) return;
    const lote = crearLoteReclasificacion(resultado, Math.floor(Math.random() * 900) + 100);
    onCrearLote(lote);
    setLoteCreado(lote);
    setMensaje({ tipo: 'success', texto: `Lote ${lote.codigo} creado como Borrador y cuadrado (${fmtCOP(lote.debito)} = ${fmtCOP(lote.credito)}).` });
```

**Impacto.** El usuario cree que dejo un borrador listo para revisar en Lotes y no
existe. Se clasifica Alto, no Critico, por el desempate declarado: las cuatro
pantallas llevan el distintivo "Datos de demostracion" en la cabecera
(Nomina.tsx:143-150, Plantillas.tsx:187-194, Reclasificaciones.tsx:275-277,
Reembolsos.tsx:231-238).

**Para cerrarlo.** El mismo de H1 y sobre rutas que ya existen: `POST /api/lotes`
y `POST /api/lotes/{lote}/detalle` en `api/lotes.ts`.

#### H3. Guardar, crear y eliminar escriben solo en `localStorage`

**Que pasa.** Seis pantallas de configuracion persisten en el navegador y
confirman con un aviso de exito sin matiz ("guardada", "creada", "actualizada").
Si el navegador cambia o se limpia el almacenamiento, el trabajo desaparece.

**Donde.** Companias.tsx:27-33 (escritura), 175-186 y 187-194 (avisos);
ConfigIVA.tsx:24-27; ConfigRetenciones.tsx:24-27; FormatosDocumentales.tsx:31-34;
Plantillas.tsx:31-34; RenglonesRenta.tsx:24-27. Todas con distintivo de
demostracion en cabecera (por ejemplo Companias.tsx:252-259).

Evidencia:

```
// Interface_web/src/pages/Companias.tsx:26-33
function guardar(companias: CompaniaConfig[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(companias));
    return true;
  } catch {
```

```
// Interface_web/src/pages/Companias.tsx:181-183
    setCompanias(siguientes);
    setMensaje({ tipo: 'success', texto: modal?.modo === 'editar' ? `Compañía ${limpio.codigo} actualizada.` : `Compañía ${limpio.codigo} creada.` });
```

**Impacto.** Las seis pantallas alimentan decisiones que si son reales (tarifas de
IVA, retenciones, plantillas, companias), pero ninguna tarifa ni plantilla
configurada aqui llega a la contabilidad. Es el grupo mas grande por numero de
controles y, segun el propio plan del asistente, el que mas se pregunta.

**Para cerrarlo.** Tablas y endpoints de persistencia por compania, y que el GET
de arranque lea de esa fuente; el cambio es de datos, no de interfaz.

#### H4. La compania creada no existe para el backend

**Que pasa.** El selector de ingreso lee companias reales de `/api/companias`,
pero la pantalla de configuracion gestiona su propia lista en `localStorage`.
Una compania creada alli no aparece nunca en el selector.

**Donde.** api/companias.ts:12-29 (el cliente solo tiene GET) frente a
Companias.tsx:27-33 (escritura local) y Companias.tsx:380-383 (confirmacion de
eliminacion, que solo toca el estado).

Evidencia:

```
// Interface_web/src/api/companias.ts:12-16
/** Consulta las compañías reales que el usuario puede elegir al ingresar. */
export async function listarCompanias(signal?: AbortSignal): Promise<CompaniaSesion[]> {
  if (requestInProgress) return requestInProgress;
  requestInProgress = (async () => {
    const response = await fetch('/api/companias', { signal });
```

**Impacto.** No hay endpoint de alta o baja de compania en el backend, de modo que
el ciclo completo de la pantalla (crear, trasladar ano, limpiar datos) es ficcion
administrativa. El usuario puede creer que habilito una contabilidad nueva.

**Para cerrarlo.** Definir si el alta de companias es de la aplicacion o del motor
de datos. Si es de la aplicacion: endpoints de alta/baja y que `/api/companias`
devuelva tambien las creadas. Si es del motor: convertir la pantalla en consulta y
quitar los botones de escritura.

#### H5. Cierres: "Generar lote de cierre" e "Iniciar asistente de traslado"

**Que pasa.** El boton principal de la vista previa de cierre solo cierra el
modal: no genera lote ni llama a nada. El asistente de traslado es un boton sin
manejador.

**Donde.** Cierres.tsx:177-180 (el boton cierra el modal) y Cierres.tsx:118-122
(boton sin `onClick`).

Evidencia:

```
// Interface_web/src/pages/Cierres.tsx:178-179
              <button onClick={() => setShowCompCierre(false)} className="text-xs px-4 py-2 border border-gray-200 rounded text-gray-600">Cancelar</button>
              <button onClick={() => setShowCompCierre(false)} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>Generar lote de cierre</button>
```

**Impacto.** El modal se cierra y no hay confirmacion: el usuario no sabe si el
cierre se hizo. No hay ruta de cierre en el backend, asi que la pantalla entera es
una maqueta sin distintivo de demostracion.

**Para cerrarlo.** Rutas de cierre (mensual y anual) y manejador del asistente; o
marcar la pantalla como no disponible mientras no existan.

#### H6. Especiales: la ejecucion se simula y ademas afirma un registro inexistente

**Que pasa.** La ventana de confirmacion valida de verdad (motivo de al menos 10
caracteres y texto exacto), lo que refuerza la sensacion de operacion real. La
ejecucion, sin embargo, es una barra de progreso sobre `setInterval`, y el
resultado afirma que la accion "quedo registrada en la bitacora".

**Donde.** Especiales.tsx:58-69 (el `setInterval` y los dos avisos), 97-105
(validacion real).

Evidencia:

```
// Interface_web/src/pages/Especiales.tsx:66-67
          setResultado(`${funcion.nombre} completado el ${new Date().toLocaleDateString('es-CO')} por ${USUARIO.nombre}. La acción quedó registrada en la bitácora con el motivo indicado.`);
          setMensaje({ tipo: 'success', texto: `${funcion.nombre}: ejecución simulada completada.` });
```

**Impacto.** Son operaciones destructivas sobre el plan de cuentas (eliminacion de
cuentas en cero). La afirmacion del registro en bitacora es falsa: no hay ruta de
bitacora (ver H8). Un motivo que se escribio para auditoria no queda en ninguna
parte. Es Alto pese al distintivo de demostracion precisamente por esa segunda
frase, que el sufijo "(simulado)" del aviso corto no alcanza a desmentir.

**Para cerrarlo.** Endpoint de analisis y eliminacion de cuentas en cero, con
registro real del motivo; mientras no exista, eliminar la frase sobre la bitacora.

#### H7. Usuarios y permisos: todo en estado local

**Que pasa.** Crear, editar, eliminar usuario y marcar permisos operan sobre
`useState`. El aviso de creacion y de actualizacion dice "creado" y "actualizado"
a secas; solo el de eliminacion lleva "(simulado)".

**Donde.** UsuariosPermisos.tsx:92-102 (estado inicial),
129-137 (crear y editar), 141-145 (eliminar), 147-151 (permisos).

Evidencia:

```
// Interface_web/src/pages/UsuariosPermisos.tsx:135-137
      setUsuarios(prev => [...prev, { id: `u-${Date.now()}`, nombre: form.nombre.trim(), email: form.email.trim(), rol: form.rol, estado: form.estado }]);
      setMensaje({ tipo: 'success', texto: `Usuario «${form.nombre.trim()}» creado con el rol ${form.rol}.` });
      setCreando(false);
```

**Impacto.** Un administrador cree haber dado de alta a un contador y revocado
permisos; no rige nada. La cabecera aclara "cambios simulados en este navegador"
(UsuariosPermisos.tsx:160), lo que lo mantiene fuera de Critico.

**Para cerrarlo.** Tablas y endpoints de usuarios, roles y permisos, y que el
control de acceso efectivo los consulte; no basta con la pantalla.

#### H8. Bitacora e Integraciones: `setTimeout` con aviso "(simulado)"

**Que pasa.** "Exportar XLSX" espera un segundo, anuncia un archivo generado y no
genera nada. "Probar conexion" y "Sincronizar" hacen lo mismo con un resultado
fijo por modulo.

**Donde.** Bitacora.tsx:58-64; Integraciones.tsx:104-115 y 116-125.

Evidencia:

```
// Interface_web/src/pages/Bitacora.tsx:58-64
  function exportarXLSX() {
    setExportando(true);
    setMensaje(null);
    window.setTimeout(() => {
      setExportando(false);
      setMensaje('Archivo bitacora-2026-02.xlsx generado (simulado).');
    }, 1000);
```

**Impacto.** La pantalla de bitacora se presenta como "registro inmutable de las
acciones del sistema" (Bitacora.tsx:72), pero su tabla y su exportacion son fijas.
Agrava H6: el backend **si** escribe trazas (postgres_writes.py:1186-1190 inserta
en la tabla `auditoria`), y sin embargo no hay ninguna ruta que las publique:
`grep` de "auditoria" en `backend/app.py` no devuelve ninguna coincidencia. Lo que
el usuario ve no es la bitacora real que el sistema ya esta escribiendo.

**Para cerrarlo.** Ruta que exponga `auditoria_repository` y consumirla desde la
pantalla; conectores reales para Integraciones.

#### H9. Reorganizacion y Consolidacion: pasos que solo cambian estado

**Que pasa.** "Iniciar mantenimiento", "Volver al estado normal", los pasos de
consolidacion y los chips de paso avanzan por `useState`; el progreso se dibuja
con un `setInterval`. Los chips de paso son elementos con `cursor-pointer` y sin
manejador.

**Donde.** Reorganizacion.tsx:40-50 (estado), 72-82 (confirmar y volver),
185-187 (boton); Consolidacion.tsx:39-44 (chips), 64-74 (origenes),
187-189 (boton de consolidar).

Evidencia:

```
// Interface_web/src/pages/Reorganizacion.tsx:72-76
  function confirmar() {
    setShowModal(false);
    setFase('ejecutando');
```

**Impacto.** La reorganizacion se presenta como operacion exclusiva que "excluye a
los demas usuarios" (Reorganizacion.tsx:107-117); ocurre solo en el navegador de
quien la pulsa. En Consolidacion, marcar el boton de consolidar produce una
confirmacion que no toca ningun dato.

**Para cerrarlo.** Endpoint de modo mantenimiento y backend de consolidacion; los
chips de paso necesitan manejador o deben dejar de parecer interactivos.

### 3.4 Medio

#### H10. Impuestos: 69 controles de simulacion declarada

**Que pasa.** Acumular IVA y retenciones, generar medios magneticos, cargar
certificados al portal, agregar y eliminar formatos, copiar definiciones de otra
compania y descargar archivos: todo con `setTimeout` y avisos que terminan en
"(simulado)". No existe cliente en `Interface_web/src/api/` (los 22 archivos
listados no incluyen ninguno de impuestos) ni ruta en el backend.

**Donde.** Impuestos.tsx:207-215 (medios magneticos), 230-238 (acumulados),
248-254 (portal), 258-268 (formato agregado), 304-310 (copiar definiciones),
426-436 (exportar retenciones), 663-672 (exportar IVA), 749-754 (eliminar formato),
1164-1167 (descargar); distintivo en 397-404.

Evidencia:

```
// Interface_web/src/pages/Impuestos.tsx:232-238
    window.setTimeout(() => {
      setAcumulando(null);
      if (tipo === 'ret') setUltimaRet('2026-02-28');
      else setUltimaIva('2026-02-28');
      setMensaje(`Acumulados de ${tipo === 'ret' ? 'retenciones' : 'IVA'} actualizados al período 2026-02 (simulado).`);
    }, 1000);
```

**Impacto.** Es el modulo con mas controles del aplicativo y ninguno funciona. La
simulacion esta declarada, de modo que el usuario no es enganado; el costo es que
un modulo completo no sirve para el trabajo real (declaraciones a la DIAN).

**Para cerrarlo.** Endpoints de acumulados de IVA y retenciones, medios
magneticos, certificados y conceptos/formularios, y su cliente `api/*.ts`.

#### H11. "Documento oficial" muestra siempre el mismo mock

**Que pasa.** Tres pantallas conectadas al backend ofrecen un boton "Documento
oficial" que abre `DocumentoOficial.tsx`, el cual **no recibe la clave del
documento consultado**: filtra `MOVIMIENTOS_FEB` por el literal `NOM-2026-02`. Sin
importar el documento que el usuario acaba de buscar, ve las lineas del mock.

**Donde.** DocumentoOficial.tsx:1 (import del mock) y 8-12 (filtro fijo); puntos
de entrada en ConsultaDocumentos.tsx:218-221, MovimientoMensual.tsx:168-169 y
DocumentoEspecifico.tsx (boton "Documento oficial"); endpoint real disponible en
backend/app.py:676-686 (`/api/documentos/detalle`).

Evidencia:

```
// Interface_web/src/pages/DocumentoOficial.tsx:8-9
export default function DocumentoOficial({ onNavigate }: Props) {
  const lineas = MOVIMIENTOS_FEB.filter(m => m.documento === 'NOM-2026-02');
```

**Impacto.** De los hallazgos de severidad Media es el de mayor riesgo: un
contador que consulte un documento real y pulse "Documento oficial" obtiene una
imprimible con datos de febrero que no corresponden a lo consultado, y puede
usarla como soporte. La pantalla no lleva distintivo de demostracion.

**Para cerrarlo.** Pasar la clave de la cabecera (compania, comprobante, tipo,
documento, fecha) y consultar `/api/documentos/detalle`; el boton "Imprimir"
(DocumentoOficial.tsx:156) necesita manejador.

#### H12. BalanceComprobacion: mock existiendo cliente y endpoint

**Que pasa.** La pantalla lee `SALDOS_BALANCE` del mock aunque existen el cliente
`api/balanceComprobacion.ts` y la ruta `/api/informes/balance-comprobacion` (que
si usa `Informes.tsx`). Ademas no esta importada en `App.tsx`: es pagina huerfana.

**Donde.** BalanceComprobacion.tsx:1-2 (import del mock) y 42 (boton de imprimir
sin manejador); backend/app.py:944-954; uso real en Informes.tsx:4-9.

Evidencia:

```
// Interface_web/src/pages/BalanceComprobacion.tsx:1-2
import { useState } from 'react';
import { SALDOS_BALANCE, fmtCOP } from '../data/mock';
```

**Impacto.** Hoy el dano es bajo porque la pagina no se monta, pero es una version
paralela de un informe que si funciona, con cifras inventadas y sin distintivo.

**Para cerrarlo.** Cablearla al cliente existente o eliminarla; si se mantiene,
que no comparta nombre con el informe real de `Informes.tsx`.

#### H13. Dashboard: indicadores del mock

**Que pasa.** Alertas, lotes y tareas del tablero salen de `data/mock`
(`EMPRESA`, `PERIODO`, `ALERTAS`, `LOTES_INICIALES`). Parte de esos datos si
existe en el backend: `/api/lotes` y `/api/documentos`.

**Donde.** Dashboard.tsx:1 (import del mock) y 92-102 (agregados calculados sobre
`lotes` del estado, que a su vez nace del mock y de `crearLote`).

Evidencia:

```
// Interface_web/src/pages/Dashboard.tsx:1
import { EMPRESA, PERIODO, ALERTAS, LOTES_INICIALES, fmt, fmtCOP } from '../data/mock';
```

**Impacto.** Es la primera pantalla que ve el usuario al entrar y no lleva
distintivo: las cifras y las "tareas pendientes" parecen estado real de la
contabilidad.

**Para cerrarlo.** Consumir `/api/lotes` y `/api/documentos` para los indicadores;
dejar en el mock solo lo que sea decorativo.

#### H14. Terceros: modales de escritura que simulan persistir y no son alcanzables

**Que pasa.** El archivo contiene crear, editar, eliminar tercero, guardar cupos e
importar, cada uno con aviso de exito ("Tercero X creado", "Tercero X
actualizado", "Tercero X eliminado", "Cupos de credito actualizados") y todos
operando sobre `useState`. La comprobacion de alcanzabilidad, sin embargo, no los
confirma: las funciones que abren esos modales (`abrirNuevo`, `abrirEditar`,
`abrirCupos`) no tienen punto de llamada. El boton "+ Nuevo tercero" esta
deshabilitado (306), "Cupos" esta deshabilitado (298), "Importar" esta
deshabilitado (296) y la columna de acciones de cada fila dice "Solo consulta"
(423) en lugar de ofrecer Editar/Eliminar. Es decir: **hoy el usuario no puede
disparar ninguno de esos flujos**; el codigo queda como maquinaria armada.

**Donde.** Terceros.tsx:151-176 (guardarNuevo), 184-203 (guardarEditar),
214-220 (confirmarEliminar), 229-233 (guardarCupos), 235-245 (importar);
inalcanzabilidad en 296, 298, 306, 423; `api/terceros.ts` solo tiene GET
(listarTerceros, 44-73) y POST (crearTercero, 76-87).

Evidencia:

```
// Interface_web/src/pages/Terceros.tsx:214-219
  function confirmarEliminar() {
    if (!selectedNit) return;
    setTerceros(prev => prev.filter(t => t.nit !== selectedNit));
    setShowEliminar(false);
    setSelectedNit(null);
    setAviso({ tipo: 'success', texto: `Tercero ${selectedNit} eliminado.` });
  }
```

```
// Interface_web/src/pages/Terceros.tsx:421-424
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">Solo consulta</span>
                            </div>
                          </td>
```

**Impacto.** Corrige el punto 6 de la seccion 3 del mapa, que da esos modales por
alcanzables ("los modales del directorio aplican cambios solo en memoria"). En el
estado actual no enganan a nadie; el riesgo es de mantenimiento: basta habilitar
el boton deshabilitado para que el aviso "Tercero X eliminado" pase a ser falso
ante un directorio que se recarga desde FADCLI. Se clasifica Medio por el riesgo
latente y porque, al no haber endpoint PUT ni DELETE, el hueco es real; no se
clasifica Critico porque ninguna ruta de la interfaz lo expone hoy.

**Para cerrarlo.** Decidir en un sentido o en otro: (a) implementar PUT y DELETE
en `api/terceros.ts` y en el backend, cablear los modales y habilitar los botones;
o (b) eliminar del archivo los modales y sus manejadores, y dejar la pagina como
consulta con el alta real que ya existe via `CrearTerceroModal`. Lo que no
conviene es dejarlo como esta: funcionalidad creible y ya escrita a medio conectar.

#### H15. CapturaDirecta y Reembolsos: lineas fijas y borrador local declarados

**Que pasa.** "Pegar/Insertar del portapapeles" y "Aplicar plantilla" insertan
lineas constantes (`FILAS_PORTAPAPELES`, `PLANTILLAS`), no leen el portapapeles ni
plantillas guardadas. Reembolsos persiste el borrador en `localStorage`.

**Donde.** CapturaDirecta.tsx:77-87 (plantillas fijas), 110-114 (filas del
portapapeles), 418-432 (aplicar e insertar, aviso en 431), 1046
("Simulacion: se detectaron 3 filas en el portapapeles");
Reembolsos.tsx:74-80 (lectura) y 175-179 (escritura y aviso).

Evidencia:

```
// Interface_web/src/pages/CapturaDirecta.tsx:429-431
  function insertarPortapapeles() {
    insertarPlantilla(FILAS_PORTAPAPELES);
    setShowExcel(false);
    setAviso({ tipo: 'success', texto: 'Se insertaron 3 líneas simuladas del portapapeles.' });
```

```
// Interface_web/src/pages/Reembolsos.tsx:177-178
      localStorage.setItem(STORAGE_KEY, JSON.stringify(siguiente));
      setGuardado(structuredClone(siguiente));
      setMensaje({ tipo: 'success', texto: 'Reembolso guardado como borrador en este navegador.' });
```

**Impacto.** El portapapeles esta declarado como simulacion ("3 lineas simuladas")
y Reembolsos dice explicitamente "en este navegador", de modo que no enganan al
usuario; el costo es que "F5 Plantilla" no usa las plantillas que la aplicacion
permite crear, y que el borrador de reembolso no viaja con la compania ni entre
equipos.

**Para cerrarlo.** Parseo real del portapapeles y lectura de plantillas guardadas
(lo que depende de H3 para que existan plantillas persistentes); borrador de
reembolso sobre el lote real, igual que H2.

### 3.5 Bajo

#### H16. Lotes: "Editar" y "Eliminar" no se deshabilitan durante la carga

**Que pasa.** El resto de los flujos de consulta deshabilitan sus botones mientras
carga; en Lotes, las acciones de fila no. Una doble pulsacion repite la llamada.

**Donde.** Lotes.tsx:368 (columna de acciones del detalle, sin `disabled` ligado a
`cargando`); el boton "Ver detalle" (204) es el otro caso que el mapa senala.

Evidencia:

```
// Interface_web/src/pages/Lotes.tsx (columna de acciones del detalle)
<button type="button" onClick={() => setEditor(linea)} ...>Editar</button><button type="button" onClick={() => void eliminar(linea)} ...>Eliminar</button>
```

**Impacto.** Llamadas duplicadas y, en el peor caso, un error de concurrencia sobre
el mismo lote. No pierde datos de forma conocida.

**Para cerrarlo.** Anadir `disabled={cargando}` a esas dos acciones y a "Ver
detalle". Se deja **sin linea exacta de `disabled` que respalde el fallo** porque
lo que hay que citar es una ausencia; la linea 368 se verifico como la columna de
acciones, y la ausencia de `disabled` se comprobo leyendo el bloque completo
(Lotes.tsx:365-371).

#### H17. Informes: los botones de las tarjetas no tienen manejador

**Que pasa.** Cada tarjeta dibuja un boton "Generar"/"Abrir pantalla" (o
"Pendiente"), pero el `onClick` esta en el contenedor de la fila, no en el boton.

**Donde.** Informes.tsx:695 y 738 (boton sin `onClick`); 678 y 720 (contenedor con
`onClick={() => abrirInforme(inf)}`).

Evidencia:

```
// Interface_web/src/pages/Informes.tsx:695
              <button className={`text-xs px-3 py-1 rounded shrink-0 ${PENDING_REPORTS[inf.id] ? 'bg-amber-100 text-amber-800' : 'bg-petroleum-500 text-white hover:bg-petroleum-600'}`}>
```

**Impacto.** Con raton el clic funciona por burbujeo, de modo que el usuario no
nota nada; el fallo aparece en el foco y en la semantica (el boton anunciado no es
el que actua) y en la etiqueta de estado de los informes "Pendiente", que se pinta
en un boton que no hace nada. Es Bajo: robustez y accesibilidad, no perdida de
funcionalidad.

**Para cerrarlo.** Mover el manejador al boton y deshabilitarlo cuando el informe
este en `PENDING_REPORTS`.

#### H18. La validacion exigente vive solo en la interfaz

**Que pasa.** `CrearTerceroModal` exige primer nombre, primer apellido, segundo
apellido (para tipo de documento 13) y un correo con formato valido. El modelo
`ThirdPartyCreate` del backend declara esos campos con valor por defecto vacio y
no valida el correo: solo el NIT, el nombre y el tipo de documento son
obligatorios.

**Donde.** CrearTerceroModal.tsx:51-55 (regla de validez); backend/app.py:96-116.

Evidencia:

```
// backend/app.py:104-114
    nombre: str = Field(min_length=1, max_length=60)
    nombreComercial: str = Field("", max_length=60)
    primerNombre: str = Field("", max_length=20)
    segundoNombre: str = Field("", max_length=20)
    primerApellido: str = Field("", max_length=20)
    ...
    correo: str = Field("", max_length=60)
```

**Impacto.** Ninguno por la via de la interfaz: el modal no deja guardar lo que el
backend aceptaria. El hueco es de contrato: cualquier otro consumidor de
`POST /api/terceros` puede crear terceros sin nombres y con correo invalido, que
la interfaz despues mostrara y que el propio directorio no permitiria crear. Es
Bajo porque no hay perdida de datos ni accion perdida.

**Para cerrarlo.** Mover la regla al backend (`ThirdPartyCreate` o el validador de
FADCLI) para que la regla de negocio no dependa del cliente que llame.

---

## 4. Funcionalidad que falta implementar, por dependencia

El orden no es alfabetico: esta pensado para que **cada paso no se apoye en algo
que aun no existe**. "Prerrequisito" dice que hay que tener hecho antes.

### Bloque A. Cableado barato y sin prerrequisito (empezar aqui)

No crea funcionalidad nueva: usa endpoints que ya existen. Se hace primero porque
es el menor esfuerzo para dejar de presentar datos falsos en pantallas donde ya
hay backend detras.

- **A1. DocumentoOficial**: pasar la clave de la cabecera y consultar
  `/api/documentos/detalle` (backend/app.py:676). Cierra H11. Control: el boton
  "Documento oficial" de ConsultaDocumentos (218-221), MovimientoMensual (168-169)
  y DocumentoEspecifico. Endpoint: `GET /api/documentos/detalle` (ya existe).
- **A2. Dashboard**: sustituir `LOTES_INICIALES` y las alertas del mock por
  `/api/lotes` y `/api/documentos`. Cierra H13. Endpoints: ya existen.
- **A3. BalanceComprobacion**: cablearla a `api/balanceComprobacion.ts` o
  eliminarla. Cierra H12. Endpoint: `GET /api/informes/balance-comprobacion` (ya
  existe).
- **A4. CapturaDirecta, "F5 Plantilla"**: dejar de usar `PLANTILLAS` fijas. Depende
  de B3 para que existan plantillas persistidas; puede hacerse a la vez que B3.
  Cierra parte de H15.
- **A5. Informes, informes "Pendiente"**: los seis de `PENDING_REPORTS`
  (Informes.tsx:160-167) necesitan informes reales: clasificacion
  corriente/no corriente, definicion de flujo de caja, clasificaciones NIIF y el
  generador personalizado. Control: el boton "Pendiente" de cada tarjeta
  (695, 738). Falta backend y cliente.

### Bloque B. Base de escritura de maestros (prerrequisito de C y D)

Es el conjunto de endpoints de escritura que hoy no existe. Sin este bloque, todo
lo demas de escritura queda en el navegador.

- **B1. Terceros: cerrar el directorio.** Endpoints `PUT /api/terceros/{nit}` y
  `DELETE /api/terceros/{nit}` en el backend y en `api/terceros.ts` (que solo
  tiene GET y POST); decidir el destino de los modales locales de Terceros
  (Terceros.tsx:151-245). Cierra H14. Control: "+ Nuevo tercero" (306), "Cupos"
  (298), "Guardar cupos" (855), "Guardar"/"Guardar cambios"/"Eliminar" de los
  modales. Prerrequisito de D4 (cupos) y de la reasignacion de NIT.
- **B2. Centros, Comprobantes y Tipos de documento: endpoints POST.** Hoy los tres
  botones estan deshabilitados con la nota "se habilitara despues de validar las
  reglas de escritura" (Centros.tsx:116, Comprobantes.tsx:79,
  TiposDocumento.tsx:104). Control: esos tres botones. Falta: `POST /api/centros`,
  `POST /api/comprobantes`, `POST /api/tipos-documento` y validacion de unicidad y
  dependencias.
- **B3. Persistencia por compania de la configuracion.** Tablas y endpoints para
  Companias, ConfigIVA, ConfigRetenciones, FormatosDocumentales, Plantillas y
  RenglonesRenta (hoy `localStorage`, Companias.tsx:27-33 y sus equivalentes).
  Cierra H3. Cierra tambien H4 en su parte de alta/baja de compania, y decide si
  `/api/companias` debe devolver lo creado aqui. Control: los botones
  Guardar/Crear/Eliminar de las seis pantallas. Prerrequisito de A4 y de E2.

### Bloque C. Escritura de movimientos (prerrequisito: B)

- **C1. Conectar "Guardar borrador" de CapturaDirecta** a `POST /api/lotes` y
  `POST /api/lotes/{lote}/detalle`; el aviso debe usar el codigo del backend.
  Cierra H1. Control: CapturaDirecta.tsx:583-585. Los endpoints ya existen en
  `api/lotes.ts`.
- **C2. Conectar la generacion de lote de Nomina, Plantillas, Reclasificaciones y
  Reembolsos** a los mismos dos endpoints. Cierra H2. Controles: Nomina.tsx:134-138,
  Plantillas.tsx:158-168, Reclasificaciones.tsx:232-238, Reembolsos.tsx (via
  `onCrearLote`). Prerrequisito de C3 y C4.
- **C3. Reclasificaciones: consulta real.** Sustituir `data/mock` y
  `movimientosPorDocumento` por la consulta de movimientos por documento y centro.
  Control: "Simular" (Reclasificaciones.tsx:196-315). Cierra la mitad de datos de
  ese modulo; depende de C2 para no generar lotes fantasma.
- **C4. CapturaDirecta: parseo real del portapapeles** y de plantillas guardadas.
  Cierra el resto de H15. Control: "F6 Importar Excel"/"Insertar 3 lineas"
  (CapturaDirecta.tsx:1046-1076). Depende de B3 para las plantillas.

### Bloque D. Modulos sin backend (prerrequisito: B)

- **D1. Impuestos.** Acumulados de IVA y retenciones, medios magneticos,
  certificados DIAN, conceptos y formularios, y su cliente `api/impuestos.ts`.
  Cierra H10. Control: los 69 controles de Impuestos.tsx. Es el modulo mas grande
  y el unico que afecta a obligaciones tributarias.
- **D2. Cierres.** Ruta de cierre mensual y anual, y manejador del asistente de
  traslado. Cierra H5. Controles: Cierres.tsx:118-122 y 177-180.
- **D3. Consolidacion.** Backend y cliente; los pasos y chips (Consolidacion.tsx:39-44,
  187-189) dejan de avanzar por estado. Cierra parte de H9.
- **D4. Reorganizacion.** Endpoint de modo mantenimiento y de ejecucion de la
  compactacion. Cierra parte de H9. Control: Reorganizacion.tsx:185-187.
- **D5. Usuarios, roles y permisos.** Tablas y endpoints, y control de acceso
  efectivo. Cierra H7.
- **D6. Bitacora.** Ruta que exponga `auditoria_repository` (el backend ya escribe
  en la tabla `auditoria`: postgres_writes.py:1186-1190; no hay ruta en
  `backend/app.py`). Cierra H8 en su mitad de bitacora y refuerza D4, D2 y H6.
- **D7. Integraciones.** Conectores reales de prueba y sincronizacion. Cierra la
  otra mitad de H8.

### Bloque E. Reasignacion de NIT y robustez

- **E1. "Reasignar NIT" (Terceros.tsx:299-305)**: endpoint que reescriba las
  referencias contables del tercero. Depende de B1.
- **E2. Borrador de Reembolsos sobre el lote real** en lugar de `localStorage`
  (Reembolsos.tsx:175-179). Depende de B3 y C2.
- **E3. Los tres hallazgos Bajos** (H16, H17, H18): `disabled` en las acciones de
  Lotes, manejador en los botones de las tarjetas de Informes, y regla de
  validacion de tercero en el backend. No dependen de nada.

---

## 5. Conclusiones y recomendaciones

**1. El hallazgo dominante no es "faltan endpoints", es "no se puede saber que
falta".** De 705 controles, 446 son locales o simulados. Solo una parte de las
pantallas afectadas lo declara con el distintivo "Datos de demostracion". En las
otras (CapturaDirecta, Terceros, DocumentoOficial, Dashboard, BalanceComprobacion,
Cierres) el usuario no tiene senal alguna. Recomendacion: convertir el distintivo
en una regla de la interfaz, no en un adorno de seis pantallas; y anadirlo
tambien en las pantallas que hoy se presentan como reales.

**2. Lo que mas cuesta no es el modulo que falta, es el que miente.** Impuestos
tiene 69 controles simulados y no resulta el problema principal: avisa que
simula. En cambio H1 y H2 (borradores que se anuncian en una pantalla que si lee
del backend) y H11 (documento oficial con datos fijos) hacen dudar de la parte que
si funciona. Recomendacion: cerrar primero A1, C1 y C2, que no requieren
endpoints nuevos, antes de emprender D1.

**3. Hay maquinaria armada que conviene desactivar, no conservar.** Los modales de
escritura de Terceros (H14) y las plantillas fijas de CapturaDirecta son codigo
que ya sabe simular una operacion real. Mientras no existan los endpoints,
mantenerlo es una invitacion a reconectarlo por accidente y a reintroducir el
fallo. Recomendacion: borrar lo que no se va a conectar en el corto plazo, y dejar
el boton deshabilitado que ya existe, que si dice la verdad.

**4. Verificacion negativa que conviene registrar.** Los contratos de filtros
entre cliente y endpoint no arrojaron hallazgo en el mapa. No se ha vuelto a
verificar aqui, pero conviene mantener esa revision como prueba de regresion
cuando se toquen `api/*.ts`: es la clase de error que solo se descubre en
produccion.

**Recomendacion final, sobre el catalogo del asistente.** La fase 1.5 de
`docs/plan/bot/PLAN_ASISTENTE.md` propone generar la fuente de conocimiento
leyendo las rutas de `src/App.tsx`, las llamadas de `src/api/*.ts` y las rutas de
`backend/app.py`. Ese metodo produce un catalogo **a nivel de pantalla**, y esta
auditoria demuestra que ese nivel es el equivocado por tres razones concretas:

1. **El nivel de pantalla miente por exceso.** El propio plan lo reconoce en su
   seccion 3: de las 22 pantallas "conectadas", varias tienen controles inertes o
   simulados. Aqui queda medido: 242 de 705 controles. Un catalogo derivado del
   codigo diria que Terceros esta conectada (lo esta, para leer) y el asistente
   describiria como procedimiento real un alta o una baja que la interfaz no
   ofrece. El asistente no inventaria el dato: inventaria el procedimiento, que es
   justo lo que la seccion 0 del plan quiere evitar.
2. **El nivel de pantalla miente tambien por defecto, y hacia lo peligroso.** La
   derivacion por codigo cuenta como funcionalidad todo lo que tenga manejador.
   Los modales de escritura de Terceros existen, tienen manejador y aviso de
   exito; solo la comprobacion de alcanzabilidad (H14) revela que no se pueden
   disparar. Un catalogo generado desde el codigo los presentaria al asistente
   como funcionalidad disponible y el asistente los narraria con seguridad. Es el
   falso positivo mas caro posible: una funcionalidad creible y falsa.
3. **El dato que falta no esta en el codigo, esta en la asignacion.** Que un
   control sea local, simulado o inerte no se deduce de su sintaxis; se deduce de
   seguir su manejador hasta (o no hasta) un cliente de `api/*.ts`, que es
   exactamente el trabajo manual que ya hizo `MAPA_FUNCIONALIDAD.md` y que este
   informe ha evaluado y corregido. Un script puede recalcular lineas, pero no
   puede sustituir ese juicio.

Por todo ello, el catalogo de la fase 1.5 debe generarse **desde este informe** (o
desde la representacion estructurada de este informe), y no desde un inventario de
pantallas: es el unico artefacto que asigna estado a cada control, distingue lo
inerte de lo simulado y ordena lo que falta por dependencia. La diferencia es
operativa: un catalogo de pantallas le permite al asistente decir "puede registrar
un comprobante desde CapturaDirecta y guardarlo como borrador en Lotes" (falso),
mientras que un catalogo de controles, generado desde aqui, le obliga a decir que
la captura si contabiliza pero que el borrador no se persiste. Eso es
precisamente la salida que la fase 1.5 promete: que ninguna respuesta mencione un
campo o un paso que no exista.

Se anade una consecuencia practica: si el mapa cambia (por ejemplo, B1 habilita
los modales de Terceros), este informe y el catalogo deben regenerarse a la vez.
La regla de la seccion 5 del plan ("si una pantalla cambia de estado, el catalogo
se regenera y el asistente cambia su respuesta sin tocar el prompt a mano") se
cumple igual con este informe como fuente, y con un nivel de detalle mayor.

---

## 6. Anexo: como reproducir la auditoria

Todo lo que sigue se ejecuto desde la raiz del proyecto (`contabilidad/`). Los
comandos son de lectura; ninguno modifica archivos.

```sh
# 1. Totales y reparto por pantalla (materia prima de la seccion 2)
sed -n '119,135p' docs/catalogo/MAPA_FUNCIONALIDAD.md

# 2. Persistencia en el navegador (base de H3, H15 y de parte de H2)
grep -n "localStorage" Interface_web/src/pages/*.tsx

# 3. El mecanismo de lote fantasma (H1 y H2)
grep -n "onCrearLote" Interface_web/src/App.tsx Interface_web/src/pages/*.tsx
sed -n '95,97p' Interface_web/src/App.tsx

# 4. Simulaciones con aviso explicito (H6, H8, H10, H15)
grep -n "simulado" Interface_web/src/pages/*.tsx
grep -n "setTimeout" Interface_web/src/pages/*.tsx

# 5. Controles inertes o deshabilitados como marcador (seccion 2, ultimo parrafo)
grep -n "disabled" Interface_web/src/pages/Terceros.tsx \
  Interface_web/src/pages/Centros.tsx \
  Interface_web/src/pages/Comprobantes.tsx \
  Interface_web/src/pages/TiposDocumento.tsx \
  Interface_web/src/pages/Cierres.tsx

# 6. Alcanzabilidad de los modales de Terceros (correccion de H14):
#    los abridores aparecen una sola vez, en su definicion; no hay punto de llamada
grep -n "abrirNuevo\|abrirEditar\|abrirCupos\|setShowNew\|setShowEdit\|setShowCupos\|setShowImport" \
  Interface_web/src/pages/Terceros.tsx

# 7. Contrato de terceros: la interfaz valida mas que el backend (H18)
grep -n "class ThirdPartyCreate" backend/app.py
sed -n '96,116p' backend/app.py
sed -n '45,55p' Interface_web/src/components/CrearTerceroModal.tsx

# 8. Que endpoints existen y cuales no (bloques B y D)
grep -n "@app.get\|@app.post\|@app.put\|@app.delete" backend/app.py
grep -n "auditoria" backend/app.py          # sin coincidencias: no hay ruta de bitacora
grep -rn "auditoria" backend/*.py           # el backend si escribe trazas

# 9. Clientes de API existentes (los 22 archivos; no hay impuestos, cierres ni usuarios)
ls Interface_web/src/api

# 10. Pantallas que leen del mock (H11, H12, H13, H15)
grep -n "data/mock" Interface_web/src/pages/*.tsx

# 11. Distintivo de demostracion: donde esta y donde no (desempate de la seccion 3.1)
grep -n "Datos de demostraci" Interface_web/src/pages/*.tsx
```

Notas para quien repita la auditoria:

- El paso 6 es el que **corrige** el mapa: una funcion que existe pero no tiene
  punto de llamada no es funcionalidad disponible. Conviene repetirlo cada vez que
  se habilite un boton deshabilitado.
- El paso 8 se ejecuto buscando "auditoria" en `backend/app.py`: cero
  coincidencias. La ausencia es la evidencia de H8 y refuerza H6.
- Este informe no ejecuto la interfaz ni sus pruebas, de modo que nada de lo aqui
  afirmado esta verificado en runtime. La verificacion de los bloques A y C, que
  se apoyan en endpoints existentes, es la mas barata de hacer con una prueba real.
