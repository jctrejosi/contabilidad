# Integración de identidad de Fortuner en Contabilidad

## Objetivo

Cuando un usuario abre Contabilidad desde FORTUNER27, la sesión local debe
conservar la identidad autenticada en Fortuner. Las operaciones y auditorías
deben obtener el código del usuario desde esa sesión del backend, nunca desde
un valor escrito o enviado libremente por el frontend.

Este documento describe trabajo pendiente en CONTABDSI27. FORTUNER27 ya
incorpora el contrato descrito aquí.

## Contrato disponible en Fortuner

La creación del código temporal exige una sesión válida de Fortuner. El código
es opaco, dura 30 segundos, se puede usar una sola vez y queda asociado al
módulo y al usuario.

Al canjearlo mediante:

```http
POST http://127.0.0.1:8004/api/access/launch-grants/redeem
Content-Type: application/json

{
  "moduleId": "contabilidad",
  "code": "codigo-temporal"
}
```

Fortuner responde:

```json
{
  "authorized": true,
  "moduleId": "contabilidad",
  "method": "fortuner",
  "user": {
    "code": "ABCD",
    "name": "Nombre del usuario",
    "administrator": false,
    "branch": {
      "code": "01",
      "name": "CENTRO"
    }
  }
}
```

El acceso con la clave administrativa devuelve el mismo objeto `user`, usando
la identidad especial `Ha27`, nombre `Administrador` y `administrator: true`.
No se transmite la contraseña ni el valor cifrado de `VISUSU`.

## Cambios requeridos en el backend

Archivo principal: `backend/access_session.py`.

1. Crear una estructura inmutable para la identidad, por ejemplo
   `ModuleUser(code, name, administrator, branch_code, branch_name)`.
2. Ampliar `AccessSession` para guardar `user` además de `method` y
   `expires_at`.
3. Cambiar `AccessSessionStore.issue()` para recibir y guardar la identidad.
4. Validar estrictamente el objeto `authorization["user"]` recibido desde
   Fortuner:
   - `code`: texto no vacío, máximo 4 caracteres;
   - `name`: texto no vacío;
   - `administrator`: booleano real;
   - `branch.code`: código no vacío, máximo 2 caracteres;
   - `branch.name`: texto no vacío;
   - no aceptar una identidad enviada por el navegador.
5. Hacer que `_create_session()` reciba la identidad validada y la almacene.
6. Aplicar lo mismo tanto a `/api/access/fortuner` como a
   `/api/access/administrator`.
7. Ampliar `GET /api/access/session` para devolver:

```json
{
  "authorized": true,
  "moduleId": "contabilidad",
  "method": "fortuner",
  "user": {
    "code": "ABCD",
    "name": "Nombre del usuario",
    "administrator": false,
    "branch": {
      "code": "01",
      "name": "CENTRO"
    }
  }
}
```

8. Crear una dependencia reutilizable, por ejemplo
   `require_authenticated_user(request) -> ModuleUser`, que lea exclusivamente
   la cookie `contabilidad_session` y rechace con 401 una sesión inexistente o
   vencida.

La cookie debe continuar siendo opaca, `HttpOnly`, `SameSite=Strict` y no debe
contener datos del usuario.

## Cambios requeridos en el frontend

Archivo inicial: `Interface_web/src/components/AccessGate.tsx`.

1. Ampliar el tipo de respuesta de sesión con `user`.
2. Conservar en memoria React el usuario devuelto por
   `/api/access/session`.
3. Exponerlo mediante un contexto, por ejemplo `useModuleUser()`, para que el
   encabezado y las páginas puedan mostrar código y nombre.
4. Conservar sin cambios la autorización por pestaña en `sessionStorage`.
5. No guardar contraseña, permisos ni el código temporal en `localStorage` o
   `sessionStorage`.

## Auditoría y operaciones

Los endpoints que hoy reciben `usuario`, `user` u `operador` desde JSON,
query string o encabezados deben migrarse gradualmente al usuario de la sesión.

Patrón esperado:

```python
@router.post("/operacion")
def ejecutar(
    payload: OperationRequest,
    user: ModuleUser = Depends(require_authenticated_user),
):
    return repository.execute(payload, user=user.code)
```

Reglas:

- El código de auditoría procede únicamente de `user.code`.
- Si una tabla heredada usa cuatro caracteres, normalizar el código según la
  convención existente sin aceptar sustituciones del frontend.
- Los campos de usuario presentes en modelos antiguos deben eliminarse o
  ignorarse en el backend.
- El nombre sirve para presentación; la llave de auditoría es el código.
- La sucursal operativa debe proceder de `user.branch.code`; no debe permitirse
  que el navegador la sustituya por otra diferente durante la sesión.
- Las validaciones de permisos futuras deben ejecutarse en el backend después
  de identificar al usuario.

## Pruebas mínimas

Agregar o adaptar pruebas en `backend/tests/test_access_session.py`:

1. El canje crea una sesión con el usuario devuelto por Fortuner.
2. La identidad queda asociada al token correcto y no se mezcla entre sesiones.
3. `GET /api/access/session` devuelve la identidad.
4. Una respuesta sin `user`, con código vacío, código mayor de 4 o
   `administrator` no booleano o sucursal inválida se rechaza como respuesta
   inválida de Fortuner.
5. El acceso administrativo queda auditado como `Ha27`.
6. Logout revoca también la identidad.
7. Al menos una operación auditada ignora un usuario falso enviado por el
   cliente y utiliza el de la sesión.

## Orden de despliegue

1. Publicar primero la versión actualizada de FORTUNER27.
2. Implementar y probar este contrato en Contabilidad.
3. Recompilar la entrega de CONTABDSI27; el ejecutable actual no incorporará
   automáticamente estos cambios.
4. Verificar inicio desde Fortuner con un usuario normal y con `Ha27`.
5. Confirmar en una operación de prueba controlada que la auditoría usa el
   código de la sesión.

Mientras Contabilidad no aplique esta guía, seguirá abriendo porque el contrato
de Fortuner es retrocompatible, pero descartará el nuevo objeto `user` y su
sesión continuará registrando únicamente el método de acceso.

