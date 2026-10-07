-- Ejecutado en el ADD activo el 2026-10-07.
-- Ejecutar una sola vez por instalación, tras confirmar que XADMOVI no tiene
-- ya estas columnas. Advantage requiere acceso exclusivo para ALTER TABLE.
-- No se asignan valores a filas históricas: XADMOVI no contiene un dato con
-- el que pueda determinarse inequívocamente la compañía de cada registro.
ALTER TABLE XADMOVI
  ADD COLUMN CIA INTEGER
  ADD COLUMN ANO SHORTINT;

-- Revisión de integridad tras la ampliación (lectura):
-- SELECT COUNT(*) AS TOTAL, COUNT(CIA) AS CON_CIA, COUNT(ANO) AS CON_ANO
-- FROM XADMOVI;
