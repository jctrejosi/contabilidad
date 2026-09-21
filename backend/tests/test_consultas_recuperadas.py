"""Protege el contrato HTTP de las consultas migradas del menú Harbour.

Este inventario no necesita abrir Advantage: evita que otra actualización del
proyecto quite silenciosamente las rutas de las siete pantallas recuperadas.
"""

from backend.app import app


def test_consultation_routes_are_registered() -> None:
    paths = {route.path for route in app.routes}
    expected = {
        "/api/consultas/saldos-anuales",
        "/api/consultas/movimiento-anual-cuenta",
        "/api/consultas/movimiento-anual-cuenta/detalle",
        "/api/consultas/movimiento-anual-tercero",
        "/api/consultas/movimiento-anual-tercero/detalle",
        "/api/consultas/movimiento-anual-centro",
        "/api/consultas/movimiento-anual-centro/detalle",
        "/api/consultas/saldos-cuenta-centro/cuentas",
        "/api/consultas/saldos-cuenta-centro/centros",
        "/api/consultas/saldos-cuenta-centro/detalle",
        "/api/consultas/documento-especifico",
        "/api/consultas/comparativos",
    }
    assert expected <= paths
