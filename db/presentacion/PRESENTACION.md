# CONTABDSI · Migración de la base de datos
## De VISION/FORTUNER (Advantage ADS) al nuevo esquema PostgreSQL

---

## 0 · La idea en una lámina

- El legado: **tablas planas** sobre Advantage (ADT/DBF), una **carpeta por empresa**, una **tabla por mes** (`MOV00…MOV18`) y una **tabla por lote** (`MC<lote>`).
- El nuevo esquema: **60 entidades relacionales en 9 módulos**, aislamiento por `company_id`, libro inmutable, saldos que se recalculan.
- La migración: **transformación por proceso contable** (no volcado de archivos), con conciliación de diferencia cero.

```mermaid
flowchart LR
    subgraph ORIGEN["LEGADO · VISION/FORTUNER (hoy)"]
        A1["Advantage ADS · tablas ADT/DBF"]
        A2["Una carpeta por empresa: CONTAB/001/"]
        A3["MOV00…MOV18: un archivo por período"]
        A4["MC#lt;lote#gt;: un archivo por lote"]
        A5["CONMAE mezcla cuenta + NIT + acumulados"]
    end

    subgraph CAMINO["MIGRACIÓN (extractor + cargador)"]
        B1["Perfilado solo lectura · instantáneas + hash"]
        B2["Homologación campo → campo aprobada"]
        B3["Transformación:<br/>TVALOR firmado → débito/crédito<br/>columnas mensuales → filas por período<br/>un documento por grupo documental"]
        B4["Carga idempotente + equivalencias + rechazos"]
        B5["Conciliación diferencia cero<br/>libro · saldos · impuestos"]
    end

    subgraph DESTINO["NUEVO · PostgreSQL 18 (objetivo)"]
        C1["Esquema único con company_id · 60 entidades"]
        C2["lotes → documento(s) por grupo documental"]
        C3["Libro inmutable (documentos + líneas)"]
        C4["Saldos y acumulados regenerables"]
    end

    A1 --> B1 --> B2 --> B3 --> B4 --> B5
    B5 --> C1
    C1 --> C2 --> C3
    C1 --> C4
```

**Números que importan:** 98 familias funcionales (141 variantes físicas, 3.616 campos) → 60 entidades nuevas · 19 archivos `MOVxx` → 1 tabla · N archivos `MC<lote>` → 1 tabla · 15 bloqueos detectados (B01–B15) → corregidos y probados (11/11 pruebas).

---

## 1 · Cómo está hoy: el esquema legado

### 1.1 Qué quedó después de depurar el sistema

```mermaid
flowchart LR
    subgraph INVENTARIO["Inventario físico amplio"]
        I1["261 nombres / familias de tablas"]
    end
    subgraph DEPURADO["Esquema funcional (lo que usa el negocio)"]
        D1["98 familias funcionales"]
        D2["57 núcleo contable"]
        D3["41 dependencias de otros módulos"]
        D4["141 variantes físicas · 3.616 campos"]
    end
    subgraph FUERA["Fuera (sin uso de datos acreditado)"]
        F1["167 familias: aperturas, índices,<br/>temporales, copias por módulo"]
    end
    I1 --> DEPURADO
    I1 --> FUERA
```

### 1.2 El flujo contable sobre esas tablas

