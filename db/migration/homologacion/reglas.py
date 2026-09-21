"""Contrato curado campo → destino de las tablas del piloto.

Es la pieza que faltaba del **paso 1** del plan de carga: convierte los 791
campos físicos de `ADD_CONTAB/` en un contrato con una decisión explícita por
campo, agrupada por regla en vez de campo por campo.

Tres fuentes sostienen cada decisión, y ninguna se sustituye por intuición:

- `old_db/DICCIONARIO_DEPURADO_CONTABDSI.md` — el físico (orden, tipo, longitud).
- `old_db/HOMOLOGACION_CAMPOS.md` — el análisis previo: entidad candidata y
  transformación anotada.
- `old_db/ESQUEMA_DEPURADO_CONTABDSI.md` — la **descripción funcional** de cada
  tabla, que es la que permite decidir la semántica (p. ej. `CONMAE` es «cuentas,
  reglas de captura y acumulados», no un catálogo de terceros).

Las **clases** son el resultado, no el origen:

| clase | significado |
|---|---|
| `directo` | Copia 1:1 a la columna indicada. |
| `despivot` | Una fila destino por (clave, período) a partir de columnas mensuales. |
| `derivado` | Se calcula, se descompone o se resuelve una FK. |
| `catalogo` | Alimenta una tabla catálogo (no un movimiento). |
| `procedencia` | No tiene semántica acreditada: se preserva crudo y trazable. |
| `pendiente` | Requiere decisión: hay evidencia parcial pero falta confirmar. |
| `fuera_nucleo` | Dato real sin destino en el núcleo contable (módulo externo). |
| `descartado` | No se migra, y se explica por qué. |

**`pendiente` no es un cajón de sastre**: cada campo así marcado entra a
`PENDIENTES.md` con la pregunta concreta que lo desbloquea.

Uso (lo consume `contrato_campos.py`):

    from reglas import resolver
    destino = resolver("MOV00", "TVALOR")
"""

from __future__ import annotations

import re
from dataclasses import dataclass

DIRECTO = "directo"
DESPIVOT = "despivot"
DERIVADO = "derivado"
CATALOGO = "catalogo"
PROCEDENCIA = "procedencia"
PENDIENTE = "pendiente"
FUERA_NUCLEO = "fuera_nucleo"
DESCARTADO = "descartado"

CLASES = (DIRECTO, DESPIVOT, DERIVADO, CATALOGO, PROCEDENCIA, PENDIENTE, FUERA_NUCLEO, DESCARTADO)


@dataclass(frozen=True)
class Regla:
    tabla: str
    patron: str
    clase: str
    destino: str
    transformacion: str = ""
    _compiled: re.Pattern[str] | None = None

    def aplica(self, campo: str) -> bool:
        if self._compiled is None:
            object.__setattr__(self, "_compiled", re.compile(self.patron))
        assert self._compiled is not None
        return self._compiled.fullmatch(campo) is not None


def _r(tabla: str, patron: str, clase: str, destino: str, transformacion: str = "") -> Regla:
    return Regla(tabla, patron, clase, destino, transformacion)


def _alt(*campos: str) -> str:
    """Regex de alternancia exacta para listas de nombres de campo."""
    return "^(" + "|".join(re.escape(campo) for campo in campos) + ")$"


# ---------------------------------------------------------------------------
# Reglas universales — el «ajuste» de la copia
# ---------------------------------------------------------------------------
# Estas van **primero**: aplican a todas las tablas, incluidas las que tienen una
# regla comodín al final. Son los campos que el ajuste para varias contabilidades
# añadió a las tablas de datos.
REGLAS: list[Regla] = [
    _r("*", "^ID$", PROCEDENCIA, "migracion_filas.localizador",
       "Autoincremental del legado. No es un dato de negocio: es el mejor localizador "
       "de la fila en la instantánea."),
    _r("*", "^CIA$|^CONCIA$", DERIVADO, "companias.codigo → compania_id, compania_anios.anio",
       "Código de contabilidad del registro. En esta copia es constante '27'. "
       "Es la dimensión que el destino no tenía (P-1)."),
    _r("*", "^CONANO$", DERIVADO, "documentos.anio",
       "Año de la contabilidad del registro, guardado como double. Ya no hay que "
       "inferirlo del archivo (P-3)."),
    _r("*", "^CONMES$", DERIVADO, "documentos.periodo",
       "Período del registro, guardado como double → texto '01'..'12'."),
]

# ---------------------------------------------------------------------------
# Tablas fuera del núcleo
# ---------------------------------------------------------------------------
REGLAS += [
    # CONEMP es «catálogo de contabilidades/empresas» y COCENTRO/CONTERCE son
    # acumulados que el destino **reconstruye** (regenerar_acumulados), no carga.
    # TIDSAL es la réplica comercial (REPLI_METC), sin equivalente contable.
    _r("TIDSAL", ".*", FUERA_NUCLEO, "integraciones",
       "Réplica comercial de 273 campos. Sólo interesa si se migra el módulo comercial; "
       "en el núcleo no hay destino por campo."),
    _r("COCENTRO", ".*", FUERA_NUCLEO, "acumulados_centro",
       "Acumulados cuenta/centro: se reconstruyen desde documento_lineas, no se cargan."),
    _r("CONTERCE", ".*", FUERA_NUCLEO, "acumulados_tercero",
       "Acumulados cuenta/tercero/centro: se reconstruyen, no se cargan."),
]

