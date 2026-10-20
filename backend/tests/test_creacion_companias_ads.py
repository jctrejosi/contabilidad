"""Alta de compañías en tablas compartidas, sin escrituras reales en ADS."""

from contextlib import nullcontext
from types import SimpleNamespace

import pytest

from backend import companias_repository as repo


def _payload() -> dict:
    return {"codigo": "102", "nombre": "NUEVA COMPAÑÍA", "nit": "900123456", "clave": "12345", "anio": 2026, "habilitada": True}


def test_creacion_escribe_solo_conemp(monkeypatch) -> None:
    connection = SimpleNamespace(BeginTrans=lambda: None, CommitTrans=lambda: None)
    operations: list[tuple[str, list]] = []
    monkeypatch.setattr(repo, "ads_odbc_connection", lambda: nullcontext(connection))
    def one(_connection, sql, _params):
        return {"TOTAL": 1, "ANIO": 2026} if "CONCTR" in sql else None
    monkeypatch.setattr(repo, "_one", one)
    monkeypatch.setattr(repo, "_execute", lambda _connection, sql, params: operations.append((sql, params)))

    result = repo.create_company(_payload())
    assert result["codigo"] == "102" and result["habilitada"] is True
    assert len(operations) == 1
    sql, params = operations[0]
    assert sql.startswith("INSERT INTO CONEMP")
    assert "CONCTR" not in sql and "EMPCLAV" in sql
    assert params[0][2] == "102" and params[3][2] == "12345"


def test_rechaza_anio_distinto_al_control_compartido(monkeypatch) -> None:
    connection = SimpleNamespace()
    monkeypatch.setattr(repo, "ads_odbc_connection", lambda: nullcontext(connection))
    monkeypatch.setattr(repo, "_one", lambda _connection, sql, _params: {"TOTAL": 1, "ANIO": 2025} if "CONCTR" in sql else None)
    with pytest.raises(repo.CompanyValidationError, match="año operativo compartido"):
        repo.create_company(_payload())


def test_clave_es_obligatoria_y_no_sale_en_respuesta() -> None:
    with pytest.raises(repo.CompanyValidationError, match="clave"):
        repo.create_company({**_payload(), "clave": ""})
