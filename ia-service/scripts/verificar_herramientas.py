"""Verificación de la fase 0 del asistente contable, sin modelo.

Hace dos comprobaciones:

1. Coherencia entre ``TOOLS`` y ``FUNCTION_MAP`` (mismo número y mismos nombres,
   esquemas válidos, handlers asíncronos).
2. Cada handler con argumentos válidos y con argumentos inválidos. Los handlers
   llaman al backend por HTTP; aquí solo se ejecuta el handler, nunca el modelo.

Modos:

- por defecto, contra el backend real de ``IA_SERVICE_BACKEND_URL``;
- ``--simular``, con la capa HTTP simulada (``httpx.MockTransport``) que replica
  las respuestas reales de ``backend/app.py``. Sirve cuando el backend no se puede
  levantar; en ese caso **no** es una prueba contra el backend.

Todo lo que se imprime es ASCII (la consola de desarrollo es cp1252) y los JSON
se serializan con ``ensure_ascii``.

Uso::

    .venv/bin/python scripts/verificar_herramientas.py
    .venv/bin/python scripts/verificar_herramientas.py --simular
    .venv/bin/python scripts/verificar_herramientas.py --compania 001

La compania del contexto es un argumento del guion porque el backend valida que
la compania exista; en la bateria real hay que pasar un codigo que exista.
"""
from __future__ import annotations

import argparse
import asyncio
import inspect
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

import httpx  # noqa: E402

from app import backend, config, tools  # noqa: E402

# Casos con argumentos válidos. La compania viaja en el contexto de sesion, que
# se construye en principal() con el codigo recibido en --compania.
CONTEXTO_BASE = {"companiaNombre": "DSI S.A.", "usuario": "Verificacion"}
CASOS_VALIDOS: list[tuple[str, dict]] = [
    ("buscar_cuenta", {"texto": "41"}),
    ("consultar_periodo", {}),
    ("buscar_tercero", {"texto": "Clientes"}),
    ("consultar_movimiento_mensual", {}),
    ("consultar_movimiento_mensual", {"anio": 2026, "mes": 2, "cuentaDesde": "41"}),
    ("consultar_documentos", {}),
    ("consultar_documentos", {"periodo": "2026-02"}),
    (
        "consultar_documento_detalle",
        {"documento": "1", "comprobante": "01", "tipoDocumento": "13", "fecha": "2026-02-01"},
    ),
    ("consultar_periodo_operacion", {}),
    ("consultar_parametros_operacion", {}),
    ("listar_companias", {}),
    ("consultar_comprobantes", {}),
    ("consultar_tipos_documento", {}),
    ("consultar_centros", {}),
    ("verificar_lote", {"lote": "L001"}),
    ("verificar_lote", {"lote": "ERRLOTE"}),
]

# Casos con argumentos invalidos: el handler debe rechazarlos antes de llamar.
CASOS_INVALIDOS: list[tuple[str, dict, str]] = [
    ("buscar_cuenta", {}, "falta texto"),
    ("buscar_cuenta", {"texto": ""}, "texto vacio"),
    ("buscar_tercero", {}, "falta texto"),
    ("buscar_tercero", {"texto": "x" * 61}, "texto de 61 caracteres"),
    ("buscar_tercero", {"texto": ""}, "texto vacio"),
    ("consultar_movimiento_mensual", {"anio": 1800, "mes": 5}, "anio fuera de 1900-2100"),
    ("consultar_movimiento_mensual", {"anio": 2026, "mes": 13}, "mes fuera de 1-12"),
    ("consultar_documento_detalle", {}, "falta la clave del documento"),
    (
        "consultar_documento_detalle",
        {"documento": "1", "comprobante": "01", "tipoDocumento": "13"},
        "falta la fecha",
    ),
    ("verificar_lote", {}, "falta lote"),
    ("verificar_lote", {"lote": ""}, "lote vacio"),
    ("verificar_lote", {"lote": "A" * 11}, "lote de 11 caracteres"),
    ("verificar_lote", {"lote": "*"}, "lote con comodin"),
]