# ---------------------------------------------------------------------------
# CONEMP — compañías (6 campos)
# ---------------------------------------------------------------------------
REGLAS += [
    _r("CONEMP", "^EMPCOD$", DIRECTO, "companias.codigo",
       "TRIM y verificar unicidad; conservar el código de contabilidad tal cual."),
    _r("CONEMP", "^EMPNOM$", DIRECTO, "companias.nombre"),
    _r("CONEMP", "^EMPNIT$", DERIVADO, "companias.nit + companias.digito",
       "CHAR(12) = NIT + dígito de verificación: separar el último carácter. Sin dígito "
       "numérico -> companias.digito NULL y se reporta la fila."),
    _r("CONEMP", "^EMPCLAV$", DESCARTADO, "—",
       "Leído de la copia real: guarda el **año** de la contabilidad (2006..2025), no un "
       "secreto. Se descarta porque el año ya viene en EMPNOM y en compania_anios."),
    _r("CONEMP", "^REASIGNA$", PROCEDENCIA, "migracion_filas",
       "Habilita la reasignación de códigos (CONREASIG, CONTAGRAL.PRG:497). La interfaz no "
       "expone ninguna función de reasignación, así que no se modela: se conserva."),
    _r("CONEMP", "^HABILITA$", DERIVADO, "companias.estado",
       "'T' -> 'Activa', 'F' -> 'Inactiva'."),
]

# ---------------------------------------------------------------------------
# CONPUC — catálogo base del plan de cuentas (3 campos)
# ---------------------------------------------------------------------------
REGLAS += [
    _r("CONPUC", "^CODIGO$", CATALOGO, "cuentas.codigo", "Se complementa/contrasta con CONMAE."),
    _r("CONPUC", "^MNOMBRE$", CATALOGO, "cuentas.nombre"),
    _r("CONPUC", "^MFLAG$", PROCEDENCIA, "migracion_filas",
       "Bandera de 1 carácter sin semántica documentada y sin uso en la interfaz: se "
       "conserva en vez de inventarle un significado."),
]

# ---------------------------------------------------------------------------
# CONCTR — parámetros de operación (79 campos)
# ---------------------------------------------------------------------------
REGLAS += [
    _r("CONCTR", "^CTCIA$", DIRECTO, "parametros_operacion.nombre_empresa"),
    _r("CONCTR", "^CTNIT$", DIRECTO, "parametros_operacion.nit"),
    _r("CONCTR", "^CTCIUDAD$", DIRECTO, "parametros_operacion.ciudad"),
    _r("CONCTR", "^CTDIRECC$", DIRECTO, "parametros_operacion.direccion"),
    _r("CONCTR", "^CTDIREC$", DIRECTO, "parametros_operacion.directorio_contabilidad"),
    _r("CONCTR", "^CTFCHOY$", DERIVADO, "parametros_operacion.fecha_operativa",
       "YYYYMMDD entero -> date. Es la fecha «hoy» del cierre de la instantánea."),
    _r("CONCTR", "^CTVERDOC$", DERIVADO, "parametros_operacion.verifica_documentos_lotes"),
    _r("CONCTR", "^CTANO$", DERIVADO, "parametros_operacion.anio",
       "Año de operación vigente al extraer. El histórico por año sale de periodos_contables."),
    _r("CONCTR", "^CTDOCUM$", DIRECTO, "parametros_operacion.documento"),
    _r("CONCTR", "^CTLEY2$", DIRECTO, "parametros_operacion.leyenda2"),
    _r("CONCTR", "^CTUTERCE$|^CTTERDOC$", DERIVADO,
       "parametros_operacion.terceros_documentos_propios",
       "Dos banderas para un solo destino: confirmar cuál manda y si son excluyentes."),
    _r("CONCTR", "^CT(00|01|02|03|04|05|06|07|08|09|10|11|12)$", DESPIVOT,
       "parametros_operacion.periodos_habilitados (jsonb)",
       "Doce banderas -> lista de períodos habilitados. Conciliar con periodos_contables: "
       "una sola fuente de estado."),
    _r("CONCTR", "^CTCOMNOM([123])$", DERIVADO,
       "parametros_nomina.comprobante_{nomina|aportes|provisiones}",
       "Código -> comprobantes.codigo. Los 3 pares los usa CONCARG9_NOM "
       "(MOVICON.prg:95); confirmar el orden 1=nómina, 2=aportes, 3=provisiones."),
    _r("CONCTR", "^CTDOCNOM([123])$", DERIVADO,
       "parametros_nomina.documento_{nomina|aportes|provisiones}",
       "Igual que CTCOMNOMn: el documento por defecto de cada cargue."),
    _r("CONCTR", "^CTCLAVE1$", DIRECTO, "parametros_operacion.contabilidad_conciliacion",
       "Verificado contra la interfaz: `contabilidadConciliacion` se mapea a CTCLAVE1. **No es "
       "una clave de acceso** — el nombre engaña y la primera versión de este contrato la "
       "descartó por error."),
_r("CONCTR", "^CTPUC$", DERIVADO, "parametros_operacion.controla_usuario_lotes",
       "La interfaz lo expone como `controlaUsuarioLotes` ('1' / ' ' → booleano)."),
_r("CONCTR", "^CTLEY1$", DIRECTO, "parametros_operacion.comentario_certificado",
       "La interfaz lo expone como `comentarioCertificado`."),
_r("CONCTR", "^CTCODCIA$", DERIVADO, "companias.id",
       "Identificador interno de la contabilidad, de sólo lectura en la interfaz "
       "(`codigoInterno`). Es la forma numérica de `CONEMP.EMPCOD`: resuelve P-2."),
    _r("CONCTR", "^CT(CLOR[1-4]|SONIDO|DOS|DDOS|RED|CODCIA|FCINIP|FCFINP|FSIS|LLAVE|VALDOL|CTARES"
                  "|NORMAL|COMPRI|DOBLE|CTAEL|MEM|COPYCIE|COPYACT|LEY3|LEY4|TNIT|INIS|BLOFCH"
                  "|SUBCU|TOBS|CORTE|CXP|NIVEL|MESES|VERTIPO|CONTROL|CODCIU|ORDENL|ENIIF|LINCER"
                  "|CLAVE|CLAVE2)$|^COMESES$", PROCEDENCIA, "parametros_operacion.legado",
           "Parámetros de operación que **ninguna funcionalidad implementada consume**: los "
           "documentos de `docs/` sólo citan `CTANO` y los períodos `CT00..CT12`, y la interfaz "
           "sólo lee 13 campos de `CONCTR`. Se conservan **completos** en una columna `jsonb` "
           "del destino en vez de descartarlos o inventar 30 columnas que nadie lee."),
    _r("CONCTR", "^CT(PASS|PASSW|SUPER)$", DESCARTADO, "—",
           "Claves de acceso heredadas. No se migran secretos."),
]

