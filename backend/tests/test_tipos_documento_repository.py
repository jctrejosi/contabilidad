from backend.tipos_documento_repository import _document_type_from_row, _nullable_boolean


def test_document_type_maps_original_meaning() -> None:
    item = _document_type_from_row(
        {
            "ID": 8,
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
