-- =====================================================================
-- CONTABDSI · seed.sql
-- Datos de demostración coherentes con el prototipo.
-- Compañía 001 — Compañía Demo S.A.S. | NIT 900.123.456-7 | 2026 · Febrero.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_empresa bigint;
  v_anio bigint;
  v_user_contador integer;
  v_user_auxiliar integer;
  v_rol_admin bigint;
  v_rol_contador bigint;
  v_rol_auxiliar bigint;
  v_rol_auditor bigint;
  v_rol_tributario bigint;
  v_rol_gerencia bigint;

  -- cuentas
  c1 bigint; c11 bigint; c1105 bigint; c110505 bigint; c111005 bigint;
  c13 bigint; c1305 bigint; c130505 bigint;
  c2 bigint; c23 bigint; c2365 bigint; c236540 bigint;
  c24 bigint; c2408 bigint; c240805 bigint;
  c25 bigint; c2505 bigint; c250505 bigint;
  c5 bigint; c51 bigint; c5105 bigint; c510506 bigint;

  -- terceros
  t_garcia bigint; t_lopez bigint; t_martinez bigint;
  t_abc bigint; t_xyz bigint; t_dian bigint;

  -- centros
  ce_adm bigint; ce_ven bigint; ce_ope bigint;

  -- comprobantes
  co_ce bigint; co_rc bigint; co_cp bigint; co_ni bigint; co_nv bigint;

  -- lote
  v_lote bigint;
  v_linea bigint;