# ---------------------------------------------------------------------------
# CONMAE — cuentas, reglas de captura y acumulados (127 campos)
# ---------------------------------------------------------------------------
REGLAS += [
    _r("CONMAE", "^CODIGO$", CATALOGO, "cuentas.codigo"),
    _r("CONMAE", "^MNOMBRE$", CATALOGO, "cuentas.nombre"),
    _r("CONMAE", "^NIVEL$", DERIVADO, "cuentas.nivel",
       "Recomputar desde la longitud/código para no heredar un nivel inconsistente."),
    _r("CONMAE", "^MAJUSTE$", DIRECTO, "cuentas.ajuste"),
    _r("CONMAE", "^MCOSTOS$", DIRECTO, "cuentas.controla_centro"),
    _r("CONMAE", "^MBASER$", DIRECTO, "cuentas.controla_base"),
    _r("CONMAE", "^MDISTRICC$", DIRECTO, "cuentas.distribucion"),
    _r("CONMAE", "^MIVA_RET$", DERIVADO, "cuentas.clase_iva / cuentas.clase_retencion",
       "Un carácter para dos columnas: 'I' llena clase_iva, 'R' clase_retencion."),
    _r("CONMAE", "^PORIVARET$", DIRECTO, "cuentas.porcentaje"),
    _r("CONMAE", "^MSALDO$", DERIVADO, "cuentas.saldo_inicial",
       "Saldo del maestro legado. No sumarlo a saldos_cuenta (T11): el período '00' se "
       "recarga desde MACMDEB00/MACMCRE00 si existe, y si no, desde MSALDO."),
    _r("CONMAE", "^MACMDEB(\\d{2})$", DESPIVOT, "saldos_cuenta.debito",
       "Despivot de 18 columnas a filas (cuenta, período NN). Períodos '00' y '13'..'18' "
       "ya están admitidos por el destino."),
    _r("CONMAE", "^MACMCRE(\\d{2})$", DESPIVOT, "saldos_cuenta.credito",
       "Igual que MACMDEBnn. El destino reconstruye saldos_cuenta (regenerar_acumulados); "
       "esta carga es la instantánea inicial."),
    _r("CONMAE", "^NIT$|^NITN$|^GENERAL$|^CTACRUCE$", PROCEDENCIA, "migracion_filas",
       "Campos del maestro que la interfaz no declara en su tipo `Cuenta` (que sólo pide "
       "código, nombre, nivel, afectable, requiereTercero/Centro/Base, ajuste, clase de "
       "IVA y retención y saldo). Se conservan los originales en vez de inventar columnas."),
    _r("CONMAE", "^(FORMATO2?|CONCEPTO2?|TIPOMED|VALMED|RENGLON|SUMARES|COLBASE|COLIVA"
                  "|PMED[1-6]|COSTOI|COSTOF|MCOSABC|ESTRUABC|MCTAPAGOS|MTC|MCMOVI|SALE"
                  "|MAPLICAR|MODCXP|MSUBCTOS|EMPRESA|NEGOCIO|AREA|ECHOECO|MRECURSO|TIPONIIF"
                  "|TRANSFOR)$", PROCEDENCIA, "migracion_filas",
       "Bloque de exógena, distribución por centro, costeo ABC, dimensiones y metadatos NIIF: "
       "32 campos que **ninguna funcionalidad implementada consume** (la exógena y el costeo "
       "ABC no están entre las pantallas de `docs/` ni de la interfaz). Se conservan "
       "completos para que la base no pierda nada, sin inventar 32 columnas que nadie lee."),
    _r("CONMAE", "^REVELA$|^MBLOQUE$|^MNOMNIIF$", PROCEDENCIA, "migracion_filas",
       "Metadatos NIIF sin datos asociados: la copia no trae el bloque de acumulados NIIF."),
_r("CONMAE", "^CTCTABASE$", DIRECTO, "cuentas.clasificacion_corriente",
       "NO es cuenta_base_id (regla 4 de 02_consideraciones_previas.md): es la clase de "
       "cuenta en el estado de situación (corriente / no corriente)."),
]

# ---------------------------------------------------------------------------
# CONCECOS — centros de costo (12 campos)
# ---------------------------------------------------------------------------
REGLAS += [
    _r("CONCECOS", "^CODIGO$", CATALOGO, "centros_costos.codigo"),
    _r("CONCECOS", "^NOMBRE$", CATALOGO, "centros_costos.nombre"),
    _r("CONCECOS", "^HABILITA$", DERIVADO, "centros_costos.eliminado_en",
       "'F' -> eliminado_en con fecha de corte; 'T' -> NULL. El destino no tiene columna "
       "de estado propia para centros."),
    _r("CONCECOS", "^HIST$", DIRECTO, "centros_costos.hist"),
    _r("CONCECOS", "^TIPO$", DIRECTO, "centros_costos.tipo"),
    _r("CONCECOS", "^CARPETA$", DIRECTO, "centros_costos.carpeta"),
    # Los seis campos de distribución los usa la pantalla Centros de la interfaz:
    # `CentroJerarquico` (src/data/configCentros.ts) los declara uno por uno.
    _r("CONCECOS", "^VALOR$", DIRECTO, "centros_costos.valor", "`CentroJerarquico.valor`."),
    _r("CONCECOS", "^PORCEN$", DIRECTO, "centros_costos.porcentaje", "`CentroJerarquico.porcentaje`."),
    _r("CONCECOS", "^VLRPOR$", DIRECTO, "centros_costos.valor_porcentaje",
       "`CentroJerarquico.valorPorcentaje`."),
    _r("CONCECOS", "^CODITEM$", DIRECTO, "centros_costos.codigo_item", "`CentroJerarquico.codigoItem`."),
    _r("CONCECOS", "^CUENTA$", DERIVADO, "centros_costos.cuenta_id",
       "`CentroJerarquico.cuenta`: código → cuentas.id."),
    _r("CONCECOS", "^CONCEPTO$", DIRECTO, "centros_costos.concepto", "`CentroJerarquico.concepto`."),
]

