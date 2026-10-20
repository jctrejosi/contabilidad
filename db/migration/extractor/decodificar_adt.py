"""Decodificador de `ADD_CONTAB/` **sin el motor de Advantage**.

Lee las tablas del legado y las decodifica a valores de Python usando el catálogo
real de la copia, que sale de `PUBLIDATA.add` con
[`leer_diccionario.py`](leer_diccionario.py) (no del inventario de `old_db/`, que
no coincide con esta copia — ver §P-7 del plan).

Formato (verificado en las 20 tablas)
------------------------------------

| Offset del `.adt` | Campo |
|---|---|
| `0x00` | firma `Advantage Table\\0` |
| `0x18` | ranuras de registro |
| `0x20` | inicio del área de registros |
| `0x24` | largo físico del registro |

    tamaño_del_archivo == inicio + ranuras * largo
    largo            == 5 + suma(anchos declarados en el diccionario)

Los registros son de largo fijo y van uno tras otro desde `inicio`: 5 bytes fijos y
luego los campos **en el orden del catálogo** (que ya viene en orden físico). Los
campos de texto van rellenos con espacios; los numéricos, *little-endian*.

Uso:
    python db/migration/extractor/decodificar_adt.py                        # inventario
    python db/migration/extractor/decodificar_adt.py --tabla CONMAE --filas 3
"""

from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
ADD_CONTAB = HERE.parents[1] / "ADD_CONTAB"
CATALOGO = HERE / "catalogo_publidata.json"

ADT_SIGNATURE = b"Advantage Table"
PREFIJO_DATOS = 5


class Tabla:
    """Cabecera interpretada de un `.adt` más el catálogo de sus campos."""

    def __init__(self, ruta: Path, campos: list[dict] | None) -> None:
        self.ruta = ruta
        self.campos = campos or []
        self.bytes = ruta.stat().st_size
        with ruta.open("rb") as handle:
            cabecera = handle.read(0x28)
        self.firma_ok = cabecera.startswith(ADT_SIGNATURE)
        self.ranuras = struct.unpack_from("<I", cabecera, 0x18)[0]
        self.inicio = struct.unpack_from("<I", cabecera, 0x20)[0]
        self.largo = struct.unpack_from("<I", cabecera, 0x24)[0]
        self.suma_campos = sum(int(c["longitud"]) for c in self.campos)

    @property
    def nombre(self) -> str:
        return self.ruta.stem.upper()

    @property
    def cuadra(self) -> bool:
        return self.inicio + self.ranuras * self.largo == self.bytes

    @property
    def catalogo_cuadra(self) -> bool:
        return self.largo == PREFIJO_DATOS + self.suma_campos

    def fila(self, indice: int) -> dict[str, object]:
        with self.ruta.open("rb") as handle:
            handle.seek(self.inicio + indice * self.largo)
            registro = handle.read(self.largo)
        return self._decodificar(registro)

    def _decodificar(self, registro: bytes) -> dict[str, object]:
        crudo = registro[PREFIJO_DATOS:]
        posicion = 0
        valores: dict[str, object] = {}
        for campo in self.campos:
            largo, decimales = int(campo["longitud"]), int(campo["decimales"])
            valores[campo["campo"]] = decodificar(
                str(campo["tipo"]), largo, decimales, crudo[posicion : posicion + largo]
            )
            posicion += largo
        return valores

    def filas(self, desde: int = 0, hasta: int | None = None, bloque: int = 20_000):
        """Genera `(indice, valores)` leyendo por bloques.

        Leer por bloques importa: `MOV01` pesa 1,2 GB y no cabe entero en memoria.
        """
        limite = self.ranuras if hasta is None else min(hasta, self.ranuras)
        with self.ruta.open("rb") as handle:
            indice = desde
            while indice < limite:
                cuantos = min(bloque, limite - indice)
                handle.seek(self.inicio + indice * self.largo)
                datos = handle.read(cuantos * self.largo)
                for desplazamiento in range(cuantos):
                    inicio = desplazamiento * self.largo
                    yield indice + desplazamiento, self._decodificar(datos[inicio : inicio + self.largo])
                indice += cuantos


