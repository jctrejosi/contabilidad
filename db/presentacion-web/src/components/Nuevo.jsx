import { useMemo, useState } from 'react';
import { nuevo, resultado } from '../lib/datos.js';

const MODULOS_COLOR = [
  'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9',
];

export default function Nuevo({ abrirMapa }) {
  const [q, setQ] = useState('');
  const [seleccion, setSeleccion] = useState(null);

  const entidad = seleccion
    ? nuevo.entidades.find((e) => e.nombre === seleccion)
    : null;

  const porModulo = useMemo(() => {
    const s = q.trim().toLowerCase();
    return nuevo.modulos
      .map((m) => ({
        ...m,
        entidades: m.entidades.filter(
          (n) => !s || n.toLowerCase().includes(s) || (nuevo.entidades.find((e) => e.nombre === n)?.proposito || '').toLowerCase().includes(s),
        ),
      }))
      .filter((m) => m.entidades.length > 0);
  }, [q]);

  return (
    <div className="seccion">
      <div className="seccion-cabecera">
        <div>
          <h1>Esquema nuevo · 60 entidades en 9 módulos</h1>
          <p className="lede">
            Modelo lógico neutro (<code>db/general/modelo.json</code>) e implementación PostgreSQL validada.
            Libro inmutable, aislamiento por <code>company_id</code> y derivados regenerables.
            {resultado.nuevasSinOrigen.length > 0 && (
              <span> · <strong>5 entidades netamente nuevas</strong> (sin tabla origen): {resultado.nuevasSinOrigen.join(', ')}.</span>
            )}
          </p>
        </div>
        <input
          className="buscador"
          placeholder="Buscar entidad o propósito…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid-modulos">
        {porModulo.map((m, i) => (
          <div className={`panel modulo ${MODULOS_COLOR[i % MODULOS_COLOR.length]}`} key={m.nombre}>
            <div className="modulo-titulo">
              <span className="modulo-nombre">{m.nombre}</span>
              <span className="grupo-n">{m.entidades.length}</span>
            </div>
            {m.entidades.map((n) => (
              <button
                key={n}
                className={`chip chip-entidad ${seleccion === n ? 'seleccionada' : ''}`}
                onClick={() => setSeleccion(n)}
              >
                {n}
              </button>
            ))}
          </div>
        ))}
      </div>

      {entidad && <FichaEntidad entidad={entidad} abrirMapa={abrirMapa} onClose={() => setSeleccion(null)} />}
    </div>
  );
}

function FichaEntidad({ entidad, abrirMapa, onClose }) {
  const campos = entidad.campos || [];
  const fks = entidad.foraneas || [];
  return (
    <div className="ficha">
      <div className="ficha-cabecera">
        <div>
          <span className="modulo-badge">{entidad.modulo}</span>
          <h2>{entidad.nombre}</h2>
        </div>
        <button className="btn-mini" onClick={onClose}>✕ cerrar</button>
      </div>
      <p className="ficha-proposito">{entidad.proposito}</p>

      <div className="ficha-metricas">
        <div className="metrica"><b>{campos.length}</b> campos</div>
        <div className="metrica"><b>{(entidad.unicos || []).length}</b> unicidades</div>
        <div className="metrica"><b>{fks.length}</b> relaciones</div>
        {entidad.incluye_auditoria && <div className="metrica"><b>✓</b> auditoría</div>}
      </div>

      <div className="ficha-grid">
        <div>
          <div className="panel-titulo">Campos</div>
          <table className="tabla tabla-compacta">
            <thead>
              <tr><th>Campo</th><th>Tipo</th><th>Req.</th></tr>
            </thead>
            <tbody>
              {campos.map((c) => (
                <tr key={c.nombre}>
                  <td className="celda-tabla">{c.nombre}</td>
                  <td><span className="tipo-chip">{c.tipo}</span></td>
                  <td>{c.requerido ? '●' : '○'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="panel-titulo">Relaciones (FK)</div>
          {fks.length === 0 ? (
            <p className="sin-destino">Sin relaciones declaradas</p>
          ) : (
            <ul className="lista-fk">
              {fks.map((f, i) => (
                <li key={i}>
                  <code>{f.columnas.join(', ')}</code> → <code>{f.destino}</code>
                  {f.regla && <span className="fk-regla">{f.regla}</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="panel-titulo">Unicidades de negocio</div>
          {(entidad.unicos || []).map((u, i) => (
            <div className="uk-linea" key={i}>UK ({u.join(', ')})</div>
          ))}
          {(entidad.checks || []).length > 0 && (
            <>
              <div className="panel-titulo">Invariantes</div>
              {entidad.checks.map((c, i) => <div className="uk-linea" key={i}>{c}</div>)}
            </>
          )}
        </div>
      </div>

      <div className="ficha-accion">
        <button className="btn-primario" onClick={() => abrirMapa(null, entidad.nombre)}>
          ¿Qué tablas del legado la alimentan? Ver en el Mapa →
        </button>
      </div>
    </div>
  );
}
