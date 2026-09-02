-- =====================================================================
-- CONTABDSI · funciones.sql
-- Reglas de negocio: validación de lotes, contabilización atómica,
-- anulación con reversión y regeneración de acumulados.
-- =====================================================================

-- -------------------------------------------------------------------
-- Valida un lote y recalcula sus issues (lote_validaciones) y estado.
-- Retorna true si no hay errores.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validar_lote(p_lote_id bigint)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_lote lotes%ROWTYPE;
  v_linea record;
  v_cuenta cuentas%ROWTYPE;
  v_tercero_ok boolean;
  v_centro_ok boolean;
  v_base_ok boolean;
  v_total_debito dinero := 0;
  v_total_credito dinero := 0;
  v_periodo text;
  v_mes text;
BEGIN
  SELECT * INTO v_lote FROM lotes WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote % no existe', p_lote_id;
  END IF;

  -- Limpiar validaciones previas
  DELETE FROM lote_validaciones WHERE lote_id = p_lote_id;

  v_periodo := v_lote.periodo;
  v_mes := v_periodo;

  FOR v_linea IN
    SELECT ll.* FROM lote_lineas ll WHERE ll.lote_id = p_lote_id ORDER BY ll.numero_linea
  LOOP
    -- Acumular totales
    v_total_debito := v_total_debito + v_linea.debito;
    v_total_credito := v_total_credito + v_linea.credito;

    IF v_linea.cuenta_id IS NULL THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Error', 'Linea', 'Cuenta invalida',
              'La línea no tiene cuenta asignada.', 'cuenta');
      CONTINUE;
    END IF;

    SELECT * INTO v_cuenta FROM cuentas WHERE id = v_linea.cuenta_id;

    IF NOT v_cuenta.afectable THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Error', 'Linea', 'Cuenta no afectable',
              'La cuenta ' || v_cuenta.codigo || ' no acepta movimiento.', 'cuenta');
    END IF;

    IF v_linea.debito <> 0 AND v_linea.credito <> 0 THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Error', 'Linea', 'Doble valor',
              'La línea tiene débito y crédito simultáneamente.', 'debito');
    END IF;

    IF v_linea.debito = 0 AND v_linea.credito = 0 THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Error', 'Linea', 'Sin valor',
              'La línea no tiene débito ni crédito.', 'debito');
    END IF;

    -- Tercero obligatorio
    v_tercero_ok := v_linea.tercero_id IS NOT NULL;
    IF v_cuenta.controla_tercero AND NOT v_tercero_ok THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Error', 'Linea', 'Tercero obligatorio',
              'La cuenta ' || v_cuenta.codigo || ' controla tercero.', 'tercero');
    END IF;

    -- Centro obligatorio
    v_centro_ok := v_linea.centro_costo_id IS NOT NULL;
    IF v_cuenta.controla_centro AND NOT v_centro_ok THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Error', 'Linea', 'Centro obligatorio',
              'La cuenta ' || v_cuenta.codigo || ' controla centro de costo.', 'centro');
    END IF;

    -- Base obligatoria para cuentas con clase fiscal
    v_base_ok := v_linea.base > 0;
    IF (v_cuenta.controla_base OR v_linea.clase IN ('IVA', 'Retencion')) AND NOT v_base_ok THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Error', 'Linea', 'Base obligatoria',
              'La línea de clase ' || v_linea.clase || ' requiere base.', 'base');
    END IF;

    -- Fecha debe concordar con el período (mes)
    IF v_linea.fecha IS NOT NULL
       AND to_char(v_linea.fecha, 'MM') <> v_periodo
       AND v_periodo BETWEEN '01' AND '12' THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Advertencia', 'Linea', 'Fecha vs período',
              'La fecha ' || v_linea.fecha || ' no coincide con el período ' || v_periodo || '.', 'fecha');
    END IF;
  END LOOP;

  -- Descuadre global
  IF v_total_debito <> v_total_credito THEN
    INSERT INTO lote_validaciones (lote_id, severidad, ambito, tipo, mensaje)
    VALUES (p_lote_id, 'Error', 'Global', 'Descuadre',
            'El lote está descuadrado: débito ' || v_total_debito || ' vs crédito ' || v_total_credito || '.');
  END IF;

  -- Documento ya contabilizado (duplicado)
  IF v_lote.documento IS NOT NULL AND v_lote.comprobante_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM documentos d
      WHERE d.compania_id = v_lote.compania_id
        AND d.anio = v_lote.anio
        AND d.documento = v_lote.documento
        AND d.estado = 'Contabilizado'
    ) THEN
      INSERT INTO lote_validaciones (lote_id, severidad, ambito, tipo, mensaje)
      VALUES (p_lote_id, 'Error', 'Documento', 'Ya contabilizado',
              'El documento ' || v_lote.documento || ' ya fue contabilizado.');
    END IF;
  END IF;

  -- Actualizar estado
  UPDATE lotes SET estado = CASE
    WHEN EXISTS (SELECT 1 FROM lote_validaciones v WHERE v.lote_id = p_lote_id AND v.severidad = 'Error')
      THEN 'Con errores'
    ELSE 'Verificado'
  END
  WHERE id = p_lote_id;

  RETURN NOT EXISTS (SELECT 1 FROM lote_validaciones v WHERE v.lote_id = p_lote_id AND v.severidad = 'Error');
