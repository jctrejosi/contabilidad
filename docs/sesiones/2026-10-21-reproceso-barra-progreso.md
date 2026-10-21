# Barra de avance por etapa

La web crea token aleatorio128bits mediante getRandomValues (también HTTP local)
y lo envía como seguimientoId opcional en POST simular/ejecutar. Backend registra
contexto por solicitud y compañía; GET progreso/token?cia=... lee copia en memoria
bajo Lock, nunca ADS. ID inválido/compañía distinta/no conocido da404. Token no se
reutiliza para impedir repetición con la misma referencia. No reemplaza controles
de autenticación del proyecto ni impide otra solicitud con diferente token.

Frontend consulta cada2.5s sin solapar lecturas y aborta polling al desmontar o
terminar petición. Fallo de polling no cancela operación. Solicitud POST original
sigue siendo síncrona; no es ejecución en segundo plano ni mecanismo de cancelar.
Lectura/cálculo/espera sin total: barra indeterminada. Actualización cuentas,
existentes y creación: porcentaje real de etapa por cantidades publicadas. No
porcentaje global ni ETA. Se reinicia entre etapas. Un100% en escritura aún
muestra pendiente de confirmación; COMMIT muestra Confirmando sin porcentaje.
Rollback muestra Revirtiendo; resultado original decide éxito/error/auditoría.

Avances de terceros por bloque1000, altas por bloque500. Cuentas existentes
publican por cuenta (cantidad pequeña comparada con movimientos). Sin consultas
extra de ADS ni log por petición de seguimiento. Sobrecosto esperado bajo pero
pendiente medición remota. No se hace reproceso real desde desarrollo.

Memoria por proceso, límite200referencias; terminadas expiran tras1hora. Activas
no expiran durante transacción. Compatible con servicio actual workers=1;
para múltiples workers se requiere estado compartido. Reinicio pierde estado.
No persiste/recupera al refrescar navegador; cerrar página no cancela escritura.
No cambiar transacción ni reglas contables para mostrar progreso.

Validación:58pruebas backend relacionadas y9runtime correctas, buildVite correcto
(advertencia existente bundle>500KB). Incluye contextos por hilo, aislamientoCIA,
conteo/etapa, final/error/rechazo de referencia repetida, llamadas antiguas sin
seguimiento. Pendiente aceptación visual y polling con proceso largo en servidor.
Compilar/instalar con servicio detenido, abrir formulario y ejecutar período
pendiente en base de pruebas; sin comandos benchmark para ver barra.