```mermaid
flowchart TD
    E["Empresa 001 · su carpeta en disco"]

    subgraph CAPTURA["CAPTURA (lotes)"]
        M1["CONMOVI: cabecera del lote"]
        M2["MC#lt;lote#gt;: renglones en edición<br/>(COPY STRUC desde CONINTER)"]
        M3["CONINTER: plantilla de estructura"]
    end

    subgraph LIBRO["CONTABILIZACIÓN (libro)"]
        D1["CONDOCUM: cabeceras contabilizadas<br/>(una por grupo TCOMPR+TIPODOC+TDOCUM)"]
        D2["MOV00…MOV18: renglones del libro<br/>por período (TVALOR firmado: crédito −)"]
    end

    subgraph DERIV["DERIVADOS"]
        S1["CONMAE: acumulados mensuales por cuenta y NIT"]
        S2["COCENTRO / CONMCOS / CONTERCE: costos"]
        S3["CONRET / CONIVA / CONMAGDT: retención, IVA, exógena"]
    end

    subgraph MAESTROS["Maestros que alimentan la captura"]
        C1["CONPUC + CONMAE (cuentas)"]
        C2["FADCLI (terceros) + CIUDAD/ACTIVIDA/VISTDOC"]
        C3["CONCECOS (centros)"]
        C4["VISDOCUM/CONTIDOC (tipos doc + plantillas) · CONTICOM (comprobantes)"]
    end

    E --> C1 & C2 & C3 & C4
    C1 & C2 & C3 & C4 --> M1 --> M2
    M3 -. "crea la estructura" .-> M2
    M2 -- "validar / aprobar" --> D1 --> D2
    D2 --> S1 & S2 & S3
```

**Por qué no se puede "copiar" tal cual:**

- El aislamiento entre empresas es **físico** (carpeta), no una clave: no existen FKs.
- El mismo concepto vive en **N archivos** (por mes, por lote, por usuario).
- `TVALOR` es **firmado** (crédito negativo); hay columnas **mensuales** (`MACMDEB03`), porcentajes en dos formatos, NIT con ceros, `RECNO` que no es identidad estable.
- Tablas **polivalentes**: `CONMAE` = maestro + auxiliar + acumulados; `VISDOCUM` = tipo documental + consecutivo + plantillas.
- Marcas de borrado/anulación a interpretar **por entidad**, nunca con regla global.

---

## 2 · Cómo queda: el esquema nuevo

### 2.1 Arquitectura: un modelo neutro, implementaciones por motor

```mermaid
flowchart TB
    subgraph CAPA1["1 · MODELO LÓGICO NEUTRO — db/general/ (fuente de verdad)"]
        G1["00_convenciones: tipos lógicos, esquema único, auditoría"]
        G2["01_entidades: 60 entidades · claves · checks"]
        G3["03_reglas_negocio: validar · contabilizar · anular · regenerar"]
        G4["modelo.json · diagrama.md · referencia ANSI"]
    end
    subgraph CAPA2["2 · IMPLEMENTACIONES POR MOTOR"]
        P1["postgresql/ — PostgreSQL 18<br/>esquema + funciones + 11 pruebas ✓"]
        A1["advantage/ — diccionario ADS<br/>(despliegues que conserven ADS)"]
        X1["futuros: mysql/, sqlserver/…"]
    end
    CAPA1 --> P1
    CAPA1 --> A1
    CAPA1 --> X1
```

### 2.2 Las 60 entidades en 9 módulos

```mermaid
flowchart TB
    N["NÚCLEO 5<br/>companias · anios · periodos · parámetros"]
    M["MAESTROS 14<br/>cuentas · terceros · centros · comprobantes · tipos doc<br/>retención · IVA · renta · plantillas · formatos"]
    MV["MOVIMIENTOS 5<br/>lotes → documentos (libro) · líneas · validaciones"]
    S["SALDOS 8 (derivados)<br/>por cuenta / +tercero / +centro · acumulados fiscales"]
    F["IMPUESTOS 7<br/>exógena: formatos · generaciones · conciliación"]
    PR["PROCESOS 5<br/>reprocesos · cierres · traslados · consolidación"]
    SG["SEGURIDAD 7<br/>roles · permisos · usuarios · auditoría · integraciones"]
    PP["PRESUPUESTO 3"]
    A["AMPLIACIONES 6<br/>bancos · reembolsos · activos fijos"]

    N --> M
    M --> MV --> S
    M --> F & PR & A & PP
    SG -. "actores y bitácora" .-> MV & PR & F
```

### 2.3 El flujo contable nuevo