END;
$$;

-- -------------------------------------------------------------------
-- Contabiliza un lote de forma ATÓMICA.
-- Crea documento + líneas, actualiza saldos y avanza consecutivos.
-- Si algo falla, la transacción externa hace rollback completo.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION contabilizar_lote(p_lote_id bigint, p_usuario_id integer)
RETURNS bigint  -- id del documento creado
LANGUAGE plpgsql
AS $$
DECLARE
  v_lote lotes%ROWTYPE;
  v_linea record;
  v_comprobante comprobantes%ROWTYPE;
  v_consecutivo bigint;
  v_documento_id bigint;
  v_periodo_cerrado boolean;
  v_total_debito dinero := 0;
  v_total_credito dinero := 0;
BEGIN
  SELECT * INTO v_lote FROM lotes WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote % no existe', p_lote_id;
  END IF;

  IF v_lote.estado <> 'Aprobado' THEN
    RAISE EXCEPTION 'El lote % no está Aprobado (estado actual: %)', p_lote_id, v_lote.estado;
  END IF;

  -- Período cerrado = solo lectura
  SELECT EXISTS (
    SELECT 1 FROM periodos_contables
    WHERE compania_id = v_lote.compania_id
      AND anio = v_lote.anio
      AND periodo = v_lote.periodo
      AND estado = 'Cerrado'
  ) INTO v_periodo_cerrado;

  IF v_periodo_cerrado THEN
    RAISE EXCEPTION 'El período %/% está cerrado.', v_lote.anio, v_lote.periodo;
  END IF;

  -- Revalidar (debe quedar sin errores)
  IF NOT validar_lote(p_lote_id) THEN
    RAISE EXCEPTION 'El lote % tiene errores; no se puede contabilizar.', p_lote_id;
  END IF;

  -- Idempotencia: si ya se contabilizó, no repetir
  IF EXISTS (SELECT 1 FROM documentos d WHERE d.lote_id = p_lote_id AND d.estado = 'Contabilizado') THEN
    RAISE EXCEPTION 'El lote % ya fue contabilizado (idempotencia).', p_lote_id;
  END IF;

  SELECT * INTO v_comprobante FROM comprobantes WHERE id = v_lote.comprobante_id;

  -- Avanzar consecutivo por compañía/año/comprobante
  SELECT consecutivo_actual INTO v_consecutivo
    FROM consecutivos_comprobantes
    WHERE compania_id = v_lote.compania_id
      AND anio = v_lote.anio
      AND comprobante_id = v_lote.comprobante_id
    FOR UPDATE;

  IF NOT FOUND THEN
    v_consecutivo := 1;
    INSERT INTO consecutivos_comprobantes (compania_id, anio, comprobante_id, consecutivo_actual)
    VALUES (v_lote.compania_id, v_lote.anio, v_lote.comprobante_id, v_consecutivo + 1);
  ELSE
    UPDATE consecutivos_comprobantes
      SET consecutivo_actual = consecutivo_actual + 1
      WHERE compania_id = v_lote.compania_id
        AND anio = v_lote.anio
        AND comprobante_id = v_lote.comprobante_id;
  END IF;

  -- Crear documento contable
  INSERT INTO documentos
    (compania_id, anio, comprobante_id, numero, documento, fecha, periodo,
     tercero_id, concepto, estado, lote_id, usuario_id)
  VALUES
    (v_lote.compania_id, v_lote.anio, v_lote.comprobante_id, v_consecutivo,
     v_lote.documento, v_lote.fecha, v_lote.periodo,
     (SELECT tercero_id FROM lote_lineas WHERE lote_id = p_lote_id AND tercero_id IS NOT NULL LIMIT 1),
     v_lote.nombre, 'Contabilizado', p_lote_id, p_usuario_id)
  RETURNING id INTO v_documento_id;

  -- Copiar líneas y actualizar saldos
  FOR v_linea IN
    SELECT * FROM lote_lineas WHERE lote_id = p_lote_id ORDER BY numero_linea
  LOOP
    v_total_debito := v_total_debito + v_linea.debito;
    v_total_credito := v_total_credito + v_linea.credito;

    INSERT INTO documento_lineas
      (documento_id, numero_linea, cuenta_id, tercero_id, centro_costo_id,
       debito, credito, base, clase, documento_afectado, concepto, origen)
    VALUES
      (v_documento_id, v_linea.numero_linea, v_linea.cuenta_id, v_linea.tercero_id,
       v_linea.centro_costo_id, v_linea.debito, v_linea.credito, v_linea.base,
       v_linea.clase, v_linea.documento_afectado, v_linea.concepto, v_linea.origen);

    -- Saldo por cuenta
    INSERT INTO saldos_cuenta (compania_id, anio, periodo, cuenta_id, debito, credito)
    VALUES (v_lote.compania_id, v_lote.anio, v_lote.periodo, v_linea.cuenta_id, v_linea.debito, v_linea.credito)
    ON CONFLICT (compania_id, anio, periodo, cuenta_id)
    DO UPDATE SET debito = saldos_cuenta.debito + EXCLUDED.debito,
                  credito = saldos_cuenta.credito + EXCLUDED.credito;

    -- Saldo por cuenta + tercero
    IF v_linea.tercero_id IS NOT NULL THEN
      INSERT INTO saldos_cuenta_tercero (compania_id, anio, periodo, cuenta_id, tercero_id, debito, credito)
      VALUES (v_lote.compania_id, v_lote.anio, v_lote.periodo, v_linea.cuenta_id, v_linea.tercero_id, v_linea.debito, v_linea.credito)
      ON CONFLICT (compania_id, anio, periodo, cuenta_id, tercero_id)
      DO UPDATE SET debito = saldos_cuenta_tercero.debito + EXCLUDED.debito,
                    credito = saldos_cuenta_tercero.credito + EXCLUDED.credito;
    END IF;

    -- Saldo por cuenta + centro
    IF v_linea.centro_costo_id IS NOT NULL THEN
      INSERT INTO saldos_cuenta_centro (compania_id, anio, periodo, cuenta_id, centro_costo_id, debito, credito)
      VALUES (v_lote.compania_id, v_lote.anio, v_lote.periodo, v_linea.cuenta_id, v_linea.centro_costo_id, v_linea.debito, v_linea.credito)
      ON CONFLICT (compania_id, anio, periodo, cuenta_id, centro_costo_id)
      DO UPDATE SET debito = saldos_cuenta_centro.debito + EXCLUDED.debito,
                    credito = saldos_cuenta_centro.credito + EXCLUDED.credito;
    END IF;
  END LOOP;

  IF v_total_debito <> v_total_credito THEN
    RAISE EXCEPTION 'Abortando contabilización: débito % ≠ crédito %', v_total_debito, v_total_credito;
  END IF;

  -- Marcar lote como contabilizado
  UPDATE lotes SET estado = 'Contabilizado' WHERE id = p_lote_id;

  -- Bitácora
  INSERT INTO auditoria (compania_id, anio, usuario_id, accion, modulo, detalle, resultado)
  VALUES (v_lote.compania_id, v_lote.anio, p_usuario_id, 'Contabilización de lote', 'Lotes',
          'Lote ' || v_lote.codigo || ' → ' || v_comprobante.codigo || '-' || lpad(v_consecutivo::text, 6, '0'),
          'EXITO');

  RETURN v_documento_id;
