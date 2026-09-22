"""Consolidación (bloque D3): contrato compartido y rama Advantage.

**Doble motor declarado (R10).** Las cinco rutas del bloque tienen el mismo
contrato JSON en los dos motores. Este módulo concentra:

- el contrato puro que comparten las ramas (``normalize_*`` y el cálculo de la
  simulación, ``calcular_simulacion``), de modo que el resultado no pueda
  divergir entre motores;
- la rama **Advantage**, que en este bloque es una **declaración de alcance**:
  ``CONSOLID`` tiene cuatro columnas físicas (``CODIGO``, ``NOMBRE``, ``HIST``,
  ``VALOR``; ``db/old_db/DICCIONARIO_DEPURADO_CONTABDSI.md`` L3233-3238) y
  ninguna identifica el año, el estado ni los orígenes, y la matriz declara que
  falta "persistir correspondencias de cuentas/centros y procedencia de cada
  resultado" (``db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`` L57, P27). Sin esas
  columnas la cabecera no se puede listar y las homologaciones no tienen dónde
  persistirse; la rama heredada lo **declara** (503) en vez de inventar columnas
  o de devolver una lista vacía que oculte los datos.

La rama de PostgreSQL vive en :mod:`backend.postgres_repository` (lecturas) y
:mod:`backend.postgres_writes` (escrituras); el despacho por operación está en
:mod:`backend.store` (R1).

**Alcance declarado de la ejecución.** El algoritmo de consolidación está
pendiente de decisión junto con el de cierre
(``db/migration/03_plan_de_carga.md`` L156-162). Esta ruta queda especificada y
``POST /api/consolidaciones/{id}/ejecutar`` devuelve 503 con el mensaje de la
decisión pendiente; no se presenta una simulación como ejecución (§2.5).
"""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

# ---------------------------------------------------------------------------
# Constantes de contrato (R6: los códigos se validan con patrón)
# ---------------------------------------------------------------------------
COMPANY_CODE = re.compile(r"^[0-9]{1,3}$")
ACCOUNT_CODE = re.compile(r"^[0-9]{1,12}$")
CENTER_CODE = re.compile(r"^[A-Za-z0-9]{1,7}$")

MIN_REASON = 5
MAX_REASON = 180
MAX_USER = 4

# ---------------------------------------------------------------------------
# Mensajes declarados de la rama heredada y de la decisión pendiente
# ---------------------------------------------------------------------------
LEGACY_LIST_MESSAGE = (
    "CONSOLID solo tiene cuatro columnas (CODIGO/NOMBRE/HIST/VALOR) y ninguna "
    "identifica año, estado ni orígenes, así que la lista de consolidaciones del "
    "año no tiene representación en Advantage "
    "(db/old_db/DICCIONARIO_DEPURADO_CONTABDSI.md L3233-3238). Solo está "
    "implementada con PostgreSQL."
)
LEGACY_HOMOLOGACION_MESSAGE = (
    "CONSOLID guarda la cabecera y los orígenes, pero en Advantage no existe "
    "dónde persistir las correspondencias de cuentas y centros: la brecha está "
    "declarada en db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md (CONSOLID, P27). La "
    "configuración, el detalle y la simulación solo están implementados con "
    "PostgreSQL."
)
LEGACY_EXECUTION_MESSAGE = (
    "La consolidación en Advantage requiere la tabla nueva de homologaciones "
    "(db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md, CONSOLID/P27) y, además, el "
    "algoritmo está pendiente de decisión (db/migration/03_plan_de_carga.md "
    "L156-162)."
)
EXECUTION_PENDING_MESSAGE = (
    "El algoritmo de consolidación está declarado pendiente: B13 (cierres y "
    "consolidaciones) quedó sin algoritmos en funciones.sql "
    "(db/migration/03_plan_de_carga.md L156-162; decisión en "
    "db/migration/homologacion/PENDIENTES.md). La ejecución se habilitará cuando "
    "se decida ese algoritmo; mientras tanto esta ruta responde 503 y no "
    "presenta la simulación como ejecución."
)


# ---------------------------------------------------------------------------
# Excepciones de dominio (R5)
# ---------------------------------------------------------------------------
class ConsolidacionNotFound(RuntimeError):
    """No existe la consolidación pedida para la compañía destino."""


class ConsolidacionConflict(RuntimeError):
    """La consolidación choca con su estado o con otra consolidación del año."""


class ConsolidacionValidationError(ValueError):
    """La configuración incumple las reglas del modelo de consolidación."""


class ConsolidacionLegacyNotSupported(RuntimeError):
    """La operación no tiene representación honesta en el legado (R10)."""


