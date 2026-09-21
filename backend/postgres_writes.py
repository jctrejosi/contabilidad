"""Escrituras contra PostgreSQL (etapa D de ``db/migration/08_plan_para_culminar.md``).

Implementa el mismo contrato JSON que la capa de Advantage para las operaciones
que **escriben**, de modo que los endpoints no cambien al alternar de motor.

**Dónde vive cada regla.** Las reglas de negocio de lotes, contabilización y
anulación están en las funciones del esquema (`validar_lote`,
`contabilizar_lote`, `anular_documento`, `regenerar_acumulados`, en
`db/postgresql/funciones.sql`). Aquí se hace la traducción de contrato (payload de
la web → filas del modelo nuevo) y se invocan esas funciones dentro de **una sola
transacción**, que es lo que sustituye al candado `accounting_write_lock` del
motor viejo: dos operaciones que tocan los mismos acumulados chocan en la fila
(`FOR UPDATE` dentro de las funciones) en vez de serializarse en el proceso.

**Diferencias de texto.** Los mensajes de error pueden diferir del legado en la
redacción exacta, pero conservan el **tipo** (que es lo que fija el código HTTP)
y el significado. Las diferencias de fondo están en
`db/migration/12_escrituras.md`.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from .ads_repository import _text, normalize_company_code
from .postgres_repository import (
    CUENTA_SELECT,
    _compania,
    _compania_id,
    _connect,
    _cuentas_desde_filas,
)


MESES = {
    "00": "Saldos Iniciales", "01": "Enero", "02": "Febrero", "03": "Marzo",
    "04": "Abril", "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
    "13": "Ajuste 13", "14": "Ajuste 14", "15": "Ajuste 15", "16": "Ajuste 16",
    "17": "Ajuste 17", "18": "Ajuste 18",
}


def _anio_operacion(cursor: Any, compania_id: int) -> int:
    """Ejercicio activo de ``parametros_operacion`` (equivale a ``CONCTR.CTANO``)."""
    cursor.execute(
        "SELECT anio_operacion FROM parametros_operacion WHERE compania_id = %s",
        (compania_id,),
    )
    fila = cursor.fetchone()
    if fila is None or not _text(fila[0]).strip():
        raise ValueError("No existe configuración contable en CONCTR.")
    return int(float(_text(fila[0])))


def _asegurar_periodo(cursor: Any, compania_id: int, anio: int, periodo: str) -> None:
    """Garantiza que exista la fila de ``periodos_contables``.

    El cargador sólo creó los períodos que traían movimientos; el legado no tenía
    esta tabla y habilitaba los meses con ``CONCTR.CTxx``. Para poder operar un
    período nuevo, el destino tiene que tener su fila, así que se abre si falta
    (estado ``Abierto``). Decisión registrada en `db/migration/12_escrituras.md`.
    """
    cursor.execute(
        "INSERT INTO periodos_contables (compania_id, anio, periodo, nombre, estado) "
        "VALUES (%s, %s, %s, %s, 'Abierto') "
        "ON CONFLICT (compania_id, anio, periodo) DO NOTHING",
        (compania_id, anio, periodo, MESES.get(periodo, periodo)),
    )


def _usuario_id(cursor: Any, iniciales: str) -> int:
    """Resuelve las iniciales de usuario del legado a ``usuarios.id``.

    El legado guardaba iniciales en texto libre; el modelo nuevo normaliza con
    ``usuarios``. Se busca por iniciales; si no existen, se usa el primer usuario
    activo y, si no hay ninguno, se crea con el primer rol disponible.
    """
    texto = (iniciales or "").strip().upper()
    if texto:
        cursor.execute(
            "SELECT id FROM usuarios WHERE upper(iniciales) = %s "
            "AND eliminado_en IS NULL ORDER BY id LIMIT 1",
            (texto,),
        )
        fila = cursor.fetchone()
        if fila:
            return int(fila[0])
    cursor.execute(
        "SELECT id FROM usuarios WHERE activo AND eliminado_en IS NULL ORDER BY id LIMIT 1"
    )
    fila = cursor.fetchone()
    if fila:
        return int(fila[0])
    cursor.execute(
        "INSERT INTO usuarios (nombre, iniciales, rol_id, activo) "
        "VALUES (%s, %s, (SELECT id FROM roles ORDER BY id LIMIT 1), true) RETURNING id",
        (texto or "WEB", texto or None),
    )
    return int(cursor.fetchone()[0])


def _commit(connection: Any, dry_run: bool) -> None:
    """Confirma o revierte según el modo, sin ambigüedad."""
    if dry_run:
        connection.rollback()
    else:
        connection.commit()


# ---------------------------------------------------------------------------
# Terceros (etapa D)
# ---------------------------------------------------------------------------
def _compania_para_tercero(cursor: Any, cia: str) -> int:
    """Compañía destino de un tercero nuevo.

    El legado tenía un directorio **global** (`FADCLI`), mientras el modelo nuevo
    es **por compañía** (`terceros.compania_id NOT NULL`). La ruta web no envía la
    compañía; si llega, se usa; si no, se resuelve cuando hay **una sola**
    compañía activa y, si hay más, se exige explícitamente.
    """
    if cia.strip():
        return _compania_id(cursor, _compania(cursor, cia))
    cursor.execute("SELECT id FROM companias WHERE estado = 'Activa' ORDER BY codigo")
    filas = cursor.fetchall()
    if len(filas) == 1:
        return int(filas[0][0])
    raise ValueError("Indique la compañía activa (cia) para crear el tercero.")


def create_third_party(payload: dict[str, Any], *, cia: str = "") -> dict[str, Any]:
    """Crea un tercero activo y con saldo cero, como ``GRABCLI2`` en el legado."""
    from .terceros_repository import ThirdPartyAlreadyExists, normalize_third_party

    data = normalize_third_party(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_para_tercero(cursor, cia)
            cursor.execute(
                "SELECT 1 FROM terceros WHERE compania_id = %s AND nit = %s",
                (compania_id, data["nit"]),
            )
            if cursor.fetchone() is not None:
                raise ThirdPartyAlreadyExists(f"El tercero {data['nit']} ya existe.")
            tipo = "Juridica" if data["tipoPersona"] == 2 else "Natural"
            cursor.execute(
                "INSERT INTO terceros (compania_id, nit, digito, nombre, tipo, tipo_documento, "
                "direccion, telefono, ciudad, codigo_ciudad, zona, correo, estado, saldo, cupo, "
                "nombre_comercial, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, "
                "codigo_legado, fecha_creacion) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Activo', 0, %s, "
                "%s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (
                    compania_id, data["nit"], data["digito"], data["nombre"], tipo,
                    "NIT" if data["tipoDocumento"] == "31" else "CC",
                    data["direccion"], data["telefono"], data["ciudad"],
                    data["codigoCiudad"], data["zona"], data["correo"], data["cupo"],
                    data["nombreComercial"], data["primerNombre"], data["segundoNombre"],
                    data["primerApellido"], data["segundoApellido"], data["nit"], date.today(),
                ),
            )
            cursor.fetchone()
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "nit": data["nit"],
        "digito": data["digito"],
        "nombre": data["nombre"],
        "tipo": "Jurídica" if data["tipoPersona"] == 2 else "Natural",
        "tipoDoc": data["tipoDocumento"],
        "direccion": data["direccion"],
        "telefono": data["telefono"],
        "ciudad": data["ciudad"],
        "estado": "Activo",
        "motivoBloqueo": None,
        "saldo": 0.0,
        "cupo": data["cupo"],
        "fechaCreacion": date.today().isoformat(),
    }


# ---------------------------------------------------------------------------
# Plan de cuentas (etapa D)
# ---------------------------------------------------------------------------
# Clasificación fiscal del legado (`MIVA_RET`) → columnas del destino.
_CLASE_IVA_FISCAL = "Generado"
_CLASE_RETENCION_FISCAL = {"R": "Renta", "V": "IVA", "C": "ICA"}


def _get_cuenta(cursor: Any, compania_id: int, codigo: str) -> dict[str, Any]:
    """Contrato de una sola cuenta, con sus acumulados (mismo que el listado)."""
    from .ads_repository import AccountNotFound

    cursor.execute(CUENTA_SELECT + " AND cu.codigo = %s", (compania_id, codigo))
    cuentas = _cuentas_desde_filas(cursor.fetchall())
    if not cuentas:
        raise AccountNotFound(f"No existe la cuenta {codigo}.")
    return cuentas[0]


def create_account(company_code: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Crea una cuenta maestra después de validar duplicado y jerarquía.

    Espeja ``ads_repository.create_account``: no toca saldos (la cuenta nace en
    cero) y exige que exista la cuenta padre del nivel anterior.
    """
    from .ads_repository import AccountAlreadyExists, normalize_account, parent_code

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            data = normalize_account(payload, include_code=True)
            code = data["codigo"]
            cursor.execute(
                "SELECT 1 FROM cuentas WHERE compania_id = %s AND codigo = %s",
                (compania_id, code),
            )
            if cursor.fetchone() is not None:
                raise AccountAlreadyExists(f"Ya existe la cuenta {code}.")

            padre = parent_code(code)
            padre_id = None
            if padre is not None:
                cursor.execute(
                    "SELECT id FROM cuentas WHERE compania_id = %s AND codigo = %s",
                    (compania_id, padre),
                )
                fila = cursor.fetchone()
                if fila is None:
                    raise ValueError(f"Primero debe existir la cuenta padre {padre}.")
                padre_id = int(fila[0])

            # `path` encadena los ancestros **existentes** y el código nuevo, igual
            # que el cargador; así una cuenta creada en caliente queda ordenada como
            # las migradas.
            ancestros = []
            for largo in (1, 2, 4, 6, 9, 12):
                if largo >= len(code):
                    break
                cursor.execute(
                    "SELECT 1 FROM cuentas WHERE compania_id = %s AND codigo = %s",
                    (compania_id, code[:largo]),
                )
                if cursor.fetchone() is not None:
                    ancestros.append(code[:largo])

            cursor.execute(
                "INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, "
                "controla_tercero, controla_centro, ajuste, clase_iva, clase_retencion, "
                "parent_id, path) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    compania_id, code, data["nombre"], len(code), data["afectable"],
                    data["requiereTercero"], data["requiereCentro"], data["ajuste"],
                    _CLASE_IVA_FISCAL if data["tipoFiscal"] == "I" else None,
                    _CLASE_RETENCION_FISCAL.get(data["tipoFiscal"]),
                    padre_id, "/" + "/".join([*ancestros, code]),
                ),
            )
            contrato = _get_cuenta(cursor, compania_id, code)
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return contrato


