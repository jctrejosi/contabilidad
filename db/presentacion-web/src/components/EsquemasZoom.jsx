// Esquemas completos con zoom: izquierda = esquema legado (98 tablas),
// derecha = esquema nuevo (60 entidades + relaciones FK dibujadas).
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  legado,
  nuevo,
  ordenDominios,
  entidadPorNombre,
  modulos,
  CLASIF_COLOR,
} from '../lib/datos.js';
import camposLegado from '../data/campos_legado.json';

const NODE_W = 230;
const HDR = 32;
const ROW = 12.5;
const FOOT = 4;
const FILAS = 8; // filas visibles por nodo (la última puede ser "+N más")
const COLUMNAS = 3;
const PAD = 50;
const GAP_COL = 90;
const GAP_CLUSTER = 30;
const GAP_ITEM = 8;

const alturaNodo = (campos) => {
  const n = campos && campos.length ? campos.length : 0;
  const filas = n ? Math.min(n, FILAS) : 1;
  return HDR + filas * ROW + FOOT;
};

// Empaqueta clústeres en N columnas balanceadas; devuelve colocación y mundo.
function empaquetar(clusters, columnas = COLUMNAS) {
  const clusterW = NODE_W + 40;
  const colAlturas = new Array(columnas).fill(0);
  const cols = clusters.map((c) => {
    const col = colAlturas.indexOf(Math.min(...colAlturas));
    const x = PAD + col * (clusterW + GAP_COL);
    const y = PAD + colAlturas[col];
    let yItem = y + 36;
    const items = c.items.map((it) => {
      const px = { ...it, x: x + 20, y: yItem, w: NODE_W, h: it.h };
      yItem += it.h + GAP_ITEM;
      return px;
    });
    const h = yItem - y + 4;
    colAlturas[col] = y + h + GAP_CLUSTER;
    return { id: c.id, rotulo: c.rotulo, detalle: c.detalle, x, y, w: clusterW, h, items };
  });
  const mundoW = PAD * 2 + columnas * clusterW + (columnas - 1) * GAP_COL;
  const mundoH = Math.max(...colAlturas) + PAD;
  return { cols, mundoW, mundoH };
}

// ------------------- LAYOUT LEGADO -------------------
function layoutLegado() {
  const clusters = ordenDominios.map((dom) => ({
    id: `old:${dom}`,
    rotulo: dom.toUpperCase(),
    detalle: `${legado.filter((t) => t.dominio === dom).length} tablas`,
    items: legado
      .filter((t) => t.dominio === dom)
      .map((t) => ({
        id: t.origen,
        h: alturaNodo(camposLegado[t.origen]),
        origen: t.origen,
        clasificacion: t.clasificacion,
        proceso: t.proceso,
        destino: t.destino,
        nota: t.nota,
      })),
  }));
  return empaquetar(clusters);
}