```mermaid
flowchart LR
    subgraph ENTRADA["HECHOS ECONÓMICOS"]
        E1["Captura directa y plantillas"]
        E2["Lotes de importación XLS · TXT · CSV · ADT"]
        E3["Integraciones: nómina · reembolsos · activos"]
    end

    subgraph CAPTURA2["CAPTURA Y VALIDACIÓN"]
        L1["lotes (Borrador → Aprobado)"]
        L2["lote_lineas con dimensiones fiscales por renglón"]
        L3["lote_validaciones (errores / advertencias)"]
    end

    subgraph LIBRO2["LIBRO (inmutable)"]
        D1["documentos — uno por grupo documental"]
        D2["documento_lineas — espejo histórico"]
    end

    subgraph DERIV2["DERIVADOS (regenerables)"]
        S1["saldos_cuenta ± tercero ± centro"]
        S2["acumulados: terceros · centros · retención · IVA"]
        S3["exógena · informes · certificados · presupuesto"]
    end

    E1 & E2 & E3 --> L1 --> L2
    L2 --> L3 -->|"validar_lote: sin errores"| D1 --> D2
    D2 --> S1 & S2
    D2 --> S3
    D1 -. "anular_documento crea REV-…" .-> D1
```

**Garantías nuevas (una línea cada una):** esquema único con `company_id` y FK compuestas (nada cruza entre empresas) · libro **inmutable** (corregir = anular con reversión `REV-…`) · saldos y acumulados **regenerables** desde el libro · auditoría + `version` en toda fila · idempotencia (un archivo no se carga dos veces) · B01–B15 corregidos y probados: **11/11 validaciones en verde**.

---

## 3 · Cómo conectan las tablas viejas con las nuevas

> Patrones: **N físicas → 1 lógica** (MOVxx, MC<lote>) · **1 polivalente → N entidades** (CONMAE, VISDOCUM) · **columnas mensuales → filas por período** (PRE05, MACMDEB03…) · la clave original de cada registro se conserva (equivalencias), nunca se renumeran documentos históricos.

### 3.1 Plan de cuentas, comprobantes y plantillas

```mermaid
flowchart LR
    subgraph L["LEGADO"]
        A[CONPUC] ; B[CONMAE] ; C[CONTICOM] ; D[VISDOCUM] ; E[CONTIDOC] ; F[CONCECOS]
    end
    subgraph N["NUEVO"]
        G[cuentas] ; H[saldos_cuenta] ; I[saldos_cuenta_tercero]
        J[comprobantes] ; K[consecutivos_comprobantes]
        L2[tipos_documento] ; M[plantillas_contables] ; N2[plantilla_lineas]
        O[centros_costos]
    end
    A -->|"catálogo base"| G
    B -->|"maestro y reglas de captura"| G
    B -->|"acumulados mensuales → por período"| H
    B -->|"registros cuenta+NIT"| I
    C -->|"tipos de comprobante"| J
    C -->|"consecutivo por año"| K
    D -->|"tipos documentales"| L2
    E -->|"tipos documentales"| L2
    D -->|"consecutivos del tipo"| K
    D -->|"plantillas NOM/DEB/CRE: parejas de cuentas,<br/>no importes"| M --> N2
    E -->|"plantillas"| M
    F -->|"catálogo + jerarquía"| O
```

**Clave:** el tipo documental (NOM, FV…) es una dimensión del renglón, distinta del comprobante contable (CE, RC…). Las plantillas guardan **dos cuentas por regla** (débito/crédito), nunca importes fijos.

### 3.2 Movimiento: lotes, captura y libro (el corazón)

