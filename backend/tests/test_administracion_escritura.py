"""Casos de aceptación del bloque D5+D6+D7: administración (11 rutas).

Son pruebas unitarias puras, como `test_cierres_escritura.py`: **no levantan base
de datos**. Cubren:

- la existencia de las once operaciones de contrato (§1.1–§3.2) y de las cuatro
  excepciones de dominio que el backend mapea a HTTP (R5);
- las validaciones que se resuelven **antes** de abrir la conexión: formato de
  correo, patrón de compañía y de rol, topes de paginación y de listas, motivo,
  formato de fecha, catálogo de estados;
- los normalizadores de cada cuerpo (§1.2, §1.3, §1.6, §1.7, §3.2) y sus casos
  vacíos e inválidos;
- el serializador puro de la exportación de bitácora (CSV y XLSX, §2.2);
- las diferencias declaradas entre motores (R10): la rama Advantage responde 503
  declarado con su causa citada, no una simulación silenciosa.

La ejecución real de un 201/200 contra PostgreSQL queda fuera de esta suite:
requiere un motor disponible.
"""

from io import BytesIO

import pytest
from openpyxl import load_workbook

from backend import administracion_repository, store
from backend.administracion_repository import (
    AdminConflict,
    AdminLegacyNotSupported,
    AdminNotFound,
    AdminValidationError,
    _busqueda,
    _email,
    _fecha,
    _formato,
    _motivo,
    _page,
    _page_size,
    _resultado,
    build_audit_export,
    normalize_integration,
    normalize_role_permissions,
    normalize_user,
    normalize_user_companies,
    normalize_user_update,
)

MOTIVO = "Motivo de prueba suficientemente largo"
USUARIO = "JPG"

OPERACIONES = (
    "list_users",
    "create_user",
    "update_user",
    "delete_user",
    "list_roles",
    "replace_role_permissions",
    "replace_user_companies",
    "list_audit_log",
    "export_audit_log",
    "list_integrations",
    "replace_integration",
)

CREAR = {
    "nombre": "Carlos Perez",
    "email": "carlos@example.com",
    "rol": "AUXILIAR",
    "iniciales": "CP",
    "activo": True,
    "companias": ["001"],
    "usuario": USUARIO,
    "motivo": MOTIVO,
}

MODIFICAR = {
    "nombre": "Carlos Perez",
    "email": "carlos@example.com",
    "rol": "CONTADOR",
    "iniciales": "CP",
    "activo": True,
    "usuario": USUARIO,
    "motivo": MOTIVO,
}

FILA_AUDITORIA = {
    "id": 9182,
    "fecha": "2026-02-20T10:06:00",
    "usuario": "Laura Gomez",
    "rol": "Contador principal",
    "accion": "Contabilizacion",
    "modulo": "Contabilizacion",
    "detalle": "CE-000245 / NOM-2026-02",
    "resultado": "EXITO",
    "motivo": None,
}


# ---------------------------------------------------------------------------
# Contrato expuesto (las once operaciones y las cuatro excepciones)
# ---------------------------------------------------------------------------
def test_d5_d6_d7_expose_the_eleven_operations() -> None:
    for nombre in OPERACIONES:
        assert callable(getattr(administracion_repository, nombre)), nombre
    assert len(OPERACIONES) == 11


def test_the_four_domain_exceptions_are_distinct_and_typed() -> None:
    assert issubclass(AdminNotFound, RuntimeError)
    assert issubclass(AdminConflict, RuntimeError)
    assert issubclass(AdminLegacyNotSupported, RuntimeError)
    assert issubclass(AdminValidationError, ValueError)
    assert len({AdminNotFound, AdminConflict, AdminLegacyNotSupported, AdminValidationError}) == 4


def test_legacy_messages_cite_their_evidence() -> None:
    assert "VISUSU" in administracion_repository.LEGACY_USERS_MESSAGE
    assert "usuario_companias" in administracion_repository.LEGACY_COMPANIES_MESSAGE
    assert "VISAUDI" in administracion_repository.LEGACY_AUDIT_MESSAGE
    assert "ADS" in administracion_repository.LEGACY_INTEGRATIONS_MESSAGE


# ---------------------------------------------------------------------------
# Validaciones previas (patrones, topes, correo)
# ---------------------------------------------------------------------------
def test_email_pattern_requires_the_arroba() -> None:
    assert _email("laura@example.com") == "laura@example.com"
    assert _email(" laura@example.com ") == "laura@example.com"
    with pytest.raises(AdminValidationError, match="formato"):
        _email("laura.example.com")
    with pytest.raises(AdminValidationError):
        _email("")


