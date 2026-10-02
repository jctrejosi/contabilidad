"""La reorganización conserva exactamente los índices registrados en ADS."""

from __future__ import annotations

import pytest

from backend import reorganizacion_ads_repository as repo


def test_inventory_includes_only_registered_accounting_tables(monkeypatch):
    def rows(_connection, sql):
        if "system.tables" in sql:
            return [{"Name": "MOV01 "}, {"Name": "CONCTR "}, {"Name": "OTHER "}]
        return [{
            "Parent": "MOV01 ", "Name": "MOV01L ",
            "Index_File_Name": "mov01.adi ",
            "Index_Expression": "CONCIA;CONANO;CONMES;CODIGO;NIT ",
            "Index_Condition": "", "Index_Options": 2, "Index_Key_Length": 42,
        }]

    monkeypatch.setattr(repo, "_select_rows", rows)
    plan = repo._inventory(object())
    assert [item["tabla"] for item in plan["tablas"]] == ["CONCTR", "MOV01"]
    assert plan["tablas"][0]["indices"] == []
    assert plan["tablas"][1]["indices"][0]["nombre"] == "MOV01L"
    assert plan["totalIndices"] == 1
    assert "OTHER" not in plan["ausentes"]


def test_inventory_fingerprint_changes_if_existing_index_definition_changes(monkeypatch):
    expression = ["CODIGO"]

    def rows(_connection, sql):
        if "system.tables" in sql:
            return [{"Name": "CONMAE"}]
        return [{
            "Parent": "CONMAE", "Name": "CONMAE6", "Index_File_Name": "CONMAE.adi",
            "Index_Expression": expression[0], "Index_Condition": "", "Index_Options": 2,
            "Index_Key_Length": 12,
        }]

    monkeypatch.setattr(repo, "_select_rows", rows)
    original = repo._inventory(object())["huella"]
    expression[0] = "CIA;CODIGO"
    assert repo._inventory(object())["huella"] != original


def test_start_rejects_without_verified_backup_or_confirmation():
    with pytest.raises(repo.ReorganizationValidationError):
        repo.start_reorganization(huella="x" * 64, respaldo=False, confirmacion="REORGANIZAR")
    with pytest.raises(repo.ReorganizationValidationError):
        repo.start_reorganization(huella="x" * 64, respaldo=True, confirmacion="SI")


def test_preflight_identifies_unopenable_table_without_reindexing(monkeypatch):
    class Recordset:
        def Close(self):
            pass

    def open_recordset(_connection, sql):
        if sql.endswith("CONMAE"):
            raise RuntimeError("NativeError = 7041")
        return Recordset()

    monkeypatch.setattr(repo, "_open_recordset", open_recordset)
    failures = repo._check_tables_openable(object(), {
        "tablas": [
            {"tabla": "CONCTR", "indices": []},
            {"tabla": "CONDOCUM", "indices": [{}]},
            {"tabla": "CONMAE", "indices": [{}]},
        ],
    })
    assert failures == [{
        "tabla": "CONMAE",
        "motivo": "Advantage no encuentra un archivo de la tabla o de sus índices.",
    }]


def test_rebuild_missing_index_restores_original_auto_create_setting(monkeypatch, tmp_path):
    class Connection:
        pass

    connection = Connection()
    missing = tmp_path / "CONMAE.adi"
    changes = []

    class Context:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return Connection()

        def __exit__(self, *_args):
            pass

    class Recordset:
        def Close(self):
            missing.write_bytes(b"rebuilt")

    monkeypatch.setattr(repo, "_missing_index_files", lambda _connection, _table: [missing])
    monkeypatch.setattr(repo, "_auto_create_enabled", lambda _connection, _table: False)
    monkeypatch.setattr(repo, "_modify_auto_create", lambda _connection, _table, enabled: changes.append(enabled))
    monkeypatch.setattr(repo, "ads_odbc_connection", Context)
    monkeypatch.setattr(repo, "_open_recordset", lambda _connection, _sql: Recordset())
    assert repo._rebuild_missing_index_file(connection, "CONMAE") is True
    assert changes == [True, False]
    assert missing.is_file()


def test_rebuild_restores_setting_even_when_advantage_cannot_create_index(monkeypatch, tmp_path):
    missing = tmp_path / "CONMAE.adi"
    changes = []

    class Connection:
        pass

    class Context:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return Connection()

        def __exit__(self, *_args):
            pass

    monkeypatch.setattr(repo, "_missing_index_files", lambda _connection, _table: [missing])
    monkeypatch.setattr(repo, "_auto_create_enabled", lambda _connection, _table: False)
    monkeypatch.setattr(repo, "_modify_auto_create", lambda _connection, _table, enabled: changes.append(enabled))
    monkeypatch.setattr(repo, "ads_odbc_connection", Context)
    monkeypatch.setattr(repo, "_open_recordset", lambda _connection, _sql: (_ for _ in ()).throw(RuntimeError("ADS")))
    with pytest.raises(RuntimeError, match="ADS"):
        repo._rebuild_missing_index_file(object(), "CONMAE")
    assert changes == [True, False]


