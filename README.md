# CONTABDSI — modernización de la aplicación contable

Este repositorio contiene la migración gradual del sistema heredado CONTABDSI
hacia una interfaz React y servicios Python. Durante la transición, algunas
funciones continúan consultando Advantage Data Server y posteriormente podrán
moverse al esquema PostgreSQL definido en `db`.

## Estructura principal

- `Interface_web`: aplicación React generada inicialmente en Figma Make.
- `backend`: API Python/FastAPI y acceso ADO a Advantage Data Server.
- `db`: diseño del futuro esquema PostgreSQL.
- `docs`: documentación funcional y técnica de cada función migrada.

## Función implementada: Plan de cuentas

La pantalla **Configuración → Plan de cuentas** ya consulta la tabla real
`CONMAE` y permite crear o modificar cuentas maestras. Su diseño, mapeo de
campos, reglas contables y flujo técnico están documentados en
[`docs/PLAN_CUENTAS_ADS.md`](docs/PLAN_CUENTAS_ADS.md).

Al abrir la aplicación se debe seleccionar una compañía real de `CONEMP`. Ese
código queda como contexto de sesión y el Plan de cuentas consulta y escribe
únicamente filas cuyo campo `CONMAE.CIA` corresponda a la compañía elegida.

La opción **Configuración → Terceros** consulta el maestro global `FADCLI` con
búsqueda y paginación en Advantage. Esta tabla es compartida por todas las
compañías. El alcance y las reglas pendientes de escritura están documentados
en [`docs/TERCEROS_ADS.md`](docs/TERCEROS_ADS.md).

La opción **Movimientos → Importaciones** lee archivos XLSX, CSV, TXT o ADT y crea
un lote Borrador que debe verificarse antes de actualizarse. Su flujo y reglas
están documentados en [`docs/IMPORTACIONES_ADS.md`](docs/IMPORTACIONES_ADS.md).

## Ejecución local

La forma recomendada es el script `dev.js`, que comprueba e instala lo que
falte (entorno virtual, `requirements.txt`, `node_modules`), levanta la base de
datos PostgreSQL de referencia, el backend y la interfaz, y muestra las URLs:

```powershell
node dev.js            # levanta todo y libera la terminal
node dev.js --check    # solo verifica herramientas y dependencias
node dev.js --stop     # detiene los servicios levantados
node dev.js --no-db    # omite PostgreSQL (backend sobre Advantage)
```

Los servicios quedan corriendo en segundo plano y cada uno escribe su registro
en `logs/<servicio>.log` (`backend.log`, `web.log`, `db.log`). La salida de los
servicios no se canaliza a la consola: la terminal solo muestra el progreso del
arranque y las URLs, y queda libre al terminar.

También se pueden levantar las piezas por separado.

Backend, desde la raíz de este repositorio:

```powershell
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8001
```

Frontend, desde `Interface_web`:

```powershell
npm run dev
```

La interfaz queda disponible en `http://127.0.0.1:8443/`. Vite dirige las
solicitudes `/api` al backend del puerto `8001`.

## Criterio de documentación

Cada nueva función debe registrar como mínimo:

1. Objetivo dentro del proceso contable.
2. Pantallas, botones y validaciones.
3. Tablas y campos de origen/destino.
4. Reglas heredadas que deben conservarse.
5. Endpoints y flujo de datos.
6. Operaciones permitidas y datos de solo lectura.
7. Pruebas necesarias para considerar terminada la función.
