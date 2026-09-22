"""Contratos y doble motor del bloque D5+D6+D7: administración.

**Doble motor declarado (R10).** Las once rutas del bloque tienen el mismo
contrato JSON en los dos motores. Este módulo concentra:

- el contrato **puro** que comparten las ramas (``normalize_*`` y los helpers de
  validación), de modo que el resultado no pueda divergir entre motores;
- la implementación **PostgreSQL** (lecturas y escrituras), que en esta entrega
  vive aquí y **no** se reparte en :mod:`backend.postgres_writes` como en D2;
- la rama **Advantage**, que es una **declaración de alcance** honesta: el legado
  solo documenta contrapartes parciales para usuarios/permisos (``VISUSU``,
  ``CONOPER``) y para la bitácora (``VISAUDI``), y **ninguna** para
  ``usuario_companias`` ni para ``integraciones``
  (``db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md``). Por eso las once rutas declaran la
  brecha con **503** (el mismo patrón de los cierres en D2), en vez de simular un
  correo, un rol, un catálogo de permisos o una bitácora que el legado no tiene.

El despacho por operación vive en :mod:`backend.store` (R1). Los helpers de
conexión y bitácora se importan **dentro** de cada función para no crear ciclos
de importación con ``postgres_repository`` / ``postgres_writes``.

**Reglas transversales del bloque** (``docs/plan/backend/detalle/administracion.md``):

- toda escritura exige ``motivo`` (5..180) y deja fila explícita en ``auditoria``
  (los disparadores son **solo BEFORE UPDATE**, así que el INSERT es obligatorio);
- ``dry_run=True`` no escribe (rollback) y devuelve el mismo informe con
  ``dryRun`` verdadero;
- las bajas de usuario son lógicas (``usuarios.eliminado_en``) y la bitácora del
  usuario **no** se toca;
- la instalación no puede quedarse sin rol administrador activo (409) ni el rol
  ``ADMIN`` sin permisos (409).
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterable
from datetime import date
from typing import Any

# ---------------------------------------------------------------------------
# Constantes de contrato (R6: los códigos se validan con patrón)
# ---------------------------------------------------------------------------
COMPANY_CODE = re.compile(r"^[0-9]{1,3}$")
# El código de rol admite letras, dígitos, punto, guion y guion bajo (ADMIN,
# CONTADOR, AUXILIAR…), con el máximo de 20 del path ``/roles/{codigo}/permisos``.
ROLE_CODE = re.compile(r"^[A-Za-z0-9_.-]{1,20}$")
# Formato mínimo de correo: algo antes y algo después de la arroba, sin espacios.
# La lección de H18: la regla no puede vivir solo en el modal.
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+$")
# Filtros de fecha ``YYYY-MM-DD`` (``max_length=10``).
ISO_DATE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")

MAX_NAME = 60
MAX_EMAIL = 60
MAX_INITIALS = 4
MAX_MODULE = 40
MAX_PERMISSIONS = 200
PAGE_SIZE_MAX = 200
MAX_SEARCH = 60

MIN_REASON = 5
MAX_REASON = 180
MAX_USER = 4

# El rol de administración es el único con la regla de "no quedarse sin nadie"
# (§1.3, §1.4 y §1.6). Es código literal, como declara el plan.
ADMIN_ROLE_CODE = "ADMIN"

USER_STATES = ("todos", "activo", "inactivo")
AUDIT_RESULTS = ("todos", "EXITO", "FALLO", "INFO")
INTEGRATION_STATES = ("Conectado", "Desconectado", "Bloqueado")
EXPORT_FORMATS = ("xlsx", "csv")

# Columnas de la exportación de bitácora (§2.2), en el orden del contrato de §2.1.
AUDIT_EXPORT_COLUMNS = (
    "id", "fecha", "usuario", "rol", "accion", "modulo", "detalle", "resultado", "motivo",
)
AUDIT_EXPORT_HEADERS = (
    "ID", "Fecha", "Usuario", "Rol", "Acción", "Módulo", "Detalle", "Resultado", "Motivo",
)

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CSV_MEDIA_TYPE = "text/csv; charset=utf-8"

# ---------------------------------------------------------------------------
# Mensajes declarados de la rama heredada (R10) — cada uno cita su evidencia
# ---------------------------------------------------------------------------
LEGACY_USERS_MESSAGE = (
    "El contrato de usuarios/roles/permisos solo está implementado con PostgreSQL. "
    "El legado no tiene las tablas roles, permisos ni rol_permisos y su contraparte "
    "VISUSU/CONOPER (db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md) solo aporta "
    "IINICIAL/INOMBRE/IPASSWORD/IVENCE: sin correo, sin estado, sin rol y sin catálogo "
    "de permisos. La matriz las declara 'Parcial' y prohíbe copiar 'permisos permisivos "
    "ni claves en claro' (P28), así que la rama no se puede implementar sin simular."
)

LEGACY_COMPANIES_MESSAGE = (
    "La asignación de compañías por usuario no tiene contraparte en el legado: "
    "usuario_companias es un aporte del modelo nuevo "
    "(db/postgresql/schema/08_seguridad.sql:94-101) y la matriz lo confirma al pedir "
    "'agregar usuario_companias y homologación de identificadores' "
    "(db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md, VISUSU/CONOPER). La ruta solo está "
    "implementada con PostgreSQL."
)

LEGACY_AUDIT_MESSAGE = (
    "La lectura de la bitácora solo está implementada con PostgreSQL. VISAUDI "
    "(db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md) solo documenta USUARIO, HORA, MODULO, "
    "DOCUMENTO, MOTIVO, TIPO y FECHA: no tiene identificador de usuario ni de rol, ni "
    "el resultado EXITO/FALLO/INFO que exige el contrato (§2.1), y resolverlos "
    "inventando columnas sería simular la bitácora en vez de publicarla."
)

LEGACY_INTEGRATIONS_MESSAGE = (
    "Las integraciones requieren la tabla nueva integraciones en ADS: el legado solo "
    "declara la contraparte como 'Integración requerida' (P30), porque integraciones "
    "guarda configuración y estado, no los registros del módulo "
    "(db/old_db/MATRIZ_TABLAS_Y_BRECHAS.md, CADEMP/CADMAE/EVENTOS). La ruta solo está "
    "implementada con PostgreSQL."
)


# ---------------------------------------------------------------------------
# Excepciones de dominio (R5) — el backend las mapea a HTTP
# ---------------------------------------------------------------------------
class AdminNotFound(RuntimeError):
    """No existe el recurso de administración pedido (404)."""


class AdminConflict(RuntimeError):
    """La operación rompe una regla de negocio del modelo (409)."""


class AdminValidationError(ValueError):
    """El cuerpo o los parámetros incumplen el contrato (422)."""


class AdminLegacyNotSupported(RuntimeError):
    """La operación no tiene representación honesta en el legado (503, R10)."""


# ---------------------------------------------------------------------------
# Helpers puros de contrato
# ---------------------------------------------------------------------------
def _postgres() -> bool:
    """¿El motor activo es el modelo nuevo? (importa ``store`` sin ciclo)."""
    from .store import is_postgres

    return is_postgres()


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _nombre(value: Any) -> str:
    nombre = _text(value)
    if not 1 <= len(nombre) <= MAX_NAME:
        raise AdminValidationError(
            f"El nombre es obligatorio y debe tener entre 1 y {MAX_NAME} caracteres."
        )
    return nombre


def _email(value: Any) -> str:
    correo = _text(value)
    if not 1 <= len(correo) <= MAX_EMAIL:
        raise AdminValidationError(
            f"El correo es obligatorio y debe tener entre 1 y {MAX_EMAIL} caracteres."
        )
    if not EMAIL.fullmatch(correo):
        raise AdminValidationError(f"El correo «{correo}» no tiene un formato válido.")
    return correo


def _rol(value: Any) -> str:
    codigo = _text(value)
    if not ROLE_CODE.fullmatch(codigo):
        raise AdminValidationError(
            "El rol es obligatorio y debe ser un código de hasta 20 caracteres."
        )
    return codigo


def _iniciales(value: Any) -> str:
    iniciales = _text(value)
    if len(iniciales) > MAX_INITIALS:
        raise AdminValidationError(f"Las iniciales admiten máximo {MAX_INITIALS} caracteres.")
    return iniciales


def _activo(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() not in {"", "0", "false", "f", "no", "n"}


def _usuario(value: Any) -> str:
    usuario = _text(value).upper() or "WEB"
    if len(usuario) > MAX_USER:
        raise AdminValidationError(f"El usuario admite máximo {MAX_USER} caracteres.")
    return usuario


def _motivo(value: Any) -> str:
    motivo = _text(value)
    if not MIN_REASON <= len(motivo) <= MAX_REASON:
        raise AdminValidationError(
            f"El motivo es obligatorio y debe tener entre {MIN_REASON} y {MAX_REASON} caracteres."
        )
    return motivo


def _companias(value: Any, *, obligatoria: bool) -> list[str]:
    """Normaliza la lista de códigos de compañía, sin repetidos y en orden."""
    if value is None:
        value = []
    if not isinstance(value, list):
        raise AdminValidationError("Las compañías deben venir en una lista de códigos.")
    codigos: list[str] = []
    for item in value:
        codigo = _text(item)
        if not COMPANY_CODE.fullmatch(codigo) or int(codigo) <= 0:
            raise AdminValidationError(
                f"La compañía «{codigo}» debe tener entre 1 y 3 dígitos."
            )
        if codigo not in codigos:
            codigos.append(codigo)
    if obligatoria and not codigos:
        raise AdminValidationError(
            "Debe indicar al menos una compañía: un usuario sin acceso a ninguna no tiene uso."
        )
    return codigos


def _cia(value: Any, *, obligatoria: bool = False) -> str:
    codigo = _text(value)
    if not codigo:
        if obligatoria:
            raise AdminValidationError("Indique la compañía activa (cia).")
        return ""
    if not COMPANY_CODE.fullmatch(codigo) or int(codigo) <= 0:
        raise AdminValidationError("El código de compañía debe contener entre 1 y 3 dígitos.")
    return codigo


def _modulo(value: Any) -> str:
    modulo = _text(value)
    if not 1 <= len(modulo) <= MAX_MODULE:
        raise AdminValidationError(
            f"El módulo es obligatorio y debe tener entre 1 y {MAX_MODULE} caracteres."
        )
    return modulo


def _page(value: Any) -> int:
    try:
        page = int(value)
    except (TypeError, ValueError) as exc:
        raise AdminValidationError("La página debe ser un número entero.") from exc
    if page < 1:
        raise AdminValidationError("La página debe ser mayor o igual a 1.")
    return page


def _page_size(value: Any) -> int:
    try:
        page_size = int(value)
    except (TypeError, ValueError) as exc:
        raise AdminValidationError("El tamaño de página debe ser un número entero.") from exc
    if not 1 <= page_size <= PAGE_SIZE_MAX:
        raise AdminValidationError(
            f"El tamaño de página debe estar entre 1 y {PAGE_SIZE_MAX}."
        )
    return page_size


def _estado_usuario(value: Any) -> str:
    estado = _text(value) or "todos"
    if estado not in USER_STATES:
        raise AdminValidationError(
            "El estado debe ser «todos», «activo» o «inactivo»."
        )
    return estado


def _resultado(value: Any) -> str:
    resultado = _text(value) or "todos"
    if resultado not in AUDIT_RESULTS:
        raise AdminValidationError(
            "El resultado debe ser «todos», «EXITO», «FALLO» o «INFO»."
        )
    return resultado


def _busqueda(value: Any, *, campo: str, maximo: int = MAX_SEARCH) -> str:
    termino = _text(value)
    if len(termino) > maximo:
        raise AdminValidationError(f"El filtro de {campo} admite máximo {maximo} caracteres.")
    return termino


def _fecha(value: Any, campo: str) -> str:
    fecha = _text(value)
    if not fecha:
        return ""
    if not ISO_DATE.fullmatch(fecha):
        raise AdminValidationError(
            f"{campo} debe tener el formato YYYY-MM-DD."
        )
    return fecha


def _formato(value: Any) -> str:
    formato = _text(value) or "xlsx"
    if formato not in EXPORT_FORMATS:
        raise AdminValidationError("El formato debe ser «xlsx» o «csv».")
    return formato


def _estado_integracion(value: Any) -> str:
    estado = _text(value)
    if estado not in INTEGRATION_STATES:
        raise AdminValidationError(
            "El estado debe ser «Conectado», «Desconectado» o «Bloqueado»."
        )
    return estado


def _configuracion(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise AdminValidationError("La configuración debe ser un objeto JSON.")
    return value


# ---------------------------------------------------------------------------
# Normalización de los cuerpos (validación antes de abrir la conexión)
# ---------------------------------------------------------------------------
def normalize_user(payload: dict[str, Any]) -> dict[str, Any]:
    """Cuerpo de creación de usuario (§1.2): incluye ``companias`` (obligatoria)."""
    return {
        "nombre": _nombre(payload.get("nombre")),
        "email": _email(payload.get("email")),
        "rol": _rol(payload.get("rol")),
        "iniciales": _iniciales(payload.get("iniciales")),
        "activo": _activo(payload.get("activo")),
        "companias": _companias(payload.get("companias"), obligatoria=True),
        "usuario": _usuario(payload.get("usuario")),
        "motivo": _motivo(payload.get("motivo")),
    }


def normalize_user_update(payload: dict[str, Any]) -> dict[str, Any]:
    """Cuerpo de modificación de usuario (§1.3): sin ``companias`` (ruta 1.7)."""
    return {
        "nombre": _nombre(payload.get("nombre")),
        "email": _email(payload.get("email")),
        "rol": _rol(payload.get("rol")),
        "iniciales": _iniciales(payload.get("iniciales")),
        "activo": _activo(payload.get("activo")),
        "usuario": _usuario(payload.get("usuario")),
        "motivo": _motivo(payload.get("motivo")),
    }


def normalize_role_permissions(payload: dict[str, Any]) -> dict[str, Any]:
    """Cuerpo de ``RolePermissionList`` (§1.6): lista vacía válida (retira todo)."""
    entrada = payload.get("permisos")
    if entrada is None:
        entrada = []
    if not isinstance(entrada, list):
        raise AdminValidationError("Los permisos deben venir en una lista de códigos.")
    if len(entrada) > MAX_PERMISSIONS:
        raise AdminValidationError(
            f"La lista admite máximo {MAX_PERMISSIONS} permisos."
        )
    permisos: list[str] = []
    for item in entrada:
        codigo = _text(item)
        if not codigo:
            raise AdminValidationError("Cada permiso debe ser un código del catálogo.")
        if codigo not in permisos:
            permisos.append(codigo)
    return {
        "permisos": permisos,
        "usuario": _usuario(payload.get("usuario")),
        "motivo": _motivo(payload.get("motivo")),
    }


def normalize_user_companies(payload: dict[str, Any]) -> dict[str, Any]:
    """Cuerpo de ``UserCompanyList`` (§1.7): ``companias`` con ``min_length=1``."""
    return {
        "companias": _companias(payload.get("companias"), obligatoria=True),
        "usuario": _usuario(payload.get("usuario")),
        "motivo": _motivo(payload.get("motivo")),
    }


def normalize_integration(payload: dict[str, Any]) -> dict[str, Any]:
    """Cuerpo de ``IntegrationWrite`` (§3.2): estado, configuración, usuario y motivo.

    La única validación posible sin conector: ``Conectado`` exige una
    ``configuracion`` no vacía.
    """
    estado = _estado_integracion(payload.get("estado"))
    configuracion = _configuracion(payload.get("configuracion"))
    if estado == "Conectado" and not configuracion:
        raise AdminValidationError(
            "No se puede declarar la integración «Conectado» sin configuración."
        )
    return {
        "estado": estado,
        "configuracion": configuracion,
        "usuario": _usuario(payload.get("usuario")),
        "motivo": _motivo(payload.get("motivo")),
    }


# ---------------------------------------------------------------------------
# Exportación de bitácora (contrato puro que comparte el motor)
# ---------------------------------------------------------------------------
def build_audit_export(rows: Iterable[dict[str, Any]], *, formato: str) -> bytes:
    """Serializa las filas de bitácora como XLSX o CSV (§2.2).

    Mismos encabezados y mismo orden en los dos formatos; nunca inventa filas:
    un rango sin coincidencias exporta solo los encabezados.
    """
    formato = _formato(formato)
    datos = list(rows)
    if formato == "csv":
        import csv
        from io import StringIO

        output = StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(AUDIT_EXPORT_HEADERS)
        for fila in datos:
            writer.writerow([fila.get(columna, "") for columna in AUDIT_EXPORT_COLUMNS])
        return ("\ufeff" + output.getvalue()).encode("utf-8")

    from io import BytesIO

    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    workbook = Workbook()
    sheet = workbook.active
    if sheet is None:  # pragma: no cover - openpyxl siempre crea una hoja
        sheet = workbook.create_sheet("Bitácora")
    sheet.title = "Bitácora"
    sheet.append(list(AUDIT_EXPORT_HEADERS))
    for celda in sheet[1]:
        celda.font = Font(bold=True, color="FFFFFF")
        celda.fill = PatternFill("solid", fgColor="174E5A")
    for fila in datos:
        sheet.append([fila.get(columna, "") for columna in AUDIT_EXPORT_COLUMNS])
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


# ---------------------------------------------------------------------------
# Helpers de motor (se importan dentro de las funciones para no crear ciclos)
# ---------------------------------------------------------------------------
def _compania_destino(
    cursor: Any, cia: str, *, no_encontrada: type[Exception] = AdminNotFound
) -> tuple[int, str]:
    """``id`` y código normalizado de la compañía; la ``cia`` ya viene validada."""
    codigo = str(int(_text(cia)))
    cursor.execute("SELECT id FROM companias WHERE codigo = %s", (codigo,))
    fila = cursor.fetchone()
    if fila is None:
        raise no_encontrada(f"No existe la compañía {codigo}.")
    return int(fila[0]), codigo


def _usuarios_activos_admin(cursor: Any) -> int:
    """Usuarios activos (no eliminados) con el rol administrador."""
    cursor.execute(
        "SELECT count(*) FROM usuarios u JOIN roles r ON r.id = u.rol_id "
        "WHERE u.eliminado_en IS NULL AND u.activo AND r.codigo = %s",
        (ADMIN_ROLE_CODE,),
    )
    return int(cursor.fetchone()[0])


def _usuario_actual(cursor: Any, user_id: int) -> dict[str, Any]:
    """Fila vigente del usuario con su rol, o 404 si no existe o está de baja."""
    cursor.execute(
        "SELECT u.id, u.nombre, u.activo, r.codigo AS rol "
        "FROM usuarios u JOIN roles r ON r.id = u.rol_id "
        "WHERE u.id = %s AND u.eliminado_en IS NULL",
        (user_id,),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise AdminNotFound(f"No existe el usuario {user_id}.")
    return {"id": int(fila[0]), "nombre": fila[1], "activo": bool(fila[2]), "rol": fila[3]}


def _companias_del_usuario(cursor: Any, usuario_id: int) -> list[str]:
    cursor.execute(
        "SELECT c.codigo FROM usuario_companias uc JOIN companias c ON c.id = uc.compania_id "
        "WHERE uc.usuario_id = %s ORDER BY c.codigo",
        (usuario_id,),
    )
    return [_text(fila[0]) for fila in cursor.fetchall()]


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


# ---------------------------------------------------------------------------
# D5 · Usuarios, roles y permisos
# ---------------------------------------------------------------------------
def list_users(
    *, q: str = "", estado: str = "todos", page: int = 1, page_size: int = 50
) -> dict[str, Any]:
    """Lista de usuarios con rol y compañías (§1.1). Excluye ``eliminado_en``."""
    buscar = _busqueda(q, campo="búsqueda")
    estado = _estado_usuario(estado)
    page = _page(page)
    page_size = _page_size(page_size)

    if not _postgres():
        raise AdminLegacyNotSupported(LEGACY_USERS_MESSAGE)

    from .postgres_repository import _busqueda_like, _connect, _filas

    condiciones = ["u.eliminado_en IS NULL"]
    parametros: list[Any] = []
    if buscar:
        condiciones.append(
            "(u.nombre ILIKE %s ESCAPE '\\' OR coalesce(u.email, '') ILIKE %s ESCAPE '\\')"
        )
        patron = f"%{_busqueda_like(buscar)}%"
        parametros += [patron, patron]
    if estado == "activo":
        condiciones.append("u.activo")
    elif estado == "inactivo":
        condiciones.append("NOT u.activo")
    where = " WHERE " + " AND ".join(condiciones)

    sql = (
        "SELECT u.id, u.nombre, u.email, r.codigo AS rol, u.iniciales, u.activo, "
        "COALESCE(array_agg(c.codigo ORDER BY c.codigo) "
        "FILTER (WHERE c.codigo IS NOT NULL), '{}') AS companias "
        "FROM usuarios u JOIN roles r ON r.id = u.rol_id "
        "LEFT JOIN usuario_companias uc ON uc.usuario_id = u.id "
        "LEFT JOIN companias c ON c.id = uc.compania_id"
        + where
        + " GROUP BY u.id, u.nombre, u.email, r.codigo, u.iniciales, u.activo "
        "ORDER BY u.nombre LIMIT %s OFFSET %s"
    )
    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute(sql, [*parametros, page_size, (page - 1) * page_size])
        filas = _filas(cursor)
        cursor.execute(f"SELECT count(*) FROM usuarios u{where}", parametros)
        total = int(cursor.fetchone()[0])

    items = [
        {
            "id": int(fila["id"]),
            "nombre": fila["nombre"],
            "email": _text(fila["email"]),
            "rol": fila["rol"],
            "iniciales": _text(fila["iniciales"]),
            "activo": bool(fila["activo"]),
            "companias": list(fila["companias"] or []),
        }
        for fila in filas
    ]
    return {"items": items, "count": total, "source": "usuarios"}


def create_user(
    payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Crea un usuario activo con su rol y al menos una compañía (§1.2)."""
    data = normalize_user(payload)

    if not _postgres():
        raise AdminLegacyNotSupported(LEGACY_USERS_MESSAGE)

    from .postgres_repository import _connect, _text
    from .postgres_writes import _auditar, _commit, _usuario_id

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM usuarios WHERE email = %s", (data["email"],))
            if cursor.fetchone() is not None:
                raise AdminConflict(f"El correo {data['email']} ya está registrado.")
            cursor.execute("SELECT id FROM roles WHERE codigo = %s", (data["rol"],))
            fila = cursor.fetchone()
            if fila is None:
                raise AdminValidationError(f"No existe el rol {data['rol']}.")
            rol_id = int(fila[0])
            companias = [
                _compania_destino(cursor, codigo, no_encontrada=AdminValidationError)
                for codigo in data["companias"]
            ]
            usuario_id = _usuario_id(cursor, data["usuario"])
            cursor.execute(
                "INSERT INTO usuarios (nombre, email, rol_id, iniciales, activo, creado_en, "
                "creado_por) VALUES (%s, %s, %s, %s, %s, now(), %s) RETURNING id",
                (
                    data["nombre"], data["email"], rol_id, data["iniciales"] or None,
                    data["activo"], usuario_id,
                ),
            )
            nuevo_id = int(cursor.fetchone()[0])
            for compania_id, _ in companias:
                cursor.execute(
                    "INSERT INTO usuario_companias (usuario_id, compania_id) VALUES (%s, %s)",
                    (nuevo_id, compania_id),
                )
            if not dry_run:
                _auditar(
                    cursor, None, usuario_id, "Alta de usuario", "Usuarios", data["email"],
                    data["motivo"], {"companias": [_text(c) for _, c in companias]},
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "item": {
            "id": nuevo_id,
            "nombre": data["nombre"],
            "email": data["email"],
            "rol": data["rol"],
            "activo": data["activo"],
            "companias": [codigo for _, codigo in companias],
        },
        "source": "usuarios",
        "dryRun": dry_run,
    }


