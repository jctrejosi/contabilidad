-- =====================================================================
-- CONTABDSI · validate.sql
-- Validación funcional del esquema: flujo completo del lote NOM2.
-- Ejecutar después de cargar schema + funciones + seed.
--   psql -v ON_ERROR_STOP=1 -f validate.sql
-- =====================================================================

\set ON_ERROR_STOP on

-- 1. Estado inicial del lote NOM2: cuadrado y con 2 errores.
DO $$
DECLARE
  v_deb dinero; v_cre dinero; v_err integer;
BEGIN
  SELECT COALESCE(SUM(debito),0), COALESCE(SUM(credito),0)
    INTO v_deb, v_cre FROM lote_lineas WHERE lote_id = 1;

  SELECT COUNT(*) INTO v_err FROM lote_validaciones
   WHERE lote_id = 1 AND severidad = 'Error';

  IF v_deb <> v_cre THEN
    RAISE EXCEPTION 'FALLO 1: lote descuadrado (% ≠ %)', v_deb, v_cre;
  END IF;

  IF v_err <> 2 THEN
    RAISE EXCEPTION 'FALLO 2: se esperaban 2 errores, hay %', v_err;
  END IF;

  RAISE NOTICE 'OK: NOM2 cuadrado (%) con 2 errores', v_deb;
END $$;

-- 2. Corregir los dos errores (centro de línea 3, tercero de línea 9).
UPDATE lote_lineas SET centro_costo_id = (SELECT id FROM centros_costos WHERE codigo='OPE')
 WHERE lote_id = 1 AND numero_linea = 3;
UPDATE lote_lineas SET tercero_id = (SELECT id FROM terceros WHERE nit='23.456.789')
 WHERE lote_id = 1 AND numero_linea = 9;

DO $$
DECLARE
  v_ok boolean; v_estado text;
BEGIN
  v_ok := validar_lote(1);
  SELECT estado INTO v_estado FROM lotes WHERE id = 1;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'FALLO 3: el lote aún tiene errores tras corregir';
  END IF;
  IF v_estado <> 'Verificado' THEN
    RAISE EXCEPTION 'FALLO 4: estado esperado Verificado, actual %', v_estado;
  END IF;
  RAISE NOTICE 'OK: lote corregido y Verificado';
END $$;

-- 3. Aprobar y contabilizar (atómico).
UPDATE lotes SET estado = 'Aprobado' WHERE id = 1;

DO $$
DECLARE
  v_doc_id bigint; v_numero bigint; v_comp text; v_doc text;
BEGIN
  v_doc_id := contabilizar_lote(1, 1);

  SELECT d.numero, c.codigo, d.documento
    INTO v_numero, v_comp, v_doc
    FROM documentos d JOIN comprobantes c ON c.id = d.comprobante_id
    WHERE d.id = v_doc_id;

  IF v_comp || '-' || lpad(v_numero::text, 6, '0') <> 'CE-000245' THEN
    RAISE EXCEPTION 'FALLO 5: comprobante generado inesperado %', v_comp;
  END IF;
  RAISE NOTICE 'OK: contabilizado %-% · % (documento %)', v_comp, lpad(v_numero::text,6,'0'), v_doc, v_doc_id;
END $$;

-- 4. Idempotencia: contabilizar de nuevo debe fallar.
DO $$
BEGIN
  BEGIN
    PERFORM contabilizar_lote(1, 1);
    RAISE EXCEPTION 'FALLO 6: la segunda contabilización NO fue rechazada';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'OK: idempotencia — segunda contabilización rechazada';
  END;
END $$;

-- 5. Cuadratura del libro y de los saldos.
DO $$
DECLARE
  v_deb dinero; v_cre dinero; v_deb_s dinero; v_cre_s dinero;
BEGIN
  SELECT COALESCE(SUM(debito),0), COALESCE(SUM(credito),0) INTO v_deb, v_cre FROM documento_lineas;
  SELECT COALESCE(SUM(debito),0), COALESCE(SUM(credito),0) INTO v_deb_s, v_cre_s FROM saldos_cuenta;

  IF v_deb <> v_cre THEN RAISE EXCEPTION 'FALLO 7: libro descuadrado'; END IF;
  IF v_deb_s <> v_cre_s THEN RAISE EXCEPTION 'FALLO 8: saldos descuadrados'; END IF;
  RAISE NOTICE 'OK: libro cuadrado (%). Saldos por cuenta: débito % = crédito %', v_deb, v_deb_s, v_cre_s;
END $$;

-- 6. Anulación con reversión trazable (no borra el original).
DO $$
DECLARE
  v_rev bigint; v_orig_estado text; v_orig_id bigint;
BEGIN
  SELECT id INTO v_orig_id FROM documentos WHERE numero = 245 AND estado = 'Contabilizado' LIMIT 1;

  v_rev := anular_documento(v_orig_id, 1, 'Corrección de período', 'soporte.pdf',
                            (SELECT id FROM comprobantes WHERE codigo='NI'), '2026-02-28', '02');

  SELECT estado INTO v_orig_estado FROM documentos WHERE id = v_orig_id;

  IF v_orig_estado <> 'Anulado' THEN
    RAISE EXCEPTION 'FALLO 9: el original no quedó anulado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM documentos WHERE id = v_rev AND documento_original_id = v_orig_id) THEN
    RAISE EXCEPTION 'FALLO 10: no se creó la reversión enlazada';
  END IF;
  RAISE NOTICE 'OK: documento anulado con reversión enlazada (reversión %)', v_rev;
END $$;

-- 7. Restricción de integridad: no se puede borrar una cuenta con hijas.
DO $$
DECLARE
  v_cuenta_padre bigint;
BEGIN
  SELECT id INTO v_cuenta_padre FROM cuentas WHERE codigo = '1105';
  BEGIN
    DELETE FROM cuentas WHERE id = v_cuenta_padre;
    RAISE EXCEPTION 'FALLO 11: se borró una cuenta con hijas (viola integridad)';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'OK: la base impide borrar una cuenta con hijas';
  END;
END $$;

\echo '=== VALIDACIÓN COMPLETA ==='
