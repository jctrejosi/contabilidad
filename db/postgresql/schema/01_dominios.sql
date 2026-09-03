-- =====================================================================
-- CONTABDSI · 01_dominios.sql
-- Dominios, funciones y disparadores transversales.
-- Motor: PostgreSQL 18. Esquema único con company_id.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Dominios
-- -------------------------------------------------------------------

-- Importes monetarios. Nunca usar float/double para dinero.
CREATE DOMAIN dinero AS numeric(18, 2);

-- Porcentajes como fracción (ej.: 2.5 % -> 0.025, 19 % -> 0.19).
CREATE DOMAIN porcentaje AS numeric(9, 6);

-- Cantidades / tarifas auxiliares.
CREATE DOMAIN cantidad AS numeric(18, 4);

-- -------------------------------------------------------------------
-- Función de auditoría: mantiene actualizado_en y avanza version.
-- El control de concurrencia optimista lo hace la aplicación:
--   UPDATE ... WHERE id = :id AND version = :version_esperada;
-- Si la fila no se actualiza, hay conflicto de edición.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auditoria_antes_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.actualizado_en := now();
  NEW.version := COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$;

-- -------------------------------------------------------------------
-- Función para setear creado_en en INSERT cuando no viene del app.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auditoria_antes_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.creado_en IS NULL THEN
    NEW.creado_en := now();
  END IF;
  IF NEW.version IS NULL THEN
    NEW.version := 0;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
