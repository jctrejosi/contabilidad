from backend.comprobantes_repository import _voucher_from_row


def test_voucher_maps_only_real_conticom_fields() -> None:
    item = _voucher_from_row(
        {
            "CODIGO": "05 ",
            "NOMBRE": "COMPROBANTES DE EGRESO        ",
            "HIST": "S",
            "CTABDES": "DESCRIPCION AUXILIAR          ",
        }
    )

    assert item == {
        "codigo": "05",
        "nombre": "COMPROBANTES DE EGRESO",
        "hist": "S",
        "historico": True,
        "descripcionAuxiliar": "DESCRIPCION AUXILIAR",
    }


def test_blank_history_is_not_reported_as_true() -> None:
    item = _voucher_from_row({"CODIGO": "01", "HIST": " "})
    assert item["historico"] is False
    assert item["hist"] == ""
