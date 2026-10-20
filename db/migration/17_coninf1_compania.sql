-- Advantage Data Server: ejecutar una sola vez en el ADD de contabilidad.
-- INFORM1 usaba un CONINF1 distinto por compañía; el ADD compartido necesita CIA.
-- Verifique antes que CONINF1 no tenga CIA y respalde el diccionario.
-- Los registros preexistentes deben asignarse manualmente a su compañía antes
-- de permitir el informe; no se supone una compañía para datos heredados.
ALTER TABLE CONINF1 ADD CIA NUMERIC(3,0);
