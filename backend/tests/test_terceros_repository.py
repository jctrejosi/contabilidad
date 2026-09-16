import pytest

from backend.terceros_repository import (
    ThirdPartyValidationError,
    _date_yyyymmdd,
    _like_literal,
    _third_party_from_row,
    calculate_verification_digit,
    normalize_third_party,
)


def test_maps_fadcli_to_web_contract() -> None:
    result = _third_party_from_row(
        {
            "CCODIGO": "900123456 ",
            "CDIGITO": "7",
            "CTIPOCLI": 2,
            "CTIPDOC": "31",
            "CNOMBRE": "EMPRESA PRUEBA                 ",
            "CDIREC": "CALLE 1       ",
            "CTELEF": "6061234567 ",
            "CCIUDAD": "MANIZALES   ",
            "CESTADO": 1,
            "CMOTIVO": "",
            "CSALDO": 1250.5,
            "CCUPO": 5000,
            "CFCHCREA": 20260903,
        }
    )

    assert result["nit"] == "900123456"
    assert result["tipo"] == "Jurídica"
    assert result["estado"] == "Activo"
    assert result["fechaCreacion"] == "2026-09-03"


def test_maps_non_active_states_as_blocked() -> None:
    assert _third_party_from_row({"CESTADO": 4})["estado"] == "Bloqueado"


def test_formats_empty_legacy_date() -> None:
    assert _date_yyyymmdd(None) == ""
    assert _date_yyyymmdd(0) == ""


def test_escapes_like_metacharacters_and_quotes() -> None:
    assert _like_literal("O'Neil_100%[A]") == "O''Neil[_]100[%][[]A]"


def test_normalizes_clientes2_creation_fields() -> None:
    result = normalize_third_party({
        "nit": "900123456",
        "digito": "7",
        "tipoDocumento": "31",
        "nombre": "EMPRESA PRUEBA",
        "nombreComercial": "PRUEBA COMERCIAL",
        "primerNombre": "",
        "segundoNombre": "",
        "primerApellido": "",
        "segundoApellido": "",
        "direccion": "CALLE 1",
        "codigoCiudad": "17001",
        "ciudad": "MANIZALES",
        "telefono": "6061234567",
        "correo": "info@example.com",
        "zona": "01",
        "cupo": 5000,
    })
    assert result["tipoPersona"] == 2
    assert result["cupo"] == 5000
    assert result["nombreComercial"] == "PRUEBA COMERCIAL"
    assert result["digito"] == calculate_verification_digit("900123456")


def test_requires_clientes2_personal_name_fields_for_natural_person() -> None:
    base = {"nit": "123", "tipoDocumento": "13", "nombre": "ANA PEREZ"}
    with pytest.raises(ThirdPartyValidationError, match="primer nombre"):
        normalize_third_party(base)

    result = normalize_third_party({
        **base,
        "primerNombre": "ANA",
        "segundoNombre": "MARIA",
        "primerApellido": "PEREZ",
        "segundoApellido": "LOPEZ",
    })
    assert result["primerNombre"] == "ANA"
    assert result["segundoNombre"] == "MARIA"
    assert result["nombreComercial"] == "ANA PEREZ"


def test_rejects_non_numeric_or_unsupported_identification() -> None:
    with pytest.raises(ThirdPartyValidationError, match="identificación"):
        normalize_third_party({"nit": "ABC", "tipoDocumento": "13", "nombre": "Persona"})
    with pytest.raises(ThirdPartyValidationError, match="cédula o NIT"):
        normalize_third_party({"nit": "123", "tipoDocumento": "99", "nombre": "Persona"})


def test_calculates_digit_with_original_digitok_weights() -> None:
    assert calculate_verification_digit("900123456") == "8"
    assert calculate_verification_digit("123456789") == "6"


def test_rejects_invalid_email_when_supplied() -> None:
    payload = {
        "nit": "123456789",
        "tipoDocumento": "31",
        "nombre": "EMPRESA PRUEBA",
        "correo": "correo-invalido",
    }
    with pytest.raises(ThirdPartyValidationError, match="correo electrónico válido"):
        normalize_third_party(payload)