# Herramientas que exigen la compania del contexto de sesion, con los argumentos
# minimos que pasan su propia validacion para llegar a ``require_company()``.
CON_COMPANIA: list[tuple[str, dict]] = [
    ("buscar_cuenta", {"texto": "41"}),
    ("consultar_periodo", {}),
    ("consultar_movimiento_mensual", {}),
    ("consultar_documentos", {}),
    (
        "consultar_documento_detalle",
        {"documento": "1", "comprobante": "01", "tipoDocumento": "13", "fecha": "2026-02-01"},
    ),
    ("consultar_periodo_operacion", {}),
    ("consultar_parametros_operacion", {}),
    ("consultar_comprobantes", {}),
    ("consultar_centros", {}),
    ("verificar_lote", {"lote": "L001"}),
]

# Herramientas que con argumentos validos siempre dejan payload para el visor.
CON_PAYLOAD = [
    "buscar_cuenta",
    "consultar_periodo",
    "buscar_tercero",
    "consultar_movimiento_mensual",
    "consultar_documentos",
    "consultar_documento_detalle",
    "consultar_periodo_operacion",
    "consultar_parametros_operacion",
    "listar_companias",
    "consultar_comprobantes",
    "consultar_tipos_documento",
    "consultar_centros",
    "verificar_lote",
]

# Contrato del visor del widget (BotPayloadTabla): el payload trae ``bloques`` y
# cada bloque es una tabla con columnas tipadas y filas indexadas por la ``key``.
TIPOS_COLUMNA = ("texto", "fecha", "moneda", "entero", "estado")
TIPOS_BLOQUE = ("tabla",)
CLAVES_BLOQUE = ("titulo", "subtitulo", "columnas", "filas")

# Marcas de que un rechazo vino de una falla de entorno (backend) y no de la
# validacion local del handler. Deben seguir el texto de ``app/backend.py``.
MARCAS_ENTORNO = (
    "no se pudo contactar",
    "la api respondio",
    "la api devolvio",
    "no respondio",
)


def ascii_seguro(texto: object) -> str:
    """Texto imprimible en la consola cp1252: se descarta lo que no sea ASCII."""
    return str(texto).encode("ascii", "replace").decode("ascii")


def recorte(dato: object, limite: int = 260) -> str:
    """JSON en una linea, acotado, para no volcar resultados enteros."""
    texto = json.dumps(dato, ensure_ascii=True)
    return texto if len(texto) <= limite else texto[:limite] + "..."


def linea(etiqueta: str, texto: str = "") -> None:
    print(f"{etiqueta:<44}{texto}".rstrip())


