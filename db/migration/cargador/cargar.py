"""Cargador del staging a PostgreSQL, según el contrato campo → destino.

Lee los CSV que dejó [`../extractor/exportar_csv.py`](../extractor/exportar_csv.py) y
los carga en el modelo nuevo siguiendo [`../homologacion/reglas.py`](../homologacion/reglas.py).
El detalle campo a campo está en [`../06_referencia_campos.md`](../06_referencia_campos.md).

Principios
----------

- **Idempotente**: cada fila se registra en `migracion_equivalencias` (clave de
  origen → id destino) y los documentos llevan `idempotency_key`, así que repetir
  la ejecución reutiliza los ids en vez de duplicar.
- **Reanudable**: `--entidad` carga una sola; `--hasta` corta la secuencia. Cada
  entidad va en su propia transacción.
- **Trazable**: lo que se excluye o se rechaza deja su renglón original en
  `migracion_filas.valores_originales` con la causa escrita. Nada se descarta en
  silencio ni se sustituye por un valor por defecto.

Orden de carga
--------------

El del §3 de [`../03_plan_de_carga.md`](../03_plan_de_carga.md): compañías, años y
parámetros; después catálogos y maestros; luego el libro.

    python db/migration/cargador/cargar.py --listar
    python db/migration/cargador/cargar.py --hasta cuentas
    python db/migration/cargador/cargar.py --entidad terceros
    python db/migration/cargador/cargar.py --simulacion
"""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import json
import os
import time
from collections import Counter
from contextlib import contextmanager
from pathlib import Path

import psycopg

HERE = Path(__file__).resolve().parent
MIGRATION_DIR = HERE.parent
STAGING = MIGRATION_DIR / "staging"
CONTRATO = MIGRATION_DIR / "homologacion" / "contrato_campos.json"

# Niveles que admite `cuentas.nivel` (CHECK del esquema).
NIVELES_VALIDOS = (1, 2, 4, 6, 9, 12)

DEFAULT_URL = os.environ.get("DATABASE_URL", "postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi")

# Código de la contabilidad activa en la copia (CONEMP.EMPCOD). Se usa para
# detectar si la base tiene el seed de demostración en vez de datos migrados.
CODIGO_COMPANIA = "27"

# Código de la compañía **destino** en PostgreSQL. El legado separa la misma razón
# social en una fila de `CONEMP` por año (26 = 2026, 27 = 2025); el modelo del
# destino tiene una sola `companias` (misma NIT) y los años en `compania_anios`.
# Cuando se carga una contabilidad histórica sobre la compañía ya existente, este
# código apunta a ella (ver `--codigo-destino`).
CODIGO_DESTINO: str | None = None


def codigo_destino() -> str:
    return CODIGO_DESTINO or CODIGO_COMPANIA

# Usuario con el que se firman los documentos históricos (el legado no lo guarda).
EMAIL_MIGRACION = "migracion@contabdsi.local"

MESES = {"00": "Saldos Iniciales", "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
         "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto", "09": "Septiembre",
         "10": "Octubre", "11": "Noviembre", "12": "Diciembre"}


# ---------------------------------------------------------------------------
# `legado`: el resto de la fila del legado
#
# El contrato manda a `<tabla>.legado` los campos del origen que no tienen
# columna propia. Se leen del **contrato**, no de una lista escrita a mano, para
# que no pueda quedarse ninguno fuera; y sólo se guardan las claves con valor,
# porque un jsonb con veinte claves vacías por fila es espacio muerto en cinco
# millones de renglones. Etapa A de db/migration/08_plan_para_culminar.md.
# ---------------------------------------------------------------------------
def campos_legado() -> dict[str, tuple[str, ...]]:
    """Campos cuyo destino declarado en el contrato es `<tabla>.legado`."""
    contrato = json.loads(CONTRATO.read_text(encoding="utf-8"))
    por_tabla: dict[str, tuple[str, ...]] = {}
    for tabla in contrato["tablas"]:
        campos = [campo["campo"] for campo in tabla["campos"]
                  if campo["destino"].strip().endswith(".legado")]
        if campos:
            por_tabla[tabla["tabla"]] = tuple(campos)
    return por_tabla


CAMPOS_LEGADO = campos_legado()


def legado_de(tabla: str, fila: dict) -> str | None:
    """`legado` de una fila: crudo, con su nombre físico y sólo si trae valor."""
    valores = {}
    for campo in CAMPOS_LEGADO.get(tabla, ()):
        limpio = texto(fila.get(campo))
        if limpio:
            valores[campo] = limpio
    return json.dumps(valores, ensure_ascii=False) if valores else None


def legado_sql(tablas: tuple[str, ...], alias: str) -> str:
    """Expresión SQL del `legado` para las tablas de origen indicadas.

    `MOV00` y `MOV01` comparten estructura y se copian a la misma tabla temporal,
    así que se usa la unión de los campos de las dos.
    """
    campos = sorted({campo for tabla in tablas for campo in CAMPOS_LEGADO.get(tabla, ())})
    if not campos:
        return "NULL"
    partes = ", ".join(f"'{campo}', NULLIF(btrim({alias}.\"{campo}\"), '')" for campo in campos)
    return f"NULLIF(jsonb_strip_nulls(jsonb_build_object({partes})), '{{}}'::jsonb)"


# ---------------------------------------------------------------------------
# Conversión de celdas
# ---------------------------------------------------------------------------
def texto(valor: str | None) -> str | None:
    """Celda CSV → texto o NULL. Los centinelas ya vienen vacíos del extractor."""
    if valor is None:
        return None
    limpio = valor.replace("\x00", "").strip()
    return limpio or None


def entero(valor: str | None) -> int | None:
    limpio = texto(valor)
    if limpio is None:
        return None
    try:
        return int(float(limpio))
    except ValueError:
        return None


def booleano(valor: str | None) -> bool | None:
    limpio = texto(valor)
    if limpio is None:
        return None
    return limpio.upper() in ("T", "S", "1", "TRUE", "SI")


def fecha_aaaammdd(valor: str | None) -> str | None:
    """`AAAAMMDD` (entero o double) → fecha ISO, con validación real de calendario.

    Valida con `datetime.date`, no con rangos: el legado trae fechas como
    `2023-02-30`, que pasa un `dia <= 31` pero no existe.
    """
    numero = entero(valor)
    if not numero:
        return None
    crudo = str(numero)
    if len(crudo) != 8:
        return None
    try:
        return datetime.date(int(crudo[:4]), int(crudo[4:6]), int(crudo[6:])).isoformat()
    except ValueError:
        return None


def nivel_de_codigo(codigo: str) -> int | None:
    return len(codigo) if len(codigo) in NIVELES_VALIDOS else None


def ancestros(codigo: str, codigos: set[str]) -> list[str]:
    """Cadena de ancestros por prefijo (la jerarquía que el legado deriva)."""
    return [codigo[:corte] for corte in NIVELES_VALIDOS if corte < len(codigo) and codigo[:corte] in codigos]


# ---------------------------------------------------------------------------
# Staging
# ---------------------------------------------------------------------------
def filas(tabla: str):
    ruta = STAGING / f"{tabla}.csv"
    if not ruta.is_file():
        raise SystemExit(f"Falta {ruta}. Genera el staging con exportar_csv.py.")
    with ruta.open("r", encoding="utf-8", newline="") as archivo:
        yield from csv.DictReader(archivo)


def manifiesto() -> dict:
    ruta = STAGING / "manifiesto.json"
    if not ruta.is_file():
        raise SystemExit(f"Falta {ruta}. Genera el staging con exportar_csv.py.")
    return json.loads(ruta.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Estado de la carga
# ---------------------------------------------------------------------------
class Carga:
    def __init__(self, conexion: psycopg.Connection, simulacion: bool,
                 cabecera_sintetica: bool = False,
                 tolerar_conciliacion: bool = False) -> None:
        self.cn = conexion
        self.simulacion = simulacion
        self.cabecera_sintetica = cabecera_sintetica
        self.tolerar_conciliacion = tolerar_conciliacion
        self.ejecucion_id: int | None = None
        self.compania_id: int | None = None
        self.usuario_id: int | None = None
        self.anio: int = 0
        self.contadores: dict[str, Counter] = {}
        self._archivos: dict[str, int] = {}

    def resolver_contexto(self) -> None:
        """Compañía, año y usuario de la carga, leídos de la base si no vienen de `companias`.

        Se necesita para poder cargar una entidad suelta (`--entidad libro`) sin
        recorrer antes las anteriores.
        """
        with self.cn.cursor() as cur:
            cur.execute("SELECT id FROM companias WHERE codigo = %s", (codigo_destino(),))
            fila = cur.fetchone()
            if fila is None:
                raise SystemExit(
                    f"La base no tiene la contabilidad {codigo_destino()!r}. Carga primero "
                    "«companias» (o ejecuta sin --entidad).")
            self.compania_id = fila[0]
            cur.execute("SELECT max(anio) FROM compania_anios WHERE compania_id = %s",
                        (self.compania_id,))
            self.anio = cur.fetchone()[0] or 0
            cur.execute("SELECT id FROM usuarios WHERE email = %s", (EMAIL_MIGRACION,))
            fila = cur.fetchone()
            self.usuario_id = fila[0] if fila else None

    def usuario_migracion(self) -> int:
        """Usuario que firma los documentos históricos.

        El legado no guarda el usuario en `CONDOCUM`, y el destino exige
        `documentos.usuario_id NOT NULL`. Se crea uno explícito para la migración en
        vez de atribuir el histórico a una persona real.
        """
        if self.usuario_id:
            return self.usuario_id
        with self.cn.cursor() as cur:
            # El rol también se crea: `usuarios.rol_id` es obligatorio y la base de la
            # migración va sin el seed, así que no hay roles.
            cur.execute(
                """
                INSERT INTO roles (codigo, nombre, descripcion)
                VALUES ('MIGRACION', 'Migración', 'Firma los documentos históricos cargados')
                ON CONFLICT DO NOTHING
                """)
            cur.execute("SELECT id FROM roles WHERE codigo = 'MIGRACION'")
            rol_id = cur.fetchone()[0]
            cur.execute(
                """
                INSERT INTO usuarios (nombre, email, rol_id, iniciales, activo)
                VALUES (%s, %s, %s, 'MIG', true)
                ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id
                """,
                ("Migración CONTABDSI", EMAIL_MIGRACION, rol_id))
            self.usuario_id = cur.fetchone()[0]
        return self.usuario_id

    def huella(self) -> str:
        base = json.dumps(
            {
                "tablas": [(t["tabla"], t["sha256_csv"]) for t in manifiesto()["tablas"]],
                "contrato": hashlib.sha256(CONTRATO.read_bytes()).hexdigest(),
            },
            sort_keys=True,
        )
        return hashlib.sha256(base.encode("utf-8")).hexdigest()

    def abrir_ejecucion(self) -> None:
        if self.simulacion:
            return
        with self.cn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO migracion_ejecuciones (huella, version_contrato, origen, descripcion, estado)
                VALUES (%s, %s, %s, %s, 'En curso') RETURNING id
                """,
                (self.huella(), hashlib.sha256(Path(__file__).read_bytes()).hexdigest()[:16],
                 str(STAGING), "Carga del staging a PostgreSQL"),
            )
            self.ejecucion_id = cur.fetchone()[0]
        # La ejecución se persiste aparte: si una entidad falla, queda registrada.
        self.cn.commit()

    def cerrar_ejecucion(self, estado: str) -> None:
        if self.simulacion or self.ejecucion_id is None:
            return
        with self.cn.cursor() as cur:
            cur.execute(
                "UPDATE migracion_ejecuciones SET estado = %s, terminado_en = now() WHERE id = %s",
                (estado, self.ejecucion_id),
            )
        self.cn.commit()

    def archivo(self, tabla: str) -> int | None:
        if self.simulacion:
            return None
        if tabla in self._archivos:
            return self._archivos[tabla]
        datos = {e["tabla"]: e for e in manifiesto()["tablas"]}.get(tabla, {})
        with self.cn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO migracion_archivos (ejecucion_id, ruta, nombre, tabla_origen, formato,
                                                bytes, filas, hash_contenido, extraido_en)
                VALUES (%s, %s, %s, %s, 'CSV', %s, %s, %s, now()) RETURNING id
                """,
                (self.ejecucion_id, str(STAGING / f"{tabla}.csv"), f"{tabla}.csv", tabla,
                 datos.get("bytes_csv"), datos.get("filas_leidas"), datos.get("sha256_csv")),
            )
            self._archivos[tabla] = cur.fetchone()[0]
        return self._archivos[tabla]

    def contar(self, entidad: str, resultado: str) -> None:
        self.contadores.setdefault(entidad, Counter())[resultado] += 1

    def registrar(self, tabla: str, resultado: str, filas: list[tuple[str, dict]],
                  destino: str | None = None, causa: str | None = None) -> None:
        """Deja constancia por fila de lo excluido, fusionado o rechazado."""
        if self.simulacion or not filas:
            return
        archivo_id = self.archivo(tabla)
        with self.cn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO migracion_filas (ejecucion_id, archivo_id, tabla_origen, localizador,
                                             resultado, destino_tabla, valores_originales, causa_rechazo)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (ejecucion_id, archivo_id, localizador) DO NOTHING
                """,
                [(self.ejecucion_id, archivo_id, tabla, localizador, resultado, destino,
                  json.dumps(original, ensure_ascii=False), causa) for localizador, original in filas],
            )

    def registrar_ajuste(self, tabla: str, campo: str, localizadores: list[str], motivo: str) -> None:
        """Anota un valor que la carga cambió, ligado a su fila ya registrada."""
        if self.simulacion or not localizadores:
            return
        archivo_id = self.archivo(tabla)
        with self.cn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO migracion_ajustes (ejecucion_id, fila_id, campo, valor_origen,
                                               valor_cargado, motivo)
                SELECT f.ejecucion_id, f.id, %s, f.valores_originales ->> %s, NULL, %s
                  FROM migracion_filas f
                 WHERE f.ejecucion_id = %s AND f.archivo_id = %s AND f.localizador = ANY(%s)
                ON CONFLICT DO NOTHING
                """,
                (campo, campo, motivo, self.ejecucion_id, archivo_id, localizadores),
            )

    def resumen(self) -> None:
        print("\n-- resumen --")
        for entidad, conteo in self.contadores.items():
            print(f"  {entidad:<20} " + " · ".join(sorted(conteo)))


