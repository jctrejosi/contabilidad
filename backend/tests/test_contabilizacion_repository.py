from datetime import date
from decimal import Decimal

import pytest

import backend.contabilizacion_repository as repository
from backend.contabilizacion_repository import (
    PostingValidationError,
    _account_prefixes,
    _normalize_payload,
)


def _payload() -> dict[str, object]:
    return {
        "cia": "027",
        "fecha": date(2025, 11, 15),
        "comprobante": "05",
        "tipoDocumento": "AN",
        "numeroDocumento": "PRUEBA-001",
        "concepto": "Prueba contable reversible",
        "usuario": "WEB",
        "lineas": [
            {"cuenta": "111005001", "debito": "100.10", "credito": 0, "base": 0},
            {"cuenta": "111005002", "debito": 0, "credito": "100.10", "base": 0},
        ],
    }


def test_normalizes_balanced_document_with_decimal_precision() -> None:
    result = _normalize_payload(_payload())

    assert result["cia"] == 27
    assert result["anio"] == 2025
    assert result["mes"] == 11
    assert result["totalDebito"] == Decimal("100.10")
    assert result["totalCredito"] == Decimal("100.10")


def test_rejects_unbalanced_document() -> None:
    payload = _payload()
    payload["lineas"][1]["credito"] = "99.99"  # type: ignore[index]

    with pytest.raises(PostingValidationError, match="descuadrado"):
        _normalize_payload(payload)


def test_rejects_line_with_debit_and_credit() -> None:
    payload = _payload()
    payload["lineas"][0]["credito"] = 10  # type: ignore[index]

    with pytest.raises(PostingValidationError, match="simultáneamente"):
        _normalize_payload(payload)


def test_account_prefixes_match_harbour_hierarchy() -> None:
    assert _account_prefixes("110505001001") == [
        "1",
        "11",
        "1105",
        "110505",
        "110505001",
        "110505001001",
    ]


def test_creates_conterce_row_for_new_account_third_party(monkeypatch: pytest.MonkeyPatch) -> None:
    executed: list[tuple[str, list[tuple[int, int, object]]]] = []
    monkeypatch.setattr(repository, "_one", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        repository,
        "_execute",
        lambda _connection, sql, parameters: executed.append((sql, parameters)),
    )

    repository._update_third_party_balances(
        object(),
        {"cia": 27, "mes": 9},
        {
            "cuenta": "130505001",
            "nit": "30285555",
            "nombreTercero": "TERCERO DE PRUEBA",
            "requiereTercero": True,
            "requiereCentro": True,
            "debito": Decimal("25.50"),
            "credito": Decimal("0"),
        },
    )

    assert len(executed) == 1
    assert "INSERT INTO CONTERCE" in executed[0][0]
    assert "MACMDEB09" in executed[0][0]
    assert executed[0][1][-1][2] == 25.5


def test_updates_conterce_credit_as_negative_value(monkeypatch: pytest.MonkeyPatch) -> None:
    executed: list[tuple[str, list[tuple[int, int, object]]]] = []
    monkeypatch.setattr(repository, "_one", lambda *_args, **_kwargs: {"ID": 1})
    monkeypatch.setattr(
        repository,
        "_execute",
        lambda _connection, sql, parameters: executed.append((sql, parameters)),
    )

    repository._update_third_party_balances(
        object(),
        {"cia": 27, "mes": 9},
        {
            "cuenta": "130505001",
            "nit": "30285555",
            "nombreTercero": "TERCERO DE PRUEBA",
            "requiereTercero": True,
            "requiereCentro": True,
            "debito": Decimal("0"),
            "credito": Decimal("13.25"),
        },
    )

    assert len(executed) == 1
    assert "UPDATE CONTERCE" in executed[0][0]
    assert "MACMCRE09" in executed[0][0]
    assert executed[0][1][0][2] == -13.25


def test_skips_conterce_when_account_does_not_require_third_party(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        repository,
        "_one",
        lambda *_args, **_kwargs: pytest.fail("CONTERCE no debe consultarse"),
    )
    monkeypatch.setattr(
        repository,
        "_execute",
        lambda *_args, **_kwargs: pytest.fail("CONTERCE no debe modificarse"),
    )

    repository._update_third_party_balances(
        object(),
        {"cia": 27, "mes": 9},
        {"requiereTercero": False},
    )
