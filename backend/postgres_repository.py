"""Acceso a PostgreSQL para el modelo nuevo (``db/postgresql``).

Implementa el mismo contrato JSON que la capa de Advantage, de modo que los
endpoints no cambien al alternar de motor (``CONTABDSI_STORE=postgres``).

Solo cubre las operaciones ya migradas; el resto sigue resolviéndose en
``ads_repository`` hasta que se complete la transición (ver
``db/migration/04_transicion_del_backend.md``).
"""

from __future__ import annotations

import re
from typing import Any

from .ads_repository import CompanyNotFound, _boolean, _text, normalize_company_code
from .store import database_url


class PostgresConfigurationError(RuntimeError):
    """Falta el driver de PostgreSQL o la conexión no es posible."""

    pass


# Sin timeout, un puerto medio abierto (p. ej. el reenviador de Docker cuando el
# motor está caído) deja la petición colgada en vez de responder con un error.
CONNECT_TIMEOUT_SECONDS = 5


def _connect() -> Any:
    """Abre una conexión nueva. El driver se importa aquí para que el módulo
    pueda importarse (y la API arrancar) aunque psycopg no esté instalado."""
    try:
        import psycopg
    except ImportError as exc:  # pragma: no cover - depende del entorno
        raise PostgresConfigurationError(
            "Falta el driver psycopg; instala backend/requirements.txt."
        ) from exc

    try:
        return psycopg.connect(database_url(), connect_timeout=CONNECT_TIMEOUT_SECONDS)
    except Exception as exc:
        raise PostgresConfigurationError(
            f"No fue posible conectar con PostgreSQL ({database_url()}): {exc}"
        ) from exc


def list_companies() -> list[dict[str, Any]]:
    """Compañías de ``companias`` con el contrato que consume el login.

    En el legado el NIT viaja en un solo campo (``CONEMP.EMPNIT``); en el modelo
    nuevo está separado del dígito de verificación, así que se vuelven a
    componer para no cambiar la interfaz. El orden imita al de ``CONEMP``:
    primero la compañía vigente y después por código descendente.
    """
    sql = (
        "SELECT codigo, nombre, nit, digito, estado FROM companias "
        "ORDER BY (estado = 'Activa') DESC, codigo DESC"
    )
    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute(sql)
        rows = cursor.fetchall()

    companies: list[dict[str, Any]] = []
    for codigo, nombre, nit, digito, estado in rows:
        check_digit = str(digito or "").strip()
        companies.append(
            {
                # Tres dígitos, como ``CONEMP`` (`_company_from_row` del motor viejo):
                # el destino guarda el código sin ceros (`27`), pero el contrato
                # expone `027`.
                "codigo": f"{int(codigo):03d}",
                "nombre": str(nombre),
                "nit": f"{nit}-{check_digit}" if check_digit else str(nit),
                "habilitada": str(estado) == "Activa",
            }
        )
    return companies


def check_connection() -> None:
    """Comprueba que el modelo nuevo responde (equivale a leer CONMAE)."""
    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM companias LIMIT 1")
        cursor.fetchone()


# ---------------------------------------------------------------------------
# Maestros (etapa C2 de db/migration/08_plan_para_culminar.md)
#
# Las consultas devuelven los **mismos nombres físicos** que la tabla del legado
# y el JSON se arma con los mapeadores que ya usan los repositorios de Advantage.
# Así el contrato no puede divergir entre motores: es el mismo código de salida.
# ---------------------------------------------------------------------------
MONTH_CODES = tuple(f"{month:02d}" for month in range(13))

# `periodosHabilitados` del contrato sale del jsonb `periodos_habilitados`: las
# claves del jsonb son los códigos `00`..`12` y el mapeador de CONCTR espera
# columnas `CT00`..`CT12`, así que aquí se aliasan.
PERIODOS_ALIASES = ", ".join(
    f"(p.periodos_habilitados->>'{code}') AS \"CT{code}\"" for code in MONTH_CODES
)


def _compania(cursor: Any, company_code: str) -> str:
    """Valida el código (`027` → `27`) y comprueba que la compañía exista."""
    codigo = str(normalize_company_code(company_code))
    cursor.execute("SELECT codigo FROM companias WHERE codigo = %s", (codigo,))
    if cursor.fetchone() is None:
        raise CompanyNotFound(f"No existe la compañía {company_code}.")
    return codigo


def _filas(cursor: Any) -> list[dict[str, Any]]:
    """`fetchall` con los alias de la consulta como nombres de columna."""
    columnas = [descripcion.name for descripcion in cursor.description]
    return [dict(zip(columnas, fila)) for fila in cursor.fetchall()]


def list_cost_centers(company_code: str) -> list[dict[str, Any]]:
    """Centros de costo de la compañía, con el contrato de CONCECOS.

    `HABILITA` viaja en `centros_costos.legado` (el modelo nuevo no tiene columna
    de estado para centros), así que `habilita` se lee de ahí.
    """
    from .centros_repository import _cost_centers_from_rows

    sql = (
        'SELECT cc.codigo AS "CODIGO", cc.nombre AS "NOMBRE", cc.hist AS "HIST", '
        'cc.valor AS "VALOR", cc.porcentaje AS "PORCEN", '
        'cc.valor_porcentaje AS "VLRPOR", cc.codigo_item AS "CODITEM", '
        'cu.codigo AS "CUENTA", cc.concepto AS "CONCEPTO", cc.carpeta AS "CARPETA", '
        'cc.tipo AS "TIPO", (cc.legado->>\'HABILITA\') AS "HABILITA" '
        "FROM centros_costos cc "
        "JOIN companias co ON co.id = cc.compania_id "
        "LEFT JOIN cuentas cu ON cu.id = cc.cuenta_id "
        "WHERE co.codigo = %s ORDER BY cc.codigo"
    )
    with _connect() as connection, connection.cursor() as cursor:
        codigo = _compania(cursor, company_code)
        cursor.execute(sql, (codigo,))
        filas = _filas(cursor)
    return _cost_centers_from_rows(filas)


