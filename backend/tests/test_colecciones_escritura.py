"""Casos de aceptación del bloque B3, parte 2: plantillas y formatos.

Son pruebas unitarias puras, como `test_configuracion_escritura.py`: **no levantan
base de datos**. Cubren:

- el registro de las ocho rutas (R9) con su método;
- el contrato Pydantic de cada cuerpo y sus tres casos: normal, vacío e inválido
  (R6);
- los caminos de validación que se resuelven **antes** de abrir la conexión, en los
  dos motores (R3/R4);
- el mapeo de filas a contrato en los dos motores, incluida la diferencia declarada
  de la colección hija anidada (R10);
- el **reemplazo en bloque** del kardex de reglas: las líneas de la plantilla y los
  elementos del formato se borran y se reinsertan dentro de la misma transacción;
- el despacho de `store` por operación (R1) y la estabilidad de `_service_error`
  (R5).

Las escrituras de PostgreSQL se ejercitan con un cursor guionado **por marca**: la
operación ejecuta muchas sentencias (compañía, usuario, auditoría) y el test solo
quiere fijar las filas de las que depende y comprobar el orden del kardex.
"""

from contextlib import contextmanager
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import Response
from pydantic import ValidationError

from backend import (
    formatos_documentales_repository,
    plantillas_contables_repository,
    postgres_repository,
    postgres_writes,
    store,
)
from backend import app as app_module
from backend.app import (
    DocumentFormatCreate,
    DocumentFormatWrite,
    TemplateCreate,
    TemplateWrite,
    app,
    create_document_format,
    create_template,
    delete_document_format,
    delete_template,
    document_formats,
    templates,
    update_document_format,
    update_template,
)
from backend.companias_repository import CompanyValidationError
from backend.formatos_documentales_repository import (
    FORMAT_ELEMENT_TYPES,
    DocumentFormatAlreadyExists,
    DocumentFormatNotFound,
    DocumentFormatValidationError,
    _element_from_row,
    _format_from_rows,
    _legacy_font,
    document_format_item,
    normalize_document_format,
)
from backend.plantillas_contables_repository import (
    TEMPLATE_LEGACY_COLUMNS,
    TemplateAlreadyExists,
    TemplateConflict,
    TemplateNotFound,
    TemplateValidationError,
    _pairs_from_row,
    _template_from_row,
    normalize_template,
    template_item,
)


PLANTILLA_ESCRITURA = {
    "nombre": "Nómina mensual",
    "tipoDocumento": "NO",
    "lineas": [
        {"orden": 1, "cuentaDebito": "510506", "cuentaCredito": "250505", "concepto": "Sueldos"},
        {"orden": 2, "cuentaDebito": "510510", "cuentaCredito": "250505"},
    ],
}
FORMATO_ESCRITURA = {
    "nombre": "Comprobante de egreso",
    "comprobante": "CE",
    "elementos": [
        {
            "tipo": "Leyenda", "contenido": "COMPROBANTE DE EGRESO",
            "x": "10", "y": "8", "fuente": "Arial 10", "orden": 1,
        },
        {"tipo": "CampoDocumento", "contenido": "documento", "x": "10", "y": "16", "orden": 2},
    ],
}
FORMATO_LEYENDA = {
    "nombre": "Comprobante de egreso",
    "elementos": [
        {"tipo": "Leyenda", "contenido": "COMPROBANTE DE EGRESO", "x": "10", "y": "8"},
    ],
}
LINEA_LEGADO = {
    "CODIGO": "NO",
    "NOMBRE": "Nómina mensual",
    "DEB01": "510506",
    "CRE01": "250505",
    "NOM01": "Sueldos",
    "DEB02": "510510",
    "CRE02": "250505",
    "NOM02": "",
}


def _routes() -> set[tuple[str, str]]:
    return {
        (route.path, method)
        for route in app.routes
        for method in (getattr(route, "methods", None) or [])
    }


class _ScriptedCursor:
    """Cursor de PostgreSQL que responde por marca y registra el SQL ejecutado.

    Cada respuesta es ``(marca, columnas, filas)``: la marca es una subcadena de la
    consulta, de modo que la operación puede ejecutar tantas sentencias de apoyo
    (compañía, usuario, auditoría) como necesite sin que el guion dependa del orden.
    """

    def __init__(self, script: list[tuple[str, list[str], list[tuple]]]) -> None:
        self._script = list(script)
        self.ejecutadas: list[str] = []
        self._current: list[tuple] = []
        self._columnas: list[str] = []

    def execute(self, sql: str, params: object = None) -> None:
        self.ejecutadas.append(" ".join(sql.split()))
        for index, (marca, columnas, filas) in enumerate(self._script):
            if marca in sql:
                self._columnas = list(columnas)
                self._current = list(filas)
                del self._script[index]
                return
        self._columnas = []
        self._current = []

    def executemany(self, sql: str, seq: object = None) -> None:
        self.ejecutadas.append(" ".join(sql.split()))
        self._columnas = []
        self._current = []

    @property
    def description(self) -> list[SimpleNamespace]:
        return [SimpleNamespace(name=name) for name in self._columnas]

    def fetchall(self) -> list[tuple]:
        return list(self._current)

    def fetchone(self) -> tuple | None:
        return self._current[0] if self._current else None

    def __enter__(self) -> "_ScriptedCursor":
        return self

    def __exit__(self, *exc: object) -> bool:
        return False


