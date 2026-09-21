"""Genera `db/migration/06_referencia_campos.md` desde el contrato.

La referencia Advantage → PostgreSQL **no se escribe a mano**: se renderiza desde
`contrato_campos.json`, que a su vez sale de `reglas.py`. Así el documento no
puede afirmar un destino que el contrato ya no declara.

Uso:
    python db/migration/homologacion/generar_referencia.py [--json entrada.json] [--out salida.md]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MIGRATION_DIR = HERE.parent
CONTRATO = HERE / "contrato_campos.json"
SALIDA = MIGRATION_DIR / "06_referencia_campos.md"

sys.path.insert(0, str(HERE))

import reglas  # necesita el path insertado arriba

# Tablas del piloto del núcleo contable. El resto son acumulados que el destino
# reconstruye, la réplica comercial, datos comerciales o infraestructura de ADS.
PILOTO = (
    "CONEMP", "CONPUC", "CONCTR", "CONMAE", "CONCECOS", "CONTICOM",
    "CONMOVI", "CONDOCUM", "MOV00", "MOV01", "FADCLI", "VISDOCUM", "CONLOTES",
)

# Tablas con datos reales que no entran al núcleo contable, resumidas en §5.
FUERA_DEL_NUCLEO = ("TIDSAL", "COCENTRO", "CONTERCE", "TIDEAN")

# Tablas internas del motor, descartadas: no son maestros del negocio.
INTERNAS_ADS = ("CATALOGO2", "P_A_100_50", "P_A_102_50")

# Decisiones de PENDIENTES.md que afectan a cada tabla, para cruzarlas en el texto.
DECISIONES = {
    "CONEMP": "D-CONEMP-1",
    "CONPUC": "D-CONPUC-1",
    "CONCTR": "D-CONCTR-1…4",
    "CONMAE": "D-CONMAE-1…8",
    "CONCECOS": "D-CONCECOS-1",
    "CONTICOM": "D-CONTICOM-1",
    "CONMOVI": "D-CONMOVI-1…2",
    "CONDOCUM": "D-CONDOCUM-1…2",
    "MOV00": "D-MOV-1…6",
    "FADCLI": "D-FADCLI-1…3",
    "VISDOCUM": "D-VISDOCUM-1…3",
}

# Clases cuyo destino ya está decidido: todas menos `pendiente`. Las `pendiente` no
# pueden aparecer en un mapa de tablas porque su destino es todavía una propuesta.
CLASES_ASENTADAS = tuple(clase for clase in reglas.CLASES if clase != reglas.PENDIENTE)

# Descripción funcional de cada tabla origen, tomada de
# old_db/ESQUEMA_DEPURADO_CONTABDSI.md (la columna «Función»).
DESCRIPCION_ORIGEN = {
    "CONEMP": "Catálogo de contabilidades/empresas.",
    "CONCTR": "Parámetros de operación y configuración histórica de la empresa.",
    "CONPUC": "Catálogo base del plan de cuentas.",
    "CONMAE": "Cuentas, reglas de captura y acumulados generales/por tercero.",
    "VISDOCUM": "Tipos documentales, consecutivos y reglas de integración.",
    "CONTICOM": "Tipos de comprobante contable.",
    "CONDOCUM": "Cabeceras de documentos contabilizados.",
    "CONMOVI": "Registro maestro de lotes.",
    "MOV00": "Detalle contable por período (MOV00 a MOV18).",
    "MOV01": "Detalle contable por período (MOV00 a MOV18).",
    "FADCLI": "Terceros; estructura compartida con otros módulos y variante local.",
    "CONCECOS": "Catálogo y parametrización de centros de costo.",
    "CONLOTES": "Plantilla de lote (la «MC<lote>» del inventario): grilla editable del lote.",
    "TIDEAN": "Datos de artículo/nombre/cantidad/venta: inventario y venta, no contabilidad.",
    "COCENTRO": "Acumulados por cuenta, centro y tercero.",
    "CONTERCE": "Acumulados auxiliares por cuenta/tercero/centro.",
    "TIDSAL": "Actualización de información comercial replicada por REPLI_METC.",
}

# Qué papel juega cada tabla destino (y de dónde salen sus datos).
DESCRIPCION_DESTINO = {
    "companias": "Empresas. Código, nombre, NIT + dígito, estado.",
    "compania_anios": "Años en que cada compañía opera.",
    "periodos_contables": "Un registro por compañía/año/período con su estado (Abierto/Cerrado).",
    "parametros_operacion": "Parámetros por compañía y año: leyendas, fechas, documentos, comprobantes de nómina.",
    "parametros_nomina": "Los 3 pares comprobante/documento (nómina, aportes, provisiones).",
    "cuentas": "Plan de cuentas con sus reglas de captura.",
    "saldos_cuenta": "Saldo por compañía/año/período/cuenta, incluidos los períodos 00 y 13..18.",
    "terceros": "Identidad del tercero: NIT, dígito, nombre, contacto, estado, cupo.",
    "tercero_cuentas_bancarias": "Cuentas bancarias del tercero (una fila por cuenta).",
    "centros_costos": "Centros de costo y su jerarquía.",
    "comprobantes": "Tipos de comprobante contable.",
    "tipos_documento": "Tipos documentales, su numeración y su consecutivo.",
    "plantillas_contables": "Plantilla contable de un tipo documental.",
    "plantilla_lineas": "Cada renglón de la plantilla, con su cuenta débito y crédito (DEBnn/CREnn).",
    "tarifas_iva": "Tarifas de IVA del tipo documental.",
    "conceptos_retencion": "Conceptos y tarifas de retención del tipo documental.",
    "lotes": "Lotes de contabilización.",
    "documentos": "Cabecera de cada documento contabilizado (el libro).",
    "documento_lineas": "Cada renglón del libro mayor: cuenta, tercero, centro, débito/crédito.",
    "integraciones": "Estado de la réplica con otros módulos (marcador para TIDSAL).",
    "acumulados_centro": "Se reconstruye desde documento_lineas (no se carga).",
    "acumulados_tercero": "Se reconstruye desde documento_lineas (no se carga).",
    "migracion_filas": "Trazabilidad del cargador: valores originales crudos, resultado y motivo.",
    "formatos_exogenos": "Formatos de información exógena.",
    "formato_conceptos": "Conceptos de un formato exógeno.",
    "formato_asignaciones": "Cuentas asignadas a un formato exógeno.",
    "formato_elementos": "Elementos/plantilla de impresión del formato.",
}

# Reglas de transformación que más se equivocan (02_consideraciones_previas.md §4),
# con el campo del legado que las ejemplifica.
TRAMPAS = [
    ("Signo del valor",
     "`TVALOR` > 0 → débito; `TVALOR` < 0 → crédito = `-TVALOR` (`MOVICON.prg:6581-6583`)",
     "Conservar el original y las anomalías/ceros en staging; **nunca** perder el signo ni truncar."),
    ("Columnas mensuales",
     "`MACMDEB01..18` / `MACMCRE01..18` se despivotan a una fila por período",
     "**No perder los períodos `00` y `13..18`**: el destino los admite y el saldo no cuadra sin ellos."),
    ("Saldo de apertura",
     "`MSALDO` y `MACMDEB00`/`MACMCRE00` pueden ser el mismo dato",
     "Cargar el período `00` desde `MACM*00`; usar `MSALDO` sólo si `00` viene vacío (T11)."),
    ("Porcentajes",
     "`19` → `0.19` en el dominio de fracción",
     "No dividir dos veces un dato que ya venga como fracción."),
    ("Fechas",
     "Numéricas `AAAAMMDD` (`TFECHA`, `TFECDOC`, `DFECHA`, `CFCHCREA`) o texto → `date`",
     "Blancos, cero o inválidas a cuarentena con motivo; **jamás** sustituir por la fecha de hoy."),
    ("Códigos y NIT",
     "Texto, con ceros iniciales y valor original",
     "Normalizar con tabla de equivalencias (patrón → id), no con sustituciones irreversibles."),
    ("Tercero sin auxiliar",
     "`NITN` de 15 espacios **o** NULL equivale al NIT matriz",
     "Es la regla que ya usa el backend hoy; no inventar un tercero genérico."),
    ("Códigos que parecen importes",
     "`VISDOCUM.DEB01..09` / `CRE01..09` son **cuentas**, no débitos/créditos",
     "Error de interpretación frecuente: van a `plantilla_lineas`, no a importes."),
    ("Clasificación",
     "`CONMAE.CTCTABASE` **no** es `cuenta_base_id`",
     "Va a `cuentas.clasificacion_corriente` (corriente / no corriente)."),
    ("Importes",
     "`numeric(18,2)` puede redondear",
     "Conservar el valor original y registrar cada diferencia aprobada en `migracion_ajustes`."),
]


def celda(texto: object) -> str:
    """Texto seguro para una celda de tabla markdown (sin saltos ni pipes crudos)."""
    return str(texto).replace("|", "\\|").replace("\n", " ").strip()


def tipo(campo: dict) -> str:
    return f"{campo['tipo']}({campo['longitud']},{campo['decimales']})"


def tabla_de_campos(campos: list[dict]) -> list[str]:
    lineas = [
        "| # | Campo | Tipo | Clase | Destino PostgreSQL | Transformación |",
        "|---:|---|---|---|---|---|",
    ]
    for campo in campos:
        lineas.append(
            f"| {campo['orden']} | `{campo['campo']}` | {tipo(campo)} | `{campo['clase']}` "
            f"| {celda(campo['destino'])} | {celda(campo['transformacion']) or '—'} |"
        )
    return lineas


def descripcion_publica(tabla: dict) -> str:
    return DESCRIPCION_ORIGEN.get(tabla["tabla"], tabla["tabla"])


def destinos_asentados(campos: list[dict]) -> list[str]:
    """Tablas destino de los campos cuya decisión ya está tomada."""
    return sorted({
        campo["destino"].split(".")[0].strip()
        for campo in campos
        if campo["clase"] in CLASES_ASENTADAS and campo["destino"] not in ("", "—")
    })


def pendientes_de(campos: list[dict]) -> int:
    return sum(1 for campo in campos if campo["clase"] == reglas.PENDIENTE)


def clases(campos: list[dict]) -> dict[str, int]:
    conteo: dict[str, int] = {}
    for campo in campos:
        conteo[campo["clase"]] = conteo.get(campo["clase"], 0) + 1
    return dict(sorted(conteo.items()))


def generar(contrato: dict) -> str:
    tablas = contrato["tablas"]
    resumen = contrato["resumen"]
    con_catalogo = [t for t in tablas if t.get("campos")]

    lineas: list[str] = []
    add = lineas.append

    total = resumen["campos"]
    add("# Referencia de campos: Advantage → PostgreSQL")
    add("")
    add("<!-- GENERADO por db/migration/homologacion/generar_referencia.py -->")
    add("<!-- No editar a mano: el destino de cada campo vive en homologacion/reglas.py -->")
    add("")
    add("Referencia **campo a campo del modelo Advantage al modelo PostgreSQL**: de dónde sale")
    add("cada dato, a dónde va y qué hay que hacerle antes de cargarlo.")
    add("")
    pilotos = [t for t in tablas if t["tabla"] in PILOTO]
    add(f"El catálogo real de la copia tiene **{len(tablas)} tablas** y **{total} campos** (leídos")
    add("de `PUBLIDATA.add`, no del inventario de `old_db/`). De ellos, los **"
        f"{sum(len(t['campos']) for t in pilotos)}** de las **{len(pilotos)} tablas del piloto**")
    add("del núcleo contable están en detalle en §4; el resto se resume en §5–§6.")
    add("")
    add("```bash")
    add("python db/migration/homologacion/generar_referencia.py   # regenerar este documento")
    add("python db/migration/homologacion/contrato_campos.py      # auditar que no haya campos sin decisión")
    add("```")
    add("")
    add("La **decisión** de cada campo está en [`homologacion/reglas.py`](homologacion/reglas.py)")
    add("y el detalle legible por máquina en")
    add("[`homologacion/contrato_campos.json`](homologacion/contrato_campos.json). Este documento es")
    add("la vista humana de esos dos: si hay una discrepancia, mandan ellos.")
    add("")

    # ── 1. Cómo leerlo ────────────────────────────────────────────────
    add("## 1. Cómo leer las clases")
    add("")
    add("| Clase | Qué significa para el cargador |")
    add("|---|---|")
    descripcion_clase = {
        reglas.DIRECTO: "Copia 1:1 a la columna indicada, con el saneo que diga la transformación.",
        reglas.CATALOGO: "Alimenta una tabla catálogo (cuentas, terceros, tipos, comprobantes).",
        reglas.DESPIVOT: "Una columna del legado se convierte en **varias filas** destino (una por período).",
        reglas.DERIVADO: "No se copia: se calcula, se descompone o se resuelve una clave foránea.",
        reglas.PROCEDENCIA: "Sin semántica acreditada: se guarda **crudo** en `migracion_filas.valores_originales` con su motivo. No se le inventa columna.",
        reglas.PENDIENTE: "**Requiere decisión** antes de cargar. Ver [`homologacion/PENDIENTES.md`](homologacion/PENDIENTES.md).",
        reglas.FUERA_NUCLEO: "Dato real sin destino en el núcleo contable (pertenece a otro módulo).",
        reglas.DESCARTADO: "No se migra, y la transformación dice por qué.",
    }
    for clase in reglas.CLASES:
        add(f"| `{clase}` | {descripcion_clase.get(clase, '')} |")
    add("")
    add("El contrato cubre todos los campos del catálogo real. Los del piloto, en detalle:")
    add("")
    add("| Clase | Campos |")
    add("|---|---:|")
    piloto_por_clase: dict[str, int] = {}
    for tabla in pilotos:
        for campo in tabla["campos"]:
            piloto_por_clase[campo["clase"]] = piloto_por_clase.get(campo["clase"], 0) + 1
    for clase in reglas.CLASES:
        if piloto_por_clase.get(clase):
            add(f"| `{clase}` | {piloto_por_clase[clase]} |")
    add(f"| **Total** | **{sum(piloto_por_clase.values())}** |")
    add("")

    # ── 2. Mapa de tablas ─────────────────────────────────────────────
    add("## 2. Mapa de tablas")
    add("")
    add("Sólo aparecen los destinos **ya decididos**: los campos `pendiente` todavía no tienen")
    add("destino firme, así que se cuentan aparte.")
    add("")
    add("| Tabla Advantage | Campos | Descripción del origen | Tablas PostgreSQL destino | Por decidir |")
    add("|---|---:|---|---|---:|")
    for t in con_catalogo:
        destinos = destinos_asentados(t["campos"])
        nombres = ", ".join(f"`{d}`" for d in destinos) or "—"
        pendientes = pendientes_de(t["campos"])
        add(f"| `{t['tabla']}` | {len(t['campos'])} | {descripcion_publica(t)} | {nombres} "
            f"| {pendientes or '—'} |")
    add("")
    add("### Para qué sirve cada tabla destino")
    add("")
    add("| Tabla PostgreSQL | Papel |")
    add("|---|---|")
    for nombre, papel in DESCRIPCION_DESTINO.items():
        add(f"| `{nombre}` | {papel} |")
    add("")

    # ── 3. Trampas ────────────────────────────────────────────────────
    add("## 3. Transformaciones que más se equivocan")
    add("")
    add("Estas nueve reglas atraviesan varias tablas: si una se aplica mal, el error es")
    add("silencioso y cuadra mal. Están detalladas en")
    add("[`02_consideraciones_previas.md`](02_consideraciones_previas.md) §4.")
    add("")
    add("| Tema | Regla | Trampa documentada |")
    add("|---|---|---|")
    for tema, regla, trampa in TRAMPAS:
        add(f"| {tema} | {regla} | {trampa} |")
    add("")

    # ── 4. Referencia campo a campo ───────────────────────────────────
    add("## 4. Referencia campo a campo")
    add("")
    add("Cada tabla del piloto, en el **orden físico** del registro (que es el orden en que")
    add("hay que decodificar si algún día se lee sin motor). `#` es la posición del campo")
    add("dentro del registro.")
    add("")

    # MOV00/MOV01 comparten estructura: se fusionan sólo si son idénticas.
    mov00 = next((t for t in con_catalogo if t["tabla"] == "MOV00"), None)
    mov01 = next((t for t in con_catalogo if t["tabla"] == "MOV01"), None)
    fusionar_mov = bool(
        mov00 and mov01
        and [(c["campo"], c["tipo"], c["longitud"], c["clase"], c["destino"]) for c in mov00["campos"]]
        == [(c["campo"], c["tipo"], c["longitud"], c["clase"], c["destino"]) for c in mov01["campos"]]
    )
    omitidas = {"MOV01"} if fusionar_mov else set()

    for t in con_catalogo:
        if t["tabla"] not in PILOTO and t["tabla"] != "MOV00":
            continue
        if t["tabla"] in omitidas:
            continue
        campos = t["campos"]
        conteo = clases(campos)
        titulo = f"`{t['tabla']}`"
        if t["tabla"] == "MOV00" and fusionar_mov:
            titulo = "`MOV00` / `MOV01` (estructura idéntica)"
        destinos = ", ".join(destinos_asentados(campos)) or "—"
        add(f"### {titulo} → {destinos}")
        add("")
        add(f"**Origen:** {descripcion_publica(t)}")
        add("")
        add(f"- Archivo del legado: `ADD_CONTAB/{t['ruta']}`")
        add(f"- {len(campos)} campos · {t['largo_registro']} bytes de registro"
            + (f" · {t['campos_inventario']} en el inventario viejo" if t.get("campos_inventario") else ""))
        add("- Clases: " + " · ".join(f"`{c}` {n}" for c, n in conteo.items()))
        pendientes = pendientes_de(campos)
        if pendientes:
            add(f"- **{pendientes} campos por decidir** → "
                f"[`PENDIENTES.md`](homologacion/PENDIENTES.md) {DECISIONES.get(t['tabla'], '')}")
        add("")
        add("\n".join(tabla_de_campos(campos)))
        add("")

    # ── 5. Fuera del núcleo ──────────────────────────────────────
    add("## 5. Tablas fuera del núcleo (resumidas)")
    add("")
    add("Tienen datos reales pero **no se cargan al núcleo contable**: son acumulados")
    add("que el destino reconstruye, la réplica comercial, o datos de inventario y venta.")
    add("No se enumeran campo a campo; el detalle está en `reglas.py`.")
    add("")
    add("| Tabla | Campos | Clase | Destino | Por qué |")
    add("|---|---:|---|---|---|")
    for t in tablas:
        if t["tabla"] not in FUERA_DEL_NUCLEO:
            continue
        conteo = clases(t["campos"])
        clase = max(conteo, key=lambda c: conteo[c])
        destino = ", ".join(destinos_asentados(t["campos"])) or "—"
        nota = next((c["transformacion"] for c in t["campos"] if c["clase"] == clase), "")
        add(f"| `{t['tabla']}` | {len(t['campos'])} | `{clase}` | {celda(destino)} | {celda(nota)} |")
    add("")

    # ── 6. Internas de ADS ───────────────────────────────────────
    add("## 6. Tablas internas de Advantage (descartadas)")
    add("")
    add("El diccionario real trae tres tablas que **no son maestros del negocio** sino el")
    add("registro interno de transacciones/replicación del motor (`TXNID`, `ENTRYID`,")
    add("`RECORDDATA`, `BLOBDATA`, `CRC`, `ERRORINFO`). Están **vacías** en esta copia y no")
    add("tienen equivalente en el destino: sus 51 campos van a `descartado`.")
    add("")
    for t in tablas:
        if t["tabla"] in INTERNAS_ADS:
            add(f"- `{t['tabla_diccionario']}` — {len(t['campos'])} campos")
    add("")

    # ── 7. Procedencia y descartes ────────────────────────────────────
    procedencia = [
        (t["tabla"], c["campo"], c["destino"], c["transformacion"])
        for t in con_catalogo for c in t["campos"] if c["clase"] == reglas.PROCEDENCIA
    ]
    descartados = [
        (t["tabla"], c["campo"], c["transformacion"])
        for t in con_catalogo for c in t["campos"] if c["clase"] == reglas.DESCARTADO
    ]
    add("## 7. Campos sin destino tipado (se preservan crudos)")
    add("")
    add("No llevan columna de negocio y **no hace falta que la tengan**: su renglón completo")
    add("queda en `migracion_filas.valores_originales` (jsonb), con el motivo escrito.")
    add("")
    add("| Tabla | Campo | Destino | Motivo |")
    add("|---|---|---|---|")
    for tabla, campo, destino, motivo in procedencia:
        add(f"| `{tabla}` | `{campo}` | {celda(destino)} | {celda(motivo)} |")
    add("")
    add("## 8. Campos descartados")
    add("")
    add("| Tabla | Campo | Motivo |")
    add("|---|---|---|")
    for tabla, campo, motivo in descartados:
        add(f"| `{tabla}` | `{campo}` | {celda(motivo) or '—'} |")
    add("")

    # ── 8. Pendientes ─────────────────────────────────────────────────
    add("## 9. Decisiones pendientes")
    add("")
    add("Los campos marcados `pendiente` **no se pueden cargar** hasta cerrar su decisión.")
    add("Están agrupados por familia en")
    add("[`homologacion/PENDIENTES.md`](homologacion/PENDIENTES.md), con la evidencia y una")
    add("propuesta por defecto.")
    add("")
    add("| Tabla | Campos pendientes |")
    add("|---|---:|")
    for t in con_catalogo:
        n = sum(1 for c in t["campos"] if c["clase"] == reglas.PENDIENTE)
        if n:
            add(f"| `{t['tabla']}` | {n} |")
    add("")
    add("## 10. Qué falta en el esquema destino")
    add("")
    add("El contrato se aplicó contra el esquema real y sólo exigió dos cosas, ambas ya")
    add("incorporadas y verificadas desde base vacía:")
    add("")
    add("| Añadido | Campos que lo necesitan |")
    add("|---|---|")
    add("| `db/postgresql/schema/12_migracion.sql` (5 tablas) | Todo `procedencia`, más el contrato del cargador del §4 del plan |")
    add("| `cuentas.clasificacion_corriente` | `CONMAE.CTCTABASE` |")
    add("")

    return "\n".join(lineas) + "\n"


def main(argv: list[str]) -> int:
    entrada = Path(argv[argv.index("--json") + 1]) if "--json" in argv else CONTRATO
    salida = Path(argv[argv.index("--out") + 1]) if "--out" in argv else SALIDA
    contrato = json.loads(entrada.read_text(encoding="utf-8"))
    salida.write_text(generar(contrato), encoding="utf-8")
    print(f"Referencia escrita en {salida} ({len(salida.read_text(encoding='utf-8').splitlines())} líneas)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
