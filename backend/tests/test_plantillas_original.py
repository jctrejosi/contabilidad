"""Contrato de PLANTICO, sin modificar la base de datos real."""

from contextlib import nullcontext
from types import SimpleNamespace

import pytest

from backend import plantillas_original_repository as repo


def _positions() -> list[dict]:
    return [
        {"orden": i, "concepto": "", "cuentaDebito": "", "cuentaCredito": ""}
        for i in range(1, 9)
    ]


def test_mapea_ocho_posiciones_incluso_vacias() -> None:
    result = repo._map_row({"CODIGO": "FC", "NOMBRE": "FACTURA", "DEB01": "111005"})
    assert len(result["posiciones"]) == 8
    assert result["posiciones"][0]["cuentaDebito"] == "111005"
    assert result["posiciones"][0]["cuentaCredito"] == ""


@pytest.mark.parametrize("bad", [[], _positions()[:7], [{**p, "orden": 8} for p in _positions()]])
def test_rechaza_posiciones_incompletas_o_desordenadas(bad: list[dict]) -> None:
    with pytest.raises(repo.PlantillaOriginalError):
        repo.guardar_plantilla_original("027", "FC", bad)


def test_actualiza_solo_los_24_campos_de_la_plantilla(monkeypatch) -> None:
    connection = SimpleNamespace(BeginTrans=lambda: None, CommitTrans=lambda: None)
    sql_calls: list[tuple[str, list]] = []
    monkeypatch.setattr(repo, "ads_odbc_connection", lambda: nullcontext(connection))
    monkeypatch.setattr(repo, "_company_exists", lambda *_: True)
    monkeypatch.setattr(repo, "_one", lambda *_args, **_kwargs: {"CODIGO": "FC", "NOMBRE": "FACTURA"})
    monkeypatch.setattr(repo, "_execute", lambda _connection, sql, params: sql_calls.append((sql, params)))
    positions = _positions()
    positions[0]["concepto"] = "COMPRA"
    result = repo.guardar_plantilla_original("027", "FC", positions)
    sql, params = sql_calls[0]
    assert sql.startswith("UPDATE VISDOCUM SET NOM01 = ?, DEB01 = ?, CRE01 = ?")
    assert "NOM09" not in sql and "NOMBRE =" not in sql and "WHERE SUC = 1 AND CODIGO = ?" in sql
    assert len(params) == 25
    assert result["posiciones"][0]["concepto"] == "COMPRA"
