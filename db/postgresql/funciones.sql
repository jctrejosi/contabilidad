-- =====================================================================
-- CONTABDSI · funciones.sql
-- Reglas de negocio: validación de lotes, contabilización atómica
-- (multi-documento por lote), anulación con reversión consistente y
-- regeneración de acumulados (terceros, centros, retención e IVA).
-- =====================================================================

-- -------------------------------------------------------------------
-- Valida un lote y recalcula sus issues (lote_validaciones) y estado.
-- B06: rechaza lotes vacíos y sólo permite validar estados editables.
-- B01: valida balance POR DOCUMENTO, no sólo global (T02).
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validar_lote(p_lote_id bigint)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_lote lotes%ROWTYPE;
  v_linea record;
  v_grupo record;
  v_cuenta cuentas%ROWTYPE;
  v_total_debito dinero := 0;
  v_total_credito dinero := 0;
  v_periodo text;
BEGIN
  SELECT * INTO v_lote FROM lotes WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote % no existe', p_lote_id;
  END IF;

  -- B06: sólo se validan lotes editables; nunca un libro ya contabilizado
  IF v_lote.estado NOT IN ('Borrador', 'Con errores', 'Verificado', 'Pendiente aprobacion', 'Aprobado') THEN
    RAISE EXCEPTION 'El lote % está en estado % y no admite revalidación.', p_lote_id, v_lote.estado;
  END IF;

  -- Limpiar validaciones previas
  DELETE FROM lote_validaciones WHERE lote_id = p_lote_id;

  -- B06: un lote vacío no puede "cuadrar 0=0"
  IF NOT EXISTS (SELECT 1 FROM lote_lineas WHERE lote_id = p_lote_id) THEN
    INSERT INTO lote_validaciones (lote_id, severidad, ambito, tipo, mensaje)
    VALUES (p_lote_id, 'Error', 'Global', 'Lote vacío',
            'El lote no tiene líneas. Agregue al menos una línea antes de verificar.');
    UPDATE lotes SET estado = 'Con errores' WHERE id = p_lote_id AND estado IN ('Borrador', 'Con errores', 'Verificado');
    RETURN false;
  END IF;

  v_periodo := v_lote.periodo;

  FOR v_linea IN
    SELECT ll.* FROM lote_lineas ll WHERE ll.lote_id = p_lote_id ORDER BY ll.numero_linea
  LOOP
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

    IF v_cuenta.controla_tercero AND v_linea.tercero_id IS NULL THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Error', 'Linea', 'Tercero obligatorio',
              'La cuenta ' || v_cuenta.codigo || ' controla tercero.', 'tercero');
    END IF;

    IF v_cuenta.controla_centro AND v_linea.centro_costo_id IS NULL THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Error', 'Linea', 'Centro obligatorio',
              'La cuenta ' || v_cuenta.codigo || ' controla centro de costo.', 'centro');
    END IF;

    IF (v_cuenta.controla_base OR v_linea.clase IN ('IVA', 'Retencion')) AND v_linea.base <= 0 THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Error', 'Linea', 'Base obligatoria',
              'La línea de clase ' || v_linea.clase || ' requiere base.', 'base');
    END IF;

    -- B03: concepto/tarifa explícitos por renglón (no se infiere la vigente)
    IF v_linea.clase = 'Retencion' AND v_linea.concepto_retencion_id IS NULL THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Error', 'Linea', 'Concepto de retención faltante',
              'La línea de retención debe indicar el concepto aplicado.', 'concepto');
    END IF;
    IF v_linea.clase = 'IVA' AND v_linea.tarifa_iva_id IS NULL THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Error', 'Linea', 'Tarifa de IVA faltante',
              'La línea de IVA debe indicar la tarifa aplicada.', 'tarifa');
    END IF;

    IF v_linea.fecha IS NOT NULL
       AND to_char(v_linea.fecha, 'MM') <> v_periodo
       AND v_periodo BETWEEN '01' AND '12' THEN
      INSERT INTO lote_validaciones (lote_id, linea_id, severidad, ambito, tipo, mensaje, campo)
      VALUES (p_lote_id, v_linea.id, 'Advertencia', 'Linea', 'Fecha vs período',
              'La fecha ' || v_linea.fecha || ' no coincide con el período ' || v_periodo || '.', 'fecha');
    END IF;
  END LOOP;

  -- B01/T02: balance POR GRUPO DOCUMENTAL (documento+fecha), no sólo global
  FOR v_grupo IN
    SELECT COALESCE(comprobante, '') AS comprobante,
           COALESCE(documento, '') AS documento,
           fecha,
           SUM(debito) AS debito, SUM(credito) AS credito
    FROM lote_lineas WHERE lote_id = p_lote_id
    GROUP BY COALESCE(comprobante, ''), COALESCE(documento, ''), fecha
  LOOP
    IF v_grupo.debito <> v_grupo.credito THEN
      INSERT INTO lote_validaciones (lote_id, severidad, ambito, tipo, mensaje)
      VALUES (p_lote_id, 'Error', 'Documento',
              'Descuadre por documento',
              'El documento ' || v_grupo.documento || ' está descuadrado: débito '
              || v_grupo.debito || ' vs crédito ' || v_grupo.credito || '.');
    END IF;
  END LOOP;

  -- Descuadre global
  IF v_total_debito <> v_total_credito THEN
    INSERT INTO lote_validaciones (lote_id, severidad, ambito, tipo, mensaje)
    VALUES (p_lote_id, 'Error', 'Global', 'Descuadre',
            'El lote está descuadrado: débito ' || v_total_debito || ' vs crédito ' || v_total_credito || '.');
  END IF;

  -- Documento ya contabilizado (duplicado)
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

  -- Actualizar estado sólo si el lote está en un estado editable
  -- (un lote Aprobado/Pendiente no se degrada al revalidar)
  UPDATE lotes SET estado = CASE
    WHEN EXISTS (SELECT 1 FROM lote_validaciones v WHERE v.lote_id = p_lote_id AND v.severidad = 'Error')
      THEN 'Con errores'
    ELSE 'Verificado'
  END
  WHERE id = p_lote_id AND estado IN ('Borrador', 'Con errores', 'Verificado');

  RETURN NOT EXISTS (SELECT 1 FROM lote_validaciones v WHERE v.lote_id = p_lote_id AND v.severidad = 'Error');
