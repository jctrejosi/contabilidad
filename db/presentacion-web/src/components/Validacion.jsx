import { resultado, DOMINIOS_ESPERADOS } from '../lib/datos.js';

export default function Validacion() {
  const r = resultado;
  return (
    <div className="seccion">
      <h1>Validación automática de los esquemas</h1>
      <p className="lede">
        El catálogo de la app se genera desde las fuentes validadas (<code>db/general/modelo.json</code> para el
        esquema nuevo y la matriz de <code>db/old_db/</code> para el legado). Estas comprobaciones garantizan que
        <strong> ambos esquemas salgan completos</strong> y que las referencias entre ellos resuelvan.
        Se pueden repetir en consola con <code>npm run validate</code>.
      </p>

      <div className={`banner-integridad ${r.ok ? 'ok' : 'fail'}`}>
        {r.ok ? '✅ ESQUEMAS COMPLETOS Y CONSISTENTES' : '❌ HAY PROBLEMAS DE INTEGRIDAD'}
      </div>

      <div className="grid-checks">
        {r.checks.map((c) => (
          <div className={`check ${c.ok ? 'ok' : 'fail'}`} key={c.nombre}>
            <div className="check-titulo">{c.ok ? '✅' : '❌'} {c.nombre}</div>
            <div className="check-detalle">{c.detalle}</div>
          </div>
        ))}
      </div>

      <div className="grid-2col">
        <div className="panel">
          <div className="panel-titulo">Conteos esperados (fuente del análisis)</div>
          <table className="tabla tabla-compacta">
            <tbody>
              <tr><td>Tablas legadas (familias funcionales)</td><td className="num">{r.totalLegado}/98</td></tr>
              <tr><td>Entidades nuevas</td><td className="num">{r.totalNuevo}/60</td></tr>
              <tr><td>Dominios del legado</td><td className="num">{Object.keys(DOMINIOS_ESPERADOS).length}/12</td></tr>
              <tr><td>Módulos del esquema nuevo</td><td className="num">{r.nuevoModulos}/9</td></tr>
              <tr><td>Destinos huérfanos</td><td className="num">{r.huerfanos.length}</td></tr>
            </tbody>
          </table>
          <p className="panel-nota">
            Nota: {r.nuevasSinOrigen.length} entidades nuevas no reciben datos de ninguna tabla legada —
            son <strong>netamente nuevas</strong> (creadas por los procesos nuevos): {r.nuevasSinOrigen.join(', ')}.
          </p>
        </div>

        <div className="panel">
          <div className="panel-titulo">Cómo se mantiene al día</div>
          <ul className="lista-orden">
            <li><b>Esquema nuevo:</b> se copia de <code>db/general/modelo.json</code> (<code>src/data/nuevo.json</code>); si el modelo cambia, re-copiar y re-ejecutar <code>npm run validate</code>.</li>
            <li><b>Esquema legado:</b> <code>src/data/legado.json</code> se deriva de la matriz <code>db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md</code> (98 filas) con el enriquecimiento de destino de la presentación.</li>
            <li><b>Integridad:</b> el validador (función pura <code>src/lib/validar.js</code>) cruza ambos catálogos y verifica conteos, dominios, huérfanos y resoluciones.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