// ------------------- LAYOUT NUEVO -------------------
function layoutNuevo() {
  const clusters = modulos.map((m) => ({
    id: `new:${m.nombre}`,
    rotulo: m.nombre.toUpperCase(),
    detalle: `${m.entidades.length} entidades`,
    items: m.entidades.map((n) => {
      const e = entidadPorNombre[n];
      return {
        id: e.nombre,
        h: alturaNodo(e.campos),
        nombre: e.nombre,
        modulo: e.modulo,
        campos: e.campos || [],
        foraneas: e.foraneas || [],
      };
    }),
  }));
  const layout = empaquetar(clusters);

  const pos = new Map();
  for (const c of layout.cols) for (const it of c.items) pos.set(it.id, it);

  const aristas = [];
  const vistas = new Set();
  for (const e of nuevo.entidades) {
    const a = pos.get(e.nombre);
    if (!a) continue;
    for (const f of e.foraneas || []) {
      const m = (f.destino || '').match(/^([a-z_]+)\s*\(/);
      if (!m) continue;
      const b = pos.get(m[1]);
      if (!b || b.id === a.id) continue;
      const clave = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      aristas.push({
        clave,
        x1: a.x + a.w / 2,
        y1: a.y + a.h / 2,
        x2: b.x + b.w / 2,
        y2: b.y + b.h / 2,
      });
    }
  }
  return { ...layout, aristas };
}

// ------------------- PANEL CON ZOOM -------------------
function PanelZoom({ titulo, cuenta, lado, mundo, aristas = [], renderNodo, onClic }) {
  const viewportRef = useRef(null);
  const mundoRef = useRef(null);
  const kRef = useRef(0.2);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const ajustadoRef = useRef(false);
  const dragRef = useRef(null);
  const suprimirClicRef = useRef(false);
  const [k, setK] = useState(0.2);

  const aplicar = () => {
    const el = mundoRef.current;
    if (el) el.style.transform = `translate(${txRef.current}px, ${tyRef.current}px) scale(${kRef.current})`;
  };

  const ajustar = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    const cw = vp.clientWidth;
    const ch = vp.clientHeight;
    if (!cw || !ch) return;
    const kk = Math.max(0.04, Math.min(cw / mundo.w, ch / mundo.h) * 0.94);
    kRef.current = kk;
    txRef.current = (cw - mundo.w * kk) / 2;
    tyRef.current = (ch - mundo.h * kk) / 2;
    setK(kk);
    ajustadoRef.current = true;
  };

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const ro = new ResizeObserver(() => {
      if (!ajustadoRef.current) ajustar();
    });
    ro.observe(vp);
    ajustar();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mundo.w, mundo.h]);

  useEffect(() => {
    aplicar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const kk = Math.max(0.04, Math.min(kRef.current * Math.exp(-e.deltaY * 0.0016), 5));
      const wx = (mx - txRef.current) / kRef.current;
      const wy = (my - tyRef.current) / kRef.current;
      kRef.current = kk;
      txRef.current = mx - wx * kk;
      tyRef.current = my - wy * kk;
      setK(kk);
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, []);

  const zoomEnCentro = (f) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const kk = Math.max(0.04, Math.min(kRef.current * f, 5));
    const wx = (mx - txRef.current) / kRef.current;
    const wy = (my - tyRef.current) / kRef.current;
    kRef.current = kk;
    txRef.current = mx - wx * kk;
    tyRef.current = my - wy * kk;
    setK(kk);
  };

  const onPointerDown = (e) => {
    dragRef.current = { px: e.clientX, py: e.clientY, total: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    d.total += Math.abs(dx) + Math.abs(dy);
    d.px = e.clientX;
    d.py = e.clientY;
    txRef.current += dx;
    tyRef.current += dy;
    aplicar();
  };
  const onPointerUp = () => {
    if (dragRef.current) suprimirClicRef.current = dragRef.current.total > 8;
    dragRef.current = null;
  };
  const onClicNodo = (id) => {
    if (suprimirClicRef.current) {
      suprimirClicRef.current = false;
      return;
    }
    onClic(id);
  };

  return (
    <div className={`z-panel z-${lado}`}>
      <div className="z-cab">
        <span className="z-titulo">{titulo}</span>
        <span className="z-cuenta">{cuenta}</span>
        <div className="z-controles">
          <button title="Alejar" onClick={() => zoomEnCentro(1 / 1.3)}>−</button>
          <button title="Acercar" onClick={() => zoomEnCentro(1.3)}>+</button>
          <button title="Ajustar a la ventana" onClick={ajustar}>⤢</button>
        </div>
      </div>
      <div
        className="z-viewport"
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="z-mundo" ref={mundoRef} style={{ width: mundo.w, height: mundo.h }}>
          <svg className="z-svg" width={mundo.w} height={mundo.h}>
            {aristas.map((a) => (
              <path
                key={a.clave}
                d={`M ${a.x1} ${a.y1} C ${(a.x1 + a.x2) / 2} ${a.y1}, ${(a.x1 + a.x2) / 2} ${a.y2}, ${a.x2} ${a.y2}`}
                className="z-arista"
              />
            ))}
          </svg>
          {mundo.cols.map((c) => (
            <div key={c.id} className="z-cluster" style={{ left: c.x, top: c.y, width: c.w, height: c.h }}>
              <span className="z-cluster-rotulo">{c.rotulo}</span>
              <span className="z-cluster-detalle">{c.detalle}</span>
            </div>
          ))}
          {mundo.cols.flatMap((c) => c.items).map((it) => (
            <div
              key={`${lado}:${it.id}`}
              className={`z-nodo nodo-click z-${lado}-nodo`}
              style={{ left: it.x, top: it.y, width: it.w, height: it.h }}
              onClick={() => onClicNodo(it.id)}
            >
              {renderNodo(it, k)}
            </div>
          ))}
        </div>
        <div className="z-hint">rueda = zoom · arrastra = mover · clic = ficha</div>
      </div>
    </div>
  );
}

