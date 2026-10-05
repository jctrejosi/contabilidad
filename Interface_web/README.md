# Interfase_web_figma — CONTABDSI

Prototipo web interactivo de **CONTABDSI** (contabilidad general empresarial),
generado desde Figma Make: React 19 + Vite + Tailwind CSS v4 + TypeScript (pnpm).
Navegación por estado (sin router), datos simulados en `src/data/`.

## Estado

Las **45 pantallas** del sistema están implementadas y navegables:

- **Inicio**: tablero con KPIs, lotes por estado, alertas y tareas.
- **Movimientos**: captura directa, lotes (flujo completo con validaciones,
  aprobación y contabilización atómica simulada), anulación, importaciones,
  integración de nómina, reembolsos.
- **Consultas** (9): documentos, movimiento mensual, saldos anuales, anual por
  cuenta/tercero/centro, saldos cuenta/centro, documento específico, comparativos.
- **Informes** (42 informes en 7 categorías) con parámetros, vista previa paginada,
  favoritos/recientes y exportación simulada.
- **Impuestos**: retenciones, IVA y medios magnéticos (asistente de 7 pasos con
  conciliación).
- **Reprocesos y auditoría, Cierres, Consolidación**.
- **Configuración** (14 maestros) y **Administración** (usuarios/permisos, bitácora,
  integraciones, reorganización).

La funcionalidad pendiente se completó desde el repositorio hermano
`../Interface_web_deepseek` (ver `docs/CONTRATO_MERGE.md`).

## Ejecutar

```bash
pnpm install
pnpm dev            # desarrollo (Vite en http://localhost:8448)
pnpm build          # compilación de producción
pnpm test:parametros  # tests unitarios de los validadores de Parámetros
pnpm smoke          # smoke test E2E del flujo contable (requiere preview en 8444)
```

Para el smoke test: en una terminal `pnpm preview --port 8444` y en otra
`pnpm smoke` (usa Chromium del sistema).

## Flujo contable validado (demo guiada)

1. **Inicio** → lote **NOM2 — Nómina febrero** con 2 errores.
2. Abrir el lote → «Ir a celda» en cada error → asignar **tercero** (línea L01) y
   **centro** (línea L03).
3. Lote **cuadrado** → Verificar → Enviar a aprobación → Aprobar.
4. **Contabilizar** (progreso) → recibo **CE-000245 / NOM-2026-02**.
5. Ver documento oficial → consulta mensual → balance de comprobación → exportar.

Los lotes creados desde Nómina/Plantillas/Importaciones/Reclasificaciones/Reembolsos
aparecen en la lista de **Lotes** (estado Borrador) gracias al estado compartido en
`App.tsx`.

## Reglas contables del prototipo

- Débito y crédito en columnas separadas; sólo se contabiliza si débito = crédito.
- Cuenta no afectable no acepta movimiento; tercero/centro/base obligatorios según la cuenta.
- Importación masiva siempre termina en lote; la anulación crea reversión trazable.
- Acciones destructivas exigen motivo y confirmación por texto exacto.
- Reglas tributarias configurables; las no definidas muestran «Pendiente de validación funcional».

## Estructura

```
src/
  components/Shell.tsx      # sidebar + header (navegación por estado)
  data/                     # mocks y validadores (parametrosOperacion, config*)
  pages/                    # 45 pantallas (una por módulo)
  types.ts                  # tipos de dominio
tests/                      # tests unitarios (node --test)
scripts/smoke.mjs           # smoke test E2E (puppeteer-core)
docs/CONTRATO_MERGE.md      # contrato del merge con Interface_web_deepseek
```
