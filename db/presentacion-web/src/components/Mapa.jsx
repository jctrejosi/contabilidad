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
import EsquemasCompletos from './EsquemasZoom.jsx';

const LIM_FEEDERS = 9; // máx. tarjetas old montadas en modo "entidad"
const LIM_VECINOS = 5; // máx. vecinos FK montados en modo "entidad"

const rankModulo = (m) => {
  const i = modulos.findIndex((x) => x.nombre === m);
  return i === -1 ? 99 : i;
};

// Vecinos (nuevos) por FK declarada en el modelo: salientes + entrantes.
function vecinosDe(nombre) {
  const out = new Set();
  const e = entidadPorNombre[nombre];
  for (const f of e?.foraneas || []) {
    const m = (f.destino || '').match(/^([a-z_]+)\s*\(/);
    if (m && entidadPorNombre[m[1]] && m[1] !== nombre) out.add(m[1]);
  }
  for (const x of nuevo.entidades) {
    if ((x.foraneas || []).some((f) => (f.destino || '').startsWith(`${nombre}(`))) {
      if (x.nombre !== nombre) out.add(x.nombre);
    }
  }
  return [...out].sort(
    (a, b) => rankModulo(entidadPorNombre[a].modulo) - rankModulo(entidadPorNombre[b].modulo) || a.localeCompare(b),
  );
}

export default function Mapa({ solicitud }) {
  const selInicialOld = solicitud?.origen || null;
  const selInicialNew = solicitud?.nuevo || null;

  const [foco, setFoco] = useState(selInicialNew ? 'new' : 'old');
  const [selOld, setSelOld] = useState(selInicialOld);
  const [selNew, setSelNew] = useState(selInicialNew);

  // rails
  const [qOld, setQOld] = useState('');
  const [qNew, setQNew] = useState('');
  const [domOld, setDomOld] = useState('Todos');
  const [modNew, setModNew] = useState('Todos');

  // tarjetas montadas por modo
  const montaje = useMemo(() => {
    if (foco === 'old' && selOld) {
      const t = legado.find((x) => x.origen === selOld);
      const news = t.destino
        .map((d) => entidadPorNombre[d])
        .filter(Boolean)
        .sort((a, b) => rankModulo(a.modulo) - rankModulo(b.modulo) || a.nombre.localeCompare(b.nombre));
      return { olds: [selOld], news: news.map((e) => e.nombre), modo: 'old' };
    }
    if (foco === 'new' && selNew) {
      const feeds = legado.filter((t) => t.destino.includes(selNew));
      const olds = feeds.slice(0, LIM_FEEDERS).map((t) => t.origen);
      const vecinos = vecinosDe(selNew).slice(0, LIM_VECINOS);
      return { olds, news: [selNew, ...vecinos], modo: 'new', feedTotal: feeds.length };
    }
    return { olds: [], news: [], modo: null };
  }, [foco, selOld, selNew]);

  const elegirOld = (origen) => {
    setSelOld(origen);
    setSelNew(null);
    setFoco('old');
  };
  const elegirNew = (nombre) => {
    setSelNew(nombre);
    setSelOld(null);
    setFoco('new');
  };

  const enfocarTabla = (origen) => {
    elegirOld(origen);
    document.querySelector('.lienzo-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const enfocarEntidad = (nombre) => {
    elegirNew(nombre);
    document.querySelector('.lienzo-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ---- medición de aristas ----
  const lienzoRef = useRef(null);
  const nodoRefs = useRef(new Map());
  const [lineas, setLineas] = useState([]);
  const claveMontaje = montaje.olds.join('|') + '§' + montaje.news.join('|') + '§' + foco;

  useEffect(() => {
    const medir = () => {
      const lienzo = lienzoRef.current;
      if (!lienzo) return;
      const br = lienzo.getBoundingClientRect();
      const caja = (id) => nodoRefs.current.get(id)?.getBoundingClientRect() || null;
      const centro = (r) => ({ x: r.left - br.left + r.width / 2, y: r.top - br.top + r.height / 2 });
      const bordeDer = (r) => ({ x: r.right - br.left, y: r.top - br.top + r.height / 2 });
      const bordeIzq = (r) => ({ x: r.left - br.left, y: r.top - br.top + r.height / 2 });

      const lines = [];
      const hay = (id) => nodoRefs.current.has(id);

      if (montaje.modo === 'old') {
        for (const o of montaje.olds) {
          if (!hay(`o:${o}`)) continue;
          const ra = caja(`o:${o}`);
          for (const n of montaje.news) {
            if (!hay(`n:${n}`)) continue;
            const rb = caja(`n:${n}`);
            lines.push({ key: `oa|${o}|${n}`, x1: bordeDer(ra).x, y1: bordeDer(ra).y, x2: bordeIzq(rb).x, y2: bordeIzq(rb).y, tipo: 'destino' });
          }
        }
      } else if (montaje.modo === 'new') {
        for (const o of montaje.olds) {
          if (!hay(`o:${o}`) || !hay('n:focus')) continue;
          const ra = caja(`o:${o}`);
          const rb = caja('n:focus');
          lines.push({ key: `feed|${o}|${selNew}`, x1: bordeDer(ra).x, y1: bordeDer(ra).y, x2: bordeIzq(rb).x, y2: bordeIzq(rb).y, tipo: 'alimenta' });
        }
        // FK entre entidades nuevas montadas
        const lista = montaje.news;
        for (let i = 0; i < lista.length; i++) {
          for (let j = 0; j < lista.length; j++) {
            if (i === j) continue;
            const a = entidadPorNombre[lista[i]];
            const b = entidadPorNombre[lista[j]];
            if (!a || !b) continue;
            const relacion = (a.foraneas || []).some((f) => (f.destino || '').startsWith(`${b.nombre}(`));
            if (relacion && hay(`n:${a.nombre}`) && hay(`n:${b.nombre}`)) {
              const ca = centro(caja(`n:${a.nombre}`));
              const cb = centro(caja(`n:${b.nombre}`));
              if (ca.x === cb.x && ca.y === cb.y) continue;
              lines.push({
                key: `fk|${a.nombre}|${b.nombre}`,
                x1: a.nombre < b.nombre ? ca.x + 10 : ca.x,
                y1: ca.y,
                x2: b.nombre < a.nombre ? cb.x - 10 : cb.x,
                y2: cb.y,
                tipo: 'fk',
              });
            }
          }
        }
      }
      setLineas(lines);
    };
    const t = requestAnimationFrame(medir);
    window.addEventListener('resize', medir);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener('resize', medir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveMontaje]);

  // rails filtrados
  const oldFiltro = legado.filter((t) => {
    const okD = domOld === 'Todos' || t.dominio === domOld;
    const s = qOld.trim().toLowerCase();
    const okQ = !s || t.origen.toLowerCase().includes(s) || t.destino.join(' ').toLowerCase().includes(s);
    return okD && okQ;
  });
  const newFiltro = nuevo.entidades.filter((e) => {
    const okM = modNew === 'Todos' || e.modulo === modNew;
    const s = qNew.trim().toLowerCase();
    const okQ = !s || e.nombre.toLowerCase().includes(s) || (e.proposito || '').toLowerCase().includes(s);
    return okM && okQ;
  });

  return (
    <>
      <div className="mapa">
      {/* ============ RAIL OLD ============ */}
      <aside className="rail rail-old">
        <div className="rail-cab">
          <span className="rail-titulo viejo">Legado</span>
          <span className="nav-n">98 tablas</span>
        </div>
        <input className="buscador mini" placeholder="Buscar tabla o destino…" value={qOld} onChange={(e) => setQOld(e.target.value)} />
        <select className="select-mini" value={domOld} onChange={(e) => setDomOld(e.target.value)}>
          <option value="Todos">Todos los dominios</option>
          {ordenDominios.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <div className="rail-lista">
          {oldFiltro.map((t) => (
            <button
              key={t.origen}
              className={`rail-item ${selOld === t.origen && foco === 'old' ? 'activo' : ''}`}
              onClick={() => elegirOld(t.origen)}
              title={`${t.origen} · ${t.nota}`}
            >
              <span className={`dot ${CLASIF_COLOR[t.clasificacion] || ''}`} />
              <span className="rail-nombre">{t.origen}</span>
              <span className="rail-destinos">{t.destino.length}→</span>
            </button>
          ))}
          {oldFiltro.length === 0 && <p className="vacio">Sin coincidencias</p>}
        </div>
      </aside>

      {/* ============ LIENZO UML ============ */}
      <section className="lienzo-wrap">
        <div className="lienzo-toolbar">
          {montaje.modo === 'old' ? (
            <span>
              <b className="viejo-t">{selOld}</b> se lleva a <b className="nuevo-t">{montaje.news.length}</b> entidad
              {montaje.news.length === 1 ? '' : 'es'} nueva{montaje.news.length === 1 ? '' : 's'} →
              <em className="hint">haz clic en una tarjeta para enfocarla en el lado nuevo</em>
            </span>
          ) : montaje.modo === 'new' ? (
            <span>
              <b className="nuevo-t">{selNew}</b> la alimentan <b className="viejo-t">{montaje.feedTotal}</b> tabla
              {montaje.feedTotal === 1 ? '' : 's'} del legado
              {montaje.feedTotal > LIM_FEEDERS && ` (se muestran ${LIM_FEEDERS})`} →
              <em className="hint">haz clic en una tarjeta para enfocarla en el lado viejo</em>
            </span>
          ) : (
            <span className="hint">
              ① Elige una tabla del <b>legado</b> (izquierda) o una <b>entidad nueva</b> (derecha): se monta su tarjeta con
              sus props y se dibujan las relaciones.
            </span>
          )}
          {(selOld || selNew) && (
            <button className="btn-mini" onClick={() => { setSelOld(null); setSelNew(null); setFoco('old'); }}>
              ✕ desmontar todo
            </button>
          )}
        </div>

        <div className="lienzo" ref={lienzoRef}>
          <svg className="svg-aristas">
            {lineas.map((l) => (
              <path
                key={l.key}
                d={`M ${l.x1} ${l.y1} C ${(l.x1 + l.x2) / 2} ${l.y1}, ${(l.x1 + l.x2) / 2} ${l.y2}, ${l.x2} ${l.y2}`}
                fill="none"
                className={`arista arista-${l.tipo}`}
              />
            ))}
          </svg>

          {/* tarjetas OLD */}
          <div className="lienzo-col col-old">
            {montaje.olds.map((o) => {
              const t = legado.find((x) => x.origen === o);
              return (
                <TarjetaUML
                  key={`o:${o}`}
                  id={`o:${o}`}
                  lado="old"
                  nombre={o}
                  registro={(el) => { if (el) nodoRefs.current.set(`o:${o}`, el); }}
                  enFoco={foco === 'old' && selOld === o}
                  onFocus={() => elegirOld(o)}
                  alCambiarTamano={() => window.dispatchEvent(new Event('resize'))}
                  badges={<>
                    <span className={`chip ch-mini ${CLASIF_COLOR[t.clasificacion] || ''}`}>{t.clasificacion}</span>
                    <span className="proceso">{t.proceso}</span>
                  </>}
                  props={camposLegado[o] || []}
                  pie={t.destino.map((d) => (
                    <button key={d} className="chip chip-destino" onClick={() => elegirNew(d)}>→ {d}</button>
                  ))}
                />
              );
            })}
            {montaje.olds.length === 0 && <div className="placeholder old">Tabla del legado montada aquí</div>}
          </div>

          {/* tarjetas NEW */}
          <div className="lienzo-col col-new">
            {montaje.news.map((n, idx) => {
              const e = entidadPorNombre[n];
              const esFoco = idx === 0 && montaje.modo === 'new';
              const pie =
                foco === 'new' && idx === 0 ? (
                  legado
                    .filter((t) => t.destino.includes(n))
                    .slice(0, 10)
                    .map((t) => (
                      <button key={t.origen} className="chip chip-feed" onClick={() => elegirOld(t.origen)}>← {t.origen}</button>
                    ))
                ) : (
                  (vecinosDe(n).slice(0, 4) || []).map((v) => (
                    <button key={v} className="chip chip-fk" onClick={() => elegirNew(v)}>FK → {v}</button>
                  ))
                );
              return (
                <TarjetaUML
                  key={`n:${n}`}
                  id={esFoco ? 'n:focus' : `n:${n}`}
                  lado="new"
                  nombre={n}
                  registro={(el) => { if (el) nodoRefs.current.set(esFoco ? 'n:focus' : `n:${n}`, el); }}
                  enFoco={foco === 'new' && selNew === n}
                  onFocus={() => elegirNew(n)}
                  alCambiarTamano={() => window.dispatchEvent(new Event('resize'))}
                  badges={<>
                    <span className="modulo-badge">{e.modulo}</span>
                    <span className="chip chip-gris">{(e.campos || []).length} campos</span>
                    <span className="chip chip-gris">{(e.foraneas || []).length} FK</span>
                  </>}
                  props={(e.campos || []).map((c) => ({ nombre: c.nombre, tipo: c.tipo }))}
                  pie={pie}
                />
              );
            })}
            {montaje.news.length === 0 && <div className="placeholder new">Entidad nueva montada aquí</div>}
          </div>
        </div>

        <div className="lienzo-leyenda">
          <span><i className="marcador destino" /> tabla → entidad destino</span>
          <span><i className="marcador alimenta" /> alimenta a la entidad enfocada</span>
          <span><i className="marcador fk" /> relación FK entre entidades nuevas</span>
        </div>
      </section>

      {/* ============ RAIL NEW ============ */}
      <aside className="rail rail-new">
        <div className="rail-cab">
          <span className="rail-titulo nuevo">Nuevo</span>
          <span className="nav-n">60 entidades</span>
        </div>
        <input className="buscador mini" placeholder="Buscar entidad o propósito…" value={qNew} onChange={(e) => setQNew(e.target.value)} />
        <select className="select-mini" value={modNew} onChange={(e) => setModNew(e.target.value)}>
          <option value="Todos">Todos los módulos</option>
          {modulos.map((m) => (
            <option key={m.nombre} value={m.nombre}>{m.nombre}</option>
          ))}
        </select>
        <div className="rail-lista">
          {newFiltro.map((e) => (
            <button
              key={e.nombre}
              className={`rail-item ${selNew === e.nombre && foco === 'new' ? 'activo' : ''}`}
              onClick={() => elegirNew(e.nombre)}
              title={e.proposito}
            >
              <span className={`dot dot-nuevo ${rankModulo(e.modulo) % 2 ? 'b' : 'a'}`} />
              <span className="rail-nombre">{e.nombre}</span>
              <span className="rail-destinos">←{legado.filter((t) => t.destino.includes(e.nombre)).length}</span>
            </button>
          ))}
          {newFiltro.length === 0 && <p className="vacio">Sin coincidencias</p>}
        </div>
      </aside>
      </div>

      {/* Debajo del Mapa: esquemas completos con zoom (viejo | nuevo) */}
      <EsquemasCompletos onEnfocarTabla={enfocarTabla} onEnfocarEntidad={enfocarEntidad} />
    </>
  );
}

/* ---------- Tarjeta estilo UML ---------- */
function TarjetaUML({ id, lado, nombre, registro, enFoco, onFocus, alCambiarTamano, badges, props, pie }) {
  const [completo, setCompleto] = useState(false);
  const visibles = props.slice(0, completo ? props.length : 16);
  const ocultos = props.length - visibles.length;
  const esNew = lado === 'new';
  const alternar = (e) => {
    e.stopPropagation();
    setCompleto(!completo);
    if (alCambiarTamano) alCambiarTamano();
  };

  return (
    <div ref={registro} id={id} className={`uml uml-${lado} ${enFoco ? 'foco' : ''}`} onClick={onFocus}>
      <div className="uml-cab">
        <span className="uml-nombre">{nombre}</span>
        <span className="uml-lado">{esNew ? 'NEW' : 'OLD'}</span>
      </div>
      <div className="uml-badges">{badges}</div>
      <div className="uml-cuerpo">
        <div className="uml-seccion">props</div>
        {props.length === 0 && <div className="uml-prop vacio">sin inventario de campos</div>}
        {visibles.map((p, i) => (
          <div className="uml-prop" key={p.nombre ?? p}>
            <span className="uml-campo">{p.nombre ?? p}</span>
            {p.tipo && <span className="tipo-chip">{p.tipo}</span>}
          </div>
        ))}
        {ocultos > 0 && (
          <button className="uml-mas" onClick={alternar}>
            {completo ? '▲ mostrar menos' : `▼ mostrar ${ocultos} campos más`}
          </button>
        )}
      </div>
      <div className="uml-pie" onClick={(e) => e.stopPropagation()}>
        <div className="uml-seccion">relaciones</div>
        {pie}
      </div>
    </div>
  );
}
