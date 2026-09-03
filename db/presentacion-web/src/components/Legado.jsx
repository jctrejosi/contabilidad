import { useMemo, useState } from 'react';
import { legado, ordenDominios, CLASIF_COLOR } from '../lib/datos.js';

export default function Legado({ abrirMapa }) {
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(null);

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    return legado.filter((t) =>
      !s ||
      t.origen.toLowerCase().includes(s) ||
      t.nota.toLowerCase().includes(s) ||
      t.proceso.toLowerCase().includes(s) ||
      t.destino.join(' ').toLowerCase().includes(s),
    );
  }, [q]);

  const porDominio = useMemo(() => {
    const m = new Map();
    for (const t of filtrados) {
      if (!m.has(t.dominio)) m.set(t.dominio, []);
      m.get(t.dominio).push(t);
    }
    return m;
  }, [filtrados]);

  return (
    <div className="seccion">
      <div className="seccion-cabecera">
        <div>
          <h1>Esquema legado · VISION/FORTUNER</h1>
          <p className="lede">
            <strong>98 familias funcionales</strong> (de 261 inventariadas) con uso de datos acreditado en el
            código. Cada una con su clasificación, el proceso contable que la usa (P01–P36) y su destino en el
            esquema nuevo. Análisis: <code>db/old_db/</code>.
          </p>
        </div>
        <input
          className="buscador"
          placeholder="Buscar tabla, destino, proceso…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {[...porDominio.keys()].map((dominio) => (
        <div className="grupo" key={dominio}>
          <div className="grupo-titulo">
            {dominio}
            <span className="grupo-n">{porDominio.get(dominio).length}</span>
          </div>
          <table className="tabla">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Tabla</th>
                <th style={{ width: 170 }}>Clasificación</th>
                <th>Destino en el esquema nuevo</th>
                <th style={{ width: 70 }}>Proceso</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {porDominio.get(dominio).map((t) => {
                const activa = abierto === t.origen;
                return (
                  <FragmentoFila key={t.origen} t={t} activa={activa} onToggle={() => setAbierto(activa ? null : t.origen)} abrirMapa={abrirMapa} />
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function FragmentoFila({ t, activa, onToggle, abrirMapa }) {
  return (
    <>
      <tr className={`fila ${activa ? 'fila-abierta' : ''}`} onClick={onToggle}>
        <td className="celda-tabla">{t.origen}</td>
        <td><span className={`chip ${CLASIF_COLOR[t.clasificacion] || ''}`}>{t.clasificacion}</span></td>
        <td className="celda-destinos">
          {t.destino.length === 0 ? (
            <span className="sin-destino">— {t.nota}</span>
          ) : (
            t.destino.map((d) => (
              <button
                key={d}
                className="chip chip-destino"
                onClick={(e) => { e.stopPropagation(); abrirMapa(t.origen); }}
                title="Ver conexión en el Mapa"
              >
                {d}
              </button>
            ))
          )}
        </td>
        <td><span className="proceso">{t.proceso}</span></td>
        <td className="celda-chevrón">{activa ? '▾' : '▸'}</td>
      </tr>
      {activa && (
        <tr className="fila-detalle">
          <td colSpan={5}>
            <div className="detalle-nota">{t.nota}</div>
            <div className="detalle-acciones">
              <button className="btn-mini" onClick={() => abrirMapa(t.origen)}>
                Ver cómo conecta en el Mapa →
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
