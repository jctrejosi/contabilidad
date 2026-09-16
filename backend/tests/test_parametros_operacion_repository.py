import pytest

from backend.parametros_operacion_repository import (
    MONTH_CODES,
    OperationParametersValidationError,
    _map_row,
    _normalize,
)


def payload():
    return {
        "nombreEmpresa": "Empresa prueba",
        "nit": "900.123.456-7",
        "direccion": "Calle 1",
        "ciudad": "Manizales",
        "directorioContabilidad": r"\VIS90",
        "anioOperacion": "2026",
        "contabilidadConciliacion": "101",
        "verificaDocumentosLotes": True,
        "tercerosDocumentosPropios": False,
        "controlaUsuarioLotes": True,
        "comentarioCertificado": "Texto certificado",
        "periodosHabilitados": {code: code in {"00", "01", "02"} for code in MONTH_CODES},
    }


def test_normaliza_exactamente_los_campos_persistidos_por_dsiggraba6():
    result = _normalize(payload())
    assert result["anioOperacion"] == 2026
    assert result["controlaUsuarioLotes"] is True
    assert set(result["periodosHabilitados"]) == set(MONTH_CODES)


def test_rechaza_periodos_incompletos_y_longitudes_fisicas():
    data = payload()
    data["periodosHabilitados"].pop("12")
    with pytest.raises(OperationParametersValidationError, match="CT00 a CT12"):
        _normalize(data)

    data = payload()
    data["contabilidadConciliacion"] = "MUY-LARGO"
    with pytest.raises(OperationParametersValidationError, match="máximo 3"):
        _normalize(data)


def test_mapea_booleanos_y_ctpuc_del_registro_conctr():
    row = {
        "CTCODCIA": 101,
        "CTCIA": "EMPRESA   ",
        "CTNIT": "9001 ",
        "CTANO": 2026,
        "CTVERDOC": True,
        "CTTERDOC": False,
        "CTPUC": "1",
        **{f"CT{code}": code == "09" for code in MONTH_CODES},
    }
    result = _map_row(row)
    assert result["codigoInterno"] == 101
    assert result["nombreEmpresa"] == "EMPRESA"
    assert result["controlaUsuarioLotes"] is True
    assert result["periodosHabilitados"]["09"] is True
    assert result["periodosHabilitados"]["08"] is False
