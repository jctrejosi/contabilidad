"""Lector de `PUBLIDATA.add`: el diccionario real de la copia.

Por qué existe
--------------

`decodificar_adt.py` demostró que los `.adt` se leen, pero también que el
catálogo de `old_db/DICCIONARIO_DEPURADO_CONTABDSI.md` **no coincide con esta
copia** en 9 tablas (P-7). Decodificar con un catálogo equivocado desplaza todos
los valores de la fila, así que antes de cargar hay que sacar la verdad del
diccionario que sí está aquí: `PUBLIDATA.add`.

Formato del diccionario
-----------------------

Es una secuencia de registros de longitud variable. Cada uno:

| Offset relativo | Bytes | Contenido |
|---|---|---|
| `0` | 4 | `04 00 00 00` |
| `4` | 1 | `00` |
| `5` | 4 | **id** del objeto |
| `9` | 4 | **id del padre** (`1` en las tablas; el id de la tabla en los campos) |
| `13` | 10 | etiqueta: `Table     ` o `Field     ` |
| `23` | 200 | nombre, relleno con espacios |
| `223` | 10 | `ff` × 10 |
| `233` | 2 | `06 00` |
| `235` | 2 | **tipo** |
| `237` | 2 | **longitud** |
| `239` | 2 | **decimales** |
| `241` | 2 | `04 00` |

Códigos de tipo observados: `1` lógico, `2` y `4` carácter, `10` double,
`11` entero, `15` autoincremental. El autoincremental (`ID`) **sí ocupa 4 bytes**
al final del registro.

El orden de los campos
---------------------

El diccionario **no** guarda los campos en orden físico: los `id` se asignan de
forma que el **orden físico es `id` descendente**. Comprobado con `CONEMP`, donde
`ID` (id 76135) es justo el bloque de 4 bytes final, y con `CONCECOS`,
`CONDOCUM`, `CONTICOM`, `CONEMP` y `COCENTRO`, cuyas lecturas coinciden campo a
campo con el catálogo ya acreditado.

El invariante de cierre, que ahora cuadra en las 15 tablas:

    N3 == 5 + suma(todos los campos declarados, incluido el autoincremental)

Y el código de contabilidad no es un añadido opaco: es el campo **`CIA`**
(`CHARACTER(3)`) que el diccionario declara en las tablas que lo llevan.

Uso:
    python db/migration/extractor/leer_diccionario.py
    python db/migration/extractor/leer_diccionario.py --tabla CONMAE
    python db/migration/extractor/leer_diccionario.py --validar
"""

from __future__ import annotations

import argparse
import json
import struct
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
ADD_CONTAB = HERE.parents[1] / "ADD_CONTAB"
DICCIONARIO = "PUBLIDATA.add"

MAGIC = b"\x04\x00\x00\x00\x00"
ETIQUETA_TABLA = b"Table     "
ETIQUETA_CAMPO = b"Field     "
LARGO_NOMBRE = 200
DESPLAZAMIENTO_ATRIBUTOS = 223
PREFIJO_REGISTRO = 13           # magic(5) + id(4) + padre(4)
PREFIJO_DATOS = 5               # bytes fijos al inicio de cada registro de datos
TIPOS = {1: "LOGICAL", 2: "CHARACTER", 4: "CHARACTER", 10: "DOUBLE", 11: "INTEGER"}

# Traducción de los códigos del diccionario a los nombres del inventario.
TIPO_A_NOMBRE = {
    1: "LOGICAL",
    2: "CHARACTER",
    3: "DATE",
    4: "CHARACTER",
    5: "MEMO",
    6: "DOUBLE",
    10: "DOUBLE",
    11: "INTEGER",
    12: "SHORTINT",
}