# ---------------------------------------------------------------------------
# Capa HTTP simulada: replica las respuestas reales del backend
# ---------------------------------------------------------------------------
def transporte_simulado() -> httpx.MockTransport:
    """Respuestas con los mismos campos que devuelve la API del backend."""

    def responder(peticion: httpx.Request) -> httpx.Response:
        ruta = peticion.url.path
        if ruta == "/api/health":
            return httpx.Response(
                200,
                json={
                    "status": "ok",
                    "store": "ads",
                    "database": "Advantage Data Server",
                    "table": "CONMAE",
                },
            )
        if ruta == "/api/periodo-operacion":
            return httpx.Response(
                200,
                json={
                    "item": {
                        "anio": 2026,
                        "mesesHabilitados": [1, 2],
                        "periodoSugerido": "2026-02",
                        "fechaSugerida": "2026-02-01",
                    },
                    "source": "CONCTR",
                },
            )
        if ruta == "/api/parametros-operacion":
            return httpx.Response(
                200,
                json={
                    "item": {
                        "codigoInterno": 27,
                        "nombreEmpresa": "DSI S.A.",
                        "nit": "800200300",
                        "direccion": "Calle 1",
                        "ciudad": "Bogota",
                        "directorioContabilidad": "CONTAB",
                        "anioOperacion": "2026",
                        "contabilidadConciliacion": "",
                        "verificaDocumentosLotes": True,
                        "tercerosDocumentosPropios": False,
                        "controlaUsuarioLotes": True,
                        "comentarioCertificado": "",
                        "periodosHabilitados": {"01": True, "02": True, "03": False},
                    },
                    "source": "CONCTR",
                },
            )
        if ruta == "/api/companias":
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "codigo": "027",
                            "nombre": "DSI S.A.",
                            "nit": "800200300",
                            "habilitada": True,
                        },
                        {
                            "codigo": "001",
                            "nombre": "Demo S.A.S.",
                            "nit": "900123456",
                            "habilitada": False,
                        },
                    ],
                    "count": 2,
                    "source": "CONEMP",
                },
            )
        if ruta == "/api/terceros":
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "nit": "800200300",
                            "digito": "1",
                            "nombre": "Clientes Varios",
                            "tipo": "Juridica",
                            "tipoDoc": "31",
                            "direccion": "Calle 1",
                            "telefono": "555",
                            "ciudad": "Bogota",
                            "estado": "Activo",
                            "motivoBloqueo": None,
                            "saldo": 0,
                            "cupo": 1000,
                            "fechaCreacion": "20260101",
                        }
                    ],
                    "page": 1,
                    "pageSize": 10,
                    "total": 1,
                    "pages": 1,
                    "source": "FADCLI",
                    "sharedAcrossCompanies": True,
                },
            )
        if ruta == "/api/comprobantes":
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "codigo": "01",
                            "nombre": "Comprobante de egreso",
                            "hist": "",
                            "historico": False,
                            "descripcionAuxiliar": "",
                        }
                    ],
                    "count": 1,
                    "source": "CONTICOM",
                    "sharedAcrossCompanies": False,
                },
            )
        if ruta == "/api/tipos-documento":
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "id": 1,
                            "codigo": "13",
                            "nombre": "Factura",
                            "modulo": 1,
                            "nombreModulo": "Contabilidad",
                            "tipo": "V",
                            "consecutivo": 10,
                            "permiteModificarConsecutivo": True,
                            "prefijo": "FV",
                            "comprobante": "01",
                        }
                    ],
                    "count": 1,
                    "source": "VISDOCUM",
                    "sharedAcrossCompanies": True,
                },
            )
        if ruta == "/api/centros":
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "codigo": "01",
                            "nombre": "Administracion",
                            "nivel": 1,
                            "padre": "",
                            "carpeta": "",
                            "tipo": 1,
                            "habilita": True,
                            "hist": "",
                            "valor": 0,
                            "porcentaje": 0,
                        }
                    ],
                    "count": 1,
                    "source": "CONCECOS",
                    "sharedAcrossCompanies": False,
                },
            )
        if ruta == "/api/cuentas":
            return httpx.Response(
                200,
                json={
                    "items": [
                        {"codigo": "1105", "nombre": "Bancos", "nivel": 4, "afectable": True},
                        {"codigo": "4105", "nombre": "Ingresos operacionales", "nivel": 4, "afectable": True},
                        {"codigo": "4135", "nombre": "Comercio al por mayor", "nivel": 4, "afectable": True},
                        {"codigo": "41", "nombre": "Ingresos", "nivel": 2, "afectable": False},
                    ],
                    "source": "CONMAE",
                },
            )
        if ruta == "/api/movimiento-mensual":
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "fecha": "2026-02-10",
                            "comprobante": "01",
                            "documento": "1",
                            "cuenta": "1105",
                            "nit": "800200300",
                            "concepto": "Venta de contado",
                            "debito": 1500.0,
                            "credito": 0.0,
                        },
                        {
                            "fecha": "2026-02-10",
                            "comprobante": "01",
                            "documento": "1",
                            "cuenta": "4135",
                            "nit": "800200300",
                            "concepto": "Venta de contado",
                            "debito": 0.0,
                            "credito": 1500.0,
                        },
                    ],
                    "page": 1,
                    "pageSize": 50,
                    "hasMore": False,
                    "periodDebit": 1500.0,
                    "periodCredit": 1500.0,
                    "periodSaldo": 0.0,
                    "source": "CONMOVI",
                },
            )
        if ruta == "/api/documentos/detalle":
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "cuenta": "1105",
                            "nombreCuenta": "Bancos",
                            "nit": "800200300",
                            "centro": "01",
                            "concepto": "Venta de contado",
                            "base": 1500.0,
                            "debito": 1500.0,
                            "credito": 0.0,
                        },
                        {
                            "cuenta": "4135",
                            "nombreCuenta": "Comercio al por mayor",
                            "nit": "800200300",
                            "centro": "01",
                            "concepto": "Venta de contado",
                            "base": 1500.0,
                            "debito": 0.0,
                            "credito": 1500.0,
                        },
                    ],
                    "source": "CONMOVI",
                },
            )
        if ruta == "/api/documentos":
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "fecha": "2026-02-10",
                            "comprobante": "01",
                            "tipoDocumento": "13",
                            "documento": "1",
                            "nit": "800200300",
                            "tercero": "Clientes Varios",
                            "detalle": "Venta de contado",
                            "valor": 1500.0,
                        }
                    ],
                    "page": 1,
                    "pageSize": 50,
                    "hasMore": False,
                    "totalDocumentos": 1,
                    "totalValor": 1500.0,
                    "source": "CONMOVI",
                },
            )
        if ruta.endswith("/verificar"):
            con_error = "ERRLOTE" in ruta
            errores = [
                {
                    "categoria": "Descuadre",
                    "lineaId": 100 + indice,
                    "documento": f"FV{indice}",
                    "mensaje": f"Inconsistencia simulada {indice}",
                }
                for indice in range(7)
            ]
            return httpx.Response(
                200,
                json={
                    "item": {
                        "lote": "ERRLOTE" if con_error else "L001",
                        "valido": not con_error,
                        "estado": "Con errores" if con_error else "Verificado",
                        "items": 12,
                        "documentos": 3,
                        "documentosDuplicados": 0,
                        "debito": 1500.0,
                        "credito": 1500.0,
                        "diferencia": 0.0,
                        "errores": errores if con_error else [],
                        "lineasConError": [100, 101],
                    }
                },
            )
        return httpx.Response(404, json={"detail": f"Ruta simulada no definida: {ruta}"})

    return httpx.MockTransport(responder)