class ConsolidacionPendiente(RuntimeError):
    """La operación está especificada pero su algoritmo no se ha decidido (503)."""


# ---------------------------------------------------------------------------
# Helpers puros de contrato
# ---------------------------------------------------------------------------
def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _company(value: Any, campo: str) -> str:
    code = _text(value)
    if not COMPANY_CODE.fullmatch(code):
        raise ConsolidacionValidationError(
            f"El código de compañía de {campo} debe tener entre 1 y 3 dígitos."
        )
    return code


def _account(value: Any, campo: str) -> str:
    code = _text(value)
    if not ACCOUNT_CODE.fullmatch(code):
        raise ConsolidacionValidationError(f"La cuenta {campo} debe tener entre 1 y 12 dígitos.")
    return code


def _center(value: Any, campo: str) -> str:
    code = _text(value)
    if not CENTER_CODE.fullmatch(code):
        raise ConsolidacionValidationError(
            f"El centro de costo {campo} admite máximo 7 letras o dígitos."
        )
    return code


def _signo(value: Any) -> int:
    try:
        signo = int(value)
    except (TypeError, ValueError) as exc:
        raise ConsolidacionValidationError("El signo de la cuenta debe ser 1 o -1.") from exc
    if signo not in (-1, 1):
        raise ConsolidacionValidationError("El signo de la cuenta debe ser 1 o -1.")
    return signo


def _reason(value: Any) -> str:
    reason = _text(value)
    if not MIN_REASON <= len(reason) <= MAX_REASON:
        raise ConsolidacionValidationError(
            f"El motivo es obligatorio entre {MIN_REASON} y {MAX_REASON} caracteres."
        )
    return reason


def _user(value: Any) -> str:
    usuario = _text(value) or "WEB"
    if len(usuario) > MAX_USER:
        raise ConsolidacionValidationError(
            f"El usuario admite máximo {MAX_USER} caracteres."
        )
    return usuario