```mermaid
flowchart LR
    subgraph L["LEGADO (físico)"]
        A[CONMOVI] ; B["MC#lt;lote#gt; (uno por lote)"] ; C[CONINTER]
        D[CONDOCUM] ; E["MOV00…MOV18 (19 archivos)"]
    end
    subgraph N["NUEVO (lógico)"]
        F[lotes] ; G[lote_lineas] ; H[lote_validaciones]
        I[documentos] ; J[documento_lineas] ; K[saldos_cuenta]
    end
    A -->|"cabeceras de lote"| F
    B -->|"renglones en edición"| G
    C -. "sustitución técnica (el DDL reemplaza al COPY STRUC)" .- G
    B -->|"validación"| H
    D -->|"cabeceras contabilizadas"| I
    E -->|"un documento por grupo documental<br/>(TCOMPR + TIPODOC + TDOCUM)"| I
    E -->|"renglones del libro<br/>TVALOR firmado → débito / crédito"| J
    E -->|"movimiento mensual → filas con período"| K
    I -->|"1 : N"| J
    F -->|"1 lote → N documentos"| I
```

**Clave (B01):** el legado ya creaba **varias cabeceras CONDOCUM por lote** (agrupando por comprobante+tipo+documento); la primera versión del esquema nuevo aplanaba el lote a un documento. Corregido: `contabilizar_lote` crea **un documento por grupo documental**, como el original.

### 3.3 Terceros, cuentas bancarias y catálogos

```mermaid
flowchart LR
    subgraph L["LEGADO"]
        A[FADCLI] ; B[FADCTAS] ; C[VISTDOC] ; D[CIUDAD] ; E[ACTIVIDA]
    end
    subgraph N["NUEVO"]
        F[terceros] ; G[tercero_etiquetas] ; H[tercero_cuentas_bancarias]
        I["catálogos de ciudades / actividades /<br/>tipos de identificación (por diseñar)"]
    end
    A -->|"identidad + datos fiscales"| F
    A -->|"agrupaciones libres"| G
    B -->|"número como texto (ceros iniciales)"| H
    C --> I
    D --> I
    E --> I
```

### 3.4 Fiscal: retención, IVA y exógena

```mermaid
flowchart LR
    subgraph L["LEGADO"]
        A[CONTIRET] ; B[CONRET] ; C[CONTIIVA] ; D[CONIVA]
        E[CONMAG1] ; F[CONMAG2] ; G[CONMAG3] ; H[CONMAGDT]
    end
    subgraph N["NUEVO"]
        I[conceptos_retencion] ; J[acumulados_retencion] ; K[tarifas_iva]
        L2[acumulados_iva] ; M[formatos_exogenos] ; N2[formato_conceptos]
        O[formato_asignaciones] ; P[medio_topes] ; Q[medio_filas]
        R[generaciones_medios] ; S[medio_conciliaciones]
    end
    A -->|"tarifa → fracción (19 → 0.19)"| I
    B -->|"se regenera desde el libro (corregido B03)"| J
    C -->|"tarifas IVA"| K
    D -->|"se regenera desde el libro (corregido B03)"| L2
    E -->|"formato con vigencia"| M
    F -->|"conceptos del formato"| N2
    F -->|"topes de depuración"| P
    G -->|"asignación de cuentas<br/>(pendiente: rangos y condiciones)"| O
    H -->|"generación por compañía/año"| R
    H -->|"filas del medio · VALOR1..11"| Q
    H -->|"total contable vs. reportado"| S
    R -->|"1:N"| Q
```

**Clave (B03):** cada renglón del libro guarda su **concepto/tarifa histórica**; los acumulados fiscales se regeneran desde el libro (original + reversión = efecto neto) y nunca se infiere la tarifa vigente para historia.

### 3.5 Activos fijos, amortizables y reembolsos

