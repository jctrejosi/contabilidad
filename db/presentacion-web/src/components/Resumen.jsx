import { resultado, ordenDominios, CLASIF_COLOR } from '../lib/datos.js';

function Tarjeta({ titulo, valor, detalle, color }) {
  return (
    <div className={`tarjeta ${color || ''}`}>
      <div className="tarjeta-valor">{valor}</div>
      <div className="tarjeta-titulo">{titulo}</div>
      <div className="tarjeta-detalle">{detalle}</div>
    </div>
  );
}

export default function Resumen({ abrirMapa }) {
  const maxClasif = Math.max(...Object.values(resultado.porClasificacion));
  const maxDominio = Math.max(...Object.values(resultado.porDominio));

  return (
    <div className="seccion">
      <h1>De VISION/FORTUNER al nuevo esquema</h1>
      <p className="lede">
        El legado guarda la contabilidad en <strong>tablas planas Advantage ADS</strong> (carpeta por empresa,
        una tabla por período y por lote). El nuevo esquema es un <strong>modelo relacional de 60 entidades</strong>.
        Entre ambos hay una <strong>transformación por proceso contable</strong>, no un volcado de archivos.
      </p>

      <div className="fila-tarjetas">
        <Tarjeta titulo="Tablas legadas (98 familias funcionales)" valor={resultado.totalLegado} detalle="141 variantes físicas · 3.616 campos inventariados" color="viejo" />
        <Tarjeta titulo="Entidades nuevas" valor={resultado.totalNuevo} detalle="9 módulos · modelo neutro + PostgreSQL 18" color="nuevo" />
        <Tarjeta titulo="Destinos huérfanos" valor={resultado.huerfanos.length} detalle="toda referencia de destino resuelve" color="ok" />
        <Tarjeta titulo="Bloqueos B01–B15" valor="15/15" detalle="corregidos en el esquema nuevo · 11/11 pruebas en verde" color="ok" />
      </div>

      <div className="panel">
        <div className="panel-titulo">La tubería de la migración</div>
        <div className="tuberia">
          <div className="t-org">
            <div className="t-rol">HOY · LEGADO</div>
            <ul>
              <li>Advantage ADS · ADT/DBF</li>
              <li>Carpeta por empresa: <code>001</code>, <code>002</code>…</li>
              <li>MOV00…MOV18: archivo por período</li>
              <li>MC&lt;lote&gt;: archivo por lote</li>
              <li>Sin claves foráneas instaladas</li>
            </ul>
          </div>
          <div className="t-arrow">→</div>
          <div className="t-mid">
            <div className="t-rol">MIGRACIÓN</div>
            <ul>
              <li>Perfilado solo lectura + instantáneas con hash</li>
              <li>Homologación campo → campo aprobada</li>
              <li>Transformación: TVALOR firmado → débito/crédito; columnas mensuales → filas por período; un documento por grupo documental</li>
              <li>Carga idempotente con equivalencias y rechazos</li>
              <li>Conciliación con diferencia cero</li>
            </ul>
          </div>
          <div className="t-arrow">→</div>
          <div className="t-new">
            <div className="t-rol">OBJETIVO · NUEVO</div>
            <ul>
              <li>Esquema único con <code>company_id</code></li>
              <li>60 entidades · 9 módulos</li>
              <li>Libro inmutable (documentos + líneas)</li>
              <li>Saldos y acumulados regenerables</li>
              <li>Auditoría + version + idempotencia</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid-2col">
        <div className="panel">
          <div className="panel-titulo">Cobertura del legado por clasificación</div>
          {Object.entries(resultado.porClasificacion).map(([c, n]) => (
            <div className="barra-fila" key={c}>
              <span className={`chip ${CLASIF_COLOR[c] || ''}`}>{c}</span>
              <div className="barra-pista">
                <div className="barra" style={{ width: `${(n / maxClasif) * 100}%` }} />
              </div>
              <span className="barra-n">{n}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-titulo">Distribución por dominio del legado</div>
          {ordenDominios.map((d) => (
            <div className="barra-fila" key={d}>
              <span className="dominio-etiqueta">{d}</span>
              <div className="barra-pista">
                <div className="barra barra-alt" style={{ width: `${(resultado.porDominio[d] / maxDominio) * 100}%` }} />
              </div>
              <span className="barra-n">{resultado.porDominio[d]}</span>
            </div>
          ))}
          <p className="panel-nota">
            La lista completa del legado con su destino se explora en{' '}
            <button className="link" onClick={() => abrirMapa(null)}>Mapa de relaciones →</button>
          </p>
        </div>
      </div>
    </div>
  );
}
