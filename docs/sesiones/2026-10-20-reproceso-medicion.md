# Reproceso mensual: primer paso de optimización

La revisión previa deja de ser obligatoria en la web. Ejecutar directamente
mantiene la construcción y validación del plan vigente, motivo obligatorio,
bloqueo de escritura, transacción y auditoría. No reutiliza planes antiguos.
Evita una lectura/cálculo adicional cuando el operador omite la revisión.

El backend devuelve idOperacion y tiemposEtapas, y registra inicio/fin de cada
etapa con la misma referencia. Incluye espera de turno/apertura de conexión,
lectura y agrupación del movimiento, cálculo de mayores, lectura de terceros,
comparación, reemplazo y finalización de transacción. Los tiempos no cubren
exclusivamente CPU ni permiten distinguir bloqueo interno del motor de E/S.
El total también incluye tareas no desglosadas, como auditoría.

La pantalla muestra tiempo transcurrido, no progreso porcentual ni etapa en vivo.
Los tiempos detallados aparecen al finalizar; si no termina, revisar los últimos
eventos de la referencia en servicio.log. Cerrar el navegador no cancela backend.
No se incorporó ejecución en segundo plano ni consulta de estado en este paso.

Validación: 3 pruebas de instrumentación y 4 pruebas contables existentes;
compilación Vite correcta. No se ejecutó reproceso ni se modificó Advantage.

Prueba propuesta: instalar/compilar esta versión y probar un mes en una copia
representativa con respaldo. Ejecutar directamente, conservar referencia,
tiempos por etapa y cantidad de movimientos. Si no concluye, conservar el log
sin enviar otra ejecución. Determinar la siguiente optimización según medición.
No se afirma reducción del tiempo interno de ejecución: las consultas y reglas
contables permanecen iguales; solo se evita el paso previo duplicado.
