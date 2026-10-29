# Identidad autenticada de Fortuner en CONTABDSI27

Se leyó completo docs/INTEGRACION_IDENTIDAD_FORTUNER.md. Solo se modificó este
proyecto, no Fortuner ni tablas. Despliegue exige Fortuner actualizado primero.

ModuleUser inmutable (code,name,administrator), guardado en AccessSession junto
con método/expiración. El token cookie continúa opaco, HttpOnly, SameSite=Strict,
Secure según configuración anterior. Canje y acceso administrativo validan el
objeto recibido exclusivamente del servicio Fortuner: code texto no blanco de
hasta4 caracteres, name no blanco, administrator booleano real y moduleId correcto.
La respuesta administrativa debe ser Ha27/administrator=true. Respuesta inválida
falla502 sin emitir cookie, no hay fallback WEB ni administrador inventado.
GET session y respuestas de acceso incluyen user. Dependencia reutilizable
require_authenticated_user lee solo cookie y devuelve401 si no hay sesión válida.

Middleware ASGI propaga identidad por ContextVar a endpoints síncronos AnyIO y
limpia contexto al finalizar. POST/PUT/PATCH/DELETE de API (excepto acceso) exigen
sesión antes de entrar al repositorio. Rutas públicas de acceso/health siguen
funcionando; esta entrega no convierte permisos futuros en roles efectivos ni
protege todas las lecturas. No cambia aislamiento contable por CIA.

APIs heredadas que pasaban user desde JSON/query ahora usan session_user_code.
Payloads con actor usuario lo sustituyen vía session_payload antes de enviarlo
al repositorio, incluyendo captura directa, importación y edición de lotes.
Campos heredados de actor se aceptan por compatibilidad pero no deciden identidad.
Filtros de auditoría por usuario (consultas/informes) no se sustituyen, ni los
datos del catálogo de usuarios. Revisión de medios ahora pasa actor de sesión a
su auditoría en vez del literal WEB. No se añade una auditoría donde no existía;
las normalizaciones históricas de código en cada repositorio se conservan.
Ha27 se mantiene exacto en sesión y al entregar actor a repositorios; tablas que
ya normalizaban mayúsculas conservan esa convención. No se almacena contraseña.
Errores HTTP401 se conservan en _service_error, no se presentan como fallo ADS.

Frontend: AccessGate valida/carga user desde GET session, mantiene solo en memoria
React y lo expone mediante useModuleUser. Shell muestra nombre, código, iniciales
dinámicas e indicador Administrador en vez del usuario mock. No almacena identidad,
permisos, clave ni código temporal en web storage. sessionStorage conserva solo
autorización de pestaña, sin cambiar la mecánica previa. Cerrar sesión backend
revoca token/identidad; reiniciar servicio requiere nuevo ingreso. El contexto
React es presentación, nunca autoridad de auditoría. Módulo en pestañas distintas
del mismo origen comparte cookie: no se promete identidad diferente por pestaña.

Validación local ASGI sin servidor/ADS: canje, cookie, respuesta sesión, inválidos,
adminHa27, logout, expiración, identidad inmutable/aislada, rechazo de identidad
en JSON de acceso, módulo erróneo, falsa autorización administrativa, operación
sin sesión, revocación, sustitución FAKE en actualizar lote, crear lote, captura
directa y reproceso. Se usa unittest porque pytest/httpx2 no están instalados;
test_access_session existente fue adaptado al nuevo contrato, sin agregar paquetes.
Frontend build correcto; advertencia preexistente de bundle grande.

Aceptación remota: recompilar/instalar con servicios detenidos y Fortuner ya
actualizado. Ingresar de nuevo (sesiones antiguas no tienen identidad), comprobar
nombre/código normal; guardar una operación de prueba y revisar actor en auditoría.
Comprobar ingreso con clave administrativa Ha27. No modifica conexión ni resuelve
por sí solo ausencia de VISAUDI: si ese archivo no está accesible seguirá pendiente
la auditoría aunque actor esté correctamente identificado. No se ejecutaron
operaciones reales ni escrituras de base de datos desde desarrollo.
