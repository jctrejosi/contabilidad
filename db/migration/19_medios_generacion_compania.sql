-- MEDMAG04 borra y reconstruye resultados. En el ADD compartido, CIA permite
-- sustituir únicamente los registros de la compañía que ejecuta el proceso.
-- Aplicar una sola vez; las filas históricas quedan sin CIA para revisión.
ALTER TABLE CONMAGIT ADD CIA NUMERIC(3,0);
ALTER TABLE CONMAGDT ADD CIA NUMERIC(3,0);

CREATE INDEX CONMAGITC ON CONMAGIT (CIA, FORMATO, CONCEPTO, NIT);
CREATE INDEX CONMAGDTC ON CONMAGDT (CIA, FORMATO, CONCEPTO, TERCERO, TERCERO2);