def get_operation_parameters(cia: str) -> dict[str, Any]:
    """Parámetros de operación del modelo nuevo, con el contrato de CONCTR."""
    from .parametros_operacion_repository import _map_row

    sql = (
        'SELECT co.codigo::int AS "CTCODCIA", p.nombre_empresa AS "CTCIA", '
        'p.nit AS "CTNIT", p.direccion AS "CTDIRECC", p.ciudad AS "CTCIUDAD", '
        'p.directorio_contabilidad AS "CTDIREC", p.anio_operacion AS "CTANO", '
        'p.contabilidad_conciliacion AS "CTCLAVE1", '
        'p.verifica_documentos_lotes AS "CTVERDOC", '
        'p.terceros_documentos_propios AS "CTTERDOC", '
        "CASE WHEN p.controla_usuario_lotes THEN '1' ELSE ' ' END AS \"CTPUC\", "
        'p.comentario_certificado AS "CTLEY1", ' + PERIODOS_ALIASES + " "
        "FROM parametros_operacion p JOIN companias co ON co.id = p.compania_id "
        "WHERE co.codigo = %s"
    )
    with _connect() as connection, connection.cursor() as cursor:
        codigo = _compania(cursor, cia)
        cursor.execute(sql, (codigo,))
        filas = _filas(cursor)
    if not filas:
        raise ValueError("CONCTR no contiene el registro de parámetros.")
    return _map_row(filas[0])


def get_accounting_period(company_code: str) -> dict[str, Any]:
    """Ejercicio y meses abiertos, con el contrato de CONCTR."""
    sql = (
        'SELECT p.anio_operacion AS "CTANO", ' + PERIODOS_ALIASES + " "
        "FROM parametros_operacion p JOIN companias co ON co.id = p.compania_id "
        "WHERE co.codigo = %s"
    )
    with _connect() as connection, connection.cursor() as cursor:
        codigo = _compania(cursor, company_code)
        cursor.execute(sql, (codigo,))
        filas = _filas(cursor)
    if not filas:
        raise ValueError("No existe configuración contable en CONCTR.")
    fila = filas[0]
    year = int(fila["CTANO"])
    enabled_months = [
        month for month in range(1, 13) if _boolean(fila.get(f"CT{month:02d}"))
    ]
    if not enabled_months:
        raise ValueError(f"CONCTR no tiene meses habilitados para el ejercicio {year}.")
    suggested_month = enabled_months[-1]
    return {
        "anio": year,
        "mesesHabilitados": enabled_months,
        "periodoSugerido": f"{year:04d}-{suggested_month:02d}",
        "fechaSugerida": f"{year:04d}-{suggested_month:02d}-01",
    }


def list_vouchers(company_code: str) -> list[dict[str, Any]]:
    """Comprobantes de la compañía, con el contrato de CONTICOM.

    `HIST` se conserva en `comprobantes.legado` (su negación derivada está en
    `activo`), así que `hist` y `historico` salen del valor original.
    """
    from .comprobantes_repository import _voucher_from_row

    sql = (
        'SELECT cb.codigo AS "CODIGO", cb.nombre AS "NOMBRE", '
        "(cb.legado->>'HIST') AS \"HIST\", cb.descripcion_auxiliar AS \"CTABDES\" "
        "FROM comprobantes cb JOIN companias co ON co.id = cb.compania_id "
        "WHERE co.codigo = %s ORDER BY cb.codigo"
    )
    with _connect() as connection, connection.cursor() as cursor:
        codigo = _compania(cursor, company_code)
        cursor.execute(sql, (codigo,))
        filas = _filas(cursor)
    return [_voucher_from_row(fila) for fila in filas]


def list_document_types() -> list[dict[str, Any]]:
    """Tipos de documento, con el contrato de VISDOCUM.

    El catálogo es global en el legado y por compañía en el modelo nuevo: se
    devuelven las filas cargadas, ordenadas por código. Las 39 banderas de
    integración viajan en `tipos_documento.legado`.
    """
    from .tipos_documento_repository import _document_type_from_row

    sql = (
        'SELECT td.id AS "ID", td.codigo AS "CODIGO", td.nombre AS "NOMBRE", '
        'td.modulo AS "MODULO", td.naturaleza AS "TIPO", td.consecutivo AS "CONSE", '
        "CASE WHEN td.numeracion IS NULL THEN NULL "
        "WHEN td.numeracion = 'Manual' THEN 'T' ELSE 'F' END AS \"MODICONSE\", "
        'td.prefijo AS "PREFIJO", cb.codigo AS "COMPRO", '
        'td.genera_contabilizacion AS "ICONTAB", td.permite_conversion AS "CONVER", '
        'td.conversion_codigo AS "DOCCONVER", '
        "(td.legado->>'ICXP') AS \"ICXP\", (td.legado->>'BANCOS') AS \"BANCOS\", "
        "(td.legado->>'FPAGO') AS \"FPAGO\", (td.legado->>'DOCOFI') AS \"DOCOFI\", "
        "(td.legado->>'MODICOS') AS \"MODICOS\", (td.legado->>'TRASLADO') AS \"TRASLADO\", "
        "(td.legado->>'REPETI') AS \"REPETI\", (td.legado->>'GRABASAL') AS \"GRABASAL\", "
        "(td.legado->>'VALDIAN') AS \"VALDIAN\" "
        "FROM tipos_documento td LEFT JOIN comprobantes cb ON cb.id = td.comprobante_id "
        "ORDER BY td.codigo"
    )
    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute(sql)
        filas = _filas(cursor)
    return [_document_type_from_row(fila) for fila in filas]