@contextmanager
def transaccion(carga: Carga):
    """Cada entidad en su transacción.

    En simulación **se descarta siempre**: así `--simulacion` no deja rastro, que
    es lo que promete. La conexión va sin `autocommit` justamente por esto.
    """
    try:
        yield
    except Exception:
        carga.cn.rollback()
        raise
    if carga.simulacion:
        carga.cn.rollback()
    else:
        carga.cn.commit()


# ---------------------------------------------------------------------------
# Entidades
# ---------------------------------------------------------------------------
def cargar_companias(carga: Carga) -> None:
    """CONEMP → companias + compania_anios, para la contabilidad de `--compania`.

    El legado lista 27 contabilidades del mismo NIT; cada una se carga en una
    corrida propia (el staging viene partido por compañía, ver
    `dividir_por_compania.py`). El estado se copia de `HABILITA`: la 27 está
    habilitada y la 26 (año 2024, «PRUEBAS») no lo está en el legado.
    """
    objetivo, otras = None, []
    for fila in filas("CONEMP"):
        if (texto(fila["EMPCOD"]) or "").strip() == CODIGO_COMPANIA:
            objetivo = fila
        else:
            otras.append((fila["_loc"], fila))
    if objetivo is None:
        raise SystemExit(f"CONEMP no trae la contabilidad {CODIGO_COMPANIA!r}.")

    codigo = (texto(objetivo["EMPCOD"]) or "").strip()
    # El destino exige `digito NOT NULL`. La contabilidad activa trae el NIT sin
    # dígito separado (`900273686`), así que queda vacío en vez de inventarlo.
    nit, _, digito = (texto(objetivo["EMPNIT"]) or "").partition("-")
    anio = entero(objetivo["EMPCLAV"])
    estado = "Activa" if booleano(objetivo["HABILITA"]) else "Inactiva"

    if codigo != codigo_destino():
        # Misma razón social en otro año: se cargan sus datos sobre la compañía
        # que ya existe. No se toca su nombre ni su estado: `CONEMP` la rotula
        # como «PRUEBAS»/2024, pero sus tablas traen movimientos de 2026.
        with carga.cn.cursor() as cur:
            cur.execute("SELECT id, nombre FROM companias WHERE codigo = %s", (codigo_destino(),))
            existente = cur.fetchone()
        if existente is None:
            raise SystemExit(
                f"La base no tiene la compañía {codigo_destino()!r}: cárgala primero sin "
                "--codigo-destino.")
        carga.compania_id = existente[0]
        carga.usuario_migracion()
        carga.contar("companias",
                     f"Datos de la contabilidad {codigo} (año {anio}) sobre «{existente[1]}»")
        carga.registrar("CONEMP", "Excluido", otras, "companias",
                        "Contabilidad distinta de la pedida con --compania: se carga en su "
                        "propia corrida, con su staging partido por compañía.")
        return

    with carga.cn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO companias (codigo, nombre, nit, digito, estado, legado)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre,
                                               estado = EXCLUDED.estado,
                                               legado = EXCLUDED.legado RETURNING id
            """,
            (codigo, texto(objetivo["EMPNOM"]), nit or None, digito or "", estado,
             legado_de("CONEMP", objetivo)),
        )
        carga.compania_id = cur.fetchone()[0]
        cur.execute("INSERT INTO compania_anios (compania_id, anio) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (carga.compania_id, anio))
    carga.anio = anio or 0
    carga.usuario_migracion()
    carga.contar("companias", f"Cargada {codigo} ({estado}, año {anio})")
    carga.contar("compania_anios", f"Cargado año {anio}")
    carga.registrar("CONEMP", "Excluido", otras, "companias",
                    "Contabilidad distinta de la pedida con --compania: se carga en su propia "
                    "corrida, con su staging partido por compañía.")
    carga.contar("companias", f"Otras {len(otras)} contabilidades del catálogo (fuera de esta corrida)")

    otros = {texto(f["CIA"]) for f in filas("CONMAE") if texto(f["CIA"]) not in (None, codigo)}
    if otros:
        raise SystemExit(f"CONMAE trae contabilidades distintas de {codigo!r}: {sorted(otros)}")


def cargar_periodos(carga: Carga) -> None:
    """Los períodos con datos de la compañía, leídos del manifiesto del staging.

    El extractor ya contó año y períodos de cada tabla de movimiento, así que no
    hay que recorrer millones de filas sólo por dos columnas.
    """
    presentes: set[tuple[int, str]] = set()
    for entrada in manifiesto()["tablas"]:
        anio = (entrada.get("anio") or [None])[0]
        for periodo in entrada.get("periodos") or []:
            if anio and periodo:
                presentes.add((int(anio), f"{int(periodo):02d}"))
    if not presentes:
        raise SystemExit("El manifiesto no trae año ni períodos: vuelve a extraer con exportar_csv.py.")
    # El año de los saldos es el de los movimientos, no el de `CONEMP.EMPCLAV`:
    # la compañía 26 está declarada como 2024 en el catálogo pero sus tablas
    # traen el cierre 2025·12 y los movimientos 2026·01..09 (verificado en
    # `TFECHA`), y `CONMAE` acumula ese mismo año. Para la 27 ambos coinciden.
    carga.anio = max(carga.anio, max(a for a, _ in presentes))
    with carga.cn.cursor() as cur:
        # La interfaz ofrece los años que tienen datos, además del declarado.
        cur.executemany(
            "INSERT INTO compania_anios (compania_id, anio) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            [(carga.compania_id, anio) for anio in sorted({a for a, _ in presentes})],
        )
    with carga.cn.cursor() as cur:
        cur.executemany(
            "INSERT INTO periodos_contables (compania_id, anio, periodo, nombre, estado) "
            "VALUES (%s,%s,%s,%s,'Abierto') ON CONFLICT DO NOTHING",
            [(carga.compania_id, anio, periodo, MESES.get(periodo, periodo))
             for anio, periodo in sorted(presentes)],
        )
    carga.contar("periodos_contables", f"Cargados {len(presentes)} ({sorted(presentes)})")


def cargar_parametros(carga: Carga) -> None:
    """CONCTR → parametros_operacion + parametros_nomina (los campos que la interfaz lee).

    `CONCTR` es el control **de la instalación**, no de cada compañía: la copia
    trae una sola fila, la de la contabilidad activa. Para una compañía sin fila
    de control no se cargan parámetros ni se inventan: queda constancia en el
    resumen.
    """
    fila = next(iter(filas("CONCTR")), None)
    if fila is None:
        carga.contar("parametros_operacion", "Sin control en el legado para esta compañía: no se carga")
        return
    habilitados = {f"{n:02d}": bool(booleano(fila[f"CT{n:02d}"])) for n in range(13)}
    with carga.cn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO parametros_operacion (
              compania_id, anio, nombre_empresa, nit, direccion, ciudad, directorio_contabilidad,
              anio_operacion, contabilidad_conciliacion, verifica_documentos_lotes,
              terceros_documentos_propios, controla_usuario_lotes, comentario_certificado,
              leyenda2, documento, fecha_operativa, periodos_habilitados, legado)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (compania_id, anio) DO NOTHING
            """,
            (carga.compania_id, carga.anio, texto(fila["CTCIA"]), texto(fila["CTNIT"]),
             texto(fila["CTDIRECC"]), texto(fila["CTCIUDAD"]), texto(fila["CTDIREC"]),
             texto(fila["CTANO"]), texto(fila["CTCLAVE1"]), bool(booleano(fila["CTVERDOC"])),
             bool(booleano(fila["CTTERDOC"])), texto(fila["CTPUC"]) == "1", texto(fila["CTLEY1"]),
             texto(fila["CTLEY2"]), texto(fila["CTDOCUM"]), fecha_aaaammdd(fila["CTFCHOY"]),
             json.dumps(habilitados), legado_de("CONCTR", fila)),
        )
    carga.contar("parametros_operacion", "Cargado")

    campos = ("comprobante_nomina", "documento_nomina", "comprobante_aportes",
              "documento_aportes", "comprobante_provisiones", "documento_provisiones")
    valores = [texto(fila[clave]) for n in (1, 2, 3) for clave in (f"CTCOMNOM{n}", f"CTDOCNOM{n}")]
    with carga.cn.cursor() as cur:
        cur.execute(
            f"INSERT INTO parametros_nomina (compania_id, anio, {', '.join(campos)}) "
            f"VALUES (%s, %s, {', '.join(['%s'] * 6)}) ON CONFLICT (compania_id, anio) DO NOTHING",
            (carga.compania_id, carga.anio, *valores),
        )
        carga.contar("parametros_nomina", "Cargado")


