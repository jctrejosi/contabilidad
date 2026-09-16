from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal

import pytest

from backend.lotes_repository import (
    LotValidationError,
    _build_lot_verification,
    _date_text,
    _normalize_lot,
    _normalize_lot_line,
    _state_label,
    _validate_lot_code,
    import_lot,
    post_lot,
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


def test_verification_checks_balances_by_lot_document_and_voucher(monkeypatch) -> None:
    rows = [
        {"ID": 1, "CUENTA": "110505", "NIT": "", "DEBITO": 100, "CREDITO": 0,
         "BASE": 0, "TFASE": "", "CONCEPTO": "Prueba", "TCOMPR": "01",
         "TIPODOC": "NC", "TFECHA": 20260910, "TDOCUM": "DOC1", "TDOCUM2": ""},
        {"ID": 2, "CUENTA": "110505", "NIT": "", "DEBITO": 0, "CREDITO": 100,
         "BASE": 0, "TFASE": "", "CONCEPTO": "Prueba", "TCOMPR": "01",
         "TIPODOC": "NC", "TFECHA": 20260910, "TDOCUM": "DOC1", "TDOCUM2": ""},
    ]
    monkeypatch.setattr("backend.lotes_repository._editable_lot", lambda *_: {"MES": "09"})
    monkeypatch.setattr("backend.lotes_repository._lot_rows", lambda *_: rows)

    def fake_one(_connection, sql, _parameters):
        if "FROM CONCTR" in sql:
            return {"CTANO": 2026, "CT09": True}
        if "FROM CONMAE" in sql:
            return {"MTC": True, "MCTAPAGOS": False, "MCOSTOS": False, "MIVA_RET": "O"}
        if "FROM CONDOCUM" in sql:
            return None
        return {"CODIGO": "OK"}

    monkeypatch.setattr("backend.lotes_repository._one", fake_one)
    result, documents = _build_lot_verification(object(), 27, "TEST")
    assert result["valido"] is True
    assert result["documentos"] == 1
    assert len(documents[("DOC1", "NC", "01")]) == 2

    rows[1]["CREDITO"] = 90
    result, _ = _build_lot_verification(object(), 27, "TEST")
    categories = {issue["categoria"] for issue in result["errores"]}
    assert {"Balance del lote", "Balance por documento", "Balance por comprobante"} <= categories


def test_post_lot_dry_run_posts_documents_and_rolls_back(monkeypatch) -> None:
    class FakeConnection:
        commits = 0
        rollbacks = 0

        def BeginTrans(self):
            pass

        def CommitTrans(self):
            self.commits += 1

        def RollbackTrans(self):
            self.rollbacks += 1

    connection = FakeConnection()

    @contextmanager
    def fake_connection():
        yield connection

    lines = [
        {"id": 1, "cuenta": "110505", "nit": "", "centro": "", "debito": Decimal("100"),
         "credito": Decimal("0"), "base": Decimal("0"), "documentoAfectado": "",
         "concepto": "Prueba", "fecha": date(2026, 9, 10)},
        {"id": 2, "cuenta": "110505", "nit": "", "centro": "", "debito": Decimal("0"),
         "credito": Decimal("100"), "base": Decimal("0"), "documentoAfectado": "",
         "concepto": "Prueba", "fecha": date(2026, 9, 10)},
    ]
    verification = {"valido": True, "items": 2, "debito": 100.0, "credito": 100.0, "errores": []}
    calls: list[str] = []
    monkeypatch.setattr("backend.lotes_repository.ads_odbc_connection", fake_connection)
    monkeypatch.setattr("backend.lotes_repository._editable_lot", lambda *_: {"LOTE": "TEST"})
    monkeypatch.setattr("backend.lotes_repository._build_lot_verification", lambda *_: (verification, {("DOC1", "NC", "01"): lines}))
    monkeypatch.setattr("backend.lotes_repository._normalize_payload", lambda payload: {
        **payload, "cia": 27, "anio": 2026, "mes": 9, "totalDebito": Decimal("100"),
        "totalCredito": Decimal("100"),
    })
    monkeypatch.setattr("backend.lotes_repository._validate_company_and_period", lambda *_: None)
    monkeypatch.setattr("backend.lotes_repository._validate_masters", lambda _c, data: ({}, data["lineas"]))
    monkeypatch.setattr("backend.lotes_repository._assert_document_is_new", lambda *_: None)
    monkeypatch.setattr("backend.lotes_repository._insert_movement", lambda *_: calls.append("movimiento"))
    monkeypatch.setattr("backend.lotes_repository._update_cost_center", lambda *_: None)
    monkeypatch.setattr("backend.lotes_repository._update_third_party_balances", lambda *_: None)
    monkeypatch.setattr("backend.lotes_repository._update_account_balances", lambda *_: None)
    monkeypatch.setattr("backend.lotes_repository._insert_header", lambda *_: calls.append("cabecera"))
    monkeypatch.setattr("backend.lotes_repository._execute", lambda *_: calls.append("eliminar staging"))

    result = post_lot("27", "TEST", user="WEB", dry_run=True)
    assert result["documentos"] == 1
    assert calls.count("movimiento") == 2
    assert calls.count("cabecera") == 1
    assert connection.rollbacks == 1
    assert connection.commits == 0


def test_import_lot_creates_draft_without_running_accounting_verification(monkeypatch) -> None:
    class FakeConnection:
        commits = 0
        rollbacks = 0

        def BeginTrans(self):
            pass

        def CommitTrans(self):
            self.commits += 1

        def RollbackTrans(self):
            self.rollbacks += 1

    connection = FakeConnection()

    @contextmanager
    def fake_connection():
        yield connection

    payload = {
        "lote": "IMP1",
        "nombre": "Importación de prueba",
        "mes": "09",
        "usuario": "WEB",
        "lineas": [
            {
                "cuenta": "999999",
                "fecha": "2026-09-10",
                "comprobante": "XX",
                "tipoDocumento": "XX",
                "documento": "DOC1",
                "concepto": "Pendiente de verificar",
                "debito": 100,
                "credito": 0,
            },
            {
                "cuenta": "999998",
                "fecha": "2026-09-10",
                "comprobante": "XX",
                "tipoDocumento": "XX",
                "documento": "DOC1",
                "concepto": "Pendiente de verificar",
                "debito": 0,
                "credito": 90,
            },
        ],
    }

    monkeypatch.setattr("backend.lotes_repository.ads_odbc_connection", fake_connection)
    monkeypatch.setattr("backend.lotes_repository._company_exists", lambda *_: True)
    monkeypatch.setattr("backend.lotes_repository._one", lambda *_: None)
    monkeypatch.setattr(
        "backend.lotes_repository._next_id",
        lambda _connection, table: 10 if table == "CONMOVI" else 100,
    )
    monkeypatch.setattr("backend.lotes_repository._execute", lambda *_: None)
    monkeypatch.setattr("backend.lotes_repository._refresh_lot_totals", lambda *_: None)

    def unexpected_verification(*_args):
        pytest.fail("La creación del borrador no debe ejecutar la verificación contable")

    monkeypatch.setattr("backend.lotes_repository._build_lot_verification", unexpected_verification)

    result = import_lot("27", payload, dry_run=False)

    assert result["creado"] is True
    assert result["estado"] == "Borrador"
    assert result["valido"] is False
    assert result["items"] == 2
    assert result["diferencia"] == 10.0
    assert connection.commits == 1
    assert connection.rollbacks == 0