// ------------------- VISTA COMPLETA -------------------
export default function EsquemasCompletos({ onEnfocarTabla, onEnfocarEntidad }) {
  const legadoLayout = useMemo(layoutLegado, []);
  const nuevoLayout = useMemo(layoutNuevo, []);
  const [ficha, setFicha] = useState(null);

  const fichaOld = ficha?.lado === 'old' ? legado.find((t) => t.origen === ficha.id) : null;
  const fichaNew = ficha?.lado === 'new' ? entidadPorNombre[ficha.id] : null;

  const renderNodoOld = (it, k) => {
    const campos = camposLegado[it.origen] || [];
    const filas = campos.slice(0, FILAS);
    const sobra = campos.length - filas.length;
    return (
      <>
        <div className="z-nombre" title={it.origen}>{it.origen}</div>
        <div className="z-badges">
          <span className={`dot ${CLASIF_COLOR[it.clasificacion] || ''}`} />
          <span className="chip ch-mini z-chip-txt">{it.clasificacion}</span>
          <span className="z-cuenta-mini">{campos.length ? `${campos.length} campos` : '—'}</span>
        </div>
        {k >= 0.4 && (
          <div className="z-filas">
            {filas.slice(0, sobra > 0 ? FILAS - 1 : FILAS).map((c) => (
              <div className="z-fila" key={c} title={c}>{c}</div>
            ))}
            {sobra > 0 && <div className="z-fila z-mas">{sobra} más…</div>}
            {campos.length === 0 && <div className="z-fila z-vacia">sin inventario</div>}
          </div>
        )}
      </>
    );
  };

  const renderNodoNew = (it, k) => {
    const filas = it.campos.slice(0, FILAS);
    const sobra = it.campos.length - filas.length;
    return (
      <>
        <div className="z-nombre" title={it.nombre}>{it.nombre}</div>
        <div className="z-badges">
          <span className="chip ch-mini z-chip-new">{it.foraneas.length} FK</span>
          <span className="z-cuenta-mini">{it.campos.length} campos</span>
        </div>
        {k >= 0.4 && (
          <div className="z-filas">
            {filas.slice(0, sobra > 0 ? FILAS - 1 : FILAS).map((c) => (
              <div className="z-fila" key={c.nombre} title={`${c.nombre} · ${c.tipo}`}>
                <span className="z-campo">{c.nombre}</span>
                <span className="z-tipo">{c.tipo}</span>
              </div>
            ))}
            {sobra > 0 && <div className="z-fila z-mas">{sobra} más…</div>}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="esquemas-zoom">
      <div className="esquemas-cab">
        <h2>Esquemas completos</h2>
        <p className="lede">
          El esquema <strong>viejo</strong> a la izquierda (98 tablas, campos inventariados) y el{' '}
          <strong>nuevo</strong> a la derecha (60 entidades con sus campos y relaciones FK). Usa la rueda
          para acercar, arrastra el fondo para moverte y haz clic en un nodo para ver su ficha completa.
        </p>
      </div>
      <div className="esquemas-grid">
        <PanelZoom
          titulo="Esquema legado"
          cuenta="98 tablas · 12 dominios"
          lado="old"
          mundo={legadoLayout}
          renderNodo={renderNodoOld}
          onClic={(id) => setFicha({ lado: 'old', id })}
        />
        <PanelZoom
          titulo="Esquema nuevo"
          cuenta="60 entidades · 9 módulos · FKs"
          lado="new"
          mundo={nuevoLayout}
          aristas={nuevoLayout.aristas}
          renderNodo={renderNodoNew}
          onClic={(id) => setFicha({ lado: 'new', id })}
        />
      </div>

      {fichaOld && (
        <FichaZoom titulo={fichaOld.origen} lado="old" onCerrar={() => setFicha(null)} onEnfocar={() => onEnfocarTabla?.(fichaOld.origen)}>
          <div className="z-badges">
            <span className={`chip ${CLASIF_COLOR[fichaOld.clasificacion] || ''}`}>{fichaOld.clasificacion}</span>
            <span className="proceso">{fichaOld.proceso}</span>
            <span className="chip chip-gris">{fichaOld.dominio}</span>
          </div>
          <p>{fichaOld.nota}</p>
          <div className="uml-seccion">campos inventariados · {(camposLegado[fichaOld.origen] || []).length}</div>
          <div className="ficha-filas">
            {(camposLegado[fichaOld.origen] || []).map((c) => (
              <div className="z-fila" key={c}>{c}</div>
            ))}
          </div>
          <div className="uml-seccion">destino en el esquema nuevo</div>
          <div className="destino-chips">
            {fichaOld.destino.length ? (
              fichaOld.destino.map((d) => (
                <button key={d} className="chip chip-destino" onClick={() => onEnfocarEntidad?.(d)}>→ {d}</button>
              ))
            ) : (
              <em className="sin-destino">sin destino directo (ver nota)</em>
            )}
          </div>
        </FichaZoom>
      )}
      {fichaNew && (
        <FichaZoom titulo={fichaNew.nombre} lado="new" onCerrar={() => setFicha(null)} onEnfocar={() => onEnfocarEntidad?.(fichaNew.nombre)}>
          <div className="z-badges">
            <span className="modulo-badge">{fichaNew.modulo}</span>
            <span className="chip chip-gris">{(fichaNew.campos || []).length} campos</span>
            <span className="chip chip-gris">{(fichaNew.foraneas || []).length} FK</span>
          </div>
          <p>{fichaNew.proposito}</p>
          <div className="uml-seccion">campos</div>
          <div className="ficha-filas">
            {(fichaNew.campos || []).map((c) => (
              <div className="z-fila" key={c.nombre}>
                <span className="z-campo">{c.nombre}</span>
                <span className="z-tipo">{c.tipo}</span>
              </div>
            ))}
          </div>
          <div className="uml-seccion">relaciones FK</div>
          <div className="destino-chips">
            {(fichaNew.foraneas || []).map((f, i) => (
              <button
                key={i}
                className="chip chip-fk"
                onClick={() => {
                  const m = (f.destino || '').match(/^([a-z_]+)\s*\(/);
                  if (m) onEnfocarEntidad?.(m[1]);
                }}
              >
                FK → {f.destino}
              </button>
            ))}
            {!(fichaNew.foraneas || []).length && <em className="sin-destino">sin FK declaradas</em>}
          </div>
        </FichaZoom>
      )}
    </div>
  );
}

function FichaZoom({ titulo, lado, onCerrar, onEnfocar, children }) {
  return (
    <div className="ficha-zoom-backdrop" onClick={onCerrar}>
      <div
        className={`ficha-zoom ${lado === 'old' ? 'borde-viejo' : 'borde-nuevo'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ficha-zoom-cab">
          <span className="uml-nombre">{titulo}</span>
          <button className="btn-mini" onClick={onCerrar}>✕</button>
        </div>
        <div className="ficha-zoom-cuerpo">{children}</div>
        <div className="ficha-zoom-pie">
          <button className="btn-primario" onClick={onEnfocar}>Enfocar en el mapa ↑</button>
        </div>
      </div>
    </div>
  );
}
