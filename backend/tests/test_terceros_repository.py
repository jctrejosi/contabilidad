from backend.terceros_repository import _date_yyyymmdd, _like_literal, _third_party_from_row


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
