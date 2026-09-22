"""Casos de aceptación del bloque B1: las cuatro rutas de escritura de terceros.

Son pruebas unitarias puras, como `test_terceros_repository.py`: no levantan base
de datos. Cubren el contrato de la capa HTTP (Pydantic y registro de rutas) y los
caminos de validación/normalización de los dos motores que se resuelven **antes**
de abrir la conexión. La ejecución real de un `200`/`201` contra Advantage o
PostgreSQL requiere un motor disponible y queda fuera de esta suite.
"""

import pytest
from pydantic import ValidationError

from backend.app import (
    ThirdPartyCreditLimit,
    ThirdPartyImportRequest,
    ThirdPartyWrite,
    app,
)
from backend.postgres_writes import _actualizar_tercero, _tercero_legado_extra
from backend.terceros_repository import (
    ThirdPartyValidationError,
    _credit_limit,
    _party_code,
    _party_state_and_reason,
    _third_party_detail,
    _third_party_from_row,
    delete_third_party,
    import_third_parties,
    normalize_third_party,
    prepare_import_rows,
    update_third_party,
    update_third_party_credit_limit,
    validate_import_mapping,
)


BASE = {"tipoDocumento": "31", "nombre": "EMPRESA PRUEBA"}


def test_b1_routes_are_registered_with_the_planned_methods() -> None:
    routes = {
        (route.path, method)
        for route in app.routes
        for method in (getattr(route, "methods", None) or [])
    }
    assert ("/api/terceros/{nit}", "PUT") in routes
    assert ("/api/terceros/{nit}", "DELETE") in routes
    assert ("/api/terceros/{nit}/cupo", "PUT") in routes
    assert ("/api/terceros/importar", "POST") in routes


# ---------------------------------------------------------------------------
# B1.1 PUT /api/terceros/{nit}
# ---------------------------------------------------------------------------
def test_put_rejects_empty_body_for_missing_name() -> None:
    with pytest.raises(ValidationError) as error:
        ThirdPartyWrite()
    campos = {item["loc"][0] for item in error.value.errors()}
    assert "nombre" in campos


def test_put_rejects_the_immutable_nit_in_the_body() -> None:
    with pytest.raises(ValidationError) as error:
        ThirdPartyWrite(nit="900123456", **BASE)
    assert error.value.errors()[0]["type"] == "extra_forbidden"


def test_put_rejects_negative_credit_limit() -> None:
    with pytest.raises(ValidationError, match="greater than or equal to 0"):
        ThirdPartyWrite(cupo=-1, **BASE)


def test_put_requires_reason_when_the_state_is_blocked() -> None:
    with pytest.raises(ValidationError, match="motivo del bloqueo"):
        ThirdPartyWrite(estado="Bloqueado", **BASE)
    assert ThirdPartyWrite(estado="Bloqueado", motivoBloqueo="Mora", **BASE).estado == "Bloqueado"


def test_write_contract_keeps_the_creation_fields_and_adds_state() -> None:
    declarados = set(ThirdPartyWrite.model_fields)
    assert {"nombre", "correo", "cupo", "zona"} <= declarados
    # El NIT no forma parte del cuerpo: es la clave de la ruta.
    assert "nit" not in declarados


def test_ads_update_validates_before_opening_the_connection() -> None:
    with pytest.raises(ThirdPartyValidationError, match="primer nombre"):
        update_third_party("123", {"tipoDocumento": "13", "nombre": "Persona"})
    with pytest.raises(ThirdPartyValidationError, match="motivo del bloqueo"):
        update_third_party("123", {**BASE, "estado": "Bloqueado"})
    with pytest.raises(ThirdPartyValidationError, match="correo electrónico válido"):
        update_third_party("123", {**BASE, "correo": "correo-invalido"})


def test_ads_update_rejects_a_nit_outside_the_pattern_before_connecting() -> None:
    with pytest.raises(ThirdPartyValidationError, match="identificación"):
        update_third_party("ABC", BASE)


# ---------------------------------------------------------------------------
# B1.2 DELETE /api/terceros/{nit}
# ---------------------------------------------------------------------------
def test_delete_requires_a_reason_between_five_and_180_characters() -> None:
    with pytest.raises(ThirdPartyValidationError, match="entre 5 y 180"):
        delete_third_party("900123456", reason="ab")
    with pytest.raises(ThirdPartyValidationError, match="entre 5 y 180"):
        delete_third_party("900123456", reason="x" * 181)