def update_user(
    user_id: int, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Modifica nombre, correo, rol, iniciales o estado del usuario (§1.3)."""
    data = normalize_user_update(payload)
    if user_id < 1:
        raise AdminValidationError("El identificador del usuario debe ser mayor o igual a 1.")

    if not _postgres():
        raise AdminLegacyNotSupported(LEGACY_USERS_MESSAGE)

    from .postgres_repository import _connect
    from .postgres_writes import _auditar, _commit, _usuario_id

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            actual = _usuario_actual(cursor, user_id)
            cursor.execute(
                "SELECT 1 FROM usuarios WHERE email = %s AND id <> %s", (data["email"], user_id)
            )
            if cursor.fetchone() is not None:
                raise AdminConflict(f"El correo {data['email']} ya está registrado.")
            cursor.execute("SELECT id FROM roles WHERE codigo = %s", (data["rol"],))
            fila = cursor.fetchone()
            if fila is None:
                raise AdminValidationError(f"No existe el rol {data['rol']}.")
            rol_id = int(fila[0])
            # No dejar la instalación sin su último administrador activo.
            sigue_admin = data["activo"] and data["rol"].upper() == ADMIN_ROLE_CODE
            era_admin = actual["activo"] and _text(actual["rol"]).upper() == ADMIN_ROLE_CODE
            if era_admin and not sigue_admin and _usuarios_activos_admin(cursor) == 1:
                raise AdminConflict(
                    f"El usuario {actual['nombre']} es el último administrador activo: "
                    "no se puede desactivar ni cambiar de rol."
                )
            actor_id = _usuario_id(cursor, data["usuario"])
            if not dry_run:
                cursor.execute(
                    "UPDATE usuarios SET nombre = %s, email = %s, rol_id = %s, iniciales = %s, "
                    "activo = %s, actualizado_por = %s WHERE id = %s",
                    (
                        data["nombre"], data["email"], rol_id, data["iniciales"] or None,
                        data["activo"], actor_id, user_id,
                    ),
                )
                _auditar(
                    cursor, None, actor_id, "Modificación de usuario", "Usuarios",
                    data["email"], data["motivo"],
                )
            companias = _companias_del_usuario(cursor, user_id)
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "item": {
            "id": user_id,
            "nombre": data["nombre"],
            "email": data["email"],
            "rol": data["rol"],
            "activo": data["activo"],
            "companias": companias,
        },
        "source": "usuarios",
        "dryRun": dry_run,
    }


def delete_user(
    user_id: int, *, user: str = "WEB", motivo: str = "", dry_run: bool = False
) -> None:
    """Baja lógica del usuario (§1.4). Rechaza al último administrador activo.

    El retorno normal es ``None`` (la ruta responde 204); con ``dry_run`` se
    devuelve el informe sin escribir.
    """
    if user_id < 1:
        raise AdminValidationError("El identificador del usuario debe ser mayor o igual a 1.")
    razon = _motivo(motivo)

    if not _postgres():
        raise AdminLegacyNotSupported(LEGACY_USERS_MESSAGE)

    from .postgres_repository import _connect
    from .postgres_writes import _auditar, _commit, _usuario_id

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            actual = _usuario_actual(cursor, user_id)
            es_admin = actual["activo"] and _text(actual["rol"]).upper() == ADMIN_ROLE_CODE
            if es_admin and _usuarios_activos_admin(cursor) == 1:
                raise AdminConflict(
                    f"El usuario {actual['nombre']} es el último administrador activo: "
                    "no se puede dar de baja."
                )
            actor_id = _usuario_id(cursor, user)
            if not dry_run:
                cursor.execute(
                    "UPDATE usuarios SET eliminado_en = now(), actualizado_por = %s WHERE id = %s",
                    (actor_id, user_id),
                )
                _auditar(
                    cursor, None, actor_id, "Baja de usuario", "Usuarios",
                    actual["nombre"], razon,
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    if not dry_run:
        return None
    # La ruta responde 204 en la operación normal; el informe solo existe para
    # ``dryRun`` (firma declarada ``-> None``).
    informe = {
        "item": {"id": user_id, "eliminado": not dry_run, "nombre": actual["nombre"]},
        "source": "usuarios",
        "dryRun": True,
    }
    return informe  # type: ignore[return-value]


def list_roles() -> dict[str, Any]:
    """Roles con sus permisos y el catálogo completo de permisos (§1.5)."""
    if not _postgres():
        raise AdminLegacyNotSupported(LEGACY_USERS_MESSAGE)

    from .postgres_repository import _connect, _filas

    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute("SELECT id, codigo, nombre FROM roles ORDER BY codigo")
        roles = _filas(cursor)
        cursor.execute(
            "SELECT rp.rol_id, p.codigo AS permiso FROM rol_permisos rp "
            "JOIN permisos p ON p.id = rp.permiso_id ORDER BY p.codigo"
        )
        por_rol: dict[int, list[str]] = {}
        for fila in _filas(cursor):
            por_rol.setdefault(int(fila["rol_id"]), []).append(fila["permiso"])
        cursor.execute("SELECT codigo, nombre, modulo FROM permisos ORDER BY modulo, codigo")
        catalogo = _filas(cursor)

    items = [
        {
            "codigo": fila["codigo"],
            "nombre": fila["nombre"],
            "permisos": por_rol.get(int(fila["id"]), []),
        }
        for fila in roles
    ]
    return {"items": items, "count": len(items), "permisos": catalogo, "source": "roles"}


def replace_role_permissions(
    codigo: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Reemplaza en bloque los permisos de un rol (§1.6)."""
    rol = _rol(codigo)
    data = normalize_role_permissions(payload)

    if not _postgres():
        raise AdminLegacyNotSupported(LEGACY_USERS_MESSAGE)

    from .postgres_repository import _connect
    from .postgres_writes import _auditar, _commit, _usuario_id

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM roles WHERE codigo = %s", (rol,))
            fila = cursor.fetchone()
            if fila is None:
                raise AdminNotFound(f"No existe el rol {rol}.")
            rol_id = int(fila[0])
            ids: list[int] = []
            for permiso in data["permisos"]:
                cursor.execute("SELECT id FROM permisos WHERE codigo = %s", (permiso,))
                encontrado = cursor.fetchone()
                if encontrado is None:
                    raise AdminValidationError(
                        f"El permiso {permiso} no existe en el catálogo."
                    )
                ids.append(int(encontrado[0]))
            if rol.upper() == ADMIN_ROLE_CODE and not ids:
                raise AdminConflict(
                    "El rol ADMIN no puede quedarse sin permisos: dejaría el sistema "
                    "sin forma de administrar."
                )
            cursor.execute("SELECT permiso_id FROM rol_permisos WHERE rol_id = %s", (rol_id,))
            actuales = {int(fila[0]) for fila in cursor.fetchall()}
            nuevos = set(ids)
            creados = len(nuevos - actuales)
            retirados = len(actuales - nuevos)
            cursor.execute(
                "SELECT count(*) FROM usuarios WHERE rol_id = %s AND activo "
                "AND eliminado_en IS NULL",
                (rol_id,),
            )
            afectados = int(cursor.fetchone()[0])
            if not dry_run:
                retirar = sorted(actuales - nuevos)
                if retirar:
                    cursor.execute(
                        "DELETE FROM rol_permisos WHERE rol_id = %s AND permiso_id = ANY(%s)",
                        (rol_id, retirar),
                    )
                for permiso_id in sorted(nuevos - actuales):
                    cursor.execute(
                        "INSERT INTO rol_permisos (rol_id, permiso_id) VALUES (%s, %s)",
                        (rol_id, permiso_id),
                    )
                _auditar(
                    cursor, None, _usuario_id(cursor, data["usuario"]),
                    "Cambio de permisos de rol", "Roles", rol, data["motivo"],
                    {"permisos": data["permisos"]},
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "item": {
            "codigo": rol,
            "permisos": data["permisos"],
            "creados": creados,
            "retirados": retirados,
            "usuariosAfectados": afectados,
        },
        "source": "rol_permisos",
        "dryRun": dry_run,
    }


def replace_user_companies(
    user_id: int, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Reemplaza en bloque las compañías a las que accede el usuario (§1.7)."""
    data = normalize_user_companies(payload)
    if user_id < 1:
        raise AdminValidationError("El identificador del usuario debe ser mayor o igual a 1.")

    if not _postgres():
        raise AdminLegacyNotSupported(LEGACY_COMPANIES_MESSAGE)

    from .postgres_repository import _connect
    from .postgres_writes import _auditar, _commit, _usuario_id

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            _usuario_actual(cursor, user_id)
            objetivos = [
                _compania_destino(cursor, codigo, no_encontrada=AdminValidationError)
                for codigo in data["companias"]
            ]
            nuevos = {compania_id for compania_id, _ in objetivos}
            cursor.execute(
                "SELECT compania_id FROM usuario_companias WHERE usuario_id = %s", (user_id,)
            )
            actuales = {int(fila[0]) for fila in cursor.fetchall()}
            creadas = len(nuevos - actuales)
            retiradas = len(actuales - nuevos)
            if not dry_run:
                retirar = sorted(actuales - nuevos)
                if retirar:
                    cursor.execute(
                        "DELETE FROM usuario_companias WHERE usuario_id = %s "
                        "AND compania_id = ANY(%s)",
                        (user_id, retirar),
                    )
                for compania_id in sorted(nuevos - actuales):
                    cursor.execute(
                        "INSERT INTO usuario_companias (usuario_id, compania_id) VALUES (%s, %s)",
                        (user_id, compania_id),
                    )
                _auditar(
                    cursor, None, _usuario_id(cursor, data["usuario"]),
                    "Cambio de compañías de usuario", "Usuarios", str(user_id),
                    data["motivo"], {"companias": data["companias"]},
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "item": {
            "id": user_id,
            "companias": sorted(codigo for _, codigo in objetivos),
            "creadas": creadas,
            "retiradas": retiradas,
        },
        "source": "usuario_companias",
        "dryRun": dry_run,
    }


# ---------------------------------------------------------------------------
# D6 · Bitácora
# ---------------------------------------------------------------------------
def _audit_select() -> str:
    return (
        "SELECT a.id, to_char(a.creado_en, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS fecha, "
        "u.nombre AS usuario, r.nombre AS rol, a.accion, a.modulo, a.detalle, "
        "a.resultado, a.motivo "
        "FROM auditoria a "
        "LEFT JOIN usuarios u ON u.id = a.usuario_id "
        "LEFT JOIN roles r ON r.id = COALESCE(a.rol_id, u.rol_id)"
    )


def _audit_conditions(
    cursor: Any,
    *,
    cia: str,
    fecha_desde: str,
    fecha_hasta: str,
    modulo: str,
    usuario: str,
    resultado: str,
) -> tuple[str, list[Any]]:
    """Condiciones compartidas por la consulta y la exportación (§2.1/§2.2)."""
    from .postgres_repository import _busqueda_like

    condiciones: list[str] = []
    parametros: list[Any] = []
    if cia:
        compania_id, _ = _compania_destino(cursor, cia)
        condiciones.append("a.compania_id = %s")
        parametros.append(compania_id)
    if fecha_desde:
        condiciones.append("a.creado_en >= %s::date")
        parametros.append(fecha_desde)
    if fecha_hasta:
        condiciones.append("a.creado_en < (%s::date + interval '1 day')")
        parametros.append(fecha_hasta)
    if modulo:
        condiciones.append("a.modulo = %s")
        parametros.append(modulo)
    if usuario:
        condiciones.append("u.nombre ILIKE %s ESCAPE '\\'")
        parametros.append(f"%{_busqueda_like(usuario)}%")
    if resultado != "todos":
        condiciones.append("a.resultado = %s")
        parametros.append(resultado)
    where = (" WHERE " + " AND ".join(condiciones)) if condiciones else ""
    return where, parametros


def _audit_filters(
    *,
    cia: str,
    fecha_desde: str,
    fecha_hasta: str,
    modulo: str,
    usuario: str,
    resultado: str,
) -> dict[str, str]:
    """Validación pura de los filtros de la bitácora, antes de abrir la conexión."""
    return {
        "cia": _cia(cia),
        "fecha_desde": _fecha(fecha_desde, "fechaDesde"),
        "fecha_hasta": _fecha(fecha_hasta, "fechaHasta"),
        "modulo": _busqueda(modulo, campo="módulo", maximo=MAX_MODULE),
        "usuario": _busqueda(usuario, campo="usuario"),
        "resultado": _resultado(resultado),
    }


def list_audit_log(
    *,
    cia: str = "",
    fecha_desde: str = "",
    fecha_hasta: str = "",
    modulo: str = "",
    usuario: str = "",
    resultado: str = "todos",
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    """Publica la bitácora real que el sistema ya escribe (§2.1)."""
    filtros = _audit_filters(
        cia=cia, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        modulo=modulo, usuario=usuario, resultado=resultado,
    )
    page = _page(page)
    page_size = _page_size(page_size)

    if not _postgres():
        raise AdminLegacyNotSupported(LEGACY_AUDIT_MESSAGE)

    from .postgres_repository import _connect, _filas

    with _connect() as connection, connection.cursor() as cursor:
        where, parametros = _audit_conditions(
            cursor,
            cia=filtros["cia"], fecha_desde=filtros["fecha_desde"],
            fecha_hasta=filtros["fecha_hasta"], modulo=filtros["modulo"],
            usuario=filtros["usuario"], resultado=filtros["resultado"],
        )
        cursor.execute(
            _audit_select() + where + " ORDER BY a.creado_en DESC, a.id DESC LIMIT %s OFFSET %s",
            [*parametros, page_size, (page - 1) * page_size],
        )
        filas = _filas(cursor)
        cursor.execute(
            "SELECT count(*) FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id"
            + where,
            parametros,
        )
        total = int(cursor.fetchone()[0])

    items = [
        {
            "id": int(fila["id"]),
            "fecha": fila["fecha"],
            "usuario": fila["usuario"],
            "rol": fila["rol"],
            "accion": fila["accion"],
            "modulo": fila["modulo"],
            "detalle": fila["detalle"],
            "resultado": fila["resultado"],
            "motivo": fila["motivo"],
        }
        for fila in filas
    ]
    return {"items": items, "count": total, "source": "auditoria"}


def export_audit_log(
    *,
    cia: str = "",
    fecha_desde: str = "",
    fecha_hasta: str = "",
    modulo: str = "",
    usuario: str = "",
    resultado: str = "todos",
    formato: str = "xlsx",
) -> dict[str, Any]:
    """Exporta la bitácora filtrada y deja fila en ``auditoria`` (§2.2)."""
    filtros = _audit_filters(
        cia=cia, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        modulo=modulo, usuario=usuario, resultado=resultado,
    )
    formato = _formato(formato)

    if not _postgres():
        raise AdminLegacyNotSupported(LEGACY_AUDIT_MESSAGE)

    from .postgres_repository import _connect, _filas
    from .postgres_writes import _auditar, _commit

    with _connect() as connection, connection.cursor() as cursor:
        where, parametros = _audit_conditions(
            cursor,
            cia=filtros["cia"], fecha_desde=filtros["fecha_desde"],
            fecha_hasta=filtros["fecha_hasta"], modulo=filtros["modulo"],
            usuario=filtros["usuario"], resultado=filtros["resultado"],
        )
        cursor.execute(_audit_select() + where + " ORDER BY a.creado_en DESC, a.id DESC", parametros)
        filas = _filas(cursor)
        compania_id: int | None = None
        if filtros["cia"]:
            compania_id, _ = _compania_destino(cursor, filtros["cia"])
        # Exportar la bitácora también es una acción auditable (§2.2). La firma no
        # recibe el actor, así que la fila queda sin `usuario_id` en vez de
        # inventarlo.
        _auditar(
            cursor, compania_id, None,  # type: ignore[arg-type]  (exportar sin actor)
            "Exportación de bitácora", "Bitácora",
            f"{formato}: {len(filas)} fila(s)", "",
            {
                "formato": formato,
                "fechaDesde": filtros["fecha_desde"],
                "fechaHasta": filtros["fecha_hasta"],
                "modulo": filtros["modulo"],
                "usuario": filtros["usuario"],
                "resultado": filtros["resultado"],
            },
        )
        _commit(connection, False)

    content = build_audit_export(filas, formato=formato)
    partes = ["bitacora"]
    if filtros["fecha_desde"]:
        partes.append(filtros["fecha_desde"])
    if filtros["fecha_hasta"]:
        partes.append(filtros["fecha_hasta"])
    partes.append(date.today().isoformat())
    return {
        "content": content,
        "media_type": XLSX_MEDIA_TYPE if formato == "xlsx" else CSV_MEDIA_TYPE,
        "filename": f"{'_'.join(partes)}.{formato}",
    }


# ---------------------------------------------------------------------------
# D7 · Integraciones
# ---------------------------------------------------------------------------
def list_integrations(cia: str) -> dict[str, Any]:
    """Estado y configuración declarada de las integraciones de la compañía (§3.1)."""
    _cia(cia, obligatoria=True)

    if not _postgres():
        raise AdminLegacyNotSupported(LEGACY_INTEGRATIONS_MESSAGE)

    from .postgres_repository import _connect, _filas

    with _connect() as connection, connection.cursor() as cursor:
        compania_id, _ = _compania_destino(cursor, cia)
        cursor.execute(
            "SELECT modulo, estado, ultima_sincronizacion, configuracion FROM integraciones "
            "WHERE compania_id = %s ORDER BY modulo",
            (compania_id,),
        )
        filas = _filas(cursor)

    items = [
        {
            "modulo": fila["modulo"],
            "estado": fila["estado"],
            "ultimaSincronizacion": _iso(fila["ultima_sincronizacion"]),
            "configuracion": fila["configuracion"] or {},
        }
        for fila in filas
    ]
    return {"items": items, "count": len(items), "source": "integraciones"}


def replace_integration(
    cia: str, modulo: str, payload: dict[str, Any], *, user: str = "WEB", dry_run: bool = False
) -> dict[str, Any]:
    """Persiste el estado y la configuración declarada de una integración (§3.2).

    No prueba la conexión ni sincroniza: solo guarda lo que el administrador
    declara, que es lo que ya existe hasta que se defina el conector.
    """
    _cia(cia, obligatoria=True)
    nombre_modulo = _modulo(modulo)
    data = normalize_integration(payload)

    if not _postgres():
        raise AdminLegacyNotSupported(LEGACY_INTEGRATIONS_MESSAGE)

    from .postgres_repository import _connect
    from .postgres_writes import _auditar, _commit, _usuario_id

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id, _ = _compania_destino(cursor, cia)
            cursor.execute(
                "SELECT 1 FROM integraciones WHERE compania_id = %s AND modulo = %s",
                (compania_id, nombre_modulo),
            )
            if cursor.fetchone() is None:
                raise AdminNotFound(
                    f"No existe la integración {nombre_modulo} en la compañía {cia}."
                )
            if not dry_run:
                cursor.execute(
                    "UPDATE integraciones SET estado = %s, configuracion = %s::jsonb, "
                    "actualizado_por = %s WHERE compania_id = %s AND modulo = %s",
                    (
                        data["estado"], json.dumps(data["configuracion"]),
                        _usuario_id(cursor, data["usuario"]), compania_id, nombre_modulo,
                    ),
                )
                _auditar(
                    cursor, compania_id, _usuario_id(cursor, data["usuario"]),
                    "Cambio de integración", "Integraciones", nombre_modulo, data["motivo"],
                    {"estado": data["estado"], "configuracion": data["configuracion"]},
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "item": {
            "modulo": nombre_modulo,
            "estado": data["estado"],
            "configuracion": data["configuracion"],
        },
        "source": "integraciones",
        "dryRun": dry_run,
    }
