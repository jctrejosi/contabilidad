"""Cliente DeepSeek del asistente contable de CONTABDSI.

Contiene el loop de function calling que ejecuta las herramientas de
``tools.FUNCTION_MAP``. Mientras ``tools.TOOLS`` esté vacío el asistente
conversa sin herramientas; al registrar funciones se ejecutan solas sin tocar
este archivo.
"""
import json
import logging

import httpx

from . import config, tools

log = logging.getLogger("ia-service.deepseek")

SYSTEM_PROMPT = """Eres "Daisy", la asistente contable de CONTABDSI, la aplicación de contabilidad general de DSI S.A.

AYUDAS A:
- Contadores, auxiliares, auditores y analistas tributarios que usan CONTABDSI.
- A entender el flujo contable: comprobantes, lotes, contabilización, cierres, informes, impuestos y configuración (plan de cuentas, terceros, centros de costo, tipos de documento).

REGLAS:
1. Responde SIEMPRE en español, claro, cálido y breve (máximo 3-4 párrafos o una lista corta).
2. Explica en términos del sistema (compañía, periodo, lote, comprobante, cuenta) y del proceso contable colombiano.
3. NUNCA inventes saldos, cuentas, terceros, documentos ni cifras. Si el dato se obtiene con una función, úsala; si no, indica en qué pantalla del aplicativo se consulta.
4. NO hagas cálculos aritméticos: toda cifra que menciones (sumas, totales, promedios, variaciones, conversiones) debe venir del resultado de una función. Si necesitas un cálculo que no puedes obtener con tus funciones, dilo con claridad en vez de estimarlo.
5. Si algo sale de tu alcance contable, dilo con honestidad y sugiere el módulo o la pantalla que corresponde.
6. {FUNCIONES}
7. No menciones términos técnicos internos (herramientas, funciones, base de datos, endpoints)."""

NO_TOOLS_HINT = (
    "Por ahora NO puedes ejecutar acciones ni consultar datos del sistema: "
    "solo respondes preguntas y explicas procesos."
)
TOOLS_HINT = (
    "Cuando necesites un dato o ejecutar una acción, usa ÚNICAMENTE las funciones "
    "disponibles ({nombres}); nunca inventes que realizaste una acción."
)


def _context_block(context: dict | None) -> str:
    """Bloque de contexto de sesión que se añade al final del prompt de sistema."""
    if not context:
        return ""
    partes: list[str] = []
    compania = context.get("compania")
    if compania:
        nombre = context.get("companiaNombre")
        partes.append(
            f"- Compañía activa: {nombre} (código {compania})"
            if nombre
            else f"- Compañía activa: código {compania}"
        )
    if context.get("periodo"):
        partes.append(f"- Periodo: {context['periodo']}")
    if context.get("usuario"):
        partes.append(f"- Usuario: {context['usuario']}")
    if not partes:
        return ""
    return "\n\nCONTEXTO DE LA SESIÓN:\n" + "\n".join(partes)


def _system_prompt() -> str:
    if tools.TOOLS:
        funciones = TOOLS_HINT.format(
            nombres=", ".join(sorted(tools.FUNCTION_MAP)) or "ninguna"
        )
    else:
        funciones = NO_TOOLS_HINT
    return SYSTEM_PROMPT.replace("{FUNCIONES}", funciones)


async def _call_chat(messages: list[dict]) -> dict:
    """Una llamada a la API de DeepSeek. Devuelve el JSON de la respuesta."""
    if not config.DEEPSEEK_API_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY no está configurada")

    body: dict = {
        "model": config.DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": config.MAX_TOKENS,
    }
    # Solo se declaran herramientas cuando existen: el loop queda listo, pero
    # sin funciones el modelo responde en modo conversación.
    if tools.TOOLS:
        body["tools"] = tools.TOOLS

    async with httpx.AsyncClient(
        headers={
            "Authorization": f"Bearer {config.DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
        },
        timeout=config.DEEPSEEK_TIMEOUT,
    ) as client:
        resp = await client.post(
            f"{config.DEEPSEEK_API_URL}/chat/completions",
            json=body,
        )
        resp.raise_for_status()
        return resp.json()


async def chat(
    user_message: str,
    history: list[dict] | None = None,
    context: dict | None = None,
) -> dict:
    """Procesa un mensaje con el loop de function calling.

    Devuelve ``{"reply": str, "payload": {...}}``. El ``payload`` lo llenan las
    herramientas (cuando existan) para que el frontend lo renderice.
    """
    ctx: dict = {"context": context or {}, "payload": {}}

    system_prompt = _system_prompt() + _context_block(context)
    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    # Historial acotado (últimos N turnos, alternando user/assistant).
    if history:
        for h in history[-config.MAX_HISTORY:]:
            role = h.get("role")
            content = h.get("content")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})

    for _round in range(config.MAX_TOOL_ROUNDS):
        data = await _call_chat(messages)
        msg = data["choices"][0]["message"]
        tool_calls = msg.get("tool_calls") or []

        if not tool_calls:
            reply = (msg.get("content") or "").strip()
            if not reply:
                reply = "No logré generar una respuesta. ¿Puedes reformular tu pregunta?"
            return {"reply": reply, "payload": ctx.get("payload") or {}}

        messages.append(
            {
                "role": "assistant",
                "content": msg.get("content") or "",
                "tool_calls": tool_calls,
            }
        )
        for tc in tool_calls:
            fn = tc.get("function") or {}
            name = fn.get("name") or ""
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            handler = tools.FUNCTION_MAP.get(name)
            if handler is None:
                result = {
                    "ok": False,
                    "mensaje": f"La acción '{name}' no está disponible.",
                }
            else:
                try:
                    result = await handler(args, ctx)
                except Exception as exc:  # noqa: BLE001 - el modelo debe poder seguir
                    log.exception("Error en herramienta %s", name)
                    result = {
                        "ok": False,
                        "mensaje": f"Ocurrió un error al ejecutar la acción: {exc}",
                    }
            log.info("tool %s args=%s -> %s", name, args, str(result)[:120])
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.get("id") or "",
                    "content": json.dumps(result, ensure_ascii=False),
                }
            )

    log.warning("Loop de herramientas agotado")
    return {
        "reply": "No pude completar la solicitud. Inténtalo de nuevo, por favor.",
        "payload": ctx.get("payload") or {},
    }