class _ScriptedConnection:
    def __init__(self, cursor: _ScriptedCursor) -> None:
        self._cursor = cursor
        self.committed = False
        self.rolled_back = False

    def cursor(self) -> _ScriptedCursor:
        return self._cursor

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True

    def close(self) -> None:
        pass

    def __enter__(self) -> "_ScriptedConnection":
        return self

    def __exit__(self, *exc: object) -> bool:
        return False


def _postgres_script(
    monkeypatch, responses: list[tuple[str, list[str], list[tuple]]]
) -> _ScriptedCursor:
    """Hace que ``_connect()`` de las escrituras devuelva el cursor guionado."""
    cursor = _ScriptedCursor(responses)
    monkeypatch.setattr(postgres_writes, "_connect", lambda: _ScriptedConnection(cursor))
    return cursor


# ---------------------------------------------------------------------------
# Registro de rutas (R1, R9)
# ---------------------------------------------------------------------------
def test_b3_part2_routes_are_registered_with_the_planned_methods() -> None:
    routes = _routes()
    for path in ("/api/plantillas-contables", "/api/formatos-documentales"):
        assert (path, "GET") in routes
        assert (path, "POST") in routes
        assert (f"{path}/{{codigo}}", "PUT") in routes
        assert (f"{path}/{{codigo}}", "DELETE") in routes


def test_new_routes_are_lower_case_with_hyphens() -> None:
    for path, _method in _routes():
        assert path == path.lower(), path
    assert "/api/plantillas-contables" in {path for path, _ in _routes()}
    assert "/api/formatos-documentales" in {path for path, _ in _routes()}


# ---------------------------------------------------------------------------
# Modelos: normal, vacío e inválido (R6)
# ---------------------------------------------------------------------------
def test_template_model_normal_case_and_line_defaults() -> None:
    payload = TemplateCreate(codigo="NO2", **PLANTILLA_ESCRITURA)
    assert payload.tipoDocumento == "NO"
    assert payload.lineas[1].concepto == ""
    assert payload.lineas[0].orden == 1


def test_template_model_rejects_an_empty_or_single_line_template() -> None:
    with pytest.raises(ValidationError, match="at least 2 items"):
        TemplateCreate(codigo="NO2", **{**PLANTILLA_ESCRITURA, "lineas": []})
    with pytest.raises(ValidationError, match="at least 2 items"):
        TemplateCreate(
            codigo="NO2", **{**PLANTILLA_ESCRITURA, "lineas": PLANTILLA_ESCRITURA["lineas"][:1]}
        )


def test_template_model_rejects_an_invalid_account_and_the_immutable_code() -> None:
    with pytest.raises(ValidationError):
        TemplateCreate(
            codigo="NO2",
            **{
                **PLANTILLA_ESCRITURA,
                "lineas": [
                    {"orden": 1, "cuentaDebito": "ABC", "cuentaCredito": "250505"},
                    {"orden": 2, "cuentaDebito": "510510", "cuentaCredito": "250505"},
                ],
            },
        )
    with pytest.raises(ValidationError, match="greater than or equal to 1"):
        TemplateCreate(
            codigo="NO2",
            **{
                **PLANTILLA_ESCRITURA,
                "lineas": [
                    {"orden": 0, "cuentaDebito": "510506", "cuentaCredito": "250505"},
                    {"orden": 2, "cuentaDebito": "510510", "cuentaCredito": "250505"},
                ],
            },
        )
    with pytest.raises(ValidationError) as error:
        TemplateWrite(codigo="NO2", **PLANTILLA_ESCRITURA)
    assert error.value.errors()[0]["type"] == "extra_forbidden"


def test_document_format_model_normal_empty_and_invalid() -> None:
    payload = DocumentFormatCreate(codigo="CE01", **FORMATO_ESCRITURA)
    assert [elemento.tipo for elemento in payload.elementos] == ["Leyenda", "CampoDocumento"]
    assert payload.elementos[0].x == Decimal(10)
    assert payload.elementos[0].ancho is None

    # Vacío: un formato sin elementos no tiene nada que imprimir.
    with pytest.raises(ValidationError, match="at least 1 item"):
        DocumentFormatCreate(codigo="CE01", **{**FORMATO_ESCRITURA, "elementos": []})
    # Inválido: tipo desconocido, coordenada negativa y clave inmutable en el PUT.
    with pytest.raises(ValidationError):
        DocumentFormatCreate(
            codigo="CE01",
            **{**FORMATO_ESCRITURA, "elementos": [{"tipo": "Inventado", "contenido": "x"}]},
        )
    with pytest.raises(ValidationError, match="greater than or equal to 0"):
        DocumentFormatCreate(
            codigo="CE01",
            **{**FORMATO_ESCRITURA, "elementos": [{"tipo": "Leyenda", "x": "-1"}]},
        )
    with pytest.raises(ValidationError) as error:
        DocumentFormatWrite(codigo="CE01", **FORMATO_ESCRITURA)
    assert error.value.errors()[0]["type"] == "extra_forbidden"