def test_page_and_page_size_enforce_the_contract_limits() -> None:
    assert (_page(1), _page_size(200)) == (1, 200)
    with pytest.raises(AdminValidationError):
        _page(0)
    with pytest.raises(AdminValidationError):
        _page_size(201)
    with pytest.raises(AdminValidationError):
        _page_size(0)


def test_date_rate_format_and_reason_are_validated() -> None:
    assert _fecha("2026-02-20", "fechaDesde") == "2026-02-20"
    assert _fecha("", "fechaDesde") == ""
    with pytest.raises(AdminValidationError, match="YYYY-MM-DD"):
        _fecha("20/02/2026", "fechaDesde")
    assert _formato("csv") == "csv"
    with pytest.raises(AdminValidationError):
        _formato("pdf")
    assert _motivo(MOTIVO) == MOTIVO
    with pytest.raises(AdminValidationError):
        _motivo("ab")
    assert _resultado("FALLO") == "FALLO"
    with pytest.raises(AdminValidationError):
        _resultado("ok")


def test_search_filter_caps_its_length() -> None:
    assert _busqueda("laura", campo="búsqueda") == "laura"
    with pytest.raises(AdminValidationError):
        _busqueda("x" * 61, campo="búsqueda")


# ---------------------------------------------------------------------------
# Normalizadores de los cuerpos
# ---------------------------------------------------------------------------
def test_normalize_user_requires_a_role_a_valid_email_and_companies() -> None:
    data = normalize_user(CREAR)
    assert data["email"] == "carlos@example.com"
    assert data["companias"] == ["001"]
    assert data["activo"] is True

    with pytest.raises(AdminValidationError, match="al menos una compañía"):
        normalize_user({**CREAR, "companias": []})
    with pytest.raises(AdminValidationError, match="formato"):
        normalize_user({**CREAR, "email": "carlos.example.com"})
    with pytest.raises(AdminValidationError):
        normalize_user({k: v for k, v in CREAR.items() if k != "rol"})
    with pytest.raises(AdminValidationError):
        normalize_user({**CREAR, "nombre": "x" * 61})
    with pytest.raises(AdminValidationError):
        normalize_user({**CREAR, "iniciales": "ABCDE"})
    with pytest.raises(AdminValidationError):
        normalize_user({**CREAR, "companias": ["12A"]})
    with pytest.raises(AdminValidationError):
        normalize_user({**CREAR, "motivo": "ab"})


def test_normalize_user_update_has_no_companies_and_rejects_the_empty_body() -> None:
    with pytest.raises(AdminValidationError):
        normalize_user_update({})
    data = normalize_user_update(MODIFICAR)
    assert data["rol"] == "CONTADOR"
    assert "companias" not in data


def test_normalize_user_companies_requires_at_least_one_and_dedupes() -> None:
    data = normalize_user_companies(
        {"companias": ["001", "002", "001"], "usuario": USUARIO, "motivo": MOTIVO}
    )
    assert data["companias"] == ["001", "002"]
    with pytest.raises(AdminValidationError, match="al menos una compañía"):
        normalize_user_companies({"companias": [], "usuario": USUARIO, "motivo": MOTIVO})


def test_normalize_role_permissions_accepts_empty_and_caps_the_list() -> None:
    assert normalize_role_permissions(
        {"permisos": [], "usuario": USUARIO, "motivo": MOTIVO}
    )["permisos"] == []
    data = normalize_role_permissions(
        {"permisos": ["mov.capturar", "mov.capturar"], "usuario": USUARIO, "motivo": MOTIVO}
    )
    assert data["permisos"] == ["mov.capturar"]
    with pytest.raises(AdminValidationError):
        normalize_role_permissions(
            {"permisos": [f"mov.p{i}" for i in range(201)], "usuario": USUARIO, "motivo": MOTIVO}
        )


def test_normalize_integration_requires_a_valid_state_and_connected_config() -> None:
    data = normalize_integration(
        {"estado": "Desconectado", "configuracion": {}, "usuario": USUARIO, "motivo": MOTIVO}
    )
    assert data["configuracion"] == {}
    with pytest.raises(AdminValidationError, match="configuración"):
        normalize_integration(
            {"estado": "Conectado", "configuracion": {}, "usuario": USUARIO, "motivo": MOTIVO}
        )
    with pytest.raises(AdminValidationError, match="estado"):
        normalize_integration(
            {"estado": "Activo", "configuracion": {}, "usuario": USUARIO, "motivo": MOTIVO}
        )
    with pytest.raises(AdminValidationError):
        normalize_integration(
            {
                "estado": "Conectado", "configuracion": ["no", "objeto"],
                "usuario": USUARIO, "motivo": MOTIVO,
            }
        )


