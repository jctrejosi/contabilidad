"""Herramientas (function calling) del asistente contable de CONTABDSI.

Este módulo es el punto de extensión del bot: el modelo solo puede ejecutar las
acciones declaradas aquí. **Hoy no hay ninguna habilitada**, así que el asistente
responde en modo conversación; el loop de function calling ya está implementado
en ``app/deepseek.py`` y se activa solo en cuanto se registren funciones.

Para agregar una función:

1. Escribe el handler::

       async def consultar_saldo(args: dict, ctx: dict) -> dict:
           ...

   - ``args``: argumentos que escribe el modelo (valídalos).
   - ``ctx``: estado de la conversación. Guarda en ``ctx["payload"]`` lo que
     ``/chat`` deba devolver al frontend para renderizarlo.
   - Devuelve un dict serializable; usa ``{"ok": False, "mensaje": "..."}``
     cuando la llamada no sea válida, para que el modelo pueda corregir.

2. Declara su esquema en ``TOOLS`` (nombre, descripción y parámetros JSON Schema).

3. Regístrala en ``FUNCTION_MAP``.

4. (Opcional) Añade una entrada a ``QUICK_OPTIONS`` como sugerencia del widget.
"""

# Definiciones de herramientas para DeepSeek (esquema JSON). Vacío por ahora.
TOOLS: list[dict] = []

# Nombre de la función -> handler ``async (args, ctx) -> dict``.
FUNCTION_MAP: dict = {}


# Opciones rápidas que muestra el widget mientras no hay conversación.
QUICK_OPTIONS: list[dict] = [
    {
        "id": "comprobante",
        "label": "¿Cómo registro un comprobante contable?",
        "message": "Explícame los pasos para registrar un comprobante contable en CONTABDSI.",
    },
    {
        "id": "lote",
        "label": "¿Qué es un lote y cómo se verifica?",
        "message": "¿Qué es un lote de contabilización y cómo se verifica antes de contabilizar?",
    },
    {
        "id": "balance",
        "label": "¿Cómo consulto el balance de comprobación?",
        "message": "¿Cómo consulto e interpreto el balance de comprobación?",
    },
    {
        "id": "centro",
        "label": "¿Para qué sirve un centro de costo?",
        "message": "Explícame para qué sirve un centro de costo y cuándo debo usarlo.",
    },
]


async def get_enabled_quick_options() -> list[dict]:
    """Opciones rápidas vigentes (por ahora fijas, sin configuración por admin)."""
    return QUICK_OPTIONS
