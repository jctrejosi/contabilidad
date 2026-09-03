// Extrae, SOLO EN LECTURA desde db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md, la línea
// "Campos físicos/código inventariados: `A`, `B`, …" de cada tabla legada y
// genera src/data/campos_legado.json (origen -> [campos]).
// Uso: node scripts/extraer-campos-legado.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(
  join(root, '..', 'old_db', 'MATRIZ_TABLAS_Y_BRECHAS.md'),
  'utf8',
);

const camposPorTabla = {};
let actual = null;

for (const linea of md.split('\n')) {
  const enc = linea.match(/^### (.+)$/);
  if (enc) {
    actual = enc[1].replaceAll('&lt;', '<').replaceAll('&gt;', '>').trim();
    if (!camposPorTabla[actual]) camposPorTabla[actual] = [];
    continue;
  }
  if (actual && linea.includes('Campos físicos/código inventariados:')) {
    for (const m of linea.matchAll(/`([^`]+)`/g)) {
      const c = m[1];
      if (!camposPorTabla[actual].includes(c)) camposPorTabla[actual].push(c);
    }
  }
}

// Orden estable y solo tablas con inventario
const salida = {};
for (const [k, v] of Object.entries(camposPorTabla)) {
  if (v.length > 0) salida[k] = v;
}

writeFileSync(
  join(root, 'src', 'data', 'campos_legado.json'),
  JSON.stringify(salida, null, 1) + '\n',
);

const total = Object.values(salida).reduce((a, v) => a + v.length, 0);
console.log(`Tablas con inventario de campos: ${Object.keys(salida).length}`);
console.log(`Campos totales (sin duplicados por tabla): ${total}`);
console.log('Máximo por tabla:', Math.max(...Object.values(salida).map((v) => v.length)));
