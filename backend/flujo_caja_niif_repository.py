"""Contratos y rama Advantage del bloque A5: flujo de caja y rubros NIIF.

**Doble motor declarado (R10).** Las cuatro rutas de configuración y los cinco
informes que alimentan comparten un contrato JSON en los dos motores. Este módulo
concentra:

- el contrato **puro** que comparten las ramas (``normalize_cash_flow_definition``,
  ``normalize_niif_classification`` y el ensamblado de los cinco informes), de modo
  que el resultado no pueda divergir entre motores;
- la rama **Advantage**, que en este bloque es una **declaración de alcance**: las
  tablas ``flujo_caja_renglones``, ``rubros_niif`` y ``rubro_niif_cuentas`` son
  nuevas y el legado no tiene contraparte (``docs/schemas/15_flujo_caja_niif.md``).
  La definición de flujo no tiene dónde guardar grupo ni signo, y los 37 campos
  NIIF de ``CONMAE`` se cerró no modelarlos en ``cuentas``
  (``db/migration/homologacion/PENDIENTES.md``). Por eso:

  - las cuatro rutas de configuración declaran la brecha con **503** (R10), igual
    que ``CONSOLID`` en el bloque D3;
  - los cinco informes declaran la **carencia** con **422** (§0 y §1 del detalle:
    ``requiere tabla nueva en ADS``), que es el mismo mensaje que ya devolvían.

La rama de PostgreSQL vive en :mod:`backend.postgres_repository` (lecturas y los
generadores) y :mod:`backend.postgres_writes` (los reemplazos en bloque); el
despacho por operación está en :mod:`backend.store` (R1).

**Diferencia declarada del ``anio``.** El contrato acepta ``anio`` (R6: el cuerpo
lo exige y el ``GET`` lo admite), pero la tabla ``flujo_caja_renglones`` del DDL
validado **no tiene columna de año**; guarda una definición vigente por compañía
(``UNIQUE (compania_id, codigo)``). El año viaja en la bitácora del reemplazo y en
la respuesta, no como filtro: no se inventa una columna que el esquema no tiene.
"""

from __future__ import annotations

import re
from typing import Any

from .balance_comprobacion_repository import _account_values

# ---------------------------------------------------------------------------
# Constantes de contrato (R6: los códigos se validan con patrón)
# ---------------------------------------------------------------------------
COMPANY_CODE = re.compile(r"^[0-9]{1,3}$")
ACCOUNT_CODE = re.compile(r"^[0-9]{1,12}$")
LINE_CODE = re.compile(r"^[A-Za-z0-9]{1,10}$")
NIIF_CODE = re.compile(r"^[A-Za-z0-9-]{1,10}$")

CASH_FLOW_GROUPS = ("Operacion", "Inversion", "Financiacion")
CASH_FLOW_SIGNS = (1, -1)
NIIF_INFORMES = ("ESFA", "ER")
NIIF_TYPES = (
    "Activo Corriente", "Activo No Corriente", "Pasivo Corriente", "Pasivo No Corriente",
    "Patrimonio", "Ingreso", "Costo", "Gasto", "Orden",
)

MIN_REASON = 5
MAX_REASON = 180
MAX_USER = 4
MAX_NAME = 60
MAX_LINES = 200
MAX_RUBROS = 200
MAX_ASSIGNMENTS = 5000
MAX_CLASSIFICATION = 30
# Las cuentas de tesorería son las del disponible del plan (clase 11 del PUC),
# que es el efectivo cuya variación explica el estado de flujo.
TREASURY_PREFIX = "11"

# Los cinco informes que alimentan las tablas nuevas. ``generador-personalizado``
# queda fuera de alcance (sección 6 del plan) y los demás siguen en Advantage.
NUEVOS_INFORME_IDS = frozenset({
    "def-cuentas-flujo", "flujo-comparativo", "acum-corriente",
    "esfa-apertura", "nic-saldos",
})

# Mensajes de carencia declarados. Son los mismos que devolvía la ruta cuando el
# dato no existía: sin definición, el informe no se presenta en blanco.
CARENCIA_MESSAGES = {
    "def-cuentas-flujo": (
        "El flujo de caja requiere la definición de cuentas del sistema original, "
        "que aún no está disponible en esta instalación."
    ),
    "flujo-comparativo": (
        "El flujo de caja requiere la definición de cuentas del sistema original, "
        "que aún no está disponible en esta instalación."
    ),
    "acum-corriente": (
        "Falta la clasificación corriente/no corriente de los auxiliares por "
        "tercero para generar este informe."
    ),
    "esfa-apertura": (
        "Los informes NIC/NIIF requieren configurar la clasificación contable y los "
        "tipos documentales antes de generarse."
    ),
    "nic-saldos": (
        "Los informes NIC/NIIF requieren configurar la clasificación contable y los "
        "tipos documentales antes de generarse."
    ),
}

