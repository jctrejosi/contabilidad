# Cambios de esquema

Registro de los cambios al modelo de datos, con su contraparte en el legado.
Existe por una asimetría concreta:

- El **modelo PostgreSQL es nuestro**: su DDL está versionado en
  `db/postgresql/schema/` y lo podemos cambiar.
- **Advantage no**: sus `.ADT` son la instalación del cliente. Cuando el modelo
  nuevo necesita algo que el legado no tiene, nosotros **no** lo alteramos: la
  diferencia se declara en el contrato de la ruta y queda registrado aquí lo que
  habría que implementar en Advantage para alcanzar la paridad.

Este registro es el puente entre las dos cosas: qué cambiamos en PostgreSQL y qué
de ello **debe implementarse en la base Advantage**.

## Convención

- Un archivo por cambio de esquema, con el **mismo número** que el archivo de
  `db/postgresql/schema/` que lo materializa (`15_…`, `16_…`).
- Cada archivo lleva: objeto, motivo con evidencia (`archivo:línea`), el DDL
  PostgreSQL, los endpoints que lo usan y **la contraparte requerida en Advantage**
  (o la razón por la que no existe y la ruta queda solo PostgreSQL).
- El backlog consolidado del lado Advantage está en `advantage-pendiente.md`.

## Índice

| Cambio | Archivo PostgreSQL | Contraparte en Advantage |
|---|---|---|
| Flujo de caja y rubros NIIF (3 tablas) | `db/postgresql/schema/15_flujo_caja_niif.sql` | **no existe** (propuesta en este registro) |
| Homologación de consolidación (2 tablas) | `db/postgresql/schema/16_consolidacion_homologacion.sql` | **no existe** (brecha declarada para `CONSOLID`, P27) |

## Cómo se aplica

- **Instalación limpia** (`contabdsi`, demo): `db/postgresql/docker-compose.yml`
  monta los `schema/*.sql` **uno por uno** en `/docker-entrypoint-initdb.d/` y el
  orden alfabético reproduce el de `scripts/up.sh` (schema → funciones → seed).
  Un archivo nuevo sólo entra si se añade su montaje al compose.
- **Base ya migrada** (`contabdsi_datos`): `dev.js` **no** carga `schema/*.sql`;
  crea la base vacía y restaura el respaldo, y el esquema viene **del propio
  dump** (`dev.js:910` y `dev.js:1065-1067`). Un archivo nuevo no viaja en el
  dump, así que hay que aplicarlo después del restore:

  ```
  psql "$DATABASE_URL" -f db/postgresql/schema/15_flujo_caja_niif.sql
  psql "$DATABASE_URL" -f db/postgresql/schema/16_consolidacion_homologacion.sql
  ```

  (o regenerar el dump en el PC con la licencia de Advantage, que es la otra vía.)