# ---------------------------------------------------------------------------
# Comprobaciones
# ---------------------------------------------------------------------------
def verificar_coherencia() -> tuple[list[str], list[str]]:
    """Coherencia entre TOOLS y FUNCTION_MAP.

    Devuelve ``(fallos, advertencias)``. Las advertencias son inconsistencias de
    estilo que no impiden el function calling (p. ej. esquemas que no fijan
    ``additionalProperties`` en false): se reportan sin romper la ejecucion.
    """
    fallos: list[str] = []
    advertencias: list[str] = []
    nombres_tools = [entrada.get("function", {}).get("name") for entrada in tools.TOOLS]
    nombres_map = list(tools.FUNCTION_MAP)

    if len(nombres_tools) != len(nombres_map):
        fallos.append(
            f"TOOLS tiene {len(nombres_tools)} entradas y FUNCTION_MAP {len(nombres_map)}"
        )
    if len(set(nombres_tools)) != len(nombres_tools):
        fallos.append("hay nombres repetidos en TOOLS")
    faltan = sorted(set(nombres_tools) - set(nombres_map))
    sobran = sorted(set(nombres_map) - set(nombres_tools))
    if faltan:
        fallos.append(f"en TOOLS pero no en FUNCTION_MAP: {faltan}")
    if sobran:
        fallos.append(f"en FUNCTION_MAP pero no en TOOLS: {sobran}")

    for entrada in tools.TOOLS:
        if entrada.get("type") != "function":
            fallos.append("una entrada de TOOLS no es de tipo function")
            continue
        funcion = entrada.get("function") or {}
        nombre = funcion.get("name") or "(sin nombre)"
        if not (funcion.get("description") or "").strip():
            fallos.append(f"{nombre}: sin descripcion para el modelo")
        esquema = funcion.get("parameters")
        if not isinstance(esquema, dict) or esquema.get("type") != "object":
            fallos.append(f"{nombre}: el esquema de parametros no es un objeto")
            continue
        if esquema.get("additionalProperties") is not False:
            advertencias.append(f"{nombre}: el esquema no fija additionalProperties en false")
        propiedades = set(esquema.get("properties") or {})
        for requerido in esquema.get("required") or []:
            if requerido not in propiedades:
                fallos.append(f"{nombre}: '{requerido}' es obligatorio pero no esta declarado")
        handler = tools.FUNCTION_MAP.get(nombre)
        if handler is None:
            fallos.append(f"{nombre}: sin handler registrado")
        elif not inspect.iscoroutinefunction(handler):
            fallos.append(f"{nombre}: el handler no es una corrutina")

    return fallos, advertencias