# ---------------------------------------------------------------------------
# CONTICOM — tipos de comprobante (4 campos)
# ---------------------------------------------------------------------------
REGLAS += [
    _r("CONTICOM", "^CODIGO$", CATALOGO, "comprobantes.codigo"),
    _r("CONTICOM", "^NOMBRE$", CATALOGO, "comprobantes.nombre"),
    _r("CONTICOM", "^HIST$", PROCEDENCIA, "migracion_filas", "Marca histórica del comprobante."),
    _r("CONTICOM", "^CTABDES$", DIRECTO, "comprobantes.descripcion_auxiliar",
       "La interfaz lo expone como `descripcionAuxiliar` (src/api/comprobantes.ts)."),
]

# ---------------------------------------------------------------------------
# CONMOVI — lotes (14 campos)
# ---------------------------------------------------------------------------
REGLAS += [
    _r("CONMOVI", "^LOTE$", DIRECTO, "lotes.codigo"),
    _r("CONMOVI", "^NOMBRE$", DIRECTO, "lotes.nombre"),
    _r("CONMOVI", "^MES$", DIRECTO, "lotes.periodo"),
    _r("CONMOVI", "^ESTADO$", DERIVADO, "lotes.estado",
       "Código de 1 carácter -> estado del destino; requiere tabla de equivalencias "
       "explícita (Borrador/Aplicado/Anulado) validada con datos."),
    _r("CONMOVI", "^FECHA$", DIRECTO, "lotes.fecha"),
    _r("CONMOVI", "^USUA_I$", DERIVADO, "lotes.creado_por", "Iniciales -> usuarios.id."),
    _r("CONMOVI", "^HORA$", DERIVADO, "lotes.creado_en",
       "Hora de captura: combinar con FECHA para el timestamp de creación."),
    _r("CONMOVI", "^(DEBITOS|CREDITOS|ITEMS)$", DERIVADO, "—",
       "Controles de cuadre del lote: se recalculan al cargar y se concilian contra el "
       "original (T01/T02). No son columnas."),
    _r("CONMOVI", "^ARCHOK$", PROCEDENCIA, "migracion_filas",
       "Bandera de archivo generado; se conserva para trazabilidad."),
    _r("CONMOVI", "^(HIST)$", PROCEDENCIA, "migracion_filas", "Marca histórica del lote."),
    _r("CONMOVI", "^USUA_F$", DERIVADO, "lotes.actualizado_por",
           "Usuario final distinto del inicial: es el último que tocó el lote."),
    _r("CONMOVI", "^BORRAR$", PROCEDENCIA, "migracion_filas",
           "Lote borrado en el legado. `lotes` no tiene borrado lógico y la tabla está vacía: "
           "se conserva el original en vez de añadir una columna que nadie lee."),
]

# ---------------------------------------------------------------------------
# CONDOCUM — cabeceras de documentos (10 campos)
# ---------------------------------------------------------------------------
REGLAS += [
    _r("CONDOCUM", "^DDOCUM$", DIRECTO, "documentos.documento",
       "Se conserva tal cual, pero **no es único**: sobre las 735.976 cabeceras "
       "`(anio, documento)` colisiona 73.236 veces y ninguna combinación de columnas "
       "del legado lo hace único (con comprobante+tipo+fecha+valor aún colisiona "
       "29.059). Por eso `documentos_contabilizado_uk` excluye la historia migrada "
       "(D-CONDOCUM-3, db/migration/07_decisiones_del_libro.md)."),
    _r("CONDOCUM", "^DDETALLE$", DIRECTO, "documentos.concepto"),
    _r("CONDOCUM", "^DNIT$", DERIVADO, "documentos.tercero_id", "NIT -> terceros.id."),
    _r("CONDOCUM", "^DCOMPRO$", DERIVADO, "documentos.comprobante_id",
       "Código -> comprobantes.codigo (CONTICOM). Es obligatorio en el destino: las 214 "
       "cabeceras con DCOMPRO nulo o inexistente se rechazan con causa escrita."),
    _r("CONDOCUM", "^DTIPODOC$", DERIVADO, "documentos.tipo_documento_id",
       "Código -> tipos_documento.codigo (VISDOCUM)."),
    _r("CONDOCUM", "^DFECHA$", DERIVADO, "documentos.fecha", "YYYYMMDD entero -> date."),
    _r("CONDOCUM", "^DVALOR$", DERIVADO, "—",
       "Total de **débitos** del documento: coincide con la suma de MOVxx.TVALOR > 0 en "
       "121.216 de las 123.678 claves de una sola cabecera (98,0%). Sirve de evidencia "
       "para elegir cabecera cuando una clave tiene varias candidatas. No se carga como "
       "columna; la suma con signo de los renglones es cero por partida doble."),
    _r("CONDOCUM", "^DMODULO$", PROCEDENCIA, "migracion_filas",
       "Módulo de origen del documento; sin columna en documentos."),
    _r("CONDOCUM", "^DDOCUMI$", PROCEDENCIA, "migracion_filas",
           "Sin uso en `docs/` ni en la interfaz: se conserva el original."),
    _r("CONDOCUM", "^DDOCUM2$", PROCEDENCIA, "migracion_filas",
           "Documento alterno a nivel de cabecera. El equivalente por línea (`MOVxx.TDOCUM2`) "
           "sí se carga en `documento_lineas.documento_afectado`; este se conserva."),
]

