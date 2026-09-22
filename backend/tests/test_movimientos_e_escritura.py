"""Casos de aceptación de los bloques E1 (reasignación de NIT) y E2 (reembolsos).

Son pruebas unitarias **puras**: no levantan base de datos ni hablan con Advantage.
Cubren, de cada bloque:

- la forma del contrato y sus validaciones antes de abrir la conexión (motivo,
  usuario, patrones de NIT, período, fecha, número, líneas);
- los normalizadores y los helpers puros (cuadre, ``totales_de_lineas``, filtro de
  alcance, ``alcance``/``estado`` como literales declarados);
- la regla de cuadre y el conteo por lado de las líneas;
- las dos ramas declaradas: la rama Advantage lanza su excepción (503) con su causa
  y la validación pura ocurre **antes** de esa declaración.

La ejecución real contra PostgreSQL (201/200, reescritura del libro, lote del
reembolso) queda fuera de esta suite: requiere un motor disponible. Por eso no se
prueban las rutas HTTP —viven en ``backend/app.py``, fuera del alcance de estos
bloques— sino la capa de repositorio que las alimenta.
"""

from __future__ import annotations

from datetime import date

import pytest

from backend import reasignacion_repository as e1
from backend import reembolsos_repository as e2
from backend import store

MOTIVO = "Reasignación autorizada por el contador"
NIT_ORIGEN = "900123456"
NIT_DESTINO = "900123457"

REASIGNACION = {
    "nitNuevo": NIT_DESTINO,
    "motivo": MOTIVO,
    "usuario": "JPG",
    "alcance": "todo",
}


def _reembolso(**over) -> dict:
    payload = {
        "numero": "RB-002",
        "fecha": "2026-02-10",
        "periodo": "02",
        "tercero": "900123456",
        "cajaMenor": "Caja general",
        "usuario": "JPG",
        "lineas": [
            {"numeroLinea": 1, "cuenta": "510506", "centro": "ADM", "concepto": "Papelería",
             "debito": 500000, "credito": 0, "documentoSoporte": "FV-1"},
            {"numeroLinea": 2, "cuenta": "110505", "centro": "", "concepto": "Caja",
             "debito": 0, "credito": 300000},
            {"numeroLinea": 3, "cuenta": "110505", "centro": "", "concepto": "Caja",
             "debito": 0, "credito": 200000},
        ],
    }
    payload.update(over)
    return payload


@pytest.fixture
def motor_ads(monkeypatch):
    """Fuerza la rama Advantage para probar la brecha declarada sin tocar la base."""

    def _falso() -> bool:
        return False

    monkeypatch.setattr(store, "is_postgres", _falso)
    return _falso


# ---------------------------------------------------------------------------
# Contratos de función y jerarquía de excepciones
# ---------------------------------------------------------------------------
def test_e1_exposes_the_exact_signatures() -> None:
    assert callable(e1.reassign_third_party)
    assert callable(e1.normalize_reassignment)
    for nombre in ("RefundNotFound", "RefundConflict", "RefundValidationError",
                   "RefundLegacyNotSupported"):
        assert issubclass(getattr(e2, nombre), Exception)


def test_e2_exposes_the_four_reimbursement_functions() -> None:
    for nombre in ("list_reimbursements", "create_reimbursement", "update_reimbursement",
                   "apply_reimbursement"):
        assert callable(getattr(e2, nombre))


def test_domain_exceptions_keep_the_expected_kind() -> None:
    # Las validaciones heredan de ValueError (la capa de servicio las mapea a 422);
    # los conflictos y lo no soportado son RuntimeError (409 y 503).
    assert issubclass(e1.ReassignmentValidationError, ValueError)
    assert issubclass(e1.ReassignmentNotFound, RuntimeError)
    assert issubclass(e1.ReassignmentConflict, RuntimeError)
    assert issubclass(e1.ReassignmentLegacyNotSupported, RuntimeError)
    assert issubclass(e2.RefundValidationError, ValueError)
    assert issubclass(e2.RefundNotFound, RuntimeError)
    assert issubclass(e2.RefundConflict, RuntimeError)
    assert issubclass(e2.RefundLegacyNotSupported, RuntimeError)