def _compania_id(cursor: Any, codigo: str) -> int:
    """`id` numérico de la compañía a partir de su código (ya validado)."""
    cursor.execute("SELECT id FROM companias WHERE codigo = %s", (codigo,))
    return int(cursor.fetchone()[0])


# Selección de cuentas con sus acumulados, compartida por la lectura
# (`list_accounts`) y la escritura (`postgres_writes`, para devolver una cuenta
# recién creada o modificada con el mismo contrato).
CUENTA_SELECT = (
    "SELECT cu.codigo, cu.nombre, cu.afectable, cu.controla_tercero, cu.controla_centro, "
    "cu.ajuste, cu.clase_iva, cu.clase_retencion, s.periodo, s.saldo_inicial, "
    "s.debito, s.credito "
    "FROM cuentas cu "
    "LEFT JOIN saldos_cuenta s ON s.cuenta_id = cu.id AND s.compania_id = cu.compania_id "
    "AND s.anio = (SELECT anio_operacion::int FROM parametros_operacion p "
    "WHERE p.compania_id = cu.compania_id) "
    "WHERE cu.compania_id = %s"
)


def _cuentas_desde_filas(filas: list[Any]) -> list[dict[str, Any]]:
    """Reconstruye el contrato de CONMAE pivotando los períodos de `saldos_cuenta`.

    El legado guardaba los acumulados en columnas (`MSALDO`, `MACMDEBxx`,
    `MACMCREyy`); aquí las filas de `saldos_cuenta` se vuelven a armar con esos
    nombres para reutilizar el mapeador del motor viejo (`_account_from_row`).
    """
    from .ads_repository import _account_from_row

    acumulados: dict[str, dict[str, Any]] = {}
    for (
        codigo_cuenta, nombre, afectable, req_tercero, req_centro, ajuste,
        clase_iva, clase_retencion, periodo, saldo_inicial, debito, credito,
    ) in filas:
        fila = acumulados.setdefault(
            codigo_cuenta,
            {
                "CODIGO": codigo_cuenta, "MNOMBRE": nombre, "MTC": afectable,
                "MCTAPAGOS": req_tercero, "MCOSTOS": req_centro, "MAJUSTE": ajuste,
                "MIVA_RET": "I" if clase_iva else ("R" if clase_retencion else "O"),
                "MSALDO": 0,
            },
        )
        if periodo == "00":
            fila["MSALDO"] = saldo_inicial
        elif periodo:
            fila[f"MACMDEB{periodo}"] = debito
            fila[f"MACMCRE{periodo}"] = credito
    return [_account_from_row(fila) for fila in acumulados.values()]


def list_accounts(company_code: str) -> list[dict[str, Any]]:
    """Cuentas maestras y sus acumulados mensuales, con el contrato de CONMAE.

    Espeja ``ads_repository.list_accounts`` reutilizando el mapeador del motor
    viejo, para que el JSON no pueda divergir.
    """
    with _connect() as connection, connection.cursor() as cursor:
        codigo = _compania(cursor, company_code)
        cursor.execute(CUENTA_SELECT + " ORDER BY cu.codigo, s.periodo", (_compania_id(cursor, codigo),))
        filas = cursor.fetchall()
    return _cuentas_desde_filas(filas)


