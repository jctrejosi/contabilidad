# Montar la base Advantage local (`ADD_CONTAB`)

Guía para dejar funcionando lo que ya existe: el backend contra el diccionario
del legado. Complementa el bloqueo descrito en [`README.md`](README.md) §4.

## 1. Qué hay que instalar (y qué no)

**No hay forma de evitarlo: hace falta el motor/cliente de Advantage en este
equipo.** El proveedor es una DLL que se registra como COM en Windows; sin ella,
ni el backend actual ni el extractor del ETL pueden abrir los `.ADT`. Esto vale
también para conectarse a un servidor remoto: el proveedor es del lado cliente.

Un único instalador de **Advantage 11.1, 64 bits**, deja las cuatro piezas que el
código usa:

| Pieza | Para qué la usa el backend |
|---|---|
| **ACE / Local Server** (`adsloc64.dll`) | Motor que abre los archivos sin servidor. Es el corazón del asunto |
| **Proveedor OLE DB** `Advantage.OLEDB.1` | Vía por defecto (`ads_repository`) |
| **Driver ODBC** `Advantage StreamlineSQL ODBC` | Vía usada en operaciones masivas y para `VISAUDI` (`auditoria_repository`, `lotes_repository`, `reproceso_mensual_repository`) |
| **Advantage Data Architect** | GUI para abrir y administrar el diccionario. **No la necesita el backend**, pero sí tú (§3) |

| ¿Necesito…? | Respuesta |
|---|---|
| ¿Solo el cliente (ACE)? | Basta para abrir archivos locales |
| ¿El servidor completo? | Solo si quieres acceso multiusuario/remoto por red |
| ¿Data Architect? | Recomendable: sin ella no descubres la contraseña ni las compañías de `CONEMP` |

**Dos requisitos que no son negociables:**

1. **64 bits.** El backend corre sobre Python 3.13.1 64-bit (verificado:
   `…\.venv\Scripts\python.exe` → `arquitectura: 64bit`, y `pywin32` se instaló
   como `cp313-win_amd64`). El proveedor de 32 bits no sirve.
2. **La versión 11.1 (build `11.10.0.24`).** Es contra la que se desarrolló: el
   código cita explícitamente ese número y dos defectos suyos
   (`adsoledb64.dll 11.10.0.24` con callback `C0000005` al cerrar conexiones y en
   `UPDATE` extensos, por eso existen las rutas ODBC). Instalar otra versión
   puede funcionar, pero deja de estar probado.

## 2. Dónde conseguir el instalador

**No doy una URL a propósito.** Advantage es producto heredado de SAP (antes
Sybase/iAnywhere) y sus descargas viven detrás del portal oficial, con cuenta y
licencia. Canales, en orden de preferencia:

