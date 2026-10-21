# 08 — Calidad, pruebas y operación

## 1. Estrategia de pruebas

La suite maneja dinero y cumplimiento; la calidad no es opcional. La estrategia
se apoya en la pirámide de pruebas y en invariantes contables verificables.

### 1.1 Niveles

| Nivel | Qué cubre | Herramienta |
|---|---|---|
| Unitario | Reglas de dominio, cálculos, impuestos, redondeos | `pytest` |
| Integración | Servicio + PostgreSQL real, transacciones, secuencias | `pytest` + PostgreSQL efímero |
| Contrato | API contra esquema OpenAPI y cliente | `schemathesis` o equivalente |
| End-to-end | Flujos completos en navegador | Puppeteer/Playwright |
| Regresión | Casos golden de informes y XML DIAN | Archivos de referencia |
| Carga | Posteo concurrente, reportes grandes | Locust/k6 |
| Seguridad | RBAC, inyección, secretos, sesiones | OWASP ZAP + revisión |
| Aceptación | Casos del contador/revisor | UAT documentada |

### 1.2 Invariantes como pruebas

Cada invariante de `03-modelo-datos.md` (I-01 a I-35) debe tener al menos una
prueba automatizada. Ejemplos:

- Postear un asiento descuadrado falla y no deja rastro.
- Dos posteos concurrentes no duplican ni saltan número.
- Revertir dos veces devuelve el mismo resultado.
- La suma de aplicaciones nunca supera el saldo.
- La depreciación acumulada nunca supera costo − residual.
- El snapshot no cambia después de un posteo posterior.
- La auditoría detecta una fila alterada.

### 1.3 Pruebas de propiedades

Para cálculo de impuestos, redondeos, aplicación de pagos y depreciación:

- Propiedad: la suma de líneas = total del documento.
- Propiedad: débitos = créditos en cualquier asiento generado.
- Propiedad: el saldo de una partida = original − aplicaciones.
- Propiedad: la tabla de depreciación suma costo − residual.

### 1.4 Casos golden

Se conservan archivos de referencia para:

- XML UBL 2.1 de factura y nota crédito.
- Validación de 5 valores de exógena.
- Balance de comprobación y estados financieros de un periodo de prueba.
- Conciliación bancaria con diferencias explicadas.

Un cambio que altere un golden exige justificación y aprobación funcional.

## 2. CI/CD

### 2.1 Pipeline mínimo

```text
1. Lint y formato
2. Tipado (Python y TypeScript)
3. Migraciones: aplicar y revertir en base vacía
4. Tests unitarios
5. Tests de integración con PostgreSQL
6. Build de frontend
7. Tests E2E de humo
8. Análisis de seguridad de dependencias
9. Publicación de artefacto
```

### 2.2 Reglas

- Ningún merge sin pipeline verde.
- Cobertura mínima del dominio: 80 % (no sustituye pruebas de invariantes).
- Migraciones prohibidas de editar una vez aplicadas en producción.
- Versionado semántico de la API; cambios incompatibles crean `/v2`.
- Feature flags para módulos en transición.
- Despliegue con migración previa y rollback probado.

## 3. Requisitos no funcionales

| Categoría | Requisito |
|---|---|
| Latencia de comandos | p95 < 1,5 s para posteo de factura de 50 líneas |
| Latencia de consultas | p95 < 800 ms para listados paginados |
| Reportes | < 10 s para un periodo y 100k líneas; paginación si excede |
| Concurrencia | 50 usuarios concurrentes sin bloquear secuencias |
| Disponibilidad | 99,5 % en horario laboral; ventanas de mantenimiento avisadas |
| RPO | ≤ 15 minutos |
| RTO | ≤ 4 horas |
| Retención de datos | Según normativa aplicable y política del cliente |
| Seguridad | TLS, RBAC, hash de contraseñas, secretos fuera del repo |
| Auditoría | 100 % de comandos con actor, fecha, antes/después y motivo |
| Accesibilidad | Navegación por teclado y contraste en pantallas críticas |
| Compatibilidad | Últimas dos versiones de Chrome/Edge/Firefox |
| Idiomas | Español Colombia; formatos de fecha/importe locales |