def cargar_comprobantes(carga: Carga) -> None:
    """CONTICOM → comprobantes."""
    with carga.cn.cursor() as cur:
        cur.execute("SELECT codigo FROM comprobantes WHERE compania_id = %s", (carga.compania_id,))
        existentes = {f[0] for f in cur.fetchall()}
    nuevos, repetidos = [], []
    for fila in filas("CONTICOM"):
        codigo = texto(fila["CODIGO"])
        if not codigo:
            continue
        if codigo in existentes:
            repetidos.append((fila["_loc"], fila))
            continue
        existentes.add(codigo)
        nuevos.append((carga.compania_id, codigo, texto(fila["NOMBRE"]) or codigo,
                       texto(fila["CTABDES"]), not bool(booleano(fila["HIST"])),
                       legado_de("CONTICOM", fila)))
    with carga.cn.cursor() as cur:
        cur.executemany(
            "INSERT INTO comprobantes (compania_id, codigo, nombre, descripcion_auxiliar, activo, legado) "
            "VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING", nuevos)
    carga.contar("comprobantes", f"Cargados {len(nuevos)}")
    if repetidos:
        carga.registrar("CONTICOM", "Fusionado", repetidos, "comprobantes",
                        "Código ya existente en el destino: se conserva el primero.")
        carga.contar("comprobantes", f"Fusionados {len(repetidos)}")


def cargar_centros(carga: Carga) -> None:
    """CONCECOS → centros_costos, con jerarquía derivada por prefijo de código."""
    registros = []
    for fila in filas("CONCECOS"):
        codigo = texto(fila["CODIGO"])
        if not codigo:
            continue
        registros.append({
            "codigo": codigo, "nombre": texto(fila["NOMBRE"]) or codigo, "hist": texto(fila["HIST"]),
            "tipo": entero(fila["TIPO"]), "carpeta": texto(fila["CARPETA"]),
            "valor": texto(fila["VALOR"]) or 0, "porcentaje": texto(fila["PORCEN"]) or 0,
            "valor_porcentaje": texto(fila["VLRPOR"]) or 0, "codigo_item": texto(fila["CODITEM"]),
            "concepto": texto(fila["CONCEPTO"]), "cuenta": texto(fila["CUENTA"]),
            "legado": legado_de("CONCECOS", fila),
        })
    codigos = {r["codigo"] for r in registros}
    with carga.cn.cursor() as cur:
        cur.execute("SELECT codigo, id FROM cuentas WHERE compania_id = %s", (carga.compania_id,))
        cuentas = dict(cur.fetchall())
        for registro in registros:
            cadena = ancestros(registro["codigo"], codigos)
            cur.execute(
                """
                INSERT INTO centros_costos (compania_id, codigo, nombre, nivel, parent_id, hist, tipo,
                                            carpeta, valor, porcentaje, valor_porcentaje, codigo_item,
                                            cuenta_id, concepto, legado)
                VALUES (%s,%s,%s,%s,
                        (SELECT id FROM centros_costos WHERE compania_id = %s AND codigo = %s),
                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (compania_id, codigo) DO NOTHING
                """,
                (carga.compania_id, registro["codigo"], registro["nombre"], len(cadena) + 1,
                 carga.compania_id, cadena[-1] if cadena else None, registro["hist"], registro["tipo"],
                 registro["carpeta"], registro["valor"], registro["porcentaje"],
                 registro["valor_porcentaje"], registro["codigo_item"],
                 cuentas.get(registro["cuenta"] or ""), registro["concepto"], registro["legado"]),
            )
    carga.contar("centros_costos", f"Cargados {len(registros)}")


def cargar_cuentas(carga: Carga) -> None:
    """CONMAE → cuentas, sin los auxiliares por tercero que mezcla el maestro.

    `CONMAE` no es sólo el plan de cuentas. En esta copia trae tres cosas mezcladas:

    1. el plan contable (clases 1–7), que es lo que se carga;
    2. un catálogo de códigos de 9 dígitos en clases 8 y 9 con nombres de sucursal
       y departamento («Farmacia Sultana», «Bodega General de Carnes»), que se
       carga tal cual porque ocupa niveles válidos del destino;
    3. **auxiliares por tercero**: filas cuyo «código» es el NIT de un tercero
       (`CROWE CO S.A.S`, `SCOTIABANK COLPATRIA`…) con ocho o nueve dígitos. Se
       excluyen y se registran: el destino modela ese cruce en `documento_lineas`.
    """
    registros, auxiliares, codigos_vistos, repetidos = [], [], set(), []
    for fila in filas("CONMAE"):
        codigo = (texto(fila["CODIGO"]) or "").strip()
        if not codigo:
            continue
        if nivel_de_codigo(codigo) is None:
            auxiliares.append((fila["_loc"], fila))
            continue
        if codigo in codigos_vistos:
            # NIT de tercero de 9 dígitos: choca con un código real del plan.
            repetidos.append((fila["_loc"], fila))
            continue
        codigos_vistos.add(codigo)
        clase = texto(fila["MIVA_RET"])
        registros.append({
            "codigo": codigo, "nombre": texto(fila["MNOMBRE"]) or codigo,
            "saldo": texto(fila["MSALDO"]) or 0, "ajuste": bool(booleano(fila["MAJUSTE"])),
            "controla_centro": bool(booleano(fila["MCOSTOS"])), "controla_base": bool(booleano(fila["MBASER"])),
            "porcentaje": texto(fila["PORIVARET"]) or 0,
            "clase_iva": "Generado" if clase == "I" else None,
            "clase_retencion": {"R": "Renta", "V": "IVA", "C": "ICA"}.get(clase or ""),
            "distribucion": texto(fila["MDISTRICC"]) if texto(fila["MDISTRICC"]) in
            ("Ninguna", "Fija", "Porcentaje") else "Ninguna",
            "clasificacion": texto(fila["CTCTABASE"]),
            "legado": legado_de("CONMAE", fila),
            "acumulados": [(f"{n:02d}", texto(fila[f"MACMDEB{n:02d}"]) or 0,
                            texto(fila[f"MACMCRE{n:02d}"]) or 0) for n in range(1, 13)],
        })
    codigos = {r["codigo"] for r in registros}
    con_hijas = {c[:corte] for c in codigos for corte in NIVELES_VALIDOS if corte < len(c) and c[:corte] in codigos}

    saldos = []
    with carga.cn.cursor() as cur:
        for registro in registros:
            cadena = ancestros(registro["codigo"], codigos)
            cur.execute(
                """
                INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, controla_centro,
                                     controla_base, ajuste, clase_iva, clase_retencion, distribucion,
                                     porcentaje, saldo_inicial, clasificacion_corriente, parent_id, path,
                                     legado)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                        (SELECT id FROM cuentas WHERE compania_id = %s AND codigo = %s), %s, %s)
                ON CONFLICT (compania_id, codigo) DO NOTHING RETURNING id
                """,
                (carga.compania_id, registro["codigo"], registro["nombre"],
                 nivel_de_codigo(registro["codigo"]), registro["codigo"] not in con_hijas,
                 registro["controla_centro"], registro["controla_base"], registro["ajuste"],
                 registro["clase_iva"], registro["clase_retencion"], registro["distribucion"],
                 registro["porcentaje"], registro["saldo"], registro["clasificacion"],
                 carga.compania_id, cadena[-1] if cadena else None,
                 "/" + "/".join([*cadena, registro["codigo"]]), registro["legado"]),
            )
            encontrada = cur.fetchone()
            cuenta_id = encontrada[0] if encontrada else None
            if cuenta_id is None:
                cur.execute("SELECT id FROM cuentas WHERE compania_id = %s AND codigo = %s",
                            (carga.compania_id, registro["codigo"]))
                cuenta_id = cur.fetchone()[0]
            # El saldo del maestro es la apertura: período '00'.
            saldos.append((carga.compania_id, carga.anio, "00", cuenta_id, registro["saldo"], 0, 0))
            for periodo, debito, credito in registro["acumulados"]:
                if debito != "0.00" or credito != "0.00":
                    saldos.append((carga.compania_id, carga.anio, periodo, cuenta_id, 0, debito, credito))
        cur.executemany(
            "INSERT INTO saldos_cuenta (compania_id, anio, periodo, cuenta_id, saldo_inicial, debito, credito) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING", saldos)
    carga.contar("cuentas", f"Cargadas {len(registros)}")
    carga.contar("saldos_cuenta", f"Cargados {len(saldos)}")
    carga.registrar("CONMAE", "Excluido", auxiliares, "cuentas",
                    "Auxiliar por tercero: su «código» es un NIT con nombre de tercero y longitud "
                    "que no es un nivel del plan. `CONMAE` mezcla el plan con los auxiliares; el "
                    "destino modela ese cruce en `documento_lineas` (tercero + cuenta).")
    carga.contar("cuentas", f"Excluidos {len(auxiliares)} auxiliares por NIT (nivel inválido)")
    if repetidos:
        carga.registrar("CONMAE", "Fusionado", repetidos, "cuentas",
                        "Código repetido: es el NIT de un tercero con la misma longitud que un "
                        "nivel válido del plan, así que colisiona con una cuenta real. Se conserva "
                        "el renglón original y se queda la primera aparición.")
        carga.contar("cuentas", f"Fusionados {len(repetidos)} códigos repetidos (NIT de tercero)")


