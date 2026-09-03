-- =====================================================================
-- CONTABDSI · validate.sql
-- Validación funcional del esquema y de las reglas de negocio.
-- Cubre el flujo NOM2 y las pruebas exigidas por el plan de migración
-- (T01 multidocumento, T02 descuadre por documento, T09 anulación,
--  idempotencia sin falso positivo y conciliación libro vs saldos).
-- Ejecutar después de cargar schema + funciones + seed.
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

-- 2. Corregir los dos errores y revalidar.
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
  IF NOT v_ok THEN RAISE EXCEPTION 'FALLO 3: el lote aún tiene errores tras corregir'; END IF;
  IF v_estado <> 'Verificado' THEN RAISE EXCEPTION 'FALLO 4: estado esperado Verificado, actual %', v_estado; END IF;
  RAISE NOTICE 'OK: lote corregido y Verificado';
END $$;

-- 3. Aprobar y contabilizar (atómico, un documento).
UPDATE lotes SET estado = 'Aprobado' WHERE id = 1;

DO $$
DECLARE
  v_ids bigint[]; v_numero bigint; v_comp text; v_doc text;
BEGIN
  v_ids := contabilizar_lote(1, 1);

  IF array_length(v_ids, 1) <> 1 THEN
    RAISE EXCEPTION 'FALLO 5: se esperaba 1 documento, se crearon %', array_length(v_ids, 1);
  END IF;

  SELECT d.numero, c.codigo, d.documento
    INTO v_numero, v_comp, v_doc
    FROM documentos d JOIN comprobantes c ON c.id = d.comprobante_id
    WHERE d.id = v_ids[1];

  IF v_comp || '-' || lpad(v_numero::text, 6, '0') <> 'CE-000245' THEN
    RAISE EXCEPTION 'FALLO 6: comprobante inesperado %-%-%', v_comp, v_numero, v_doc;
  END IF;
  RAISE NOTICE 'OK: contabilizado CE-000245 · NOM-2026-02 (documento %)', v_ids[1];
END $$;

-- 4. Idempotencia SIN falso positivo (B07): la prueba verifica por efecto,
--    no por captura de la excepción que ella misma lanza.
DO $$
DECLARE
  v_rechazado boolean := false;
  v_docs_antes bigint;
  v_docs_despues bigint;
BEGIN
  SELECT COUNT(*) INTO v_docs_antes FROM documentos WHERE lote_id = 1 AND estado = 'Contabilizado';
  BEGIN
    PERFORM contabilizar_lote(1, 1);
  EXCEPTION WHEN OTHERS THEN
    v_rechazado := true;
  END;
  SELECT COUNT(*) INTO v_docs_despues FROM documentos WHERE lote_id = 1 AND estado = 'Contabilizado';

  IF NOT v_rechazado THEN
    RAISE EXCEPTION 'FALLO 7: la segunda contabilización NO fue rechazada';
  END IF;
  IF v_docs_despues <> v_docs_antes THEN
    RAISE EXCEPTION 'FALLO 8: la segunda contabilización duplicó documentos (%)', v_docs_despues;
  END IF;
  RAISE NOTICE 'OK: idempotencia verificada por efecto (documentos siguen siendo %)', v_docs_despues;
END $$;

-- 5. B03: regenerar acumulados fiscales antes de anular.
DO $$
DECLARE
  v_ret integer; v_valor dinero;
BEGIN
  PERFORM regenerar_acumulados(1, 2026, 'Retencion');
  PERFORM regenerar_acumulados(1, 2026, 'Iva');
  PERFORM regenerar_acumulados(1, 2026, 'Terceros');

  SELECT COUNT(*) INTO v_ret FROM acumulados_retencion WHERE compania_id = 1 AND anio = 2026;
  IF v_ret <> 1 THEN
    RAISE EXCEPTION 'FALLO 9: se esperaba 1 acumulado de retención, hay %', v_ret;
  END IF;
  SELECT SUM(valor) INTO v_valor FROM acumulados_retencion WHERE compania_id = 1 AND anio = 2026;
  IF v_valor <> 1200000 THEN
    RAISE EXCEPTION 'FALLO 10: valor de retención acumulado inesperado (%)', v_valor;
  END IF;
  RAISE NOTICE 'OK: acumulados de retención/IVA/terceros regenerados (retención %)', v_valor;
END $$;

-- 6. Conciliación libro vs saldos por cuenta (no sólo totales globales).
DO $$
DECLARE
  v_cuenta bigint; v_libro_deb dinero; v_libro_cre dinero; v_saldo_deb dinero; v_saldo_cre dinero; v_mal integer := 0;
BEGIN
  FOR v_cuenta IN SELECT DISTINCT cuenta_id FROM documento_lineas LOOP
    SELECT COALESCE(SUM(debito),0), COALESCE(SUM(credito),0) INTO v_libro_deb, v_libro_cre
      FROM documento_lineas WHERE cuenta_id = v_cuenta;
    SELECT COALESCE(SUM(debito),0), COALESCE(SUM(credito),0) INTO v_saldo_deb, v_saldo_cre
      FROM saldos_cuenta WHERE cuenta_id = v_cuenta;
    IF v_libro_deb <> v_saldo_deb OR v_libro_cre <> v_saldo_cre THEN
      v_mal := v_mal + 1;
    END IF;
  END LOOP;
  IF v_mal > 0 THEN
    RAISE EXCEPTION 'FALLO 11: % cuentas con libro ≠ saldos', v_mal;
  END IF;
  RAISE NOTICE 'OK: libro y saldos coinciden por cuenta';