# ---------------------------------------------------------------------------
# MOVxx — detalle contable (27 campos, MOV00..MOV18)
# ---------------------------------------------------------------------------
REGLAS += [
    _r("MOVxx", "^CODIGO$", DERIVADO, "documento_lineas.cuenta_id",
       "Código -> cuentas.id (por compañía). Exige CONMAE cargado antes."),
    _r("MOVxx", "^NIT$", DERIVADO, "documento_lineas.tercero_id",
       "NIT(15) -> terceros.id. Regla heredada: NITN de 15 espacios o NULL equivale al "
       "NIT matriz; no inventar tercero."),
    _r("MOVxx", "^NITN$", DIRECTO, "documento_lineas.nit_alterno",
       "Se conserva crudo, incluido el caso de 15 espacios, para no perder el original."),
    _r("MOVxx", "^TFECHA$", DERIVADO, "documentos.fecha",
       "YYYYMMDD entero -> date. Es la fecha del documento y agrupa las líneas."),
    _r("MOVxx", "^TFECDOC$", DERIVADO, "documento_lineas.fecha_documento",
       "YYYYMMDD entero -> date. Fecha del documento soporte, por línea."),
    _r("MOVxx", "^TCOMPR$", DERIVADO, "documentos.comprobante_id",
       "Código -> comprobantes.codigo."),
    _r("MOVxx", "^TIPODOC$", DERIVADO, "documentos.tipo_documento_id",
       "Código -> tipos_documento.codigo."),
    _r("MOVxx", "^TDOCUM$", DIRECTO, "documentos.documento",
       "Clave de agrupación del documento junto con TIPODOC + TCOMPR + TFECHA."),
    _r("MOVxx", "^TDOCUM2$", DIRECTO, "documento_lineas.documento_afectado"),
    _r("MOVxx", "^TDETALLE$", DIRECTO, "documento_lineas.concepto"),
    _r("MOVxx", "^TVALOR$", DERIVADO, "documento_lineas.debito + documento_lineas.credito",
       "Signo: TVALOR > 0 -> débito, TVALOR < 0 -> crédito = -TVALOR. TVALOR = 0 se "
       "conserva y se reporta (T12); prohibido truncar."),
    _r("MOVxx", "^TVALORUS$", DIRECTO, "documento_lineas.valor_moneda",
       "Valor en moneda alterna. El destino no guarda la moneda: si el origen la "
       "codifica en TCV, resolverlo (ver D-MOV-1)."),
    _r("MOVxx", "^TBASE$", DIRECTO, "documento_lineas.base"),
    _r("MOVxx", "^TFASE$", DERIVADO, "documento_lineas.centro_costo_id",
       "Código -> centros_costos.id. En MOVICON.prg se asigna desde WCCOSTO o "
       "XALIMES->CCOSTOS y se valida contra SPACE(2): puede venir vacío -> NULL."),
    _r("MOVxx", "^TARCHI$", DIRECTO, "documento_lineas.archivo_origen"),
    _r("MOVxx", "^TIVA_RET$", DERIVADO, "documento_lineas.clase",
       "Dominio real contado sobre las 5.048.937 filas: O 2.945.663, I 2.047.372, "
       "R 47.365, vacío 8.537. Se traduce I -> IVA, R -> Retencion, O -> Otro, "
       "vacío -> ''; cargar el carácter crudo violaba el CHECK de clase. No es el "
       "mismo dominio que CONMAE.MIVA_RET (Generado/Renta/vacío). Cierra D-MOV-2."),
    _r("MOVxx", "^TSEC$", DERIVADO, "documento_lineas.numero_linea",
       "Está vacía en las 5.048.937 filas, así que se numera con el orden físico de "
       "la instantánea (_archivo, _loc), que es el reemplazo previsto por el contrato."),
    _r("MOVxx", "^TDATE$|^TTIME$|^TUSUA$", DERIVADO, "documento_lineas.legado",
       "Usuario (y fecha y hora) de captura del legado. Medido: `TUSUA` trae valor en "
       "4.962.576 renglones; `TDATE` y `TTIME` están vacías. No puede ir a "
       "`documentos.creado_por`: esa columna es un id entero y por documento, y el legado "
       "guarda iniciales de texto por renglón. Se conserva crudo con su nombre físico."),
    _r("MOVxx", "^BORRAR$", PROCEDENCIA, "migracion_filas",
       "Renglón borrado en el legado: no se carga como movimiento y se conserva el "
       "original con su marca."),
    _r("MOVxx", "^TSALDO$", DERIVADO, "documento_lineas.legado",
       "Saldo corrido por renglón. Tiene valor en las 5.048.937 filas de `MOV00`+`MOV01`, "
       "y distinto de cero en 545.554 (contado, no supuesto). No se carga como columna: "
       "se recalcula y se concilia contra el original (etapa B de "
       "db/migration/08_plan_para_culminar.md) y el valor crudo se conserva en `legado`."),
    _r("MOVxx", "^(TINCON|TCV|TABMNIT|TESTADO|TSUBCTA)$", DESCARTADO, "—",
       "Contado en los datos: **vacíos en las 5.048.937 filas** de `MOV00`+`MOV01`. Son "
       "restos del físico sin uso en esta copia; no hay nada que migrar. Cierra D-MOV-1."),
]