# ---------------------------------------------------------------------------
# Normalizadores y mapeo de filas
# ---------------------------------------------------------------------------
def test_template_normalization_and_write_echo() -> None:
    data = normalize_template({"codigo": "no2", **PLANTILLA_ESCRITURA})
    assert data["codigo"] == "NO2"
    assert template_item(data) == {
        "codigo": "NO2",
        "nombre": "Nómina mensual",
        "tipoDocumento": "NO",
        "lineas": [
            {"orden": 1, "cuentaDebito": "510506", "cuentaCredito": "250505", "concepto": "Sueldos"},
            {"orden": 2, "cuentaDebito": "510510", "cuentaCredito": "250505", "concepto": ""},
        ],
    }
    with pytest.raises(TemplateValidationError, match="cuenta de débito es obligatoria"):
        normalize_template(
            {
                "codigo": "NO2",
                **PLANTILLA_ESCRITURA,
                "lineas": [
                    {"orden": 1, "cuentaCredito": "250505"},
                    {"orden": 2, "cuentaCredito": "250505"},
                ],
            }
        )
    with pytest.raises(TemplateValidationError, match="tipo de documento"):
        normalize_template({"codigo": "NO2", **PLANTILLA_ESCRITURA, "tipoDocumento": "NOMINA"})
    # Vacío: sin lista de líneas no hay plantilla.
    with pytest.raises(TemplateValidationError, match="entre 2 y 80"):
        normalize_template({"codigo": "NO2", **{**PLANTILLA_ESCRITURA, "lineas": []}})


def test_template_row_maps_the_pairs_and_requires_at_least_one() -> None:
    item = _template_from_row(LINEA_LEGADO)
    assert item == {
        "codigo": "NO",
        "nombre": "Nómina mensual",
        # El legado no separa el tipo documental de la plantilla: es la misma fila.
        "tipoDocumento": "NO",
        "lineas": [
            {"orden": 1, "cuentaDebito": "510506", "cuentaCredito": "250505", "concepto": "Sueldos"},
            {"orden": 2, "cuentaDebito": "510510", "cuentaCredito": "250505", "concepto": ""},
        ],
    }
    assert _pairs_from_row({"CODIGO": "NO", "NOMBRE": "Tipo sin plantilla"}) == []
    assert _template_from_row({"CODIGO": "NO", "NOMBRE": "Tipo sin plantilla"}) is None


def test_ads_template_declares_what_visdocum_cannot_represent() -> None:
    # El código del legado ocupa 2 posiciones.
    with pytest.raises(TemplateValidationError, match="máximo 2 caracteres"):
        plantillas_contables_repository._reject_unsupported(
            normalize_template({"codigo": "NOMINA", **PLANTILLA_ESCRITURA, "tipoDocumento": "NM"})
        )
    # La plantilla del legado es la fila del tipo documental: no se pueden separar.
    with pytest.raises(TemplateValidationError, match="tipoDocumento debe ser igual a codigo"):
        plantillas_contables_repository._reject_unsupported(
            normalize_template({"codigo": "NO", **PLANTILLA_ESCRITURA, "tipoDocumento": "NM"})
        )
    # VISDOCUM guarda DEB/CRE01..09 y NOM01..08.
    diez = [
        {"orden": numero, "cuentaDebito": "510506", "cuentaCredito": "250505"}
        for numero in range(1, 11)
    ]
    with pytest.raises(TemplateValidationError, match="máximo 9 parejas"):
        plantillas_contables_repository._reject_unsupported(
            normalize_template({"codigo": "NO", **{**PLANTILLA_ESCRITURA, "lineas": diez}})
        )
    novena = [
        {"orden": numero, "cuentaDebito": "510506", "cuentaCredito": "250505"}
        for numero in range(1, 10)
    ]
    novena[-1]["concepto"] = "Sin columna"
    with pytest.raises(TemplateValidationError, match="no tiene NOM09"):
        plantillas_contables_repository._reject_unsupported(
            normalize_template({"codigo": "NO", **{**PLANTILLA_ESCRITURA, "lineas": novena}})
        )


