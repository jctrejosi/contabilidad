// Validación de integridad de los esquemas para presentacion-web.
// Uso: node scripts/validate.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validarIntegridad, DOMINIOS_ESPERADOS } from '../src/lib/validar.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const legado = JSON.parse(readFileSync(join(root, 'src/data/legado.json'), 'utf8'));
const nuevo = JSON.parse(readFileSync(join(root, 'src/data/nuevo.json'), 'utf8'));

const r = validarIntegridad(legado, nuevo);

console.log('=== INTEGRIDAD DE ESQUEMAS (presentacion-web) ===\n');
for (const c of r.checks) {
  console.log(`  ${c.ok ? '✅' : '❌'} ${c.nombre}`);
  console.log(`       ${c.detalle}`);
}
console.log('\n=== Resumen ===');
console.log(`  Tablas legadas ....... ${r.totalLegado}  (esperado 98)`);
console.log(`  Entidades nuevas ..... ${r.totalNuevo}  (esperado 60)`);
console.log(`  Dominios ............. ${Object.keys(DOMINIOS_ESPERADOS).length}  (esperado 12)`);
console.log(`  Destinos huérfanos ... ${r.huerfanos.length}`);
console.log(`  Sin resolución ....... ${r.sinDestino.length}`);
console.log(`  Nuevas sin tabla origen: ${r.nuevasSinOrigen.join(', ') || '(ninguna)'}`);
console.log(`\n  ${r.ok ? '✅ ESQUEMAS COMPLETOS Y CONSISTENTES' : '❌ HAY PROBLEMAS DE INTEGRIDAD'}`);
process.exit(r.ok ? 0 : 1);