@dataclass(frozen=True)
class Objeto:
    offset: int
    tipo_registro: str          # 'Table' | 'Field'
    id: int
    padre: int
    nombre: str
    tipo: str = ""
    largo: int = 0
    decimales: int = 0

    @property
    def firma_datos(self) -> int:
        """Bytes que este campo ocupa en el registro de datos."""
        return self.largo


def leer(ruta: Path) -> list[Objeto]:
    """Todos los objetos del diccionario, en el orden en que aparecen."""
    contenido = ruta.read_bytes()
    objetos: list[Objeto] = []

    for etiqueta, tipo_registro in ((ETIQUETA_TABLA, "Table"), (ETIQUETA_CAMPO, "Field")):
        posicion = contenido.find(etiqueta)
        while posicion != -1:
            inicio = posicion - PREFIJO_REGISTRO
            if contenido[inicio : inicio + 5] == MAGIC:
                identificador, padre = struct.unpack_from("<II", contenido, inicio + 5)
                nombre_crudo = contenido[posicion + 10 : posicion + 10 + LARGO_NOMBRE]
                nombre = nombre_crudo.decode("latin1").rstrip()
                atributos = inicio + DESPLAZAMIENTO_ATRIBUTOS
                # `ff`×10, `06 00`, y luego tipo, longitud y decimales.
                codigo, largo, decimales = struct.unpack_from("<HHH", contenido, atributos + 12)
                objetos.append(
                    Objeto(
                        offset=inicio,
                        tipo_registro=tipo_registro,
                        id=identificador,
                        padre=padre,
                        nombre=nombre,
                        tipo=TIPO_A_NOMBRE.get(codigo, f"?{codigo}"),
                        largo=largo,
                        decimales=decimales,
                    )
                )
            posicion = contenido.find(etiqueta, posicion + len(etiqueta))

    objetos.sort(key=lambda objeto: objeto.offset)
    return objetos


def tablas(objetos: list[Objeto]) -> dict[str, Objeto]:
    return {objeto.nombre.upper(): objeto for objeto in objetos if objeto.tipo_registro == "Table"}


def campos_por_tabla(objetos: list[Objeto]) -> dict[str, list[Objeto]]:
    """Campos agrupados por tabla padre, **en orden físico**.

    El orden físico del registro es el de `id` descendente: el diccionario asigna
    los `id` al revés de como quedan los campos en el registro. Verificado contra
    las tablas cuyo catálogo ya estaba acreditado.
    """
    nombre_por_id = {objeto.id: objeto.nombre.upper() for objeto in objetos if objeto.tipo_registro == "Table"}
    agrupados: dict[str, list[Objeto]] = {}
    for objeto in objetos:
        if objeto.tipo_registro != "Field":
            continue
        tabla = nombre_por_id.get(objeto.padre)
        if tabla is None:
            continue
        agrupados.setdefault(tabla, []).append(objeto)
    for listado in agrupados.values():
        listado.sort(key=lambda campo: -campo.id)
    return agrupados


# ---------------------------------------------------------------------------
# Validación contra los `.adt`: es lo que da confianza al catálogo leído.
# ---------------------------------------------------------------------------
def medir_adt(ruta: Path) -> tuple[int, int, int]:
    """(ranuras, inicio de datos, largo de registro) de un `.adt`."""
    with ruta.open("rb") as handle:
        cabecera = handle.read(0x28)
    return (
        struct.unpack_from("<I", cabecera, 0x18)[0],
        struct.unpack_from("<I", cabecera, 0x20)[0],
        struct.unpack_from("<I", cabecera, 0x24)[0],
    )