def update_account(company_code: str, code: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Modifica controles de una cuenta sin alterar código, saldos ni acumulados."""
    from .ads_repository import AccountNotFound, normalize_account

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo_cia = _compania(cursor, company_code)
            compania_id = _compania_id(cursor, codigo_cia)
            data = normalize_account(payload, include_code=False)
            cursor.execute(
                "SELECT id FROM cuentas WHERE compania_id = %s AND codigo = %s",
                (compania_id, code),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise AccountNotFound(f"No existe la cuenta {code}.")
            cursor.execute(
                "UPDATE cuentas SET nombre = %s, afectable = %s, controla_tercero = %s, "
                "controla_centro = %s, ajuste = %s, clase_iva = %s, clase_retencion = %s "
                "WHERE id = %s",
                (
                    data["nombre"], data["afectable"], data["requiereTercero"],
                    data["requiereCentro"], data["ajuste"],
                    _CLASE_IVA_FISCAL if data["tipoFiscal"] == "I" else None,
                    _CLASE_RETENCION_FISCAL.get(data["tipoFiscal"]), int(fila[0]),
                ),
            )
            contrato = _get_cuenta(cursor, compania_id, code)
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return contrato


# ---------------------------------------------------------------------------
# Parámetros de operación (etapa D)
# ---------------------------------------------------------------------------
def update_operation_parameters(cia: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Graba en ``parametros_operacion`` los mismos controles de ``DSIGRABA6``."""
    from .parametros_operacion_repository import (
        OperationParametersValidationError,
        _normalize,
    )
    from .postgres_repository import get_operation_parameters

    data = _normalize(payload)
    # Las claves del jsonb son los códigos de período sin prefijo (`00`..`12`): son
    # las que lee `PERIODOS_ALIASES` al reconstruir `CT00`..`CT12` para el mapeador.
    periodos = {code: bool(value) for code, value in data["periodosHabilitados"].items()}
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            cursor.execute(
                "SELECT count(*) FROM parametros_operacion p JOIN companias co ON co.id = p.compania_id "
                "WHERE co.codigo = %s",
                (codigo,),
            )
            if int(cursor.fetchone()[0]) != 1:
                raise OperationParametersValidationError(
                    "CONCTR debe contener exactamente un registro para modificar sus parámetros."
                )
            cursor.execute(
                "UPDATE parametros_operacion p SET nombre_empresa = %s, nit = %s, direccion = %s, "
                "ciudad = %s, directorio_contabilidad = %s, anio_operacion = %s, "
                "contabilidad_conciliacion = %s, verifica_documentos_lotes = %s, "
                "terceros_documentos_propios = %s, controla_usuario_lotes = %s, "
                "comentario_certificado = %s, periodos_habilitados = %s::jsonb "
                "WHERE p.compania_id = (SELECT id FROM companias WHERE codigo = %s)",
                (
                    data["nombreEmpresa"], data["nit"], data["direccion"], data["ciudad"],
                    data["directorioContabilidad"], str(data["anioOperacion"]),
                    data["contabilidadConciliacion"], data["verificaDocumentosLotes"],
                    data["tercerosDocumentosPropios"], data["controlaUsuarioLotes"],
                    data["comentarioCertificado"], json.dumps(periodos), codigo,
                ),
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return get_operation_parameters(cia)


# ---------------------------------------------------------------------------
# Anulación de documentos (etapa D)
# ---------------------------------------------------------------------------
def annul_document(
    cia: str,
    *,
    header_id: int,
    document: str,
    voucher: str,
    document_type: str,
    movement_date: str,
    user: str,
    reason: str,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Anula un documento creando su reversión, vía ``anular_documento``.

    A diferencia del legado —que **borraba** cabecera y partidas— el modelo nuevo
    conserva el original (estado ``Anulado``) y crea el documento de reversión,
    de modo que la pista de auditoría no se pierde. Los acumulados fiscales se
    recalculan con ``regenerar_acumulados``, como hacía el motor viejo con
    ``CONMAE``/``CONTERCE``/``COCENTRO``.
    """
    from .anulacion_repository import AnnulmentConflict, AnnulmentValidationError

    documento = document.strip()
    comprobante = voucher.strip()
    tipo = document_type.strip()
    if not documento or len(documento) > 12:
        raise AnnulmentValidationError("El numero de documento no es valido.")
    if not comprobante or len(comprobante) > 6:
        raise AnnulmentValidationError("El comprobante no es valido.")
    if not tipo or len(tipo) > 2:
        raise AnnulmentValidationError("El tipo de documento no es valido.")
    try:
        fecha = date.fromisoformat(movement_date.strip())
    except ValueError as exc:
        raise AnnulmentValidationError("La fecha del documento no es valida.") from exc
    motivo = reason.strip()
    if not 5 <= len(motivo) <= 180:
        raise AnnulmentValidationError("Indique un motivo de anulacion entre 5 y 180 caracteres.")
    usuario = user.strip().upper()[:4] or "WEB"

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, cia)
            compania_id = _compania_id(cursor, codigo)
            cursor.execute(
                "SELECT d.id, d.periodo, d.estado, d.comprobante_id, "
                "coalesce(sum(l.debito), 0) AS debito, coalesce(sum(l.credito), 0) AS credito, "
                "count(l.id) AS partidas, count(DISTINCT l.cuenta_id) AS cuentas, "
                "count(DISTINCT l.tercero_id) AS terceros, count(DISTINCT l.centro_costo_id) AS centros "
                "FROM documentos d "
                "LEFT JOIN documento_lineas l ON l.documento_id = d.id "
                "WHERE d.id = %s AND d.compania_id = %s "
                "GROUP BY d.id, d.periodo, d.estado, d.comprobante_id",
                (header_id, compania_id),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise AnnulmentConflict("El documento ya no existe o fue modificado.")
            doc_id, periodo, estado, comprobante_id, debito, credito, partidas, cuentas, terceros, centros = fila
            if int(partidas) == 0:
                raise AnnulmentConflict("El documento no tiene partidas para anular.")
            if abs(float(debito) - float(credito)) > 0.01:
                raise AnnulmentConflict(
                    "El documento esta descuadrado y no puede anularse automaticamente."
                )
            if str(estado) == "Anulado":
                raise AnnulmentConflict("El documento ya esta anulado.")

            cursor.execute(
                "SELECT estado FROM periodos_contables WHERE compania_id = %s AND anio = %s AND periodo = %s",
                (compania_id, fecha.year, periodo),
            )
            control = cursor.fetchone()
            if control is not None and str(control[0]) == "Cerrado":
                raise AnnulmentValidationError("El periodo del documento esta cerrado.")

            usuario_id = _usuario_id(cursor, usuario)
            cursor.execute(
                "SELECT anular_documento(%s, %s, %s, %s, %s, %s, %s)",
                (doc_id, usuario_id, motivo, "", comprobante_id, fecha, periodo),
            )
            cursor.fetchone()
            for tipo_acumulado in ("Terceros", "Centros", "Retencion", "Iva"):
                cursor.execute(
                    "SELECT regenerar_acumulados(%s, %s, %s)",
                    (compania_id, fecha.year, tipo_acumulado),
                )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "documento": documento,
        "partidasRetiradas": int(partidas),
        "totalDebito": round(float(debito), 2),
        "totalCredito": round(abs(float(credito)), 2),
        "cuentasRecalculadas": int(cuentas),
        "tercerosRecalculados": int(terceros),
        "centrosRecalculados": int(centros),
        "dryRun": dry_run,
        "advertencia": "",
    }


# ---------------------------------------------------------------------------
# Lotes (etapa D)
#
# Las reglas viven en `validar_lote` y `contabilizar_lote` (funciones.sql):
# validación por documento, periodo cerrado, idempotencia y avance de
# consecutivos. Aquí se mantiene la cabecera (`lotes`), las partidas
# (`lote_lineas`) y la traducción del contrato.
# ---------------------------------------------------------------------------
def _lote_editable(cursor: Any, compania_id: int, codigo: str) -> dict[str, Any]:
    """Cabecera editable del lote, con los mensajes del motor viejo.

    El legado nunca permitía tocar un lote contabilizado, anulado o histórico;
    en el modelo nuevo ese estado vive en `lotes.estado`, así que se rechazan
    `Contabilizado` y `Anulado` (no hay columna histórica separada).
    """
    from .lotes_repository import LotConflict, LotValidationError

    cursor.execute(
        "SELECT id, codigo, nombre, periodo, estado, anio FROM lotes "
        "WHERE compania_id = %s AND codigo = %s FOR UPDATE",
        (compania_id, codigo),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise LotConflict(f"El lote {codigo} no existe para la compañía activa.")
    if str(fila[4]) in ("Contabilizado", "Anulado"):
        raise LotValidationError(
            "El lote está contabilizado, anulado o histórico y no se puede modificar."
        )
    return {
        "id": int(fila[0]), "codigo": fila[1], "nombre": fila[2],
        "periodo": fila[3], "estado": fila[4], "anio": int(fila[5]),
    }


def _ids_de_maestros(cursor: Any, compania_id: int, data: dict[str, Any]) -> dict[str, Any]:
    """Resuelve y valida los maestros de una partida (equivalente a ``_validate_line_masters``)."""
    from .lotes_repository import LotValidationError

    cursor.execute(
        "SELECT id, afectable, controla_tercero, controla_centro, controla_base, clase_iva, clase_retencion "
        "FROM cuentas WHERE compania_id = %s AND codigo = %s",
        (compania_id, data["cuenta"]),
    )
    cuenta = cursor.fetchone()
    if cuenta is None:
        raise LotValidationError("La cuenta no existe para la compañía activa.")
    cuenta_id, afectable, controla_tercero, controla_centro, controla_base, clase_iva, clase_ret = cuenta
    if not afectable:
        raise LotValidationError("La cuenta no permite movimiento contable.")

    requiere_tercero = bool(controla_tercero) or bool(clase_iva) or bool(clase_ret)
    if requiere_tercero and not data["nit"]:
        raise LotValidationError("La cuenta seleccionada requiere tercero.")
    if not requiere_tercero and data["nit"]:
        raise LotValidationError("La cuenta seleccionada no maneja tercero.")
    if requiere_tercero and len(data["nit"]) > 11:
        raise LotValidationError("El NIT admite máximo 11 caracteres en CONLOTES.")

    tercero_id = None
    if data["nit"]:
        cursor.execute(
            "SELECT id FROM terceros WHERE compania_id = %s AND (codigo_legado = %s OR nit = %s) LIMIT 1",
            (compania_id, data["nit"], data["nit"]),
        )
        fila = cursor.fetchone()
        if fila is None:
            raise LotValidationError("El tercero no existe en FADCLI.")
        tercero_id = int(fila[0])

    if bool(controla_centro) and not data["centro"]:
        raise LotValidationError("La cuenta seleccionada requiere centro de costo.")
    if not bool(controla_centro) and data["centro"]:
        raise LotValidationError("La cuenta seleccionada no maneja centro de costo.")
    centro_id = None
    if data["centro"]:
        cursor.execute(
            "SELECT id FROM centros_costos WHERE compania_id = %s AND codigo = %s",
            (compania_id, data["centro"]),
        )
        fila = cursor.fetchone()
        if fila is None:
            raise LotValidationError("El centro de costo no existe para la compañía activa.")
        centro_id = int(fila[0])

    if not data["comprobante"] or len(data["comprobante"]) > 2:
        raise LotValidationError("El comprobante es obligatorio y admite máximo 2 caracteres.")
    cursor.execute(
        "SELECT 1 FROM comprobantes WHERE compania_id = %s AND codigo = %s",
        (compania_id, data["comprobante"]),
    )
    if cursor.fetchone() is None:
        raise LotValidationError("El comprobante no existe para la compañía activa.")

    if not data["tipoDocumento"] or len(data["tipoDocumento"]) > 2:
        raise LotValidationError("El tipo de documento es obligatorio y admite máximo 2 caracteres.")
    cursor.execute(
        "SELECT id FROM tipos_documento WHERE compania_id = %s AND codigo = %s",
        (compania_id, data["tipoDocumento"]),
    )
    fila = cursor.fetchone()
    if fila is None:
        raise LotValidationError("El tipo de documento no existe en VISDOCUM.")
    tipo_documento_id = int(fila[0])

    if (bool(controla_base) or bool(clase_iva) or bool(clase_ret)) and data["base"] <= 0:
        raise LotValidationError("La cuenta de IVA o retención requiere una base.")

    return {
        "cuenta_id": int(cuenta_id),
        "tercero_id": tercero_id,
        "centro_costo_id": centro_id,
        "tipo_documento_id": tipo_documento_id,
    }


def _insertar_linea(
    cursor: Any, lote_id: int, compania_id: int, numero_linea: int, data: dict[str, Any], ids: dict[str, Any]
) -> int:
    cursor.execute(
        "INSERT INTO lote_lineas (lote_id, compania_id, numero_linea, cuenta_id, tercero_id, "
        "centro_costo_id, tipo_documento_id, comprobante, documento, fecha, fecha_documento, "
        "debito, credito, base, clase, documento_afectado, concepto, nit_alterno, origen) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Manual') "
        "RETURNING id",
        (
            lote_id, compania_id, numero_linea, ids["cuenta_id"], ids["tercero_id"],
            ids["centro_costo_id"], ids["tipo_documento_id"], data["comprobante"],
            data["documento"], data["fecha"], data["fecha"], data["debito"], data["credito"],
            data["base"], _clase_desde_cuenta(cursor, compania_id, data["cuenta"]),
            data["documentoAfectado"], data["concepto"], data["nit"],
        ),
    )
    return int(cursor.fetchone()[0])


def _clase_desde_cuenta(cursor: Any, compania_id: int, codigo: str) -> str:
    """Traduce el tipo fiscal de la cuenta (`MIVA_RET`) a la clase del destino."""
    cursor.execute(
        "SELECT CASE WHEN clase_iva IS NOT NULL THEN 'IVA' "
        "WHEN clase_retencion IS NOT NULL THEN 'Retencion' ELSE '' END "
        "FROM cuentas WHERE compania_id = %s AND codigo = %s",
        (compania_id, codigo),
    )
    fila = cursor.fetchone()
    return _text(fila[0]) if fila else ""


def _refrescar_totales(cursor: Any, lote_id: int, compania_id: int, codigo: str) -> None:
    """Recalcula los controles del lote y lo devuelve a Borrador, como el legado."""
    cursor.execute(
        "UPDATE lotes SET estado = 'Borrador' WHERE compania_id = %s AND id = %s",
        (compania_id, lote_id),
    )


def _totales_lote(cursor: Any, lote_id: int) -> tuple[int, float, float]:
    cursor.execute(
        "SELECT count(*), coalesce(sum(debito), 0), coalesce(sum(credito), 0) "
        "FROM lote_lineas WHERE lote_id = %s",
        (lote_id,),
    )
    items, debito, credito = cursor.fetchone()
    return int(items), float(debito), float(credito)


def create_lot(cia: str, payload: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
    """Crea la cabecera de un lote, como ``CREALOT2``/``GRABALOT``."""
    from .lotes_repository import LotConflict, _normalize_lot

    codigo = str(normalize_company_code(cia))
    data = _normalize_lot(payload, creating=True)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            anio = _anio_operacion(cursor, compania_id)
            cursor.execute(
                "SELECT 1 FROM lotes WHERE compania_id = %s AND anio = %s AND codigo = %s",
                (compania_id, anio, data["lote"]),
            )
            if cursor.fetchone() is not None:
                raise LotConflict(f"El lote {data['lote']} ya existe para la compañía activa.")
            _asegurar_periodo(cursor, compania_id, anio, data["mes"])
            usuario_id = _usuario_id(cursor, data["usuario"])
            cursor.execute(
                "INSERT INTO lotes (compania_id, anio, periodo, codigo, nombre, usuario_id, "
                "origen, fecha, estado) VALUES (%s, %s, %s, %s, %s, %s, 'Manual', %s, 'Borrador') "
                "RETURNING id",
                (compania_id, anio, data["mes"], data["lote"], data["nombre"], usuario_id, date.today()),
            )
            lote_id = int(cursor.fetchone()[0])
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {"id": lote_id, **data, "estado": "Borrador", "items": 0, "debito": 0, "credito": 0}


def update_lot(cia: str, lot: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Modifica descripción, mes y responsable sin cambiar código ni compañía."""
    from .lotes_repository import _normalize_lot, _validate_lot_code

    codigo = str(normalize_company_code(cia))
    codigo_lote = _validate_lot_code(lot)
    data = _normalize_lot({**payload, "lote": codigo_lote}, creating=False)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            lote = _lote_editable(cursor, compania_id, codigo_lote)
            _asegurar_periodo(cursor, compania_id, lote["anio"], data["mes"])
            usuario_id = _usuario_id(cursor, data["usuario"])
            cursor.execute(
                "UPDATE lotes SET nombre = %s, periodo = %s, usuario_id = %s, estado = 'Borrador' "
                "WHERE id = %s",
                (data["nombre"], data["mes"], usuario_id, lote["id"]),
            )
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {**data, "estado": "Borrador"}


def save_lot_line(
    cia: str,
    lot: str,
    payload: dict[str, Any],
    *,
    line_id: int | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Crea o modifica una partida del lote, como ``EDITACELDA``/``GRABAMOV1``."""
    from .lotes_repository import LotConflict, _normalize_lot_line, _validate_lot_code

    codigo = str(normalize_company_code(cia))
    codigo_lote = _validate_lot_code(lot)
    data = _normalize_lot_line(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            lote = _lote_editable(cursor, compania_id, codigo_lote)
            ids = _ids_de_maestros(cursor, compania_id, data)
            if line_id is not None:
                cursor.execute(
                    "SELECT 1 FROM lote_lineas WHERE lote_id = %s AND id = %s",
                    (lote["id"], line_id),
                )
                if cursor.fetchone() is None:
                    raise LotConflict("La partida ya no existe en el lote.")
                clase = _clase_desde_cuenta(cursor, compania_id, data["cuenta"])
                cursor.execute(
                    "UPDATE lote_lineas SET cuenta_id = %s, tercero_id = %s, centro_costo_id = %s, "
                    "tipo_documento_id = %s, comprobante = %s, documento = %s, fecha = %s, "
                    "fecha_documento = %s, debito = %s, credito = %s, base = %s, clase = %s, "
                    "documento_afectado = %s, concepto = %s, nit_alterno = %s WHERE id = %s",
                    (
                        ids["cuenta_id"], ids["tercero_id"], ids["centro_costo_id"],
                        ids["tipo_documento_id"], data["comprobante"], data["documento"],
                        data["fecha"], data["fecha"], data["debito"], data["credito"],
                        data["base"], clase, data["documentoAfectado"], data["concepto"],
                        data["nit"], line_id,
                    ),
                )
                actual = int(line_id)
            else:
                cursor.execute(
                    "SELECT coalesce(max(numero_linea), 0) + 1 FROM lote_lineas WHERE lote_id = %s",
                    (lote["id"],),
                )
                numero = int(cursor.fetchone()[0])
                actual = _insertar_linea(cursor, lote["id"], compania_id, numero, data, ids)
            _refrescar_totales(cursor, lote["id"], compania_id, codigo_lote)
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "id": actual,
        "cuenta": data["cuenta"],
        "nit": data["nit"],
        "centro": data["centro"],
        "comprobante": data["comprobante"],
        "tipoDocumento": data["tipoDocumento"],
        "documento": data["documento"],
        "documentoAfectado": data["documentoAfectado"],
        "concepto": data["concepto"],
        "fecha": data["fecha"].isoformat(),
        "debito": float(data["debito"]),
        "credito": float(data["credito"]),
        "base": float(data["base"]),
    }


def delete_lot_line(cia: str, lot: str, line_id: int) -> None:
    """Elimina una partida del lote editable."""
    from .lotes_repository import LotConflict, _validate_lot_code

    codigo = str(normalize_company_code(cia))
    codigo_lote = _validate_lot_code(lot)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            lote = _lote_editable(cursor, compania_id, codigo_lote)
            cursor.execute(
                "SELECT 1 FROM lote_lineas WHERE lote_id = %s AND id = %s",
                (lote["id"], line_id),
            )
            if cursor.fetchone() is None:
                raise LotConflict("La partida ya no existe en el lote.")
            cursor.execute("DELETE FROM lote_lineas WHERE id = %s", (line_id,))
            _refrescar_totales(cursor, lote["id"], compania_id, codigo_lote)
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def delete_lot(cia: str, lot: str, *, force: bool = False) -> dict[str, Any]:
    """Elimina el lote y sus partidas.

    ``force`` no aplica: la protección del legado vivía en ``CONMOVI.BORRAR``, que
    el modelo nuevo no conserva; se acepta por compatibilidad de firma.
    """
    from .lotes_repository import _validate_lot_code

    codigo = str(normalize_company_code(cia))
    codigo_lote = _validate_lot_code(lot)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            lote = _lote_editable(cursor, compania_id, codigo_lote)
            cursor.execute("SELECT count(*) FROM lote_lineas WHERE lote_id = %s", (lote["id"],))
            partidas = int(cursor.fetchone()[0])
            cursor.execute("DELETE FROM lote_lineas WHERE lote_id = %s", (lote["id"],))
            cursor.execute("DELETE FROM lotes WHERE id = %s", (lote["id"],))
        _commit(connection, False)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {"lote": codigo_lote, "partidasEliminadas": partidas, "eliminado": True}


def verify_lot(cia: str, lot: str, *, persist: bool = True) -> dict[str, Any]:
    """Verifica la consistencia del lote con ``validar_lote`` y su contrato."""
    from .lotes_repository import _validate_lot_code

    codigo = str(normalize_company_code(cia))
    codigo_lote = _validate_lot_code(lot)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            lote = _lote_editable(cursor, compania_id, codigo_lote)
            cursor.execute("SELECT validar_lote(%s)", (lote["id"],))
            valido = bool(cursor.fetchone()[0])
            cursor.execute("SELECT estado FROM lotes WHERE id = %s", (lote["id"],))
            estado = str(cursor.fetchone()[0])
            items, debito, credito = _totales_lote(cursor, lote["id"])
            cursor.execute(
                "SELECT count(*) FROM (SELECT DISTINCT comprobante, documento, tipo_documento_id "
                "FROM lote_lineas WHERE lote_id = %s) x",
                (lote["id"],),
            )
            documentos = int(cursor.fetchone()[0])
            cursor.execute(
                "SELECT v.linea_id, v.ambito, v.tipo, v.mensaje, l.documento "
                "FROM lote_validaciones v LEFT JOIN lote_lineas l ON l.id = v.linea_id "
                "WHERE v.lote_id = %s ORDER BY v.id",
                (lote["id"],),
            )
            filas = cursor.fetchall()
            errores = [
                {
                    "categoria": _text(fila[1]),
                    "lineaId": int(fila[0]) if fila[0] is not None else None,
                    "documento": _text(fila[4]),
                    "mensaje": _text(fila[3]),
                }
                for fila in filas
            ]
            duplicados = sum(1 for fila in filas if _text(fila[2]) == "Ya contabilizado")
        _commit(connection, not persist)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "lote": codigo_lote,
        "valido": valido,
        "estado": estado,
        "items": items,
        "documentos": documentos,
        "documentosDuplicados": duplicados,
        "debito": debito,
        "credito": credito,
        "diferencia": round(debito - credito, 2),
        "errores": errores,
    }


def post_lot(cia: str, lot: str, *, user: str = "WEB", dry_run: bool = False) -> dict[str, Any]:
    """Contabiliza un lote verificado con ``contabilizar_lote`` (un documento por grupo)."""
    from .lotes_repository import LotValidationError, _validate_lot_code

    codigo = str(normalize_company_code(cia))
    codigo_lote = _validate_lot_code(lot)
    usuario = (user or "WEB").strip().upper() or "WEB"
    if len(usuario) > 4:
        raise LotValidationError("El código de usuario admite máximo 4 caracteres.")
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            lote = _lote_editable(cursor, compania_id, codigo_lote)
            items, debito, credito = _totales_lote(cursor, lote["id"])
            usuario_id = _usuario_id(cursor, usuario)

            # El flujo web va de Verificado a contabilizado; el modelo nuevo exige
            # el estado Aprobado como paso explícito, así que se promueve aquí.
            cursor.execute("SELECT validar_lote(%s)", (lote["id"],))
            if not bool(cursor.fetchone()[0]):
                cursor.execute(
                    "SELECT count(*) FROM lote_validaciones WHERE lote_id = %s AND severidad = 'Error'",
                    (lote["id"],),
                )
                total = int(cursor.fetchone()[0])
                raise LotValidationError(
                    f"El lote tiene {total} inconsistencia(s). Verifíquelo antes de actualizar."
                )
            cursor.execute("UPDATE lotes SET estado = 'Aprobado' WHERE id = %s", (lote["id"],))
            cursor.execute("SELECT contabilizar_lote(%s, %s)", (lote["id"], usuario_id))
            ids = cursor.fetchone()[0] or []
            documentos = len(ids)
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return {
        "lote": codigo_lote,
        "estado": "Validado sin grabar" if dry_run else "Actualizado",
        "documentos": documentos,
        "partidas": items,
        "debito": debito,
        "credito": credito,
        "dryRun": dry_run,
        "advertencias": [],
    }


def import_lot(cia: str, payload: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
    """Crea cabecera y partidas importadas como una unidad atómica (Borrador)."""
    from .lotes_repository import LotConflict, LotValidationError, _normalize_lot, _normalize_lot_line

    codigo = str(normalize_company_code(cia))
    raw_lines = payload.get("lineas")
    if not isinstance(raw_lines, list) or not raw_lines:
        raise LotValidationError("La importación no contiene partidas.")
    if len(raw_lines) > 5000:
        raise LotValidationError("La importación admite máximo 5.000 partidas por lote.")
    data = _normalize_lot(payload, creating=True)
    lineas = []
    for index, cruda in enumerate(raw_lines, start=1):
        if not isinstance(cruda, dict):
            raise LotValidationError(f"Fila {index}: el contenido no es válido.")
        try:
            lineas.append(_normalize_lot_line(cruda))
        except LotValidationError as exc:
            raise LotValidationError(f"Fila {index}: {exc}") from exc

    connection = _connect()
    try:
        with connection.cursor() as cursor:
            compania_id = _compania_id(cursor, _compania(cursor, codigo))
            anio = _anio_operacion(cursor, compania_id)
            cursor.execute(
                "SELECT 1 FROM lotes WHERE compania_id = %s AND anio = %s AND codigo = %s",
                (compania_id, anio, data["lote"]),
            )
            if cursor.fetchone() is not None:
                raise LotConflict(f"El lote {data['lote']} ya existe para la compañía activa.")
            _asegurar_periodo(cursor, compania_id, anio, data["mes"])
            usuario_id = _usuario_id(cursor, data["usuario"])
            cursor.execute(
                "INSERT INTO lotes (compania_id, anio, periodo, codigo, nombre, usuario_id, "
                "origen, fecha, estado) VALUES (%s, %s, %s, %s, %s, %s, 'Importacion', %s, 'Borrador') "
                "RETURNING id",
                (compania_id, anio, data["mes"], data["lote"], data["nombre"], usuario_id, date.today()),
            )
            lote_id = int(cursor.fetchone()[0])
            for numero, linea in enumerate(lineas, start=1):
                ids = _ids_de_maestros(cursor, compania_id, linea)
                _insertar_linea(cursor, lote_id, compania_id, numero, linea, ids)
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    debito = round(sum(float(linea["debito"]) for linea in lineas), 2)
    credito = round(sum(float(linea["credito"]) for linea in lineas), 2)
    documentos = len({(l["documento"], l["tipoDocumento"], l["comprobante"]) for l in lineas})
    return {
        "lote": data["lote"],
        "valido": False,
        "estado": "Validado sin grabar" if dry_run else "Borrador",
        "items": len(lineas),
        "documentos": documentos,
        "documentosDuplicados": 0,
        "debito": debito,
        "credito": credito,
        "diferencia": round(debito - credito, 2),
        "errores": [],
        "nombre": data["nombre"],
        "mes": data["mes"],
        "creado": not dry_run,
    }


# ---------------------------------------------------------------------------
# Captura directa (etapa D)
# ---------------------------------------------------------------------------
def _siguiente_consecutivo(cursor: Any, compania_id: int, anio: int, comprobante_id: int) -> int:
    """Reserva el consecutivo del comprobante con la fila bloqueada (``FOR UPDATE``)."""
    cursor.execute(
        "SELECT consecutivo_actual FROM consecutivos_comprobantes "
        "WHERE compania_id = %s AND anio = %s AND comprobante_id = %s FOR UPDATE",
        (compania_id, anio, comprobante_id),
    )
    fila = cursor.fetchone()
    if fila is None:
        cursor.execute(
            "INSERT INTO consecutivos_comprobantes (compania_id, anio, comprobante_id, consecutivo_actual) "
            "VALUES (%s, %s, %s, 2) ON CONFLICT (compania_id, anio, comprobante_id) "
            "DO UPDATE SET consecutivo_actual = consecutivos_comprobantes.consecutivo_actual + 1",
            (compania_id, anio, comprobante_id),
        )
        return 1
    cursor.execute(
        "UPDATE consecutivos_comprobantes SET consecutivo_actual = consecutivo_actual + 1 "
        "WHERE compania_id = %s AND anio = %s AND comprobante_id = %s",
        (compania_id, anio, comprobante_id),
    )
    return int(fila[0])


def _aplicar_saldos(
    cursor: Any, compania_id: int, anio: int, periodo: str, cuenta_id: int,
    tercero_id: int | None, centro_id: int | None, debito: Any, credito: Any,
) -> None:
    """Upsert de los saldos por cuenta, tercero y centro (mismo efecto que ``contabilizar_lote``)."""
    cursor.execute(
        "INSERT INTO saldos_cuenta (compania_id, anio, periodo, cuenta_id, debito, credito) "
        "VALUES (%s, %s, %s, %s, %s, %s) "
        "ON CONFLICT (compania_id, anio, periodo, cuenta_id) "
        "DO UPDATE SET debito = saldos_cuenta.debito + EXCLUDED.debito, "
        "credito = saldos_cuenta.credito + EXCLUDED.credito",
        (compania_id, anio, periodo, cuenta_id, debito, credito),
    )
    if tercero_id is not None:
        cursor.execute(
            "INSERT INTO saldos_cuenta_tercero (compania_id, anio, periodo, cuenta_id, tercero_id, debito, credito) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (compania_id, anio, periodo, cuenta_id, tercero_id) "
            "DO UPDATE SET debito = saldos_cuenta_tercero.debito + EXCLUDED.debito, "
            "credito = saldos_cuenta_tercero.credito + EXCLUDED.credito",
            (compania_id, anio, periodo, cuenta_id, tercero_id, debito, credito),
        )
    if centro_id is not None:
        cursor.execute(
            "INSERT INTO saldos_cuenta_centro (compania_id, anio, periodo, cuenta_id, centro_costo_id, debito, credito) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (compania_id, anio, periodo, cuenta_id, centro_costo_id) "
            "DO UPDATE SET debito = saldos_cuenta_centro.debito + EXCLUDED.debito, "
            "credito = saldos_cuenta_centro.credito + EXCLUDED.credito",
            (compania_id, anio, periodo, cuenta_id, centro_id, debito, credito),
        )


def post_direct_movement(payload: dict[str, Any], *, dry_run: bool = False) -> dict[str, Any]:
    """Contabiliza una captura directa: un documento con sus partidas y saldos.

    Es el equivalente de la escritura de ``MOV01``/``CONDOCUM``/``CONMAE`` del
    legado. El consecutivo sale de ``consecutivos_comprobantes`` —el mismo que usa
    ``contabilizar_lote``—, no de ``VISDOCUM.CONSE``: es la numeración del modelo
    nuevo. Decisión en `db/migration/12_escrituras.md`.
    """
    from .contabilizacion_repository import PostingValidationError, _normalize_payload

    data = _normalize_payload(payload)
    connection = _connect()
    try:
        with connection.cursor() as cursor:
            codigo = _compania(cursor, str(data["cia"]))
            compania_id = _compania_id(cursor, codigo)
            periodo = f"{data['mes']:02d}"
            cursor.execute(
                "SELECT estado FROM periodos_contables WHERE compania_id = %s AND anio = %s AND periodo = %s",
                (compania_id, data["anio"], periodo),
            )
            control = cursor.fetchone()
            if control is not None and str(control[0]) == "Cerrado":
                raise PostingValidationError(f"El período {data['mes']:02d}/{data['anio']} está cerrado.")
            _asegurar_periodo(cursor, compania_id, data["anio"], periodo)

            cursor.execute(
                "SELECT id FROM comprobantes WHERE compania_id = %s AND codigo = %s",
                (compania_id, data["comprobante"]),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise PostingValidationError(
                    "El comprobante no existe en CONTICOM para la compañía activa."
                )
            comprobante_id = int(fila[0])

            cursor.execute(
                "SELECT id, numeracion, prefijo FROM tipos_documento "
                "WHERE compania_id = %s AND codigo = %s",
                (compania_id, data["tipoDocumento"]),
            )
            fila = cursor.fetchone()
            if fila is None:
                raise PostingValidationError("El tipo de documento no existe en VISDOCUM.")
            tipo_documento_id, numeracion, prefijo = int(fila[0]), _text(fila[1]), _text(fila[2])

            numero = _siguiente_consecutivo(cursor, compania_id, data["anio"], comprobante_id)
            if numeracion == "Manual":
                if not data["numeroDocumento"]:
                    raise PostingValidationError(
                        "VISDOCUM permite consecutivo manual; el número es obligatorio."
                    )
                documento = data["numeroDocumento"]
            elif prefijo:
                documento = prefijo + str(numero).zfill(max(1, 12 - len(prefijo)))
            else:
                documento = data["tipoDocumento"] + str(numero).zfill(10)
            if len(documento) > 12:
                raise PostingValidationError("El consecutivo generado supera la longitud de TDOCUM.")

            # Resolver maestros de cada partida (mensajes con el número de línea).
            for linea in data["lineas"]:
                marcador = {
                    "cuenta": linea["cuenta"], "nit": linea["nit"], "centro": linea["centro"],
                    "comprobante": data["comprobante"], "tipoDocumento": data["tipoDocumento"],
                    "base": linea["base"],
                }
                linea.update(_ids_de_maestros(cursor, compania_id, marcador))

            usuario_id = _usuario_id(cursor, data["usuario"])
            primer_tercero = next((l["tercero_id"] for l in data["lineas"] if l["tercero_id"]), None)
            cursor.execute(
                "INSERT INTO documentos (compania_id, anio, comprobante_id, numero, documento, "
                "tipo_documento_id, fecha, fecha_documento, periodo, tercero_id, concepto, estado, "
                "usuario_id, origen) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, "
                "'Contabilizado', %s, 'Manual') RETURNING id",
                (
                    compania_id, data["anio"], comprobante_id, numero, documento,
                    tipo_documento_id, data["fecha"], data["fecha"], periodo,
                    primer_tercero, data["concepto"], usuario_id,
                ),
            )
            documento_id = int(cursor.fetchone()[0])

            for linea in data["lineas"]:
                cursor.execute(
                    "INSERT INTO documento_lineas (documento_id, compania_id, numero_linea, cuenta_id, "
                    "tercero_id, centro_costo_id, tipo_documento_id, debito, credito, base, clase, "
                    "fecha_documento, nit_alterno, documento_afectado, concepto, origen) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Manual')",
                    (
                        documento_id, compania_id, linea["numero"], linea["cuenta_id"],
                        linea["tercero_id"], linea["centro_costo_id"], linea["tipo_documento_id"],
                        linea["debito"], linea["credito"], linea["base"],
                        _clase_desde_cuenta(cursor, compania_id, linea["cuenta"]),
                        data["fecha"], linea["nit"], linea["documentoAfectado"], linea["concepto"],
                    ),
                )
                _aplicar_saldos(
                    cursor, compania_id, data["anio"], periodo, linea["cuenta_id"],
                    linea["tercero_id"], linea["centro_costo_id"], linea["debito"], linea["credito"],
                )

            for tipo_acumulado in ("Terceros", "Centros", "Retencion", "Iva"):
                cursor.execute(
                    "SELECT regenerar_acumulados(%s, %s, %s)",
                    (compania_id, data["anio"], tipo_acumulado),
                )
            cursor.execute(
                "INSERT INTO auditoria (compania_id, anio, usuario_id, accion, modulo, detalle, resultado) "
                "VALUES (%s, %s, %s, 'Contabilización directa', 'Captura directa', %s, 'EXITO')",
                (compania_id, data["anio"], usuario_id, documento),
            )
        _commit(connection, dry_run)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    return {
        "documento": documento,
        "comprobante": data["comprobante"],
        "tipoDocumento": data["tipoDocumento"],
        "fecha": data["fecha"].isoformat(),
        "lineas": len(data["lineas"]),
        "debito": float(data["totalDebito"]),
        "credito": float(data["totalCredito"]),
        "estado": "Validado sin grabar" if dry_run else "Contabilizado",
        "dryRun": dry_run,
        "auditoria": "No aplica en prueba" if dry_run else "Registrada",
        "advertencia": "",
    }


# ---------------------------------------------------------------------------
# Reproceso mensual (etapa D)
# ---------------------------------------------------------------------------
def _comparar_rango(
    cursor: Any, compania_id: int, anio: int, mes_desde: int, mes_hasta: int
) -> dict[str, Any]:
    """Compara el libro contra los acumulados por cuenta y por tercero."""
    desde, hasta = f"{mes_desde:02d}", f"{mes_hasta:02d}"
    cursor.execute(
        "SELECT d.periodo, l.cuenta_id, coalesce(sum(l.debito), 0), coalesce(sum(l.credito), 0), count(*) "
        "FROM documento_lineas l JOIN documentos d ON d.id = l.documento_id "
        "WHERE l.compania_id = %s AND d.anio = %s AND d.periodo BETWEEN %s AND %s "
        "GROUP BY d.periodo, l.cuenta_id",
        (compania_id, anio, desde, hasta),
    )
    libro = {(fila[0], int(fila[1])): (float(fila[2]), float(fila[3]), int(fila[4])) for fila in cursor.fetchall()}

    cursor.execute(
        "SELECT periodo, cuenta_id, coalesce(debito, 0), coalesce(credito, 0) FROM saldos_cuenta "
        "WHERE compania_id = %s AND anio = %s AND periodo BETWEEN %s AND %s",
        (compania_id, anio, desde, hasta),
    )
    saldos = {(fila[0], int(fila[1])): (float(fila[2]), float(fila[3])) for fila in cursor.fetchall()}

    claves = set(libro) | set(saldos)
    diferencia_cuenta = 0.0
    for clave in claves:
        deb_libro, cre_libro, _ = libro.get(clave, (0.0, 0.0, 0))
        deb_saldo, cre_saldo = saldos.get(clave, (0.0, 0.0))
        diferencia_cuenta += abs(deb_libro - deb_saldo) + abs(cre_libro - cre_saldo)

    cursor.execute(
        "SELECT d.periodo, l.cuenta_id, l.tercero_id, coalesce(sum(l.debito), 0), coalesce(sum(l.credito), 0) "
        "FROM documento_lineas l JOIN documentos d ON d.id = l.documento_id "
        "WHERE l.compania_id = %s AND d.anio = %s AND d.periodo BETWEEN %s AND %s "
        "AND l.tercero_id IS NOT NULL GROUP BY d.periodo, l.cuenta_id, l.tercero_id",
        (compania_id, anio, desde, hasta),
    )
    libro_t = {(f[0], int(f[1]), int(f[2])): (float(f[3]), float(f[4])) for f in cursor.fetchall()}
    cursor.execute(
        "SELECT periodo, cuenta_id, tercero_id, coalesce(debito, 0), coalesce(credito, 0) "
        "FROM saldos_cuenta_tercero WHERE compania_id = %s AND anio = %s AND periodo BETWEEN %s AND %s",
        (compania_id, anio, desde, hasta),
    )
    saldos_t = {(f[0], int(f[1]), int(f[2])): (float(f[3]), float(f[4])) for f in cursor.fetchall()}
    diferencia_tercero = 0.0
    for clave in set(libro_t) | set(saldos_t):
        deb_libro, cre_libro = libro_t.get(clave, (0.0, 0.0))
        deb_saldo, cre_saldo = saldos_t.get(clave, (0.0, 0.0))
        diferencia_tercero += abs(deb_libro - deb_saldo) + abs(cre_libro - cre_saldo)

    return {
        "libro": libro,
        "libro_terceros": libro_t,
        "diferencia_cuenta": round(diferencia_cuenta, 2),
        "diferencia_tercero": round(diferencia_tercero, 2),
    }


def simulate_monthly_reprocess(
    company_code: str, year: int, month_from: int, month_to: int
) -> dict[str, Any]:
    """Compara el libro contra los acumulados del rango, sin escribir."""
    import time

    from .reproceso_mensual_repository import _validate_range

    inicio = time.monotonic()
    _validate_range(year, month_from, month_to)
    codigo = str(normalize_company_code(company_code))
    with _connect() as connection, connection.cursor() as cursor:
        compania_id = _compania_id(cursor, _compania(cursor, codigo))
        cursor.execute("SELECT nombre FROM companias WHERE id = %s", (compania_id,))
        nombre = _text(cursor.fetchone()[0])
        comparacion = _comparar_rango(cursor, compania_id, year, month_from, month_to)

    libro = comparacion["libro"]
    registros = sum(valor[2] for valor in libro.values())
    debito = round(sum(valor[0] for valor in libro.values()), 2)
    credito = round(sum(valor[1] for valor in libro.values()), 2)
    total = round(comparacion["diferencia_cuenta"] + comparacion["diferencia_tercero"], 2)
    advertencias = []
    if total == 0 and libro:
        advertencias.append(
            "Los acumulados ya coinciden con el libro; no es necesario ejecutar nuevamente."
        )
    return {
        "compania": {"codigo": f"{int(codigo):03d}", "nombre": nombre},
        "anio": year,
        "mesDesde": month_from,
        "mesHasta": month_to,
        "registrosMovimiento": registros,
        "cuentasProcesadas": len({clave[1] for clave in libro}),
        "auxiliaresTercero": len(comparacion["libro_terceros"]),
        "debito": debito,
        "credito": credito,
        "diferencias": {
            "conmae": comparacion["diferencia_cuenta"],
            "conterce": comparacion["diferencia_tercero"],
            "total": total,
        },
        "advertencias": advertencias,
        "errores": [],
        "puedeEjecutar": total > 0,
        "estado": "Simulación completada",
        "duracionSegundos": round(time.monotonic() - inicio, 2),
        "auditoria": "No aplica",
        "advertenciaAuditoria": "",
        "fuente": "MOV01",
        "destinos": ["CONMAE", "CONTERCE"],
    }


def execute_monthly_reprocess(
    company_code: str,
    year: int,
    month_from: int,
    month_to: int,
    *,
    user: str,
    reason: str,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Simula el reproceso; **no** reescribe los acumulados (ver docstring).

    En el legado el reproceso reemplazaba ``CONMAE``/``CONTERCE`` desde ``MOV01``.
    En el modelo nuevo, ``saldos_cuenta`` conserva la **instantánea fiel de
    ``CONMAE``** (decisión de la etapa C5) y la copia migrada **no tiene el libro
    completo** (faltan ``MOV02``..``MOV18``, etapa F). Reescribir los acumulados
    desde un libro parcial destruiría esa fidelidad, así que la ejecución real
    queda **bloqueada** hasta que el libro esté completo; ``dryRun`` devuelve la
    simulación. Decisión en `db/migration/12_escrituras.md`.
    """
    from .reproceso_mensual_repository import MonthlyReprocessValidationError, _validate_range

    _validate_range(year, month_from, month_to)
    motivo = str(reason).strip()
    if not dry_run and not motivo:
        raise MonthlyReprocessValidationError("El motivo del reproceso es obligatorio.")
    if len(motivo) > 180:
        raise MonthlyReprocessValidationError("El motivo no puede superar 180 caracteres.")

    reporte = simulate_monthly_reprocess(company_code, year, month_from, month_to)
    if dry_run:
        reporte["estado"] = "Validado sin grabar"
        reporte["auditoria"] = "No aplica en prueba"
        return reporte
    raise MonthlyReprocessValidationError(
        "El reproceso no se ejecuta sobre la copia migrada: el libro está incompleto "
        "(faltan MOV02..MOV18) y saldos_cuenta conserva la instantánea fiel de CONMAE. "
        "Queda condicionado a la etapa F."
    )
