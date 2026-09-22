# CONTABDSI IA Service — asistente contable

Servicio **Python (FastAPI)** que da soporte al asistente contable del
aplicativo, el widget de chat que aparece en el encabezado principal al lado del
usuario (personaje **"Daisy"**, el mismo del ecommerce).

La estructura replica la del `ia-service` del ecommerce. Trae **function
calling** con las ocho herramientas de solo texto del apartado 3.1 de
[`docs/catalogo/HERRAMIENTAS_PRIORIZADAS.md`](../docs/catalogo/HERRAMIENTAS_PRIORIZADAS.md)
(período y parámetros de operación, compañías, búsqueda de tercero, comprobantes,
tipos de documento, centros de costo y verificación de lote). Los datos los pide
al backend por HTTP; el servicio **no** se conecta a la base de datos.

El plan del asistente (fases, fuentes de conocimiento e inventario del
aplicativo) está en [`docs/catalogo/PLAN_ASISTENTE.md`](../docs/catalogo/PLAN_ASISTENTE.md).

## Arquitectura

```
ia-service/
├── app/
│   ├── main.py            # API FastAPI (/chat, /chat/options, /health)
│   ├── config.py          # Variables de entorno
│   ├── tools.py           # Herramientas (function calling)
│   ├── backend_client.py  # Cliente HTTP hacia el backend (fase 0)
│   ├── payload.py         # Forma acordada del `payload` de datos
│   └── deepseek.py        # Cliente DeepSeek + loop de function calling ya armado
├── scripts/
│   └── verificar_herramientas.py  # Verificación de la fase 0, sin modelo
├── requirements.txt
├── dev.sh                 # Uvicorn con reload
└── .env.example
```

## API

- `GET /health` — estado del servicio: modelo, si hay clave, herramientas
  registradas, si se le anuncian al modelo y si el backend responde.
- `GET /chat/options` — opciones rápidas que muestra el widget.
- `POST /chat` — cuerpo:

  ```json
  {
    "message": "¿Cómo verifico un lote?",
    "session_id": "uuid-opcional",
    "history": [{ "role": "user", "content": "..." }],
    "context": { "compania": "027", "companiaNombre": "DSI S.A.", "periodo": "2026 · Febrero 2026", "usuario": "Laura Gómez" }
  }
  ```

  Respuesta: `{ "reply": "...", "session_id": "uuid", "payload": {} }`.

## Agregar una herramienta (function calling)

1. Escribe el handler `async (args, ctx) -> dict` en `app/tools.py`.
2. Declara su esquema en `TOOLS`.
3. Regístrala en `FUNCTION_MAP`.
4. Opcional: añádela a `QUICK_OPTIONS` como sugerencia del widget.

Guarda los resultados que deba renderizar el frontend en `ctx["payload"]`; el
endpoint `/chat` los devuelve tal cual. El encabezado de `app/tools.py` documenta
el contrato con más detalle y `app/payload.py` la forma acordada del `payload`
(el render en el widget es la fase 2 del plan).

Los handlers no consultan la base: piden los datos al backend con
`app/backend_client.py`, que devuelve `{"ok": True, "data": ...}` o
`{"ok": False, "mensaje": ...}` y nunca convierte un fallo en un éxito. Para
verificar el módulo sin modelo:

```bash
.venv/bin/python scripts/verificar_herramientas.py            # contra el backend
.venv/bin/python scripts/verificar_herramientas.py --simular  # capa HTTP simulada
```

## Desarrollo local

```bash
cd ia-service
cp .env.example .env   # pon IA_SERVICE_DEEPSEEK_API_KEY
./dev.sh               # http://127.0.0.1:8003 (docs en /docs)
```

`IA_SERVICE_BACKEND_URL` (por defecto `http://localhost:8001`) es el backend del
que las herramientas piden los datos; `IA_SERVICE_BACKEND_TIMEOUT` acota la
espera. Si el backend no responde, las herramientas devuelven la causa al modelo
en vez de un dato inventado.

El script `node dev.js` de la raíz también levanta este servicio: crea su
`.venv`, instala `requirements.txt` y arranca uvicorn en el puerto 8003, junto
con el backend, PostgreSQL y la interfaz. Para omitirlo, `node dev.js --no-ia`.

Sin `IA_SERVICE_DEEPSEEK_API_KEY` el servicio arranca, pero `/chat` responde
`503`: el widget muestra el aviso de conexión y el resto del aplicativo sigue
funcionando. En ese caso `GET /health` lo dice (`api_key_configured: false`),
informa `tools_announced: false` y explica en `aviso` que las herramientas están
registradas pero el modelo no las recibe, porque no se le llama.

La interfaz de desarrollo (Vite) expone el servicio bajo el prefijo `/bot-api`
(ver `Interface_web/vite.config.ts`), que lo reenvía a `http://127.0.0.1:8003`;
en producción basta con replicar ese proxy inverso.

El puerto por defecto es **8003** (el `ia-service` del ecommerce usa 8002) para
poder levantar ambos proyectos a la vez sin colisiones; se cambia con
`IA_SERVICE_PORT`.
