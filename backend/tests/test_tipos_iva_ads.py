"""Valida la lógica del mantenimiento de IVA sin escribir en Advantage."""

from contextlib import nullcontext
from types import SimpleNamespace

import pytest

from backend import tarifas_iva_repository as repository
from backend.tarifas_iva_repository import VatRateValidationError


@pytest.mark.parametrize("codigo", ["1", "AB", "A1", "123"])
def test_codigo_respeta_picture_99(codigo: str) -> None:
    with pytest.raises(VatRateValidationError):
        repository.create_tarifa_iva("027", {"codigo": codigo, "nombre": "IVA", "tarifa": "0.19"})


@pytest.mark.parametrize("tarifa", ["1", "0.12345", "-0.01"])
def test_porcentaje_respeta_picture_99_99(tarifa: str) -> None:
    with pytest.raises(VatRateValidationError):
        repository.create_tarifa_iva("027", {"codigo": "19", "nombre": "IVA", "tarifa": tarifa})


@pytest.mark.parametrize("edicion", [False, True])
def test_alta_y_modificacion_usan_campos_originales(monkeypatch, edicion: bool) -> None:
    connection = SimpleNamespace(BeginTrans=lambda: None, CommitTrans=lambda: None)
    operations: list[tuple[str, list[tuple[int, int, object]]]] = []
    monkeypatch.setattr(repository, "ads_odbc_connection", lambda: nullcontext(connection))
    monkeypatch.setattr(repository, "_company_exists", lambda *_: True)
    monkeypatch.setattr(repository, "_one", lambda *_args, **_kwargs: {"CODIGO": "19"} if edicion else None)
    monkeypatch.setattr(repository, "_execute", lambda _conn, sql, params: operations.append((sql, params)))
    monkeypatch.setattr(repository, "register_master_creation", lambda *_args: None)
    monkeypatch.setattr(repository, "register_master_update", lambda *_args: None)
    payload = {"nombre": "IVA GENERAL", "tarifa": "0.19"}

    if edicion:
        result = repository.update_tarifa_iva("027", "19", payload)
        assert operations[0][0] == "UPDATE CONTIIVA SET NOMBRE = ?, VLRPOR = ? WHERE CODIGO = ?"
        assert operations[0][1][1][2] == 19.0
    else:
        result = repository.create_tarifa_iva("027", {"codigo": "19", **payload})
        assert operations[0][0].startswith("INSERT INTO CONTIIVA (TIPO, CODIGO, NOMBRE, VLRPOR, HIST)")
        assert operations[0][1][0][2] == ""
        assert operations[0][1][3][2] == 19.0
    assert result["codigo"] == "19"