1. **El cliente que ya opera VISION/DATASOFT.** Esa instalación tiene el ACE
   11.10 (y probablemente `C:\VISADS\`) y conserva el instalador original. Pedir
   ese instalador es el camino más rápido, seguro y con la licencia correcta.
2. **Portal oficial de SAP** (SAP for Me → Software Downloads), buscando
   «Advantage Database Server» / «Advantage Client Engine».
3. Si aparece por ahí suelto en repositorios de terceros, **no lo uses**: es una
   DLL que se registra en COM y va a quedar con acceso a contabilidad real.

> No puedo verificar desde aquí la disponibilidad ni el estado de soporte
> actuales del producto; confírmalo con quien tenga la licencia. Es el dato que
> me falta para darte un enlace fiable.

## 3. Cómo se «monta» la base

La base **ya existe**: es el conjunto `PUBLIDATA.add` (diccionario) + los `.adt`
(tablas). No se crea nada; «montarla» es abrirla con el motor.

1. **Instalar** Advantage 11.1 64-bit (con los proveedores y Data Architect).
2. **Verificar el registro del proveedor:**
   ```powershell
   reg query "HKLM\SOFTWARE\Classes\Advantage.OLEDB.1"
   reg query "HKLM\SOFTWARE\ODBC\ODBCINST.INI\Advantage StreamlineSQL ODBC"
   node dev.js --check
   ```
   El chequeo debe pasar de `Advantage → motor no instalado` a
   `proveedor OLEDB registrado`.
3. **Abrir el diccionario con Data Architect:**
   `File → Open → Dictionary` → `ADD_CONTAB\PUBLIDATA.add`.
   Anota de ahí:
   - **usuario y contraseña** del diccionario. Para el diccionario Publidata el
     proyecto `ecommerce` tiene documentado `AdsSys` / `Pubdata`
     (`db/adt-reader/export-publidata.ps1`); si no coincide, ahí lo verás.
   - **las compañías de `CONEMP`** — esos son los códigos con los que entrarás;
   - si las tablas están dentro del diccionario o son tablas libres.
4. **Preparar la carpeta.** El motor local necesita **escritura** en el
   directorio (índices `.adi`/`.ai`, bloqueos). `ADD_CONTAB` está hoy dentro del
   repositorio y fuera de Git: trabaja sobre **una copia** y quita el atributo de
   solo lectura, no sobre el único juego de datos que tienes.
5. **Configurar `backend/.env`** (sustituye la clave real):
   ```text
   ADS_PROVIDER=Advantage.OLEDB.1
   ADS_DATA_SOURCE=C:\Users\jctre\Seeds\contabilidad\ADD_CONTAB\PUBLIDATA.add
   ADS_USER_ID=AdsSys
   ADS_PASSWORD=Pubdata
   ADS_SERVER_TYPE=ADS_LOCAL_SERVER
   ADS_ODBC_DRIVER=Advantage StreamlineSQL ODBC
   ADS_AUDIT_DATA_SOURCE=C:\VISADS
   ```
   - `ADS_LOCAL_SERVER` = acceso directo a los archivos, sin servicio. Se mapea
     a `ServerTypes=1`. Usa `ADS_REMOTE_SERVER` solo si levantas el servidor.
   - La auditoría (`VISAUDI.ADT`) es una **tabla libre** en otra carpeta: no está
     en `ADD_CONTAB`. Sin `C:\VISADS\VISAUDI.ADT`, las operaciones que auditan
     (contabilización directa, anulación, reproceso) fallarán.
6. **Quitar `ADS_DEV_FALLBACK`** de `backend/.env`: deja de tener sentido cuando
   `CONEMP` responde de verdad.
7. **Comprobar:**
   ```powershell
   node dev.js                 # el paso «Advantage» prueba check_connection()
   curl http://127.0.0.1:8443/api/companias   # debe decir source: CONEMP
   curl http://127.0.0.1:8443/api/health      # 200
   ```
   Después entra en `http://127.0.0.1:8443` y elige una compañía real.

## 4. Advertencias

- **Son datos contables reales.** Con `ADS_LOCAL_SERVER` el backend puede
  **escribir** (crear cuentas, contabilizar lotes, anular). Trabaja sobre copia
  y evita operaciones de escritura hasta validar el entorno.
- **Rendimiento**: `mov01.ADT` pesa 1.16 GB y `COCENTRO` 812 MB. El modo local es
  cómodo para desarrollar, pero los informes grandes pueden tardar; para uso
  multiusuario hace falta el servidor.
- **`ADD_CONTAB` no es la base completa**: falta el 90 % de las tablas (ver
  [`01_inventario_fuente.md`](01_inventario_fuente.md)). Pantallas como Terceros,
  Cuentas, Documentos o Movimiento mensual funcionarán; Bitácora depende de
  `VISAUDI`, y los módulos de impuestos, activos o exógena no tienen datos aquí.
- **No borrar ni reorganizar** los `.adt`/`.adi` al terminar (regla 10.8 del plan
  maestro).

## 5. Cuando ya funcione

Ese mismo motor habilita la **fase 5 del plan de migración** (extractor y
staging): el perfilado de solo lectura sobre la copia real es el siguiente paso
natural. Ver [`03_plan_de_carga.md`](03_plan_de_carga.md).

## 6. ¿Y otro motor embebido (Actian Zen, Pervasive PSQL, Btrieve)?

**No sirve.** Son productos de otro fabricante y otra línea de archivos: `Zen` y
`Pervasive PSQL` vienen de la familia Btrieve, no leen `.ADT`/`.ADD` y no
exponen los proveedores que el backend exige **por nombre**. El código no es
agnóstico de motor:

- `ADS_PROVIDER` por defecto `Advantage.OLEDB.1`, y una
  `ADS_CONNECTION_STRING` se **rechaza** si no contiene `Advantage.OLEDB`
  (`ads_repository.load_connection_string`);
- el driver ODBC por defecto es `Advantage StreamlineSQL ODBC` y la cadena
  termina en `DefaultType=Advantage` (palabra clave de Advantage);
- `ADS_SERVER_TYPE` solo admite `ADS_LOCAL_SERVER`, `ADS_REMOTE_SERVER` o
  `ADS_INTERNET_SERVER`; cualquier otro valor es error de configuración.

Conclusión: para que esto funcione tal cual hace falta **Advantage (11.1, 64
bits)**. Cambiar de motor implica reescribir la capa de datos — y para eso el
destino ya decidido es PostgreSQL, que tampoco lee `.ADT`: la extracción sigue
necesitando Advantage o un export del cliente.

### Si no hay forma de instalar Advantage en este equipo

No hace falta instalarlo aquí para empezar: el extractor puede correr **en la
máquina del cliente**, donde VISION/DATASOFT ya tiene el ACE, o pedirles una
**exportación** de las tablas con Data Architect (CSV/DBF). Eso desbloquea la
fase 5 sin tocar este equipo; lo que no se puede evitar es que *alguien* lea los
`.ADT` con el motor de Advantage.
