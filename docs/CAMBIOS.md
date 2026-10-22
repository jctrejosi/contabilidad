# Registro de cambios

Cambios que alteran el comportamiento del aplicativo y conviene poder revertir.

## 2026-10-21 — Acceso: se retira temporalmente `AccessGate`

**Motivo.** Fortuner27 no está en ejecución, así que `AccessGate` bloqueaba la
interfaz completa con «Ejecución incorrecta del programa» (fail-closed). Para
poder usar el módulo mientras se restablece Fortuner, se deja de montar el gate.

**Cambio.** `Interface_web/src/main.tsx` renderiza `<App />` directamente. El
componente `Interface_web/src/components/AccessGate.tsx` y el router
`backend/access_session.py` **se conservan sin cambios**; solo se quitó el
envoltorio en el punto de entrada.

**Estado.** Aplicado en producción el 2026-10-21: imagen `contabdsi/app`
reconstruida y `contabdsi_app` recreado. Verificado en
`https://contabilidad.jcti.xyz`: `/api/health` responde 200 y el bundle servido
ya no contiene `access/session` ni el texto del gate.

**Alcance.** Es una desactivación **solo de interfaz**: la API no exige la
sesión de acceso (los endpoints de datos no la validan). Al volver a montar
`AccessGate`, la aplicación recupera el modelo fail-closed sin tocar el backend.

**Para restaurarlo.** En `Interface_web/src/main.tsx`, volver a importar
`AccessGate` y envolver `<App />`:

```tsx
import AccessGate from './components/AccessGate'

<AccessGate>
  <App />
</AccessGate>
```

Requiere Fortuner27 escuchando en `FORTUNER_API_URL` (por defecto
`http://127.0.0.1:8004`; en el contenedor, `http://host.docker.internal:8004`) y
la clave administrativa configurada allí.

**Riesgo asumido.** Sin el gate, cualquiera que alcance la URL entra a la
interfaz. El despliegue conserva TLS, CSP y cabeceras de seguridad, y los datos
siguen en PostgreSQL. Si el sitio queda expuesto a internet sin Fortuner,
evaluar `PROTECT_APP=true` (Basic Auth) como barrera temporal.
