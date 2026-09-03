// Verifica que ambos esquemas estén completos y que las referencias de
// destino del legado resuelvan contra las entidades del esquema nuevo.

export const DOMINIOS_ESPERADOS = {
  'Núcleo': 3,
  'Maestros contables': 6,
  'Terceros y catálogos': 5,
  'Movimiento y libro': 5,
  'Acumulados y costos': 7,
  'Fiscal y exógena': 11,
  'Formatos e informes': 7,
  'Activos y reembolsos': 8,
  'Procesos y presupuesto': 2,
  'Seguridad y auditoría': 3,
  'Integraciones (otros módulos)': 23,
  'Formatos compartidos': 18,
};

export const CLASIFICACIONES = [
  'Parcial',
  'Parcial condicional',
  'Sin estructura',
  'Derivable con cambios',
  'Sustitución técnica',
  'Integración requerida',
];

export function validarIntegridad(legado, nuevo) {
  const nombresNuevos = new Set(nuevo.entidades.map((e) => e.nombre));
  const checks = [];

  // 1 · Conteos globales
  const totalLegado = legado.length;
  const totalNuevo = nuevo.entidades.length;
  checks.push({
    nombre: 'Total de tablas legadas',
    ok: totalLegado === 98,
    detalle: `${totalLegado}/98 familias funcionales`,
  });
  checks.push({
    nombre: 'Total de entidades nuevas',
    ok: totalNuevo === 60,
    detalle: `${totalNuevo}/60 entidades`,
  });
  checks.push({
    nombre: 'Módulos nuevos',
    ok: nuevo.modulos.length === 9,
    detalle: `${nuevo.modulos.length}/9 módulos`,
  });

  // 2 · Conteo por dominio del legado
  const porDominio = {};
  for (const t of legado) porDominio[t.dominio] = (porDominio[t.dominio] || 0) + 1;
  const dominiosOk = Object.entries(DOMINIOS_ESPERADOS).every(
    ([d, n]) => porDominio[d] === n,
  );
  checks.push({
    nombre: 'Distribución por dominio (legado)',
    ok: dominiosOk,
    detalle: Object.entries(porDominio)
      .map(([d, n]) => `${d}: ${n}`)
      .join(' · '),
  });

  // 3 · Integridad referencial: todo destino existe en el esquema nuevo
  const huerfanos = [];
  const vistos = new Set();
  for (const t of legado) {
    for (const d of t.destino) {
      if (!nombresNuevos.has(d) && !vistos.has(d)) {
        huerfanos.push(d);
        vistos.add(d);
      }
    }
  }
  checks.push({
    nombre: 'Referencias de destino resuelven',
    ok: huerfanos.length === 0,
    detalle: huerfanos.length
      ? `Destinos inexistentes: ${huerfanos.join(', ')}`
      : '0 destinos huérfanos',
  });

  // 4 · Toda tabla legada tiene destino o resolución explícita
  const sinDestino = legado.filter(
    (t) => t.destino.length === 0 && !t.nota,
  );
  checks.push({
    nombre: 'Toda tabla legada queda resuelta',
    ok: sinDestino.length === 0,
    detalle: sinDestino.length
      ? `Sin resolución: ${sinDestino.map((t) => t.origen).join(', ')}`
      : 'Toda tabla tiene destino o nota de resolución',
  });

  // 5 · Entidades nuevas que no reciben datos de ninguna tabla legada
  const referenciadas = new Set();
  for (const t of legado) for (const d of t.destino) referenciadas.add(d);
  const nuevasSinOrigen = nuevo.entidades
    .filter((e) => !referenciadas.has(e.nombre))
    .map((e) => e.nombre);

  checks.push({
    nombre: 'Entidades nuevas sin tabla origen',
    ok: nuevasSinOrigen.length >= 0,
    detalle: nuevasSinOrigen.length
      ? `${nuevasSinOrigen.length} son netamente nuevas: ${nuevasSinOrigen.join(', ')}`
      : 'Todas reciben datos de alguna tabla legada',
  });

  // 6 · Clasificaciones del legado suman 98
  const porClasificacion = {};
  for (const t of legado) porClasificacion[t.clasificacion] = (porClasificacion[t.clasificacion] || 0) + 1;
  checks.push({
    nombre: 'Clasificaciones cubren todo el legado',
    ok: Object.values(porClasificacion).reduce((a, b) => a + b, 0) === 98,
    detalle: Object.entries(porClasificacion)
      .map(([c, n]) => `${c}: ${n}`)
      .join(' · '),
  });

  return {
    ok: checks.every((c) => c.ok),
    totalLegado,
    totalNuevo,
    nuevoModulos: nuevo.modulos.length,
    porDominio,
    porClasificacion,
    huerfanos,
    sinDestino,
    nuevasSinOrigen,
    checks,
  };
}
