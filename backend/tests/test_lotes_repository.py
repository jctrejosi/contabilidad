from datetime import datetime

import pytest

from backend.lotes_repository import (
    LotValidationError,
    _date_text,
    _normalize_lot,
    _normalize_lot_line,
    _state_label,
    _validate_lot_code,
)


def test_lot_dates_support_ado_and_numeric_formats() -> None:
    assert _date_text(datetime(2025, 11, 30)) == "2025-11-30"
    assert _date_text(20250102) == "2025-01-02"


def test_historical_flag_has_priority_over_state() -> None:
    assert _state_label("C", "S") == "Histórico"
    assert _state_label("C", "N") == "Contabilizado"


def test_lot_code_rejects_unsafe_text() -> None:
    with pytest.raises(ValueError, match="código del lote"):
        _validate_lot_code("X' OR 1=1")


def test_new_lot_preserves_harbour_four_character_rule() -> None:
    result = _normalize_lot(
        {"lote": "ab12", "nombre": "Ajustes", "mes": "3", "usuario": "web"},
        creating=True,
    )
    assert result == {"lote": "AB12", "nombre": "Ajustes", "mes": "03", "usuario": "WEB"}
    with pytest.raises(LotValidationError, match="exactamente 4"):
        _normalize_lot({"lote": "ABC", "nombre": "X", "mes": "01"}, creating=True)


def test_lot_line_rejects_two_sided_or_empty_amount() -> None:
    base = {
        "cuenta": "110505",
        "fecha": "2025-01-10",
        "comprobante": "01",
        "tipoDocumento": "NC",
        "documento": "1",
        "concepto": "Prueba",
    }
    with pytest.raises(LotValidationError, match="simultáneamente"):
        _normalize_lot_line({**base, "debito": 1, "credito": 1})
    with pytest.raises(LotValidationError, match="valor débito o crédito"):
        _normalize_lot_line(base)