```mermaid
flowchart LR
    subgraph L["LEGADO"]
        A[AFIART] ; B[AMORART] ; C[AFITAB] ; D[AMORTAB]
        E[AFITAB2] ; F[AMORTAB2] ; G[CONREMAE] ; H[CONREITE]
    end
    subgraph N["NUEVO"]
        I[activos] ; J[activo_cuotas] ; K[activo_distribuciones]
        L2[reembolsos] ; M[reembolso_lineas]
    end
    A -->|"activos fijos"| I
    B -->|"amortizables (mismo modelo)"| I
    C -->|"cuentas del activo"| I
    D -->|"cuentas del amortizable"| I
    E -->|"distribución por centro (%)"| K
    F -->|"distribución por centro (%)"| K
    I -->|"1:N cuotas mensuales aplicadas"| J
    G -->|"cabecera de reembolso"| L2
    H -->|"detalle del reembolso"| M
    L2 -->|"1:N"| M
```

**Nota:** en el legado estas entidades **no tenían destino equivalente** (B10) y se crearon en el esquema nuevo. La estructura física de `CONREMAE/CONREITE` aún está por verificar antes de fijar la carga.

### 3.6 Consolidación, presupuesto y seguridad

```mermaid
flowchart LR
    subgraph L["LEGADO"]
        A[CONSOLID] ; B[TIDPRESU] ; C[VISUSU] ; D[VISAUDI]
    end
    subgraph N["NUEVO"]
        E[consolidaciones] ; F[consolidacion_origenes]
        G[presupuestos] ; H[presupuesto_rubros] ; I[presupuesto_valores]
        J[usuarios] ; K[roles] ; L2[permisos] ; M[rol_permisos]
        N2[usuario_companias] ; O[auditoria]
    end
    A -->|"configuración + empresas origen"| E
    A -->|"orígenes"| F
    B -->|"cabecera por año"| G
    B -->|"jerarquía de rubros"| H
    B -->|"PRE00..13 y MOV00..13 → filas por período"| I
    C -->|"usuarios y roles"| J
    C -->|"roles"| K --> M
    L2 --> M
    C -->|"permisos"| L2
    J -->|"acceso por empresa (nuevo)"| N2
    D -->|"bitácora append-only"| O
```

**Clave:** el legado **no tenía acceso por compañía ni permisos reales** (la función `PERMI` devolvía verdadero): el modelo nuevo se crea desde cero. El presupuesto pasa de **12+2 columnas mensuales** a filas por período y tipo.

### 3.7 Resumen: de 98 familias a 60 entidades

```mermaid
flowchart TB
    subgraph VIEJO["LEGADO — almacenamiento físico"]
        V1["Carpeta por empresa (001, 002…) con copia de todas las tablas"]
        V2["Tabla por período: MOV00…MOV18"]
        V3["Tabla por lote: MC#lt;lote#gt;"]
        V4["Tablas polivalentes: CONMAE, VISDOCUM"]
        V5["Temporales y plantillas de estructura (no son datos)"]
    end
    subgraph NUEVO["NUEVO — modelo relacional"]
        N1["Esquema único + company_id · 60 entidades"]
        N2["periodo como columna"]
        N3["lote_id: una tabla para todos los lotes"]
        N4["Separación: cuentas · tipos_documento · plantillas · comprobantes"]
        N5["Derivados regenerables: saldos_* y acumulados_*"]
    end
    V1 -->|"aislamiento → columna + FK compuestas"| N1
    V2 -->|"19 archivos → 1 tabla"| N2
    V3 -->|"N archivos → 1 tabla"| N3
    V4 -->|"1 polivalente → N entidades"| N4
    V5 -->|"se eliminan o se vuelven consultas"| N5
```

**No se migra como tabla:** `CONINTER`, `INFORMES`, `POSINFOR` (sustitución técnica), índices `.ADI`, temporales por usuario y 167 familias sin uso funcional (exclusiones con motivo en `db/old_db/EXCLUSIONES_CONTABDSI.md`).

---

## 4 · La migración de datos: cómo se pasa la información

### 4.1 La tubería

