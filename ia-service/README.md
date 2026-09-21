# CONTABDSI IA Service — asistente contable

Servicio **Python (FastAPI)** que da soporte al asistente contable del
aplicativo, el widget de chat que aparece en el encabezado principal al lado del
usuario (personaje **"Daisy"**, el mismo del ecommerce).

La estructura replica la del `ia-service` del ecommerce y queda **lista para
function calling**: hoy no hay herramientas registradas, así que el asistente
responde en modo conversación; al agregar funciones en `app/tools.py` el loop de
`app/deepseek.py` las ejecuta automáticamente sin tocar el resto.

## Arquitectura

```
ia-service/
├── app/
│   ├── main.py      # API FastAPI (/chat, /chat/options, /health)
│   ├── config.py    # Variables de entorno
│   ├── tools.py     # Herramientas (function calling) — VACÍO por ahora
│   └── deepseek.py  # Cliente DeepSeek + loop de function calling ya armado
├── requirements.txt
├── dev.sh           # Uvicorn con reload
└── .env.example
```

## API

- `GET /health` — estado del servicio, modelo y herramientas habilitadas.
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
el contrato con más detalle.

## Desarrollo local

```bash
cd ia-service
cp .env.example .env   # pon IA_SERVICE_DEEPSEEK_API_KEY
./dev.sh               # http://127.0.0.1:8003 (docs en /docs)
```

El script `node dev.js` de la raíz también levanta este servicio: crea su
`.venv`, instala `requirements.txt` y arranca uvicorn en el puerto 8003, junto
con el backend, PostgreSQL y la interfaz. Para omitirlo, `node dev.js --no-ia`.

Sin `IA_SERVICE_DEEPSEEK_API_KEY` el servicio arranca, pero `/chat` responde
`503`: el widget muestra el aviso de conexión y el resto del aplicativo sigue
funcionando.

La interfaz de desarrollo (Vite) expone el servicio bajo el prefijo `/bot-api`
(ver `Interface_web/vite.config.ts`), que lo reenvía a `http://127.0.0.1:8003`;
en producción basta con replicar ese proxy inverso.

El puerto por defecto es **8003** (el `ia-service` del ecommerce usa 8002) para
poder levantar ambos proyectos a la vez sin colisiones; se cambia con
`IA_SERVICE_PORT`.