def test_document_format_normalization_and_legacy_font_mapping() -> None:
    data = normalize_document_format({"codigo": "ce01", **FORMATO_ESCRITURA})
    assert data["codigo"] == "CE01"
    assert data["elementos"][0]["x"] == Decimal("10.00")
    assert [elemento["tipo"] for elemento in data["elementos"]] == ["Leyenda", "CampoDocumento"]
    assert document_format_item(data)["elementos"][1] == {
        "tipo": "CampoDocumento", "contenido": "documento", "x": 10.0, "y": 16.0,
        "ancho": None, "alto": None, "fuente": "", "orden": 2,
    }
    with pytest.raises(DocumentFormatValidationError, match="no es uno de los ocho"):
        normalize_document_format(
            {"codigo": "CE01", **{**FORMATO_ESCRITURA, "elementos": [{"tipo": "Texto"}]}}
        )
    # ``TIPOFTE`` + ``FUENTE`` es la ``fuente`` del contrato.
    assert _legacy_font("Arial 10") == ("Arial", 10.0)
    assert _legacy_font("Arial") == ("Arial", 0.0)


def test_ads_document_format_declares_what_congenf_and_conforma_cannot_represent() -> None:
    # CONGENF no tiene columna de comprobante.
    with pytest.raises(DocumentFormatValidationError, match="no tiene columna de comprobante"):
        formatos_documentales_repository._reject_unsupported(
            normalize_document_format({"codigo": "CE", "comprobante": "CE", **FORMATO_LEYENDA})
        )
    # Solo la leyenda tiene una clase inequívoca entre las ocho del modelo.
    with pytest.raises(DocumentFormatValidationError, match="no la clase CampoDocumento"):
        formatos_documentales_repository._reject_unsupported(
            normalize_document_format(
                {"codigo": "CE", "nombre": "Comprobante", "elementos": [{"tipo": "CampoDocumento", "contenido": "documento"}]}
            )
        )
    # CONFORMA no tiene ancho ni alto de recuadro.
    with pytest.raises(DocumentFormatValidationError, match="no tiene ancho ni alto"):
        formatos_documentales_repository._reject_unsupported(
            normalize_document_format(
                {"codigo": "CE", "nombre": "Comprobante", "elementos": [{"tipo": "Leyenda", "contenido": "X", "ancho": "10"}]}
            )
        )
    with pytest.raises(DocumentFormatValidationError, match="máximo 2 caracteres"):
        formatos_documentales_repository._reject_unsupported(
            normalize_document_format(
                {"codigo": "CE01", "nombre": "Comprobante", "elementos": [{"tipo": "Leyenda", "contenido": "X"}]}
            )
        )


def test_ads_document_format_row_keeps_the_leyenda_and_counts_the_rest() -> None:
    item = _format_from_rows(
        "CE01",
        "Comprobante de egreso",
        [
            {"LEYENDA": "COMPROBANTE DE EGRESO", "CAMPO": "", "FILA": 8.0, "COLUMNA": 10.0,
             "FUENTE": 10.0, "TIPOFTE": "Arial"},
            {"LEYENDA": "", "CAMPO": "documento", "FILA": 16.0, "COLUMNA": 10.0},
        ],
    )
    assert item["comprobante"] == ""
    assert item["elementos"] == [
        {"tipo": "Leyenda", "contenido": "COMPROBANTE DE EGRESO", "x": 10.0, "y": 8.0,
         "ancho": None, "alto": None, "fuente": "Arial 10", "orden": 1}
    ]
    # La posición de campo no se pierde en silencio ni se le inventa una clase.
    assert item["elementosNoRepresentados"] == 1
    assert _element_from_row({"LEYENDA": "", "CAMPO": "documento"}, 1) is None
    assert FORMAT_ELEMENT_TYPES[0] == "Leyenda"


# ---------------------------------------------------------------------------
# Lecturas de PostgreSQL: misma forma de contrato que en Advantage
# ---------------------------------------------------------------------------
def test_postgres_template_listing_groups_the_child_lines(monkeypatch) -> None:
    cursor = _ScriptedCursor(
        [
            ("SELECT codigo FROM companias", ["codigo"], [("27",)]),
            ("SELECT id FROM companias", ["id"], [(5,)]),
            (
                'SELECT p.codigo AS "CODIGO"',
                ["CODIGO", "NOMBRE", "TIPO_DOCUMENTO"],
                [("NO2", "Nomina mensual", "NO")],
            ),
            (
                "FROM plantilla_lineas l",
                ["PLANTILLA", "ORDEN", "CUENTA_DEBITO", "CUENTA_CREDITO", "CONCEPTO"],
                [
                    ("NO2", 1, "510506", "250505", "Sueldos"),
                    ("NO2", 2, "510510", "250505", None),
                ],
            ),
        ]
    )
    monkeypatch.setattr(postgres_repository, "_connect", lambda: _ScriptedConnection(cursor))
    assert postgres_repository.list_plantillas_contables("027") == [
        {
            "codigo": "NO2",
            "nombre": "Nomina mensual",
            "tipoDocumento": "NO",
            "lineas": [
                {"orden": 1, "cuentaDebito": "510506", "cuentaCredito": "250505", "concepto": "Sueldos"},
                {"orden": 2, "cuentaDebito": "510510", "cuentaCredito": "250505", "concepto": ""},
            ],
        }
    ]
    assert any("eliminado_en IS NULL" in sql for sql in cursor.ejecutadas)


