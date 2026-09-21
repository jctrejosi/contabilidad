# CONTABDSI IA Service — asistente contable

Servicio **Python (FastAPI)** que da soporte al asistente contable del
aplicativo, el widget de chat que aparece en el encabezado principal al lado del
usuario (personaje **"Daisy"**, el mismo del ecommerce).

La estructura replica la del `ia-service` del ecommerce. El loop de
`app/deepseek.py` ejecuta las herramientas registradas en `app/tools.py`; agregar
una función nueva no requiere tocar nada más.

## Arquitectura

```
ia-service/
├── app/
│   ├── main.py      # API FastAPI (/chat, /chat/options, /health)
│   ├── config.py    # Variables de entorno
│   ├── backend.py   # Cliente de la API del backend (los handlers NO tocan la BD)
│   ├── tools.py     # Herramientas (function calling) + sus handlers
│   └── deepseek.py  # Cliente DeepSeek + loop de function calling ya armado
├── requirements.txt
├── dev.sh           # Uvicorn con reload
└── .env.example
```

## Cómo consulta los datos

El asistente **no habla con la base de datos**. Sus herramientas usan
`app/backend.py` para llamar a la API del backend (`/api/...`), que resuelve el
motor de datos (Advantage o PostgreSQL según `CONTABDSI_STORE`) y centraliza las
reglas por compañía. Así el bot no se acopla al esquema ni a la migración en
curso, y hereda PostgreSQL cuando la migración avance.

| Variable | Por defecto | Para qué |
|---|---|---|
| `BACKEND_API_URL` | `http://127.0.0.1:8001` | Base de la API del backend |
| `BACKEND_TIMEOUT` | `30` | Timeout de cada llamada (segundos) |

La compañía activa llega en `context.compania` de `/chat` y los handlers la
toman con `backend.require_company(ctx)`.

## Herramientas implementadas

Todas son de solo lectura. Devuelven al modelo un resumen corto (máximo 10
coincidencias) para no inflar el contexto.

| Herramienta | Qué hace | Endpoint |
|---|---|---|
| `buscar_cuenta` | Busca cuentas del plan por código (exacto o parcial) o nombre | `GET /api/cuentas` |
| `consultar_periodo` | Período contable habilitado de la compañía | `GET /api/periodo-operacion` |
| `buscar_tercero` | Busca terceros por NIT, nombre o ciudad | `GET /api/terceros` |
| `consultar_movimiento_mensual` | Movimiento del mes con totales del período completo y filtros | `GET /api/movimiento-mensual` |
| `consultar_documentos` | Cabeceras de documentos con total de documentos y valor total | `GET /api/documentos` |
| `consultar_documento_detalle` | Partidas de un documento y verificación de cuadre | `GET /api/documentos/detalle` |

`buscar_cuenta` cachea el catálogo resumido por compañía durante
`IA_SERVICE_CATALOG_TTL` segundos (300 por defecto): el endpoint devuelve miles
de filas y no conviene pedirlo en cada pregunta.

### Decisiones de las consultas de datos

- **`pageSize` fijo** (50), no lo elige el modelo: así ninguna respuesta trae un
  volcado enorme y el contexto se mantiene corto. Para recorrer más filas, el
  modelo avanza con `page`.
- **Período autocompletado**: si el usuario no lo indica, se usa el período
  habilitado (`GET /api/periodo-operacion`, cacheado 60 s) y el resultado marca
  `periodoAsumido: true` para que el modelo lo diga.
- **`consultar_documento_detalle` exige la clave completa** (documento,
  comprobante, tipo documental y fecha): no adivina cabeceras.
- **Totales del período, no de la página**: los entregan los repositorios
  (`periodDebit/Credit/Saldo` y `totalDocumentos/totalValor`) en **ambos**
  motores. Con Advantage se evita que el bot informe `$0` cuando sí hay saldo.
- **Los totales de cuadre** de `consultar_documento_detalle` los calcula el
  propio handler sobre los renglones devueltos, así que no dependen del motor.

### Tablas en el widget (`payload`)

Las tools de datos agregan bloques a `payload(ctx)["bloques"]` con la forma
`{tipo: "tabla", titulo, subtitulo, columnas, filas, totales, nota}`. El frontend
los muestra en un visor aparte (`BotPayloadViewer`) que se abre con el botón
"Ver tabla" de cada respuesta. Varias tools pueden aportar tablas en un mismo
turno: el usuario pide cada dato por separado y los revisa juntos.

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

  Respuesta: `{ "reply": "...", "session_id": "uuid", "payload": { "bloques": [...] } }`.
  El `payload` no se le envía al modelo: es lo que el widget renderiza en el visor.

## Agregar una herramienta (function calling)

1. Escribe el handler `async (args, ctx) -> dict` en `app/tools.py`.
2. Declara su esquema en `TOOLS`.
3. Regístrala en `FUNCTION_MAP`.
4. Opcional: añádela a `QUICK_OPTIONS` como sugerencia del widget.

Reglas del handler: consulta la API con `backend.get/post` (nunca la BD), toma la
compañía con `backend.require_company(ctx)`, devuelve un **resumen corto** al
modelo y manda lo pesado a `payload(ctx)` (que no se le envía al modelo, solo al
widget). Ante cualquier fallo, `backend.fail(exc)`. El encabezado de
`app/tools.py` documenta el contrato completo.

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
