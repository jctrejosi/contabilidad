# Reconfiguración segura de conexión instalada — CONTABDSI27

Se aplica únicamente a Contabilidad, según la especificación entregada desde
COMPILADOR_DSI. No se modificó Inventarios ni el proyecto maestro Fortuner.

## Uso en el servidor cliente

Actualizar una vez la instalación con el paquete que incluye la utilidad.
Después, desde su carpeta instalada, ejecutar:

```
Configurar-Conexion-Contabilidad27.bat
```

No requiere conservar el ZIP, recompilar, renombrar credenciales ni editar JSON.
Solicita elevación UAC y requiere detener el módulo previamente. La utilidad
no detiene procesos ni inicia Contabilidad después del cambio.

Diagnóstico sin escribir archivos, desde la misma carpeta:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File configurar-conexion.ps1 -Plan
```

Para una instalación personalizada, la utilidad instalada usa su propia carpeta
como raíz. Desde el paquete puede ejecutarse el script con -InstallRoot o:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File instalar.ps1 -InstallRoot "D:\Aplicaciones\CONTABDSI27" -ReconfigureConnection
```

En una instalación existente, esta última opción delega en la misma utilidad
y termina sin actualizar el módulo o Fortuner. En una primera instalación se
mantiene el flujo normal. Se rechaza combinar -Plan y -ReconfigureConnection.

## Valores y protección

- Solicita el ADD existente y carpetas de referencia/VISAUDI antes de preguntar
  usuario y clave. Usuario y contraseña se capturan ocultos; Enter los conserva.
- Permite conservar/cambiar proveedor OLE DB, tipo de servidor y driver ODBC.
- Si cambia la carpeta de referencia, la carpeta de auditoría predeterminada
  cambia con ella; permite conservar una carpeta VISAUDI distinta explícita.
- Nunca admite credenciales como parámetros. Solo muestra la ruta ADD, no el
  usuario, clave o cadena de conexión.
- DPAPI LocalMachine en memoria y en archivos candidatos cifrados dentro de
  config. Se limpian buffers/punteros de SecureString donde permite .NET.
  Las cadenas inmutables de .NET no ofrecen garantía de borrado físico inmediato.
- Valida producto, archivos, rutas dentro de la instalación, credentialsFile
  relativo dentro de config, ACL restrictivas y proceso Windows x64. Rechaza
  rutas con traversal y enlaces/reparse points de la instalación.
- No relaja permisos: verifica config y credenciales; el respaldo se restringe
  a SYSTEM, administradores y la cuenta registrada. No usa Users/Everyone.
- Obtiene el puerto del servicio y verifica que no esté escuchando antes de
  preguntar y antes de activar. No confunde fallo de diagnóstico con detenido.
- Un lock local impide dos cambios simultáneos; verifica que los archivos
  activos no hayan cambiado durante la comprobación.

## Validación, activación y recuperación

El binario instalado ejecuta `check --config <candidata>`. No se usa Python del
sistema, ni se abre un puerto. stdout/stderr se capturan en memoria y no se
imprimen ni se guardan en logs. Solo código de salida cero permite activar.
El runtime ya prueba por OLE DB y ODBC las tablas esenciales CONEMP, CONMAE,
MOV01, FADCLI y CONCTR con SELECT TOP 0; se mantuvo esa lógica y se añadieron
pruebas para verificar ambos recorridos sin escrituras.

Antes de activar se respalda el cifrado actual, service.json y installation.json
en backups/<fecha>-conexion-<id>. CAMBIO.txt solo contiene producto, versión,
fecha UTC y cuenta Windows. La credencial candidata sustituye atómicamente la
activa; se verifica su hash, existencia y ACL. service.json no se reescribe.
installation.json solo añade connectionUpdatedAt, preservando sus otros datos.

Si falla la activación o los metadatos, restaura los bytes anteriores; si la
restauración tampoco se puede confirmar, informa expresamente que no debe
iniciarse el módulo y da la ubicación del respaldo. Un apagado abrupto o una
intervención externa que impida acceso al disco requiere revisión del respaldo;
no se promete recuperación frente a cualquier fallo físico del servidor.

No cambia frontend, tablas, contabilidad, host, puerto, firewall, modules.json,
versión activa ni mecanismo de arranque. DPAPI no debe transportarse a otro
equipo como mecanismo de migración.

## Instalador y paquete

- Copia BAT y PS1 a InstallRoot y los incorpora al respaldo/rollback de actualización,
  junto con INSTALACION.txt. Este último explica cómo cambiar la conexión.
- Conserva campos adicionales de service.json, incluidos Fortuner, cookie,
  sesión y ruta de registros. Respeta credentialsFile existente.
- build-release.ps1 y el compilacion.json de la raíz declaran ambos archivos.
  El manifiesto cubre sus SHA256; no se distribuyen archivos de pruebas.
- No se actualizó ninguna instalación real durante este trabajo.

## Pruebas

`deployment/tests/test_configurar_conexion.ps1`: 17 escenarios aislados bajo
Windows PowerShell 5.1. DPAPI real, archivos temporales y reemplazo real en sandbox;
UAC/ACL se simulan. Incluye producto incorrecto, archivos ausentes, rutas inválidas,
Plan sin cambios, puerto ocupado, activación, repetición, fallo de check, fallo
después del reemplazo, fallo de metadatos, limpieza, ocultación de secretos,
Enter conserva valores, coherencia de referencias y proceso de validación real
de prueba con canales capturados. No usa credenciales reales para cambiar datos.

Ocho pruebas de runtime correctas. Se comprobó instalación/reparación/rollback
en carpetas temporales, incluida la recuperación de la utilidad y de las opciones
de servicio. El ejecutable empaquetado supera inspect y check real contra ADS
sin iniciar servicio ni escribir tablas. Se valida el manifiesto SHA256 y la
ausencia de fuentes de negocio, bases y archivos de prueba en el paquete.

Pendiente de aceptación en servidor de ensayo: UAC desde un usuario no elevado,
ACL efectivas con la cuenta Windows de Fortuner, cambio a otro ADD válido,
rechazo de credenciales inválidas y arranque posterior desde Fortuner. Estas
pruebas requieren la instalación y autorización de ese servidor, no se sustituyen
con los tests simulados ni con la lectura de la base del equipo de desarrollo.
