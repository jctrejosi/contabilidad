"""Formatos documentales (bloque B3, pantalla FormatosDocumentales): contrato y rama Advantage.

**Doble motor declarado (R10).** En PostgreSQL el formato tiene cabecera
(``formatos_documentales``, ``UNIQUE (compania_id, codigo)``) y elementos visuales
(``formato_elementos``, con ocho clases en el ``CHECK``); en el legado la cabecera
es ``CONGENF`` y las posiciones ``CONFORMA`` (y su copia reducida ``CONFACTU``).
La ruta acepta ``cia`` y declara el alcance con ``sharedAcrossCompanies`` (el
legado no tiene ``CIA``).

**Mapeo real** (``DICCIONARIO_DEPURADO_CONTABDSI.md`` L2832-2913;
``db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md`` L43-49 y L515-546):

- Cabecera ← ``CONGENF.CODIGO`` (2) y ``CONGENF.NOMBRE`` (25).
- Elemento ← ``CONFORMA``: ``LEYENDA`` es el texto, ``CAMPO`` la expresión de un
  campo, ``FILA``/``COLUMNA`` (y su segundo juego ``FILA2``/``COLUMNA2``) la
  posición, ``LONGITUD`` la longitud del campo, y ``FUENTE``/``TIPOFTE`` el tamaño
  y la tipografía. ``GRAVAFOR`` (``FACTAB.PRG:879-880``) escribe ``CONFORMA`` y
  ``CONFACTU`` a la vez; la segunda es la copia reducida (14 columnas, sin
  ``FILA2``/``COLUMNA2``/``FUENTE``/``TIPOFTE``) y esta rama no la reproduce ni la
  mantiene en la baja: las tres rutas de escritura tocan ``CONGENF`` y ``CONFORMA``.

**Diferencias del legado que se declaran, no se suplen:**

- ``CONGENF`` **no tiene columna de comprobante**: ``comprobante`` viaja vacío en el
  ``GET`` y una petición que lo traiga se rechaza, porque ``AMBIENTE``/``CONFIGURA``
  son ajustes del listado, no el comprobante del documento.
- La clase del elemento no es una de las ocho del modelo: ``CONFORMA.TIPO`` es un
  carácter del legado y ``CAMPO``/``ARCHI`` son una expresión y un archivo. El
  traspaso lo declara sin rodeos (``docs/sesiones/2026-09-21-migracion-contabdsi.md``
  L23857-23861: "el editor CONGENF/CONFORMA utiliza catálogo de campos, expresiones
  y secciones que exceden los ocho tipos permitidos en ``formato_elementos``"). Por
  eso esta rama **solo representa ``Leyenda``**, el único caso sin ambigüedad (texto
  en ``LEYENDA``, sin ``CAMPO``): las otras siete clases se rechazan al escribir y,
  al leer, la posición que no es una leyenda se cuenta en
  ``elementosNoRepresentados`` en vez de inventarle una clase o perderla en
  silencio.
- La geometría es de **posiciones de listado**, no del editor: ``LONGITUD`` es la
  longitud del campo en caracteres, no el ancho del recuadro, y no hay columna para
  ``ancho`` ni ``alto`` (se rechazan al escribir y viajan nulos al leer). Tampoco hay
  columna de orden: ``orden`` es la posición de lectura y, al escribir, la posición
  de la petición. ``CONFORMA.FILA``/``COLUMNA`` son DOUBLE(8,2), la misma unidad
  decimal que el editor.
- ``CONGENF``/``CONFORMA`` no tienen ``eliminado_en``: la baja es **física** y se
  declara con ``bajaLogica: False``. No rompe la reimpresión histórica porque la
  impresión de documentos usa mientras tanto un formato predeterminado y no los
  formatos configurables del legado (``docs/informes/INFORMES_ADS.md`` L33-34).
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any

from .accounting_lock import accounting_write_lock
from .ads_repository import (
    ADO_TYPE_DOUBLE,
    ADO_TYPE_INTEGER,
    ADO_TYPE_VARCHAR,
    CompanyNotFound,
    _company_exists,
    _execute,
    _number,
    _open_recordset,
    _rows,
    _text,
    ads_connection,
    ads_odbc_connection,
    normalize_company_code,
)
from .auditoria_repository import (
    register_master_creation,
    register_master_deletion,
    register_master_update,
)
from .companias_repository import validate_company_reason
from .lotes_repository import _one


FORMAT_CODE = re.compile(r"^[A-Za-z0-9]{1,10}$")
# ``CONGENF.CODIGO`` ocupa 2 posiciones.
FORMAT_LEGACY_CODE = re.compile(r"^[A-Za-z0-9]{1,2}$")
FORMAT_NAME_SIZE = 40
# ``CONGENF.NOMBRE`` es CHARACTER(25).
FORMAT_LEGACY_NAME_SIZE = 25
FORMAT_COMPROBANTE = re.compile(r"^[A-Za-z0-9]{0,2}$")
FORMAT_CONTENT_SIZE = 200
# ``CONFORMA.LEYENDA`` es CHARACTER(130).
FORMAT_LEGACY_CONTENT_SIZE = 130
FORMAT_FONT_SIZE = 40
# ``CONFORMA.TIPOFTE`` es CHARACTER(20).
FORMAT_LEGACY_FONT_SIZE = 20
FORMAT_ELEMENT_MIN = 1
FORMAT_ELEMENT_MAX = 200
# Las ocho clases del ``CHECK`` de ``formato_elementos``
# (``db/postgresql/schema/03_maestros.sql:283-285``).
FORMAT_ELEMENT_TYPES = (
    "Leyenda", "Imagen", "Rectangulo", "Linea",
    "CampoComprobante", "CampoDocumento", "CampoFecha", "CampoTotal",
)
# La única clase que el positioner del legado puede representar sin ambigüedad.
FORMAT_LEGACY_ELEMENT_TYPE = "Leyenda"
FORMAT_COORDINATE = Decimal("99999999.99")
FORMAT_LEGACY_COLUMNS = ("CODIGO", "LEYENDA", "FILA", "COLUMNA", "LONGITUD", "TIPOFTE", "FUENTE")


class DocumentFormatAlreadyExists(RuntimeError):
    """Ya existe un formato con el mismo código (el código es la clave)."""


class DocumentFormatNotFound(RuntimeError):
    """No existe el formato pedido."""


class DocumentFormatValidationError(ValueError):
    """El formato incumple las reglas de formatos_documentales/CONGENF."""


def _coordenada(value: Any, etiqueta: str) -> Decimal:
    """Coordenada decimal de dos posiciones, no negativa (misma unidad que el editor)."""
    try:
        numero = Decimal("0") if value in (None, "") else Decimal(str(value).strip())
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise DocumentFormatValidationError(f"La coordenada {etiqueta} debe ser numérica.") from exc
    if numero < 0:
        raise DocumentFormatValidationError(f"La coordenada {etiqueta} no puede ser negativa.")
    if numero > FORMAT_COORDINATE:
        raise DocumentFormatValidationError(
            f"La coordenada {etiqueta} admite máximo {FORMAT_COORDINATE}."
        )
    return numero.quantize(Decimal("0.01"))


def _coordenada_opcional(value: Any, etiqueta: str) -> Decimal | None:
    """``ancho``/``alto``: opcionales, pero con la misma unidad si vienen."""
    if value in (None, ""):
        return None
    return _coordenada(value, etiqueta)


def _format_element(value: Any, numero: int) -> dict[str, Any]:
    """Un elemento del editor: clase, contenido, geometría, tipografía y orden."""
    if not isinstance(value, dict):
        raise DocumentFormatValidationError(
            f"Elemento {numero}: se esperaba un objeto de elemento."
        )
    tipo = str(value.get("tipo", "") or "").strip()
    if tipo not in FORMAT_ELEMENT_TYPES:
        raise DocumentFormatValidationError(
            f"Elemento {numero}: el tipo {tipo or '(vacío)'} no es uno de los ocho del "
            "editor: " + ", ".join(FORMAT_ELEMENT_TYPES) + "."
        )
    contenido = str(value.get("contenido", "") or "").strip()
    if len(contenido) > FORMAT_CONTENT_SIZE:
        raise DocumentFormatValidationError(
            f"Elemento {numero}: el contenido admite máximo {FORMAT_CONTENT_SIZE} caracteres."
        )
    fuente = str(value.get("fuente", "") or "").strip()
    if len(fuente) > FORMAT_FONT_SIZE:
        raise DocumentFormatValidationError(
            f"Elemento {numero}: la fuente admite máximo {FORMAT_FONT_SIZE} caracteres."
        )
    return {
        "tipo": tipo,
        "contenido": contenido,
        "x": _coordenada(value.get("x"), "x"),
        "y": _coordenada(value.get("y"), "y"),
        "ancho": _coordenada_opcional(value.get("ancho"), "ancho"),
        "alto": _coordenada_opcional(value.get("alto"), "alto"),
        "fuente": fuente,
        "orden": _orden(value.get("orden"), numero),
    }


def _orden(value: Any, numero: int) -> int:
    """Orden del elemento: entero no negativo; si falta, el de la posición."""
    if value in (None, ""):
        return numero
    try:
        orden = int(value)
    except (TypeError, ValueError) as exc:
        raise DocumentFormatValidationError(
            f"Elemento {numero}: el orden debe ser un entero."
        ) from exc
    if orden < 0:
        raise DocumentFormatValidationError(f"Elemento {numero}: el orden no puede ser negativo.")
    return orden


def normalize_document_format(payload: dict[str, Any]) -> dict[str, Any]:
    """Valida y normaliza el contrato de escritura de un formato (B3, sección 6)."""
    codigo = str(payload.get("codigo", "") or "").strip().upper()
    if not FORMAT_CODE.fullmatch(codigo):
        raise DocumentFormatValidationError(
            "El código del formato debe tener entre 1 y 10 letras o dígitos."
        )
    nombre = str(payload.get("nombre", "") or "").strip()
    if not nombre:
        raise DocumentFormatValidationError("El nombre del formato es obligatorio.")
    if len(nombre) > FORMAT_NAME_SIZE:
        raise DocumentFormatValidationError(
            f"El nombre del formato admite máximo {FORMAT_NAME_SIZE} caracteres."
        )
    comprobante = str(payload.get("comprobante", "") or "").strip().upper()
    if not FORMAT_COMPROBANTE.fullmatch(comprobante):
        raise DocumentFormatValidationError(
            "El comprobante del formato debe tener hasta 2 letras o dígitos."
        )
    elementos = payload.get("elementos")
    if not isinstance(elementos, (list, tuple)):
        raise DocumentFormatValidationError("El formato debe traer su lista de elementos.")
    if not FORMAT_ELEMENT_MIN <= len(elementos) <= FORMAT_ELEMENT_MAX:
        raise DocumentFormatValidationError(
            f"El formato debe tener entre {FORMAT_ELEMENT_MIN} y {FORMAT_ELEMENT_MAX} elementos."
        )
    return {
        "codigo": codigo,
        "nombre": nombre,
        "comprobante": comprobante,
        "elementos": [
            _format_element(elemento, numero)
            for numero, elemento in enumerate(elementos, start=1)
        ],
    }


def document_format_item(data: dict[str, Any]) -> dict[str, Any]:
    """Elemento devuelto por las rutas de escritura; ecoa el contrato de escritura."""
    return {
        "codigo": data["codigo"],
        "nombre": data["nombre"],
        "comprobante": data.get("comprobante", ""),
        "elementos": [
            {
                "tipo": elemento["tipo"],
                "contenido": elemento["contenido"],
                "x": float(elemento["x"]),
                "y": float(elemento["y"]),
                "ancho": None if elemento["ancho"] is None else float(elemento["ancho"]),
                "alto": None if elemento["alto"] is None else float(elemento["alto"]),
                "fuente": elemento["fuente"],
                "orden": elemento["orden"],
            }
            for elemento in data["elementos"]
        ],
    }


def _reject_unsupported(data: dict[str, Any]) -> None:
    """Declara lo que ``CONGENF``/``CONFORMA`` no pueden representar."""
    if not FORMAT_LEGACY_CODE.fullmatch(data["codigo"]):
        raise DocumentFormatValidationError(
            "CONGENF admite códigos de máximo 2 caracteres: el código largo solo se "
            "puede usar con PostgreSQL."
        )
    if len(data["nombre"]) > FORMAT_LEGACY_NAME_SIZE:
        raise DocumentFormatValidationError(
            f"CONGENF.NOMBRE admite máximo {FORMAT_LEGACY_NAME_SIZE} caracteres."
        )
    if data["comprobante"]:
        raise DocumentFormatValidationError(
            "CONGENF no tiene columna de comprobante: el comprobante del formato solo "
            "se puede fijar en PostgreSQL."
        )
    for posicion, elemento in enumerate(data["elementos"], start=1):
        if elemento["tipo"] != FORMAT_LEGACY_ELEMENT_TYPE:
            raise DocumentFormatValidationError(
                f"Elemento {posicion}: el legado guarda posiciones de listado "
                "(CONFORMA.CAMPO/ARCHI/TIPO), no la clase "
                f"{elemento['tipo']} del editor; solo {FORMAT_LEGACY_ELEMENT_TYPE} se "
                "puede representar en Advantage."
            )
        if elemento["ancho"] is not None or elemento["alto"] is not None:
            raise DocumentFormatValidationError(
                f"Elemento {posicion}: CONFORMA no tiene ancho ni alto de recuadro "
                "(LONGITUD es la longitud del campo en caracteres): las dimensiones "
                "solo se pueden fijar en PostgreSQL."
            )
        if len(elemento["contenido"]) > FORMAT_LEGACY_CONTENT_SIZE:
            raise DocumentFormatValidationError(
                f"Elemento {posicion}: CONFORMA.LEYENDA admite máximo "
                f"{FORMAT_LEGACY_CONTENT_SIZE} caracteres."
            )
        if len(elemento["fuente"]) > FORMAT_LEGACY_FONT_SIZE:
            raise DocumentFormatValidationError(
                f"Elemento {posicion}: CONFORMA.TIPOFTE admite máximo "
                f"{FORMAT_LEGACY_FONT_SIZE} caracteres."
            )


def _legacy_font(value: str) -> tuple[str, float]:
    """``"Arial 10"`` → ``("Arial", 10.0)``: ``TIPOFTE`` + ``FUENTE``."""
    texto = str(value or "").strip()
    coincidencia = re.search(r"(\d+(?:[.,]\d+)?)\s*$", texto)
    if coincidencia is None:
        return texto, 0.0
    tamano = float(coincidencia.group(1).replace(",", "."))
    return texto[: coincidencia.start()].strip(), tamano


def _legacy_font_text(row: dict[str, Any]) -> str:
    """``TIPOFTE``/``FUENTE`` del legado → la ``fuente`` del contrato."""
    tipo = _text(row.get("TIPOFTE"))
    tamano = _number(row.get("FUENTE"))
    if not tamano:
        return tipo
    return f"{tipo} {tamano:g}".strip()


def _element_from_row(row: dict[str, Any], orden: int) -> dict[str, Any] | None:
    """Traduce una posición de ``CONFORMA``; ``None`` si el contrato no la representa.

    Solo la leyenda (texto en ``LEYENDA`` y sin ``CAMPO``) tiene una clase
    inequívoca entre las ocho del modelo. Las posiciones de campo o de gráfico se
    cuentan aparte: no se les inventa una clase.
    """
    leyenda = _text(row.get("LEYENDA"))
    if _text(row.get("CAMPO")) or not leyenda:
        return None
    return {
        "tipo": FORMAT_LEGACY_ELEMENT_TYPE,
        "contenido": leyenda,
        "x": _number(row.get("COLUMNA")),
        "y": _number(row.get("FILA")),
        # ``LONGITUD`` es la longitud del campo, no el ancho del recuadro.
        "ancho": None,
        "alto": None,
        "fuente": _legacy_font_text(row),
        "orden": orden,
    }


def _format_from_rows(
    codigo: str, nombre: str, filas: list[dict[str, Any]]
) -> dict[str, Any]:
    """Contrato de un formato: cabecera de ``CONGENF`` y posiciones de ``CONFORMA``."""
    elementos: list[dict[str, Any]] = []
    no_representados = 0
    for fila in filas:
        elemento = _element_from_row(fila, len(elementos) + 1)
        if elemento is None:
            no_representados += 1
        else:
            elementos.append(elemento)
    return {
        "codigo": codigo,
        "nombre": nombre,
        # ``CONGENF`` no tiene comprobante: se declara, no se inventa.
        "comprobante": "",
        "elementos": elementos,
        "elementosNoRepresentados": no_representados,
    }


def _header(connection: Any, codigo: str) -> dict[str, Any] | None:
    """Fila de ``CONGENF`` del código, o ``None`` si no existe."""
    return _one(
        connection,
        "SELECT TOP 1 CODIGO, NOMBRE FROM CONGENF WHERE CODIGO = ?",
        [(ADO_TYPE_VARCHAR, 2, codigo)],
    )


def list_formatos_documentales(cia: str) -> list[dict[str, Any]]:
    """Formatos del maestro global ``CONGENF`` con sus posiciones de ``CONFORMA``."""
    company_id = normalize_company_code(cia)
    with ads_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        headers = _open_recordset(
            connection, "SELECT CODIGO, NOMBRE FROM CONGENF ORDER BY CODIGO"
        )
        try:
            cabeceras = list(_rows(headers))
        finally:
            headers.Close()
        elements = _open_recordset(
            connection,
            "SELECT CODIGO, CAMPO, LEYENDA, FILA, COLUMNA, FUENTE, TIPOFTE "
            "FROM CONFORMA",
        )
        try:
            posiciones: dict[str, list[dict[str, Any]]] = {}
            for row in _rows(elements):
                posiciones.setdefault(_text(row.get("CODIGO")), []).append(row)
        finally:
            elements.Close()
    return [
        _format_from_rows(
            _text(cabecera.get("CODIGO")),
            _text(cabecera.get("NOMBRE")),
            posiciones.get(_text(cabecera.get("CODIGO")), []),
        )
        for cabecera in cabeceras
    ]


def _element_parameters(data: dict[str, Any]) -> list[tuple[int, int, Any]]:
    """Parámetros ADODB de una posición de ``CONFORMA``, en el orden de sus columnas."""
    parametros: list[tuple[int, int, Any]] = []
    for posicion, elemento in enumerate(data["elementos"], start=1):
        tipo_fuente, tamano = _legacy_font(elemento["fuente"])
        parametros.extend(
            [
                (ADO_TYPE_VARCHAR, 2, data["codigo"]),
                (ADO_TYPE_VARCHAR, FORMAT_LEGACY_CONTENT_SIZE, elemento["contenido"]),
                (ADO_TYPE_DOUBLE, 0, float(elemento["y"])),
                (ADO_TYPE_DOUBLE, 0, float(elemento["x"])),
                # ``LONGITUD`` es la longitud del campo: la del texto de la leyenda.
                (ADO_TYPE_INTEGER, 0, len(elemento["contenido"])),
                (ADO_TYPE_VARCHAR, FORMAT_LEGACY_FONT_SIZE, tipo_fuente),
                (ADO_TYPE_DOUBLE, 0, tamano),
            ]
        )
    return parametros


def _insert_elements(connection: Any, data: dict[str, Any]) -> None:
    """Escribe el bloque de posiciones: ``INSERT`` por elemento, mismo contrato."""
    valores = ", ".join("?" for _ in FORMAT_LEGACY_COLUMNS)
    parametros = _element_parameters(data)
    fila = len(FORMAT_LEGACY_COLUMNS)
    for inicio in range(0, len(parametros), fila):
        _execute(
            connection,
            f"INSERT INTO CONFORMA ({', '.join(FORMAT_LEGACY_COLUMNS)}) VALUES ({valores})",
            parametros[inicio : inicio + fila],
        )


def create_formato_documental(
    cia: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Crea un formato con sus posiciones en ``CONGENF``/``CONFORMA`` (B3.2).

    El legado solo admite leyendas y no tiene comprobante: ambas limitaciones se
    declaran y se rechazan antes de conectar (R10).
    """
    data = normalize_document_format(payload)
    _reject_unsupported(data)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _header(connection, data["codigo"]) is not None:
            raise DocumentFormatAlreadyExists(f"Ya existe el formato {data['codigo']}.")
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "INSERT INTO CONGENF (CODIGO, NOMBRE) VALUES (?, ?)",
                [
                    (ADO_TYPE_VARCHAR, 2, data["codigo"]),
                    (ADO_TYPE_VARCHAR, FORMAT_LEGACY_NAME_SIZE, data["nombre"]),
                ],
            )
            _insert_elements(connection, data)
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    item = document_format_item(data)
    try:
        register_master_creation(user, "CONGENF", data["codigo"], "Alta de formato documental")
    except Exception as exc:
        item["advertencia"] = (
            f"El formato se creó, pero no fue posible registrar la bitácora: {exc}"
        )
    return item


