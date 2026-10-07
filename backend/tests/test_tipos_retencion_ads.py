"""Contrato de RETES1 para CONTIRET, sin abrir ni modificar Advantage."""

from decimal import Decimal
from contextlib import nullcontext
from types import SimpleNamespace

import pytest
from backend import conceptos_retencion_repository as repository

from backend.conceptos_retencion_repository import (
    RetentionConceptValidationError,
    _legacy_fraction,
    _legacy_percent,
    normalize_legacy_retention_type,
)


def test_tipo_retencion_original_acepta_solo_sus_tres_campos() -> None:
    data = normalize_legacy_retention_type({"codigo": "01", "nombre": "RETENCION 1,5", "tarifa": "0.015"})
    assert data["codigo"] == "01"
    assert data["nombre"] == "RETENCION 1,5"
    assert data["cuenta"] == ""
    assert data["baseMinima"] == Decimal("0")
    assert _legacy_percent(data["tarifa"]) == 1.5
    assert _legacy_fraction(1.5) == 0.015


@pytest.mark.parametrize("codigo", ["1", "ABC", "A1", "123"])
def test_codigo_respeta_picture_99(codigo: str) -> None:
    with pytest.raises(RetentionConceptValidationError, match="dos dígitos"):
        normalize_legacy_retention_type({"codigo": codigo, "nombre": "Prueba", "tarifa": "0.01"})


def test_no_inventa_campos_que_contiret_no_tiene() -> None:
    with pytest.raises(RetentionConceptValidationError, match="columna de cuenta"):
        normalize_legacy_retention_type({"codigo": "01", "nombre": "Prueba", "tarifa": "0.01", "cuenta": "236540"})
    with pytest.raises(RetentionConceptValidationError, match="base mínima"):
        normalize_legacy_retention_type({"codigo": "01", "nombre": "Prueba", "tarifa": "0.01", "baseMinima": 100})


@pytest.mark.parametrize("tarifa", ["1", "0.12345", "-0.01"])
def test_porcentaje_respeta_picture_99_99(tarifa: str) -> None:
    with pytest.raises(RetentionConceptValidationError):
        normalize_legacy_retention_type({"codigo": "01", "nombre": "Prueba", "tarifa": tarifa})


@pytest.mark.parametrize("edicion", [False, True])
def test_alta_y_modificacion_usan_solo_los_campos_reales(monkeypatch, edicion: bool) -> None:
    """Prueba la escritura ADO con un sustituto; nunca abre la base real."""
    connection = SimpleNamespace(BeginTrans=lambda: None, CommitTrans=lambda: None)
    operations: list[tuple[str, list[tuple[int, int, object]]]] = []
    monkeypatch.setattr(repository, "ads_odbc_connection", lambda: nullcontext(connection))
    monkeypatch.setattr(repository, "_company_exists", lambda *_: True)
    monkeypatch.setattr(repository, "_one", lambda *_args, **_kwargs: {"CODIGO": "01"} if edicion else None)
    monkeypatch.setattr(repository, "_execute", lambda _conn, sql, params: operations.append((sql, params)))
    monkeypatch.setattr(repository, "register_master_creation", lambda *_args: None)
    monkeypatch.setattr(repository, "register_master_update", lambda *_args: None)
    payload = {"nombre": "RETENCION 1,5", "tarifa": "0.015"}

    if edicion:
        result = repository.update_concepto_retencion("027", "01", payload)
        assert operations[0][0] == "UPDATE CONTIRET SET NOMBRE = ?, VLRPOR = ? WHERE CODIGO = ?"
        assert operations[0][1][1][2] == 1.5
    else:
        result = repository.create_concepto_retencion("027", {"codigo": "01", **payload})
        assert operations[0][0].startswith("INSERT INTO CONTIRET (TIPO, CODIGO, NOMBRE, VLRPOR, HIST)")
        assert operations[0][1][0][2] == ""
        assert operations[0][1][3][2] == 1.5
    assert result["codigo"] == "01"