def normalize_consolidation(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida el contrato de configuración antes de abrir la conexión (§2.2).

    Comprueba lo que no necesita el motor: el año, que haya al menos un origen,
    que no se repitan, que las homologaciones referencien orígenes declarados y
    que el signo sea 1 o -1. La existencia real de cuentas, centros y compañías
    se valida en el repositorio, con una consulta explícita.
    """
    anio_crudo = payload.get("anio")
    try:
        if anio_crudo is None:
            raise TypeError
        anio = int(anio_crudo)
    except (TypeError, ValueError) as exc:
        raise ConsolidacionValidationError("El año de la consolidación es obligatorio.") from exc
    if not 1900 <= anio <= 2999:
        raise ConsolidacionValidationError("El año de la consolidación está fuera de rango.")

    origenes_entrada = payload.get("origenes")
    if not isinstance(origenes_entrada, list) or not origenes_entrada:
        raise ConsolidacionValidationError("La consolidación requiere al menos un origen.")

    origenes: list[dict[str, Any]] = []
    vistos: set[int] = set()
    for indice, item in enumerate(origenes_entrada, 1):
        if not isinstance(item, dict):
            raise ConsolidacionValidationError(f"El origen {indice} no tiene el formato esperado.")
        code = _company(item.get("cia"), f"origen {indice}")
        numero = int(code)
        if numero in vistos:
            raise ConsolidacionValidationError(f"El origen {code} está repetido.")
        vistos.add(numero)
        origenes.append({"cia": code, "incluida": bool(item.get("incluida", True))})

    cuentas: list[dict[str, Any]] = []
    pares_vistos: set[tuple[int, str]] = set()
    for indice, item in enumerate(payload.get("cuentas") or [], 1):
        if not isinstance(item, dict):
            raise ConsolidacionValidationError(f"La homologación {indice} no tiene el formato esperado.")
        cia_origen = _company(item.get("ciaOrigen"), f"la homologación {indice}")
        if int(cia_origen) not in vistos:
            raise ConsolidacionValidationError(
                f"La homologación {indice} referencia la compañía {cia_origen}, que no está "
                "entre los orígenes declarados."
            )
        cuenta_origen = _account(item.get("cuentaOrigen"), f"de origen {indice}")
        par = (int(cia_origen), cuenta_origen)
        if par in pares_vistos:
            raise ConsolidacionValidationError(
                f"La cuenta de origen {cuenta_origen} de la compañía {cia_origen} está repetida."
            )
        pares_vistos.add(par)
        cuentas.append(
            {
                "ciaOrigen": cia_origen,
                "cuentaOrigen": cuenta_origen,
                "cuentaDestino": _account(item.get("cuentaDestino"), f"de destino {indice}"),
                "signo": _signo(item.get("signo", 1)),
            }
        )

    centros: list[dict[str, Any]] = []
    centros_vistos: set[tuple[int, str]] = set()
    for indice, item in enumerate(payload.get("centros") or [], 1):
        if not isinstance(item, dict):
            raise ConsolidacionValidationError(f"El centro {indice} no tiene el formato esperado.")
        cia_origen = _company(item.get("ciaOrigen"), f"el centro {indice}")
        if int(cia_origen) not in vistos:
            raise ConsolidacionValidationError(
                f"El centro {indice} referencia la compañía {cia_origen}, que no está "
                "entre los orígenes declarados."
            )
        centro_origen = _center(item.get("centroOrigen"), f"de origen {indice}")
        par = (int(cia_origen), centro_origen)
        if par in centros_vistos:
            raise ConsolidacionValidationError(
                f"El centro de origen {centro_origen} de la compañía {cia_origen} está repetido."
            )
        centros_vistos.add(par)
        centros.append(
            {
                "ciaOrigen": cia_origen,
                "centroOrigen": centro_origen,
                "centroDestino": _center(item.get("centroDestino"), f"de destino {indice}"),
            }
        )

    return {
        "anio": anio,
        "origenes": origenes,
        "cuentas": cuentas,
        "centros": centros,
        "usuario": _user(payload.get("usuario")),
        "motivo": _reason(payload.get("motivo")),
    }


def normalize_consolidation_action(payload: dict[str, Any]) -> dict[str, Any]:
    """Usuario y motivo de una acción de proceso (simulación, §2.4)."""
    return {"usuario": _user(payload.get("usuario")), "motivo": _reason(payload.get("motivo"))}


def normalize_consolidation_execution(payload: dict[str, Any]) -> dict[str, Any]:
    """Respaldo y confirmación de la ejecución (§2.5).

    ``respaldoRealizado`` es obligatorio y ``confirmacionVaciado`` debe ser
    verdadero: la pantalla promete que no se ejecuta sin respaldo, y el modelo
    tiene ambas columnas (``07_procesos.sql`` L77-78).
    """
    data = normalize_consolidation_action(payload)
    respaldo = bool(payload.get("respaldoRealizado", False))
    confirmacion = bool(payload.get("confirmacionVaciado", False))
    if not respaldo:
        raise ConsolidacionValidationError(
            "La ejecución exige respaldoRealizado en verdadero: no se ejecuta sin respaldo."
        )
    if not confirmacion:
        raise ConsolidacionValidationError(
            "La ejecución exige confirmacionVaciado en verdadero."
        )
    data.update({"respaldoRealizado": respaldo, "confirmacionVaciado": confirmacion})
    return data


def es_compatible(origenes: list[dict[str, Any]]) -> bool:
    """Compatibilidad de la consolidación (``compatibles`` de 2.1 y 2.3).

    Compatible ⇔ hay al menos un origen incluido y **ningún** origen incluido
    tiene cuentas con saldo sin homologar (``sinHomologar == 0``). Es la compuerta
    que exige §2.3: las cuentas sin homologar se listan y **no** se consolidan,
    así que no pueden quedar dentro de una consolidación marcada compatible. La
    compatibilidad se calcula de los datos (los mismos conteos que reporta
    ``cuentasSinHomologar``) y no del estado de la pantalla. Un origen **no
    incluido** no cuenta.
    """
    incluidas = [origen for origen in origenes if origen.get("incluida", True)]
    if not incluidas:
        return False
    return all(int(origen.get("sinHomologar", 0)) == 0 for origen in incluidas)


def _nombres_de_clase(nombres_grupo: dict[str, str], clase: str) -> str:
    """Etiqueta del grupo: el nombre de la cuenta de nivel 1 del destino."""
    return nombres_grupo.get(clase) or clase


def calcular_simulacion(
    movimientos: list[dict[str, Any]],
    homologaciones: dict[tuple[int, int], tuple[int, int, str]],
    nombres_grupo: dict[str, str],
) -> dict[str, Any]:
    """Simula la consolidación sobre los saldos ya leídos (§2.4).

    ``movimientos`` es una lista por origen con ``cia``, ``companiaId`` y sus
    cuentas ``(cuenta_id, codigo, saldo)``; ``homologaciones`` cruza
    ``(compania_origen_id, cuenta_origen_id)`` con ``(cuenta_destino_id, signo,
    codigo_destino)``. No escribe en el libro: solo arma las cifras.

    **Cálculo de la comparación (documentado).** El grupo de una cuenta es su
    clase (primer dígito) y la etiqueta es el nombre de la cuenta de nivel 1 del
    plan destino. Cada cuenta de origen con saldo suma a ``origen[clase]``; si
    está homologada, su saldo por el signo suma a ``destino[clase destino]``. Las
    cuentas sin homologar suman a ``origen`` pero no a ``destino``, así que la
    ``diferencia`` por grupo explica exactamente el total y las no homologadas
    quedan a la vista. ``cuadra`` exige que no haya cuentas sin homologar y que
    la diferencia sea cero.
    """
    origen: dict[str, float] = {}
    destino: dict[str, float] = {}
    filas = 0
    debito = Decimal("0")
    credito = Decimal("0")
    sin_homologar: list[dict[str, Any]] = []

    for origen_datos in movimientos:
        cia = _text(origen_datos.get("cia"))
        compania_id = int(origen_datos["companiaId"])
        for cuenta_id, codigo, saldo in origen_datos.get("cuentas", []):
            monto = Decimal(str(saldo or 0))
            if monto == 0:
                continue
            clase_origen = codigo[:1]
            origen[clase_origen] = origen.get(clase_origen, 0.0) + float(monto)
            par = homologaciones.get((compania_id, int(cuenta_id)))
            if par is None:
                sin_homologar.append({"cia": cia, "cuenta": codigo})
                continue
            _, signo, codigo_destino = par
            aplicado = monto * signo
            clase_destino = (codigo_destino or "0")[:1]
            destino[clase_destino] = destino.get(clase_destino, 0.0) + float(aplicado)
            filas += 1
            if aplicado > 0:
                debito += aplicado
            else:
                credito += -aplicado

    total_origen = round(sum(origen.values()), 2)
    total_destino = round(sum(destino.values()), 2)
    diferencia = round(total_destino - total_origen, 2)
    comparacion = []
    for clase in sorted(set(origen) | set(destino)):
        valor_origen = round(origen.get(clase, 0.0), 2)
        valor_destino = round(destino.get(clase, 0.0), 2)
        comparacion.append(
            {
                "grupo": _nombres_de_clase(nombres_grupo, clase),
                "origen": valor_origen,
                "destino": valor_destino,
                "diferencia": round(valor_destino - valor_origen, 2),
            }
        )
    return {
        "filas": filas,
        "debito": float(debito.quantize(Decimal("0.01"))),
        "credito": float(credito.quantize(Decimal("0.01"))),
        "origen": total_origen,
        "destino": total_destino,
        "diferencia": diferencia,
        "cuadra": not sin_homologar and abs(diferencia) < 0.005,
        "cuentasSinHomologar": len(sin_homologar),
        "comparacion": comparacion,
        "sinHomologar": sin_homologar,
    }


# ---------------------------------------------------------------------------
# Rama Advantage: declarada no soportada (R10)
# ---------------------------------------------------------------------------
def list_consolidaciones(cia: str, anio: int) -> dict[str, Any]:
    """Lista de consolidaciones del año: sin representación en CONSOLID (§2.1)."""
    raise ConsolidacionLegacyNotSupported(LEGACY_LIST_MESSAGE)


def get_consolidation(cia: str, consolidacion_id: int) -> dict[str, Any]:
    """Detalle de la consolidación: sin representación en CONSOLID (§2.3)."""
    raise ConsolidacionLegacyNotSupported(LEGACY_HOMOLOGACION_MESSAGE)


def create_consolidation(
    cia: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Configuración: las homologaciones no tienen destino en el legado (§2.2)."""
    normalize_consolidation(payload)
    raise ConsolidacionLegacyNotSupported(LEGACY_HOMOLOGACION_MESSAGE)


def simulate_consolidation(
    cia: str, consolidacion_id: int, payload: dict[str, Any],
    *, user: str = "WEB", dry_run: bool = True,
) -> dict[str, Any]:
    """Simulación: depende de las homologaciones, que no se persisten (§2.4)."""
    normalize_consolidation_action(payload)
    raise ConsolidacionLegacyNotSupported(LEGACY_HOMOLOGACION_MESSAGE)


def execute_consolidation(
    cia: str, consolidacion_id: int, payload: dict[str, Any],
    *, user: str = "WEB", dry_run: bool = False,
) -> dict[str, Any]:
    """Ejecución: declarada no soportada en Advantage (§2.5)."""
    normalize_consolidation_execution(payload)
    raise ConsolidacionLegacyNotSupported(LEGACY_EXECUTION_MESSAGE)
