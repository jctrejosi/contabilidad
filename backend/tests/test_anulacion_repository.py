from __future__ import annotations

import pytest

import backend.anulacion_repository as repository
from backend.anulacion_repository import (
    AnnulmentValidationError,
    _numeric_date,
    _recalculate_accounts,
)


def test_numeric_date_returns_period_and_ads_date() -> None:
    assert _numeric_date("2026-09-16") == (2026, 9, 20260916)


def test_numeric_date_rejects_invalid_value() -> None:
    with pytest.raises(AnnulmentValidationError, match="fecha"):
        _numeric_date("2026-15-40")


def test_recalculation_updates_exact_account_and_all_parents(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    totals = iter([(1.0, -1.0)] * 6)
    executed: list[tuple[str, list[tuple[int, int, object]]]] = []
    monkeypatch.setattr(repository, "_sum_movement", lambda *_args, **_kwargs: next(totals))
    monkeypatch.setattr(
        repository,
        "_execute",
        lambda _connection, sql, parameters: executed.append((sql, parameters)),
    )

    count = _recalculate_accounts(object(), 27, 2026, 9, {"110505001001"})

    assert count == 6
    assert len(executed) == 6
    assert all("MACMDEB09" in sql and "MACMCRE09" in sql for sql, _ in executed)
    assert {str(parameters[-1][2]) for _, parameters in executed} == {
        "1", "11", "1105", "110505", "110505001", "110505001001",
    }