## 4. Observabilidad

### 4.1 Logs

Estructurados (JSON) con:

- `timestamp`, `level`, `request_id`, `usuario_id`, `compania_id`.
- `modulo`, `operacion`, `entidad`, `entidad_id`.
- Duración y resultado.
- Sin datos sensibles (NIT completo, cuentas bancarias, tokens).

### 4.2 Métricas

- Posteos por minuto y por tipo.
- Errores por módulo y código.
- Cola de outbox y reintentos.
- Conciliaciones pendientes y antigüedad.
- Trabajos DIAN por estado.
- Duración de cierres y reportes.
- Uso de conexiones y locks.

### 4.3 Alertas

1. Fallo repetido de DIAN.
2. Outbox con más de N reintentos.
3. Diferencia de conciliación sin explicar al cierre.
4. Posteos fallidos por periodo cerrado.
5. Backup fallido o restauración no probada.
6. Latencia por encima del umbral.
7. Acceso denegado repetido (posible ataque).

## 5. Backups y continuidad

1. Backup completo diario + WAL archiving para recuperación a punto en el tiempo.
2. Retención definida con el cliente y requisitos legales.
3. Restauración probada mensualmente en ambiente aislado.
4. Backups cifrados y fuera del servidor de aplicación.
5. Plan de continuidad documentado: quién, cómo y en cuánto tiempo.
6. Prueba de rollback de despliegue y de migración.

## 6. Seguridad operativa

1. Principio de menor privilegio para base de datos y servicios.
2. Rotación de secretos y claves de API.
3. Revisión de dependencias y parches.
4. Protección contra inyección SQL (consultas parametrizadas).
5. Validación de archivos importados (tipo, tamaño, hash, filas).
6. Rate limiting en endpoints públicos y de autenticación.
7. Bloqueo por intentos fallidos y expiración de sesión.
8. Registro de accesos y cambios de permisos.
9. Separación de ambientes y datos anonimizados fuera de producción.

## 7. Ambientes

| Ambiente | Uso | Datos |
|---|---|---|
| Desarrollo | Implementación local | Semilla y datos ficticios |
| Pruebas | QA y UAT | Copia anonimizada |
| Producción | Operación real | Datos reales con acceso restringido |

Reglas:

- No se copian datos de producción a desarrollo sin anonimizar.
- Las pruebas E2E no escriben en producción.
- Los secretos son distintos por ambiente.

## 8. Documentación

Cada módulo debe tener:

1. Especificación funcional (este plan + `docs/` del módulo).
2. Contrato de API (OpenAPI).
3. Modelo de datos y migraciones.
4. Reglas e invariantes.
5. Manual de usuario.
6. Runbook operativo (errores comunes, reintentos, escalamiento).
7. Casos de prueba y golden files.

La documentación se actualiza en el mismo cambio que el código. Un módulo sin
documentación no se considera terminado.

## 9. Gestión de defectos

| Severidad | Definición | Tiempo objetivo |
|---|---|---|
| Crítica | Afecta dinero, cierre o cumplimiento | Corrección inmediata + postmortem |
| Alta | Bloquea una operación diaria | ≤ 1 día hábil |
| Media | Degrada operación con workaround | ≤ 1 semana |
| Baja | Cosmética o mejora | Backlog |

Todo defecto crítico genera:

- Registro con evidencia y alcance.
- Corrección con prueba de regresión.
- Postmortem sin culpables.
- Acción preventiva.

## 10. Criterios de liberación

1. Pipeline verde y cobertura mínima.
2. Migraciones probadas y reversibles.
3. Pruebas E2E de humo en el ambiente de pruebas.
4. Validación funcional del contador en los módulos contables.
5. Backup previo y plan de rollback.
6. Notas de versión y comunicación a usuarios.
7. Monitoreo activo durante las primeras 24 horas.
