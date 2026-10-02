-- =====================================================================
-- CONTABDSI · 13_campos_contrato.sql
-- Columnas que el contrato campo → destino exige y el esquema no tenía.
--
-- No son conjeturas: cada una la pide una funcionalidad implementada, y el
-- contrato de campos (`db/migration/06_referencia_campos.md`) dice de qué campo
-- del legado sale. La evidencia está en la interfaz web:
--
--   * `terceros`        → `TerceroCreate` (src/api/terceros.ts) pide
--                          nombreComercial, primer/segundo nombre,
--                          primer/segundo apellido y codigoCiudad.
--   * `tipos_documento` → `docs/maestros/TIPOS_DOCUMENTO_ADS.md` documenta módulo,
--                          naturaleza, prefijo, comprobante, ICONTAB y conversión.
--   * `comprobantes`    → `descripcionAuxiliar` (src/api/comprobantes.ts).
--   * `centros_costos`  → `CentroJerarquico` (src/data/configCentros.ts).
--
-- Todo lo demás que el legado trae y ninguna funcionalidad consume **no se
-- descarta**: se conserva completo en `migracion_filas.valores_originales`
-- (clase `procedencia` del contrato), que es el mecanismo que el plan define
-- para lo que no tiene semántica acreditada.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Terceros: identidad desglosada y contacto, tal como la pide la interfaz.
-- -------------------------------------------------------------------
ALTER TABLE terceros
  ADD COLUMN nombre_comercial   text,   -- FADCLI.CSOCIAL
  ADD COLUMN primer_nombre      text,   -- FADCLI.CNOM1
  ADD COLUMN segundo_nombre     text,   -- FADCLI.CNOM2
  ADD COLUMN primer_apellido    text,   -- FADCLI.CAPE1
  ADD COLUMN segundo_apellido   text,   -- FADCLI.CAPE2
  ADD COLUMN codigo_ciudad      text;   -- FADCLI.CCODCIU (CCIUDAD guarda el nombre)

-- -------------------------------------------------------------------
-- Tipos de documento: los atributos que el proceso de contabilización usa.
-- -------------------------------------------------------------------
ALTER TABLE tipos_documento
  ADD COLUMN modulo                 smallint,  -- VISDOCUM.MODULO (1 cartera, 2 inventarios, 3 CxP, 9 contabilidad)
  ADD COLUMN naturaleza             text,      -- VISDOCUM.TIPO
  ADD COLUMN prefijo                text,      -- VISDOCUM.PREFIJO
  ADD COLUMN comprobante_id         bigint,    -- VISDOCUM.COMPRO → comprobantes
  ADD COLUMN genera_contabilizacion boolean NOT NULL DEFAULT true, -- VISDOCUM.ICONTAB
  ADD COLUMN permite_conversion     boolean NOT NULL DEFAULT false, -- VISDOCUM.CONVER
  ADD COLUMN conversion_codigo      text;      -- VISDOCUM.DOCCONVER

-- -------------------------------------------------------------------
-- Comprobantes: la descripción auxiliar que la interfaz muestra.
-- -------------------------------------------------------------------
ALTER TABLE comprobantes
  ADD COLUMN descripcion_auxiliar text;        -- CONTICOM.CTABDES

-- -------------------------------------------------------------------
-- Centros de costo: parametrización de distribución, usada por la pantalla
-- Centros (`CentroJerarquico`).
-- -------------------------------------------------------------------
ALTER TABLE centros_costos
  ADD COLUMN hist              text,           -- CONCECOS.HIST
  ADD COLUMN tipo              integer,        -- CONCECOS.TIPO
  ADD COLUMN carpeta           text,           -- CONCECOS.CARPETA
  ADD COLUMN valor             dinero NOT NULL DEFAULT 0,          -- CONCECOS.VALOR
  ADD COLUMN porcentaje        porcentaje NOT NULL DEFAULT 0,      -- CONCECOS.PORCEN
  ADD COLUMN valor_porcentaje  dinero NOT NULL DEFAULT 0,          -- CONCECOS.VLRPOR
  ADD COLUMN codigo_item       text,           -- CONCECOS.CODITEM
  ADD COLUMN cuenta_id         bigint,         -- CONCECOS.CUENTA
  ADD COLUMN concepto          text;           -- CONCECOS.CONCEPTO

-- -------------------------------------------------------------------
-- Integridad: mismas FK compuestas por compañía que el resto del esquema (B05).
-- -------------------------------------------------------------------
ALTER TABLE tipos_documento
  ADD CONSTRAINT tipos_documento_comprobante_fk
    FOREIGN KEY (compania_id, comprobante_id) REFERENCES comprobantes (compania_id, id);

ALTER TABLE centros_costos
  ADD CONSTRAINT centros_costos_cuenta_fk
    FOREIGN KEY (compania_id, cuenta_id) REFERENCES cuentas (compania_id, id);

COMMIT;