END;
$$;

-- -------------------------------------------------------------------
-- Anula un documento contabilizado creando su reversión trazable.
-- No borra el documento original.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION anular_documento(
  p_documento_id bigint,
  p_usuario_id integer,
  p_motivo text,
  p_soporte text,
  p_comprobante_id bigint,
  p_fecha date,
  p_periodo text
)
RETURNS bigint  -- id del documento de reversión
LANGUAGE plpgsql
AS $$
DECLARE
  v_doc documentos%ROWTYPE;
  v_linea record;
  v_consecutivo bigint;
  v_reversion_id bigint;
BEGIN
  SELECT * INTO v_doc FROM documentos WHERE id = p_documento_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento % no existe', p_documento_id;
  END IF;
  IF v_doc.estado = 'Anulado' THEN
    RAISE EXCEPTION 'El documento % ya está anulado.', p_documento_id;
  END IF;

  -- Consecutivo de la reversión
  SELECT consecutivo_actual INTO v_consecutivo
    FROM consecutivos_comprobantes
    WHERE compania_id = v_doc.compania_id AND anio = v_doc.anio AND comprobante_id = p_comprobante_id
    FOR UPDATE;
  IF NOT FOUND THEN
    v_consecutivo := 1;
    INSERT INTO consecutivos_comprobantes (compania_id, anio, comprobante_id, consecutivo_actual)
    VALUES (v_doc.compania_id, v_doc.anio, p_comprobante_id, v_consecutivo + 1);
  ELSE
    UPDATE consecutivos_comprobantes SET consecutivo_actual = consecutivo_actual + 1
      WHERE compania_id = v_doc.compania_id AND anio = v_doc.anio AND comprobante_id = p_comprobante_id;
  END IF;

  INSERT INTO documentos
    (compania_id, anio, comprobante_id, numero, documento, fecha, periodo, tercero_id,
     concepto, estado, usuario_id, documento_original_id, motivo_anulacion, soporte_anulacion)
  VALUES
    (v_doc.compania_id, v_doc.anio, p_comprobante_id, v_consecutivo,
     'REV-' || v_doc.documento, p_fecha, p_periodo, v_doc.tercero_id,
     'Reversión de ' || v_doc.documento, 'Contabilizado', p_usuario_id,
     v_doc.id, p_motivo, p_soporte)
  RETURNING id INTO v_reversion_id;

  -- Líneas invertidas
  FOR v_linea IN SELECT * FROM documento_lineas WHERE documento_id = p_documento_id ORDER BY numero_linea LOOP
    INSERT INTO documento_lineas
      (documento_id, numero_linea, cuenta_id, tercero_id, centro_costo_id,
       debito, credito, base, clase, documento_afectado, concepto, origen)
    VALUES
      (v_reversion_id, v_linea.numero_linea, v_linea.cuenta_id, v_linea.tercero_id, v_linea.centro_costo_id,
       v_linea.credito, v_linea.debito, v_linea.base, v_linea.clase,
       v_linea.documento_afectado, 'Reversión de ' || v_linea.concepto, 'Reversion');
  END LOOP;

  -- Marcar original anulado
  UPDATE documentos SET estado = 'Anulado', motivo_anulacion = p_motivo WHERE id = p_documento_id;

  INSERT INTO auditoria (compania_id, anio, usuario_id, accion, modulo, detalle, resultado, motivo)
  VALUES (v_doc.compania_id, v_doc.anio, p_usuario_id, 'Anulación de documento', 'Anulación',
          'Reversión de ' || v_doc.documento, 'EXITO', p_motivo);

  RETURN v_reversion_id;
