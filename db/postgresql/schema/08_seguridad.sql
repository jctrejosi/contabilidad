-- =====================================================================
-- CONTABDSI · 08_seguridad.sql
-- Usuarios, roles, permisos, bitácora (auditoría) e integraciones.
-- =====================================================================

BEGIN;

-- -------------------------------------------------------------------
-- Roles (Administrador, Contador principal, Auxiliar, Auditor…).
-- -------------------------------------------------------------------
CREATE TABLE roles (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      text NOT NULL UNIQUE,                          -- 'ADMIN', 'CONTADOR'…
  nombre      text NOT NULL,                                 -- 'Administrador'
  descripcion text
);

-- -------------------------------------------------------------------
-- Permisos (mov.capturar, mov.lotes.aprobar, …).
-- -------------------------------------------------------------------
CREATE TABLE permisos (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  modulo text NOT NULL
);

CREATE TABLE rol_permisos (
  rol_id     bigint NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permiso_id bigint NOT NULL REFERENCES permisos (id) ON DELETE CASCADE,
  CONSTRAINT rol_permisos_uk UNIQUE (rol_id, permiso_id)
);

-- -------------------------------------------------------------------
-- Usuarios.
-- -------------------------------------------------------------------
CREATE TABLE usuarios (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre          text NOT NULL,
  email           text,
  rol_id          bigint NOT NULL REFERENCES roles (id),
  iniciales       text,
  activo          boolean NOT NULL DEFAULT true,
  eliminado_en    timestamptz,
  creado_en       timestamptz,
  creado_por      integer,
  actualizado_en  timestamptz,
  actualizado_por integer,
  version         integer NOT NULL DEFAULT 0,
  CONSTRAINT usuarios_email_uk UNIQUE (email)
);

-- -------------------------------------------------------------------
-- Bitácora (audit log). Toda acción sensible queda registrada aquí.
-- -------------------------------------------------------------------
CREATE TABLE auditoria (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id bigint REFERENCES companias (id),
  anio        integer,
  usuario_id  bigint REFERENCES usuarios (id),
  rol_id      bigint REFERENCES roles (id),
  accion      text NOT NULL,                                 -- 'Aprobación de lote'
  modulo      text NOT NULL,                                 -- 'Lotes'
  detalle     text,
  resultado   text NOT NULL DEFAULT 'EXITO' CHECK (resultado IN ('EXITO', 'FALLO', 'INFO')),
  parametros  jsonb NOT NULL DEFAULT '{}',                   -- parámetros de la acción
  impacto     jsonb NOT NULL DEFAULT '{}',                   -- tablas/registros afectados
  motivo      text,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auditoria_usuario_idx ON auditoria (usuario_id);
CREATE INDEX auditoria_modulo_idx ON auditoria (modulo);
CREATE INDEX auditoria_creado_en_idx ON auditoria (creado_en DESC);

-- -------------------------------------------------------------------
-- Integraciones con módulos externos (estado de sincronización).
-- -------------------------------------------------------------------
CREATE TABLE integraciones (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compania_id           bigint NOT NULL REFERENCES companias (id),
  modulo                text NOT NULL,                       -- 'Facturacion', 'Cartera', …
  estado                text NOT NULL DEFAULT 'Desconectado'
                          CHECK (estado IN ('Conectado', 'Desconectado', 'Bloqueado')),
  ultima_sincronizacion timestamptz,
  configuracion         jsonb NOT NULL DEFAULT '{}',
  actualizado_en        timestamptz,
  actualizado_por       integer,
  version               integer NOT NULL DEFAULT 0,
  CONSTRAINT integraciones_uk UNIQUE (compania_id, modulo)
);

-- -------------------------------------------------------------------
-- Asignación de usuarios a compañías (B14: acceso por empresa).
-- -------------------------------------------------------------------
CREATE TABLE usuario_companias (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  bigint NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  compania_id bigint NOT NULL REFERENCES companias (id) ON DELETE CASCADE,
  CONSTRAINT usuario_companias_uk UNIQUE (usuario_id, compania_id)
);

-- B14: actores de lotes/documentos referencian usuarios reales
-- (las tablas se crean en 04_movimientos, antes que usuarios; por eso
-- la FK se agrega aquí, una vez existe usuarios).
ALTER TABLE lotes
  ADD CONSTRAINT lotes_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios (id);
ALTER TABLE documentos
  ADD CONSTRAINT documentos_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios (id);

CREATE TRIGGER trg_usuarios_auditoria BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();
CREATE TRIGGER trg_integraciones_auditoria BEFORE UPDATE ON integraciones
  FOR EACH ROW EXECUTE FUNCTION auditoria_antes_update();

COMMIT;