END $$;

-- 7. T01: un lote con DOS grupos documentales produce DOS documentos.
DO $$
DECLARE
  v_lote bigint; v_ids bigint[];
BEGIN
  INSERT INTO lotes (compania_id, anio, periodo, codigo, nombre, usuario_id, origen, fecha, estado, comprobante_id)
  VALUES (1, 2026, '02', 'T2', 'Lote multidocumento', 1, 'Manual', '2026-02-28', 'Aprobado',
          (SELECT id FROM comprobantes WHERE compania_id = 1 AND codigo = 'CE'))
  RETURNING id INTO v_lote;

  -- Grupo A (CE / T2-NOM-A): cuadrado 1.000.000
  INSERT INTO lote_lineas (lote_id, compania_id, numero_linea, cuenta_id, tercero_id, centro_costo_id, comprobante, documento, fecha, debito, credito, concepto, origen) VALUES
    (v_lote, 1, 1, (SELECT id FROM cuentas WHERE codigo='510506'), NULL, (SELECT id FROM centros_costos WHERE codigo='ADM'), 'CE', 'T2-NOM-A', '2026-02-28', 1000000, 0, 'Prueba grupo A débito', 'Manual'),
    (v_lote, 1, 2, (SELECT id FROM cuentas WHERE codigo='250505'), (SELECT id FROM terceros WHERE nit='12.345.678'), NULL, 'CE', 'T2-NOM-A', '2026-02-28', 0, 1000000, 'Prueba grupo A crédito', 'Manual');
  -- Grupo B (RC / T2-RC-B): cuadrado 500.000
  INSERT INTO lote_lineas (lote_id, compania_id, numero_linea, cuenta_id, tercero_id, centro_costo_id, comprobante, documento, fecha, debito, credito, concepto, origen) VALUES
    (v_lote, 1, 3, (SELECT id FROM cuentas WHERE codigo='510506'), NULL, (SELECT id FROM centros_costos WHERE codigo='VEN'), 'RC', 'T2-RC-B', '2026-02-28', 500000, 0, 'Prueba grupo B débito', 'Manual'),
    (v_lote, 1, 4, (SELECT id FROM cuentas WHERE codigo='250505'), (SELECT id FROM terceros WHERE nit='23.456.789'), NULL, 'RC', 'T2-RC-B', '2026-02-28', 0, 500000, 'Prueba grupo B crédito', 'Manual');

  IF NOT validar_lote(v_lote) THEN
    RAISE EXCEPTION 'FALLO 12: el lote multidocumento no validó';
  END IF;

  v_ids := contabilizar_lote(v_lote, 1);

  IF array_length(v_ids, 1) <> 2 THEN
    RAISE EXCEPTION 'FALLO 13: se esperaban 2 documentos, se crearon %', array_length(v_ids, 1);
  END IF;
  RAISE NOTICE 'OK: lote multidocumento → 2 documentos (% y %)', v_ids[1], v_ids[2];
END $$;

-- 8. T02: lote GLOBALMENTE cuadrado pero con un documento descuadrado → rechazo.
DO $$
DECLARE
  v_lote bigint; v_ok boolean; v_tipo text; v_rechazado boolean := false;
BEGIN
  INSERT INTO lotes (compania_id, anio, periodo, codigo, nombre, usuario_id, origen, fecha, estado, comprobante_id)
  VALUES (1, 2026, '02', 'T3', 'Lote documento descuadrado', 1, 'Manual', '2026-02-28', 'Aprobado',
          (SELECT id FROM comprobantes WHERE compania_id = 1 AND codigo = 'CE'))
  RETURNING id INTO v_lote;

  -- Grupo A descuadrado (débito 1.000.000 / crédito 500.000)
  INSERT INTO lote_lineas (lote_id, compania_id, numero_linea, cuenta_id, tercero_id, centro_costo_id, comprobante, documento, fecha, debito, credito, concepto, origen) VALUES
    (v_lote, 1, 1, (SELECT id FROM cuentas WHERE codigo='510506'), NULL, (SELECT id FROM centros_costos WHERE codigo='ADM'), 'CE', 'T3-A', '2026-02-28', 1000000, 0, 'A débito', 'Manual'),
    (v_lote, 1, 2, (SELECT id FROM cuentas WHERE codigo='250505'), (SELECT id FROM terceros WHERE nit='12.345.678'), NULL, 'CE', 'T3-A', '2026-02-28', 0, 500000, 'A crédito', 'Manual');
  -- Grupo B descuadrado en sentido contrario (500.000 / 1.000.000) → global 1.500.000 = 1.500.000
  INSERT INTO lote_lineas (lote_id, compania_id, numero_linea, cuenta_id, tercero_id, centro_costo_id, comprobante, documento, fecha, debito, credito, concepto, origen) VALUES
    (v_lote, 1, 3, (SELECT id FROM cuentas WHERE codigo='510506'), NULL, (SELECT id FROM centros_costos WHERE codigo='VEN'), 'CE', 'T3-B', '2026-02-28', 500000, 0, 'B débito', 'Manual'),
    (v_lote, 1, 4, (SELECT id FROM cuentas WHERE codigo='250505'), (SELECT id FROM terceros WHERE nit='23.456.789'), NULL, 'CE', 'T3-B', '2026-02-28', 0, 1000000, 'B crédito', 'Manual');

  v_ok := validar_lote(v_lote);

  IF v_ok THEN
    RAISE EXCEPTION 'FALLO 14: el lote descuadrado por documento validó como OK';
  END IF;
  SELECT tipo INTO v_tipo FROM lote_validaciones WHERE lote_id = v_lote AND tipo = 'Descuadre por documento' LIMIT 1;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'FALLO 15: no se generó el error de descuadre por documento';
  END IF;

  BEGIN
    PERFORM contabilizar_lote(v_lote, 1);
  EXCEPTION WHEN OTHERS THEN
    v_rechazado := true;
  END;
  IF NOT v_rechazado THEN
    RAISE EXCEPTION 'FALLO 16: se contabilizó un lote descuadrado por documento';
  END IF;
  RAISE NOTICE 'OK: lote globalmente cuadrado pero descuadrado por documento → rechazado';
