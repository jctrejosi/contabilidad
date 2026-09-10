from datetime import datetime

import pytest

from backend.lotes_repository import _date_text, _state_label, _validate_lot_code


def test_lot_dates_support_ado_and_numeric_formats() -> None:
    assert _date_text(datetime(2025, 11, 30)) == "2025-11-30"
    assert _date_text(20250102) == "2025-01-02"


def test_historical_flag_has_priority_over_state() -> None:
    assert _state_label("C", "S") == "Histórico"
    assert _state_label("C", "N") == "Contabilizado"


def test_lot_code_rejects_unsafe_text() -> None:
    with pytest.raises(ValueError, match="código del lote"):
        _validate_lot_code("X' OR 1=1")
