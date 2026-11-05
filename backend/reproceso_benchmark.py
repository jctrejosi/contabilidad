"""Prueba acotada de escritura en CONTERCE; solo en copia de pruebas sin usuarios.

No mide un reproceso completo ni demuestra uso del índice por el optimizador.
Modifica temporalmente débitos (+0.01), revierte y compara cada fila leída.
Nunca hace COMMIT. No debe usarse con escrituras concurrentes.
"""
from decimal import Decimal
from time import perf_counter
from uuid import uuid4

from ._win32com import win32com
from .ads_repository import (ads_odbc_connection, normalize_company_code,
    ADO_COMMAND_TEXT, ADO_TYPE_DOUBLE, ADO_TYPE_INTEGER)
from .reproceso_mensual_repository import _query_rows, _parameters, _sql_money_literal, _build_plan, _one
from .ads_repository import _execute


def _read_sample(connection, company, month, limit, ids=None, *, minimum_id=None, reverse=False):
    where = f"CIA = {company}"
    if ids is not None:
        where += " AND ID IN (" + ",".join(map(str, ids)) + ")"
    if minimum_id is not None:
        where += f" AND ID >= {int(minimum_id)}"
    rows = _query_rows(connection,
        f"SELECT TOP {limit} ID, MACMDEB{month:02d}, MACMCRE{month:02d} "
        f"FROM CONTERCE WHERE {where} ORDER BY ID {'DESC' if reverse else 'ASC'}", [])
    return {int(row["ID"]): (row.get(f"MACMDEB{month:02d}"), row.get(f"MACMCRE{month:02d}"))
            for row in rows}


def _case_write(connection, company, month, values, size, progress=None):
    for offset in range(0, len(values), size):
        block = values[offset:offset + size]
        label = {"desde": offset + 1, "hasta": offset + len(block), "total": len(values)}
        if progress:
            progress({"etapa": "inicio_bloque", **label})
        started = perf_counter()
        ids = ",".join(str(identity) for identity, _, _ in block)
        debit = " ".join(f"WHEN {identity} THEN {_sql_money_literal(d)}" for identity, d, _ in block)
        credit = " ".join(f"WHEN {identity} THEN {_sql_money_literal(c)}" for identity, _, c in block)
        sql = (f"UPDATE CONTERCE SET MACMDEB{month:02d} = CASE ID {debit} ELSE MACMDEB{month:02d} END, "
            f"MACMCRE{month:02d} = CASE ID {credit} ELSE MACMCRE{month:02d} END "
            f"WHERE CIA = {company} AND ID IN ({ids})")
        built = perf_counter()
        connection.Execute(sql)
        finished = perf_counter()
        if progress:
            progress({"etapa": "fin_bloque", **label, "segundos": round(finished - started, 4),
                      "construccionSQLSegundos": round(built - started, 4),
                      "llamadaADSSegundos": round(finished - built, 4), "caracteresSQL": len(sql)})


def _prepared_write(connection, company, month, values):
    command = win32com.client.Dispatch("ADODB.Command")
    command.ActiveConnection = connection
    command.CommandType = ADO_COMMAND_TEXT
    command.CommandTimeout = 30
    command.CommandText = (f"UPDATE CONTERCE SET MACMDEB{month:02d} = ?, MACMCRE{month:02d} = ? "
                           "WHERE CIA = ? AND ID = ?")
    _parameters(command, [(ADO_TYPE_DOUBLE, 0, 0.0), (ADO_TYPE_DOUBLE, 0, 0.0),
                          (ADO_TYPE_INTEGER, 0, company), (ADO_TYPE_INTEGER, 0, 0)])
    command.Prepared = True
    for identity, debit, credit in values:
        command.Parameters.Item(0).Value = float(debit)
        command.Parameters.Item(1).Value = float(credit)
        command.Parameters.Item(3).Value = identity
        command.Execute()


