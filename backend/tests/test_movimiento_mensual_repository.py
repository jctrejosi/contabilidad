import pytest

from backend.movimiento_mensual_repository import _movement_from_row, _where_clause


def test_movement_maps_negative_value_as_credit() -> None:
    item = _movement_from_row(
        {
            "CONANO": 2025,
            "CONMES": 1,
            "CODIGO": "111005013   ",
            "NIT": "               ",
            "NITN": "860017005      ",
            "TFECHA": 20250102,
            "TCOMPR": "06    ",
            "TFASE": "ADM    ",
            "TIPODOC": "CE",
            "TDOCUM": "000098003477",
            "TVALOR": -53591814.22,
            "TBASE": 0,
            "TIVA_RET": "O",
            "TSALDO": 84183434.46,
            "TSEC": 2,
        }
    )

    assert item["periodo"] == "2025-01"
    assert item["fecha"] == "2025-01-02"
    assert item["cuenta"] == "111005013"
    assert item["nit"] == "860017005"
    assert item["centro"] == "ADM"
    assert item["debito"] == 0
    assert item["credito"] == 53591814.22


def test_where_clause_always_isolates_company_and_period() -> None:
    where = _where_clause(27, 2025, 1, account_from="11", voucher="06")
    assert "CONCIA = 27" in where
    assert "CONANO = 2025" in where
    assert "CONMES = 1" in where
    assert "CODIGO >= '11'" in where
    assert "TCOMPR = '06'" in where


def test_where_clause_rejects_unsafe_filter_text() -> None:
    with pytest.raises(ValueError, match="caracteres no válidos"):
        _where_clause(27, 2025, 1, voucher="06' OR 1=1")