def update_formato_documental(
    cia: str, codigo: str, payload: dict[str, Any], *, user: str = "WEB"
) -> dict[str, Any]:
    """Modifica el formato y reemplaza sus posiciones en bloque (B3.3).

    El reemplazo en bloque (borrar y reinsertar dentro de la transacción) es el
    mismo kardex que PostgreSQL y el que evita posiciones huérfanas.
    """
    code = str(codigo or "").strip().upper()
    if not FORMAT_CODE.fullmatch(code):
        raise DocumentFormatValidationError(
            "El código del formato debe tener entre 1 y 10 letras o dígitos."
        )
    data = normalize_document_format({**payload, "codigo": code})
    _reject_unsupported(data)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _header(connection, code) is None:
            raise DocumentFormatNotFound(f"No existe el formato {code}.")
        connection.BeginTrans()
        try:
            _execute(
                connection,
                "UPDATE CONGENF SET NOMBRE = ? WHERE CODIGO = ?",
                [
                    (ADO_TYPE_VARCHAR, FORMAT_LEGACY_NAME_SIZE, data["nombre"]),
                    (ADO_TYPE_VARCHAR, 2, code),
                ],
            )
            # Kardex de reglas: el bloque se reemplaza completo, nunca por posición.
            _execute(
                connection,
                "DELETE FROM CONFORMA WHERE CODIGO = ?",
                [(ADO_TYPE_VARCHAR, 2, code)],
            )
            _insert_elements(connection, data)
            connection.CommitTrans()
        except Exception:
            try:
                connection.RollbackTrans()
            except Exception:
                pass
            raise
    item = document_format_item(data)
    try:
        register_master_update(user, "CONGENF", code, "Modificación de formato documental")
    except Exception as exc:
        item["advertencia"] = (
            f"El formato se modificó, pero no fue posible registrar la bitácora: {exc}"
        )
    return item