def benchmark(company_code, month, limit=250, *, confirmed=False, emit=print, extended=False, staging=False, realistic=False, plan_sample=False, reverse_load=False, cursor_test=False):
    if not confirmed:
        raise ValueError("Debe confirmar que es una copia de pruebas, sin usuarios y con respaldo.")
    company = normalize_company_code(company_code)
    if sum(map(bool, (extended, staging, realistic, plan_sample, reverse_load, cursor_test))) > 1:
        raise ValueError("Use solo un modo de prueba, incluido --cursor-test.")
    maximum = 10000 if cursor_test else (300000 if reverse_load else (30000 if realistic or plan_sample else (10000 if extended or staging else 1000)))
    if not 1 <= month <= 12 or not 1 <= limit <= maximum:
        raise ValueError(f"Mes permitido: 1-12; muestra: 1-{maximum}.")
    if extended and limit < 3000:
        raise ValueError("Prueba ampliada: muestra mínima 3000 por zona para medir bloques consecutivos.")
    if realistic and limit < 3000:
        raise ValueError("Prueba realista: muestra mínima 3000; recomendado 10000.")
    if reverse_load and (limit < 10000 or limit % 1000):
        raise ValueError("Carga inversa: muestra de 10000 a 300000, múltiplo de 1000; recomendado 100000.")
    with ads_odbc_connection() as connection:
        connection.CommandTimeout = 30
        indexes = _query_rows(connection,
            "SELECT Parent, Name, Index_Expression FROM system.indexes", [])
        metadata = [{"nombre": str(r["Name"]).strip(), "expresion": str(r["Index_Expression"]).strip()}
                    for r in indexes if str(r["Parent"]).strip().upper() == "CONTERCE"]
        emit({"etapa": "indices", "indices": metadata,
              "nota": "Inventario; no confirma uso por el optimizador."})
        if plan_sample or reverse_load or cursor_test:
            return _plan_comparison(connection, company, month, limit, metadata, emit,
                                    reverse_load=reverse_load, cursor_test=cursor_test)
        if realistic:
            return _realistic_comparison(connection, company, month, limit, metadata, emit)
        if staging:
            return _staging_comparison(connection, company, month, limit, metadata, emit)
        if extended:
            return _extended(connection, company, month, limit, metadata, emit)
        original = _read_sample(connection, company, month, limit)
        if not original:
            raise ValueError("No hay auxiliares para esa compañía.")
        # Muestra ordenada y reproducible; no representa necesariamente toda
        # la distribución de IDs ni los tiempos de la tabla completa.
        values = [(identity, Decimal(str(debit or 0)) + Decimal("0.01"), Decimal(str(credit or 0)))
                  for identity, (debit, credit) in original.items()]
        results = []
        for method in ("case_250", "preparado", "case_25", "case_100"):
            emit({"etapa": "inicio", "metodo": method, "filas": len(values)})
            started = perf_counter()
            connection.BeginTrans()
            try:
                if method == "preparado":
                    _prepared_write(connection, company, month, values)
                else:
                    _case_write(connection, company, month, values, int(method.split("_")[1]))
                write_seconds = perf_counter() - started
                actual = _read_sample(connection, company, month, limit, list(original))
                expected = {identity: (d, c) for identity, d, c in values}
                normalized = {identity: (Decimal(str(d or 0)), Decimal(str(c or 0)))
                              for identity, (d, c) in actual.items()}
                if normalized != expected:
                    raise ValueError("La muestra escrita no coincide; no se continuará.")
            finally:
                rollback_at = perf_counter()
                # Si falla rollback, propagar y detener; nunca probar otro método.
                connection.RollbackTrans()
                rollback_seconds = perf_counter() - rollback_at
            if _read_sample(connection, company, month, limit, list(original)) != original:
                raise ValueError("No se pudo verificar la restauración exacta; revisar servidor.")
            result = {"metodo": method, "filas": len(values), "escrituraSegundos": round(write_seconds, 3),
                      "rollbackSegundos": round(rollback_seconds, 3), "restauracionVerificada": True}
            results.append(result)
            emit(result)
        return {"compania": company, "mes": month, "indices": metadata, "resultados": results,
                "commit": False, "nota": "Muestra acotada; incluye calentamiento de caché y orden fijo. No extrapolar como garantía."}


