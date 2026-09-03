# CONTABDSI · Presentación de migración

**Un solo archivo, formato lámina** (diagramas + detalles de migración importantes):

→ **[PRESENTACION.md](PRESENTACION.md)** — abre en la vista previa de
Zed/GitHub/VSCode; los `---` separan láminas, así que también se puede
proyectar con **Marp** (`npx @marp-team/marp-cli PRESENTACION.md`) o
convertir a PDF.

Contenido:

1. La idea en una lámina (antes → migración → después)
2. El esquema legado (cómo está hoy)
3. El esquema nuevo (cómo queda)
4. Cómo conectan las tablas viejas con las nuevas (diagramas por dominio)
5. La migración de datos: fases, orden de carga, reglas, conciliación, GO/NO-GO

El detalle exhaustivo (matrices de las 98 tablas, homologación de 2.663
campos, evidencia por función) vive en `../old_db/`, citado al pie del deck.
