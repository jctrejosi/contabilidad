import pytest

from backend.documentos_repository import _code, _iso_date, _numeric_date, DOCUMENT_CODE


def test_iso_date_converts_advantage_numeric_date() -> None:
    assert _iso_date(20250102) == "2025-01-02"
    assert _iso_date(None) == ""


def test_numeric_date_rejects_invalid_calendar_date() -> None:
    with pytest.raises(ValueError, match="fecha inicial no es válida"):
        _numeric_date("2025-02-30", "fecha inicial")


def test_document_filter_rejects_sql_characters() -> None:
    with pytest.raises(ValueError, match="caracteres no válidos"):
        _code("X' OR 1=1", "documento", 12, DOCUMENT_CODE)