def _read_ids(connection, company, month, identities):
    """Verificar por IDs exactos en listas acotadas, sin depender de TOP/zona."""
    result = {}
    for offset in range(0, len(identities), 500):
        chunk = identities[offset:offset + 500]
        result.update(_read_sample(connection, company, month, len(chunk), chunk))
    return result


def _extended(connection, company, month, limit, metadata, emit):
    bounds = _query_rows(connection,
        f"SELECT MIN(ID) AS FIRST_ID, MAX(ID) AS LAST_ID FROM CONTERCE WHERE CIA = {company}", [])
    if not bounds or bounds[0].get("FIRST_ID") is None:
        raise ValueError("No hay auxiliares para esa compañía.")
    midpoint = (int(bounds[0]["FIRST_ID"]) + int(bounds[0]["LAST_ID"])) // 2
    results = []
    # Rotación de orden para no favorecer siempre el mismo tamaño por caché.
    # Zona media es por rango numérico de ID, no percentil de cantidad de filas.
    zones = [("inicio", {}, (250, 500, 1000)),
             ("medio", {"minimum_id": midpoint}, (500, 1000, 250)),
             ("final", {"reverse": True}, (1000, 250, 500))]
    for zone, options, sizes in zones:
        original = _read_sample(connection, company, month, limit, **options)
        if not original:
            emit({"etapa": "zona_vacia", "zona": zone})
            continue
        identities = sorted(original)
        emit({"etapa": "zona", "zona": zone, "filas": len(original),
              "muestraReducida": len(original) < limit,
              "nota": "Las zonas pueden solaparse en compañías pequeñas; no son percentiles."})
        values = [(identity, Decimal(str(original[identity][0] or 0)) + Decimal("0.01"),
                   Decimal(str(original[identity][1] or 0))) for identity in identities]
        for size in sizes:
            emit({"etapa": "inicio", "zona": zone, "tamano": size, "filas": len(values)})
            blocks = []

            def progress(event):
                if event["etapa"] == "fin_bloque":
                    blocks.append(event)
                emit({"zona": zone, "tamano": size, **event})

            connection.BeginTrans()
            try:
                started = perf_counter()
                _case_write(connection, company, month, values, size, progress=progress)
                seconds = perf_counter() - started
                actual = _read_ids(connection, company, month, identities)
                normalized = {identity: (Decimal(str(d or 0)), Decimal(str(c or 0)))
                              for identity, (d, c) in actual.items()}
                if normalized != {identity: (d, c) for identity, d, c in values}:
                    raise ValueError("La muestra escrita no coincide; se revierte y detiene.")
            finally:
                emit({"etapa": "inicio_rollback", "zona": zone, "tamano": size})
                rollback_at = perf_counter()
                connection.RollbackTrans()
                rollback_seconds = perf_counter() - rollback_at
            if _read_ids(connection, company, month, identities) != original:
                raise ValueError("Restauración no verificada; revisar servidor antes de continuar.")
            result = {"zona": zone, "tamano": size, "filas": len(values),
                      "escrituraSegundos": round(seconds, 4), "bloques": blocks,
                      "rollbackSegundos": round(rollback_seconds, 4), "restauracionVerificada": True}
            results.append(result)
            emit({"etapa": "resultado", **result})
    return {"versionPrueba": 2, "compania": company, "mes": month, "indices": metadata,
            "resultados": results, "commit": False,
            "nota": "Orden rotado, no aleatorio. No mide una transacción de todo el mes ni demuestra uso de índice."}