# ---------------------------------------------------------------------------
# Exportación de bitácora (serializador puro, §2.2)
# ---------------------------------------------------------------------------
def test_build_audit_export_writes_csv_and_xlsx() -> None:
    csv_bytes = build_audit_export([FILA_AUDITORIA], formato="csv")
    data = csv_bytes.decode("utf-8-sig")
    assert data.splitlines()[0].startswith("ID;Fecha;Usuario")
    assert "9182;2026-02-20T10:06:00;Laura Gomez" in data
    assert "EXITO" in data

    xlsx_bytes = build_audit_export([FILA_AUDITORIA], formato="xlsx")
    sheet = load_workbook(BytesIO(xlsx_bytes), read_only=True).active
    assert sheet is not None
    assert sheet["A1"].value == "ID"
    assert sheet["A2"].value == 9182
    assert sheet["H2"].value == "EXITO"


def test_build_audit_export_with_no_rows_keeps_the_headers() -> None:
    data = build_audit_export([], formato="csv").decode("utf-8-sig")
    assert data.strip() == "ID;Fecha;Usuario;Rol;Acción;Módulo;Detalle;Resultado;Motivo"
    with pytest.raises(AdminValidationError):
        build_audit_export([], formato="pdf")


# ---------------------------------------------------------------------------
# R10: la rama Advantage declara su brecha (503), no la simula en silencio
# ---------------------------------------------------------------------------
def test_ads_branch_declares_the_gap_for_every_route(monkeypatch) -> None:
    monkeypatch.setattr(store, "is_postgres", lambda: False)
    esperado = (
        (lambda: administracion_repository.list_users(), "VISUSU"),
        (lambda: administracion_repository.create_user(CREAR), "VISUSU"),
        (lambda: administracion_repository.update_user(1, MODIFICAR), "VISUSU"),
        (lambda: administracion_repository.delete_user(1, user=USUARIO, motivo=MOTIVO), "VISUSU"),
        (lambda: administracion_repository.list_roles(), "VISUSU"),
        (
            lambda: administracion_repository.replace_role_permissions(
                "AUXILIAR", {"permisos": ["mov.capturar"], "usuario": USUARIO, "motivo": MOTIVO}
            ),
            "VISUSU",
        ),
        (
            lambda: administracion_repository.replace_user_companies(
                1, {"companias": ["001"], "usuario": USUARIO, "motivo": MOTIVO}
            ),
            "usuario_companias",
        ),
        (lambda: administracion_repository.list_audit_log(), "VISAUDI"),
        (lambda: administracion_repository.export_audit_log(formato="csv"), "VISAUDI"),
        (lambda: administracion_repository.list_integrations("001"), "ADS"),
        (
            lambda: administracion_repository.replace_integration(
                "001", "Facturacion",
                {"estado": "Desconectado", "configuracion": {}, "usuario": USUARIO, "motivo": MOTIVO},
            ),
            "ADS",
        ),
    )
    for llamada, aguja in esperado:
        with pytest.raises(AdminLegacyNotSupported, match=aguja):
            llamada()


def test_ads_branch_still_validates_before_declaring_the_503(monkeypatch) -> None:
    monkeypatch.setattr(store, "is_postgres", lambda: False)
    with pytest.raises(AdminValidationError):
        administracion_repository.list_users(estado="malo")
    with pytest.raises(AdminValidationError):
        administracion_repository.create_user({**CREAR, "email": "sin-arroba"})
    with pytest.raises(AdminValidationError):
        administracion_repository.delete_user(1, user=USUARIO, motivo="ab")
    with pytest.raises(AdminValidationError):
        administracion_repository.replace_user_companies(1, {"companias": []})
    with pytest.raises(AdminValidationError):
        administracion_repository.export_audit_log(formato="pdf")
    with pytest.raises(AdminValidationError):
        administracion_repository.list_integrations("")
    with pytest.raises(AdminValidationError):
        administracion_repository.replace_integration(
            "001", "Facturacion",
            {"estado": "Conectado", "configuracion": {}, "usuario": USUARIO, "motivo": MOTIVO},
        )