def _busqueda_like(termino: str) -> str:
    """Escapa el término para un `LIKE` de PostgreSQL (el patrón lo pone el SQL)."""
    return termino.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_third_parties(
    *,
    page: int = 1,
    page_size: int = 100,
    search: str = "",
    state: str = "todos",
) -> dict[str, Any]:
    """Directorio de terceros, con el contrato de FADCLI.

    **Fidelidad.** El cargador normalizó `terceros.tipo` a `Natural`/`Juridica`,
    mientras la API del legado lo derivaba de `CTIPOCLI`/`CTIPDOC`; en las filas
    con `CTIPOCLI` vacío o 0 el legado decía `Natural` y el modelo quedó en
    `Juridica` (104.307 filas, decisión registrada en `cargador/README.md` §5).
    """
    from .terceros_repository import _third_party_from_row

    if page < 1:
        raise ValueError("La página debe ser mayor o igual a 1.")
    if not 1 <= page_size <= 200:
        raise ValueError("El tamaño de página debe estar entre 1 y 200.")
    search = search.strip()
    if len(search) > 60:
        raise ValueError("La búsqueda no puede superar 60 caracteres.")
    if state not in {"todos", "activo", "bloqueado"}:
        raise ValueError("El estado solicitado no es válido.")

    condiciones: list[str] = []
    parametros: list[Any] = []
    if search:
        condiciones.append(
            "(codigo_legado ILIKE %s ESCAPE '\\' OR nombre ILIKE %s ESCAPE '\\' "
            "OR ciudad ILIKE %s ESCAPE '\\')"
        )
        patron = f"%{_busqueda_like(search)}%"
        parametros += [patron, patron, patron]
    if state == "activo":
        condiciones.append("estado = 'Activo'")
    elif state == "bloqueado":
        condiciones.append("estado <> 'Activo'")
    where = (" WHERE " + " AND ".join(condiciones)) if condiciones else ""

    columnas = (
        'SELECT codigo_legado AS "CCODIGO", digito AS "CDIGITO", '
        "CASE WHEN tipo = 'Juridica' THEN 2 ELSE 1 END AS \"CTIPOCLI\", "
        'tipo_documento AS "CTIPDOC", nombre AS "CNOMBRE", direccion AS "CDIREC", '
        'telefono AS "CTELEF", ciudad AS "CCIUDAD", '
        "CASE WHEN estado = 'Activo' THEN 1 ELSE 0 END AS \"CESTADO\", "
        'motivo_bloqueo AS "CMOTIVO", saldo AS "CSALDO", cupo AS "CCUPO", '
        "to_char(fecha_creacion, 'YYYYMMDD')::int AS \"CFCHCREA\" "
        f"FROM terceros{where} ORDER BY codigo_legado LIMIT %s OFFSET %s"
    )
    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute(columnas, [*parametros, page_size, (page - 1) * page_size])
        filas = _filas(cursor)
        cursor.execute(f"SELECT count(*) FROM terceros{where}", parametros)
        total = cursor.fetchone()[0]

    return {
        "items": [_third_party_from_row(fila) for fila in filas],
        "page": page,
        "pageSize": page_size,
        "total": total,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


def list_monthly_movements(
    cia: str,
    year: int,
    month: int,
    *,
    page: int = 1,
    page_size: int = 100,
    account_from: str = "",
    account_to: str = "",
    third_party: str = "",
    voucher: str = "",
    cost_center: str = "",
    document: str = "",
) -> dict[str, Any]:
    """Página del movimiento mensual, con el contrato de MOV01 (etapa C3).

    **Orden.** El legado recorría `MOV01` en su orden físico y ese orden no se
    conserva por renglón en el modelo nuevo; se pagina por `(fecha del documento,
    id, número de línea)`, que es estable y determinista, que es lo que la
    paginación exige.

    **`TIVA_RET`.** El cargador tradujo el carácter crudo (`I`/`R`/`O`) a la clase
    del destino (`IVA`/`Retencion`/`Otro`); aquí se invierte para devolver el
    carácter del legado. `TSEC` está vacía en las 5.048.937 filas del origen, así
    que la secuencia del contrato es 0, como en Advantage.
    """
    import re

    from .movimiento_mensual_repository import _movement_from_row

    codigo = str(normalize_company_code(cia))
    if not 1900 <= year <= 2100:
        raise ValueError("El año consultado no es válido.")
    if not 1 <= month <= 12:
        raise ValueError("El mes consultado debe estar entre 1 y 12.")
    if page < 1:
        raise ValueError("La página debe ser mayor o igual a 1.")
    if not 1 <= page_size <= 200:
        raise ValueError("El tamaño de página debe estar entre 1 y 200.")

    filtro = re.compile(r"^[A-Za-z0-9.-]+$")

    def _validar(valor: str, etiqueta: str, largo: int) -> str:
        texto = valor.strip()
        if not texto:
            return ""
        if len(texto) > largo or not filtro.fullmatch(texto):
            raise ValueError(f"El filtro {etiqueta} contiene caracteres no válidos.")
        return texto

    desde = account_from.strip()
    hasta = account_to.strip()
    for valor, etiqueta in ((desde, "cuenta desde"), (hasta, "cuenta hasta")):
        if valor and not re.fullmatch(r"^[0-9]{1,12}$", valor):
            raise ValueError(f"El filtro {etiqueta} debe contener entre 1 y 12 dígitos.")
    tercero = _validar(third_party, "tercero", 15)
    comprobante = _validar(voucher, "comprobante", 6)
    centro = _validar(cost_center, "centro de costo", 7)
    numero = _validar(document, "documento", 12)

    condiciones = ["co.codigo = %s", "d.anio = %s", "d.periodo = %s"]
    parametros: list[Any] = [codigo, year, f"{month:02d}"]
    if desde:
        condiciones.append("cu.codigo >= %s")
        parametros.append(desde)
    if hasta:
        condiciones.append("cu.codigo <= %s")
        parametros.append(hasta)
    if tercero:
        condiciones.append("(t.codigo_legado = %s OR btrim(l.nit_alterno) = %s)")
        parametros += [tercero, tercero]
    if comprobante:
        condiciones.append("cb.codigo = %s")
        parametros.append(comprobante)
    if centro:
        condiciones.append("cc.codigo = %s")
        parametros.append(centro)
    if numero:
        condiciones.append("d.documento = %s")
        parametros.append(numero)

    sql = (
        'SELECT d.anio AS "CONANO", d.periodo::int AS "CONMES", cu.codigo AS "CODIGO", '
        't.codigo_legado AS "NIT", l.nit_alterno AS "NITN", '
        "to_char(d.fecha, 'YYYYMMDD')::int AS \"TFECHA\", cb.codigo AS \"TCOMPR\", "
        'cc.codigo AS "TFASE", td.codigo AS "TIPODOC", d.documento AS "TDOCUM", '
        'l.documento_afectado AS "TDOCUM2", l.concepto AS "TDETALLE", '
        '(l.debito - l.credito)::numeric AS "TVALOR", l.base::numeric AS "TBASE", '
        "CASE l.clase WHEN 'IVA' THEN 'I' WHEN 'Retencion' THEN 'R' "
        "WHEN 'Otro' THEN 'O' ELSE '' END AS \"TIVA_RET\", "
        "(l.legado->>'TSALDO') AS \"TSALDO\", 0 AS \"TSEC\", "
        "(l.legado->>'TUSUA') AS \"TUSUA\" "
        "FROM documento_lineas l "
        "JOIN documentos d ON d.id = l.documento_id "
        "JOIN companias co ON co.id = l.compania_id "
        "JOIN cuentas cu ON cu.id = l.cuenta_id "
        "LEFT JOIN terceros t ON t.id = l.tercero_id "
        "LEFT JOIN comprobantes cb ON cb.id = d.comprobante_id "
        "LEFT JOIN centros_costos cc ON cc.id = l.centro_costo_id "
        "LEFT JOIN tipos_documento td ON td.id = l.tipo_documento_id "
        "WHERE " + " AND ".join(condiciones) + " "
        "ORDER BY d.fecha, d.id, l.numero_linea LIMIT %s"
    )
    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute(sql, [*parametros, page_size + 1])
        filas = _filas(cursor)

    has_more = len(filas) > page_size
    items = [_movement_from_row(fila) for fila in filas[:page_size]]
    return {
        "items": items,
        "page": page,
        "pageSize": page_size,
        "hasMore": has_more,
        "pageDebit": sum(item["debito"] for item in items),
        "pageCredit": sum(item["credito"] for item in items),
    }


# Códigos aceptados por los filtros (los mismos que valida el repositorio de
# Advantage, para que un valor inválido dé el mismo 422 en los dos motores).
_SIMPLE_CODE = re.compile(r"^[A-Za-z0-9.-]+$")
_DOCUMENT_CODE = re.compile(r"^[A-Za-z0-9 ._/-]+$")


def _filtro(valor: str, etiqueta: str, maximo: int, patron: re.Pattern[str]) -> str:
    texto = valor.strip()
    if texto and (len(texto) > maximo or not patron.fullmatch(texto)):
        raise ValueError(f"El filtro {etiqueta} contiene caracteres no válidos.")
    return texto


def _fecha_numerica(valor: str, etiqueta: str) -> int | None:
    from datetime import date as _date

    texto = valor.strip()
    if not texto:
        return None
    try:
        return int(_date.fromisoformat(texto).strftime("%Y%m%d"))
    except ValueError as exc:
        raise ValueError(f"La {etiqueta} no es válida.") from exc


def list_documents(
    cia: str,
    *,
    page: int = 1,
    page_size: int = 50,
    period: str = "",
    voucher: str = "",
    document_type: str = "",
    nit: str = "",
    date_from: str = "",
    date_to: str = "",
    document: str = "",
) -> dict[str, Any]:
    """Cabeceras de documentos, con el contrato de CONDOCUM (etapa C4).

    **`valor`.** `CONDOCUM.DVALOR` no se cargó como columna (el contrato lo
    descartó y solo lo usa como evidencia para elegir cabecera); aquí se
    **recalcula** como la suma de débitos de las partidas del documento. Medido en
    el plan: coincide con el original en el 98,0 % de las claves de una sola
    cabecera. `DDOCUMI` (documento interno) y `DMODULO` sí se conservan en
    `documentos.legado`.

    **`id`.** Es el `documentos.id` del modelo nuevo; en el legado era el
    autoincremento de `CONDOCUM`. Cambia de valor pero sigue siendo único, que es
    lo que la interfaz necesita de esa columna.
    """
    codigo = str(normalize_company_code(cia))
    if page < 1 or not 1 <= page_size <= 100:
        raise ValueError("La paginación solicitada no es válida.")
    period = period.strip()
    comprobante = _filtro(voucher, "comprobante", 2, _SIMPLE_CODE)
    tipo = _filtro(document_type, "tipo documental", 2, _SIMPLE_CODE)
    nit = _filtro(nit, "NIT", 15, _SIMPLE_CODE)
    documento = _filtro(document, "documento", 12, _DOCUMENT_CODE)
    desde = _fecha_numerica(date_from, "fecha inicial")
    hasta = _fecha_numerica(date_to, "fecha final")
    if desde and hasta and desde > hasta:
        raise ValueError("La fecha inicial no puede ser posterior a la fecha final.")

    condiciones = ["co.codigo = %s"]
    parametros: list[Any] = [codigo]
    if period:
        if not re.fullmatch(r"\d{4}-\d{2}", period):
            raise ValueError("El período debe tener el formato AAAA-MM.")
        anio, mes = (int(parte) for parte in period.split("-"))
        if not 1 <= mes <= 12:
            raise ValueError("El mes del período no es válido.")
        siguiente = (anio + 1, 1) if mes == 12 else (anio, mes + 1)
        condiciones += ["d.fecha >= %s", "d.fecha < %s"]
        parametros += [f"{anio:04d}-{mes:02d}-01", f"{siguiente[0]:04d}-{siguiente[1]:02d}-01"]
    if comprobante:
        condiciones.append("cb.codigo = %s")
        parametros.append(comprobante)
    if tipo:
        condiciones.append("td.codigo = %s")
        parametros.append(tipo)
    if nit:
        condiciones.append("t.codigo_legado = %s")
        parametros.append(nit)
    if desde:
        condiciones.append("d.fecha >= %s")
        parametros.append(f"{desde:08d}"[:4] + "-" + f"{desde:08d}"[4:6] + "-" + f"{desde:08d}"[6:])
    if hasta:
        condiciones.append("d.fecha <= %s")
        parametros.append(f"{hasta:08d}"[:4] + "-" + f"{hasta:08d}"[4:6] + "-" + f"{hasta:08d}"[6:])
    if documento:
        condiciones.append("d.documento = %s")
        parametros.append(documento)

    if len(condiciones) == 1:
        raise ValueError("Aplique al menos un filtro antes de consultar documentos.")

    sql = (
        'SELECT d.id AS "ID", to_char(d.fecha, \'YYYY-MM-DD\') AS "FECHA", '
        'cb.codigo AS "DCOMPRO", td.codigo AS "DTIPODOC", d.documento AS "DDOCUM", '
        "(d.legado->>'DDOCUMI') AS \"DDOCUMI\", t.codigo_legado AS \"DNIT\", "
        't.nombre AS "CNOMBRE", d.concepto AS "DDETALLE", '
        "(d.legado->>'DMODULO') AS \"DMODULO\", "
        '(d.legado->>\'DDOCUM2\') AS "DDOCUM2", '
        "(SELECT COALESCE(sum(l.debito), 0) FROM documento_lineas l "
        "WHERE l.documento_id = d.id)::numeric AS \"DVALOR\" "
        "FROM documentos d "
        "JOIN companias co ON co.id = d.compania_id "
        "LEFT JOIN comprobantes cb ON cb.id = d.comprobante_id "
        "LEFT JOIN tipos_documento td ON td.id = d.tipo_documento_id "
        "LEFT JOIN terceros t ON t.id = d.tercero_id "
        "WHERE " + " AND ".join(condiciones) + " "
        "ORDER BY d.fecha DESC, d.id DESC LIMIT %s"
    )
    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute(sql, [*parametros, page_size + 1])
        filas = _filas(cursor)

    has_more = len(filas) > page_size
    items = []
    for fila in filas[:page_size]:
        items.append({
            "id": int(fila["ID"]),
            "fecha": fila["FECHA"] or "",
            "comprobante": _text(fila["DCOMPRO"]),
            "tipoDocumento": _text(fila["DTIPODOC"]),
            "documento": _text(fila["DDOCUM"]),
            "documentoInterno": _text(fila["DDOCUMI"]),
            "nit": _text(fila["DNIT"]),
            "tercero": _text(fila["CNOMBRE"]),
            "detalle": _text(fila["DDETALLE"]),
            "valor": float(fila["DVALOR"]),
            "modulo": int(fila["DMODULO"] or 0),
            "documentoAfectado": _text(fila["DDOCUM2"]),
        })
    return {"items": items, "page": page, "pageSize": page_size, "hasMore": has_more}


def document_movements(
    cia: str,
    *,
    document: str,
    voucher: str,
    document_type: str,
    movement_date: str,
) -> list[dict[str, Any]]:
    """Partidas de un documento, con el contrato de MOV01 (etapa C4).

    El orden del legado era `(TSEC, ID)` y `TSEC` está vacía, de modo que era el
    orden físico; aquí se usa `numero_linea`, que es el reemplazo con el que el
    cargador numeró esas filas (`D-MOV-1`).
    """
    codigo = str(normalize_company_code(cia))
    documento = _filtro(document, "documento", 12, _DOCUMENT_CODE)
    comprobante = _filtro(voucher, "comprobante", 6, _SIMPLE_CODE)
    tipo = _filtro(document_type, "tipo documental", 2, _SIMPLE_CODE)
    numerica = _fecha_numerica(movement_date, "fecha del documento")
    if not all((documento, comprobante, tipo, numerica)):
        raise ValueError(
            "Documento, comprobante, tipo y fecha son obligatorios para ver el detalle."
        )
    anio = int(movement_date[:4])
    mes = int(movement_date[5:7])

    sql = (
        'SELECT l.id AS "ID", cu.codigo AS "CODIGO", cu.nombre AS "MNOMBRE", '
        't.codigo_legado AS "NIT", l.nit_alterno AS "NITN", '
        'cc.codigo AS "TFASE", l.documento_afectado AS "TDOCUM2", '
        'l.concepto AS "TDETALLE", (l.debito - l.credito)::numeric AS "TVALOR", '
        'l.base::numeric AS "TBASE", '
        "CASE l.clase WHEN 'IVA' THEN 'I' WHEN 'Retencion' THEN 'R' "
        "WHEN 'Otro' THEN 'O' ELSE '' END AS \"TIVA_RET\", "
        "(l.legado->>'TUSUA') AS \"TUSUA\" "
        "FROM documento_lineas l "
        "JOIN documentos d ON d.id = l.documento_id "
        "JOIN companias co ON co.id = l.compania_id "
        "JOIN cuentas cu ON cu.id = l.cuenta_id "
        "LEFT JOIN terceros t ON t.id = l.tercero_id "
        "LEFT JOIN comprobantes cb ON cb.id = d.comprobante_id "
        "LEFT JOIN tipos_documento td ON td.id = d.tipo_documento_id "
        "LEFT JOIN centros_costos cc ON cc.id = l.centro_costo_id "
        "WHERE co.codigo = %s AND d.anio = %s AND d.periodo = %s "
        "AND d.documento = %s AND cb.codigo = %s AND td.codigo = %s "
        "ORDER BY l.numero_linea"
    )
    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute(sql, (codigo, anio, f"{mes:02d}", documento, comprobante, tipo))
        filas = _filas(cursor)

    items = []
    for fila in filas:
        valor = float(fila["TVALOR"] or 0)
        items.append({
            "id": int(fila["ID"]),
            "secuencia": 0,
            "cuenta": _text(fila["CODIGO"]),
            "nombreCuenta": _text(fila["MNOMBRE"]),
            "nit": _text(fila["NITN"]) or _text(fila["NIT"]),
            "centro": _text(fila["TFASE"]),
            "documentoAfectado": _text(fila["TDOCUM2"]),
            "concepto": _text(fila["TDETALLE"]),
            "debito": valor if valor > 0 else 0.0,
            "credito": abs(valor) if valor < 0 else 0.0,
            "base": float(fila["TBASE"] or 0),
            "claseFiscal": _text(fila["TIVA_RET"]),
            "usuario": _text(fila["TUSUA"]),
        })
    return items


# ---------------------------------------------------------------------------
# Informe: balance de comprobación acumulado (etapa C5)
# ---------------------------------------------------------------------------
def build_trial_balance(
    company_code: str,
    year: int,
    month_from: int,
    month_to: int,
    *,
    level: int = 4,
    include_zero: bool = False,
    include_results: bool = True,
    include_third: bool = False,
    include_centers: bool = False,
    detail_from: str = "",
    detail_to: str = "",
) -> dict[str, Any]:
    """Balance acumulado, con el contrato de ``INFOR02(1)`` (etapa C5).

    **Fuente: `saldos_cuenta`.** El legado construye el informe desde `CONMAE`
    sumando `MSALDO` (apertura del ejercicio) y los campos `MACMDEBxx`/
    `MACMCREyy`, y toma los totales de control del árbol de clases. El cargador
    volcó **exactamente esas cifras** en `saldos_cuenta`: la apertura en el
    período `00`, los débitos en `debito` y los créditos —en negativo, como los
    guarda `CONMAE`— en `credito`. Por eso aquí no se recalcula desde el libro:
    la instantánea del origen es la fuente fiel y el balance sale igual al del
    legado.

    **Ensamblado compartido.** El JSON lo arma
    `balance_comprobacion_repository._assemble_report`, el mismo que usa el motor
    de Advantage; aquí sólo se reconstruyen, desde `saldos_cuenta`, las filas con
    los nombres físicos `MSALDO`/`MACMDEBxx`/`MACMCREyy` que ese ensamblado
    espera. Así el contrato no puede divergir entre motores.
    """
    from .balance_comprobacion_repository import _assemble_report, _validate_parameters

    if include_third or include_centers or detail_from or detail_to:
        raise ValueError("El detalle por tercero y centro de costo de este balance requiere Advantage.")

    _validate_parameters(year, month_from, month_to, level)

    with _connect() as connection, connection.cursor() as cursor:
        codigo = _compania(cursor, company_code)

        cursor.execute(
            "SELECT nombre, nit, digito FROM companias WHERE codigo = %s", (codigo,)
        )
        nombre, nit, digito = cursor.fetchone()

        cursor.execute(
            "SELECT p.anio_operacion FROM parametros_operacion p "
            "JOIN companias co ON co.id = p.compania_id WHERE co.codigo = %s",
            (codigo,),
        )
        fila_control = cursor.fetchone()
        if fila_control is None or not _text(fila_control[0]).strip():
            raise ValueError("No existe configuración contable en CONCTR.")
        control_year = int(float(_text(fila_control[0])))
        if year != control_year:
            raise ValueError(
                f"CONMAE contiene los acumulados del ejercicio {control_year}; "
                f"no es posible generar el año {year}."
            )

        cursor.execute(
            "SELECT cu.codigo, cu.nombre, s.periodo, s.saldo_inicial, s.debito, s.credito "
            "FROM cuentas cu "
            "LEFT JOIN saldos_cuenta s ON s.cuenta_id = cu.id "
            "AND s.compania_id = cu.compania_id AND s.anio = %s "
            "WHERE cu.compania_id = (SELECT id FROM companias WHERE codigo = %s) "
            "ORDER BY cu.codigo, s.periodo",
            (year, codigo),
        )
        filas = cursor.fetchall()

    # Reconstrucción de las filas del origen: el período `00` es la apertura y
    # cada mes aporta su débito y su crédito. El orden de inserción conserva el
    # `ORDER BY cu.codigo` de la consulta, que es el orden del informe.
    filas_por_codigo: dict[str, dict[str, Any]] = {}
    for codigo_cuenta, nombre_cuenta, periodo, saldo_inicial, debito, credito in filas:
        fila = filas_por_codigo.setdefault(
            codigo_cuenta,
            {"CODIGO": codigo_cuenta, "MNOMBRE": nombre_cuenta, "MSALDO": 0},
        )
        if periodo is None:
            continue
        if periodo == "00":
            fila["MSALDO"] = saldo_inicial
        else:
            fila[f"MACMDEB{periodo}"] = debito
            fila[f"MACMCRE{periodo}"] = credito

    empresa = {
        "EMPNOM": nombre,
        "EMPNIT": f"{nit}-{_text(digito).strip()}" if _text(digito).strip() else nit,
    }
    return _assemble_report(
        int(codigo), empresa, year, month_from, month_to, level, include_zero,
        list(filas_por_codigo.values()), include_results=include_results,
    )


# ---------------------------------------------------------------------------
# Lotes (etapa C6)
#
# `lotes` y `lote_lineas` están **vacías en la copia** (CONMOVI/CONLOTES no se
# cargaron porque no traían filas). La lectura se implementa igual para no romper
# la pantalla de Lotes con `CONTABDSI_STORE=postgres`; las escrituras pertenecen a
# la etapa D. Ver `db/migration/11_lotes_y_importaciones.md`.
# ---------------------------------------------------------------------------
# Equivalencia estado del destino → código de CONMOVI. Los estados que el legado
# no tenía (Aprobado, Contabilizando, Fallido) se devuelven tal cual en las dos
# columnas del contrato (`estadoCodigo` y `estado`): no se inventa un código.
_LOT_STATE_CODES = {
    "Borrador": "B",
    "Con errores": "E",
    "Verificado": "V",
    "Pendiente aprobacion": "P",
    "Contabilizado": "C",
    "Anulado": "N",
}


def list_lots(cia: str, *, page: int = 1, page_size: int = 100) -> dict[str, Any]:
    """Lotes de la compañía, con el contrato de CONMOVI (etapa C6).

    Los controles del lote (`items`, `debito`, `credito`) se **recalculan** desde
    `lote_lineas`, como manda el contrato (`DEBITOS`/`CREDITOS`/`ITEMS` = derivado).
    Los campos que el modelo nuevo no tiene (`historico`, `permiteBorrar`,
    `archivoOk`) se informan vacíos: iban a `migracion_filas`, no a una columna.
    """
    from .lotes_repository import _state_label

    codigo = str(normalize_company_code(cia))
    if page < 1 or not 1 <= page_size <= 200:
        raise ValueError("La paginación de lotes no es válida.")

    sql = (
        'SELECT lt.id, lt.codigo, lt.nombre, lt.periodo, lt.estado, '
        'u1.iniciales AS "USUA_I", u2.iniciales AS "USUA_F", '
        "to_char(lt.fecha, 'YYYY-MM-DD') AS \"FECHA\", "
        "to_char(lt.creado_en, 'HH24:MI:SS') AS \"HORA\", "
        'COALESCE(x.items, 0) AS "ITEMS", '
        'COALESCE(x.debitos, 0) AS "DEBITOS", '
        'COALESCE(x.creditos, 0) AS "CREDITOS" '
        "FROM lotes lt "
        "JOIN companias co ON co.id = lt.compania_id "
        "LEFT JOIN usuarios u1 ON u1.id = lt.creado_por "
        "LEFT JOIN usuarios u2 ON u2.id = lt.actualizado_por "
        "LEFT JOIN (SELECT lote_id, count(*) AS items, sum(debito) AS debitos, "
        "sum(credito) AS creditos FROM lote_lineas GROUP BY lote_id) x "
        "ON x.lote_id = lt.id "
        "WHERE co.codigo = %s ORDER BY lt.codigo LIMIT %s OFFSET %s"
    )
    with _connect() as connection, connection.cursor() as cursor:
        _compania(cursor, cia)
        cursor.execute(sql, (codigo, page_size + 1, (page - 1) * page_size))
        filas = _filas(cursor)

    has_more = len(filas) > page_size
    items = []
    for fila in filas[:page_size]:
        estado = _text(fila["estado"])
        codigo_estado = _LOT_STATE_CODES.get(estado, estado)
        etiqueta = estado if codigo_estado == estado else _state_label(codigo_estado, "")
        debito = float(fila["DEBITOS"] or 0)
        credito = float(fila["CREDITOS"] or 0)
        items.append({
            "id": int(fila["id"]),
            "lote": _text(fila["codigo"]),
            "nombre": _text(fila["nombre"]),
            "mes": _text(fila["periodo"]),
            "estadoCodigo": codigo_estado,
            "estado": etiqueta,
            "usuarioInicial": _text(fila["USUA_I"]),
            "usuarioFinal": _text(fila["USUA_F"]),
            "fecha": _text(fila["FECHA"]),
            "hora": _text(fila["HORA"]),
            "historico": "",
            "permiteBorrar": "",
            "debito": debito,
            "credito": credito,
            "diferencia": debito - credito,
            "items": int(fila["ITEMS"] or 0),
            "archivoOk": "",
        })
    return {"items": items, "page": page, "pageSize": page_size, "hasMore": has_more}


def list_lot_lines(
    cia: str,
    lot: str,
    *,
    page: int = 1,
    page_size: int = 200,
) -> dict[str, Any]:
    """Partidas de un lote, con el contrato de CONLOTES (etapa C6)."""
    from .lotes_repository import _validate_lot_code

    codigo = str(normalize_company_code(cia))
    codigo_lote = _validate_lot_code(lot)
    if page < 1 or not 1 <= page_size <= 500:
        raise ValueError("La paginación del detalle no es válida.")

    sql = (
        'SELECT l.id, cu.codigo AS "CUENTA", cu.nombre AS "MNOMBRE", '
        't.codigo_legado AS "NIT", l.nit_alterno AS "NITN", '
        'l.debito AS "DEBITO", l.credito AS "CREDITO", l.base AS "BASE", '
        'cc.codigo AS "TFASE", l.concepto AS "CONCEPTO", '
        'l.comprobante AS "TCOMPR", td.codigo AS "TIPODOC", '
        "to_char(l.fecha, 'YYYY-MM-DD') AS \"TFECHA\", "
        'l.documento AS "TDOCUM", l.documento_afectado AS "TDOCUM2" '
        "FROM lote_lineas l "
        "JOIN lotes lt ON lt.id = l.lote_id "
        "JOIN companias co ON co.id = l.compania_id "
        "LEFT JOIN cuentas cu ON cu.id = l.cuenta_id "
        "LEFT JOIN terceros t ON t.id = l.tercero_id "
        "LEFT JOIN centros_costos cc ON cc.id = l.centro_costo_id "
        "LEFT JOIN tipos_documento td ON td.id = l.tipo_documento_id "
        "WHERE co.codigo = %s AND lt.codigo = %s "
        "ORDER BY l.numero_linea, l.id LIMIT %s OFFSET %s"
    )
    with _connect() as connection, connection.cursor() as cursor:
        _compania(cursor, cia)
        cursor.execute(
            sql, (codigo, codigo_lote, page_size + 1, (page - 1) * page_size)
        )
        filas = _filas(cursor)

    has_more = len(filas) > page_size
    items = []
    for fila in filas[:page_size]:
        items.append({
            "id": int(fila["id"]),
            "cuenta": _text(fila["CUENTA"]),
            "nombreCuenta": _text(fila["MNOMBRE"]),
            "nit": _text(fila["NITN"]) or _text(fila["NIT"]),
            "nitMovimiento": _text(fila["NIT"]),
            "debito": float(fila["DEBITO"] or 0),
            "credito": float(fila["CREDITO"] or 0),
            "base": float(fila["BASE"] or 0),
            "centro": _text(fila["TFASE"]),
            "concepto": _text(fila["CONCEPTO"]),
            "comprobante": _text(fila["TCOMPR"]),
            "tipoDocumento": _text(fila["TIPODOC"]),
            "fecha": _text(fila["TFECHA"]),
            "documento": _text(fila["TDOCUM"]),
            "inconsistencia": "",
            "documentoAfectado": _text(fila["TDOCUM2"]),
        })
    return {
        "items": items,
        "page": page,
        "pageSize": page_size,
        "hasMore": has_more,
        "pageDebit": sum(item["debito"] for item in items),
        "pageCredit": sum(item["credito"] for item in items),
    }