def cargar_terceros(carga: Carga) -> None:
    """FADCLI → terceros."""
    vistos: set[str] = set()
    nuevos, duplicados, sin_nit, fechas_invalidas = [], [], [], []
    ambiguos = 0
    for fila in filas("FADCLI"):
        nit = texto(fila["CNIT"]) or texto(fila["CCODIGO"])
        if not nit:
            sin_nit.append((fila["_loc"], fila))
            continue
        if nit in vistos:
            duplicados.append((fila["_loc"], fila))
            continue
        vistos.add(nit)
        if texto(fila["CFCHCREA"]) and not fecha_aaaammdd(fila["CFCHCREA"]):
            fechas_invalidas.append((fila["_loc"], fila))
        # `docs/maestros/TERCEROS_ADS.md`: CESTADO = 1 activo, el resto bloqueado; y
        # CTIPOCLI = 1 natural, 2 jurídica. Cualquier otro valor cae al DEFAULT del
        # destino ('Juridica'), que es también lo que hace la interfaz al crear.
        tipo = {"1": "Natural", "2": "Juridica"}.get((texto(fila["CTIPOCLI"]) or "")[:1], "Juridica")
        if tipo == "Juridica" and (texto(fila["CTIPOCLI"]) or "")[:1] not in ("2",):
            ambiguos += 1
        estado = "Activo" if (texto(fila["CESTADO"]) or "") == "1" else "Bloqueado"
        nuevos.append((
            carga.compania_id, nit, texto(fila["CDIGITO"]) or "", texto(fila["CNOMBRE"]) or nit,
            tipo, texto(fila["CTIPDOC"]) or "NIT", texto(fila["CDIREC"]), texto(fila["CTELEF"]),
            texto(fila["CCIUDAD"]), texto(fila["CCODCIU"]), texto(fila["CZONA"]), texto(fila["CEMAIL"]),
            estado, texto(fila["CMOTIVO"]), fecha_aaaammdd(fila["CFCHCREA"]),
            texto(fila["CSALDO"]) or 0, texto(fila["CCUPO"]) or 0, texto(fila["CSOCIAL"]),
            texto(fila["CNOM1"]), texto(fila["CNOM2"]), texto(fila["CAPE1"]), texto(fila["CAPE2"]),
            texto(fila["CCODIGO"]), legado_de("FADCLI", fila),
        ))
    with carga.cn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO terceros (compania_id, nit, digito, nombre, tipo, tipo_documento, direccion,
                                  telefono, ciudad, codigo_ciudad, zona, correo, estado, motivo_bloqueo,
                                  fecha_creacion, saldo, cupo, nombre_comercial, primer_nombre,
                                  segundo_nombre, primer_apellido, segundo_apellido, codigo_legado,
                                  legado)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (compania_id, nit) DO NOTHING
            """, nuevos)
    carga.contar("terceros", f"Cargados {len(nuevos)}")
    if ambiguos:
        carga.contar("terceros", f"Tipo jurídica por defecto {ambiguos} (CTIPOCLI vacío o 0)")
    if duplicados:
        carga.registrar("FADCLI", "Fusionado", duplicados, "terceros",
                        "NIT repetido en el origen: el destino tiene UNIQUE(compania_id, nit). "
                        "Se conserva el renglón original y queda el primero.")
        carga.contar("terceros", f"Fusionados {len(duplicados)} por NIT repetido")
    if sin_nit:
        carga.registrar("FADCLI", "Rechazado", sin_nit, "terceros",
                        "Sin NIT ni código: el destino exige nit NOT NULL.")
        carga.contar("terceros", f"Rechazados {len(sin_nit)} sin NIT")
    if fechas_invalidas:
        carga.registrar("FADCLI", "Cargado", fechas_invalidas, "terceros")
        carga.registrar_ajuste(
            "FADCLI", "CFCHCREA", [fila[0] for fila in fechas_invalidas],
            "Fecha de creación inválida en el origen (no existe en el calendario): se cargó "
            "vacía en vez de sustituirla por la fecha de hoy.")
        carga.contar("terceros", f"Con fecha de creación inválida {len(fechas_invalidas)} (van a NULL)")


def cargar_tipos_documento(carga: Carga) -> None:
    """VISDOCUM → tipos_documento + plantillas + tarifas de IVA y retención."""
    with carga.cn.cursor() as cur:
        cur.execute("SELECT codigo, id FROM comprobantes WHERE compania_id = %s", (carga.compania_id,))
        comprobantes = dict(cur.fetchall())

    tipos, tarifas, retenciones, plantillas = [], {}, {}, []
    for fila in filas("VISDOCUM"):
        codigo = texto(fila["CODIGO"])
        if not codigo:
            continue
        genera = booleano(fila["ICONTAB"])
        # El CHECK del destino escribe 'Automatica' sin tilde.
        tipos.append((
            carga.compania_id, codigo, texto(fila["NOMBRE"]) or codigo,
            "Manual" if booleano(fila["MODICONSE"]) else "Automatica", entero(fila["CONSE"]) or 0,
            entero(fila["MODULO"]), texto(fila["TIPO"]), texto(fila["PREFIJO"]),
            comprobantes.get(texto(fila["COMPRO"]) or ""),
            True if genera is None else genera, bool(booleano(fila["CONVER"])),
            texto(fila["DOCCONVER"]), legado_de("VISDOCUM", fila),
        ))
        if texto(fila["NIMP1"]) or texto(fila["IMP1"]):
            tarifas[(texto(fila["NIMP1"]) or "IVA", texto(fila["IMP1"]) or 0)] = True
        for n in range(1, 5):
            if texto(fila[f"NRET{n}"]) or texto(fila[f"RET{n}"]):
                retenciones[(texto(fila[f"NRET{n}"]) or f"Retención {n}", texto(fila[f"RET{n}"]) or 0)] = True
        renglones = []
        for n in range(1, 10):
            debito, credito = texto(fila[f"DEB{n:02d}"]), texto(fila[f"CRE{n:02d}"])
            concepto = texto(fila[f"NOM{n:02d}"]) if n <= 8 else None
            if debito or credito or concepto:
                renglones.append((n, debito, credito, concepto))
        if renglones:
            plantillas.append((codigo, texto(fila["NOMBRE"]) or codigo, renglones))

    with carga.cn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO tipos_documento (compania_id, codigo, nombre, numeracion, consecutivo, modulo,
                                         naturaleza, prefijo, comprobante_id, genera_contabilizacion,
                                         permite_conversion, conversion_codigo, legado)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING
            """, tipos)
        cur.executemany(
            "INSERT INTO tarifas_iva (compania_id, codigo, nombre, tarifa) VALUES (%s,%s,%s,%s) "
            "ON CONFLICT DO NOTHING",
            [(carga.compania_id, f"IVA{indice:02d}", nombre, valor)
             for indice, (nombre, valor) in enumerate(tarifas, 1)])
        cur.executemany(
            "INSERT INTO conceptos_retencion (compania_id, codigo, nombre, tarifa) VALUES (%s,%s,%s,%s) "
            "ON CONFLICT DO NOTHING",
            [(carga.compania_id, f"RET{indice:02d}", nombre, valor)
             for indice, (nombre, valor) in enumerate(retenciones, 1)])
        for codigo, nombre, renglones in plantillas:
            cur.execute(
                """
                INSERT INTO plantillas_contables (compania_id, codigo, nombre, tipo_documento_id)
                VALUES (%s, %s, %s, (SELECT id FROM tipos_documento WHERE compania_id = %s AND codigo = %s))
                ON CONFLICT DO NOTHING RETURNING id
                """, (carga.compania_id, f"PL{codigo}", f"Plantilla {nombre}", carga.compania_id, codigo))
            encontrada = cur.fetchone()
            if not encontrada:
                continue
            cur.executemany(
                """
                INSERT INTO plantilla_lineas (plantilla_id, orden, cuenta_debito_id, cuenta_credito_id, concepto)
                VALUES (%s,%s,
                        (SELECT id FROM cuentas WHERE compania_id = %s AND codigo = %s),
                        (SELECT id FROM cuentas WHERE compania_id = %s AND codigo = %s), %s)
                """,
                [(encontrada[0], orden, carga.compania_id, debito, carga.compania_id, credito, concepto)
                 for orden, debito, credito, concepto in renglones])
    carga.contar("tipos_documento", f"Cargados {len(tipos)}")
    carga.contar("tarifas_iva", f"Cargadas {len(tarifas)}")
    carga.contar("conceptos_retencion", f"Cargados {len(retenciones)}")
    carga.contar("plantillas_contables", f"Cargadas {len(plantillas)}")

