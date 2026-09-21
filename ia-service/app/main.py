"""API del asistente contable de CONTABDSI (ia-service).

Endpoints:
- GET  /health        → estado del servicio y del modelo.
- GET  /chat/options  → opciones rápidas que muestra el widget.
- POST /chat          → conversación {message, session_id?, history?, context?}
                        → {reply, session_id, payload}.
"""
import logging
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import config, deepseek, tools

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("ia-service.main")

app = FastAPI(
    title="CONTABDSI IA Service",
    description="Asistente contable con DeepSeek. Estructura lista para function calling.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HistoryMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    history: list[HistoryMessage] = Field(default_factory=list)
    context: dict = Field(
        default_factory=dict,
        description="Contexto de sesión (compañía, periodo, usuario).",
    )


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    payload: dict = Field(default_factory=dict)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": config.DEEPSEEK_MODEL,
        "api_key_configured": bool(config.DEEPSEEK_API_KEY),
        "tools_enabled": sorted(tools.FUNCTION_MAP.keys()),
    }


@app.get("/chat/options")
async def chat_options():
    return {"options": await tools.get_enabled_quick_options()}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not config.DEEPSEEK_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="DEEPSEEK_API_KEY no está configurada en el servicio ia-service",
        )

    session_id = req.session_id or str(uuid.uuid4())
    history = [h.model_dump() for h in req.history]

    try:
        result = await deepseek.chat(
            user_message=req.message,
            history=history,
            context=req.context,
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("Error procesando el chat")
        raise HTTPException(
            status_code=502,
            detail=f"Error del proveedor de IA: {exc}",
        ) from exc

    return ChatResponse(
        reply=result["reply"],
        session_id=session_id,
        payload=result.get("payload") or {},
    )
