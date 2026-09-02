# CONTABDSI — Prototipo web de contabilidad general

Prototipo interactivo de alta fidelidad para **CONTABDSI**, aplicación de contabilidad
general empresarial que conserva la funcionalidad del sistema legado VISION/FORTUNER,
reorganizada según el flujo moderno del contador.

**Stack:** React 19 + TypeScript + Vite + react-router-dom. Sin backend: todos los datos
son simulados en una capa de servicios (`src/data/` + `src/state/AppStore.tsx`).

## Ejecutar

```bash
npm install
npm run dev      # desarrollo en http://localhost:5173
npm run build    # compilación de producción (dist/)
npm run preview  # sirve el build
npm run smoke    # (opcional) prueba E2E con Chromium del sistema
```

## Flujo obligatorio (demo guiada)

1. **Inicio** → el lote **NOM2 — Nómina febrero** aparece «Con errores · 2 errores».
2. Abrir el lote → pestaña **Validaciones** → «Ir a la celda» en cada error:
   - línea 7: cuenta `510506` exige **centro** → asigne `ADM`.
   - línea 11: cuenta `250505` exige **tercero** → asigne `900111222`.
3. El lote queda **cuadrado** → **Verificar** → **Enviar a aprobación** → **Aprobar**.
4. **Contabilizar** (transacción atómica simulada con progreso) → recibo con
   comprobante **CE-000245** / documento **NOM-2026-02**.
5. «Ver documento oficial» → Consulta mensual → Informe **Balance de comprobación
   acumulado** → Exportar PDF/XLSX.

## Roles (simular permisos)

Menú de usuario en el header → cambiar rol: Administrador, Contador principal,
Auxiliar contable, Auditor, Analista tributario, Consulta gerencial. El menú y las
acciones se ocultan/deshabilitan según el permiso; toda acción sensible queda
registrada en la **Bitácora** (Administración → Bitácora).

## Estructura

```
src/
  design/tokens.css        # tokens de diseño (azul petróleo, densidades)
  core/                    # tipos de dominio y formato (COP, fechas)
  data/                    # datos mock + catálogo de 38 informes
  state/AppStore.tsx       # store global: sesión, lotes, validación, contabilización
  components/ui/           # kit UI (botones, tabla, modal, estados…)
  components/accounting/   # kit contable (grillas, pickers, validación, wizard…)
  shell/                   # sidebar + header + toasts
  pages/                   # ~45 pantallas organizadas por área
scripts/smoke.mjs          # smoke test E2E (opcional, puppeteer-core)
docs/CONTRATO.md           # contrato interno de componentes/APIs
```

## Notas de diseño

- Débito y crédito en columnas separadas; sólo se contabiliza si débito = crédito.
- Período cerrado = solo lectura; cuenta no afectable no acepta movimiento;
  tercero/centro/base son obligatorios según la cuenta.
- Importación masiva siempre termina en un **lote**; anulación crea reversión trazable.
- Las acciones peligrosas usan modal reforzado (motivo + texto exacto + respaldo +
  simulación descargable) y quedan auditadas.
- Reglas tributarias configurables; las no definidas muestran «Pendiente de validación
  funcional». Presupuesto futuro bajo feature flag (no aparece en el menú).
- Densidad compacta/cómoda desde el header; navegación por teclado en tablas
  (↑↓, Enter, Espacio, F2/F3 en captura) y WCAG 2.2 AA.