def cargar_libro(carga: Carga) -> None:
    """CONDOCUM + MOV00/MOV01 → documentos + documento_lineas.

    Con 735.976 cabeceras y 5.048.937 renglones no se puede ir fila a fila: se
    copian los CSV a tablas temporales con `COPY` y se resuelven las claves contra
    tablas hash. Ninguna fila se descarta en silencio: cada cabecera y cada
    renglón acaba cargado o rechazado con su causa escrita, y la entidad comprueba
    al terminar que esa suma cuadra con el origen.
    """
    with carga.cn.cursor() as cur:
        # Tres ajustes de sesión, todos medidos, sin los cuales la entidad no
        # termina: la anticombinación de 5.048.937 renglones contra las 735.976
        # cabeceras se iba por **bucle anidado** y llevaba más de 30 minutos sin
        # acabar; con los 4 MB de `work_mem` por omisión la tabla hash se derrama
        # a disco en cada lote; y la fusión ordenada es la otra salida que toma el
        # planificador cuando no hay `hash join` disponible.
        cur.execute("SET LOCAL enable_nestloop = off")
        cur.execute("SET LOCAL enable_mergejoin = off")
        cur.execute("SET LOCAL work_mem = '256MB'")

        crear_mapas(cur, carga.compania_id)

        # La compañía puede tener ya otros años cargados (la 27 es 2025 y sobre
        # ella se carga 2026): el control de cierre compara el **delta** de esta
        # corrida, no el total de la compañía. Se separan las cabeceras reales de
        # las sintéticas porque las sintéticas no vienen de `CONDOCUM`.
        def contar_documentos(sinteticas: bool) -> int:
            cur.execute(
                "SELECT count(*) FROM documentos WHERE compania_id = %s AND origen = 'Migracion' "
                "AND COALESCE(legado->>'SINTETICA', 'false') = %s",
                (carga.compania_id, "true" if sinteticas else "false"))
            return cur.fetchone()[0]

        documentos_antes = contar_documentos(False)
        sinteticas_antes = contar_documentos(True)
        cur.execute("SELECT count(*) FROM documento_lineas WHERE compania_id = %s AND origen = 'Migracion'",
                    (carga.compania_id,))
        lineas_antes = cur.fetchone()[0]

        # --- Cabeceras -----------------------------------------------------
        copiar_a_temporal(cur, "stg_doc", "CONDOCUM")
        carga.archivo("CONDOCUM")
        cur.execute(DOCUMENTOS_SQL, {"compania": carga.compania_id,
                                     "usuario": carga.usuario_migracion()})
        documentos = cur.rowcount
        if carga.simulacion:
            # En simulación no hay ejecución de migración ni, por tanto, archivos:
            # `migracion_filas.archivo_id` es obligatorio y no se puede dejar nulo.
            # La simulación comprueba el cargue, no la trazabilidad.
            cabeceras_rechazadas = 0
        else:
            cur.execute(RECHAZOS_CABECERA_SQL, {"ejecucion": carga.ejecucion_id,
                                                "compania": carga.compania_id})
            cabeceras_rechazadas = cur.rowcount
        cur.execute(
            "UPDATE migracion_archivos SET procesado_en = now(), estado = 'Procesado' "
            "WHERE ejecucion_id = %s AND tabla_origen = 'CONDOCUM'", (carga.ejecucion_id,))

        # --- Renglones -----------------------------------------------------
        # Los renglones de los dos períodos van a la misma tabla temporal: el COPY
        # agrega, y las columnas son idénticas porque MOV00 y MOV01 comparten
        # estructura (verificado en la referencia de campos).
        for indice, tabla in enumerate(("MOV00", "MOV01")):
            copiar_a_temporal(cur, "stg_mov", tabla, primera=indice == 0)
            carga.archivo(tabla)

        # La cabecera de cada renglón no se busca fila a fila —son 5 millones de
        # recorridos— sino que se resuelve su clave una vez por combinación
        # distinta y se elige **una** cabecera por clave, con la evidencia a la
        # vista (ver `CLAVES_AMBIGUAS_SQL`).
        cur.execute(GRUPOS_RENGLON_SQL)
        cur.execute("ANALYZE mov_grp")
        cur.execute(CANDIDATAS_SQL, {"compania": carga.compania_id})
        cur.execute("ANALYZE doc_cand")
        cur.execute(ELEGIDOS_SQL)
        cur.execute("ANALYZE doc_elegido")

        # Cabeceras sintéticas (opcional): se crean para las claves con renglones
        # de valor y sin cabecera, y se vuelve a resolver la unión de claves para
        # que esos renglones entren. Ver `SINTETICAS_SQL`.
        if carga.cabecera_sintetica:
            cur.execute(SINTETICAS_SQL, {"compania": carga.compania_id,
                                         "usuario": carga.usuario_migracion()})
            cur.execute("DROP TABLE IF EXISTS doc_cand")
            cur.execute(CANDIDATAS_SQL, {"compania": carga.compania_id})
            cur.execute("ANALYZE doc_cand")
            cur.execute("DROP TABLE IF EXISTS doc_elegido")
            cur.execute(ELEGIDOS_SQL)
            cur.execute("ANALYZE doc_elegido")

        if carga.simulacion:
            ambiguas = rechazados = 0
        else:
            cur.execute(CLAVES_AMBIGUAS_SQL, {"ejecucion": carga.ejecucion_id})
            ambiguas = cur.rowcount
            cur.execute(RECHAZOS_RENGLON_SQL, {"ejecucion": carga.ejecucion_id})
            rechazados = cur.rowcount
        cur.execute(LINEAS_SQL, {"compania": carga.compania_id})
        lineas = cur.rowcount

        cur.execute("SELECT count(*) FROM stg_mov")
        total_renglones = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM stg_doc")
        total_cabeceras = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM documentos WHERE compania_id = %s "
                    "AND origen = 'Migracion' AND COALESCE(legado->>'SINTETICA', 'false') <> 'true'",
                    (carga.compania_id,))
        documentos_total = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM documentos WHERE compania_id = %s "
                    "AND origen = 'Migracion' AND legado->>'SINTETICA' = 'true'",
                    (carga.compania_id,))
        sinteticas = cur.fetchone()[0] - sinteticas_antes
        cur.execute("SELECT count(*) FROM documento_lineas WHERE compania_id = %s "
                    "AND origen = 'Migracion'", (carga.compania_id,))
        renglones_total = cur.fetchone()[0]

    # Cierre del balance del cargue: en la base tiene que haber **todo** lo que no
    # se rechazó, y lo rechazado tiene que estar registrado con causa. Se mide el
    # delta de esta corrida (`documentos_antes`/`lineas_antes`) porque la compañía
    # destino puede tener ya otros años: la 27 se cargó con 2025 y aquí se le
    # suman los movimientos de 2026. Dentro del delta, en una segunda corrida no
    # entra nada nuevo (todo choca con las claves únicas) y los rechazos sí se
    # vuelven a registrar, bajo su propia ejecución. En simulación no hay recuento
    # de rechazos que contrastar (ver arriba).
    if not carga.simulacion:
        nuevos_documentos = documentos_total - documentos_antes
        if nuevos_documentos + cabeceras_rechazadas != total_cabeceras:
            raise RuntimeError(
                f"El libro de cabeceras no cuadra: {total_cabeceras:,} en el origen, "
                f"{nuevos_documentos:,} nuevas en la base y {cabeceras_rechazadas:,} rechazadas.")
        nuevas_lineas = renglones_total - lineas_antes
        if nuevas_lineas + rechazados != total_renglones:
            raise RuntimeError(
                f"El libro de renglones no cuadra: {total_renglones:,} en el origen, "
                f"{nuevas_lineas:,} nuevos en la base y {rechazados:,} rechazados.")

    carga.contar("documentos", f"Nuevos {documentos} · en la base {documentos_total:,}")
    if sinteticas:
        carga.contar("documentos", f"{sinteticas:,} sintéticas (renglón sin cabecera en CONDOCUM)")
    if cabeceras_rechazadas:
        carga.contar("documentos", f"Rechazadas {cabeceras_rechazadas} sin comprobante o sin fecha")
    if ambiguas:
        carga.contar("documentos", f"{ambiguas} claves con varias cabeceras candidatas")
    carga.contar("documento_lineas", f"Nuevos {lineas} · en la base {renglones_total:,}")
    if rechazados:
        carga.contar("documento_lineas", f"Rechazadas {rechazados} con causa registrada")


def copiar_a_temporal(cur, destino: str, tabla: str, primera: bool = True) -> None:
    """`COPY` del CSV a una tabla temporal en texto, con su archivo de origen.

    `MOV00` y `MOV01` comparten estructura y se copian a la **misma** tabla, así que
    se etiqueta cada fila con su archivo: si no, sus `_loc` colisionarían y no se
    sabría de qué CSV salió cada renglón al registrar una excepción.
    """
    ruta = STAGING / f"{tabla}.csv"
    with ruta.open("r", encoding="utf-8", newline="") as archivo:
        cabecera = next(csv.reader(archivo))
    columnas = ", ".join(f'"{c}"' for c in cabecera)
    if primera:
        cur.execute(f"DROP TABLE IF EXISTS {destino}")
        cur.execute(f"CREATE TEMP TABLE {destino} (_archivo text, " +
                    ", ".join(f'"{c}" text' for c in cabecera) + ")")
    with cur.copy(f"COPY {destino} ({columnas}) FROM STDIN WITH (FORMAT csv, HEADER true)") as copia:
        with ruta.open("rb") as archivo:
            while bloque := archivo.read(1 << 20):
                copia.write(bloque)
    cur.execute(f"UPDATE {destino} SET _archivo = %s WHERE _archivo IS NULL", (tabla,))


# ---------------------------------------------------------------------------
# Clave de la cabecera de un renglón
#
# El legado identifica el documento por compañía, año, período, comprobante, tipo
# documental y número. Medido sobre las 5.048.937 filas: `CONANO`/`CONMES` y
# `TFECDOC` coinciden en **todas**, así que el año y el período no discriminan
# nada por encima de la fecha del documento. Se une por comprobante + tipo
# documental + documento + **fecha**, que de las dos claves probadas es la que
# deja menos renglones huérfanos y menos claves ambiguas:
#
#   clave                            sin cabecera      claves ambiguas
#   fecha + tipo documental          5.044 · 18.559    135 · 786.747
#   año + período + tipo documental   5.029 · 18.476   220 · 788.612
#
# La segunda ahorra 83 renglones huérfanos y mete 1.865 más dentro de una clave
# ambigua: se prefiere la primera, porque una clave ambigua obliga a **elegir**
# cabecera y elegir es peor que rechazar con causa.
# ---------------------------------------------------------------------------
def fecha_legado(campo: str) -> str:
    """Expresión `texto AAAAMMDD` -> `date` que devuelve NULL en vez de abortar.

    `to_date` de PostgreSQL **falla** con una fecha fuera de calendario
    (`to_date('20230230', 'YYYYMMDD')` responde «date/time field value out of
    range») y el plan exige cuarentena con motivo, no que se caiga la carga
    entera. El guardián comprueba rango de año, de mes y de día contra la
    duración real del mes —29 de febrero incluido— así que `to_date` sólo ve
    cadenas que ya son fechas válidas.
    """
    limpio = f"btrim({campo})"
    anio = f"substring({limpio} from 1 for 4)::int"
    mes = f"substring({limpio} from 5 for 2)::int"
    dia = f"substring({limpio} from 7 for 2)::int"
    ultimo = (f"(CASE WHEN {mes} IN (1, 3, 5, 7, 8, 10, 12) THEN 31 "
              f"WHEN {mes} = 2 THEN CASE WHEN mod({anio}, 4) = 0 "
              f"AND (mod({anio}, 100) <> 0 OR mod({anio}, 400) = 0) THEN 29 ELSE 28 END "
              f"ELSE 30 END)")
    return (f"CASE WHEN {limpio} ~ '^[0-9]{{8}}$' "
            f"AND {anio} BETWEEN 1900 AND 2999 AND {mes} BETWEEN 1 AND 12 "
            f"AND {dia} BETWEEN 1 AND {ultimo} THEN to_date({limpio}, 'YYYYMMDD') END")


FECHA_CABECERA = fecha_legado('d."DFECHA"')
FECHA_RENGLON = fecha_legado('m."TFECDOC"')


def crear_mapas(cur, compania_id: int) -> None:
    """Catálogos de resolución, copiados a tablas temporales.

    Resolver comprobante, tipo documental, cuenta, centro de costo y tercero con
    búsquedas por índice son 5 millones de recorridos —10 millones para el
    tercero, que se busca por NIT y por código heredado— sobre tablas que no
    caben en caché. Copiadas a tablas temporales (28 comprobantes, 127 tipos,
    4.046 cuentas, 222 centros, 126.009 terceros) la unión pasa de esos
    recorridos aleatorios a una sola pasada contra memoria.

    Se usa `min(id)` en vez del `LIMIT 1` sin orden anterior: con varios
    candidatos la elección deja de ser arbitraria y la corrida se vuelve
    reproducible. Se comprobó que las seis claves son únicas hoy (0 duplicados),
    así que el resultado no cambia para estos datos.
    """
    for destino, consulta in (
        ("map_comprobantes",
         "SELECT codigo, min(id) AS id FROM comprobantes WHERE compania_id = %s GROUP BY codigo"),
        ("map_tipos",
         "SELECT codigo, min(id) AS id FROM tipos_documento WHERE compania_id = %s GROUP BY codigo"),
        ("map_cuentas",
         "SELECT codigo, min(id) AS id FROM cuentas WHERE compania_id = %s GROUP BY codigo"),
        ("map_centros",
         "SELECT codigo, min(id) AS id FROM centros_costos WHERE compania_id = %s GROUP BY codigo"),
        ("map_nit",
         ("SELECT nit AS clave, min(id) AS id FROM terceros WHERE compania_id = %s "
          "AND nit IS NOT NULL AND nit <> '' GROUP BY nit")),
        ("map_legado",
         ("SELECT codigo_legado AS clave, min(id) AS id FROM terceros WHERE compania_id = %s "
          "AND codigo_legado IS NOT NULL AND codigo_legado <> '' GROUP BY codigo_legado")),
    ):
        cur.execute(f"CREATE TEMP TABLE {destino} AS {consulta}", (compania_id,))