def revisar_payload(ctx: dict, obligatorio: bool) -> list[str]:
    """Comprueba que el payload guardado cumple el contrato del visor del widget."""
    problemas: list[str] = []
    contenido = ctx.get("payload") or {}
    if not contenido:
        return [] if not obligatorio else ["no dejo payload"]
    if not isinstance(contenido, dict):
        return ["el payload guardado no es un diccionario"]

    bloques = contenido.get("bloques")
    if not isinstance(bloques, list) or not bloques:
        return ["el payload no trae 'bloques' como lista no vacia"]

    for indice, bloque in enumerate(bloques):
        etiqueta = f"bloque {indice}"
        if not isinstance(bloque, dict):
            problemas.append(f"{etiqueta}: no es un diccionario")
            continue
        faltan = [clave for clave in CLAVES_BLOQUE if clave not in bloque]
        if faltan:
            problemas.append(f"{etiqueta}: le faltan claves {faltan}")
        if bloque.get("tipo") not in TIPOS_BLOQUE:
            problemas.append(f"{etiqueta}: tipo de bloque inesperado {bloque.get('tipo')!r}")

        columnas = bloque.get("columnas")
        if not isinstance(columnas, list) or not columnas:
            problemas.append(f"{etiqueta}: 'columnas' no es una lista no vacia")
            continue
        claves: list[str] = []
        columna_valida = True
        for columna in columnas:
            if not isinstance(columna, dict) or "label" not in columna or not columna.get("key"):
                problemas.append(f"{etiqueta}: una columna no tiene la forma {{key, label, tipo}}")
                columna_valida = False
                break
            if columna.get("tipo") not in TIPOS_COLUMNA:
                problemas.append(
                    f"{etiqueta}: la columna '{columna.get('key')}' tiene tipo invalido "
                    f"{columna.get('tipo')!r}"
                )
                columna_valida = False
                break
            claves.append(str(columna["key"]))
        if not columna_valida:
            continue

        filas = bloque.get("filas")
        if not isinstance(filas, list):
            problemas.append(f"{etiqueta}: 'filas' no es una lista")
            continue
        for fila in filas:
            if not isinstance(fila, dict):
                problemas.append(f"{etiqueta}: una fila no es un diccionario indexado por key")
                break
            if set(fila) != set(claves):
                problemas.append(
                    f"{etiqueta}: una fila no calza con las columnas (claves {sorted(fila)})"
                )
                break

        for total in bloque.get("totales") or []:
            if (
                not isinstance(total, dict)
                or "label" not in total
                or "valor" not in total
                or total.get("tipo") not in TIPOS_COLUMNA
            ):
                problemas.append(f"{etiqueta}: un total no tiene la forma {{label, valor, tipo}}")
                break

    return problemas