END;
$$;

-- -------------------------------------------------------------------
-- Contabiliza un lote de forma ATÓMICA.
-- B01: crea UN documento por grupo documental (comprobante/documento/
-- fecha), valida el balance de cada grupo y avanza consecutivos.
-- Si algo falla, la transacción externa hace rollback completo.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION contabilizar_lote(p_lote_id bigint, p_usuario_id bigint)
RETURNS bigint[]  -- ids de los documentos creados (uno por grupo)
LANGUAGE plpgsql
AS $$
DECLARE
  v_lote lotes%ROWTYPE;
  v_grupo record;
  v_linea record;
  v_comprobante_id bigint;
  v_consecutivo bigint;
  v_documento_id bigint;
  v_ids bigint[] := '{}';
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

  -- Período cerrado = solo lectura (B05/T05)
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

  -- Revalidar (debe quedar sin errores, incluye balance por documento)
  IF NOT validar_lote(p_lote_id) THEN
    RAISE EXCEPTION 'El lote % tiene errores; no se puede contabilizar.', p_lote_id;
  END IF;

  -- Idempotencia: si ya se contabilizó, no repetir
  IF EXISTS (SELECT 1 FROM documentos d WHERE d.lote_id = p_lote_id AND d.estado = 'Contabilizado') THEN
    RAISE EXCEPTION 'El lote % ya fue contabilizado (idempotencia).', p_lote_id;
  END IF;

  -- B01: iterar grupos documentales (comprobante + documento + fecha)
  FOR v_grupo IN
    SELECT COALESCE(ll.comprobante, c.codigo) AS comprobante,
           ll.documento,
           ll.fecha
    FROM lote_lineas ll
    LEFT JOIN comprobantes c ON c.id = v_lote.comprobante_id
    WHERE ll.lote_id = p_lote_id
    GROUP BY COALESCE(ll.comprobante, c.codigo), ll.documento, ll.fecha
    ORDER BY COALESCE(ll.comprobante, c.codigo), ll.documento, ll.fecha
  LOOP
    -- Resolver comprobante del grupo (por código, ámbito de compañía)
    SELECT id INTO v_comprobante_id
      FROM comprobantes
      WHERE compania_id = v_lote.compania_id AND codigo = v_grupo.comprobante;
    IF NOT FOUND THEN
      v_comprobante_id := v_lote.comprobante_id;
    END IF;

    -- Consecutivo por compañía/año/comprobante (bloqueado)
    SELECT consecutivo_actual INTO v_consecutivo
      FROM consecutivos_comprobantes
      WHERE compania_id = v_lote.compania_id
        AND anio = v_lote.anio
        AND comprobante_id = v_comprobante_id
      FOR UPDATE;

    IF NOT FOUND THEN
      v_consecutivo := 1;
      INSERT INTO consecutivos_comprobantes (compania_id, anio, comprobante_id, consecutivo_actual)
      VALUES (v_lote.compania_id, v_lote.anio, v_comprobante_id, v_consecutivo + 1);
    ELSE
      UPDATE consecutivos_comprobantes
        SET consecutivo_actual = consecutivo_actual + 1
        WHERE compania_id = v_lote.compania_id
          AND anio = v_lote.anio
          AND comprobante_id = v_comprobante_id;
    END IF;

    -- Crear documento del grupo
    INSERT INTO documentos
      (compania_id, anio, comprobante_id, numero, documento, tipo_documento_id,
       fecha, fecha_documento, periodo, tercero_id, concepto, estado, lote_id, usuario_id)
    VALUES
      (v_lote.compania_id, v_lote.anio, v_comprobante_id, v_consecutivo,
       v_grupo.documento,
       (SELECT tipo_documento_id FROM lote_lineas WHERE lote_id = p_lote_id
         AND documento = v_grupo.documento AND fecha = v_grupo.fecha
         AND tipo_documento_id IS NOT NULL LIMIT 1),
       v_lote.fecha, v_grupo.fecha, v_lote.periodo,
       (SELECT tercero_id FROM lote_lineas WHERE lote_id = p_lote_id AND tercero_id IS NOT NULL LIMIT 1),
       v_lote.nombre, 'Contabilizado', p_lote_id, p_usuario_id)
    RETURNING id INTO v_documento_id;

    -- Copiar líneas del grupo y actualizar saldos
    v_total_debito := 0;
    v_total_credito := 0;

    FOR v_linea IN
      SELECT * FROM lote_lineas
      WHERE lote_id = p_lote_id
        AND COALESCE(documento, '') = COALESCE(v_grupo.documento, '')
        AND fecha = v_grupo.fecha
      ORDER BY numero_linea
    LOOP
      v_total_debito := v_total_debito + v_linea.debito;
      v_total_credito := v_total_credito + v_linea.credito;

      INSERT INTO documento_lineas
        (documento_id, compania_id, numero_linea, cuenta_id, tercero_id,
         centro_costo_id, tipo_documento_id, debito, credito, base, clase,
         concepto_retencion_id, tarifa_iva_id, fecha_documento, valor_moneda,
         nit_alterno, documento_afectado, concepto, archivo_origen, origen)
      VALUES
        (v_documento_id, v_lote.compania_id, v_linea.numero_linea, v_linea.cuenta_id,
         v_linea.tercero_id, v_linea.centro_costo_id, v_linea.tipo_documento_id,
         v_linea.debito, v_linea.credito, v_linea.base, v_linea.clase,
         v_linea.concepto_retencion_id, v_linea.tarifa_iva_id, v_linea.fecha_documento,
         v_linea.valor_moneda, v_linea.nit_alterno, v_linea.documento_afectado,
         v_linea.concepto, v_linea.archivo_origen, v_linea.origen);

      -- Saldo por cuenta
      INSERT INTO saldos_cuenta (compania_id, anio, periodo, cuenta_id, debito, credito)
      VALUES (v_lote.compania_id, v_lote.anio, v_lote.periodo, v_linea.cuenta_id, v_linea.debito, v_linea.credito)
      ON CONFLICT (compania_id, anio, periodo, cuenta_id)
      DO UPDATE SET debito = saldos_cuenta.debito + EXCLUDED.debito,
                    credito = saldos_cuenta.credito + EXCLUDED.credito;

      IF v_linea.tercero_id IS NOT NULL THEN
        INSERT INTO saldos_cuenta_tercero (compania_id, anio, periodo, cuenta_id, tercero_id, debito, credito)
        VALUES (v_lote.compania_id, v_lote.anio, v_lote.periodo, v_linea.cuenta_id, v_linea.tercero_id, v_linea.debito, v_linea.credito)
        ON CONFLICT (compania_id, anio, periodo, cuenta_id, tercero_id)
        DO UPDATE SET debito = saldos_cuenta_tercero.debito + EXCLUDED.debito,
                      credito = saldos_cuenta_tercero.credito + EXCLUDED.credito;
      END IF;

      IF v_linea.centro_costo_id IS NOT NULL THEN
        INSERT INTO saldos_cuenta_centro (compania_id, anio, periodo, cuenta_id, centro_costo_id, debito, credito)
        VALUES (v_lote.compania_id, v_lote.anio, v_lote.periodo, v_linea.cuenta_id, v_linea.centro_costo_id, v_linea.debito, v_linea.credito)
        ON CONFLICT (compania_id, anio, periodo, cuenta_id, centro_costo_id)
        DO UPDATE SET debito = saldos_cuenta_centro.debito + EXCLUDED.debito,
                      credito = saldos_cuenta_centro.credito + EXCLUDED.credito;
      END IF;
    END LOOP;

    -- B01/T02: cada documento debe quedar cuadrado
    IF v_total_debito <> v_total_credito THEN
      RAISE EXCEPTION 'Abortando contabilización: el documento % quedó descuadrado (% ≠ %)',
        v_grupo.documento, v_total_debito, v_total_credito;
    END IF;

    v_ids := array_append(v_ids, v_documento_id);
  END LOOP;

  -- Marcar lote como contabilizado
  UPDATE lotes SET estado = 'Contabilizado' WHERE id = p_lote_id;

  INSERT INTO auditoria (compania_id, anio, usuario_id, accion, modulo, detalle, resultado)
  VALUES (v_lote.compania_id, v_lote.anio, p_usuario_id, 'Contabilización de lote', 'Lotes',
          'Lote ' || v_lote.codigo || ' → ' || array_length(v_ids, 1) || ' documento(s)',
          'EXITO');

  RETURN v_ids;