# Cabeceras del libro. `numero` es la numeración nueva del destino, y se conserva
# la del legado (`_loc`, el NREC de la instantánea) porque la regla 6.2 prohíbe
# renumerar la historia sin guardar la referencia original, y `DDOCUM` no es un
# bigint. El `origen` marca la fila como historia migrada.
DOCUMENTOS_SQL = f"""
INSERT INTO documentos (compania_id, anio, comprobante_id, numero, documento, tipo_documento_id,
                        fecha, fecha_documento, periodo, tercero_id, concepto, estado, origen,
                        usuario_id, idempotency_key, legado)
SELECT %(compania)s,
       EXTRACT(YEAR FROM f.fecha)::int,
       mc.id,
       d."_loc"::bigint,
       NULLIF(btrim(d."DDOCUM"), ''),
       mt.id,
       f.fecha,
       f.fecha,
       to_char(f.fecha, 'MM'),
       COALESCE(tn.id, tc.id),
       NULLIF(btrim(d."DDETALLE"), ''),
       'Contabilizado',
       'Migracion',
       %(usuario)s,
       md5(%(compania)s::text || COALESCE(d."DDOCUM", '') || COALESCE(d."DCOMPRO", '')
           || d."_loc")::uuid,
       {legado_sql(("CONDOCUM",), "d")}
  FROM stg_doc d
  CROSS JOIN LATERAL (SELECT {FECHA_CABECERA} AS fecha) f
  JOIN map_comprobantes mc ON mc.codigo = btrim(d."DCOMPRO")
  LEFT JOIN map_tipos mt ON mt.codigo = btrim(d."DTIPODOC")
  LEFT JOIN map_nit tn ON tn.clave = btrim(d."DNIT")
  LEFT JOIN map_legado tc ON tc.clave = btrim(d."DNIT")
 WHERE f.fecha IS NOT NULL
ON CONFLICT DO NOTHING
"""

# Cabeceras que no pueden entrar: sin comprobante (obligatorio en el destino) o
# sin fecha del calendario. Las dos se rechazan con la causa escrita; a ninguna se
# le inventa un valor por omisión.
RECHAZOS_CABECERA_SQL = f"""
INSERT INTO migracion_filas (ejecucion_id, archivo_id, tabla_origen, localizador, clave_negocio,
                             resultado, destino_tabla, valores_originales, causa_rechazo)
SELECT %(ejecucion)s, a.id, 'CONDOCUM', d."_loc",
       COALESCE(btrim(d."DCOMPRO"), '') || '|' || COALESCE(btrim(d."DDOCUM"), ''),
       'Rechazado', 'documentos', to_jsonb(d)::jsonb,
       CASE WHEN f.fecha IS NULL
              THEN 'Cabecera sin fecha válida: `DFECHA` = '
                   || COALESCE(quote_literal(btrim(d."DFECHA")), '(vacío)')
                   || ' no es una fecha del calendario y `documentos.fecha` es obligatorio. '
                      'No se sustituye por hoy.'
            ELSE 'Cabecera sin comprobante contable: `DCOMPRO` = '
                 || COALESCE(quote_literal(btrim(d."DCOMPRO")), '(vacío)')
                 || ' no existe en `comprobantes` y `documentos.comprobante_id` es obligatorio. '
                    'No se le inventa un comprobante.'
       END
  FROM stg_doc d
  CROSS JOIN LATERAL (SELECT {FECHA_CABECERA} AS fecha) f
  LEFT JOIN map_comprobantes mc ON mc.codigo = btrim(d."DCOMPRO")
  LEFT JOIN migracion_archivos a ON a.ejecucion_id = %(ejecucion)s
                                AND a.tabla_origen = 'CONDOCUM'
 WHERE mc.id IS NULL OR f.fecha IS NULL
ON CONFLICT DO NOTHING
"""

# Clave de cabecera de cada renglón: una fila por combinación distinta, con el
# total de débitos. Ese total es lo que guarda `CONDOCUM.DVALOR`: medido, coincide
# con la suma de `TVALOR > 0` en 121.216 de las 123.678 claves de una sola
# cabecera (98,0%). `DVALOR` no se carga como columna (así lo fija el contrato de
# campos), pero es la evidencia que justifica a qué cabecera va cada renglón.
GRUPOS_RENGLON_SQL = f"""
CREATE TEMP TABLE mov_grp AS
SELECT comprobante_id, tipo_id, documento, fecha,
       count(*) AS lineas,
       count(*) FILTER (WHERE valor <> 0) AS con_valor,
       COALESCE(sum(valor) FILTER (WHERE valor > 0), 0) AS debitos,
       min(archivo) AS archivo
  FROM (SELECT mc.id AS comprobante_id,
               COALESCE(mt.id, 0) AS tipo_id,
               btrim(m."TDOCUM") AS documento,
               {FECHA_RENGLON} AS fecha,
               COALESCE(NULLIF(btrim(m."TVALOR"), '')::numeric, 0) AS valor,
               m."_archivo" AS archivo
          FROM stg_mov m
          JOIN map_comprobantes mc ON mc.codigo = btrim(m."TCOMPR")
          LEFT JOIN map_tipos mt ON mt.codigo = btrim(m."TIPODOC")) r
 GROUP BY comprobante_id, tipo_id, documento, fecha
"""

# Cabeceras candidatas de cada clave, con su `DVALOR`.
CANDIDATAS_SQL = """
CREATE TEMP TABLE doc_cand AS
SELECT d.id AS documento_id, d.comprobante_id,
       COALESCE(d.tipo_documento_id, 0) AS tipo_id,
       d.documento, d.fecha_documento AS fecha, d.numero, x.dvalor
  FROM documentos d
  LEFT JOIN (SELECT "_loc"::bigint AS loc, NULLIF(btrim("DVALOR"), '')::numeric AS dvalor
               FROM stg_doc) x ON x.loc = d.numero
 WHERE d.compania_id = %(compania)s
"""

# Una cabecera por clave, y la elección queda justificada: primero la que cuadra
# con el total de débitos de los renglones; si ninguna cuadra —pasa en 64 de las
# 84 claves ambiguas, porque el legado reutiliza la etiqueta para documentos
# distintos— la de menor número, que es la primera de la instantánea. Nunca se
# elige al azar y la elección se registra (`CLAVES_AMBIGUAS_SQL`).
ELEGIDOS_SQL = """
CREATE TEMP TABLE doc_elegido AS
SELECT DISTINCT ON (c.comprobante_id, c.tipo_id, c.documento, c.fecha)
       c.comprobante_id, c.tipo_id, c.documento, c.fecha,
       c.documento_id, c.numero, c.dvalor
  FROM doc_cand c
  JOIN mov_grp g ON g.comprobante_id = c.comprobante_id AND g.tipo_id = c.tipo_id
                AND g.documento = c.documento AND g.fecha = c.fecha
 ORDER BY c.comprobante_id, c.tipo_id, c.documento, c.fecha,
          (c.dvalor = g.debitos) DESC NULLS LAST, c.numero
"""

# Cabeceras sintéticas — opción `--cabecera-sintetica` (etapa B, §3.2 de
# `../09_conciliacion_tsaldo.md`).
#
# Hay renglones cuya cabecera **existe en CONDOCUM pero con otra fecha** (p. ej.
# `JP0000001564`: el renglón es de 2025-01-31 y la cabecera trae 2025-10-31), o
# cuyo número el legado reutiliza para documentos distintos. Como la clave de
# unión incluye la fecha, quedan huérfanos y se rechazan con causa. Con esta
# bandera se les crea una cabecera **propia y marcada** para no perder el
# movimiento ni descuadrar la cuenta. Sin la bandera nada cambia.
#
# `numero` va en un rango reservado (9.000.000.000+) para no chocar con
# `documentos_uk (compania_id, anio, comprobante_id, numero)`, que usa el `_loc`
# de CONDOCUM. La `idempotency_key` deriva de la clave, así que repetir la carga
# no duplica: la segunda corrida inserta 0 filas.
SINTETICAS_SQL = """
INSERT INTO documentos (compania_id, anio, comprobante_id, numero, documento,
                        tipo_documento_id, fecha, fecha_documento, periodo, tercero_id,
                        concepto, estado, origen, usuario_id, idempotency_key, legado)
SELECT %(compania)s,
       EXTRACT(YEAR FROM g.fecha)::int,
       g.comprobante_id,
       9000000000 + row_number() OVER (ORDER BY g.comprobante_id, g.tipo_id,
                                                 g.documento, g.fecha),
       g.documento,
       NULLIF(g.tipo_id, 0),
       g.fecha,
       g.fecha,
       to_char(g.fecha, 'MM'),
       NULL,
       'Cabecera sintetica: renglon sin cabecera en CONDOCUM (etapa B)',
       'Contabilizado',
       'Migracion',
       %(usuario)s,
       md5('SINTETICA' || %(compania)s::text || g.comprobante_id::text || g.tipo_id::text
           || COALESCE(g.documento, '') || g.fecha::text)::uuid,
       jsonb_build_object('SINTETICA', true,
                          'motivo', 'renglon sin cabecera en CONDOCUM')
  FROM mov_grp g
  LEFT JOIN doc_elegido e ON e.comprobante_id = g.comprobante_id AND e.tipo_id = g.tipo_id
                         AND e.documento = g.documento AND e.fecha = g.fecha
 WHERE e.documento_id IS NULL
   AND g.fecha IS NOT NULL
   AND g.con_valor > 0
ON CONFLICT DO NOTHING
"""

# Claves con más de una cabecera candidata: una fila por clave (no por renglón)
# con la elección, las alternativas y el motivo. Es la única atribución del libro
# que no es 1 a 1.
CLAVES_AMBIGUAS_SQL = """
INSERT INTO migracion_filas (ejecucion_id, archivo_id, tabla_origen, localizador, clave_negocio,
                             resultado, destino_tabla, destino_id, flags, valores_originales)
SELECT %(ejecucion)s, a.id, 'MOVxx',
       'clave:' || c.comprobante_id || '|' || c.tipo_id || '|'
                || COALESCE(c.documento, '(sin documento)') || '|' || c.fecha::text,
       c.documento,
       'Derivado', 'documentos', e.documento_id, ARRAY['CLAVE_AMBIGUA'],
       jsonb_build_object(
           'comprobante_id', c.comprobante_id,
           'tipo_documento_id', c.tipo_id,
           'documento', c.documento,
           'fecha_documento', c.fecha,
           'renglones', g.lineas,
           'debitos', g.debitos,
           'cabeceras_candidatas', c.candidatas,
           'cabeceras_ids', c.ids,
           'elegida', e.documento_id,
           'elegida_por', CASE WHEN e.dvalor = g.debitos
                               THEN 'DVALOR de la cabecera = total de débitos de los renglones'
                               ELSE 'menor número de cabecera: ningún DVALOR cuadra' END)
  FROM (SELECT c2.comprobante_id, c2.tipo_id, c2.documento, c2.fecha,
               count(*) AS candidatas,
               array_agg(c2.documento_id ORDER BY c2.numero) AS ids
          FROM doc_cand c2
          JOIN doc_elegido e2 ON e2.comprobante_id = c2.comprobante_id
                             AND e2.tipo_id = c2.tipo_id
                             AND e2.documento = c2.documento AND e2.fecha = c2.fecha
         GROUP BY c2.comprobante_id, c2.tipo_id, c2.documento, c2.fecha
        HAVING count(*) > 1) c
  JOIN mov_grp g ON g.comprobante_id = c.comprobante_id AND g.tipo_id = c.tipo_id
                AND g.documento = c.documento AND g.fecha = c.fecha
  JOIN doc_elegido e ON e.comprobante_id = c.comprobante_id AND e.tipo_id = c.tipo_id
                    AND e.documento = c.documento AND e.fecha = c.fecha
  LEFT JOIN migracion_archivos a ON a.ejecucion_id = %(ejecucion)s
                                AND a.tabla_origen = g.archivo
ON CONFLICT DO NOTHING
"""