async def ejecutar_casos(simulado: bool, compania: str) -> tuple[list[str], int, int]:
    """Ejecuta los casos y devuelve (fallos, ejecutados, correctos)."""
    contexto = {"compania": compania, **CONTEXTO_BASE}
    fallos: list[str] = []
    ejecutados = 0
    correctos = 0

    for nombre, argumentos in CASOS_VALIDOS:
        ctx = {"context": dict(contexto), "payload": {}}
        resultado = await tools.FUNCTION_MAP[nombre](argumentos, ctx)
        ejecutados += 1

        if not isinstance(resultado, dict) or not isinstance(resultado.get("ok"), bool):
            fallos.append(f"{nombre} (validos): no devolvio un dict con ok booleano")
            linea(f"  {nombre}", "FALLO: respuesta sin 'ok' booleano")
            continue

        if resultado["ok"]:
            problemas = revisar_payload(ctx, nombre in CON_PAYLOAD)
            if problemas:
                fallos.append(f"{nombre} (validos): payload fuera de contrato ({problemas})")
                linea(f"  {nombre}", f"FALLO payload: {problemas}")
                continue
            correctos += 1
            bloques = ctx["payload"].get("bloques") or []
            primero = bloques[0] if bloques else {}
            resumen = {
                "bloques": len(bloques),
                "titulo": primero.get("titulo"),
                "filas": len(primero.get("filas") or []),
            }
            linea(f"  {nombre}", f"ok=True  payload={recorte(resumen, 150)}")
        else:
            mensaje = str(resultado.get("mensaje") or "").strip()
            if not mensaje:
                fallos.append(f"{nombre} (validos): ok=False sin mensaje")
                linea(f"  {nombre}", "FALLO: ok=False sin mensaje")
                continue
            correctos += 1
            linea(
                f"  {nombre}",
                f"ok=False (causa informada): {ascii_seguro(mensaje)[:110]}",
            )

    for nombre, argumentos, motivo in CASOS_INVALIDOS:
        ctx = {"context": dict(contexto), "payload": {}}
        resultado = await tools.FUNCTION_MAP[nombre](argumentos, ctx)
        ejecutados += 1
        linea_caso = f"  {nombre}({recorte(argumentos, 60)})"

        if not isinstance(resultado, dict) or resultado.get("ok") is not False:
            fallos.append(f"{nombre} ({motivo}): no se rechazo el argumento invalido")
            linea(linea_caso, "FALLO: no se rechazo")
            continue
        mensaje = str(resultado.get("mensaje") or "").strip()
        if not mensaje:
            fallos.append(f"{nombre} ({motivo}): rechazo sin mensaje")
            linea(linea_caso, "FALLO: rechazo sin mensaje")
            continue
        if any(marca in mensaje.lower() for marca in MARCAS_ENTORNO):
            fallos.append(
                f"{nombre} ({motivo}): el rechazo vino del backend, no de la validacion"
            )
            linea(linea_caso, f"FALLO: rechazo de entorno: {ascii_seguro(mensaje)[:80]}")
            continue
        correctos += 1
        linea(linea_caso, f"rechazado: {ascii_seguro(mensaje)[:90]}")

    for nombre, argumentos in CON_COMPANIA:
        ctx = {"context": {}, "payload": {}}
        resultado = await tools.FUNCTION_MAP[nombre](argumentos, ctx)
        ejecutados += 1
        mensaje = str(resultado.get("mensaje") or "")
        if resultado.get("ok") is not False or "compa" not in mensaje.lower():
            fallos.append(f"{nombre} (sin compania): no pide la compania al usuario")
            linea(f"  {nombre} sin compania", "FALLO")
            continue
        correctos += 1
        linea(
            f"  {nombre} sin compania",
            f"rechazado pidiendo la compania: {ascii_seguro(mensaje)[:80]}",
        )

    if simulado:
        ctx = {"context": dict(contexto), "payload": {}}
        resultado = await tools.FUNCTION_MAP["verificar_lote"]({"lote": "ERRLOTE"}, ctx)
        ejecutados += 1
        bloques = ctx["payload"].get("bloques") or []
        filas = len(bloques[0].get("filas") or []) if bloques else 0
        if (
            resultado.get("ok") is True
            and resultado.get("erroresTruncados") is True
            and resultado.get("erroresTotales") == 7
            and len(resultado.get("errores") or []) == tools.TOPE_ERRORES_TABLA
            and filas == tools.TOPE_ERRORES_TABLA
        ):
            correctos += 1
            linea(
                "  verificar_lote con 7 errores",
                f"resumen y payload truncados a {tools.TOPE_ERRORES_TABLA} de 7",
            )
        else:
            fallos.append("verificar_lote con errores: no se trunco el resumen ni el payload")
            linea("  verificar_lote con 7 errores", "FALLO")

    return fallos, ejecutados, correctos


