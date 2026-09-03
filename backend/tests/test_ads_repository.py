from pathlib import Path

import pytest

from backend.ads_repository import (
    AdsConfigurationError,
    _rows,
    load_connection_string,
    normalize_account,
    normalize_company_code,
    parent_code,
)


class _Field:
    def __init__(self, name: str) -> None:
        self.Name = name


class _Fields:
    def __init__(self, names: list[str]) -> None:
        self._names = names
        self.Count = len(names)

    def Item(self, index: int) -> _Field:
        return _Field(self._names[index])


class _BulkRecordset:
    """Doble mínimo de ADODB para verificar la orientación de GetRows."""

    def __init__(self, names: list[str], columns: tuple[tuple[object, ...], ...]) -> None:
        self.Fields = _Fields(names)
        self.EOF = not columns or not columns[0]
        self._columns = columns
        self.bulk_reads = 0

    def GetRows(self) -> tuple[tuple[object, ...], ...]:
        self.bulk_reads += 1
        return self._columns


def test_builds_connection_from_project_environment(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "ADS_DATA_SOURCE=C:\\\\data\\\\test.add\n"
        "ADS_USER_ID=developer\n"
        "ADS_PASSWORD=secret\n",
        encoding="utf-8",
    )

    result = load_connection_string(env_file, environ={})

    assert result == (
        "Provider=Advantage.OLEDB.1;"
        "Data Source=C:\\\\data\\\\test.add;"
        "User ID=developer;Password=secret;ServerType=ADS_REMOTE_SERVER;"
    )


def test_environment_overrides_local_file(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "ADS_DATA_SOURCE=C:\\\\old\\\\database.add\nADS_USER_ID=old\nADS_PASSWORD=old\n",
        encoding="utf-8",
    )

    result = load_connection_string(
        env_file,
        environ={
            "ADS_DATA_SOURCE": r"C:\new\database.add",
            "ADS_USER_ID": "new-user",
            "ADS_PASSWORD": "new-password",
        },
    )

    assert "Data Source=C:\\new\\database.add;" in result
    assert "User ID=new-user;" in result


def test_requires_connection_values(tmp_path: Path) -> None:
    with pytest.raises(AdsConfigurationError, match="ADS_DATA_SOURCE"):
        load_connection_string(tmp_path / "missing.env", environ={})


def test_reads_recordset_in_one_bulk_operation() -> None:
    recordset = _BulkRecordset(
        ["CODIGO", "MNOMBRE"],
        (("1", "11", "1105"), ("ACTIVO", "EFECTIVO", "CAJA")),
    )

    result = list(_rows(recordset))

    assert result == [
        {"CODIGO": "1", "MNOMBRE": "ACTIVO"},
        {"CODIGO": "11", "MNOMBRE": "EFECTIVO"},
        {"CODIGO": "1105", "MNOMBRE": "CAJA"},
    ]
    assert recordset.bulk_reads == 1


@pytest.mark.parametrize(("visible_code", "database_code"), [("1", 1), ("027", 27), ("999", 999)])
def test_normalizes_company_code(visible_code: str, database_code: int) -> None:
    """El código mostrado con ceros debe comparar contra CONMAE.CIA numérico."""
    assert normalize_company_code(visible_code) == database_code


@pytest.mark.parametrize("code", ["", "0", "000", "1000", "A27", "27.0", "-1"])
def test_rejects_invalid_company_code(code: str) -> None:
    with pytest.raises(ValueError):
        normalize_company_code(code)


def test_normalizes_valid_account() -> None:
    result = normalize_account(
        {
            "codigo": "110505",
            "nombre": " Caja general ",
            "afectable": True,
            "tipoFiscal": "o",
        },
        include_code=True,
    )

    assert result["codigo"] == "110505"
    assert result["nombre"] == "Caja general"
    assert result["tipoFiscal"] == "O"


@pytest.mark.parametrize(
    ("code", "expected"),
    [("1", None), ("11", "1"), ("1105", "11"), ("110505", "1105"), ("110505001", "110505"), ("110505001001", "110505001")],
)
def test_finds_parent_account(code: str, expected: str | None) -> None:
    assert parent_code(code) == expected


@pytest.mark.parametrize("code", ["", "123", "12345", "12A4", "1234567890123"])
def test_rejects_invalid_account_level(code: str) -> None:
    with pytest.raises(ValueError):
        normalize_account({"codigo": code, "nombre": "Cuenta"}, include_code=True)