def test_postgres_document_format_listing_keeps_the_geometry(monkeypatch) -> None:
    cursor = _ScriptedCursor(
        [
            ("SELECT codigo FROM companias", ["codigo"], [("27",)]),
            ("SELECT id FROM companias", ["id"], [(5,)]),
            (
                'SELECT f.codigo AS "CODIGO"',
                ["CODIGO", "NOMBRE", "COMPROBANTE"],
                [("CE01", "Comprobante de egreso", "CE")],
            ),
            (
                "FROM formato_elementos e",
                ["FORMATO", "TIPO", "CONTENIDO", "X", "Y", "ANCHO", "ALTO", "FUENTE", "ORDEN"],
                [
                    ("CE01", "Leyenda", "COMPROBANTE DE EGRESO", Decimal("10.00"), Decimal("8.00"),
                     None, None, "Arial 10", 1),
                ],
            ),
        ]
    )
    monkeypatch.setattr(postgres_repository, "_connect", lambda: _ScriptedConnection(cursor))
    assert postgres_repository.list_formatos_documentales("027") == [
        {
            "codigo": "CE01",
            "nombre": "Comprobante de egreso",
            "comprobante": "CE",
            "elementos": [
                {"tipo": "Leyenda", "contenido": "COMPROBANTE DE EGRESO", "x": 10.0, "y": 8.0,
                 "ancho": None, "alto": None, "fuente": "Arial 10", "orden": 1}
            ],
        }
    ]


# ---------------------------------------------------------------------------
# Reemplazo en bloque dentro de la transacción (kardex de reglas)
# ---------------------------------------------------------------------------
def test_postgres_template_update_replaces_the_lines_in_block(monkeypatch) -> None:
    cursor = _postgres_script(
        monkeypatch,
        [
            ("SELECT codigo FROM companias", ["codigo"], [("27",)]),
            ("SELECT id FROM companias", ["id"], [(5,)]),
            ("SELECT id, tipo_documento_id FROM plantillas_contables", ["id", "tipo"], [(7, 3)]),
            ("FROM documentos WHERE compania_id", ["count"], [(0,)]),
            ("SELECT id FROM tipos_documento", ["id"], [(3,)]),
            ("SELECT id, afectable FROM cuentas", ["id", "afectable"], [(11, True)]),
            ("SELECT id, afectable FROM cuentas", ["id", "afectable"], [(12, True)]),
            ("SELECT id, afectable FROM cuentas", ["id", "afectable"], [(11, True)]),
            ("SELECT id, afectable FROM cuentas", ["id", "afectable"], [(12, True)]),
            ("FROM usuarios WHERE upper(iniciales)", ["id"], [(9,)]),
        ],
    )
    item = postgres_writes.update_plantilla_contable(
        "027", "NO2", {**PLANTILLA_ESCRITURA, "codigo": "NO2"}
    )
    assert item["lineas"][1]["cuentaDebito"] == "510510"
    indice_borrado = next(
        indice for indice, sql in enumerate(cursor.ejecutadas)
        if sql.startswith("DELETE FROM plantilla_lineas")
    )
    indice_insercion = next(
        indice for indice, sql in enumerate(cursor.ejecutadas)
        if sql.startswith("INSERT INTO plantilla_lineas")
    )
    assert indice_borrado < indice_insercion
    assert any(sql.startswith("UPDATE plantillas_contables SET nombre") for sql in cursor.ejecutadas)
    assert any(sql.startswith("INSERT INTO auditoria") for sql in cursor.ejecutadas)


def test_postgres_document_format_update_replaces_the_elements_in_block(monkeypatch) -> None:
    cursor = _postgres_script(
        monkeypatch,
        [
            ("SELECT codigo FROM companias", ["codigo"], [("27",)]),
            ("SELECT id FROM companias", ["id"], [(5,)]),
            ("SELECT id FROM formatos_documentales", ["id"], [(7,)]),
            ("SELECT id FROM comprobantes", ["id"], [(4,)]),
            ("FROM usuarios WHERE upper(iniciales)", ["id"], [(9,)]),
        ],
    )
    item = postgres_writes.update_formato_documental(
        "027", "CE01", {**FORMATO_ESCRITURA, "codigo": "CE01"}
    )
    assert [elemento["tipo"] for elemento in item["elementos"]] == ["Leyenda", "CampoDocumento"]
    indice_borrado = next(
        indice for indice, sql in enumerate(cursor.ejecutadas)
        if sql.startswith("DELETE FROM formato_elementos")
    )
    indice_insercion = next(
        indice for indice, sql in enumerate(cursor.ejecutadas)
        if sql.startswith("INSERT INTO formato_elementos")
    )
    assert indice_borrado < indice_insercion
    assert any(sql.startswith("INSERT INTO auditoria") for sql in cursor.ejecutadas)