LEGACY_FLOW_MESSAGE = (
    "La definición de cuentas del flujo de caja no tiene contraparte en Advantage: "
    "``flujo_caja_renglones`` es una tabla nueva y el legado no tiene dónde guardar "
    "el grupo ni el signo del renglón ni la cuenta que lo alimenta "
    "(docs/schemas/15_flujo_caja_niif.md). Solo está implementada con PostgreSQL."
)
LEGACY_NIIF_MESSAGE = (
    "La clasificación NIIF de las cuentas no tiene contraparte en Advantage: "
    "``rubros_niif`` y ``rubro_niif_cuentas`` son tablas nuevas; el legado no "
    "modela los rubros y se cerró no llevar los 37 campos NIIF de CONMAE a "
    "``cuentas`` (docs/schemas/15_flujo_caja_niif.md, "
    "db/migration/homologacion/PENDIENTES.md). Solo está implementada con PostgreSQL."
)


# ---------------------------------------------------------------------------
# Excepciones de dominio (R5)
# ---------------------------------------------------------------------------
class CashFlowValidationError(ValueError):
    """La definición del flujo incumple las reglas de ``flujo_caja_renglones``."""


class NiifValidationError(ValueError):
    """La clasificación NIIF incumple las reglas de ``rubros_niif``."""


class CashFlowConflict(RuntimeError):
    """Una cuenta aparece en dos renglones con signos distintos (409)."""


class NiifConflict(RuntimeError):
    """Una cuenta está en dos rubros del mismo informe (409)."""


class CashFlowLegacyNotSupported(RuntimeError):
    """La definición de flujo no tiene representación honesta en el legado (503)."""


class NiifLegacyNotSupported(RuntimeError):
    """La clasificación NIIF no tiene representación honesta en el legado (503)."""


# ---------------------------------------------------------------------------
# Helpers puros de contrato
# ---------------------------------------------------------------------------
def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _anio(value: Any, error: type[ValueError] = CashFlowValidationError) -> int:
    try:
        anio = int(value)
    except (TypeError, ValueError) as exc:
        raise error("El año debe ser un número de cuatro dígitos.") from exc
    if not 1900 <= anio <= 2100:
        raise error("El año debe estar entre 1900 y 2100.")
    return anio


def _signo(value: Any) -> int:
    try:
        signo = int(value)
    except (TypeError, ValueError) as exc:
        raise CashFlowValidationError("El signo del renglón debe ser 1 o -1.") from exc
    if signo not in CASH_FLOW_SIGNS:
        raise CashFlowValidationError("El signo del renglón debe ser 1 o -1.")
    return signo


def _orden(value: Any, error: type[ValueError] = CashFlowValidationError) -> int:
    try:
        orden = int(value)
    except (TypeError, ValueError) as exc:
        raise error("El orden debe ser un entero.") from exc
    if not 0 <= orden <= 9999:
        raise error("El orden debe estar entre 0 y 9999.")
    return orden


def _usuario(value: Any, error: type[ValueError] = CashFlowValidationError) -> str:
    usuario = _text(value).upper() or "WEB"
    if len(usuario) > MAX_USER:
        raise error(f"El usuario admite máximo {MAX_USER} caracteres.")
    return usuario


def _motivo(value: Any, error: type[ValueError] = CashFlowValidationError) -> str:
    motivo = _text(value)
    if not MIN_REASON <= len(motivo) <= MAX_REASON:
        raise error(
            f"El motivo es obligatorio y debe tener entre {MIN_REASON} y {MAX_REASON} caracteres."
        )
    return motivo


def normalize_clasificacion_corriente(value: Any, error: type[ValueError]) -> str | None:
    """Campo aditivo ``clasificacionCorriente`` de ``PUT /api/cuentas/{codigo}``.

    ``None`` significa "no se envía": el reemplazo conserva la clasificación que
    la cuenta ya tenía (R2). El texto libre de ``CONMAE.CTCTABASE`` se acota, pero
    no se restringe a un catálogo que el legado no declara con datos.
    """
    if value is None:
        return None
    texto = _text(value)
    if len(texto) > MAX_CLASSIFICATION:
        raise error(
            f"La clasificación corriente admite máximo {MAX_CLASSIFICATION} caracteres."
        )
    return texto


