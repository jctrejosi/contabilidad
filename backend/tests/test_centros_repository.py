from backend.centros_repository import _cost_centers_from_rows, _nullable_boolean


def test_cost_centers_only_assign_existing_prefix_as_parent() -> None:
    rows = [
        {"CODIGO": "01", "NOMBRE": "Administración", "TIPO": 0, "HABILITA": True},
        {"CODIGO": "011", "NOMBRE": "Tesorería", "TIPO": 1, "HABILITA": False},
        {"CODIGO": "900", "NOMBRE": "Centro independiente", "TIPO": 2, "HABILITA": None},
    ]

    root, child, standalone = _cost_centers_from_rows(rows)

    assert (root["nivel"], root["padre"]) == (1, "")
    assert (child["nivel"], child["padre"]) == (2, "01")
    assert (standalone["nivel"], standalone["padre"]) == (1, "")
    assert child["tipo"] == 1
    assert standalone["habilita"] is None


def test_nullable_boolean_preserves_legacy_null() -> None:
    assert _nullable_boolean(None) is None
    assert _nullable_boolean(0) is False
    assert _nullable_boolean(1) is True