```mermaid
flowchart LR
    S1["ORIGEN<br/>Advantage ADS · carpetas por empresa"] -->|"solo lectura"| S2["EXTRACTOR<br/>instantánea consistente + hash"]
    S2 --> S3["STAGING<br/>crudo + equivalencias + rechazos"]
    S3 -->|"transformación aprobada<br/>por proceso (P01–P36)"| S4["CARGADOR<br/>idempotente · reanudable"]
    S4 --> S5["DESTINO<br/>PostgreSQL · 60 entidades"]
    S5 -->|"regenerar derivados"| S6["CONCILIACIÓN<br/>diferencia cero"]
    S6 -->|"reconstrucción y comparación"| S5
```

### 4.2 Fases

| Fase | Qué se hace | Sale cuando… |
|---|---|---|
| 0 · Alcance | Empresas/años, módulos activos, historia requerida, ventana | Inventario firmado |
| 1 · Perfilado | Solo lectura: tamaños, claves repetidas, huérfanos, fechas, signos | Informe por fuente + excepciones |
| 2 · Homologación | Campo → destino → transformación → prueba (2.663 campos) | Nada funcional sin destino aprobado |
| 3 · Esquema y servicios | B01–B15 (ya corregidos), migraciones versionadas | Instalable y actualizable |
| 4 · Ensayo del motor | Pruebas de lógica, integridad y concurrencia (hoy 11/11) | Pruebas críticas pasan |
| 5 · Extractor + staging | Instantánea + metadatos + hash | Extracción reproducible, origen intacto |
| 6 · Carga piloto | Una compañía/año representativos | Carga idempotente + conciliación exacta |
| 7 · Validación usuarios | Mismos casos del original, opción por opción | Aceptación por proceso |
| 8 · Ensayo general | Todas las empresas/años + restauración | Tiempos y restauración OK |
| 9 · Corte | Congelamiento → carga final → conciliación | Acta GO · un solo escritor |
| 10 · Estabilización | Legado en consulta, conciliación operativa | Aceptación final |

### 4.3 Orden de carga

```mermaid
flowchart TD
    A["1 · Ejecución de migración, compañías, años,<br/>períodos y usuarios homologados"] --> B["2 · Catálogos, terceros, cuentas/jerarquía,<br/>centros, comprobantes y tipos"]
    B --> C["3 · Parámetros, bancos, plantillas, formatos,<br/>exógena, presupuesto, activos, reembolsos"]
    C --> D["4 · Lotes pendientes y su detalle"]
    D --> E["5 · Libro histórico POR GRUPOS DOCUMENTALES<br/>(sin recontabilizar lo ya aplicado)"]
    E --> F["6 · Aperturas, reversiones y referencias cruzadas"]
    F --> G["7 · Reconstrucción de saldos/acumulados<br/>+ comparación con el origen"]
    G --> H["8 · Certificados, exportaciones históricas y archivos"]
    H --> I["9 · Consecutivos ajustados (sin renumerar)"]
    I --> J["10 · Índices, estadísticas y pruebas finales"]
```

### 4.4 Las reglas que no se negocian

- **No recontabilizar**: un lote aplicado y su movimiento publicado no son dos asientos; el cargador histórico valida invariantes y conserva procedencia.
- `CONDOCUM` se concilia con `MOVxx` **antes** de reconstruir cabeceras; los huérfanos se registran como excepción.
- **No perder períodos 00 y 13–18**; apertura con una sola fuente (MOV00 **o** saldo inicial, nunca ambas).
- Códigos/NIT/números de banco **siguen como texto**; fechas inválidas a cuarentena, no a "hoy"; codificación OEM/ANSI validada por fuente.
- `RECNO` no es identidad: solo localizador dentro de una instantánea.
- Los acumulados originales se guardan como **instantánea de conciliación**; los nuevos se recalculan desde el libro aprobado.
- Cada fila deja rastro: ejecución, archivo, hash, **equivalencia de clave** y rechazo con motivo. Cargador idempotente y reanudable.
- **Migrar también los archivos** (certificados/portal `XADPDF`) con manifiesto y hash: una ruta Windows no es el documento.

### 4.5 Conciliación: el éxito es diferencia cero

