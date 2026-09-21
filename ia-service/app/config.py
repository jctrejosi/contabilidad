"""Configuración del asistente contable (ia-service) desde variables de entorno."""
import os

from dotenv import load_dotenv

load_dotenv()

# API key DEDICADA del asistente. Si no se define, se usa DEEPSEEK_API_KEY como
# respaldo (misma clave que el resto de servicios si se comparte).
DEEPSEEK_API_KEY = os.getenv("IA_SERVICE_DEEPSEEK_API_KEY") or os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com")
DEEPSEEK_TIMEOUT = float(os.getenv("DEEPSEEK_TIMEOUT", "60"))

# Puerto del servicio (8002 lo usa el ia-service del ecommerce si se levanta en
# paralelo; por eso aquí se usa 8003). Vite lo consume por el proxy /bot-api.
PORT = int(os.getenv("IA_SERVICE_PORT", "8003"))
# En desarrollo la interfaz (Vite) hace de proxy, así que CORS casi nunca se usa;
# se deja configurado para apuntar el widget directamente al servicio si hace falta.
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGIN", "http://localhost:8443").split(",")
    if o.strip()
]

MAX_HISTORY = int(os.getenv("IA_SERVICE_MAX_HISTORY", "12"))
MAX_TOKENS = int(os.getenv("IA_SERVICE_MAX_TOKENS", "2000"))
MAX_TOOL_ROUNDS = int(os.getenv("IA_SERVICE_MAX_TOOL_ROUNDS", "6"))
