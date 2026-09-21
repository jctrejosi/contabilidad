"""Extractor de `ADD_CONTAB/` a CSV + manifiesto, sin el motor de Advantage.

Es la fase 5 del plan («Extractor y staging») cumpliendo el contrato de
[`README.md`](README.md) §5:

- **Sólo lectura** sobre el origen: nunca se escribe en `ADD_CONTAB/`.
- **Salida cruda a staging**: un CSV por tabla, con los campos tal como están
  declarados en el diccionario. No se homologa nada aquí.
- **Manifiesto por archivo**: ruta, tabla, año/período cuando el dato los trae,
  bytes, filas leídas y descartadas, y SHA-256 de origen y de salida.
- **Rechazos explícitos** con causa; nunca sustituidos por valores por defecto.
- **Reproducible e idempotente**: repetir la extracción da los mismos conteos y
  los mismos hashes. `--verificar` lo comprueba contra el manifiesto.
- **Reanudable**: `--reanudar` salta las tablas cuyo origen no cambió.

Las dos únicas decisiones de staging, ambas contadas en el manifiesto
--------------------------------------------------------------------

1. **Centinelas de NULL** (P-9). En el origen, un numérico vacío llega como el
   mínimo de su tipo (`-2147483648` en `INTEGER`, `-32768` en `SHORTINT`) y un
   texto vacío como bytes `00`. Se emiten como **campo vacío** —que es lo que
   significan— y el manifiesto dice cuántos por columna, para que el cargador
   pueda verificarlo. No es sustituir por un valor por defecto: es no inventar.
2. **Precisión decimal**. Los `DOUBLE` se emiten con los decimales que declara el
   diccionario. Si el valor almacenado tiene más precisión de la declarada, se
   cuenta en el manifiesto en vez de perderse en silencio.

Codificación: el texto del origen es Latin-1/CP1252 y se escribe **UTF-8**.

Uso:
    python db/migration/extractor/exportar_csv.py                    # todas las tablas con datos
    python db/migration/extractor/exportar_csv.py --tabla CONEMP --tabla CONCECOS
    python db/migration/extractor/exportar_csv.py --limite 1000       # prueba
    python db/migration/extractor/exportar_csv.py --reanudar          # salta lo ya hecho
    python db/migration/extractor/exportar_csv.py --verificar         # revalida conteos y hashes
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from decodificar_adt import ADD_CONTAB, Tabla, catalogo  # necesita el path insertado arriba

STAGING = HERE.parent / "staging"
MANIFIESTO = "manifiesto.json"

# Por encima de esto se pide confirmación explícita (--si) antes de escribir.
LIMITE_AVISO = 500_000

# Mínimos que el legado usa como «sin valor» en los campos numéricos.
CENTINELAS = {"INTEGER": -2147483648, "SHORTINT": -32768}

# Campos que identifican la contabilidad y el período, si la tabla los declara.
CAMPOS_CONTABILIDAD = ("CIA", "CONCIA")
CAMPOS_ANIO = ("CONANO",)
CAMPOS_PERIODO = ("CONMES", "MES")


class ArchivoConHash:
    """Envuelve un archivo y hashea **exactamente** lo que se escribe.

    Tiene que ser así y no rehashear el CSV después: el `csv.writer` entrecomilla
    los campos que traen comas, y un `",".join` no reproduciría el archivo.
    """

    def __init__(self, archivo) -> None:
        self.archivo = archivo
        self.digest = hashlib.sha256()

    def write(self, texto: str) -> int:
        self.digest.update(texto.encode("utf-8"))
        return self.archivo.write(texto)

    def __getattr__(self, nombre: str):
        return getattr(self.archivo, nombre)


def normalizar(valor: object, tipo: str, largo: int, decimales: int) -> tuple[str, str | None]:
    """Valor decodificado -> celda CSV, más la marca detectada (si la hay)."""
    if tipo == "MEMO":
        # En el registro sólo hay un puntero al `.adm`; sin resolver el formato del
        # memo no se puede traer el texto. Se marca en vez de fingir que estaba
        # vacío: si una copia futura trae memos con contenido, hay que verlo.
        return "", "memo_no_resuelto"
    if tipo in CENTINELAS and valor == CENTINELAS[tipo]:
        return "", "centinela_numerico"
    if tipo == "DOUBLE":
        numero = float(valor)  # type: ignore[arg-type]
        redondeado = round(numero, decimales)
        perdida = "precisión_recortada" if abs(numero - redondeado) > 1e-9 else None
        return f"{redondeado:.{decimales}f}", perdida
    if tipo == "LOGICAL":
        return ("T" if valor else "F"), None
    if tipo.startswith("?"):
        return str(valor), None
    texto = str(valor)
    if "\x00" in texto:
        # Texto con bytes nulos: vacío si todo es nulo, y si no se limpia el relleno.
        return texto.replace("\x00", ""), "centinela_texto"
    return texto, None


def exportar(tabla: Tabla, destino: Path, limite: int | None) -> dict[str, object]:
    """Escribe el CSV de una tabla y devuelve su entrada del manifiesto."""
    inicio = time.monotonic()
    columnas = [campo["campo"] for campo in tabla.campos]
    tipos = {campo["campo"]: str(campo["tipo"]) for campo in tabla.campos}
    largos = {campo["campo"]: int(campo["longitud"]) for campo in tabla.campos}
    decimales = {campo["campo"]: int(campo["decimales"]) for campo in tabla.campos}

    hasta = tabla.ranuras if limite is None else min(limite, tabla.ranuras)
    centinelas: dict[str, int] = {}
    memos: dict[str, int] = {}
    recortes = 0
    leidas = 0
    rechazadas: list[dict[str, str]] = []

    digest = hashlib.sha256()
    with destino.open("w", encoding="utf-8", newline="") as archivo:
        envuelto = ArchivoConHash(archivo)
        escritor = csv.writer(envuelto, lineterminator="\n")
        encabezado = ["_loc"] + columnas
        escritor.writerow(encabezado)

        for indice, valores in tabla.filas(hasta=hasta):
            fila: list[str] = [str(indice)]
            for campo in columnas:
                try:
                    celda, marca = normalizar(
                        valores[campo], tipos[campo], largos[campo], decimales[campo]
                    )
                except (TypeError, ValueError) as error:
                    rechazadas.append(
                        {"localizador": str(indice), "campo": campo, "causa": f"{type(error).__name__}: {error}"}
                    )
                    celda, marca = "", None
                if marca == "centinela_numerico" or marca == "centinela_texto":
                    centinelas[campo] = centinelas.get(campo, 0) + 1
                elif marca == "memo_no_resuelto":
                    memos[campo] = memos.get(campo, 0) + 1
                elif marca == "precisión_recortada":
                    recortes += 1
                fila.append(celda)
            escritor.writerow(fila)
            leidas += 1
        digest = envuelto.digest

    destino_bytes = destino.stat().st_size
    # El CSV recién escrito sirve de base para el hash de salida reproducible.
    return {
        "tabla": tabla.nombre,
        "archivo_origen": tabla.ruta.name,
        "archivo_csv": destino.name,
        "filas_leidas": leidas,
        "filas_descartadas": len(rechazadas),
        "columnas": len(columnas),
        "bytes_origen": tabla.bytes,
        "bytes_csv": destino_bytes,
        "sha256_origen": sha256(tabla.ruta),
        "sha256_csv": digest.hexdigest(),
        "contabilidad": None,
        "anio": None,
        "periodos": [],
        "centinelas": dict(sorted(centinelas.items())),
        "memos_no_resueltos": dict(sorted(memos.items())),
        "valores_con_precision_recortada": recortes,
        "rechazos": rechazadas[:20],
        "segundos": round(time.monotonic() - inicio, 1),
    }


def sha256(ruta: Path) -> str:
    digest = hashlib.sha256()
    with ruta.open("rb") as archivo:
        for bloque in iter(lambda: archivo.read(1 << 20), b""):
            digest.update(bloque)
    return digest.hexdigest()


def sha256_csv(ruta: Path) -> str:
    """SHA-256 del CSV tal cual quedó en disco."""
    return sha256(ruta)


def contexto(tabla: Tabla, entrada: dict[str, object], limite: int | None) -> None:
    """Anota contabilidad, año y períodos cuando el propio dato los trae.

    Cada dato se anota por separado: `CONCECOS` declara `CIA` pero no año, y su
    contabilidad es un dato tan válido como el de `MOV`.
    """
    campos = {campo["campo"] for campo in tabla.campos}
    contabilidad = next((c for c in CAMPOS_CONTABILIDAD if c in campos), None)
    anio = next((c for c in CAMPOS_ANIO if c in campos), None)
    periodo = next((c for c in CAMPOS_PERIODO if c in campos), None)
    if not (contabilidad or anio):
        return
    cuantas = tabla.ranuras if limite is None else min(limite, tabla.ranuras)
    contabilidades: set[str] = set()
    anios: set[int] = set()
    periodos: set[int] = set()
    paso = max(1, cuantas // 2000)
    for indice in range(0, cuantas, paso):
        valores = tabla.fila(indice)
        if contabilidad:
            contabilidades.add(str(valores[contabilidad]).strip())
        for campo, conjunto in ((anio, anios), (periodo, periodos)):
            if not campo:
                continue
            try:
                conjunto.add(int(float(valores[campo])))  # type: ignore[arg-type]
            except (TypeError, ValueError):
                pass
    if contabilidad:
        entrada["contabilidad"] = sorted(contabilidades)
    if anio:
        entrada["anio"] = sorted(anios)
    if periodo:
        entrada["periodos"] = sorted(periodos)
    entrada["muestreo"] = f"1 de cada {paso}" if paso > 1 else "todas"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--carpeta", type=Path, default=ADD_CONTAB)
    parser.add_argument("--out", type=Path, default=STAGING)
    parser.add_argument("--tabla", action="append", default=[], help="repite por cada tabla")
    parser.add_argument("--limite", type=int, help="máximo de filas por tabla (pruebas)")
    parser.add_argument("--si", action="store_true", help="no preguntar por las tablas grandes")
    parser.add_argument("--reanudar", action="store_true", help="salta las tablas ya extraídas")
    parser.add_argument("--verificar", action="store_true", help="revalida el manifiesto existente")
    parser.add_argument(
        "--reanotar",
        action="store_true",
        help="recalcula contabilidad/año/períodos del manifiesto sin re-extraer los CSV",
    )
    argumentos = parser.parse_args(argv)

    if not argumentos.carpeta.is_dir():
        raise SystemExit(f"No existe la carpeta {argumentos.carpeta}.")
    argumentos.out.mkdir(parents=True, exist_ok=True)
    ruta_manifiesto = argumentos.out / MANIFIESTO
    anterior = {}
    if ruta_manifiesto.is_file():
        previo = json.loads(ruta_manifiesto.read_text(encoding="utf-8"))
        anterior = {e["tabla"]: e for e in previo.get("tablas", [])}

    if argumentos.verificar:
        return verificar(argumentos, anterior)

    if argumentos.reanotar:
        return reanotar(argumentos, anterior, ruta_manifiesto)

    campos = catalogo()
    disponibles = [
        Tabla(ruta, campos.get(ruta.stem.upper()))
        for ruta in sorted(argumentos.carpeta.iterdir(), key=lambda r: r.stem.upper())
        if ruta.suffix.lower() == ".adt"
    ]
    if argumentos.tabla:
        pedidas = {t.upper() for t in argumentos.tabla}
        disponibles = [t for t in disponibles if t.nombre in pedidas]
        faltan = pedidas - {t.nombre for t in disponibles}
        if faltan:
            raise SystemExit(f"No están en el origen: {', '.join(sorted(faltan))}.")

    entradas: list[dict[str, object]] = []
    for tabla in disponibles:
        if tabla.ranuras == 0:
            print(f"{tabla.nombre:<11} vacía, se omite")
            continue
        if not tabla.catalogo_cuadra:
            print(f"{tabla.nombre:<11} AVISO: el catálogo no cuadra con el registro; se omite")
            continue
        if argumentos.reanudar and tabla.nombre in anterior:
            previa = anterior[tabla.nombre]
            if previa.get("sha256_origen") == sha256(tabla.ruta) and (argumentos.out / previa["archivo_csv"]).is_file():
                print(f"{tabla.nombre:<11} ya extraída (origen sin cambios), se salta")
                entradas.append(previa)
                continue
        if argumentos.limite is None and tabla.ranuras > LIMITE_AVISO and not argumentos.si:
            print(
                f"{tabla.nombre:<11} {tabla.ranuras:,} filas: es una tabla grande. "
                "Confírmalo con --si o usa --limite."
            )
            continue
        destino = argumentos.out / f"{tabla.nombre}.csv"
        print(f"{tabla.nombre:<11} {tabla.ranuras:>9} filas -> {destino.name}", flush=True)
        entrada = exportar(tabla, destino, argumentos.limite)
        if argumentos.limite is None:
            contexto(tabla, entrada, argumentos.limite)
        entradas.append(entrada)
        print(
            f"{'':<11} {entrada['filas_leidas']:>9} leídas · "
            f"{entrada['bytes_csv'] / 1_048_576:.1f} MB · {entrada['segundos']}s"
            + (f" · {entrada['filas_descartadas']} rechazadas" if entrada["filas_descartadas"] else ""),
            flush=True,
        )

    manifiesto_tablas = {str(e["tabla"]): e for e in entradas}
    # Las pasadas parciales se acumulan: sin esto, extraer una tabla borraría del
    # manifiesto lo ya extraído en una corrida anterior.
    for nombre, entrada in anterior.items():
        if nombre not in manifiesto_tablas:
            manifiesto_tablas[nombre] = entrada
    entradas = [manifiesto_tablas[nombre] for nombre in sorted(manifiesto_tablas)]

    manifiesto = {
        "generado_en": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "origen": str(argumentos.carpeta),
        "diccionario": "PUBLIDATA.add",
        "limite": argumentos.limite,
        "tablas": entradas,
        "totales": {
            "tablas": len(entradas),
            "filas": sum(int(e["filas_leidas"]) for e in entradas),
            "filas_descartadas": sum(int(e["filas_descartadas"]) for e in entradas),
            "bytes_csv": sum(int(e["bytes_csv"]) for e in entradas),
        },
    }
    if argumentos.limite is not None:
        manifiesto["aviso"] = "Ejecución de prueba con --limite: NO usar para cargar."
    ruta_manifiesto.write_text(json.dumps(manifiesto, ensure_ascii=False, indent=2), encoding="utf-8")

    totales = manifiesto["totales"]
    print(
        f"\nManifiesto: {ruta_manifiesto}\n"
        f"{totales['tablas']} tablas · {totales['filas']:,} filas · "
        f"{totales['bytes_csv'] / 1_048_576:.1f} MB de CSV"
    )
    return 0


def reanotar(argumentos: argparse.Namespace, anterior: dict, ruta_manifiesto: Path) -> int:
    """Recalcula el contexto del manifiesto leyendo el origen, no los CSV.

    Existe para no re-extraer 1,7 GB sólo porque se mejoró la anotación.
    """
    if not anterior or not ruta_manifiesto.is_file():
        raise SystemExit("No hay manifiesto que reanotar.")
    campos = catalogo()
    manifiesto = json.loads(ruta_manifiesto.read_text(encoding="utf-8"))
    for entrada in manifiesto["tablas"]:
        ruta = argumentos.carpeta / str(entrada["archivo_origen"])
        if not ruta.is_file():
            print(f"{entrada['tabla']:<11} falta {ruta.name}, sin cambios")
            continue
        tabla = Tabla(ruta, campos.get(ruta.stem.upper()))
        contexto(tabla, entrada, manifiesto.get("limite"))
        print(
            f"{entrada['tabla']:<11} contabilidad={entrada['contabilidad']} "
            f"año={entrada['anio']} períodos={entrada['periodos']}"
        )
    manifiesto["reanotado_en"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    ruta_manifiesto.write_text(json.dumps(manifiesto, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nManifiesto actualizado: {ruta_manifiesto}")
    return 0


def verificar(argumentos: argparse.Namespace, anterior: dict) -> int:
    """Revalida conteos y hashes del manifiesto. Es la prueba de idempotencia."""
    if not anterior:
        raise SystemExit("No hay manifiesto que verificar.")
    problemas = 0
    for entrada in anterior.values():
        tabla = entrada["tabla"]
        csv_actual = argumentos.out / str(entrada["archivo_csv"])
        if not csv_actual.is_file():
            print(f"{tabla:<11} FALTA {csv_actual.name}")
            problemas += 1
            continue
        esperado = entrada.get("sha256_csv")
        obtenido = sha256_csv(csv_actual)
        igual = esperado == obtenido
        problemas += 0 if igual else 1
        print(
            f"{tabla:<11} {entrada['filas_leidas']:>9} filas · sha256 "
            f"{'igual' if igual else 'DISTINTO'}"
        )
    print()
    if problemas:
        print(f"{problemas} tablas no reproducen el manifiesto.")
        return 1
    print("Todas reproducen el manifiesto: la extracción es idempotente.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
