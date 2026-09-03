const FASES = [
  ['0 · Alcance', 'Empresas/años, módulos activos, historia requerida, ventana, RPO/RTO', 'Inventario firmado'],
  ['1 · Perfilado', 'Solo lectura: tamaños, registros, claves repetidas, huérfanos, fechas, signos', 'Informe por fuente + excepciones'],
  ['2 · Homologación', 'Campo → destino → transformación → regla → prueba (2.663 campos)', 'Nada funcional sin destino aprobado'],
  ['3 · Esquema y servicios', 'B01–B15 ya corregidos; migraciones versionadas; integraciones', 'Instalable en base vacía y actualizable'],
  ['4 · Ensayo del motor', 'Pruebas de lógica, integridad y concurrencia (11/11 hoy)', 'Pruebas críticas pasan'],
  ['5 · Extractor + staging', 'Instantánea consistente + metadatos + hash', 'Extracción reproducible, origen intacto'],
  ['6 · Carga piloto', 'Una compañía/año representativos', 'Carga idempotente + conciliación exacta'],
  ['7 · Validación usuarios', 'Mismos casos del original, opción por opción', 'Aceptación por proceso'],
  ['8 · Ensayo general', 'Todas las empresas/años + restauración', 'Tiempos y restauración OK'],
  ['9 · Corte', 'Congelamiento → snapshot → carga final → conciliación', 'Acta GO · un solo escritor'],
  ['10 · Estabilización', 'Legado en consulta, conciliación operativa, respaldo', 'Aceptación final'],
];

const ORDEN_CARGA = [
  'Ejecución de migración, compañías, años, períodos y usuarios homologados',
  'Catálogos, terceros, cuentas/jerarquía, centros, comprobantes y tipos',
  'Parámetros, bancos, plantillas, formatos, exógena, presupuesto, activos, reembolsos',
  'Lotes pendientes y su detalle (historia de estados y aplicaciones)',
  'Libro histórico POR GRUPOS DOCUMENTALES (sin recontabilizar lo ya aplicado)',
  'Aperturas, reversiones/anulaciones y referencias cruzadas',
  'Reconstrucción de saldos/acumulados + comparación con el origen',
  'Certificados, exportaciones históricas y archivos',
  'Consecutivos ajustados a los datos cargados (sin renumerar)',
  'Índices, estadísticas y pruebas finales',
];

const REGLAS = [
  ['No recontabilizar', 'Un lote aplicado y su movimiento publicado no son dos asientos: el cargador histórico valida invariantes y conserva procedencia.'],
  ['CONDOCUM primero', 'Se concilia con MOVxx antes de reconstruir cabeceras; los huérfanos se registran como excepción, no se inventan cabeceras.'],
  ['Períodos completos', 'No perder los períodos 00 y 13–18. Apertura con una sola fuente (MOV00 o saldo inicial, nunca ambas).'],
  ['Identidades como texto', 'Códigos, documentos, NIT y números de banco conservan ceros iniciales; fechas inválidas a cuarentena con motivo.'],
  ['RECNO no es identidad', 'Solo localizador dentro de una instantánea identificada; nunca clave permanente.'],
  ['Derivados regenerados', 'Los acumulados originales se guardan como instantánea de conciliación; los nuevos se recalculan desde el libro aprobado.'],
  ['Rastro por fila', 'Ejecución, archivo, hash, equivalencia de clave y rechazo con motivo. Cargador idempotente y reanudable.'],
  ['Archivos también', 'Certificados/portal (XADPDF) se migran con manifiesto y hash: una ruta Windows no es el documento.'],
];

const GO_NOGO_OK = [
  ['B01–B15 corregidos', '11/11 pruebas del flujo en verde'],
  ['Libro multi-documento', 'Un lote → N documentos por grupo documental'],
  ['Anulación consistente', 'Reversión REV-… que reversa saldos'],
  ['Acumulados fiscales', 'Retención e IVA regenerables desde el libro (B03)'],
  ['Aislamiento y períodos', 'FK compuestas (compania_id, id) y rechazo de período cerrado'],
  ['Activos, reembolsos, bancos', 'Módulo de ampliaciones creado'],
];