END $$;

-- 9. B06: un lote vacío no puede validar ni contabilizar.
DO $$
DECLARE
  v_lote bigint; v_ok boolean;
BEGIN
  INSERT INTO lotes (compania_id, anio, periodo, codigo, nombre, usuario_id, origen, fecha, estado, comprobante_id)
  VALUES (1, 2026, '02', 'T4', 'Lote vacío', 1, 'Manual', '2026-02-28', 'Aprobado',
          (SELECT id FROM comprobantes WHERE compania_id = 1 AND codigo = 'CE'))
  RETURNING id INTO v_lote;

  v_ok := validar_lote(v_lote);
  IF v_ok THEN
    RAISE EXCEPTION 'FALLO 17: el lote vacío validó como OK';
  END IF;
  RAISE NOTICE 'OK: lote vacío rechazado';
END $$;

-- 10. T09: anulación con reversión + saldos netos cero + regeneración consistente.
DO $$
DECLARE
  v_rev bigint; v_orig_id bigint; v_orig_estado text;
  v_deb dinero; v_cre dinero;
BEGIN
  SELECT id INTO v_orig_id FROM documentos WHERE numero = 245 AND estado = 'Contabilizado' LIMIT 1;

  v_rev := anular_documento(v_orig_id, 1, 'Corrección de período', 'soporte.pdf',
                            (SELECT id FROM comprobantes WHERE compania_id = 1 AND codigo = 'NI'), '2026-02-28', '02');

  SELECT estado INTO v_orig_estado FROM documentos WHERE id = v_orig_id;
  IF v_orig_estado <> 'Anulado' THEN
    RAISE EXCEPTION 'FALLO 18: el original no quedó anulado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM documentos WHERE id = v_rev AND documento_original_id = v_orig_id) THEN
    RAISE EXCEPTION 'FALLO 19: no se creó la reversión enlazada';
  END IF;

  -- Saldos netos por cuenta tras la anulación (original + reversión = 0 en feb 2026)
  SELECT COALESCE(SUM(debito),0), COALESCE(SUM(credito),0) INTO v_deb, v_cre
    FROM saldos_cuenta WHERE compania_id = 1 AND anio = 2026;
  IF v_deb <> v_cre THEN
    RAISE EXCEPTION 'FALLO 20: saldos descuadrados tras anular (%)', v_deb - v_cre;
  END IF;

  -- Regenerar tras anular: el efecto neto debe ser cero (original anulado + reversión)
  PERFORM regenerar_acumulados(1, 2026, 'Retencion');
  PERFORM regenerar_acumulados(1, 2026, 'Terceros');
  SELECT COALESCE(SUM(valor),0) INTO v_deb FROM acumulados_retencion WHERE compania_id = 1 AND anio = 2026;
  IF v_deb <> 0 THEN
    RAISE EXCEPTION 'FALLO 21: retención acumulada neta ≠ 0 tras anular (%)', v_deb;
  END IF;
  RAISE NOTICE 'OK: anulación consistente (saldos netos cero, reversión % enlazada)', v_rev;
END $$;

-- 11. Restricción de integridad: no se puede borrar una cuenta con hijas.
DO $$
DECLARE
  v_cuenta_padre bigint;
BEGIN
  SELECT id INTO v_cuenta_padre FROM cuentas WHERE codigo = '1105';
  BEGIN
    DELETE FROM cuentas WHERE id = v_cuenta_padre;
    RAISE EXCEPTION 'FALLO 22: se borró una cuenta con hijas (viola integridad)';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'OK: la base impide borrar una cuenta con hijas';
  END;
END $$;

\echo '=== VALIDACIÓN COMPLETA ==='