# ---------------------------------------------------------------------------
# FADCLI — terceros (61 campos)
# ---------------------------------------------------------------------------
_IDENTIDAD_FADCLI = [
    ("CCODIGO", "terceros.codigo_legado", DIRECTO, ""),
    ("CNOMBRE", "terceros.nombre", DIRECTO, ""),
    ("CDIGITO", "terceros.digito", DIRECTO, ""),
    ("CDIREC", "terceros.direccion", DIRECTO, ""),
    ("CTELEF", "terceros.telefono", DIRECTO, ""),
    ("CCIUDAD", "terceros.ciudad", DIRECTO, "Nombre de ciudad; CCODCIU (código) queda pendiente."),
    ("CZONA", "terceros.zona", DIRECTO, ""),
    ("CEMAIL", "terceros.correo", DIRECTO, ""),
    ("CTIPOCLI", "terceros.tipo", DERIVADO, "Código numérico -> clase de tercero; requiere equivalencias."),
    ("CESTADO", "terceros.estado", DERIVADO, "Código -> estado; requiere equivalencias explícitas."),
    ("CMOTIVO", "terceros.motivo_bloqueo", DIRECTO, ""),
    ("CFCHCREA", "terceros.fecha_creacion", DERIVADO, "YYYYMMDD entero -> date."),
    ("CTIPDOC", "terceros.tipo_documento", DERIVADO, "Código -> tipo de identificación."),
    ("CCUPO", "terceros.cupo", DIRECTO, ""),
    ("BCOCTA", "tercero_cuentas_bancarias.numero", DERIVADO,
     "CHAR(60): puede traer varias cuentas concatenadas. Descomponer antes de cargar (D-FADCLI-1)."),
]
for _campo, _destino, _clase, _nota in _IDENTIDAD_FADCLI:
    REGLAS.append(_r("FADCLI", "^" + _campo + "$", _clase, _destino, _nota))

# Campos que la copia trae y el inventario no listaba, con destino claro:
# identidad del tercero que el modelo nuevo sí sabe dónde guardar.
REGLAS += [
    _r("FADCLI", "^CNIT$", DIRECTO, "terceros.nit",
       "El NIT de la ficha. En esta copia FADCLI sí lo trae, con su dígito en CDIGITO."),
    _r("FADCLI", "^CSEXO$", DIRECTO, "terceros.sexo"),
    _r("FADCLI", "^CSALDO$", DIRECTO, "terceros.saldo"),
    # Identidad que la interfaz web **exige** al crear un tercero: su `TerceroCreate`
    # pide nombreComercial, primer/segundo nombre, primer/segundo apellido y
    # código de ciudad. Por eso dejan de ser "fuera del núcleo" y se modelan.
    _r("FADCLI", "^CSOCIAL$", DIRECTO, "terceros.nombre_comercial",
       "La interfaz lo expone como `nombreComercial` al crear el tercero (D-FADCLI-2)."),
    _r("FADCLI", "^CNOM1$", DIRECTO, "terceros.primer_nombre",
       "`TerceroCreate.primerNombre`. No concatenar: es un componente de la identidad."),
    _r("FADCLI", "^CNOM2$", DIRECTO, "terceros.segundo_nombre", "`TerceroCreate.segundoNombre`."),
    _r("FADCLI", "^CAPE1$", DIRECTO, "terceros.primer_apellido", "`TerceroCreate.primerApellido`."),
    _r("FADCLI", "^CAPE2$", DIRECTO, "terceros.segundo_apellido", "`TerceroCreate.segundoApellido`."),
    _r("FADCLI", "^CCODCIU$", DIRECTO, "terceros.codigo_ciudad",
       "`TerceroCreate.codigoCiudad`. Es el código; `CCIUDAD` es el nombre descriptivo."),
    _r("FADCLI", "^NOVEDAD$", PROCEDENCIA, "migracion_filas",
       "Campo MEMO: en el registro sólo hay un puntero al `.adm`. Verificado que los "
       "126.009 punteros de esta copia son cero, así que está vacío en el origen; se "
       "marca como memo no resuelto en vez de fingir que el dato no existía."),
]

REGLAS += [
    _r("FADCLI", _alt("CPROFESION", "CDIROFI", "CTELOFI", "CCUMPLE", "CCONYUGE", "CPROFEC",
                      "CCUMPLEC", "CDIROFIC", "CTELOFIC", "CBLOQUE", "CRETEN", "CLISTA",
                      "CVENDED", "CPLAZO", "CLAT", "CLON", "CDIRCORRES", "CCELU",
                      "CEMAILFE", "CEMAILFB", "CBANMAIL", "CACTIVI", "CRETACTI"), PROCEDENCIA,
       "terceros.legado",
       "Datos personales, de contacto alterno y de crédito que **ninguna funcionalidad"
       "implementada consume**: los documentos de `docs/` sólo citan de FADCLI el código,"
       "NIT, nombre, dirección, teléfono, ciudad, estado, motivo, saldo, cupo y fecha, y la"
       "interfaz pide además los nombres/apellidos. Se conservan completos en `jsonb` para"
       "que la base quede lo más completa posible sin inventar columnas que nadie lee."),
    _r("FADCLI", ".*", FUERA_NUCLEO, "terceros.legado",
       "Atributos comerciales, de crédito, de contacto y de logística del módulo "
       "comercial (vendedor, listas, plazos y descuentos escalonados, mora, correos "
       "alternos, celular, carnet, semanas, banderas de módulo, códigos de actividad, "
       "parámetros de logística y de recaudo): 72 campos sin destino en el núcleo "
       "contable (D-FADCLI-3)."),
]

