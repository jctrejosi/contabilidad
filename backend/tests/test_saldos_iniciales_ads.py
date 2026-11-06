"""Apertura 00: saldo firmado, período independiente de fecha e idempotencia.

Estas pruebas interceptan ADO; no escriben en el diccionario instalado.
"""
from contextlib import contextmanager
from datetime import date
from decimal import Decimal as D
from types import SimpleNamespace

import pytest

from backend import contabilizacion_repository as posting
from backend import lotes_repository as lots
from backend import reproceso_mensual_repository as reprocess
from backend import anulacion_repository as annulment


def test_opening_nets_debit_and_credit_on_accounts_parents_and_third():
    accounts = {c: reprocess.AccountMaster(c, c, c == "130505", False, {})
                for c in ("1", "13", "1305", "130505")}
    values, thirds, _, errors = reprocess._build_expected_values(accounts, [
        reprocess.MovementAggregate(0, "130505", "9001", D(100), D(-130), 2),
        reprocess.MovementAggregate(1, "130505", "9001", D(20), D(-5), 2),
    ])
    assert not errors
    assert all(values[(0, c)] == [D(-30), D(0)] for c in accounts)
    assert thirds[(0, "130505", "9001")] == [D(-30), D(0)]
    assert values[(1, "130505")] == [D(20), D(-5)]
    assert reprocess._balance_pair({"MSALDO": -30}, 0) == (D(-30), D(0))
    reprocess._validate_range(2026, 0, 12)
    with pytest.raises(ValueError):
        reprocess._validate_range(2026, -1, 0)


@pytest.mark.parametrize("debit,credit,amount", [(100, 0, 100), (0, 80, -80)])
def test_posting_writes_signed_opening_and_keeps_calendar_date(monkeypatch, debit, credit, amount):
    calls = []
    monkeypatch.setattr(posting, "_execute", lambda _, sql, params: calls.append((sql, params)))
    monkeypatch.setattr(posting, "_one", lambda *_: {"ID": 1})
    data = {"cia": 26, "anio": 2026, "mes": 0, "fecha": date(2026, 1, 1),
            "comprobante": "00", "tipoDocumento": "SI", "usuario": "TEST"}
    line = {"cuenta": "130505", "nit": "9001", "centro": "001", "debito": D(debit),
            "credito": D(credit), "requiereTercero": True, "requiereCentro": True,
            "nombreTercero": "Prueba", "documentoAfectado": "", "concepto": "Apertura",
            "base": D(0), "tipoFiscal": ""}
    posting._update_account_balances(None, data, line)
    posting._update_third_party_balances(None, data, line)
    balance_calls = list(calls)
    assert len(balance_calls) == 5
    assert all("SET MSALDO = COALESCE(MSALDO, 0) + ?" in sql for sql, _ in balance_calls)
    assert all(params[0][2] == amount and params[1][2] == 26 for _, params in balance_calls)
    posting._update_cost_center(None, data, line)
    assert ("DEB00" if debit else "CRE00") in calls[-1][0]
    posting._insert_movement(None, data, line, "SI001")
    params = calls[-1][1]
    assert params[2][2] == 0
    assert params[6][2] == 20260101


def test_lot_zero_passes_opening_period_through_all_accounting_steps(monkeypatch):
    class Connection:
        def BeginTrans(self): pass
        def CommitTrans(self): pytest.fail("Prueba sin commit")
        def RollbackTrans(self): pass
    @contextmanager
    def connection():
        yield Connection()
    monkeypatch.setattr(lots, "ads_odbc_connection", connection)
    monkeypatch.setattr(lots, "_editable_lot", lambda *_: {"MES": "00"})
    lines = [{"cuenta": "110505", "nit": "", "centro": "", "fecha": date(2026, 5, 1),
              "debito": D(100), "credito": D(0), "base": D(0),
              "documentoAfectado": "", "concepto": "Apertura"},
             {"cuenta": "310505", "nit": "", "centro": "", "fecha": date(2026, 5, 1),
              "debito": D(0), "credito": D(100), "base": D(0),
              "documentoAfectado": "", "concepto": "Apertura"}]
    monkeypatch.setattr(lots, "_build_lot_verification", lambda *_: (
        {"mes": "00", "valido": True, "items": 2, "debito": 100, "credito": 100},
        {("SI001", "SI", "00"): lines}))
    seen = []
    for name in ("_validate_company_and_period", "_insert_movement", "_update_cost_center",
                 "_update_third_party_balances", "_update_account_balances", "_insert_header"):
        monkeypatch.setattr(lots, name, lambda _, data, *args: seen.append((data["mes"], data["fecha"])))
    monkeypatch.setattr(lots, "_validate_masters", lambda _, data: ({}, data["lineas"]))
    monkeypatch.setattr(lots, "_assert_document_is_new", lambda *_: None)
    monkeypatch.setattr(lots, "_execute", lambda *_: None)
    lots.post_lot("026", "SI00", dry_run=True)
    assert seen and all(month == 0 and day == date(2026, 5, 1) for month, day in seen)


