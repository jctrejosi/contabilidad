# Rediseño visual con la identidad de Fortuner

Fecha: 12 de noviembre de 2026. Rama: `rediseno-visual` (sin commit).
Referencia: `../GUIA_REDISENO_MODULOS.md` (copia idéntica en `Fortuner27`).

Es un cambio exclusivamente visual. No se modificaron rutas, endpoints,
autenticación, reglas de negocio, puertos, variables de entorno ni textos de
datos o mensajes del servidor.

## Qué quedó implementado

| Parte | Archivos | Detalle |
| --- | --- | --- |
| Marca | `Interface_web/public/fortuner-*.png`, `index.html`, `.figma/make/site.json` | Logos e isotipo copiados de Fortuner27; favicon con el isotipo; título de pestaña "Contabilidad · Fortuner". El logo DSI se reemplazó en el menú, el acceso y la selección de compañía. |
| Paleta y fuente | `src/index.css` | Poppins, variables `--fx-*` y colores `fortuner-*`. La escala `petroleum-*` conserva el nombre pero resuelve a la paleta Fortuner. Los grises, rojos, verdes, azules y ámbar de Tailwind se reasignaron a los neutros y estados de la guía, para que las 50 pantallas hereden la paleta sin reescribirlas. `rounded-lg` pasa a 12 px. |
| Cabecera, fila 1 | `src/components/Shell.tsx` | Logo (170/220 px), separador y nombre del módulo; chips de compañía (conserva "Cambiar compañía", NIT en el `title`) y de periodo; buscador existente; notificaciones, asistente y usuario. Isotipo de marca de agua. |
| Cabecera, fila 2 | `src/components/Shell.tsx` | Navegación horizontal (revisión 2 de la guía, sección 7.4): Inicio, los grupos Movimientos, Consultas, Informes, Medios magnéticos y Configuración con desplegable, Reprocesos y auditoría como pestaña directa, y "Más" fijo a la derecha con Administración (subgrupo), Cierres y Consolidación. Pestaña activa con línea inferior verde menta → azul cielo. |

### Conversión de la barra lateral (revisión 2 de la guía)

La primera versión usaba un menú lateral, que la revisión 2 de la guía
descartó. Se eliminaron el `<aside>`, el botón "Contraer", el panel deslizable
de celular y el botón de menú. `NavPage`, `NAV_GROUPS`, sus identificadores,
etiquetas y orden, y `onNavigate`, no cambiaron; solo cambió cómo se dibujan.

- Los desplegables se abren con clic, uno a la vez, y se cierran al elegir,
  con clic afuera, con Escape, al desplazar la fila o al cambiar el tamaño.
  Usan `aria-haspopup`, `aria-expanded`, `role="menu"` y `role="menuitem"`.
- Hasta 8 opciones, una columna de 240 px; de 9 a 16, dos columnas de 500 px.
  El subgrupo "3. Asignación de cuentas" va como subtítulo con sangría.
- Por debajo de 768 px el desplegable es un panel a todo el ancho (márgenes de
  12 px, una columna, alto máximo del 70 % de la pantalla).
- El desplegable se dibuja con posición fija, fuera de la fila que se desliza,
  para que el desplazamiento horizontal no lo recorte.
| Componentes | 60 pantallas y componentes | Botón principal con degradado (`.btn-fx`), botones secundarios y campos con radio de 12/8 px, tarjetas de 18 px, modales de 20 px, fondo atenuado `#002D49` al 45 %, títulos de pantalla de 24 px, cabeceras de tabla en mayúsculas 11,5 px, foco azul con aro de 4 px y colores de gráficos de la guía. |

Los cambios en las pantallas se hicieron sobre las clases de los atributos
`className`, con un script que reconoce el elemento (botón, campo, tarjeta,
modal o título). No se tocó ninguna lógica.

### Corrección de botones e insignias

El primer script no alcanzaba los botones con el azul en `style` ni con clases
condicionales. Un segundo script, que lee cada `<button>` completo, corrigió
20 archivos: 19 botones principales ahora usan `.btn-fx` (degradado, sombra,
radio 12 px y deshabilitado al 50 %), 13 botones de eliminar o confirmar
sólidos en rojo pasaron al estilo destructivo de la guía (texto y borde
`#B42318`, fondo `#FDECEC` al pasar el cursor) y las insignias violeta se
reemplazaron por azul cielo. En Reprocesos, los filtros son pestañas internas
(activa en `#003760`) y las tarjetas tienen radio de 18 px y efecto al pasar
el cursor. Los indicadores de pasos de Consolidación y Terceros conservan el
azul `#0F70FC`, que sí es de la paleta.

## Verificación

- `npm run build` y `npx tsc --noEmit` sin errores.
- `npm run test:parametros`: 5 de 5 pruebas aprobadas.
- `git diff --check` sin problemas de espacios.
- El barrido de colores y logos anteriores de la guía no encuentra coincidencias.
- El barrido de restos de barra lateral (`<aside|Contraer|collapsed|mobileOpen`)
  no encuentra coincidencias en el diseño base.
- Revisión en navegador con el servidor de Vite y respuestas simuladas de la
  API (sin Fortuner ni Advantage), a 1440 px y a 375 px, sin desplazamiento
  horizontal de la página. Se recorrieron por script las 49 opciones del menú
  anterior: cada una navega a su pantalla, cierra el desplegable y marca su
  grupo como activo. Se comprobó el cierre con Escape y con clic afuera, y que
  solo haya un desplegable abierto.

## Pendiente

- Abrir el módulo desde el catálogo de FORTUNER27 y confirmar usuario y
  compañía con una sesión real.
- Recorrer con datos reales de Advantage las pantallas densas (Captura
  directa, Lotes, Movimiento mensual, Informes) para revisar tablas y modales.
- Algunas cabeceras de tabla construidas con `div` (por ejemplo Plan de
  cuentas) no tienen el estilo en mayúsculas de la guía.
- Actualizar la tabla de registro (sección 15 de la guía) al hacer el commit;
  hoy indica que falta convertir la navegación a la cabecera.
- Confirmar con los usuarios qué grupos van en "Más". Se eligieron
  Administración, Cierres y Consolidación por ser los menos frecuentes.