def delete_formato_documental(
    cia: str, codigo: str, *, reason: str, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Retira el formato de ``CONGENF`` y sus posiciones de ``CONFORMA`` (B3.4).

    ``CONGENF``/``CONFORMA`` no tienen ``eliminado_en``: la baja es física y el
    código queda libre, que es lo que la tabla realmente permite. Se declara con
    ``bajaLogica: False``. La copia reducida ``CONFACTU`` no la mantiene esta rama
    (diferencia declarada en el módulo).
    """
    code = str(codigo or "").strip().upper()
    if not FORMAT_CODE.fullmatch(code):
        raise DocumentFormatValidationError(
            "El código del formato debe tener entre 1 y 10 letras o dígitos."
        )
    motivo = validate_company_reason(reason)
    company_id = normalize_company_code(cia)
    with accounting_write_lock, ads_odbc_connection() as connection:
        if not _company_exists(connection, company_id):
            raise CompanyNotFound(f"No existe la compañía {cia}.")
        if _header(connection, code) is None:
            raise DocumentFormatNotFound(f"No existe el formato {code}.")
        if not dry_run:
            connection.BeginTrans()
            try:
                for tabla in ("CONFORMA", "CONGENF"):
                    _execute(
                        connection,
                        f"DELETE FROM {tabla} WHERE CODIGO = ?",
                        [(ADO_TYPE_VARCHAR, 2, code)],
                    )
                connection.CommitTrans()
            except Exception:
                try:
                    connection.RollbackTrans()
                except Exception:
                    pass
                raise
    if not dry_run:
        try:
            register_master_deletion(user, "CONGENF", code, motivo)
        except Exception:
            pass
    return {
        "codigo": code,
        "eliminada": not dry_run,
        "bajaLogica": False,
        "referencias": None,
    }
