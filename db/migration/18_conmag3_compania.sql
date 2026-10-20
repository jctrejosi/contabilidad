-- MEDMAG03: la separación por carpeta del programa original se traslada a CIA.
-- Ejecutar solo después de comprobar que CONMAG3 no tiene ya la columna.
-- Las filas existentes quedan con CIA nulo para revisión manual; nunca se
-- atribuyen automáticamente a una compañía.
ALTER TABLE CONMAG3 ADD CIA NUMERIC(3,0);

-- Índice de consulta por compañía y clave original de la asignación.
CREATE INDEX CONMAG3C ON CONMAG3 (CIA, CUENTA, FORMATO, CONCEPTO, CUENTA2);