END;
$$;

-- -------------------------------------------------------------------
-- Anula un documento contabilizado creando su reversión trazable.
-- B02 corregido: también actualiza los saldos con el efecto invertido,
-- de modo que libro y saldos quedan consistentes (original + reversión = 0).
-- No borra el documento original.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION anular_documento(
  p_documento_id bigint,
  p_usuario_id bigint,
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

  -- Período cerrado = no se anula fuera del período autorizado (T05)
  IF EXISTS (
    SELECT 1 FROM periodos_contables
    WHERE compania_id = v_doc.compania_id AND anio = v_doc.anio
      AND periodo = p_periodo AND estado = 'Cerrado'
  ) THEN
    RAISE EXCEPTION 'El período %/% está cerrado; no se puede anular.', v_doc.anio, p_periodo;
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

  -- Líneas invertidas + reversión de saldos (B02)
  FOR v_linea IN SELECT * FROM documento_lineas WHERE documento_id = p_documento_id ORDER BY numero_linea LOOP
    INSERT INTO documento_lineas
      (documento_id, compania_id, numero_linea, cuenta_id, tercero_id, centro_costo_id,
       tipo_documento_id, debito, credito, base, clase, concepto_retencion_id, tarifa_iva_id,
       fecha_documento, valor_moneda, nit_alterno, documento_afectado, concepto, archivo_origen, origen)
    VALUES
      (v_reversion_id, v_linea.compania_id, v_linea.numero_linea, v_linea.cuenta_id, v_linea.tercero_id,
       v_linea.centro_costo_id, v_linea.tipo_documento_id,
       v_linea.credito, v_linea.debito, v_linea.base, v_linea.clase,
       v_linea.concepto_retencion_id, v_linea.tarifa_iva_id, v_linea.fecha_documento,
       v_linea.valor_moneda, v_linea.nit_alterno, v_linea.documento_afectado,
       'Reversión de ' || v_linea.concepto, v_linea.archivo_origen, 'Reversion');

    -- Saldos: aplicar el efecto invertido (las líneas ya vienen invertidas)
    INSERT INTO saldos_cuenta (compania_id, anio, periodo, cuenta_id, debito, credito)
    VALUES (v_linea.compania_id, v_doc.anio, p_periodo, v_linea.cuenta_id, v_linea.credito, v_linea.debito)
    ON CONFLICT (compania_id, anio, periodo, cuenta_id)
    DO UPDATE SET debito = saldos_cuenta.debito + EXCLUDED.debito,
                  credito = saldos_cuenta.credito + EXCLUDED.credito;

    IF v_linea.tercero_id IS NOT NULL THEN
      INSERT INTO saldos_cuenta_tercero (compania_id, anio, periodo, cuenta_id, tercero_id, debito, credito)
      VALUES (v_linea.compania_id, v_doc.anio, p_periodo, v_linea.cuenta_id, v_linea.tercero_id, v_linea.credito, v_linea.debito)
      ON CONFLICT (compania_id, anio, periodo, cuenta_id, tercero_id)
      DO UPDATE SET debito = saldos_cuenta_tercero.debito + EXCLUDED.debito,
                    credito = saldos_cuenta_tercero.credito + EXCLUDED.credito;
    END IF;

    IF v_linea.centro_costo_id IS NOT NULL THEN
      INSERT INTO saldos_cuenta_centro (compania_id, anio, periodo, cuenta_id, centro_costo_id, debito, credito)
      VALUES (v_linea.compania_id, v_doc.anio, p_periodo, v_linea.cuenta_id, v_linea.centro_costo_id, v_linea.credito, v_linea.debito)
      ON CONFLICT (compania_id, anio, periodo, cuenta_id, centro_costo_id)
      DO UPDATE SET debito = saldos_cuenta_centro.debito + EXCLUDED.debito,
                    credito = saldos_cuenta_centro.credito + EXCLUDED.credito;
    END IF;
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
-- B02/B03 corregido: incluye originales anulados Y sus reversiones
-- (efecto neto correcto) e implementa Retención e IVA por concepto/tarifa.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION regenerar_acumulados(p_compania_id bigint, p_anio integer, p_tipo text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_tipo IN ('Retencion', 'Terceros') THEN
    DELETE FROM acumulados_tercero WHERE compania_id = p_compania_id AND anio = p_anio;
    -- Originales (incluidos anulados) y reversiones participan con su signo
    INSERT INTO acumulados_tercero (compania_id, anio, tercero_id, cuenta_id, debito, credito)
    SELECT d.compania_id, d.anio, l.tercero_id, l.cuenta_id, SUM(l.debito), SUM(l.credito)
    FROM documento_lineas l
    JOIN documentos d ON d.id = l.documento_id
    WHERE d.compania_id = p_compania_id AND d.anio = p_anio
      AND d.estado IN ('Contabilizado', 'Anulado')
      AND l.tercero_id IS NOT NULL
    GROUP BY d.compania_id, d.anio, l.tercero_id, l.cuenta_id;
  END IF;

  IF p_tipo = 'Centros' THEN
    DELETE FROM acumulados_centro WHERE compania_id = p_compania_id AND anio = p_anio;
    INSERT INTO acumulados_centro (compania_id, anio, centro_costo_id, cuenta_id, debito, credito)
    SELECT d.compania_id, d.anio, l.centro_costo_id, l.cuenta_id, SUM(l.debito), SUM(l.credito)
    FROM documento_lineas l
    JOIN documentos d ON d.id = l.documento_id
    WHERE d.compania_id = p_compania_id AND d.anio = p_anio
      AND d.estado IN ('Contabilizado', 'Anulado')
      AND l.centro_costo_id IS NOT NULL
    GROUP BY d.compania_id, d.anio, l.centro_costo_id, l.cuenta_id;
  END IF;

  -- B03: retención por tercero/concepto/período (signo incluido)
  IF p_tipo = 'Retencion' THEN
    DELETE FROM acumulados_retencion WHERE compania_id = p_compania_id AND anio = p_anio;
    INSERT INTO acumulados_retencion (compania_id, anio, periodo, tercero_id, concepto_retencion_id, base, valor)
    SELECT d.compania_id, d.anio, d.periodo, l.tercero_id, l.concepto_retencion_id,
           SUM(l.base), SUM(CASE WHEN l.credito > 0 THEN l.credito ELSE -l.debito END)
    FROM documento_lineas l
    JOIN documentos d ON d.id = l.documento_id
    WHERE d.compania_id = p_compania_id AND d.anio = p_anio
      AND d.estado IN ('Contabilizado', 'Anulado')
      AND l.clase = 'Retencion' AND l.concepto_retencion_id IS NOT NULL
    GROUP BY d.compania_id, d.anio, d.periodo, l.tercero_id, l.concepto_retencion_id;
  END IF;

  -- B03: IVA por tercero/tarifa/período
  IF p_tipo = 'Iva' THEN
    DELETE FROM acumulados_iva WHERE compania_id = p_compania_id AND anio = p_anio;
    INSERT INTO acumulados_iva (compania_id, anio, periodo, tercero_id, tarifa_iva_id, base, valor)
    SELECT d.compania_id, d.anio, d.periodo, l.tercero_id, l.tarifa_iva_id,
           SUM(l.base), SUM(CASE WHEN l.credito > 0 THEN l.credito ELSE -l.debito END)
    FROM documento_lineas l
    JOIN documentos d ON d.id = l.documento_id
    WHERE d.compania_id = p_compania_id AND d.anio = p_anio
      AND d.estado IN ('Contabilizado', 'Anulado')
      AND l.clase = 'IVA' AND l.tarifa_iva_id IS NOT NULL
    GROUP BY d.compania_id, d.anio, d.periodo, l.tercero_id, l.tarifa_iva_id;
  END IF;

  -- Marcar fecha de última acumulación (sólo tras éxito)
  INSERT INTO estado_acumulaciones (compania_id, anio, tipo, periodo_hasta, ultima_acumulacion)
  VALUES (p_compania_id, p_anio, p_tipo, '12', now())
  ON CONFLICT (compania_id, anio, tipo)
  DO UPDATE SET ultima_acumulacion = now(), periodo_hasta = EXCLUDED.periodo_hasta;
END;
$$;
