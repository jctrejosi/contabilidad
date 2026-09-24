from contextlib import contextmanager

from backend import tipos_documento_repository as tipos
from backend.tipos_documento_repository import _document_type_from_row, _nullable_boolean


def test_document_type_maps_original_meaning() -> None:
    item = _document_type_from_row(
        {
            "CODIGO": "AN ",
            "NOMBRE": "ANTICIPOS                ",
            "MODULO": 3,
            "TIPO": "Factura   ",
            "CONSE": 12,
            "MODICONSE": True,
            "PREFIJO": "ANT",
            "COMPRO": "06",
            "ICONTAB": False,
            "CONVER": True,
            "DOCCONVER": "NC",
        }
    )

    assert item["codigo"] == "AN"
    assert item["id"] == "AN"
    assert item["nombreModulo"] == "Cuentas por pagar"
    assert item["tipo"] == "Factura"
    assert item["consecutivo"] == 12
    assert item["permiteModificarConsecutivo"] is True
    assert item["documentoConversion"] == "NC"


def test_document_type_preserves_null_flags_and_unknown_module() -> None:
    item = _document_type_from_row({"MODULO": 4, "VALDIAN": None})
    assert item["nombreModulo"] == "No reconocido (4)"
    assert item["validaDian"] is None
    assert _nullable_boolean(None) is None


def test_document_type_listing_reads_only_default_branch(monkeypatch) -> None:
    captured: list[str] = []

    @contextmanager
    def connection():
        yield object()

    class Recordset:
        def Close(self):
            pass

    def open_recordset(_connection, sql):
        captured.append(sql)
        return Recordset()

    monkeypatch.setattr(tipos, "ads_connection", connection)
    monkeypatch.setattr(tipos, "_open_recordset", open_recordset)
    monkeypatch.setattr(tipos, "_rows", lambda _recordset: iter([{"CODIGO": "NC", "NOMBRE": "Nota"}]))

    assert tipos.list_document_types()[0]["codigo"] == "NC"
    assert "FROM VISDOCUM WHERE SUC = 1 ORDER BY CODIGO" in captured[0]
