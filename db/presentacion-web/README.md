# presentacion-web · CONTABDSI

Mini-app **React + Vite** para presentar la migración de la base de datos de
CONTABDSI: el **esquema legado** (VISION/FORTUNER sobre Advantage ADS), el
**esquema nuevo** (modelo neutro de 60 entidades + PostgreSQL) y **cómo
conectan las tablas viejas con las nuevas**.

La app **abre directamente en el Mapa de relaciones** (una sola página estilo
diagrama UML): a la izquierda las 98 tablas del legado, a la derecha las 60
entidades nuevas. Al montar una tabla o entidad se muestra su tarjeta con
**sus props (campos)** y se **dibujan las relaciones** con las entidades que
conecta; desde una tarjeta nueva se puede saltar por sus FKs.

## Requisitos y puesta en marcha

- Node.js 18+

```bash
cd db/presentacion-web
npm install
npm run dev          # abre http://localhost:5173
```

Otros comandos:

```bash
npm run validate         # integridad de ambos esquemas (98 + 60) en consola
npm run extraer:campos   # regenera src/data/campos_legado.json desde old_db
npm run build            # build de producción en dist/
npm run preview          # sirve el build
```

## Qué muestra la app

| Vista | Contenido |
|---|---|
| **Mapa de relaciones** *(inicio)* | Página única estilo UML: rail izquierdo con las **98 tablas del legado**, rail derecho con las **60 entidades nuevas**. Al montar una tabla se despliega su tarjeta con los campos inventariados y las tarjetas de sus entidades destino (con líneas); al montar una entidad nueva se muestran sus campos y las tablas legadas que la alimentan, más sus vecinos por FK. Las tarjetas se enfocan con un clic y navegan por las relaciones. **Debajo, los esquemas completos con zoom**: el esquema viejo (98 tablas por dominio, con sus campos) a la izquierda y el nuevo (60 entidades con sus relaciones FK dibujadas) a la derecha — rueda para acercar, arrastra para mover, clic para abrir la ficha completa del nodo, que permite saltar al mapa superior |
| **Resumen** | Conteos, tubería de migración y cobertura por clasificación/dominio |
| **Esquema legado** | Las 98 familias agrupadas por dominio con clasificación y proceso P01–P36 |
| **Esquema nuevo** | Las 60 entidades en 9 módulos, con campos, FKs, unicidades e invariantes |
| **Migración** | Fases 0–10, orden de carga, reglas, conciliación y GO/NO-GO |
| **Integridad** | Comprobaciones automáticas de completitud y consistencia |

## De dónde salen los datos

- `src/data/nuevo.json` — copia de `../general/modelo.json` (modelo lógico
  neutro, 60 entidades con campos y FKs).
- `src/data/legado.json` — las 98 familias funcionales derivadas de
  `../old_db/MATRIZ_TABLAS_Y_BRECHAS.md` (dominio, clasificación, destino,
  proceso).
- `src/data/campos_legado.json` — campos inventariados por tabla del legado
  (98 tablas, 2.663 campos), extraídos **en solo lectura** de la misma matriz
  con `scripts/extraer-campos-legado.mjs` (los 2.663 coinciden con la cifra
  de `../old_db/HOMOLOGACION_CAMPOS.md`).
- `src/lib/validar.js` — función pura de integridad usada por la vista
  **Integridad** y por `scripts/validate.mjs`.

> `../old_db/` nunca se modifica: es contexto congelado del legado.

## Estructura

```
presentacion-web/
  index.html · package.json · vite.config.js
  scripts/
    validate.mjs                # integridad en consola
    extraer-campos-legado.mjs   # genera campos_legado.json (lectura de old_db)
  src/
    main.jsx · App.jsx · styles.css
    data/   nuevo.json (60) · legado.json (98) · campos_legado.json (98)
    lib/    datos.js · validar.js
    components/
      Mapa.jsx            # página única estilo UML (pantalla inicial)
      EsquemasZoom.jsx    # esquemas completos con zoom: viejo | nuevo
      Resumen · Legado · Nuevo · Migracion · Validacion
```