def exportar(objetos: list[Objeto], destino: Path) -> None:
    """Escribe el catálogo real de la copia, en el orden físico del registro."""
    campos = campos_por_tabla(objetos)
    contenido = {
        "fuente": DICCIONARIO,
        "nota": "Campos en el orden físico del registro (id descendente). El último es el autoincremental.",
        "tablas": [
            {
                "tabla": nombre,
                "campos": [
                    {
                        "orden": indice,
                        "campo": campo.nombre,
                        "tipo": campo.tipo,
                        "longitud": campo.largo,
                        "decimales": campo.decimales,
                    }
                    for indice, campo in enumerate(campos[nombre], 1)
                ],
                "suma_bytes": sum(campo.largo for campo in campos[nombre]),
            }
            for nombre in sorted(campos)
        ],
    }
    destino.write_text(json.dumps(contenido, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Catálogo real escrito en {destino}")


def validar(objetos: list[Objeto], carpeta: Path) -> int:
    campos = campos_por_tabla(objetos)
    print(f"{'tabla':<11}{'campos':>7}{'suma':>7}{'N3 real':>9}{'delta':>7}  veredicto")
    print("-" * 62)
    fallos: list[str] = []
    for ruta in sorted(carpeta.iterdir(), key=lambda r: r.stem.upper()):
        if ruta.suffix.lower() != ".adt":
            continue
        nombre = ruta.stem.upper()
        listado = campos.get(nombre)
        if not listado:
            continue
        ranuras, _, largo = medir_adt(ruta)
        suma = sum(campo.largo for campo in listado)
        if ranuras == 0:
            print(f"{nombre:<11}{len(listado):>7}{suma:>7}{largo:>9}{'—':>7}  vacía (N3 no aplica)")
            continue
        esperado = PREFIJO_DATOS + suma
        delta = largo - esperado
        if delta == 0:
            veredicto = "coincide"
        else:
            veredicto = f"NO coincide ({delta:+d})"
            fallos.append(nombre)
        print(f"{nombre:<11}{len(listado):>7}{suma:>7}{largo:>9}{delta:>+7}  {veredicto}")
    print()
    if fallos:
        print(f"Tablas que no cuadran: {', '.join(fallos)}")
        return 1
    print("Todas cuadran: el catálogo leído del .add reproduce el registro físico real.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--diccionario", type=Path, default=ADD_CONTAB / DICCIONARIO)
    parser.add_argument("--carpeta", type=Path, default=ADD_CONTAB)
    parser.add_argument("--tabla", help="muestra los campos de esta tabla")
    parser.add_argument("--validar", action="store_true", help="contrasta con los .adt")
    parser.add_argument("--json", type=Path, help="exporta el catálogo real a este archivo")
    argumentos = parser.parse_args(argv)

    if not argumentos.diccionario.is_file():
        raise SystemExit(f"No existe el diccionario {argumentos.diccionario}.")
    objetos = leer(argumentos.diccionario)
    campos = campos_por_tabla(objetos)
    print(
        f"Diccionario: {argumentos.diccionario.name} · "
        f"{len(tablas(objetos))} tablas · {sum(len(v) for v in campos.values())} campos"
    )
    print()

    if argumentos.tabla:
        nombre = argumentos.tabla.upper()
        listado = campos.get(nombre)
        if not listado:
            raise SystemExit(f"La tabla {nombre} no aparece en el diccionario.")
        print(f"{nombre}: {len(listado)} campos · suma de anchos {sum(c.largo for c in listado)}")
        print(f"{'#':>3} {'campo':<22}{'tipo':<11}{'largo':>6}{'dec':>4}")
        for indice, campo in enumerate(listado, 1):
            print(f"{indice:>3} {campo.nombre:<22}{campo.tipo:<11}{campo.largo:>6}{campo.decimales:>4}")
        return 0

    if argumentos.validar:
        return validar(objetos, argumentos.carpeta)

    if argumentos.json:
        exportar(objetos, argumentos.json)
        return 0

    print(f"{'tabla':<22}{'campos':>7}{'suma':>8}")
    for nombre in sorted(campos, key=lambda n: -sum(c.largo for c in campos[n])):
        print(f"{nombre:<22}{len(campos[nombre]):>7}{sum(c.largo for c in campos[nombre]):>8}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