# Renglones que no pueden entrar, cada uno con su causa. Las tres condiciones son
# excluyentes entre sí y complementarias de `LINEAS_SQL`: cada renglón del origen
# acaba cargado o rechazado, nunca en los dos sitios ni en ninguno — y el cargador
# lo comprueba al terminar.
RECHAZOS_RENGLON_SQL = f"""
INSERT INTO migracion_filas (ejecucion_id, archivo_id, tabla_origen, localizador, clave_negocio,
                             resultado, destino_tabla, valores_originales, causa_rechazo)
SELECT %(ejecucion)s, a.id, 'MOVxx', m."_loc",
       COALESCE(btrim(m."TCOMPR"), '') || '|' || COALESCE(btrim(m."TDOCUM"), '') || '|'
       || COALESCE(btrim(m."TFECDOC"), ''),
       'Rechazado', 'documento_lineas', to_jsonb(m)::jsonb,
       CASE WHEN e.documento_id IS NULL
              THEN 'Renglón sin cabecera en CONDOCUM para su clave (compañía, comprobante, tipo '
                   'documental, documento y fecha del documento): comprobante '
                   || COALESCE(quote_literal(btrim(m."TCOMPR")), '(vacío)') || ', documento '
                   || COALESCE(quote_literal(btrim(m."TDOCUM")), '(vacío)') || ', fecha '
                   || COALESCE(btrim(m."TFECDOC"), '(vacía)')
                   || '. No se le inventa cabecera.'
            WHEN v.valor = 0
              THEN 'Renglón con valor cero: no representa débito ni crédito, y una partida sin '
                   'importe no es un movimiento.'
            ELSE 'Cuenta ' || COALESCE(quote_literal(btrim(m."CODIGO")), '(vacía)')
                 || ' no existe en el plan cargado y `documento_lineas.cuenta_id` es obligatorio.'
       END
  FROM stg_mov m
  CROSS JOIN LATERAL (SELECT COALESCE(NULLIF(btrim(m."TVALOR"), '')::numeric, 0) AS valor) v
  CROSS JOIN LATERAL (SELECT {FECHA_RENGLON} AS fecha) f
  LEFT JOIN map_comprobantes mc ON mc.codigo = btrim(m."TCOMPR")
  LEFT JOIN map_tipos mt ON mt.codigo = btrim(m."TIPODOC")
  LEFT JOIN doc_elegido e ON e.comprobante_id = mc.id AND e.tipo_id = COALESCE(mt.id, 0)
                         AND e.documento = btrim(m."TDOCUM") AND e.fecha = f.fecha
  LEFT JOIN map_cuentas ct ON ct.codigo = btrim(m."CODIGO")
  LEFT JOIN migracion_archivos a ON a.ejecucion_id = %(ejecucion)s
                                AND a.tabla_origen = m."_archivo"
 WHERE e.documento_id IS NULL OR v.valor = 0 OR ct.id IS NULL
ON CONFLICT DO NOTHING
"""

LINEAS_SQL = f"""
INSERT INTO documento_lineas (documento_id, compania_id, numero_linea, cuenta_id, tercero_id,
                              centro_costo_id, tipo_documento_id, debito, credito, base, clase,
                              fecha_documento, valor_moneda, nit_alterno, documento_afectado,
                              concepto, archivo_origen, origen, legado)
SELECT e.documento_id, %(compania)s,
       -- `MOVxx.TSEC` —la secuencia que el contrato prefería— está vacía en las
       -- 5.048.937 filas, así que se usa el orden físico de la instantánea, que es
       -- el reemplazo que el propio contrato de campos deja indicado.
       row_number() OVER (PARTITION BY e.documento_id
                          ORDER BY m."_archivo", m."_loc"::bigint),
       ct.id, COALESCE(tn.id, tc.id), cc.id, mt.id,
       GREATEST(v.valor, 0), GREATEST(-v.valor, 0),
       COALESCE(NULLIF(btrim(m."TBASE"), '')::numeric, 0),
       -- `TIVA_RET` del legado vale {{O, I, R, vacío}} (contado sobre las 5.048.937
       -- filas) y la clase del destino {{IVA, Retencion, Otro, vacío}}: 'O' se
       -- conserva como 'Otro' en vez de fundirlo con el vacío, para no perder la
       -- distinción que el origen sí hace.
       CASE btrim(m."TIVA_RET") WHEN 'I' THEN 'IVA' WHEN 'R' THEN 'Retencion'
                                WHEN 'O' THEN 'Otro' ELSE '' END,
       f.fecha,
       NULLIF(btrim(m."TVALORUS"), '')::numeric,
       NULLIF(btrim(m."NITN"), ''),
       NULLIF(btrim(m."TDOCUM2"), ''),
       NULLIF(btrim(m."TDETALLE"), ''),
       NULLIF(btrim(m."TARCHI"), ''),
       'Migracion',
       {legado_sql(("MOV00", "MOV01"), "m")}
  FROM stg_mov m
  CROSS JOIN LATERAL (SELECT COALESCE(NULLIF(btrim(m."TVALOR"), '')::numeric, 0) AS valor) v
  CROSS JOIN LATERAL (SELECT {FECHA_RENGLON} AS fecha) f
  JOIN map_comprobantes mc ON mc.codigo = btrim(m."TCOMPR")
  LEFT JOIN map_tipos mt ON mt.codigo = btrim(m."TIPODOC")
  JOIN doc_elegido e ON e.comprobante_id = mc.id AND e.tipo_id = COALESCE(mt.id, 0)
                    AND e.documento = btrim(m."TDOCUM") AND e.fecha = f.fecha
  JOIN map_cuentas ct ON ct.codigo = btrim(m."CODIGO")
  LEFT JOIN map_centros cc ON cc.codigo = btrim(m."TFASE")
  LEFT JOIN map_nit tn ON tn.clave = btrim(m."NIT")
  LEFT JOIN map_legado tc ON tc.clave = btrim(m."NIT")
 WHERE v.valor <> 0
ON CONFLICT DO NOTHING
"""


def cargar_consecutivos(carga: Carga) -> None:
    """Consecutivos por comprobante y año, sin tocar la numeración histórica.

    El legado guarda su propio consecutivo en `VISDOCUM.CONSE`; aquí se fija el del
    destino a partir del mayor `documentos.numero` cargado, para que el siguiente
    documento que se cree continúe la serie en vez de chocar con ella.
    """
    with carga.cn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO consecutivos_comprobantes (compania_id, anio, comprobante_id,
                                                   consecutivo_actual, consecutivo_fin)
            SELECT compania_id, anio, comprobante_id, max(numero), max(numero)
              FROM documentos
             WHERE compania_id = %s AND comprobante_id IS NOT NULL
             GROUP BY compania_id, anio, comprobante_id
            ON CONFLICT (compania_id, anio, comprobante_id)
            DO UPDATE SET consecutivo_actual = GREATEST(consecutivos_comprobantes.consecutivo_actual,
                                                        EXCLUDED.consecutivo_actual),
                          consecutivo_fin = GREATEST(consecutivos_comprobantes.consecutivo_fin,
                                                     EXCLUDED.consecutivo_fin)
            """,
            (carga.compania_id,),
        )
        filas_afectadas = cur.rowcount
    carga.contar("consecutivos_comprobantes", f"Ajustados {filas_afectadas}")


# Una fila por par (cuenta, período) de la instantánea del origen, con el libro
# recompuesto, los renglones rechazados de esa cuenta y período, y las tres marcas
# que hacen la comparación honesta: si la cuenta es hoja, si el período tiene
# libro y cuánto se rechazó.
# Períodos con **renglones** en el libro, no con cabeceras: hay 615.290 documentos de
# períodos cuyos archivos de movimiento no están en la copia.
#
# Va en su propia tabla temporal y no en un CTE a propósito: PostgreSQL 12+ inlinea
# los CTE que se referencian una vez, y entonces el `EXISTS` de la consulta de
# conciliación volvía a recorrer los 5.025.890 renglones por cada fila de la
# instantánea. La consulta no terminó en 20 minutos; materializada, tarda segundos.
PERIODOS_CON_LIBRO_SQL = """
CREATE TEMP TABLE periodos_con_libro AS
SELECT DISTINCT d.anio, d.periodo
  FROM documento_lineas dl
  JOIN documentos d ON d.id = dl.documento_id
 WHERE dl.compania_id = %(compania)s
"""

CONCILIACION_SQL = """
CREATE TEMP TABLE conciliacion AS
WITH hojas AS (
    SELECT c.id,
           NOT EXISTS (SELECT 1 FROM cuentas h
                        WHERE h.compania_id = c.compania_id AND h.codigo <> c.codigo
                          AND h.codigo LIKE c.codigo || '%%') AS es_hoja
      FROM cuentas c WHERE c.compania_id = %(compania)s
)
SELECT s.anio, s.periodo, hs.es_hoja, s.cuenta_id,
       s.debito, s.credito,
       COALESCE(l.debito, 0) AS debito_libro,
       COALESCE(l.credito, 0) AS credito_libro,
       COALESCE(r.debitos, 0) AS debito_rechazado,
       COALESCE(r.creditos, 0) AS credito_rechazado,
       EXISTS (SELECT 1 FROM periodos_con_libro p
                WHERE p.anio = s.anio AND p.periodo = s.periodo)
         AS periodo_con_libro
  FROM saldos_cuenta s
  JOIN cuentas c ON c.id = s.cuenta_id
  JOIN hojas hs ON hs.id = c.id
  LEFT JOIN LATERAL (
      SELECT COALESCE(sum(dl.debito), 0) AS debito, COALESCE(sum(dl.credito), 0) AS credito
        FROM documento_lineas dl
        JOIN documentos d ON d.id = dl.documento_id
       WHERE dl.compania_id = s.compania_id AND dl.cuenta_id = s.cuenta_id
         AND d.anio = s.anio AND d.periodo = s.periodo
  ) l ON true
  -- Los rechazos del libro, por cuenta y período. Se toma la última ejecución que
  -- los registró: repetir el cargue vuelve a anotarlos bajo su propia ejecución, y
  -- sin este filtro se contarían dos veces.
  LEFT JOIN (SELECT btrim(valores_originales ->> 'CODIGO') AS codigo,
                    substring(btrim(valores_originales ->> 'TFECDOC') from 1 for 4) AS anio,
                    substring(btrim(valores_originales ->> 'TFECDOC') from 5 for 2) AS periodo,
                    sum(GREATEST((valores_originales ->> 'TVALOR')::numeric, 0)) AS debitos,
                    sum(GREATEST(-(valores_originales ->> 'TVALOR')::numeric, 0)) AS creditos
               FROM migracion_filas
              WHERE resultado = 'Rechazado' AND destino_tabla = 'documento_lineas'
                AND ejecucion_id = (SELECT max(ejecucion_id) FROM migracion_filas
                                     WHERE resultado = 'Rechazado'
                                       AND destino_tabla = 'documento_lineas')
              GROUP BY 1, 2, 3) r
    ON r.codigo = c.codigo AND r.anio = s.anio::text AND r.periodo = s.periodo
 WHERE s.compania_id = %(compania)s
