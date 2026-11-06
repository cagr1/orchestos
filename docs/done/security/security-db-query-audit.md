# OrchestOS — Auditoría de queries SQLite

L.5.5a, 2026-07-29. Auditoría realizada sobre todos los usos de `bun:sqlite` en `src/` y
scripts de producción.

## Parametrización

- Las queries de `runs`, `run_steps`, `memory`, `memory_conflicts`, `projects`, `instincts`,
  graph, usage y dashboard usan placeholders `?` para valores de usuario o de proyecto.
- Los filtros dinámicos de `instincts` solo concatenan nombres de columnas constantes del código;
  los valores siguen siendo parámetros.
- FTS5 recibe una query parametrizada y tokenizada; `q`/tool search se limita a 256 caracteres.
- `VACUUM INTO` no acepta bind parameters en SQLite. `backup.ts` escapa comillas simples del path,
  escribe en temporal y renombra atómicamente; el destino se verifica con `integrity_check`.
- `migrate.ts` construye `ALTER TABLE` con nombres/definiciones constantes internos, no con input
  HTTP/CLI. No se encontró interpolación de input externo en SQL de producción.

## Límites

- Dashboard de runs: `limit` inválido, cero, negativo, decimal o `NaN` cae a 50; valores positivos
  se acotan a 200. El análisis se acota a 200. La función DB acota cualquier caller positivo a
  1000; `listRuns(0)` queda reservado explícitamente para exportación CLI.
- Memory search limita el texto FTS a 256 caracteres y las respuestas SQL existentes tienen
  `LIMIT 200`/`LIMIT 20`. El FTS de conflictos tiene `LIMIT 5`.
- Uploads, explorer, fetch remoto, OCR y tool outputs ya tienen límites independientes documentados
  en L.3/L.4; SQLite no depende de esos límites para proteger la paginación pública.
- No se añadió truncamiento silencioso de columnas históricas: prompts/resultados JSON pueden ser
  grandes y deben clasificarse en el bloque de retención L.5.5 antes de imponer una política de
  pérdida de datos.

## Corrupción y concurrencia

- `ORCHESTOS_HOME` permite pruebas aisladas; `busy_timeout=5000` y la transacción `BEGIN IMMEDIATE`
  de `run_steps` cubren escritores concurrentes reales.
- `VACUUM INTO` crea backups consistentes sin copiar WAL a mano. `verifyDatabaseBackup()` abre en
  solo lectura y exige `PRAGMA integrity_check = ok`; restore nunca sobreescribe un destino existente.
- La migración es idempotente y reconstruye FTS; el manejo de DB corrupta es fail-safe en backup y
  degradación controlada en algunos lectores. No se intenta reparar ni borrar automáticamente la DB
  viva. Recuperación operacional y retención quedan para L.5.5/L.5.6.

## Hallazgos cerrados

Se corrigió el límite no acotado del endpoint `/api/runs?limit=...` y la entrada FTS sin límite.
Pruebas existentes de migración, integridad/concurrencia y backup cubren la evidencia de ejecución;
no se mezclaron sus archivos concurrentes en este cambio.