```mermaid
flowchart LR
    A["Universo fuente<br/>conteos + hash por archivo"] --> B["Clasificar cada fila"]
    B --> C1["Cargada"]
    B --> C2["Fusionada por regla aprobada"]
    B --> C3["Derivada (se recalcula)"]
    B --> C4["Excluida con autorización"]
    B --> C5["Rechazada con motivo"]
    C1 & C2 & C3 & C4 & C5 --> D["La suma explica el 100 %"]
    D --> E["Libro ↔ saldos por cuenta / tercero / centro<br/>retención · IVA · exógena · presupuesto<br/>activos · consecutivos · anulaciones"]
    E --> F{"¿Diferencia cero tras la<br/>transformación aprobada?"}
    F -->|"No"| B
    F -->|"Sí"| G["Aceptación firmada"]
```

> No basta que total débito = total crédito: un error simétrico también cuadra. Se comparan **mayor, auxiliares y acumulados** con los mismos filtros del origen, además de las pruebas T01–T18 y una prueba por proceso (P01–P36).

### 4.6 Corte y reversión

```mermaid
flowchart TD
    A["Respaldo verificado + conteos/hash<br/>de origen, staging y destino"] --> B["Congelamiento de escrituras<br/>en fuentes compartidas"]
    B --> C["Snapshot consistente del conjunto<br/>(una copia por archivo puede mezclar instantes)"]
    C --> D["Carga final + conciliación + acta"]
    D --> E{"¿Falla antes de habilitar<br/>el sistema nuevo?"}
    E -->|"Sí"| F["El legado sigue operando;<br/>el destino aislado se rehace"]
    E -->|"No, falla después"| G["No basta volver al respaldo:<br/>congelar, identificar lo nuevo<br/>y ejecutar el plan de retorno probado"]
    D --> H["Legado en SOLO LECTURA por el plazo aprobado<br/>(no se borran ADT/DBF)"]
```

### 4.7 Estado: NO-GO — qué falta para el GO

| ✅ Ya listo en el esquema | ⏳ Falta para autorizar producción |
|---|---|
| B01–B15 corregidos · 11/11 pruebas del flujo | **Homologación campo a campo completa** (2.663 campos: 406 candidatos, 2.257 pendientes) |
| Libro multi-documento, anulación con reversión de saldos | Reglas CONMAG3 (rangos/condiciones) y detalle CONMAGIT (exógena) |
| Acumulados fiscales regenerables (B03) | Definiciones CONINF1 y selecciones por usuario (informes) |
| Aislamiento por compañía, períodos, idempotencia | Algoritmos de cierre anual, traslados 13–18 y consolidación |
| Entidades de activos, reembolsos y bancos | Repositorio de archivos/certificados (XADPDF) |
| Seguridad: roles, permisos, `usuario_companias` | Autenticación/RLS reales y bitácora inmutable en producción |
| | Regla de `modo_retencion` (el legado no persiste MCR) |
| | **Migrador versionado** (lo actual es un bootstrap de demo con `dropdb`) |

**Siguiente paso:** cerrar la homologación y probar en un entorno aislado con datos reales de una compañía/año — **no** cargar producción.

---

### Fuentes para profundizar (`db/old_db/`)

`PLAN_MIGRACION_POSTGRESQL.md` (dictamen B01–B15, fases, GO/NO-GO) · `MATRIZ_TABLAS_Y_BRECHAS.md` (98 tablas → destino, evidencia y campos) · `HOMOLOGACION_CAMPOS.md` (2.663 campos) · `MATRIZ_PROCESOS_Y_OPCIONES.md` (P01–P36 y 161 opciones) · `ESQUEMA_DEPURADO_CONTABDSI.md` / `DICCIONARIO_DEPURADO_CONTABDSI.md` (estructuras del legado) · `EXCLUSIONES_CONTABDSI.md` · `VALIDACION_HALLAZGOS.md` (dictamen de correcciones) · modelo nuevo en `db/general/` y `db/postgresql/`.