async def principal() -> int:
    parser = argparse.ArgumentParser(
        description="Verifica la fase 0 del asistente (sin modelo)."
    )
    parser.add_argument(
        "--simular",
        action="store_true",
        help="usa la capa HTTP simulada en vez del backend real",
    )
    parser.add_argument(
        "--compania",
        default="027",
        help="codigo de compania que se pone en el contexto de sesion (3 digitos)",
    )
    opciones = parser.parse_args()
    compania = opciones.compania.strip()

    modo = (
        "SIMULADA (httpx.MockTransport)"
        if opciones.simular
        else f"REAL contra {config.BACKEND_API_URL}"
    )
    linea("modo de la prueba", modo)
    linea("compania del contexto", compania)

    if opciones.simular:
        backend.TRANSPORT = transporte_simulado()
    else:
        estado = await backend.check_health()
        linea("backend /api/health", recorte(estado, 200))
        if not estado.get("ok"):
            linea(
                "aviso",
                "el backend no respondio: los casos validos fallan con causa informada",
            )

    print()
    linea("== Coherencia TOOLS / FUNCTION_MAP ==")
    fallos_coherencia, advertencias_coherencia = verificar_coherencia()
    linea("herramientas en TOOLS", str(len(tools.TOOLS)))
    linea("handlers en FUNCTION_MAP", str(len(tools.FUNCTION_MAP)))
    linea("nombres", ", ".join(sorted(tools.FUNCTION_MAP)))
    for advertencia in advertencias_coherencia:
        linea("  AVISO", ascii_seguro(advertencia))
    if fallos_coherencia:
        for fallo in fallos_coherencia:
            linea("  FALLO", ascii_seguro(fallo))
    else:
        linea(
            "resultado",
            "coherentes: mismo numero, mismos nombres, esquemas y handlers",
        )

    print()
    linea("== Handlers (sin modelo) ==")
    fallos_casos, ejecutados, correctos = await ejecutar_casos(opciones.simular, compania)

    print()
    linea("== Resultado ==")
    linea("casos ejecutados", str(ejecutados))
    linea("casos correctos", str(correctos))
    linea("fallos", str(len(fallos_coherencia) + len(fallos_casos)))
    for fallo in fallos_casos:
        linea("  FALLO", ascii_seguro(fallo))
    if opciones.simular:
        linea("nota", "uso la capa HTTP simulada, NO el backend real")
    else:
        linea("nota", "uso el backend real; el modo simulado es --simular")

    return 1 if (fallos_coherencia or fallos_casos) else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(principal()))