# ---------------------------------------------------------------------------
# VISDOCUM — tipos documentales, consecutivos y reglas de integración (69 campos)
# ---------------------------------------------------------------------------
REGLAS += [
    _r("VISDOCUM", "^CODIGO$", CATALOGO, "tipos_documento.codigo"),
    _r("VISDOCUM", "^NOMBRE$", CATALOGO, "tipos_documento.nombre"),
    _r("VISDOCUM", "^CONSE$", DERIVADO, "tipos_documento.consecutivo",
       "Consecutivo vigente al extraer; no debe renumerar el histórico (paso 9 del orden)."),
    _r("VISDOCUM", "^MODICONSE$", DERIVADO, "tipos_documento.numeracion",
       "Bandera -> 'Manual'/'Automática'. Confirmar la equivalencia."),
    _r("VISDOCUM", "^NIMP1$", DERIVADO, "tarifas_iva.nombre"),
    _r("VISDOCUM", "^IMP1$", DERIVADO, "tarifas_iva.tarifa"),
    _r("VISDOCUM", "^NRET([1-4])$", DERIVADO, "conceptos_retencion.nombre",
       "Cuatro retenciones -> cuatro conceptos de retención."),
    _r("VISDOCUM", "^RET([1-4])$", DERIVADO, "conceptos_retencion.tarifa",
       "Tarifa de la retención n; la cuenta sale de la parametrización contable."),
    _r("VISDOCUM", "^NOM(0[1-8])$", DESPIVOT, "plantilla_lineas.concepto",
       "Descripción del renglón n de la plantilla contable del tipo documental."),
    _r("VISDOCUM", "^DEB(0[1-9])$", DESPIVOT, "plantilla_lineas.cuenta_debito_id",
       "Cuenta débito del renglón n -> cuentas.id. Hay 9 renglones débito pero sólo 8 "
       "descripciones NOMnn: resolver la asimetría (D-VISDOCUM-1)."),
    _r("VISDOCUM", "^CRE(0[1-9])$", DESPIVOT, "plantilla_lineas.cuenta_credito_id",
       "Cuenta crédito del renglón n -> cuentas.id. Misma asimetría 9/8 (D-VISDOCUM-1)."),
    _r("VISDOCUM", "^MODULO$", DIRECTO, "tipos_documento.modulo",
       "Módulo de origen (Cartera 1, Inventarios 2, CxP 3, Contabilidad 9). Citado en "
       "`docs/TIPOS_DOCUMENTO_ADS.md`."),
    _r("VISDOCUM", "^TIPO$", DIRECTO, "tipos_documento.naturaleza",
       "Naturaleza del movimiento según el módulo. Se llama `naturaleza` para no "
       "confundirla con el «tipo de documento» que es la tabla entera."),
    _r("VISDOCUM", "^PREFIJO$", DIRECTO, "tipos_documento.prefijo",
       "Prefijo documental. Citado en `docs/TIPOS_DOCUMENTO_ADS.md`."),
    _r("VISDOCUM", "^COMPRO$", DERIVADO, "tipos_documento.comprobante_id",
       "Comprobante contable relacionado → `comprobantes.codigo`. La interfaz lo usa para "
       "ordenar los tipos que coinciden con el comprobante elegido."),
    _r("VISDOCUM", "^ICONTAB$", DIRECTO, "tipos_documento.genera_contabilizacion",
       "«Genera contabilización»: citado en `docs/TIPOS_DOCUMENTO_ADS.md`."),
    _r("VISDOCUM", "^CONVER$", DIRECTO, "tipos_documento.permite_conversion"),
    _r("VISDOCUM", "^DOCCONVER$", DIRECTO, "tipos_documento.conversion_codigo",
       "Tipo documental al que convierte. Documentado en `docs/TIPOS_DOCUMENTO_ADS.md`."),
    _r("VISDOCUM", "^CLAVE$|^CLAVE2$", PROCEDENCIA, "tipos_documento.legado",
       "**Corrección:** `CLAVE` es `LOGICAL(1)`, o sea una bandera (¿pide clave para usar "
       "el tipo?), no una contraseña. La primera versión la descartó por el nombre."),
    _r("VISDOCUM", "^(GMORA|FPAGO|DOCOFI|MODICOS|VALORA|VLRCOS|TRASLADO|ICXP"
                   "|SUGECOS|GRABASAL|REPETI|VLRVTA|BANCOS|CCOSTO|INTERES"
                   "|ARETEN|AREPITE|MODIIMP|LEETRAS|CXPCONCE|CTRPROVE|DISTRICC|DCTO2"
                   "|DOCAFE|BLOLOTE|EXTRALO|VERIIMP|RECON|AUTORIZA|CEROSCV|FECHADOC"
                   "|ANULROJO|RUBRO|MOVBLOQ|ASISAL|VALDIAN|BODEGA|SGASTOS|NOIMP)$", PROCEDENCIA,
       "tipos_documento.legado",
       "39 banderas de las reglas de integración que **ningún documento de `docs/` mapea a un "
       "campo**: aparecen en prosa (pagos, traslados, retenciones, bancos, intereses, "
       "repetición) pero sin nombre. Se conservan completas en `jsonb` en vez de "
       "descartarlas o inventar 39 columnas."),
    _r("VISDOCUM", "^(OBLIGA|TCONCEPTO|NCUENTA)$", PROCEDENCIA, "tipos_documento.legado",
       "Sin evidencia documental ni de interfaz."),
]