def test_reprocess_writes_one_opening_column_and_duplicate_rows_become_zero(monkeypatch):
    rows = [{"ID": 1, "CODIGO": "130505", "NIT": "9001", "MSALDO": 10},
            {"ID": 2, "CODIGO": "130505", "NIT": "9001", "MSALDO": 20}]
    expected = {(0, "130505", "9001"): [D(-30), D(0)]}
    updates = reprocess._third_row_differences(rows, {("130505", "9001"): 1}, expected, 0, 0)
    assert updates == {0: [(1, D(-30), D(0)), (2, D(0), D(0))]}
    assert not reprocess._third_row_differences(
        [{**rows[0], "MSALDO": -30}, {**rows[1], "MSALDO": 0}],
        {("130505", "9001"): 1}, expected, 0, 0)
    sqls, calls = [], []
    connection = SimpleNamespace(Execute=lambda sql: sqls.append(sql))
    plan = SimpleNamespace(company=26, month_from=0, month_to=0,
        accounts={"130505": reprocess.AccountMaster("130505", "Clientes", True, False, {0: (D(10), D(0))})},
        account_values={(0, "130505"): [D(-30), D(0)]}, third_values=expected,
        third_existing_ids={("130505", "9001"): 1}, third_names={}, third_row_updates=updates)
    monkeypatch.setattr(reprocess, "_execute", lambda _, sql, params: calls.append((sql, params)))
    reprocess._replace_balances(connection, plan)
    assert all("MSALDO" in sql and "MACM" not in sql for sql, _ in calls)
    assert len(calls[-1][1]) == 3 and calls[-1][1][0][2] == -30
    assert all("MSALDO" in sql and "MACM" not in sql and "CIA = 26" in sql for sql in sqls)


def test_new_third_opening_insert_has_only_one_amount(monkeypatch):
    calls = []
    monkeypatch.setattr(reprocess, "_execute", lambda _, sql, params: calls.append((sql, params)))
    plan = SimpleNamespace(company=26, month_from=0, month_to=1,
        third_existing_ids={}, third_values={(0, "130505", "9001"): [D(-30), D(0)],
                                            (1, "130505", "9001"): [D(20), D(-5)]},
        third_names={"9001": "Prueba"},
        accounts={"130505": SimpleNamespace(requires_cost_center=False)})
    reprocess._insert_new_thirds(None, plan)
    sql, params = calls[0]
    assert "MSALDO, MACMDEB01, MACMCRE01" in sql and "MACMDEB00" not in sql
    assert [p[2] for p in params[-3:]] == [-30, 20, -5]
    assert sql.count("?") == len(params)


def test_annulling_opening_replaces_net_not_monthly_columns(monkeypatch):
    calls = []
    monkeypatch.setattr(annulment, "_sum_movement", lambda *_: (100, -140))
    monkeypatch.setattr(annulment, "_execute", lambda _, sql, params: calls.append((sql, params)))
    annulment._recalculate_accounts(None, 26, 2026, 0, {"130505"})
    annulment._recalculate_third_parties(None, 26, 2026, 0, {("130505", "9001")})
    assert all("SET MSALDO = ?" in sql and "MACM" not in sql for sql, _ in calls)
    assert all(params[0][2] == -40 for _, params in calls)


