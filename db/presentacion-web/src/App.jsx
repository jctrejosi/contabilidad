import { useState } from 'react';
import { resultado } from './lib/datos.js';
import Mapa from './components/Mapa.jsx';
import Resumen from './components/Resumen.jsx';
import Legado from './components/Legado.jsx';
import Nuevo from './components/Nuevo.jsx';
import Migracion from './components/Migracion.jsx';
import Validacion from './components/Validacion.jsx';

const SECCIONES = [
  { id: 'mapa', label: 'Mapa de relaciones', destacado: true },
  { id: 'resumen', label: 'Resumen' },
  { id: 'legado', label: 'Esquema legado', n: 98 },
  { id: 'nuevo', label: 'Esquema nuevo', n: 60 },
  { id: 'migracion', label: 'Migración' },
  { id: 'validacion', label: 'Integridad' },
];

export default function App() {
  const [seccion, setSeccion] = useState('mapa');
  const [solicitud, setSolicitud] = useState(null); // {origen?, nuevo?, ts} para el Mapa

  const abrirMapa = (origen, nuevoNombre) => {
    setSolicitud({ origen: origen || null, nuevo: nuevoNombre || null, ts: Date.now() });
    setSeccion('mapa');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="marca">
          <span className="marca-logo">C</span>
          <div>
            <div className="marca-titulo">CONTABDSI</div>
            <div className="marca-sub">Migración de la base de datos</div>
          </div>
        </div>
        <nav className="nav">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              className={`nav-btn ${seccion === s.id ? 'activo' : ''} ${s.destacado ? 'destacado' : ''}`}
              onClick={() => setSeccion(s.id)}
            >
              {s.label}
              {s.n && <span className="nav-n">{s.n}</span>}
            </button>
          ))}
        </nav>
        <div className="badge-integridad" title="Validación automática de ambos esquemas">
          <span className={`punto ${resultado.ok ? 'ok' : 'fail'}`} />
          {resultado.ok ? 'Esquemas completos y consistentes' : 'Revisar integridad'}
        </div>
      </header>

      <main className="contenido">
        {seccion === 'mapa' && <Mapa key={solicitud?.ts ?? 0} solicitud={solicitud} />}
        {seccion === 'resumen' && <Resumen abrirMapa={abrirMapa} />}
        {seccion === 'legado' && <Legado abrirMapa={abrirMapa} />}
        {seccion === 'nuevo' && <Nuevo abrirMapa={abrirMapa} />}
        {seccion === 'migracion' && <Migracion />}
        {seccion === 'validacion' && <Validacion />}
      </main>

      <footer className="pie">
        Fuentes: <code>db/old_db/</code> (análisis del legado) · <code>db/general/</code> (modelo neutro, 60 entidades) ·{' '}
        <code>db/postgresql/</code> (implementación validada).
      </footer>
    </div>
  );
}