def normalize_cash_flow_definition(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida y normaliza el reemplazo completo de la definición del flujo (§2)."""
    anio = _anio(payload.get("anio"))
    renglones = payload.get("renglones")
    if not isinstance(renglones, list) or not renglones:
        raise CashFlowValidationError(
            "La definición del flujo de caja requiere al menos un renglón."
        )
    if len(renglones) > MAX_LINES:
        raise CashFlowValidationError(
            f"La definición admite máximo {MAX_LINES} renglones."
        )
    normalizados: list[dict[str, Any]] = []
    codigos: set[str] = set()
    signos_por_cuenta: dict[str, int] = {}
    for item in renglones:
        codigo = _text(item.get("codigo")).upper()
        if not LINE_CODE.fullmatch(codigo):
            raise CashFlowValidationError(
                "El código del renglón debe tener entre 1 y 10 letras o dígitos."
            )
        if codigo in codigos:
            raise CashFlowValidationError(f"El renglón {codigo} está repetido en la definición.")
        codigos.add(codigo)
        nombre = _text(item.get("nombre"))
        if not nombre:
            raise CashFlowValidationError("El nombre del renglón es obligatorio.")
        if len(nombre) > MAX_NAME:
            raise CashFlowValidationError(
                f"El nombre del renglón admite máximo {MAX_NAME} caracteres."
            )
        grupo = _text(item.get("grupo"))
        if grupo not in CASH_FLOW_GROUPS:
            raise CashFlowValidationError(
                "El grupo del renglón debe ser Operacion, Inversion o Financiacion."
            )
        cuenta = _text(item.get("cuenta"))
        if not ACCOUNT_CODE.fullmatch(cuenta) or not cuenta:
            raise CashFlowValidationError("La cuenta del renglón debe tener hasta 12 dígitos.")
        signo = _signo(item.get("signo"))
        if cuenta in signos_por_cuenta and signos_por_cuenta[cuenta] != signo:
            raise CashFlowConflict(
                f"La cuenta {cuenta} está en dos renglones con signos distintos: "
                "partiría el saldo del grupo."
            )
        signos_por_cuenta[cuenta] = signo
        normalizados.append({
            "codigo": codigo, "nombre": nombre, "grupo": grupo,
            "orden": _orden(item.get("orden")), "cuenta": cuenta, "signo": signo,
        })
    return {
        "anio": anio, "renglones": normalizados,
        "usuario": _usuario(payload.get("usuario")), "motivo": _motivo(payload.get("motivo")),
    }


def normalize_niif_classification(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida y normaliza el reemplazo completo de rubros NIIF (§4)."""
    anio = _anio(payload.get("anio"), NiifValidationError)
    rubros = payload.get("rubros")
    if not isinstance(rubros, list) or not rubros:
        raise NiifValidationError("La clasificación NIIF requiere al menos un rubro.")
    if len(rubros) > MAX_RUBROS:
        raise NiifValidationError(f"La clasificación admite máximo {MAX_RUBROS} rubros.")
    normalizados: list[dict[str, Any]] = []
    codigos: set[str] = set()
    cuenta_por_informe: dict[tuple[str, str], str] = {}
    for item in rubros:
        codigo = _text(item.get("codigo")).upper()
        if not NIIF_CODE.fullmatch(codigo):
            raise NiifValidationError(
                "El código del rubro debe tener entre 1 y 10 letras, dígitos o guiones."
            )
        if codigo in codigos:
            raise NiifValidationError(f"El rubro {codigo} está repetido en la clasificación.")
        codigos.add(codigo)
        nombre = _text(item.get("nombre"))
        if not nombre:
            raise NiifValidationError("El nombre del rubro es obligatorio.")
        if len(nombre) > MAX_NAME:
            raise NiifValidationError(
                f"El nombre del rubro admite máximo {MAX_NAME} caracteres."
            )
        informe = _text(item.get("informe")).upper()
        if informe not in NIIF_INFORMES:
            raise NiifValidationError("El informe del rubro debe ser ESFA o ER.")
        tipo = _text(item.get("tipo"))
        if tipo not in NIIF_TYPES:
            raise NiifValidationError(
                "El tipo del rubro debe ser uno de los nueve del catálogo del ESFA y "
                "del estado de resultados."
            )
        cuentas = _cuentas_del_rubro(item.get("cuentas"))
        for cuenta in cuentas:
            clave = (informe, cuenta)
            if clave in cuenta_por_informe:
                raise NiifConflict(
                    f"La cuenta {cuenta} está en dos rubros del informe {informe}: un saldo "
                    "en dos rubros del mismo informe descuadra el informe."
                )
            cuenta_por_informe[clave] = codigo
        normalizados.append({
            "codigo": codigo, "nombre": nombre, "informe": informe, "tipo": tipo,
            "orden": _orden(item.get("orden"), NiifValidationError), "cuentas": cuentas,
        })
    return {
        "anio": anio, "rubros": normalizados,
        "usuario": _usuario(payload.get("usuario"), NiifValidationError),
        "motivo": _motivo(payload.get("motivo"), NiifValidationError),
    }


def _cuentas_del_rubro(value: Any) -> list[str]:
    """Cuentas de un rubro, sin repetir dentro del mismo rubro y validadas."""
    if value is None:
        return []
    if not isinstance(value, list):
        raise NiifValidationError("Las cuentas del rubro deben venir en una lista.")
    if len(value) > MAX_ASSIGNMENTS:
        raise NiifValidationError(
            f"Un rubro admite máximo {MAX_ASSIGNMENTS} cuentas."
        )
    codigos: list[str] = []
    vistas: set[str] = set()
    for cuenta in value:
        codigo = _text(cuenta)
        if not ACCOUNT_CODE.fullmatch(codigo) or not codigo:
            raise NiifValidationError("La cuenta del rubro debe tener hasta 12 dígitos.")
        if codigo not in vistas:
            vistas.add(codigo)
            codigos.append(codigo)
    return codigos



def cuentas_tesoreria_sin_uso(plan: list[tuple[str, bool]], usadas: set[str]) -> int:
    """Cuentas de tesorería afectables del plan que no están en ningún renglón.

    ``plan`` son pares ``(codigo, afectable)``. Es el aviso de cobertura de §2: si
    hay efectivo sin renglón, el estado de flujo sale incompleto y conviene saberlo.
    """
    return sum(
        1 for codigo, afectable in plan
        if afectable and _text(codigo).startswith(TREASURY_PREFIX) and codigo not in usadas
    )


def cuentas_sin_rubro(plan: list[tuple[str, bool]], asignadas: set[str]) -> int:
    """Cuentas afectables del plan que no están en ningún rubro (aviso de §4)."""
    return sum(1 for codigo, afectable in plan if afectable and codigo not in asignadas)


# ---------------------------------------------------------------------------
# Ensamblado puro de los cinco informes (mismo contrato que ``_result``)
# ---------------------------------------------------------------------------
def _presentation_sign(codigo: str) -> int:
    """Harbour muestra positivos pasivos, patrimonio e ingresos (clases 2, 3 y 4)."""
    return -1 if codigo[:1] in {"2", "3", "4"} else 1


def _movimiento(row: dict[str, Any], month_from: int, month_to: int) -> float:
    """Variación neta de la cuenta en el rango (equivale a ``closing - opening``)."""
    opening, _debit, _credit, closing = _account_values(row, month_from, month_to)
    return round(closing - opening, 2)


def _money(value: float) -> float:
    return round(value, 2)


def build_cash_flow_report(
    report_id: str, company: dict[str, Any], year: int, month_from: int, month_to: int,
    renglones: list[dict[str, Any]], saldos: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """``def-cuentas-flujo`` y ``flujo-comparativo`` con la definición y los saldos.

    El valor de cada renglón es la variación del saldo de su cuenta en el período,
    multiplicada por el signo del renglón. El total del flujo es la variación del
    efectivo cuando la definición cubre las cuentas de tesorería.
    """
    if not renglones:
        raise ValueError(CARENCIA_MESSAGES[report_id])
    ordenados = sorted(renglones, key=lambda renglon: (renglon["grupo"], renglon["orden"], renglon["codigo"]))
    if report_id == "flujo-comparativo":
        columnas = [
            {"label": "Código", "money": False}, {"label": "Renglón", "money": False},
            {"label": "Grupo", "money": False}, {"label": "Cuenta", "money": False},
            {"label": "Primer mes", "money": True}, {"label": "Segundo mes", "money": True},
            {"label": "Variación", "money": True},
        ]
        filas: list[list[Any]] = []
        total_primero = total_segundo = 0.0
        for renglon in ordenados:
            row = saldos.get(renglon["cuenta"], {})
            primero = _money(renglon["signo"] * _movimiento(row, month_from, month_from))
            segundo = _money(renglon["signo"] * _movimiento(row, month_to, month_to))
            total_primero = _money(total_primero + primero)
            total_segundo = _money(total_segundo + segundo)
            filas.append([
                renglon["codigo"], renglon["nombre"], renglon["grupo"], renglon["cuenta"],
                primero, segundo, _money(segundo - primero),
            ])
        return {
            "id": report_id, "compania": company, "anio": year,
            "mesDesde": month_from, "mesHasta": month_to, "columnas": columnas,
            "filas": filas, "count": len(filas), "source": "flujo_caja_renglones",
            "nota": "Definición de cuentas del flujo aplicada a los dos meses elegidos.",
            "totales": ["", "TOTAL DEL FLUJO", "", "", total_primero, total_segundo,
                        _money(total_segundo - total_primero)],
        }
    columnas = [
        {"label": "Código", "money": False}, {"label": "Renglón", "money": False},
        {"label": "Grupo", "money": False}, {"label": "Cuenta", "money": False},
        {"label": "Nombre cuenta", "money": False}, {"label": "Signo", "money": False},
        {"label": "Valor", "money": True},
    ]
    filas = []
    total = 0.0
    grupos: dict[str, float] = {}
    for renglon in ordenados:
        row = saldos.get(renglon["cuenta"], {})
        valor = _money(renglon["signo"] * _movimiento(row, month_from, month_to))
        total = _money(total + valor)
        grupos[renglon["grupo"]] = _money(grupos.get(renglon["grupo"], 0.0) + valor)
        filas.append([
            renglon["codigo"], renglon["nombre"], renglon["grupo"], renglon["cuenta"],
            renglon.get("nombreCuenta", ""), renglon["signo"], valor,
        ])
    return {
        "id": report_id, "compania": company, "anio": year,
        "mesDesde": month_from, "mesHasta": month_to, "columnas": columnas,
        "filas": filas, "count": len(filas), "source": "flujo_caja_renglones",
        "nota": "Definición de cuentas del flujo de caja; los valores son los saldos de "
                "saldos_cuenta del período.",
        "totales": ["", "TOTAL DEL FLUJO", "", "", "", "", total],
        "grupos": grupos,
    }


def build_corriente_report(
    company: dict[str, Any], year: int, month_from: int, month_to: int,
    cuentas: list[dict[str, Any]], saldos: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """``acum-corriente``: los acumulados agrupados por clasificación corriente."""
    if not cuentas:
        raise ValueError(CARENCIA_MESSAGES["acum-corriente"])
    columnas = [
        {"label": "Clasificación", "money": False}, {"label": "Cuenta", "money": False},
        {"label": "Nombre", "money": False}, {"label": "Saldo inicial", "money": True},
        {"label": "Débitos", "money": True}, {"label": "Créditos", "money": True},
        {"label": "Saldo final", "money": True},
    ]
    filas: list[list[Any]] = []
    por_clasificacion: dict[str, list[float]] = {}
    for cuenta in sorted(cuentas, key=lambda item: (item["clasificacion"], item["codigo"])):
        row = saldos.get(cuenta["codigo"], {})
        opening, debit, credit, closing = _account_values(row, month_from, month_to)
        signo = _presentation_sign(cuenta["codigo"])
        apertura = _money(opening * signo)
        cierre = _money(closing * signo)
        filas.append([
            cuenta["clasificacion"], cuenta["codigo"], cuenta["nombre"],
            apertura, _money(debit), _money(credit), cierre,
        ])
        acumulado = por_clasificacion.setdefault(cuenta["clasificacion"], [0.0, 0.0, 0.0, 0.0])
        acumulado[0] = _money(acumulado[0] + apertura)
        acumulado[1] = _money(acumulado[1] + debit)
        acumulado[2] = _money(acumulado[2] + credit)
        acumulado[3] = _money(acumulado[3] + cierre)
    totales = [
        _money(sum(valores[0] for valores in por_clasificacion.values())),
        _money(sum(valores[1] for valores in por_clasificacion.values())),
        _money(sum(valores[2] for valores in por_clasificacion.values())),
        _money(sum(valores[3] for valores in por_clasificacion.values())),
    ]
    return {
        "id": "acum-corriente", "compania": company, "anio": year,
        "mesDesde": month_from, "mesHasta": month_to, "columnas": columnas,
        "filas": filas, "count": len(filas), "source": "cuentas",
        "nota": "Clasificación corriente/no corriente de cuentas.clasificacion_corriente "
                "(CONMAE.CTCTABASE).",
        "totales": ["", "", "TOTALES", totales[0], totales[1], totales[2], totales[3]],
        "clasificaciones": por_clasificacion,
    }


def build_niif_report(
    report_id: str, company: dict[str, Any], year: int, month_from: int, month_to: int,
    rubros: list[dict[str, Any]], saldos: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """``esfa-apertura`` (ESFA, apertura) y ``nic-saldos`` (ER, cierre).

    **Un rubro sin cuentas se muestra en cero**, como manda §3: no se completa con
    heurísticas por nombre de cuenta.
    """
    informe = "ESFA" if report_id == "esfa-apertura" else "ER"
    seleccion = [rubro for rubro in rubros if rubro["informe"] == informe]
    if not seleccion:
        raise ValueError(CARENCIA_MESSAGES[report_id])
    apertura = report_id == "esfa-apertura"
    columnas = [
        {"label": "Código", "money": False}, {"label": "Rubro", "money": False},
        {"label": "Tipo", "money": False}, {"label": "Cuentas", "money": False},
        {"label": "Saldo apertura" if apertura else "Saldo", "money": True},
    ]
    filas: list[list[Any]] = []
    total = 0.0
    for rubro in sorted(seleccion, key=lambda item: (item["tipo"], item["orden"], item["codigo"])):
        saldo = 0.0
        for cuenta in rubro["cuentas"]:
            row = saldos.get(cuenta, {})
            opening, _debit, _credit, closing = _account_values(row, month_from, month_to)
            base = opening if apertura else closing
            saldo = _money(saldo + base * _presentation_sign(cuenta))
        total = _money(total + saldo)
        filas.append([rubro["codigo"], rubro["nombre"], rubro["tipo"], len(rubro["cuentas"]), saldo])
    return {
        "id": report_id, "compania": company, "anio": year,
        "mesDesde": month_from, "mesHasta": month_to, "columnas": columnas,
        "filas": filas, "count": len(filas), "source": "rubros_niif",
        "nota": ("Rubros NIIF del ESFA en saldos de apertura." if apertura else
                 "Rubros NIIF del estado de resultados con los saldos del período."),
        "totales": ["", "", "TOTALES", "", total],
    }


# ---------------------------------------------------------------------------
# Rama Advantage: declarada no soportada (R10 y §0)
# ---------------------------------------------------------------------------
def list_flujo_caja_renglones(cia: str, *, anio: int | None = None) -> dict[str, Any]:
    """Definición del flujo del legado: no existe la tabla (§1)."""
    raise CashFlowLegacyNotSupported(LEGACY_FLOW_MESSAGE)


def replace_flujo_caja_renglones(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Reemplazo del flujo del legado: valida el contrato y declara la brecha (§2)."""
    normalize_cash_flow_definition(payload)
    raise CashFlowLegacyNotSupported(LEGACY_FLOW_MESSAGE)


def list_rubros_niif(
    cia: str, *, anio: int | None = None, informe: str = "todos"
) -> dict[str, Any]:
    """Rubros NIIF del legado: no existen las tablas (§3)."""
    raise NiifLegacyNotSupported(LEGACY_NIIF_MESSAGE)


def replace_rubros_niif(
    cia: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Reemplazo de rubros NIIF del legado: valida el contrato y declara la brecha (§4)."""
    normalize_niif_classification(payload)
    raise NiifLegacyNotSupported(LEGACY_NIIF_MESSAGE)


def build_additional_report(
    report_id: str, cia: str, year: int, month_from: int, month_to: int, **_filtros: Any
) -> dict[str, Any]:
    """Los cinco informes nuevos en Advantage declaran la carencia con 422 (§0).

    La carencia se declara **antes** de abrir la conexión: sin tabla en el legado,
    el 422 no puede depender de que Advantage esté disponible ni convertirse en un
    informe en blanco que parezca un resultado.
    """
    mensaje = CARENCIA_MESSAGES.get(report_id)
    if mensaje is None:
        raise ValueError(
            "Este informe no pertenece a la configuración de flujo de caja ni de rubros NIIF."
        )
    raise ValueError(mensaje)