# ---------------------------------------------------------------------------
# E1 · patrones de NIT y normalizador
# ---------------------------------------------------------------------------
def test_e1_nit_pattern_is_digits_up_to_ten() -> None:
    assert e1.NIT_CODE.fullmatch("900123456")
    assert e1.NIT_CODE.fullmatch("1")
    assert e1.NIT_CODE.fullmatch("1234567890")
    assert not e1.NIT_CODE.fullmatch("12345678901")  # once dígitos
    assert not e1.NIT_CODE.fullmatch("900.123.456")  # con puntos
    assert not e1.NIT_CODE.fullmatch("90012A456")
    assert not e1.NIT_CODE.fullmatch("")


def test_e1_normalize_accepts_the_todo_scope() -> None:
    data = e1.normalize_reassignment(NIT_ORIGEN, REASIGNACION)
    assert data["nit_origen"] == NIT_ORIGEN
    assert data["nit_nuevo"] == NIT_DESTINO
    assert data["alcance"] == "todo"
    assert data["fecha"] is None
    assert data["motivo"] == MOTIVO
    assert data["usuario"] == "JPG"


def test_e1_normalize_requires_the_date_for_the_from_date_scope() -> None:
    with pytest.raises(e1.ReassignmentValidationError, match="fecha"):
        e1.normalize_reassignment(
            NIT_ORIGEN, {**REASIGNACION, "alcance": "desdeFecha"}
        )
    data = e1.normalize_reassignment(
        NIT_ORIGEN, {**REASIGNACION, "alcance": "desdeFecha", "fecha": "2026-02-01"}
    )
    assert data["alcance"] == "desdeFecha"
    assert data["fecha"] == date(2026, 2, 1)
    # Con el alcance «todo» la fecha se ignora aunque llegue.
    assert e1.normalize_reassignment(
        NIT_ORIGEN, {**REASIGNACION, "fecha": "2026-02-01"}
    )["fecha"] is None


def test_e1_normalize_rejects_the_destination_equal_to_the_origin() -> None:
    with pytest.raises(e1.ReassignmentValidationError, match="distinto"):
        e1.normalize_reassignment(NIT_ORIGEN, {**REASIGNACION, "nitNuevo": NIT_ORIGEN})


def test_e1_normalize_rejects_a_bad_nit_and_a_bad_scope() -> None:
    with pytest.raises(e1.ReassignmentValidationError):
        e1.normalize_reassignment(NIT_ORIGEN, {**REASIGNACION, "nitNuevo": "900.123"})
    with pytest.raises(e1.ReassignmentValidationError):
        e1.normalize_reassignment("NIT-no-valido", REASIGNACION)
    with pytest.raises(e1.ReassignmentValidationError, match="alcance"):
        e1.normalize_reassignment(NIT_ORIGEN, {**REASIGNACION, "alcance": "parcial"})


def test_e1_normalize_rejects_a_short_reason_and_a_long_user() -> None:
    with pytest.raises(e1.ReassignmentValidationError, match="motivo"):
        e1.normalize_reassignment(NIT_ORIGEN, {**REASIGNACION, "motivo": "abc"})
    with pytest.raises(e1.ReassignmentValidationError, match="usuario"):
        e1.normalize_reassignment(NIT_ORIGEN, {**REASIGNACION, "usuario": "JPGXY"})


# ---------------------------------------------------------------------------
# E1 · filtro de alcance por tabla
# ---------------------------------------------------------------------------
def test_e1_scope_filter_is_empty_for_the_todo_scope() -> None:
    for tabla in e1.TABLAS:
        assert e1.scope_filter(tabla, None) == ("", [])


def test_e1_scope_filter_uses_the_right_column_per_table() -> None:
    fecha = date(2026, 2, 10)
    assert e1.scope_filter("documento_lineas", fecha) == (" AND d.fecha >= %s", [fecha])
    assert e1.scope_filter("lote_lineas", fecha) == (" AND l.fecha >= %s", [fecha])
    assert e1.scope_filter("reembolsos", fecha) == (" AND r.fecha >= %s", [fecha])
    assert e1.scope_filter("saldos_cuenta_tercero", fecha) == (
        " AND (s.anio, s.periodo) >= (%s, %s)",
        [2026, "02"],
    )
    assert e1.scope_filter("acumulados_tercero", fecha) == (" AND a.anio >= %s", [2026])
    with pytest.raises(e1.ReassignmentValidationError):
        e1.scope_filter("tabla_inexistente", fecha)