END;
$$;

-- -------------------------------------------------------------------
-- Regenera los acumulados de un tipo desde el libro.
-- "Limpiar" = borrar derivados; esta función los reconstruye.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION regenerar_acumulados(p_compania_id bigint, p_anio integer, p_tipo text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_tipo IN ('Retencion', 'Terceros') THEN
    DELETE FROM acumulados_tercero WHERE compania_id = p_compania_id AND anio = p_anio;
    INSERT INTO acumulados_tercero (compania_id, anio, tercero_id, cuenta_id, debito, credito)
    SELECT d.compania_id, d.anio, l.tercero_id, l.cuenta_id, SUM(l.debito), SUM(l.credito)
    FROM documento_lineas l
    JOIN documentos d ON d.id = l.documento_id
    WHERE d.compania_id = p_compania_id AND d.anio = p_anio AND d.estado = 'Contabilizado'
      AND l.tercero_id IS NOT NULL
    GROUP BY d.compania_id, d.anio, l.tercero_id, l.cuenta_id;
  END IF;

  IF p_tipo = 'Centros' THEN
    DELETE FROM acumulados_centro WHERE compania_id = p_compania_id AND anio = p_anio;
    INSERT INTO acumulados_centro (compania_id, anio, centro_costo_id, cuenta_id, debito, credito)
    SELECT d.compania_id, d.anio, l.centro_costo_id, l.cuenta_id, SUM(l.debito), SUM(l.credito)
    FROM documento_lineas l
    JOIN documentos d ON d.id = l.documento_id
    WHERE d.compania_id = p_compania_id AND d.anio = p_anio AND d.estado = 'Contabilizado'
      AND l.centro_costo_id IS NOT NULL
    GROUP BY d.compania_id, d.anio, l.centro_costo_id, l.cuenta_id;
  END IF;

  -- Marcar fecha de última acumulación
  INSERT INTO estado_acumulaciones (compania_id, anio, tipo, periodo_hasta, ultima_acumulacion)
  VALUES (p_compania_id, p_anio, p_tipo, '12', now())
  ON CONFLICT (compania_id, anio, tipo)
  DO UPDATE SET ultima_acumulacion = now(), periodo_hasta = EXCLUDED.periodo_hasta;
END;
$$;