BEGIN

  -- ================= Roles y permisos =================
  INSERT INTO roles (codigo, nombre, descripcion) VALUES
    ('ADMIN', 'Administrador', 'Acceso total'),
    ('CONTADOR', 'Contador principal', 'Aprueba, contabiliza, cierra y consolida'),
    ('AUXILIAR', 'Auxiliar contable', 'Captura, lotes, importaciones y consultas'),
    ('AUDITOR', 'Auditor', 'Reprocesos de auditoría y trazabilidad'),
    ('TRIBUTARIO', 'Analista tributario', 'Retenciones, IVA y medios magnéticos'),
    ('GERENCIA', 'Consulta gerencial', 'Solo lectura');

  SELECT id INTO v_rol_admin FROM roles WHERE codigo='ADMIN';
  SELECT id INTO v_rol_contador FROM roles WHERE codigo='CONTADOR';
  SELECT id INTO v_rol_auxiliar FROM roles WHERE codigo='AUXILIAR';
  SELECT id INTO v_rol_auditor FROM roles WHERE codigo='AUDITOR';
  SELECT id INTO v_rol_tributario FROM roles WHERE codigo='TRIBUTARIO';
  SELECT id INTO v_rol_gerencia FROM roles WHERE codigo='GERENCIA';

  INSERT INTO permisos (codigo, nombre, modulo) VALUES
    ('mov.capturar', 'Captura directa', 'Movimientos'),
    ('mov.lotes', 'Gestión de lotes', 'Movimientos'),
    ('mov.lotes.aprobar', 'Aprobar lotes', 'Movimientos'),
    ('mov.lotes.contabilizar', 'Contabilizar lotes', 'Movimientos'),
    ('mov.anular', 'Anular documentos', 'Movimientos'),
    ('mov.importar', 'Importar movimientos', 'Movimientos'),
    ('consulta.ver', 'Ver consultas', 'Consultas'),
    ('informes.ver', 'Ver informes', 'Informes'),
    ('impuestos.ver', 'Gestión de impuestos', 'Impuestos'),
    ('reprocesos.ejecutar', 'Ejecutar reprocesos', 'Procesos'),
    ('cierres.ejecutar', 'Ejecutar cierres', 'Procesos'),
    ('consolidacion.ejecutar', 'Ejecutar consolidación', 'Procesos'),
    ('config.editar', 'Editar configuración', 'Configuración'),
    ('admin.usuarios', 'Administrar usuarios', 'Administración');

  INSERT INTO rol_permisos (rol_id, permiso_id)
  SELECT v_rol_admin, id FROM permisos; -- Administrador: todo

  INSERT INTO rol_permisos (rol_id, permiso_id)
  SELECT v_rol_contador, id FROM permisos
  WHERE codigo IN ('mov.capturar','mov.lotes','mov.lotes.aprobar','mov.lotes.contabilizar',
                   'mov.anular','mov.importar','consulta.ver','informes.ver','impuestos.ver',
                   'reprocesos.ejecutar','cierres.ejecutar','consolidacion.ejecutar','config.editar');

  INSERT INTO rol_permisos (rol_id, permiso_id)
  SELECT v_rol_auxiliar, id FROM permisos
  WHERE codigo IN ('mov.capturar','mov.lotes','mov.importar','consulta.ver','informes.ver');

  INSERT INTO rol_permisos (rol_id, permiso_id)
  SELECT v_rol_auditor, id FROM permisos
  WHERE codigo IN ('consulta.ver','informes.ver','reprocesos.ejecutar');

  INSERT INTO rol_permisos (rol_id, permiso_id)
  SELECT v_rol_tributario, id FROM permisos
  WHERE codigo IN ('consulta.ver','informes.ver','impuestos.ver');

  INSERT INTO rol_permisos (rol_id, permiso_id)
  SELECT v_rol_gerencia, id FROM permisos
  WHERE codigo IN ('consulta.ver','informes.ver');

  -- ================= Usuarios =================
  INSERT INTO usuarios (nombre, email, rol_id, iniciales) VALUES
    ('Laura Gómez', 'laura.gomez@dsi.com', v_rol_contador, 'LG'),
    ('Carlos Ruiz', 'carlos.ruiz@dsi.com', v_rol_auxiliar, 'CR'),
    ('Ana Martínez', 'ana.martinez@dsi.com', v_rol_admin, 'AM'),
    ('Jorge Peña', 'jorge.pena@dsi.com', v_rol_auditor, 'JP'),
    ('Diana Torres', 'diana.torres@dsi.com', v_rol_tributario, 'DT'),
    ('Roberto Silva', 'roberto.silva@dsi.com', v_rol_gerencia, 'RS');

  SELECT id INTO v_user_contador FROM usuarios WHERE email='laura.gomez@dsi.com';
  SELECT id INTO v_user_auxiliar FROM usuarios WHERE email='carlos.ruiz@dsi.com';

  -- ================= Compañía =================
  INSERT INTO companias (codigo, nombre, nit, digito, estado)
  VALUES ('001', 'Compañía Demo S.A.S.', '900.123.456', '7', 'Activa')
  RETURNING id INTO v_empresa;

  INSERT INTO compania_anios (compania_id, anio) VALUES (v_empresa, 2026) RETURNING id INTO v_anio;

  INSERT INTO periodos_contables (compania_id, anio, periodo, nombre, estado) VALUES
    (v_empresa, 2026, '00', 'Saldos Iniciales', 'Abierto'),
    (v_empresa, 2026, '01', 'Enero', 'Abierto'),
    (v_empresa, 2026, '02', 'Febrero', 'Abierto'),
    (v_empresa, 2026, '03', 'Marzo', 'Abierto'),
    (v_empresa, 2026, '04', 'Abril', 'Abierto'),
    (v_empresa, 2026, '05', 'Mayo', 'Abierto'),
    (v_empresa, 2026, '06', 'Junio', 'Abierto'),
    (v_empresa, 2026, '07', 'Julio', 'Abierto'),
    (v_empresa, 2026, '08', 'Agosto', 'Abierto'),
    (v_empresa, 2026, '09', 'Septiembre', 'Abierto'),
    (v_empresa, 2026, '10', 'Octubre', 'Abierto'),
    (v_empresa, 2026, '11', 'Noviembre', 'Abierto'),
    (v_empresa, 2026, '12', 'Diciembre', 'Abierto'),
    (v_empresa, 2026, '13', 'Ajuste 13', 'Abierto'),
    (v_empresa, 2026, '14', 'Ajuste 14', 'Abierto'),
    (v_empresa, 2026, '15', 'Ajuste 15', 'Abierto'),
    (v_empresa, 2026, '16', 'Ajuste 16', 'Abierto'),
    (v_empresa, 2026, '17', 'Ajuste 17', 'Abierto'),
    (v_empresa, 2026, '18', 'Ajuste 18', 'Abierto');

  INSERT INTO parametros_operacion
    (compania_id, anio, nombre_empresa, nit, directorio_contabilidad, anio_operacion,
     verifica_documentos_lotes, controla_usuario_lotes, modo_retencion)
  VALUES
    (v_empresa, 2026, 'Compañía Demo S.A.S.', '900.123.456-7',
     'C:\VISION20\CONTAB\001\', '2026', true, true, 'retencion-a-base');

  -- ================= Plan de cuentas =================
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable) VALUES (v_empresa,'1','ACTIVO',1,false) RETURNING id INTO c1;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id) VALUES (v_empresa,'11','DISPONIBLE',2,false,c1) RETURNING id INTO c11;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id) VALUES (v_empresa,'1105','CAJA',4,true,c11) RETURNING id INTO c1105;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id, saldo_inicial) VALUES (v_empresa,'110505','Caja general',6,true,c1105,5200000) RETURNING id INTO c110505;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id, saldo_inicial, controla_tercero) VALUES (v_empresa,'111005','Bancos moneda nacional',6,true,c11,48500000,true) RETURNING id INTO c111005;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id) VALUES (v_empresa,'13','DEUDORES',2,false,c1) RETURNING id INTO c13;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id) VALUES (v_empresa,'1305','CLIENTES',4,true,c13) RETURNING id INTO c1305;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id, saldo_inicial, controla_tercero) VALUES (v_empresa,'130505','Clientes nacionales',6,true,c1305,22400000,true) RETURNING id INTO c130505;

  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable) VALUES (v_empresa,'2','PASIVO',1,false) RETURNING id INTO c2;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id) VALUES (v_empresa,'23','OBLIGACIONES FINANCIERAS',2,false,c2) RETURNING id INTO c23;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id) VALUES (v_empresa,'2365','RETENCIÓN EN LA FUENTE',4,true,c23) RETURNING id INTO c2365;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id, clase_retencion, controla_base)
    VALUES (v_empresa,'236540','Retenciones y aportes de nómina',6,true,c2365,'Renta',true) RETURNING id INTO c236540;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id) VALUES (v_empresa,'24','IMPUESTOS, GRAVÁMENES Y TASAS',2,false,c2) RETURNING id INTO c24;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id) VALUES (v_empresa,'2408','IVA',4,true,c24) RETURNING id INTO c2408;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id, clase_iva)
    VALUES (v_empresa,'240805','IVA por pagar',6,true,c2408,'Generado') RETURNING id INTO c240805;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id) VALUES (v_empresa,'25','OBLIGACIONES LABORALES',2,false,c2) RETURNING id INTO c25;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id) VALUES (v_empresa,'2505','SALARIOS POR PAGAR',4,true,c25) RETURNING id INTO c2505;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id, controla_tercero)
    VALUES (v_empresa,'250505','Salarios por pagar',6,true,c2505,true) RETURNING id INTO c250505;

  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable) VALUES (v_empresa,'5','GASTOS',1,false) RETURNING id INTO c5;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id) VALUES (v_empresa,'51','OPERACIONALES DE ADMINISTRACIÓN',2,false,c5) RETURNING id INTO c51;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id) VALUES (v_empresa,'5105','GASTOS DE PERSONAL',4,true,c51) RETURNING id INTO c5105;
  INSERT INTO cuentas (compania_id, codigo, nombre, nivel, afectable, parent_id, controla_centro)
    VALUES (v_empresa,'510506','Sueldos y salarios',6,true,c5105,true) RETURNING id INTO c510506;

  -- ================= Terceros =================
  INSERT INTO terceros (compania_id, nit, digito, nombre, tipo, tipo_documento, ciudad, estado)
    VALUES (v_empresa,'12.345.678','1','García Moreno Juan Pablo','Natural','CC','Bogotá','Activo') RETURNING id INTO t_garcia;
  INSERT INTO terceros (compania_id, nit, digito, nombre, tipo, tipo_documento, ciudad, estado)
    VALUES (v_empresa,'23.456.789','2','López Vargas María Fernanda','Natural','CC','Bogotá','Activo') RETURNING id INTO t_lopez;
  INSERT INTO terceros (compania_id, nit, digito, nombre, tipo, tipo_documento, ciudad, estado)
    VALUES (v_empresa,'34.567.890','3','Martínez Rojas Ana Lucía','Natural','CC','Cali','Activo') RETURNING id INTO t_martinez;
  INSERT INTO terceros (compania_id, nit, digito, nombre, tipo, tipo_documento, ciudad, estado)
    VALUES (v_empresa,'800.100.200','4','Empresa ABC Comercial S.A.S.','Juridica','NIT','Medellín','Activo') RETURNING id INTO t_abc;
  INSERT INTO terceros (compania_id, nit, digito, nombre, tipo, tipo_documento, ciudad, estado)
    VALUES (v_empresa,'900.200.300','5','Comercial XYZ Distribuciones Ltda.','Juridica','NIT','Bogotá','Activo') RETURNING id INTO t_xyz;
  INSERT INTO terceros (compania_id, nit, digito, nombre, tipo, tipo_documento, ciudad, estado)
    VALUES (v_empresa,'830.000.297','6','DIAN — Dirección de Impuestos','Juridica','NIT','Bogotá','Activo') RETURNING id INTO t_dian;

  -- ================= Centros de costo =================
  INSERT INTO centros_costos (compania_id, codigo, nombre, nivel) VALUES (v_empresa,'ADM','Administración',1) RETURNING id INTO ce_adm;
  INSERT INTO centros_costos (compania_id, codigo, nombre, nivel) VALUES (v_empresa,'VEN','Ventas',1) RETURNING id INTO ce_ven;
  INSERT INTO centros_costos (compania_id, codigo, nombre, nivel) VALUES (v_empresa,'OPE','Operaciones',1) RETURNING id INTO ce_ope;

  -- ================= Comprobantes y consecutivos =================
  INSERT INTO comprobantes (compania_id, codigo, nombre) VALUES (v_empresa,'CE','Comprobante de egreso') RETURNING id INTO co_ce;
  INSERT INTO comprobantes (compania_id, codigo, nombre) VALUES (v_empresa,'RC','Recibo de caja') RETURNING id INTO co_rc;
  INSERT INTO comprobantes (compania_id, codigo, nombre) VALUES (v_empresa,'CP','Comprobante de pago') RETURNING id INTO co_cp;
  INSERT INTO comprobantes (compania_id, codigo, nombre) VALUES (v_empresa,'NI','Nota interna') RETURNING id INTO co_ni;
  INSERT INTO comprobantes (compania_id, codigo, nombre) VALUES (v_empresa,'NV','Nota de venta') RETURNING id INTO co_nv;

  INSERT INTO consecutivos_comprobantes (compania_id, anio, comprobante_id, consecutivo_actual) VALUES
    (v_empresa, 2026, co_ce, 245),
    (v_empresa, 2026, co_rc, 128),
    (v_empresa, 2026, co_cp, 92),
    (v_empresa, 2026, co_ni, 31),
    (v_empresa, 2026, co_nv, 56);

  -- ================= Tipos de documento =================
  INSERT INTO tipos_documento (compania_id, codigo, nombre, numeracion, consecutivo, tercero_obligatorio, centro_obligatorio) VALUES
    (v_empresa, 'NOM', 'Nómina', 'Manual', 2, true, true),
    (v_empresa, 'FV', 'Factura de venta', 'Automatica', 1203, true, false),
    (v_empresa, 'OR', 'Orden de pago', 'Automatica', 23, true, false);

  -- ================= Retenciones e IVA =================
  INSERT INTO conceptos_retencion (compania_id, codigo, nombre, tarifa, cuenta_id, base_minima) VALUES
    (v_empresa, 'R01', 'Compras generales', 0.025, c236540, 917000),
    (v_empresa, 'R02', 'Servicios', 0.04, c236540, 917000),
    (v_empresa, 'R03', 'Honorarios', 0.10, c236540, 0),
    (v_empresa, 'R04', 'Salarios', 0.10, c236540, 0);

  INSERT INTO tarifas_iva (compania_id, codigo, nombre, tarifa, cuenta_id) VALUES
    (v_empresa, 'IV19', 'IVA general', 0.19, c240805),
    (v_empresa, 'IV05', 'IVA reducido', 0.05, c240805),
    (v_empresa, 'IVE', 'Excluido', 0.00, c240805);

  -- ================= Lote NOM2 (nómina febrero, 12 líneas, 2 errores) =================
  INSERT INTO lotes (compania_id, anio, periodo, codigo, nombre, usuario_id, origen, fecha, estado, comprobante_id, documento)
  VALUES (v_empresa, 2026, '02', 'NOM2', 'Nómina febrero 2026', v_user_auxiliar, 'Nómina', '2026-02-28', 'Borrador', co_ce, 'NOM-2026-02')
  RETURNING id INTO v_lote;

  -- Débitos (510506, requiere centro)
  INSERT INTO lote_lineas (lote_id, numero_linea, cuenta_id, tercero_id, centro_costo_id, comprobante, documento, fecha, debito, credito, concepto, origen) VALUES
    (v_lote, 1, c510506, NULL, ce_adm, 'CE', 'NOM-2026-02', '2026-02-28', 4500000, 0, 'Sueldo febrero Administración', 'Nómina'),
    (v_lote, 2, c510506, t_garcia, ce_ven, 'CE', 'NOM-2026-02', '2026-02-28', 3200000, 0, 'Sueldo febrero Ventas', 'Nómina'),
    (v_lote, 3, c510506, t_martinez, NULL, 'CE', 'NOM-2026-02', '2026-02-28', 2300000, 0, 'Sueldo febrero Operaciones', 'Nómina'),
    (v_lote, 4, c510506, t_garcia, ce_adm, 'CE', 'NOM-2026-02', '2026-02-28', 800000, 0, 'Prestaciones febrero ADM', 'Nómina'),
    (v_lote, 5, c510506, t_martinez, ce_ope, 'CE', 'NOM-2026-02', '2026-02-28', 600000, 0, 'Prestaciones febrero OPE', 'Nómina'),
    (v_lote, 6, c510506, t_garcia, ce_adm, 'CE', 'NOM-2026-02', '2026-02-28', 1200000, 0, 'Aportes seguridad social feb', 'Nómina');

  -- Créditos (250505 requiere tercero; 236540 retención)
  INSERT INTO lote_lineas (lote_id, numero_linea, cuenta_id, tercero_id, centro_costo_id, comprobante, documento, fecha, debito, credito, concepto, origen) VALUES
    (v_lote, 7, c250505, t_garcia, ce_adm, 'CE', 'NOM-2026-02', '2026-02-28', 0, 4500000, 'Obligación nómina feb ADM', 'Nómina'),
    (v_lote, 8, c250505, t_lopez, ce_ven, 'CE', 'NOM-2026-02', '2026-02-28', 0, 3200000, 'Obligación nómina feb VEN', 'Nómina'),
    (v_lote, 9, c250505, NULL, ce_ope, 'CE', 'NOM-2026-02', '2026-02-28', 0, 2300000, 'Obligación nómina feb OPE', 'Nómina'),
    (v_lote, 10, c250505, t_garcia, ce_adm, 'CE', 'NOM-2026-02', '2026-02-28', 0, 800000, 'Prestaciones por pagar feb', 'Nómina'),
    (v_lote, 11, c250505, t_martinez, ce_ope, 'CE', 'NOM-2026-02', '2026-02-28', 0, 600000, 'Prestaciones por pagar feb', 'Nómina'),
    (v_lote, 12, c236540, NULL, NULL, 'CE', 'NOM-2026-02', '2026-02-28', 0, 1200000, 'Retención nómina febrero', 'Nómina');

  UPDATE lote_lineas SET base = 12600000 WHERE lote_id = v_lote AND numero_linea = 12;
  UPDATE lote_lineas SET clase = 'Retencion' WHERE lote_id = v_lote AND numero_linea = 12;

  -- Generar validaciones (debe dejar 2 errores: línea 3 centro y línea 9 tercero)
  PERFORM validar_lote(v_lote);

  -- ================= Bitácora inicial =================
  INSERT INTO auditoria (compania_id, anio, usuario_id, accion, modulo, detalle, resultado) VALUES
    (v_empresa, 2026, v_user_auxiliar, 'Creación de lote', 'Lotes', 'Lote NOM2 creado desde Integración de nómina', 'INFO');

END $$;

COMMIT;