def test_reprocess_reads_opening_fields_and_compares_without_changes(monkeypatch):
    queries = []
    def query(_, sql, params):
        queries.append(sql)
        if "FROM CONEMP" in sql:
            return [{"EMPNOM": "Prueba"}]
        if "FROM CONCTR" in sql:
            return [{"CTANO": 2026}]
        return [{"CODIGO": "130505", "MNOMBRE": "Clientes", "MCTAPAGOS": True,
                 "MSALDO": -30, "MACMDEB01": 20, "MACMCRE01": -5}]
    monkeypatch.setattr(reprocess, "_query_rows", query)
    _, accounts = reprocess._load_context(None, 26, 2026, 0, 1)
    class Recordset:
        def Close(self): pass
    monkeypatch.setattr(reprocess, "_open_recordset", lambda _, sql: (queries.append(sql) or Recordset()))
    monkeypatch.setattr(reprocess, "_rows", lambda _: iter([
        {"ID": 1, "CODIGO": "130505", "NIT": "9001", "MNOMBRE": "Prueba",
         "MSALDO": -30, "MACMDEB01": 20, "MACMCRE01": -5}]))
    expected_thirds = {(0, "130505", "9001"): [D(-30), D(0)],
                       (1, "130505", "9001"): [D(20), D(-5)]}
    current, _, _, _, _, updates = reprocess._load_third_context(None, 26, 0, 1, expected_thirds)
    expected_accounts = {(m, c): v for (m, c, _), v in expected_thirds.items()}
    assert reprocess._difference_counts(accounts, expected_accounts, current, expected_thirds, 0, 1) == (0, 0)
    assert not updates
    assert all("MACMDEB00" not in sql and "MACMCRE00" not in sql for sql in queries)
    assert "MSALDO" in queries[-1] and "CIA = 26" in queries[-1]


@pytest.mark.parametrize("enabled", [True, False])
def test_verification_checks_opening_switch_instead_of_calendar_month(monkeypatch, enabled):
    monkeypatch.setattr(lots, "_editable_lot", lambda *_: {"MES": "00"})
    rows = [{"ID": i, "CUENTA": "110505", "NIT": "", "DEBITO": deb, "CREDITO": cre,
             "BASE": 0, "TFASE": "", "CONCEPTO": "Apertura", "TCOMPR": "00",
             "TIPODOC": "SI", "TFECHA": 20260101, "TDOCUM": "SI001", "TDOCUM2": ""}
            for i, deb, cre in [(1, 100, 0), (2, 0, 100)]]
    monkeypatch.setattr(lots, "_lot_rows", lambda *_: rows)
    def one(_, sql, params):
        if "FROM CONCTR" in sql:
            return {"CTANO": 2026, "CT00": enabled, "CT01": not enabled}
        if "FROM CONMAE" in sql:
            return {"MTC": True, "MCTAPAGOS": False, "MCOSTOS": False, "MIVA_RET": "O"}
        if "FROM CONDOCUM" in sql:
            return None
        return {"CODIGO": "OK"}
    monkeypatch.setattr(lots, "_one", one)
    result, _ = lots._build_lot_verification(None, 26, "SI00")
    assert result["mes"] == "00"
    assert result["valido"] is enabled


def test_annulment_uses_stored_period_zero_not_january(monkeypatch):
    class Connection:
        def BeginTrans(self): pass
        def CommitTrans(self): pytest.fail("Prueba sin commit")
        def RollbackTrans(self): pass
    @contextmanager
    def connection():
        yield Connection()
    monkeypatch.setattr(annulment, "ads_odbc_connection", connection)
    def query(_, sql, params):
        if "SELECT DISTINCT CONMES" in sql:
            return [{"CONMES": 0}]
        assert params[2][2] == 0
        return [{"CODIGO": "110505", "NIT": "", "TFASE": "", "TVALOR": 100},
                {"CODIGO": "310505", "NIT": "", "TFASE": "", "TVALOR": -100}]
    monkeypatch.setattr(annulment, "_query_rows", query)
    def one(_, sql, params):
        if "FROM CONCTR" in sql:
            assert "CT00" in sql
            return {"CTANO": 2026, "CT00": True}
        return {"ID": 1, "EMPCOD": 26}
    monkeypatch.setattr(annulment, "_one", one)
    periods = []
    for name in ("_recalculate_accounts", "_recalculate_third_parties", "_recalculate_cost_centers"):
        monkeypatch.setattr(annulment, name, lambda _, cia, year, month, keys: (periods.append(month) or 1))
    monkeypatch.setattr(annulment, "_execute", lambda *_: None)
    annulment.annul_document("26", header_id=1, document="SI001", voucher="00",
        document_type="SI", movement_date="2026-01-01", user="TEST", reason="Prueba apertura", dry_run=True)
    assert periods == [0, 0, 0]