def test_detail_item_adds_the_fields_the_edit_modal_needs() -> None:
    item = _third_party_detail(
        {
            "CCODIGO": "900123456",
            "CTIPOCLI": 2,
            "CTIPDOC": "31",
            "CNOMBRE": "EMPRESA PRUEBA",
            "CEMAIL": "info@example.com",
            "CZONA": "01",
            "CESTADO": 1,
            "CSALDO": 0,
            "CCUPO": 8000,
        }
    )
    assert item["correo"] == "info@example.com"
    assert item["zona"] == "01"
    # R2: las claves del directorio no cambian.
    assert item["tipoDoc"] == "31"
    assert item["tipo"] == "Jurídica"


# ---------------------------------------------------------------------------
# B1.3 PUT /api/terceros/{nit}/cupo
# ---------------------------------------------------------------------------
def test_credit_limit_model_bounds() -> None:
    assert ThirdPartyCreditLimit(cupo="8000").cupo == 8000
    assert ThirdPartyCreditLimit(cupo=0).cupo == 0
    with pytest.raises(ValidationError, match="greater than or equal to 0"):
        ThirdPartyCreditLimit(cupo=-1)
    with pytest.raises(ValidationError, match="decimal places"):
        ThirdPartyCreditLimit(cupo="1.999")
    with pytest.raises(ValidationError):
        ThirdPartyCreditLimit(cupo=1, extra="no permitido")


def test_credit_limit_service_rejects_negative_before_connecting() -> None:
    with pytest.raises(ThirdPartyValidationError, match="no puede ser negativo"):
        update_third_party_credit_limit("900123456", {"cupo": -5})


def test_credit_limit_helper_rounds_to_two_decimals() -> None:
    assert _credit_limit({"cupo": "8000.005"}) == 8000.01
    with pytest.raises(ThirdPartyValidationError, match="numérico"):
        _credit_limit({"cupo": "ocho mil"})


# ---------------------------------------------------------------------------
# B1.4 POST /api/terceros/importar
# ---------------------------------------------------------------------------
def test_import_request_requires_at_least_one_row() -> None:
    with pytest.raises(ValidationError, match="at least 1 item"):
        ThirdPartyImportRequest(archivo="a.xlsx", mapeo={"A": "nit"}, filas=[])


def test_import_request_requires_the_mapping() -> None:
    with pytest.raises(ValidationError):
        ThirdPartyImportRequest(archivo="a.xlsx", filas=[{**BASE, "nit": "900123456"}])


def test_import_mapping_must_cover_the_required_fields() -> None:
    validate_import_mapping({"COL_NIT": "nit", "COL_TIPO": "tipoDocumento", "COL_NOMBRE": "nombre"})
    with pytest.raises(ThirdPartyValidationError, match="nombre"):
        validate_import_mapping({"COL_NIT": "nit"})
    with pytest.raises(ThirdPartyValidationError, match="obligatorio"):
        validate_import_mapping({})
    with pytest.raises(ThirdPartyValidationError, match="no pertenecen al contrato"):
        validate_import_mapping({"A": "nit", "B": "tipoDocumento", "C": "nombre", "D": "inventado"})


def test_import_rejects_an_incomplete_mapping_before_connecting() -> None:
    with pytest.raises(ThirdPartyValidationError, match="tipoDocumento"):
        import_third_parties(
            {
                "archivo": "terceros.xlsx",
                "mapeo": {"NIT": "nit"},
                "filas": [{**BASE, "nit": "900123456"}],
            }
        )


def test_import_prepares_rows_and_reports_the_failing_line() -> None:
    filas = [
        {**BASE, "nit": "900123456", "ciudad": "Medellin"},
        {**BASE, "nit": "ABC"},  # identificación inválida
        {**BASE, "nit": "900123456"},  # repetida dentro del archivo
        {"tipoDocumento": "13", "nit": "123", "nombre": "ANA PEREZ"},  # falta el apellido
    ]
    validas, errores = prepare_import_rows(filas)
    assert [numero for numero, _ in validas] == [1]
    assert [error["fila"] for error in errores] == [2, 3, 4]
    assert "NIT duplicado 900123456" == errores[1]["detalle"]
    assert "obligatorio para una persona natural" in errores[2]["detalle"]


