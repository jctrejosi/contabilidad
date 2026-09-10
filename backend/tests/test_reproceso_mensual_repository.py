from decimal import Decimal

from backend.reproceso_mensual_repository import (
    AccountMaster,
    MovementAggregate,
    _build_expected_values,
)


def account(code: str, *, third: bool = False) -> AccountMaster:
    return AccountMaster(code, code, third, False, {})


def test_accumulates_debit_and_negative_credit_in_every_existing_level() -> None:
    accounts = {code: account(code) for code in ("1", "11", "1105", "110505", "110505001", "110505001001")}
    aggregates = [
        MovementAggregate(9, "110505001001", "", Decimal("100"), Decimal("-25"), 2),
    ]

    values, thirds, warnings, errors = _build_expected_values(accounts, aggregates)

    assert values[(9, "1")] == [Decimal("100"), Decimal("-25")]
    assert values[(9, "110505001001")] == [Decimal("100"), Decimal("-25")]
    assert thirds == {}
    assert warnings == []
    assert errors == []


def test_moves_third_party_auxiliary_to_conterce_only() -> None:
    accounts = {code: account(code, third=code == "130505") for code in ("1", "13", "1305", "130505")}
    aggregates = [
        MovementAggregate(3, "130505", "900123456", Decimal("50"), Decimal("0"), 1),
    ]

    values, thirds, _, errors = _build_expected_values(accounts, aggregates)

    assert values[(3, "130505")] == [Decimal("50"), Decimal("0")]
    assert thirds[(3, "130505", "900123456")] == [Decimal("50"), Decimal("0")]
    assert all(len(key) == 2 for key in values)
    assert errors == []


def test_blocks_missing_account_and_invalid_required_nit() -> None:
    accounts = {"1": account("1"), "13": account("13"), "1305": account("1305"), "130505": account("130505", third=True)}
    aggregates = [
        MovementAggregate(1, "130505", "", Decimal("1"), Decimal("0"), 1),
        MovementAggregate(1, "999999", "1", Decimal("1"), Decimal("0"), 1),
    ]

    _, _, _, errors = _build_expected_values(accounts, aggregates)

    assert any("NIT vacío" in error for error in errors)
    assert any("no existe en CONMAE" in error for error in errors)