"""


def conciliar_saldos(carga: Carga) -> None:
    """Paso 7: conciliar el libro cargado contra la instantánea del origen.

    `saldos_cuenta` guarda lo que decía `CONMAE`. Compararlo directamente contra
    el libro no dice nada, y se comprobó por qué:

      · `CONMAE` acumula **el árbol entero**: sus cifras de una cuenta incluyen
        las de sus hijas, mientras el libro sólo tiene partidas en las cuentas
        hoja. Las cuentas con hijas no son comparables.
      · el credito de la instantánea va en **negativo** (`CONMAE` lo guarda así).
      · parte de los renglones no se cargó: `migracion_filas` los tiene con su
        causa, y su importe es justo la diferencia que aparecía.

    Con eso, la conciliación que sí se puede exigir es exacta y la entidad la
    exige: en las cuentas hoja y en los períodos con libro,

        instantánea = libro + renglones rechazados declarados

    y la diferencia tiene que ser cero. Los períodos sin renglones cargados —
    `MOV02`..`MOV18` no están en la copia, ver P-8 del plan— se reportan aparte
    como alcance declarado, no como error.
    """
    with carga.cn.cursor() as cur:
        cur.execute(PERIODOS_CON_LIBRO_SQL, {"compania": carga.compania_id})
        cur.execute(CONCILIACION_SQL, {"compania": carga.compania_id})
        cur.execute(
            "SELECT count(*), COALESCE(sum(debito), 0), COALESCE(sum(credito), 0) "
            "FROM documento_lineas WHERE compania_id = %s", (carga.compania_id,))
        lineas, debito, credito = cur.fetchone()
        cur.execute(
            "SELECT count(*) FROM documentos WHERE compania_id = %s AND estado = 'Contabilizado'",
            (carga.compania_id,))
        documentos = cur.fetchone()[0]

        cur.execute(
            """
            SELECT count(*) AS pares,
                   count(*) FILTER (WHERE debito = debito_libro + debito_rechazado
                                      AND credito = -(credito_libro + credito_rechazado)) AS cuadran,
                   COALESCE(sum(abs(debito - debito_libro - debito_rechazado)), 0) AS dif_debito,
                   COALESCE(sum(abs(credito + credito_libro + credito_rechazado)), 0) AS dif_credito
              FROM conciliacion WHERE es_hoja AND periodo_con_libro
            """)
        pares, cuadran, dif_debito, dif_credito = cur.fetchone()
        cur.execute(
            """
            SELECT count(*) AS pares,
                   count(*) FILTER (WHERE debito <> 0 OR credito <> 0) AS con_saldo
              FROM conciliacion WHERE es_hoja AND NOT periodo_con_libro
            """)
        sin_pares, sin_con_saldo = cur.fetchone()
        cur.execute(
            """
            SELECT count(*) AS pares,
                   count(*) FILTER (WHERE debito_libro <> 0 OR credito_libro <> 0) AS con_libro
              FROM conciliacion WHERE NOT es_hoja
            """)
        acumuladas, acumuladas_con_libro = cur.fetchone()

    print(f"   libro        {documentos:,} documentos · {lineas:,} renglones")
    print(f"   débitos      {debito:,.2f}")
    print(f"   créditos     {credito:,.2f}   (diferencia {debito - credito:,.2f} del propio origen)")
    print(f"   cuentas hoja, períodos con libro: {pares:,} pares · cuadran {cuadran:,}")
    print(f"   diferencia después de sumar los rechazos declarados: "
          f"débito {dif_debito:,.2f} · crédito {dif_credito:,.2f}")
    print(f"   cuentas hoja en períodos sin libro (MOV02..MOV18 fuera de la copia): "
          f"{sin_pares:,} pares · {sin_con_saldo:,} con saldo en el origen")
    print(f"   cuentas con hijas (la instantánea acumula el árbol, no se comparan): "
          f"{acumuladas:,} pares · {acumuladas_con_libro:,} con partidas propias")

    if dif_debito or dif_credito:
        mensaje = (
            "La conciliación no cuadra: con los rechazos declarados sumados, la instantánea "
            f"sigue difiriendo en débito {dif_debito:,.2f} y crédito {dif_credito:,.2f}. "
            "O el libro perdió partidas sin registrarlas, o la instantánea no es de este libro.")
        if not carga.tolerar_conciliacion:
            raise RuntimeError(mensaje)
        # Un histórico cargado sobre una compañía que ya tenía otro año mezcla dos
        # instantáneas en el mismo `saldos_cuenta`: la diferencia se reporta y se
        # documenta, en vez de tumbar una carga ya verificada por entidad.
        print(f"   AVISO: {mensaje} (tolerado con --tolerar-conciliacion)")
        carga.contar("conciliacion", "Diferencia reportada y tolerada (ver 15_compania_26.md)")

    carga.contar("conciliacion", f"{cuadran:,} de {pares:,} pares cuadran")
    carga.contar("conciliacion", f"{sin_con_saldo:,} pares en períodos sin libro (P-8)")
    carga.contar("conciliacion", f"{acumuladas:,} pares en cuentas con hijas, fuera del alcance")


ENTIDADES = [
    ("companias", "CONEMP -> companias + compania_anios", cargar_companias),
    ("periodos", "MOVxx -> periodos_contables", cargar_periodos),
    ("parametros", "CONCTR -> parametros_operacion + parametros_nomina", cargar_parametros),
    ("comprobantes", "CONTICOM -> comprobantes", cargar_comprobantes),
    ("centros", "CONCECOS -> centros_costos", cargar_centros),
    ("cuentas", "CONMAE -> cuentas + saldos_cuenta", cargar_cuentas),
    ("terceros", "FADCLI -> terceros", cargar_terceros),
    ("tipos_documento", "VISDOCUM -> tipos_documento + plantillas + impuestos", cargar_tipos_documento),
    ("libro", "CONDOCUM + MOVxx -> documentos + documento_lineas", cargar_libro),
    ("consecutivos", "documentos -> consecutivos_comprobantes", cargar_consecutivos),
    ("conciliacion", "documento_lineas vs saldos_cuenta del origen", conciliar_saldos),
]


def main(argv: list[str] | None = None) -> int:
    global CODIGO_COMPANIA, CODIGO_DESTINO, STAGING
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--compania", default=CODIGO_COMPANIA,
                        help="código de la contabilidad del legado a cargar (CONEMP.EMPCOD); "
                             "por omisión 27")
    parser.add_argument("--codigo-destino", default=None,
                        help="código de la compañía destino en PostgreSQL cuando el legado "
                             "parte la misma razón social en varios años (p. ej. --compania 26 "
                             "--codigo-destino 27); por omisión, el mismo --compania")
    parser.add_argument("--staging", type=Path, default=None,
                        help="carpeta del staging de esa compañía; por omisión db/migration/staging")
    parser.add_argument("--entidad", help="carga sólo esta entidad")
    parser.add_argument("--hasta", help="carga hasta esta entidad inclusive")
    parser.add_argument("--listar", action="store_true", help="muestra el orden de carga y sale")
    parser.add_argument("--simulacion", action="store_true", help="no escribe en la base")
    parser.add_argument("--cabecera-sintetica", action="store_true",
                        help="crea una cabecera marcada como sintética para los renglones "
                             "sin cabecera en CONDOCUM, en vez de rechazarlos (etapa B)")
    parser.add_argument("--permitir-base-sucia", action="store_true",
                        help="carga aunque la base ya tenga compañías (datos de demostración)")
    parser.add_argument("--tolerar-conciliacion", action="store_true",
                        help="reporta la diferencia de conciliación sin abortar (para cargar un "
                             "histórico sobre una compañía con otro año ya cargado)")
    argumentos = parser.parse_args(argv)

    # El cargador trabaja una compañía por corrida: el código y el staging se
    # fijan antes de tocar cualquier entidad (los usan `filas`, `manifiesto` y
    # `resolver_contexto`).
    CODIGO_COMPANIA = argumentos.compania.strip()
    CODIGO_DESTINO = (argumentos.codigo_destino or "").strip() or None
    if argumentos.staging is not None:
        STAGING = argumentos.staging.resolve()

    if argumentos.listar:
        for indice, (nombre, descripcion, _) in enumerate(ENTIDADES, 1):
            print(f"{indice:>2}. {nombre:<16} {descripcion}")
        return 0

    seleccion = ENTIDADES
    if argumentos.entidad:
        seleccion = [e for e in ENTIDADES if e[0] == argumentos.entidad]
        if not seleccion:
            raise SystemExit(f"No existe la entidad {argumentos.entidad!r}.")
    elif argumentos.hasta:
        nombres = [e[0] for e in ENTIDADES]
        if argumentos.hasta not in nombres:
            raise SystemExit(f"No existe la entidad {argumentos.hasta!r}.")
        seleccion = ENTIDADES[: nombres.index(argumentos.hasta) + 1]

    inicio = time.monotonic()
    with psycopg.connect(argumentos.url) as conexion:
        carga = Carga(conexion, argumentos.simulacion, argumentos.cabecera_sintetica,
                      argumentos.tolerar_conciliacion)
        if argumentos.simulacion:
            print("SIMULACIÓN: no se escribe nada.")
        else:
            if not argumentos.permitir_base_sucia:
                # Se detecta el seed de demostración por su compañía, no por «hay
                # algo»: así repetir sobre una base ya cargada sigue permitido, que
                # es justo la propiedad que buscamos.
                with conexion.cursor() as cur:
                    cur.execute("SELECT codigo FROM companias WHERE codigo <> %s AND nit LIKE '900.%%'",
                                (codigo_destino(),))
                    demo = [fila[0] for fila in cur.fetchall()]
                if demo:
                    raise SystemExit(
                        f"La base tiene datos de demostración (compañía{'s' if len(demo) > 1 else ''} "
                        f"{', '.join(demo)}): el cargue no debe mezclarse con el seed.\n"
                        "  · Carga en una base sin seed: ver cargador/README.md.\n"
                        "  · Para forzarlo: --permitir-base-sucia")
            carga.abrir_ejecucion()
            print(f"Ejecución de migración #{carga.ejecucion_id}")
        # Si no se va a cargar «companias», el contexto se lee de la base: así una
        # entidad suelta puede ejecutarse sola.
        if "companias" not in [entidad for entidad, _, _ in seleccion]:
            carga.resolver_contexto()
        nombre = ""
        try:
            for nombre, descripcion, funcion in seleccion:
                print(f"\n== {nombre} — {descripcion}", flush=True)
                with transaccion(carga):
                    funcion(carga)
        except Exception as error:
            carga.cerrar_ejecucion("Fallida")
            raise SystemExit(f"Falló «{nombre}»: {type(error).__name__}: {error}")
        carga.cerrar_ejecucion("Completada")

    carga.resumen()
    print(f"\nTerminado en {time.monotonic() - inicio:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