def test_e1_response_lists_every_table_and_flags_the_empty_case() -> None:
    data = {"nit_origen": NIT_ORIGEN, "nit_nuevo": NIT_DESTINO}
    lleno = e1._respuesta(data, {"documento_lineas": 184, "lote_lineas": 12}, dry_run=False)
    assert lleno["source"] == "terceros"
    assert list(lleno["item"]["reescrito"]) == list(e1.TABLAS)
    assert lleno["item"]["reescrito"]["documento_lineas"] == 184
    assert lleno["item"]["reescrito"]["reembolsos"] == 0
    assert "aviso" not in lleno["item"]

    vacio = e1._respuesta(data, {}, dry_run=True)
    assert vacio["item"]["dryRun"] is True
    assert all(valor == 0 for valor in vacio["item"]["reescrito"].values())
    assert "aviso" in vacio["item"]


# ---------------------------------------------------------------------------
# E1 · rama Advantage declarada (503) y validación previa
# ---------------------------------------------------------------------------
def test_e1_ads_branch_declares_the_503_with_its_cause(motor_ads) -> None:
    with pytest.raises(e1.ReassignmentLegacyNotSupported) as error:
        e1.reassign_third_party("027", NIT_ORIGEN, REASIGNACION)
    assert "Advantage" in str(error.value)
    assert "rutina de reasignación" in str(error.value)


def test_e1_validates_before_declaring_the_ads_branch(motor_ads) -> None:
    # El destino igual al origen es 422 aunque el motor sea Advantage.
    with pytest.raises(e1.ReassignmentValidationError, match="distinto"):
        e1.reassign_third_party(
            "027", NIT_ORIGEN, {**REASIGNACION, "nitNuevo": NIT_ORIGEN}
        )


# ---------------------------------------------------------------------------
# E2 · normalizador y cuadre
# ---------------------------------------------------------------------------
def test_e2_normalize_computes_totals_and_the_square() -> None:
    data = e2.normalize_reimbursement(_reembolso())
    assert data["numero"] == "RB-002"
    assert data["fecha"] == date(2026, 2, 10)
    assert data["periodo"] == "02"
    assert data["tercero"] == "900123456"
    assert data["usuario"] == "JPG"
    assert len(data["lineas"]) == 3
    assert float(data["total_debito"]) == 500000.0
    assert float(data["total_credito"]) == 500000.0
    assert data["cuadrado"] is True


def test_e2_totales_de_lineas_reports_the_square() -> None:
    lineas = e2.normalize_reimbursement(_reembolso())["lineas"]
    assert e2.totales_de_lineas(lineas) == {
        "lineas": 3, "debito": 500000.0, "credito": 500000.0, "cuadrado": True,
    }
    descuadre = e2.totales_de_lineas(
        [{"debito": 100, "credito": 0}, {"debito": 0, "credito": 99}]
    )
    assert descuadre["cuadrado"] is False


def test_e2_normalize_rejects_an_unbalanced_or_thin_body() -> None:
    with pytest.raises(e2.RefundValidationError, match="no cuadra"):
        e2.normalize_reimbursement(
            _reembolso(lineas=[
                {"numeroLinea": 1, "cuenta": "510506", "debito": 100, "credito": 0},
                {"numeroLinea": 2, "cuenta": "110505", "debito": 0, "credito": 99},
            ])
        )
    with pytest.raises(e2.RefundValidationError, match="entre 2 y 200"):
        e2.normalize_reimbursement(_reembolso(lineas=[]))
    with pytest.raises(e2.RefundValidationError, match="entre 2 y 200"):
        e2.normalize_reimbursement(
            _reembolso(lineas=[
                {"numeroLinea": 1, "cuenta": "510506", "debito": 1, "credito": 0},
            ])
        )


def test_e2_normalize_rejects_a_line_with_both_sides_or_none() -> None:
    with pytest.raises(e2.RefundValidationError, match="a la vez"):
        e2.normalize_reimbursement(
            _reembolso(lineas=[
                {"numeroLinea": 1, "cuenta": "510506", "debito": 100, "credito": 100},
                {"numeroLinea": 2, "cuenta": "110505", "debito": 0, "credito": 0},
            ])
        )
    with pytest.raises(e2.RefundValidationError, match="débito o crédito"):
        e2.normalize_reimbursement(
            _reembolso(lineas=[
                {"numeroLinea": 1, "cuenta": "510506", "debito": 0, "credito": 0},
                {"numeroLinea": 2, "cuenta": "110505", "debito": 0, "credito": 0},
            ])
        )