# ---------------------------------------------------------------------------
# CONLOTES — la plantilla de lote («MC<lote>» del inventario viejo)
# ---------------------------------------------------------------------------
# En el inventario figuraba como `MC<lote>` y nunca entró al contrato porque el
# diccionario depurado no la listaba con ese nombre. Es la grilla editable del
# lote, así que va a `lote_lineas`. En esta copia está **vacía** (0 registros).
REGLAS += [
    _r("CONLOTES", "^LOTE$", DERIVADO, "lote_lineas.lote_id", "Código → lotes.id."),
    _r("CONLOTES", "^CUENTA$", DERIVADO, "lote_lineas.cuenta_id", "Código → cuentas.id."),
    _r("CONLOTES", "^NIT$", DERIVADO, "lote_lineas.tercero_id", "NIT → terceros.id."),
    _r("CONLOTES", "^DEBITO$", DIRECTO, "lote_lineas.debito"),
    _r("CONLOTES", "^CREDITO$", DIRECTO, "lote_lineas.credito"),
    _r("CONLOTES", "^BASE$", DIRECTO, "lote_lineas.base"),
    _r("CONLOTES", "^TFASE$", DERIVADO, "lote_lineas.centro_costo_id", "Código → centros_costos.id."),
    _r("CONLOTES", "^CONCEPTO$", DIRECTO, "lote_lineas.concepto"),
    _r("CONLOTES", "^TCOMPR$", DIRECTO, "lote_lineas.comprobante", "Código → comprobantes.codigo."),
    _r("CONLOTES", "^TIPODOC$", DERIVADO, "lote_lineas.tipo_documento_id",
       "Código → tipos_documento.codigo."),
    _r("CONLOTES", "^TFECHA$", DERIVADO, "lote_lineas.fecha", "YYYYMMDD entero → date."),
    _r("CONLOTES", "^TDOCUM$", DIRECTO, "lote_lineas.documento"),
    _r("CONLOTES", "^TDOCUM2$", DIRECTO, "lote_lineas.documento_afectado"),
    _r("CONLOTES", "^NITN$", DIRECTO, "lote_lineas.nit_alterno"),
    _r("CONLOTES", "^TINCON$", DESCARTADO, "—",
       "Mismo campo que en `MOVxx`: vacío en toda la copia (y `CONLOTES` no tiene filas). "
       "Cierra D-CONLOTES-1 junto con D-MOV-1."),
]

# ---------------------------------------------------------------------------
# TIDEAN — tabla comercial, no contable
# ---------------------------------------------------------------------------
REGLAS += [
    _r("TIDEAN", ".*", FUERA_NUCLEO, "—",
       "Datos de inventario/venta (artículo, nombre, cantidad, venta). No pertenece al "
       "núcleo contable; tiene 6 registros y queda fuera del piloto."),
]

# ---------------------------------------------------------------------------
# CATALOGO2 y P_A_* — infraestructura de Advantage, no datos de negocio
# ---------------------------------------------------------------------------
# Sus campos (`TXNID`, `ENTRYID`, `RECORDDATA`, `BLOBDATA`, `CRC`, `ERRORINFO`…) son
# el registro interno de transacciones/replicación del motor. No se migran a
# ningún modelo contable, y en esta copia están **vacías**.
REGLAS += [
    _r(tabla, ".*", DESCARTADO, "—",
       "Tabla interna de Advantage (registro de transacciones/replicación del motor), "
       "no un maestro del negocio. Vacía en esta copia y sin equivalente en el destino.")
    for tabla in ("CATALOGO2", "P_A_100_50", "P_A_102_50")
]

# ---------------------------------------------------------------------------
# Los campos sin columna de destino van a `legado`, no a `migracion_filas`
#
# El contrato los mandaba a `migracion_filas`, que sólo registra lo rechazado, lo
# fusionado y lo derivado: para las filas que **sí** se cargan no había nada, así
# que sus campos sin columna se perdían. Medido antes de corregirlo: 4.962.576
# valores de `TUSUA`, 735.975 de `DDOCUMI`, 456.222 de `DMODULO`, 282.948 en
# `FADCLI` y 76.000 en `CONMAE`.
#
# Ahora se conservan crudos, con su nombre físico, en la columna `legado` de la
# tabla que recibe el registro. Sólo lleva las claves que traen valor.
#
# `CONMOVI` y `CONLOTES` —cuyas entidades no están implementadas y que además
# están vacías en la copia— siguen declarando `migracion_filas`.
# Etapa A de `db/migration/08_plan_para_culminar.md`.
# ---------------------------------------------------------------------------
LEGADO = {
    "CONEMP": "companias",
    "CONPUC": "cuentas",
    "CONCTR": "parametros_operacion",
    "CONMAE": "cuentas",
    "CONCECOS": "centros_costos",
    "CONTICOM": "comprobantes",
    "CONDOCUM": "documentos",
    "MOVxx": "documento_lineas",
    "FADCLI": "terceros",
    "VISDOCUM": "tipos_documento",
}

REGLAS = [
    Regla(regla.tabla, regla.patron, regla.clase, f"{LEGADO[regla.tabla]}.legado",
          regla.transformacion)
    if regla.clase == PROCEDENCIA and regla.tabla in LEGADO else regla
    for regla in REGLAS
]


# ---------------------------------------------------------------------------
# Tablas presentes en ADD_CONTAB/ pero sin catálogo de campos en el diccionario
# ---------------------------------------------------------------------------
# CATALOGO2, CONLOTES, P_A_100_50, P_A_102_50 y TIDEAN sólo están en el .add.
# El contrato las marca aparte (no hay campo que clasificar) y PENDIENTES.md
# recoge la decisión sobre ellas.
SIN_DICCIONARIO = ("CATALOGO2", "CONLOTES", "P_A_100_50", "P_A_102_50", "TIDEAN")


def _tabla_catalogo(tabla: str) -> str:
    """MOV00..MOV18 comparten estructura y se homologan como MOVxx."""
    return re.sub(r"^MOV\d{2}$", "MOVxx", tabla)


def resolver(tabla: str, campo: str) -> Regla | None:
    """Primera regla que aplica a (tabla, campo), en el orden declarado.

    El orden importa: las reglas universales van primero para que el «ajuste»
    (`ID`, `CIA`, `CONANO`, `CONMES`) no quede atrapado por una regla comodín.
    """
    clave = _tabla_catalogo(tabla.upper())
    for regla in REGLAS:
        if regla.tabla in (clave, "*") and regla.aplica(campo.upper()):
            return regla
    return None


def tablas_cubiertas() -> set[str]:
    return {regla.tabla for regla in REGLAS}