def test_import_marks_the_state_of_every_valid_row() -> None:
    validas, errores = prepare_import_rows(
        [{"tipoDocumento": "31", "nombre": "E", "nit": "1", "estado": "Bloqueado", "motivoBloqueo": "Mora"}]
    )
    assert errores == []
    assert validas[0][1]["estado"] == "Bloqueado"
    assert validas[0][1]["motivoBloqueo"] == "Mora"


def test_import_rejects_an_empty_file_before_connecting() -> None:
    with pytest.raises(ThirdPartyValidationError, match="al menos una fila"):
        prepare_import_rows([])


# ---------------------------------------------------------------------------
# Reglas compartidas (H18, estado, jsonb legado)
# ---------------------------------------------------------------------------
def test_h18_requires_a_dot_after_the_at_sign() -> None:
    with pytest.raises(ThirdPartyValidationError, match="@ y un punto"):
        normalize_third_party({**BASE, "nit": "900123456", "correo": "info@example"})
    assert normalize_third_party(
        {**BASE, "nit": "900123456", "correo": "info@example.com"}
    )["correo"] == "info@example.com"


def test_active_state_clears_a_previous_blocking_reason() -> None:
    assert _party_state_and_reason({"estado": "Activo", "motivoBloqueo": "Mora"}) == ("Activo", "")
    assert _party_state_and_reason({**BASE, "estado": "Bloqueado", "motivoBloqueo": " Mora "}) == (
        "Bloqueado",
        "Mora",
    )
    with pytest.raises(ThirdPartyValidationError, match="Activo o Bloqueado"):
        _party_state_and_reason({"estado": "Inactivo"})
    with pytest.raises(ThirdPartyValidationError, match="máximo 30"):
        _party_state_and_reason({"estado": "Bloqueado", "motivoBloqueo": "x" * 31})


def test_party_code_accepts_only_digits() -> None:
    assert _party_code(" 900123456 ") == "900123456"
    with pytest.raises(ThirdPartyValidationError, match="identificación"):
        _party_code("900.123.456")


def test_contract_fields_without_column_go_to_the_legacy_jsonb() -> None:
    completo = {campo: "x" for campo in ThirdPartyWrite.model_fields}
    assert _tercero_legado_extra(completo) == {}
    assert _tercero_legado_extra({**completo, "campoFuturo": "dato"}) == {"campoFuturo": "dato"}


class _CursorFalso:
    """Cursor mínimo que registra la sentencia y sus parámetros."""

    def __init__(self) -> None:
        self.sql = ""
        self.parametros: list[object] = []

    def execute(self, sql: str, parametros: object = None) -> None:
        self.sql = sql
        self.parametros = list(parametros or [])


def test_update_statement_merges_the_legacy_jsonb_instead_of_replacing_it() -> None:
    cursor = _CursorFalso()
    data = normalize_third_party({"nit": "900123456", **BASE, "ciudad": "Medellin"})
    _actualizar_tercero(cursor, 7, data, "Activo", "", {**BASE, "ciudad": "Medellin"})
    assert cursor.sql.startswith("UPDATE terceros SET ")
    assert "legado" not in cursor.sql
    assert cursor.parametros[-1] == 7

    _actualizar_tercero(cursor, 7, data, "Bloqueado", "Mora", {**BASE, "campoFuturo": "dato"})
    assert "legado = coalesce(legado, '{}'::jsonb) || %s::jsonb" in cursor.sql
    assert '"campoFuturo"' in str(cursor.parametros[-2])


def test_directory_keys_are_untouched_by_this_block() -> None:
    """R2: el bloque no cambia el significado de ninguna clave existente."""
    row = _third_party_from_row({"CCODIGO": "900123456", "CNOMBRE": "EMPRESA", "CESTADO": 1})
    assert set(row) == {
        "nit", "digito", "nombre", "tipo", "tipoDoc", "direccion", "telefono",
        "ciudad", "estado", "motivoBloqueo", "saldo", "cupo", "fechaCreacion",
    }