def _staging_comparison(connection, company, month, limit, metadata, emit):
    """Alternativa experimental: DDL solo temporal fuera de transacción destino.

    No aplica al reproceso. Si falla sintaxis, carga o verificación, aborta sin
    fallback. Nunca ejecuta DDL mientras haya una transacción destino abierta.
    """
    original = _read_sample(connection, company, month, limit)
    if not original:
        raise ValueError("No hay auxiliares para esa compañía.")
    identities = sorted(original)
    values = [(identity, Decimal(str(original[identity][0] or 0)) + Decimal("0.01"),
               Decimal(str(original[identity][1] or 0))) for identity in identities]
    results = []
    for method in ("case_1000", "temporal_join"):
        emit({"etapa": "inicio", "metodo": method, "filas": len(values)})
        table = "#DSIRP" + uuid4().hex[:12]
        created = False
        in_transaction = False
        safe_cleanup = True
        load_seconds = 0.0
        try:
            if method == "temporal_join":
                started = perf_counter()
                emit({"etapa": "crear_temporal", "metodo": method})
                connection.Execute(f"CREATE TABLE {table} (RID INTEGER, DEBITO NUMERIC(20,2), CREDITO NUMERIC(20,2))")
                created = True
                # Un índice único protege la cardinalidad de la unión.
                emit({"etapa": "indexar_temporal", "metodo": method})
                connection.Execute(f"CREATE UNIQUE INDEX DSIRPID ON {table} (RID)")
                for position, (identity, debit, credit) in enumerate(values, 1):
                    _execute(connection, f"INSERT INTO {table} (RID, DEBITO, CREDITO) VALUES (?, ?, ?)",
                        [(ADO_TYPE_INTEGER, 0, identity), (ADO_TYPE_DOUBLE, 0, float(debit)),
                         (ADO_TYPE_DOUBLE, 0, float(credit))])
                    if position % 500 == 0 or position == len(values):
                        emit({"etapa": "carga_temporal", "filas": position, "total": len(values)})
                load_seconds = perf_counter() - started
                emit({"etapa": "temporal_cargada", "segundos": round(load_seconds, 4)})
            connection.BeginTrans()
            in_transaction = True
            try:
                started = perf_counter()
                if method == "case_1000":
                    _case_write(connection, company, month, values, 1000, progress=emit)
                else:
                    emit({"etapa": "actualizar_join", "metodo": method})
                    connection.Execute(
                        f"UPDATE CONTERCE SET MACMDEB{month:02d} = S.DEBITO, MACMCRE{month:02d} = S.CREDITO "
                        f"FROM CONTERCE INNER JOIN {table} S ON CONTERCE.ID = S.RID "
                        f"WHERE CONTERCE.CIA = {company}")
                write_seconds = perf_counter() - started
                actual = _read_ids(connection, company, month, identities)
                normalized = {identity: (Decimal(str(d or 0)), Decimal(str(c or 0)))
                              for identity, (d, c) in actual.items()}
                if normalized != {identity: (d, c) for identity, d, c in values}:
                    raise ValueError("Importes escritos distintos a los esperados; revertir y detener.")
            finally:
                emit({"etapa": "inicio_rollback", "metodo": method})
                started = perf_counter()
                try:
                    connection.RollbackTrans()
                except Exception:
                    safe_cleanup = False
                    raise
                in_transaction = False
                rollback_seconds = perf_counter() - started
            if _read_ids(connection, company, month, identities) != original:
                raise ValueError("Restauración no verificada; revisar servidor.")
            result = {"metodo": method, "filas": len(values),
                      "cargaSegundos": round(load_seconds, 4),
                      "escrituraSegundos": round(write_seconds, 4),
                      "cargaMasEscrituraSegundos": round(load_seconds + write_seconds, 4),
                      "rollbackSegundos": round(rollback_seconds, 4), "restauracionVerificada": True}
            results.append(result)
            emit({"etapa": "resultado", **result})
        except Exception as exc:
            emit({"etapa": "fallo", "metodo": method, "tipo": type(exc).__name__,
                  "nota": "Prueba detenida; no se activó otro escritor. Revise última etapa y restauración."})
            raise
        finally:
            # No DROP tras rollback fallido: evitar DDL con transacción incierta.
            if created and safe_cleanup and not in_transaction:
                connection.Execute(f"DROP TABLE {table}")
                emit({"etapa": "temporal_eliminada"})
    return {"versionPrueba": 3, "compania": company, "mes": month, "indices": metadata,
            "resultados": results, "commit": False,
            "nota": "Experimental. Carga por INSERT individual incluida. Sin cambios al reproceso real; muestra y caché limitan extrapolación."}