def test_run_calls_only_sp_reindex_for_existing_indexed_tables(monkeypatch):
    class Connection:
        statements: list[str] = []

        def Execute(self, sql):
            self.statements.append(sql)

    class Context:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return connection

        def __exit__(self, *_args):
            return None

    connection = Connection()
    plan = {
        "huella": "original",
        "tablas": [
            {"tabla": "CONCTR", "indices": []},
            {"tabla": "MOV01", "indices": [{"nombre": "MOV01L"}]},
        ],
    }
    monkeypatch.setattr(repo, "ads_odbc_connection", Context)
    monkeypatch.setattr(repo, "_inventory", lambda _connection: plan)
    monkeypatch.setattr(repo, "_check_tables_openable", lambda _connection, _plan: [])
    repo._job = {"estado": "Ejecutando", "resultados": []}
    try:
        repo._run(plan)
        assert connection.statements == ["EXECUTE PROCEDURE sp_Reindex('MOV01', 0)"]
        assert repo.get_status()["estado"] == "Completada"
        assert [item["estado"] for item in repo.get_status()["resultados"]] == ["Sin índices", "Completada"]
    finally:
        repo._job = None


def test_run_does_not_reindex_an_index_just_recreated(monkeypatch, tmp_path):
    class Connection:
        def Execute(self, _sql):
            raise AssertionError("El archivo recién creado no debe reindexarse otra vez")

    class Context:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return Connection()

        def __exit__(self, *_args):
            pass

    plan = {
        "huella": "actual",
        "tablas": [{"tabla": "CONMAE", "indices": [{"nombre": "CONMAE1"}]}],
    }
    monkeypatch.setattr(repo, "ads_odbc_connection", Context)
    monkeypatch.setattr(repo, "_inventory", lambda _connection: plan)
    monkeypatch.setattr(repo, "_check_tables_openable", lambda _connection, _plan: [{"tabla": "CONMAE"}])
    monkeypatch.setattr(repo, "_missing_index_files", lambda _connection, _table: [tmp_path / "CONMAE.adi"])
    monkeypatch.setattr(repo, "_rebuild_missing_index_file", lambda _connection, _table: True)
    repo._job = {"estado": "Ejecutando", "resultados": []}
    try:
        repo._run(plan)
        result = repo.get_status()
        assert result["estado"] == "Completada"
        assert result["resultados"][0]["reconstruido"] is True
    finally:
        repo._job = None


def test_index_creation_plan_checks_columns_and_duplicate_names(monkeypatch):
    indexes = []

    def rows(_connection, sql):
        if "system.tables" in sql:
            return [{"Name": "MOV01"}]
        if "system.columns" in sql:
            return [{"Parent": "MOV01", "Name": "CONCIA"},
                    {"Parent": "MOV01", "Name": "CONANO"}]
        if "system.indexes" in sql:
            return indexes
        raise AssertionError(sql)

    monkeypatch.setattr(repo, "_select_rows", rows)
    plan = repo._creation_plan(object(), "mov01", "MOV01X", ["concia", "conano"])
    assert plan["estado"] == "pendiente"
    assert plan["campos"] == ["CONCIA", "CONANO"]

    indexes.append({"Parent": "MOV01", "Name": "MOV01X", "Index_Expression": "CONCIA;CONANO"})
    assert repo._creation_plan(object(), "MOV01", "MOV01X", ["CONCIA", "CONANO"])["estado"] == "existente"
    assert repo._creation_plan(object(), "MOV01", "MOV01X", ["CONANO"])["estado"] == "conflicto"

    with pytest.raises(repo.ReorganizationValidationError, match="Campos inexistentes"):
        repo._creation_plan(object(), "MOV01", "MOV01Y", ["FALSO"])
    with pytest.raises(repo.ReorganizationValidationError):
        repo._creation_plan(object(), "MOV01; DROP TABLE MOV01", "X", ["CONCIA"])
    with pytest.raises(repo.ReorganizationValidationError):
        repo._creation_plan(object(), "MOV01", "MOV01Y", ["CONCIA", "CONCIA"])


def test_index_creation_executes_validated_sql_and_checks_persistence(monkeypatch):
    class Connection:
        CommandTimeout = 30

        def __init__(self):
            self.statements = []

        def Execute(self, sql):
            self.statements.append(sql)
            return None

    connection = Connection()

    class Context:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return connection

        def __exit__(self, *_args):
            pass

    plan = {"tabla": "MOV01", "nombre": "MOV01X", "campos": ["CONCIA", "CONANO"],
            "huella": "a" * 64, "estado": "pendiente"}
    monkeypatch.setattr(repo, "ads_odbc_connection", Context)
    monkeypatch.setattr(repo, "_creation_plan", lambda *_args: plan)
    monkeypatch.setattr(repo, "_check_tables_openable", lambda *_args: [])
    monkeypatch.setattr(repo, "get_index_creation_plan", lambda **_kwargs: {"estado": "existente"})
    repo._job = {"tipo": "crearIndice", "estado": "Ejecutando"}
    try:
        repo._run_index_creation(plan)
        assert connection.statements == ["CREATE INDEX MOV01X ON MOV01 (CONCIA, CONANO)"]
        assert repo.get_status()["estado"] == "Completada"
    finally:
        repo._job = None
