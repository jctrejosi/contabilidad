# Backend Advantage de CONTABDSI

Este servicio conecta la pantalla **Plan de cuentas** con la tabla `CONMAE` de
Advantage Data Server.

La conexión se configura dentro de este proyecto mediante `backend/.env` o
variables de entorno. El servicio no depende de archivos externos. Use
`.env.example` como plantilla; el archivo `.env` está excluido de Git para no
publicar las credenciales.

Variables disponibles:

- `ADS_PROVIDER` (por defecto `Advantage.OLEDB.1`).
- `ADS_DATA_SOURCE`: ruta al diccionario `.add`.
- `ADS_USER_ID` y `ADS_PASSWORD`.
- `ADS_SERVER_TYPE` (por defecto `ADS_REMOTE_SERVER`).

También se admite `ADS_CONNECTION_STRING` cuando se prefiere suministrar la
cadena ADO completa desde el entorno.

### Motor de datos (legado o modelo nuevo)

La API puede atender contra Advantage o contra PostgreSQL sin cambiar los
endpoints: cada operación resuelve su implementación en `backend/store.py`.

- `CONTABDSI_STORE`: `ads` (por defecto) o `postgres`.
- `DATABASE_URL`: conexión de PostgreSQL; por defecto
  `postgres://contabdsi:contabdsi@127.0.0.1:5433/contabdsi` (el que levanta
  `db/postgresql/docker-compose.yml`).

Requiere el driver `psycopg` (`backend/requirements.txt`). El avance de la
transición por módulo está en `db/migration/04_transicion_del_backend.md`; hoy
están migrados `/api/health` y `/api/companias`.

Desde la carpeta `contabilidad`:

```powershell
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8001
```

Para entrar a la interfaz sin Advantage, `backend/.env` puede definir
`ADS_DEV_FALLBACK=1`: en ese caso `GET /api/companias` responde con compañías de
demostración (marcadas con `source="DEMO"`) y la pantalla de selección deja
pasar. El resto de rutas siguen necesitando ADS. El entorno del proceso tiene
precedencia sobre el archivo.

Rutas disponibles:

- `GET /api/health`: valida la conexion.
- `GET /api/companias`: consulta las compañías de `CONEMP` para el ingreso.
- `GET /api/terceros`: pagina y busca el maestro global `FADCLI`.
- `GET /api/centros?cia=027`: consulta `CONCECOS` aislado por compañía.
- `GET /api/tipos-documento`: consulta el maestro global `VISDOCUM` sin CIA.
- `GET /api/comprobantes?cia=027`: consulta `CONTICOM` aislado por compañía.
- `GET /api/movimiento-mensual?cia=027&anio=2025&mes=1`: consulta paginada de `MOV01`; admite filtros de cuenta, tercero, comprobante, centro y documento.
- `GET /api/cuentas?cia=027`: consulta las cuentas maestras de esa compañía.
- `POST /api/cuentas?cia=027`: crea una cuenta dentro de esa compañía.
- `PUT /api/cuentas/{codigo}?cia=027`: modifica una cuenta existente dentro de esa compañía sin cambiar su código.

El parámetro `cia` es obligatorio. Por seguridad funcional, solo se consultan
y modifican filas donde `CONMAE.CIA` coincida con `CONEMP.EMPCOD` seleccionado
y `NIT` esté en blanco (11 espacios), las mismas reglas del proyecto original.