def test_ads_document_format_update_replaces_the_positions_in_block(monkeypatch) -> None:
    """El legado tampoco tiene filas hijas aquí: se borra el bloque y se reinserta."""
    ejecutadas: list[tuple[str, list[tuple[int, int, object]]]] = []

    class _LegacyConnection:
        def BeginTrans(self) -> None:
            pass

        def CommitTrans(self) -> None:
            pass

        def RollbackTrans(self) -> None:
            pass

    @contextmanager
    def _connection():
        yield _LegacyConnection()

    monkeypatch.setattr(formatos_documentales_repository, "ads_odbc_connection", _connection)
    monkeypatch.setattr(formatos_documentales_repository, "_company_exists", lambda *a: True)
    monkeypatch.setattr(
        formatos_documentales_repository, "_header", lambda *a: {"CODIGO": "CE", "NOMBRE": "Comprobante"}
    )
    monkeypatch.setattr(
        formatos_documentales_repository,
        "_execute",
        lambda connection, sql, parameters: ejecutadas.append((" ".join(sql.split()), parameters)),
    )
    monkeypatch.setattr(
        formatos_documentales_repository, "register_master_update", lambda *a, **k: None
    )

    item = formatos_documentales_repository.update_formato_documental(
        "027", "ce", {"codigo": "CE", **FORMATO_LEYENDA}
    )
    assert item["codigo"] == "CE"
    assert [sql.split(" (")[0] for sql, _ in ejecutadas] == [
        "UPDATE CONGENF SET NOMBRE = ? WHERE CODIGO = ?",
        "DELETE FROM CONFORMA WHERE CODIGO = ?",
        "INSERT INTO CONFORMA",
    ]
    parametros = ejecutadas[2][1]
    # (CODIGO, LEYENDA, FILA, COLUMNA, LONGITUD, TIPOFTE, FUENTE)
    assert [parametro[2] for parametro in parametros] == [
        "CE", "COMPROBANTE DE EGRESO", 8.0, 10.0, len("COMPROBANTE DE EGRESO"), "", 0.0,
    ]


def test_ads_template_update_rewrites_the_whole_pair_block(monkeypatch) -> None:
    """El legado no tiene filas hijas: el bloque de parejas se reescribe completo."""
    ejecutadas: list[tuple[str, list[tuple[int, int, object]]]] = []

    class _LegacyConnection:
        def BeginTrans(self) -> None:
            pass

        def CommitTrans(self) -> None:
            pass

        def RollbackTrans(self) -> None:
            pass

    @contextmanager
    def _connection():
        yield _LegacyConnection()

    monkeypatch.setattr(plantillas_contables_repository, "ads_odbc_connection", _connection)
    monkeypatch.setattr(plantillas_contables_repository, "_company_exists", lambda *a: True)
    monkeypatch.setattr(plantillas_contables_repository, "_one", lambda *a: dict(LINEA_LEGADO))
    monkeypatch.setattr(plantillas_contables_repository, "_cuenta_afectable", lambda *a: None)
    monkeypatch.setattr(
        plantillas_contables_repository,
        "_execute",
        lambda connection, sql, parameters: ejecutadas.append((" ".join(sql.split()), parameters)),
    )
    monkeypatch.setattr(
        plantillas_contables_repository, "register_master_update", lambda *a, **k: None
    )

    item = plantillas_contables_repository.update_plantilla_contable(
        "027", "no", {**PLANTILLA_ESCRITURA, "tipoDocumento": "NO"}
    )
    assert item["codigo"] == "NO"
    sql, parametros = ejecutadas[0]
    assert sql.startswith("UPDATE VISDOCUM SET NOMBRE = ?")
    assert "WHERE SUC = 1 AND CODIGO = ?" in sql
    for columna in ("DEB01", "DEB02", "DEB09", "CRE01", "CRE09", "NOM01", "NOM08"):
        assert f"{columna} = ?" in sql
    # Una sola sentencia reescribe el bloque completo (NOMBRE + parejas) y el código
    # viaja en el WHERE: no hay filas hijas que puedan quedar huérfanas.
    assert len(parametros) == len(TEMPLATE_LEGACY_COLUMNS)
    assert parametros[-1][2] == "NO"