def test_e2_normalize_rejects_bad_number_period_date_and_nit() -> None:
    with pytest.raises(e2.RefundValidationError, match="número"):
        e2.normalize_reimbursement(_reembolso(numero="RB-000000000000"))  # 13 caracteres
    with pytest.raises(e2.RefundValidationError, match="período"):
        e2.normalize_reimbursement(_reembolso(periodo="19"))
    with pytest.raises(e2.RefundValidationError, match="fecha"):
        e2.normalize_reimbursement(_reembolso(fecha="2026-13-40"))
    with pytest.raises(e2.RefundValidationError, match="tercero"):
        e2.normalize_reimbursement(_reembolso(tercero="NIT-900"))


def test_e2_normalize_pads_the_period_and_defaults_the_user() -> None:
    data = e2.normalize_reimbursement(_reembolso(periodo="2", usuario=""))
    assert data["periodo"] == "02"
    assert data["usuario"] == "WEB"
    assert e2._periodo_de_fecha(date(2026, 2, 10)) == "02"


# ---------------------------------------------------------------------------
# E2 · consulta de lista y acción de aplicar
# ---------------------------------------------------------------------------
def test_e2_query_validates_the_year_state_and_pagination() -> None:
    data = e2.normalize_refund_query(anio=2026, estado="Borrador", page=2, page_size=50)
    assert data == {"anio": 2026, "estado": "Borrador", "page": 2, "page_size": 50}
    assert e2.normalize_refund_query(anio=2026)["estado"] == "todos"
    with pytest.raises(e2.RefundValidationError, match="estado"):
        e2.normalize_refund_query(anio=2026, estado="Cerrado")
    with pytest.raises(e2.RefundValidationError):
        e2.normalize_refund_query(anio=1800)
    with pytest.raises(e2.RefundValidationError, match="pageSize"):
        e2.normalize_refund_query(anio=2026, page_size=201)


def test_e2_action_requires_the_reason_and_defaults_the_user() -> None:
    data = e2.normalize_refund_action({"usuario": "JPG", "motivo": MOTIVO})
    assert data == {"usuario": "JPG", "motivo": MOTIVO}
    with pytest.raises(e2.RefundValidationError, match="motivo"):
        e2.normalize_refund_action({"usuario": "JPG"})


def test_e2_update_ignores_the_number_from_the_path() -> None:
    # ``PUT`` no admite número en el cuerpo; el normalizador de actualización no lo exige.
    data = e2.normalize_refund_update(_reembolso())
    assert "numero" not in data
    assert data["cuadrado"] is True


# ---------------------------------------------------------------------------
# E2 · rama Advantage declarada (503) y validación previa
# ---------------------------------------------------------------------------
def test_e2_ads_branch_declares_the_503_with_its_cause(motor_ads) -> None:
    with pytest.raises(e2.RefundLegacyNotSupported) as error:
        e2.list_reimbursements("027", anio=2026)
    assert "CONREMAE" in str(error.value)
    assert "CONREITE" in str(error.value)

    with pytest.raises(e2.RefundLegacyNotSupported):
        e2.create_reimbursement("027", _reembolso())
    with pytest.raises(e2.RefundLegacyNotSupported):
        e2.update_reimbursement("027", "RB-002", _reembolso())
    with pytest.raises(e2.RefundLegacyNotSupported):
        e2.apply_reimbursement(
            "027", "RB-002", {"usuario": "JPG", "motivo": MOTIVO}
        )


def test_e2_validates_before_declaring_the_ads_branch(motor_ads) -> None:
    # Estado inválido y descuadre son 422 aunque el motor sea Advantage.
    with pytest.raises(e2.RefundValidationError, match="estado"):
        e2.list_reimbursements("027", anio=2026, estado="Cerrado")
    with pytest.raises(e2.RefundValidationError, match="no cuadra"):
        e2.create_reimbursement(
            "027",
            _reembolso(lineas=[
                {"numeroLinea": 1, "cuenta": "510506", "debito": 100, "credito": 0},
                {"numeroLinea": 2, "cuenta": "110505", "debito": 0, "credito": 99},
            ]),
        )
    with pytest.raises(e2.RefundValidationError, match="motivo"):
        e2.apply_reimbursement("027", "RB-002", {"usuario": "JPG"})