const GO_NOGO_FALTA = [
  ['Homologación completa', '2.663 campos: 406 candidatos, 2.257 pendientes de revisión individual'],
  ['Exógena completa', 'Reglas CONMAG3 (rangos/condiciones) y detalle CONMAGIT'],
  ['Informes', 'Definiciones CONINF1 y selecciones por usuario'],
  ['Procesos', 'Algoritmos de cierre anual, traslados 13–18 y consolidación'],
  ['Archivos', 'Repositorio de certificados (XADPDF)'],
  ['Seguridad productiva', 'Autenticación/RLS reales y bitácora inmutable'],
  ['modo_retencion', 'Regla de negocio (el legado no persiste MCR)'],
  ['Migrador versionado', 'Lo actual es un bootstrap de demo con dropdb'],
];

export default function Migracion() {
  return (
    <div className="seccion">
      <h1>Ruta de migración de los datos</h1>
      <p className="lede">
        La migración <strong>no es un volcado de archivos</strong>: es un proyecto por fases con homologación
        aprobada, extracción de instantáneas, transformación por proceso contable (P01–P36), carga idempotente
        y conciliación con diferencia cero. Fuente: <code>db/old_db/PLAN_MIGRACION_POSTGRESQL.md</code>.
      </p>

      <div className="panel">
        <div className="panel-titulo">Fases 0–10</div>
        <table className="tabla">
          <thead>
            <tr><th style={{ width: 180 }}>Fase</th><th>Trabajo</th><th>Condición de salida</th></tr>
          </thead>
          <tbody>
            {FASES.map(([f, tr, sa]) => (
              <tr key={f}>
                <td className="celda-tabla">{f}</td>
                <td>{tr}</td>
                <td><em>{sa}</em></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid-2col">
        <div className="panel">
          <div className="panel-titulo">Orden de carga (dependencias primero)</div>
          <ol className="lista-orden">
            {ORDEN_CARGA.map((o, i) => (
              <li key={i}><b>{i + 1}.</b> {o}</li>
            ))}
          </ol>
        </div>

        <div className="panel">
          <div className="panel-titulo">Reglas que no se negocian</div>
          {REGLAS.map(([t, d]) => (
            <div className="regla" key={t}>
              <b>{t}.</b> {d}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-titulo">Conciliación: el criterio de éxito es diferencia cero</div>
        <p>
          Cada fila del universo fuente se clasifica: <strong>cargada · fusionada por regla · derivada
          (se recalcula) · excluida con autorización · rechazada con motivo</strong>. La suma debe explicar el
          100 % y las conciliaciones contables deben cuadrar: libro ↔ saldos por cuenta/tercero/centro,
          retención, IVA, exógena, presupuesto, activos, consecutivos y anulaciones.
        </p>
        <p className="advertencia">
          ⚠ No basta que total débito = total crédito: un error simétrico también cuadra. Se comparan mayor,
          auxiliares y acumulados con los mismos filtros del origen, más las pruebas T01–T18.
        </p>
      </div>

      <div className="panel">
        <div className="panel-titulo">Corte y reversión</div>
        <ol className="lista-orden">
          <li>Respaldar y <b>verificar restauración</b>; registrar conteos y hashes de origen, staging y destino.</li>
          <li><b>Congelar escrituras</b> en fuentes compartidas y obtener un snapshot consistente del conjunto (una copia por archivo puede mezclar instantes).</li>
          <li>Cargar, conciliar y firmar aceptación <b>antes</b> de habilitar la escritura PostgreSQL.</li>
          <li>Si falla antes: el legado sigue operando y el destino aislado se rehace.</li>
          <li>Si falla después: <b>no basta volver al respaldo</b> — congelar, identificar lo creado en PostgreSQL y ejecutar un plan de retorno probado.</li>
          <li>Conservar legado y fuentes en <b>solo lectura</b> por el plazo aprobado; no borrar ADT/DBF.</li>
        </ol>
      </div>

      <div className="grid-2col go-nogo">
        <div className="panel borde-ok">
          <div className="panel-titulo">✅ Ya listo en el esquema nuevo</div>
          {GO_NOGO_OK.map(([t, d]) => (
            <div className="regla" key={t}><b>{t}:</b> {d}</div>
          ))}
        </div>
        <div className="panel borde-pend">
          <div className="panel-titulo">⏳ Falta para autorizar producción (NO-GO)</div>
          {GO_NOGO_FALTA.map(([t, d]) => (
            <div className="regla" key={t}><b>{t}:</b> {d}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