# ---------------------------------------------------------------------------
# Validaciones previas a la conexión, en los dos motores (R3/R4)
# ---------------------------------------------------------------------------
def test_pg_writes_reject_invalid_payloads_before_connecting(monkeypatch) -> None:
    def _explode(*args: object, **kwargs: object) -> None:
        raise AssertionError("no debe abrir conexión con un payload inválido")

    monkeypatch.setattr(postgres_writes, "_connect", _explode)
    with pytest.raises(TemplateValidationError, match="entre 2 y 80"):
        postgres_writes.create_plantilla_contable(
            "027", {"codigo": "NO2", "nombre": "N", "tipoDocumento": "NO", "lineas": []}
        )
    with pytest.raises(TemplateValidationError, match="entre 2 y 80"):
        postgres_writes.update_plantilla_contable(
            "027", "NO2", {**PLANTILLA_ESCRITURA, "lineas": PLANTILLA_ESCRITURA["lineas"][:1]}
        )
    with pytest.raises(DocumentFormatValidationError, match="no es uno de los ocho"):
        postgres_writes.create_formato_documental(
            "027", {"codigo": "CE01", **{**FORMATO_ESCRITURA, "elementos": [{"tipo": "Texto"}]}}
        )
    with pytest.raises(DocumentFormatValidationError, match="entre 1 y 200"):
        postgres_writes.update_formato_documental(
            "027", "CE01", {**FORMATO_ESCRITURA, "elementos": []}
        )
    with pytest.raises(CompanyValidationError, match="entre 5 y 180"):
        postgres_writes.delete_plantilla_contable("027", "NO2", reason="mal")
    with pytest.raises(CompanyValidationError, match="entre 5 y 180"):
        postgres_writes.delete_formato_documental("027", "CE01", reason="mal")


def test_ads_writes_reject_invalid_payloads_before_connecting(monkeypatch) -> None:
    @contextmanager
    def _explode():
        raise AssertionError("no debe abrir conexión con un payload inválido")
        yield  # pragma: no cover

    monkeypatch.setattr(plantillas_contables_repository, "ads_odbc_connection", _explode)
    monkeypatch.setattr(formatos_documentales_repository, "ads_odbc_connection", _explode)
    with pytest.raises(TemplateValidationError, match="máximo 2 caracteres"):
        plantillas_contables_repository.create_plantilla_contable(
            "027", {"codigo": "NOMINA", **PLANTILLA_ESCRITURA, "tipoDocumento": "NM"}
        )
    with pytest.raises(TemplateValidationError, match="tipoDocumento debe ser igual a codigo"):
        plantillas_contables_repository.create_plantilla_contable(
            "027", {"codigo": "NO", **PLANTILLA_ESCRITURA, "tipoDocumento": "NM"}
        )
    with pytest.raises(CompanyValidationError, match="entre 5 y 180"):
        plantillas_contables_repository.delete_plantilla_contable("027", "NO", reason="x")
    with pytest.raises(DocumentFormatValidationError, match="no tiene columna de comprobante"):
        formatos_documentales_repository.create_formato_documental(
            "027", {"codigo": "CE", "comprobante": "CE", **FORMATO_LEYENDA}
        )
    with pytest.raises(CompanyValidationError, match="entre 5 y 180"):
        formatos_documentales_repository.delete_formato_documental("027", "CE", reason="x")


# ---------------------------------------------------------------------------
# R10: diferencia de alcance por motor declarada en el contrato
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "endpoint, table_pg, table_ads, store_method",
    [
        (templates, "plantillas_contables", "VISDOCUM", "list_plantillas_contables"),
        (document_formats, "formatos_documentales", "CONGENF", "list_formatos_documentales"),
    ],
)
def test_nested_collection_reads_declare_the_scope_per_engine(
    monkeypatch, endpoint, table_pg: str, table_ads: str, store_method: str
) -> None:
    monkeypatch.setattr(store, store_method, lambda cia: [{"codigo": "X"}])
    monkeypatch.setattr(store, "is_postgres", lambda: False)
    respuesta_ads = endpoint(cia="027")
    assert respuesta_ads["source"] == table_ads
    assert respuesta_ads["sharedAcrossCompanies"] is True

    monkeypatch.setattr(store, "is_postgres", lambda: True)
    respuesta_pg = endpoint(cia="027")
    assert respuesta_pg["source"] == table_pg
    assert respuesta_pg["sharedAcrossCompanies"] is False
    assert respuesta_pg["count"] == 1