def decodificar(tipo: str, largo: int, decimales: int, crudo: bytes):
    """Un campo físico → valor de Python, con el tipo declarado en el diccionario."""
    if tipo == "LOGICAL":
        return crudo[:1] not in (b"\x00", b"F", b"f", b" ")
    if tipo == "DOUBLE" and largo == 8:
        return round(struct.unpack("<d", crudo[:8])[0], decimales)
    if tipo == "INTEGER" and largo == 4:
        return struct.unpack("<i", crudo[:4])[0]
    if tipo == "SHORTINT" and largo == 2:
        return struct.unpack("<h", crudo[:2])[0]
    if tipo.startswith("?"):
        # Tipos sin identificar en el diccionario. El único caso real es el
        # autoincremental `ID` (código 15): un entero sin signo de 4 bytes, y es el
        # mejor localizador de la fila en la instantánea.
        if largo == 4:
            return struct.unpack("<I", crudo[:4])[0]
        return crudo.hex(" ")
    return crudo.decode("latin1").rstrip()


def catalogo() -> dict[str, list[dict]]:
    if not CATALOGO.is_file():
        raise SystemExit(
            f"Falta {CATALOGO.name}. Genéralo con:\n"
            "  python db/migration/extractor/leer_diccionario.py --json "
            "db/migration/extractor/catalogo_publidata.json"
        )
    contenido = json.loads(CATALOGO.read_text(encoding="utf-8"))
    return {tabla["tabla"]: tabla["campos"] for tabla in contenido["tablas"]}


def tablas(carpeta: Path) -> list[Tabla]:
    campos = catalogo()
    return [
        Tabla(ruta, campos.get(ruta.stem.upper()))
        for ruta in sorted(carpeta.iterdir(), key=lambda r: r.stem.upper())
        if ruta.suffix.lower() == ".adt"
    ]


def inventario(carpeta: Path) -> int:
    listado = tablas(carpeta)
    print(f"{'tabla':<11}{'ranuras':>10}{'inicio':>8}{'largo':>7}{'campos':>7}{'suma':>7}  estado")
    print("-" * 68)
    problemas: list[str] = []
    for tabla in listado:
        if tabla.ranuras == 0:
            estado = "vacía"
        elif tabla.cuadra and tabla.catalogo_cuadra:
            estado = "ok"
        else:
            estado = "revisar"
            problemas.append(tabla.nombre)
        print(
            f"{tabla.nombre:<11}{tabla.ranuras:>10}{tabla.inicio:>8}{tabla.largo:>7}"
            f"{len(tabla.campos):>7}{tabla.suma_campos:>7}  {estado}"
        )
    print()
    if problemas:
        print(f"Tablas que no cuadran: {', '.join(problemas)}")
        return 1
    print("Todas cuadran con el catálogo real: tamaño y largo de registro verificados.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--carpeta", type=Path, default=ADD_CONTAB)
    parser.add_argument("--tabla", help="decodifica las primeras filas de esta tabla")
    parser.add_argument("--filas", type=int, default=3)
    argumentos = parser.parse_args(argv)
    if not argumentos.carpeta.is_dir():
        raise SystemExit(f"No existe la carpeta {argumentos.carpeta}.")

    if not argumentos.tabla:
        return inventario(argumentos.carpeta)

    objetivo = next((t for t in tablas(argumentos.carpeta) if t.nombre == argumentos.tabla.upper()), None)
    if objetivo is None:
        raise SystemExit(f"No existe la tabla {argumentos.tabla} en {argumentos.carpeta}.")
    print(f"{objetivo.nombre}: {min(argumentos.filas, objetivo.ranuras)} de {objetivo.ranuras} filas "
          f"· {len(objetivo.campos)} campos")
    for indice in range(min(argumentos.filas, objetivo.ranuras)):
        valores = " ".join(f"{campo}={valor!r}" for campo, valor in objetivo.fila(indice).items())
        print(f"  [{indice}] {valores}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