def _realistic_comparison(connection, company, month, limit, metadata, emit):
    """Carga transaccional acotada y dispersión; nunca confirma los cambios."""
    bounds = _query_rows(connection,
        f"SELECT MIN(ID) AS FIRST_ID, MAX(ID) AS LAST_ID FROM CONTERCE WHERE CIA = {company}", [])
    if not bounds or bounds[0].get("FIRST_ID") is None:
        raise ValueError("No hay auxiliares para esa compañía.")
    first, last = int(bounds[0]["FIRST_ID"]), int(bounds[0]["LAST_ID"])
    consecutive = _read_sample(connection, company, month, limit)
    scattered = {}
    # Diez ventanas en rango numérico de IDs. Deduplicar porque huecos pueden
    # hacer coincidir ventanas. No se afirma muestreo aleatorio ni percentiles.
    for zone in range(10):
        anchor = first + (last - first) * zone // 10
        scattered.update(_read_sample(connection, company, month, (limit + 9) // 10, minimum_id=anchor))
    results = []
    for zone, original in (("consecutivos", consecutive), ("dispersos", scattered)):
        if not original:
            continue
        identities = sorted(original)[:limit]
        original = {identity: original[identity] for identity in identities}
        # Variación determinista por fila, no un incremento uniforme: reproduce
        # variedad de CASE sin usar datos contables calculados ni persistirlos.
        values = [(identity, Decimal(str(original[identity][0] or 0)) + Decimal(identity % 97 + 1) / 100,
                   Decimal(str(original[identity][1] or 0)) - Decimal(identity % 89 + 1) / 100)
                  for identity in identities]
        emit({"etapa": "inicio", "zona": zone, "filas": len(values), "tamano": 1000,
              "muestraReducida": len(values) < limit, "transaccionUnicaPorZona": True})
        blocks = []
        started = perf_counter()

        def progress(event):
            if event["etapa"] == "fin_bloque":
                blocks.append(event)
            emit({"zona": zone, "acumuladoSegundos": round(perf_counter() - started, 4), **event})

        connection.BeginTrans()
        try:
            _case_write(connection, company, month, values, 1000, progress=progress)
            write_seconds = perf_counter() - started
            actual = _read_ids(connection, company, month, identities)
            normalized = {identity: (Decimal(str(d or 0)), Decimal(str(c or 0)))
                          for identity, (d, c) in actual.items()}
            if normalized != {identity: (d, c) for identity, d, c in values}:
                raise ValueError("La muestra escrita no coincide; revertir y detener.")
        finally:
            emit({"etapa": "inicio_rollback", "zona": zone})
            rollback_at = perf_counter()
            connection.RollbackTrans()
            rollback_seconds = perf_counter() - rollback_at
        if _read_ids(connection, company, month, identities) != original:
            raise ValueError("Restauración no verificada; revisar servidor.")
        result = {"zona": zone, "filas": len(values), "bloques": blocks,
                  "escrituraSegundos": round(write_seconds, 4),
                  "construccionSQLSegundos": round(sum(b["construccionSQLSegundos"] for b in blocks), 4),
                  "llamadaADSSegundos": round(sum(b["llamadaADSSegundos"] for b in blocks), 4),
                  "rollbackSegundos": round(rollback_seconds, 4), "restauracionVerificada": True}
        results.append(result)
        emit({"etapa": "resultado", **result})
    return {"versionPrueba": 4, "compania": company, "mes": month, "indices": metadata,
            "resultados": results, "commit": False,
            "nota": "Orden fijo: consecutivos y dispersos; caché/solapamiento posibles. Llamada ADS incluye COM/red/esperas, no solo motor. No reproduce un mes completo."}


def _plan_comparison(connection, company, month, limit, metadata, emit, *, reverse_load=False, cursor_test=False):
    """Mismos IDs e importes pendientes que el escritor diferencial, sin COMMIT.

    No limpia cuentas ni crea auxiliares. Su finalidad es aislar los UPDATE
    de filas existentes; no representa todo el trabajo previo de la transacción.
    """
    control = _one(connection, "SELECT TOP 1 CTANO FROM CONCTR", [])
    if not control:
        raise ValueError("No se pudo determinar el ejercicio activo.")
    year = int(control["CTANO"])
    emit({"etapa": "calcular_plan_real", "compania": company, "mes": month, "anio": year})
    started = perf_counter()
    plan = _build_plan(connection, company, year, month, month)
    if plan.errors:
        raise ValueError("El plan contiene errores contables; no se escribirá la muestra. Revise el período en la aplicación.")
    pending = plan.third_row_updates.get(month, [])
    selected = pending[:limit]
    if reverse_load and len(selected) >= 1000:
        # Mismo conjunto exacto de bloques en ambos sentidos, sin un último
        # bloque corto que desplazaría todas las fronteras al invertir filas.
        selected = selected[:len(selected) // 1000 * 1000]
    emit({"etapa": "plan_calculado", "segundos": round(perf_counter() - started, 4),
          "filasPendientes": len(pending), "muestra": len(selected),
          "auxiliaresNuevosNoProbados": len({(code, nit) for _, code, nit in plan.third_values}
                                           - set(plan.third_existing_ids))})
    if reverse_load and len(selected) < 10000:
        return {"versionPrueba": 6, "compania": company, "mes": month, "resultados": [],
                "commit": False, "nota": "Menos de 10000 diferencias pendientes; no se escribió. Elegir otro mes, sin borrar saldos."}
    if not selected:
        return {"versionPrueba": 7 if cursor_test else (6 if reverse_load else 5), "compania": company, "mes": month, "resultados": [],
                "commit": False, "nota": "No hay UPDATE pendientes. Use un mes con diferencias reales; no borre saldos para forzarlo."}
    identities = [identity for identity, _, _ in selected]
    if len(set(identities)) != len(identities):
        raise ValueError("El plan repite IDs en el mismo mes; revisar antes de escribir.")
    original = _read_ids(connection, company, month, identities)
    if set(original) != set(identities):
        raise ValueError("La muestra cambió durante la lectura; no se ejecutará.")
    results = []
    reverse_values = selected if cursor_test else (list(reversed(selected)) if reverse_load else sorted(selected, key=lambda value: value[0]))
    trials = (("case_1000" if cursor_test else "orden_actual", selected),
              ("cursor_ADO" if cursor_test else ("orden_inverso" if reverse_load else "orden_ID"), reverse_values))
    for method, values in trials:
        emit({"etapa": "inicio", "metodo": method, "filas": len(values),
              "ordenYaCoincide": identities == sorted(identities),
              "saltosDescendentes": sum(a[0] > b[0] for a, b in zip(values, values[1:]))})
        blocks = []
        started = perf_counter()

        def progress(event):
            if event["etapa"] == "fin_bloque":
                block_index = (event["desde"] - 1) // 1000
                # Identificador ordinal, no ID contable ni NIT. Mismo grupo
                # de filas conserva este número en el recorrido inverso.
                event = {**event, "grupoOriginal": ((len(values) + 999) // 1000 - block_index
                                                    if reverse_load and method == "orden_inverso" else block_index + 1)}
                blocks.append(event)
            emit({"metodo": method, "acumuladoSegundos": round(perf_counter() - started, 4), **event})

        connection.BeginTrans()
        try:
            if method == "cursor_ADO":
                _cursor_write(connection, company, month, values, progress=progress)
            else:
                _case_write(connection, company, month, values, 1000, progress=progress)
            seconds = perf_counter() - started
            actual = _read_ids(connection, company, month, identities)
            normalized = {identity: (Decimal(str(d or 0)), Decimal(str(c or 0)))
                          for identity, (d, c) in actual.items()}
            if normalized != {identity: (d, c) for identity, d, c in values}:
                raise ValueError("La escritura no coincide con el plan; revertir y detener.")
        finally:
            emit({"etapa": "inicio_rollback", "metodo": method})
            rollback_at = perf_counter()
            connection.RollbackTrans()
            rollback_seconds = perf_counter() - rollback_at
        if _read_ids(connection, company, month, identities) != original:
            raise ValueError("Restauración no verificada; no continuar sin revisar servidor.")
        result = {"metodo": method, "filas": len(values), "bloques": blocks,
                  "escrituraSegundos": round(seconds, 4),
                  "construccionSQLSegundos": round(sum(b["construccionSQLSegundos"] for b in blocks), 4),
                  "llamadaADSSegundos": round(sum(b["llamadaADSSegundos"] for b in blocks), 4),
                  "rollbackSegundos": round(rollback_seconds, 4), "restauracionVerificada": True}
        if blocks:
            result["promedioPrimeros5Segundos"] = round(sum(b["llamadaADSSegundos"] for b in blocks[:5]) / len(blocks[:5]), 4)
            result["promedioUltimos5Segundos"] = round(sum(b["llamadaADSSegundos"] for b in blocks[-5:]) / len(blocks[-5:]), 4)
        results.append(result)
        emit({"etapa": "resultado", **result})
    return {"versionPrueba": 7 if cursor_test else (6 if reverse_load else 5), "compania": company, "mes": month, "anio": year,
            "indices": metadata, "resultados": results, "commit": False,
            "nota": "Primeras diferencias del plan; mismos IDs/importes en ambos órdenes. Caché y orden fijo pueden influir; no prueba causalidad. Sin limpieza previa ni altas. Reversión verificada; no se confirma."}


def _cursor_write(connection, company, month, values, progress):
    """Cursor servidor/keyset/optimista sobre la MISMA conexión transaccional.

    Supports(adUpdate) se comprueba antes de modificar; no UpdateBatch, nuevas
    conexiones ni COMMIT. Apertura/lectura/cierre forman parte del tiempo total.
    El proveedor podría implementar Update como SQL por fila: medir, no asumir.
    """
    debit_field, credit_field = f"MACMDEB{month:02d}", f"MACMCRE{month:02d}"
    for offset in range(0, len(values), 1000):
        chunk = values[offset:offset + 1000]
        expected = {identity: (debit, credit) for identity, debit, credit in chunk}
        if len(expected) != len(chunk):
            raise ValueError("IDs repetidos en muestra; no se abrirá cursor.")
        label = {"desde": offset + 1, "hasta": offset + len(chunk), "total": len(values)}
        progress({"etapa": "inicio_bloque", **label})
        started = perf_counter()
        ids = ",".join(map(str, expected))
        recordset = win32com.client.Dispatch("ADODB.Recordset")
        recordset.CursorLocation = 2  # adUseServer
        opened = False
        try:
            recordset.Open(f"SELECT CIA, ID, {debit_field}, {credit_field} FROM CONTERCE "
                           f"WHERE CIA = {company} AND ID IN ({ids})", connection, 1, 3, ADO_COMMAND_TEXT)
            opened = True
            if not recordset.Supports(0x1008000):  # adUpdate, Microsoft ADO
                raise ValueError("El proveedor no admite Update en este cursor; no se continuará.")
            progress({"etapa": "cursor_abierto", **label,
                      "cursorType": int(recordset.CursorType), "lockType": int(recordset.LockType),
                      "cursorLocation": int(recordset.CursorLocation)})
            seen = set()
            while not recordset.EOF:
                identity = int(recordset.Fields.Item("ID").Value)
                if identity not in expected or identity in seen:
                    raise ValueError("Cursor devolvió IDs inesperados/repetidos; se revertirá.")
                debit, credit = expected[identity]
                # Una sola llamada Update con nombres/valores, sin asignación
                # por celda ni MoveNext con una edición pendiente.
                recordset.Update((debit_field, credit_field), (float(debit), float(credit)))
                seen.add(identity)
                if len(seen) % 100 == 0:
                    progress({"etapa": "avance_cursor", **label, "filasEnBloque": len(seen)})
                recordset.MoveNext()
            if seen != set(expected):
                raise ValueError("Faltan IDs en cursor; se revertirá la transacción.")
        except Exception:
            if opened:
                # Cancelar una edición incompleta antes de Close; no avanzar
                # porque ADO puede guardar implícitamente al mover el cursor.
                try:
                    recordset.CancelUpdate()
                except Exception:
                    pass  # Rollback global sigue siendo obligatorio en llamador.
            raise
        finally:
            if opened:
                recordset.Close()
        seconds = perf_counter() - started
        progress({"etapa": "fin_bloque", **label, "segundos": round(seconds, 4),
                  "construccionSQLSegundos": 0.0, "llamadaADSSegundos": round(seconds, 4),
                  "nota": "Incluye abrir, recorrer, Update por fila y cerrar cursor."})