# ---------------------------------------------------------------------------
# R1: el despacho resuelve cada operación en los dos motores
# ---------------------------------------------------------------------------
def test_store_dispatch_resolves_every_b3_part2_operation(monkeypatch) -> None:
    llamadas: list[str] = []

    def _make(engine: str, nombre: str):
        def _implementation(*args, **kwargs):
            llamadas.append(f"{engine}:{nombre}")
            return {}

        return _implementation

    operaciones = [
        ("list_plantillas_contables", postgres_repository, plantillas_contables_repository, ("027",), {}),
        ("create_plantilla_contable", postgres_writes, plantillas_contables_repository, ("027", {"codigo": "X"}), {}),
        ("update_plantilla_contable", postgres_writes, plantillas_contables_repository, ("027", "X", {"codigo": "X"}), {}),
        ("delete_plantilla_contable", postgres_writes, plantillas_contables_repository, ("027", "X"), {"reason": "motivo de prueba"}),
        ("list_formatos_documentales", postgres_repository, formatos_documentales_repository, ("027",), {}),
        ("create_formato_documental", postgres_writes, formatos_documentales_repository, ("027", {"codigo": "X"}), {}),
        ("update_formato_documental", postgres_writes, formatos_documentales_repository, ("027", "X", {"codigo": "X"}), {}),
        ("delete_formato_documental", postgres_writes, formatos_documentales_repository, ("027", "X"), {"reason": "motivo de prueba"}),
    ]
    for nombre, modulo_pg, modulo_ads, _args, _kwargs in operaciones:
        monkeypatch.setattr(modulo_ads, nombre, _make("ads", nombre))
        monkeypatch.setattr(modulo_pg, nombre, _make("pg", nombre))

    monkeypatch.setattr(store, "is_postgres", lambda: False)
    for nombre, _pg, _ads, args, kwargs in operaciones:
        getattr(store, nombre)(*args, **kwargs)
    monkeypatch.setattr(store, "is_postgres", lambda: True)
    for nombre, _pg, _ads, args, kwargs in operaciones:
        getattr(store, nombre)(*args, **kwargs)

    assert len(llamadas) == len(operaciones) * 2
    assert sum(1 for llamada in llamadas if llamada.startswith("ads:")) == len(operaciones)
    assert sum(1 for llamada in llamadas if llamada.startswith("pg:")) == len(operaciones)


# ---------------------------------------------------------------------------
# Endpoints: delegan y usan la forma del contrato
# ---------------------------------------------------------------------------
def test_endpoints_delegate_to_the_store(monkeypatch) -> None:
    monkeypatch.setattr(store, "list_plantillas_contables", lambda cia: [{"codigo": "NO"}])
    monkeypatch.setattr(store, "list_formatos_documentales", lambda cia: [{"codigo": "CE"}])
    monkeypatch.setattr(
        store, "create_plantilla_contable", lambda cia, payload, user: {"codigo": payload["codigo"]}
    )
    monkeypatch.setattr(
        store, "update_plantilla_contable", lambda cia, codigo, payload, user: {"codigo": codigo}
    )
    monkeypatch.setattr(
        store, "create_formato_documental", lambda cia, payload, user: {"codigo": payload["codigo"]}
    )
    monkeypatch.setattr(
        store, "update_formato_documental", lambda cia, codigo, payload, user: {"codigo": codigo}
    )

    assert templates(cia="027")["count"] == 1
    assert document_formats(cia="027")["count"] == 1
    assert create_template(TemplateCreate(codigo="NO2", **PLANTILLA_ESCRITURA), cia="027")["item"] == {
        "codigo": "NO2"
    }
    assert update_template(TemplateWrite(**PLANTILLA_ESCRITURA), codigo="NO2", cia="027")["item"] == {
        "codigo": "NO2"
    }
    assert create_document_format(
        DocumentFormatCreate(codigo="CE01", **FORMATO_LEYENDA), cia="027"
    )["item"] == {"codigo": "CE01"}
    assert update_document_format(
        DocumentFormatWrite(**FORMATO_LEYENDA), codigo="CE01", cia="027"
    )["item"] == {"codigo": "CE01"}


def test_delete_endpoints_are_204_and_report_on_dry_run(monkeypatch) -> None:
    monkeypatch.setattr(
        store,
        "delete_plantilla_contable",
        lambda cia, codigo, reason, user, dry_run: {
            "codigo": codigo, "eliminada": not dry_run, "bajaLogica": True, "referencias": 0
        },
    )
    monkeypatch.setattr(
        store,
        "delete_formato_documental",
        lambda cia, codigo, reason, user, dry_run: {
            "codigo": codigo, "eliminada": not dry_run, "bajaLogica": False, "referencias": None
        },
    )
    baja = delete_template(
        Response(status_code=204), codigo="NO", cia="027", motivo="ya no se usa",
        usuario="WEB", dry_run=False,
    )
    assert isinstance(baja, Response)
    assert baja.status_code == 204

    respuesta = Response(status_code=204)
    simulacion = delete_document_format(
        respuesta, codigo="CE", cia="027", motivo="ya no se usa", usuario="WEB", dry_run=True
    )
    assert respuesta.status_code == 200
    assert isinstance(simulacion, dict)
    assert simulacion["dryRun"] is True
    assert simulacion["item"]["eliminada"] is False


# ---------------------------------------------------------------------------
# R5: errores estables de las excepciones de dominio nuevas
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "excepcion, esperado",
    [
        (TemplateAlreadyExists("x"), 409),
        (TemplateConflict("x"), 409),
        (DocumentFormatAlreadyExists("x"), 409),
        (TemplateNotFound("x"), 404),
        (DocumentFormatNotFound("x"), 404),
        (TemplateValidationError("x"), 422),
        (DocumentFormatValidationError("x"), 422),
    ],
)
def test_service_error_mapping_is_stable_for_part2(excepcion: Exception, esperado: int) -> None:
    error = app_module._service_error(excepcion)
    assert error.status_code == esperado
    assert error.detail == "x"
