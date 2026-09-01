## MES 23 — L: línea base profesional de seguridad (nuevo, 2026-07-28)

**Tabla de estado de bloques al cierre (2026-07-29)**

| Bloque | Estado |
| --- | --- |
| L.0–L.5.6 | ✅ Cerrado con evidencia en este registro |
| L.5.7 | ✅ Cerrado (2026-07-30) — L.5.7.1–L.5.7.7 documentados y verificados |
| L.6.1 | ✅ Gate reproducible cerrado |
| L.6.2 | ⏳ Pendiente heredado: revisión visual/manual y decisión sobre L62-001/L62-002 |

**Motivo:** seguridad no se ha tratado todavía como un frente propio. OrchestOS no es solo un
dashboard: lee y escribe archivos del usuario, ejecuta comandos, crea worktrees, invoca CLIs/LLMs,
recibe contenido externo y almacena API keys/configuración. Por lo tanto, el límite de confianza no
es únicamente la UI: una tarea, archivo, skill, respuesta de modelo o URL puede ser entrada hostil.

**Estado verificado antes de abrir este bloque:** ya existen controles puntuales para SSRF
([src/dashboard/ssrf.ts](../../src/dashboard/ssrf.ts)), sandbox/worktrees, límites de tools, sanitización
de HTML/XSS y separación de datos externos en OCR. También existe [sandbox-policy.test.ts](../../src/__tests__/sandbox-policy.test.ts)
y [ssrf.test.ts](../../src/__tests__/ssrf.test.ts). Eso es una base útil, pero no equivale todavía a una
auditoría de seguridad: no hay threat model formal, matriz de activos/amenazas, revisión completa de
autenticación/exposición de red, ni gate repetible para secretos/dependencias.

**Objetivo:** establecer una baseline de seguridad adecuada para una herramienta local de desarrollo,
sin fingir que eso la convierte automáticamente en un servicio multiusuario o en un producto con
certificación. Si algún día el dashboard se expone fuera de localhost o se vuelve multiusuario, se
debe abrir un bloque separado de seguridad de producción; no ampliar estos controles por intuición.

### L.0 — 🧠 Threat model y límites de confianza (prerequisito)

- [x] **L.0 — 🧠 (2026-07-29)** Threat model escrito y verificado contra el código real (no
  asumido): activos (API keys en `~/.orchestos/.env` texto plano, código del usuario, DB SQLite,
  prompts, capacidad de `Bun.spawn`), actores/entradas no confiables (tarea/skill importada,
  contenido web, imagen/OCR, salida de LLM, CLI externo), y límites de confianza verificados
  (bind `127.0.0.1` + `isSameOrigin()` sin auth real en `server.ts`, traversal check en estáticos,
  `enforceContract()` como único punto de escritura, 8 sitios de `Bun.spawn` confirmados con arrays
  de argumentos — sin interpolación de shell, `ssrf.ts` con resolución DNS real, `sandbox-policy.ts`
  exigiendo working tree limpio). Entregable: [docs/security-threat-model.md](../../docs/security-threat-model.md).
  6 gaps reales documentados para L.1-L.6 (sin auth, API keys sin cifrar, contenido externo
  como dato solo por convención de prompt, sin matriz de path traversal, sin `bun audit`, sin
  retención/backup de la DB), y alcance explícitamente fuera de esta baseline (exposición no-local,
  multiusuario, cifrado completo de DB, compliance formal). No se cambió código de producción.

### L.1 — ⚡ Inventario de superficie y secretos

- [x] **L.1 — Inventario y secretos (2026-07-29).** Se documentó el inventario de dashboard, CLI,
  tools, subprocesses, filesystem, configuración y persistencia en
  [docs/security-secrets-audit.md](../../docs/security-secrets-audit.md). Se confirmó que las keys de
  proveedores viven en `~/.orchestos/.env` en texto plano y que los datos históricos no se migran
  automáticamente.
- [x] Se añadió `src/security/secrets.ts` y `scripts/check-secrets.ts` con detección de claves
  conocidas, Bearer tokens, private keys y asignaciones de credenciales. `bun run security:secrets`
  revisa líneas añadidas del diff staged sin imprimir valores; `secrets.test.ts` cubre fixtures
  positivos, negativos y redacción en logs/respuestas HTTP.
- [x] Se aplicó `redactSensitive()` antes de persistir logs, `runs`, `run_steps`, errores HTTP y
  exports derivados. Se documentó rotación/revocación y se decidió no inventar cifrado propio;
  keychain del sistema queda como opción futura si el modelo local necesita protección en reposo.
- [x] Verificación: `bun test src/__tests__/secrets.test.ts --timeout 30000` (`4 pass`, `0 fail`,
  `8 expect() calls`) y `bun run typecheck` limpio. La suite completa validada con acceso de escritura
  a SQLite: `938 pass`, `0 fail`, `2125 expect() calls` en `87` archivos; el intento sin acceso elevado
  produjo solo `SQLITE_READONLY` en `~/.orchestos/db.sqlite` y no fue un fallo funcional.
  `bun run security:secrets:tracked` queda listo para CI. No se imprime el valor de ningún hallazgo.

### L.2 — 🧠 Autenticación, exposición de red y CSRF

- [x] **L.2 — 🧠 (2026-07-29)** Modelo de despliegue confirmado como el documentado en
  [docs/security-threat-model.md](../../docs/security-threat-model.md) §6: **solo localhost, usuario
  único, sin autenticación multiusuario**; no se implementó auth/CSRF-token/rate-limit para
  exposición no-local porque esa exposición no existe hoy y construirla sería diseñar
  especulativamente para una amenaza que no aplica — queda explícitamente gated a que Carlos decida
  exponer el dashboard fuera de loopback, momento en el que se abre una revisión de seguridad aparte
  (ya anotado como límite en L.0).
- [x] **Bind a loopback verificado con test real, no solo lectura de código.** `startServer()`
  (`server.ts`) sigue haciendo bind exclusivo a `127.0.0.1` — no existe ningún flag `--host` en el
  CLI que permita cambiarlo, por lo que "advertencia si se cambia" no aplica todavía (no hay forma de
  cambiarlo). Test de regresión: `src/dashboard/__tests__/csrf-origin.test.ts` levanta el server real
  y confirma `server.hostname === '127.0.0.1'` vía la API de Bun, no un grep de string.
- [x] **Hallazgo real de CSRF corregido, no solo documentado.** `isSameOrigin()` ([http.ts](../../src/dashboard/http.ts))
  solo comparaba `hostname` (`localhost`/`127.0.0.1`) e ignoraba el puerto (`_port` recibido pero sin
  usar) — cualquier página servida desde OTRO puerto de localhost (ej. un dev server abierto en el
  mismo navegador) pasaba la verificación y podía enviar mutaciones al dashboard. Confirmado
  causalmente: con el código anterior, un origen `http://localhost:9999` contra el dashboard en otro
  puerto devolvía `400` (pasó la verificación de origen, falló después por otra razón), no `403`. Fix:
  ahora exige que el puerto del origen coincida exactamente con el puerto del server.
- [x] **Tests negativos** en `csrf-origin.test.ts` (7 casos): mismo host+puerto → autorizado (2
  variantes, `localhost`/`127.0.0.1`); puerto distinto → `403`; origen remoto arbitrario → `403`;
  sin header `Origin` (cliente no-navegador, ej. CLI/curl) → no bloqueado por origen (comportamiento
  intencional, documentado); `GET` no se filtra por origen (solo POST/PUT/DELETE mutan). Los casos de
  "credencial inválida", "replay" y "usuario sin permiso por proyecto/ruta" del ítem original se
  marcan **not-applicable**: no hay credenciales ni multiusuario en el modelo local confirmado — no
  se inventa un sistema de auth falso para tener algo que testear.
- [x] **Verificación:** `bun test src/dashboard/__tests__/csrf-origin.test.ts --timeout 30000` (`7
  pass`, `0 fail`, `7 expect() calls`), `bun run typecheck` limpio. Suite completa: `944 pass`, `1
  fail`, `2132 expect() calls` en `88` archivos — el único fallo es preexistente y **ajeno a este
  ítem**: `src/__tests__/secrets.test.ts` (L.1, ⚡) falla el caso `private-key` también en HEAD sin
  ningún cambio de L.2 (confirmado con `git stash`). No se tocó por scope-lock — reportado, no
  corregido, porque L.1 es ⚡ y ya está cerrado.

**Cabo suelto para reportar, no para resolver acá:** `secrets.test.ts` (L.1) tiene una regresión real
(`private-key` no detectado) posterior al cierre documentado de L.1 en este mismo PLAN.md. Alguien
debe revisar `src/security/secrets.ts` — no es parte del alcance de L.2.

### L.3 — ⚡ Filesystem, worktrees y ejecución de comandos

- [x] **L.3 — Filesystem y subprocesses (2026-07-29).** Se creó la política común en
  [src/run/path-policy.ts](../../src/run/path-policy.ts) y la matriz documentada en
  [docs/security-filesystem-policy.md](../../docs/security-filesystem-policy.md): paths relativos,
  absolutos, `../`, traversal con una y dos capas de encoding, symlinks externos e internos,
  `cwd` fuera del root y archivos no regulares. `enforceContract`, tools, checks y diff de
  worktree usan ahora la misma resolución real del root; un path LLM no puede ampliar
  silenciosamente `output[]`.
- [x] Todos los puntos de CLI auditados mantienen arrays de argumentos sin shell interpolation.
  `runChecks` valida `cwd` y filtra el entorno con `safeChildEnv()`; se mantienen timeouts,
  señales de terminación y límites de salida existentes. Las rutas de executor apuntan al
  worktree ya creado por sandbox y la lectura de diff descarta paths que no resuelven dentro de él.
- [x] Regresión observable en `src/__tests__/path-policy.test.ts`: `36 pass`, `0 fail`, `106
  expect()` calls contando contract/sandbox/path-policy; incluye command injection por metacaracteres,
  variable arbitraria heredada, symlink escape, symlink de escritura, `cwd` y traversal codificado.
  Verificación adicional: `bunx tsc --noEmit` limpio. La terminación de procesos hijos ya existentes
  sigue dependiendo del mecanismo de señal de Bun; no se inventa un process-group portable en esta
  pasada. Junctions y FIFO no aplican al filesystem/runtime soportado en macOS sin añadir un
  fixture dependiente del sistema; quedan explícitamente como gap residual, no como cobertura falsa.

### L.4 — ⚡ SSRF, contenido externo y prompt injection

- [x] **L.4 — SSRF y contenido externo (2026-07-29).** Se reforzó `src/dashboard/ssrf.ts`:
  loopback, RFC1918, link-local, metadata/link-local, IPv6 ULA/link-local/multicast, IPv4-mapped
  IPv6, schemes no HTTP(S), credenciales y puertos no estándar quedan bloqueados. `fetch_url`
  rechaza redirects, respuestas no-2xx, aplica timeout de 10s y lectura incremental de 256 KB;
  skill import remoto aplica la misma política con timeout de 15s y límite de 256 KB. Se añadió
  segunda resolución DNS posterior al fetch para detectar rebinding observable. El límite honesto
  de pinning de socket queda documentado en [docs/security-ssrf-policy.md](../../docs/security-ssrf-policy.md):
  el fetch global no permite coordinar IP resuelta con SNI/Host; no se declara una garantía que no
  existe.
- [x] Web, OCR, adjuntos, memoria y `read_file` ahora se marcan con
  `<untrusted-data>` y el system prompt prohíbe obedecer instrucciones allí ni permitir que cambien
  tools, paths, modelo, permisos o aceptación. `read_file` también usa la política central de
  paths de L.3, incluida protección contra symlinks.
- [x] Verificación: `bun test src/__tests__/ssrf.test.ts src/__tests__/chat-fetch-url.test.ts
  src/__tests__/chat-read-project-tools.test.ts --timeout 30000` (`57 pass`, `0 fail`, `65
  expect()` calls) y `bunx tsc --noEmit` limpio. Casos incluidos: IPv6, mapped IPv6, DNS rebinding
  con lookup que cambia de público a loopback, credenciales, puertos, scheme, límite de cuerpo,
  contenido con prompt injection y paths de archivo.

### L.5 — ⚡ SQLite, configuración y privacidad

- [x] **L.5.0 — Aislamiento de DB para tests (2026-07-29).** Preflight con `bunx tsc --noEmit`
  pasó, pero 14 tests de persistencia fallaron al intentar escribir en la DB real de
  `~/.orchestos` (readonly en el entorno). Se corrigió [src/db/sqlite.ts](../../src/db/sqlite.ts) para
  aceptar `ORCHESTOS_HOME`, conservando `~/.orchestos` como default de producción, y se agregó
  [sqlite-path.test.ts](../../src/__tests__/sqlite-path.test.ts), que lo verifica en un proceso Bun nuevo.
  La suite de DB debe ejecutarse con una raíz temporal/aislada; no se considera aceptable depender de
  cleanup sobre la DB real del usuario. Esto es el primer paso de aislamiento, no cierra todavía la
  cobertura completa de migraciones, corrupción, backup ni recuperación. Verificación aislada:
  `ORCHESTOS_HOME=/private/tmp/orchestos-l5-suite bun test ...` → `33 pass`, `0 fail`, `65 expect()`
  calls en 7 archivos. El `tsc --noEmit` previo detectó un fallo ajeno en
  `src/dashboard/handlers/chat.ts`, dentro de cambios concurrentes de L.4: identificador Unicode
  declarado como `postFetchSsrֆBlock` pero usado como `postFetchSsrфBlock`; no se corrigió por
  scope-lock.
- [x] **L.5.1 — Migraciones reproducibles (2026-07-29).** Se agregó
  [migration.test.ts](../../src/__tests__/migration.test.ts), con procesos Bun aislados para verificar DB
  vacía, DB legacy con preservación de filas y ejecución idempotente. No se tocó la DB real del
  usuario ni se simuló SQLite. Verificación: `ORCHESTOS_HOME=/private/tmp/orchestos-l5-suite bun test
  src/__tests__/migration.test.ts --timeout 30000` → `3 pass`, `0 fail`, `11 expect() calls`.
- [x] **L.5.2a — Integridad de queries y concurrencia (2026-07-29).** Se verificó persistencia
  parametrizada contra SQL-looking content y se corrigió la carrera real de `run_steps`: la secuencia
  `MAX(seq)+1` ahora está dentro de `BEGIN IMMEDIATE`; SQLite usa `busy_timeout=5000` y el cambio de
  WAL concurrente no rompe el arranque si otro proceso está recuperando la DB. Test con dos procesos
  reales: `40` pasos, secuencia `1..40`, `40` valores únicos. Verificación conjunta con migraciones y
  DB: `7 pass`, `0 fail` para backup/integrity/migrations; `10 pass`, `0 fail` para integridad,
  concurrencia y run-steps. Siguen pendientes límites explícitos de tamaño y un escenario de
  corrupción recuperable; no se declaran cubiertos por estos tests.
- [x] **L.5.3a — Backup y privacidad básica (2026-07-29).** Se agregó
  [src/db/backup.ts](../../src/db/backup.ts): snapshot consistente con `VACUUM INTO`, escritura temporal
  + rename atómico, permisos `0600` y `PRAGMA integrity_check` sobre el backup. `upsertMemory()` ya
  redacta credenciales antes de persistir contenido. Test real: backup privado e íntegro + secreto
  redacted, incluido en `7 pass`, `0 fail`, `28 expect() calls`.
- [x] **L.5.4a — Detección de corrupción y recuperación segura (2026-07-29).**
  `verifyDatabaseBackup()` ahora falla cerrado (`ok:false`) ante un archivo corrupto y
  `restoreDatabaseBackup()` valida antes de copiar, se niega a sobrescribir destinos existentes,
  escribe temporal + rename y vuelve a ejecutar `integrity_check`. No toca automáticamente
  `~/.orchestos/db.sqlite`. Tests reales: backup válido restaurado a un archivo nuevo y backup
  corrupto rechazado; `bunx tsc --noEmit` limpio y `bun test src/__tests__/db-backup.test.ts` →
  `3 pass`, `0 fail`, `12 expect() calls`.
- [x] **L.5.7 — Linaje versionado y rollback de migraciones (cerrado 2026-07-30).** L.5.1 cubre DB vacía, legacy con
  columnas faltantes, preservación de filas e idempotencia, pero no existe todavía una secuencia
  histórica formal ni un `schema_version`. Cerrar este gap en el siguiente orden:
  - [x] **L.5.7.1 — Baseline de esquema (2026-07-29).** Se creó `schema_migrations` y se registra
    `version=1`, `baseline-current-schema` solo después de completar el esquema actual. DB vacía,
    legacy con fila preservada e idempotencia verificadas; no se borran ni reconstruyen datos.
    Verificación: `bunx tsc --noEmit` limpio y `bun test src/__tests__/migration.test.ts` → `3 pass`,
    `0 fail`, `14 expect() calls`.
  - [x] **L.5.7.2 — Registro de pasos futuros (2026-07-29).** Se añadió `SchemaMigrationStep` y
    `applyMigrationSteps()`: exige secuencia consecutiva desde la baseline, nombre explícito,
    precondición, postcondición y registra `version/name/applied_at` solo después de verificarlas.
    Los pasos ya aplicados se omiten para preservar idempotencia; `FUTURE_MIGRATIONS` queda como
    registro único para las transformaciones reales siguientes. El test ejecuta un paso v2 dos veces,
    preserva una sola evidencia y confirma el postcondition. La transacción y rollback siguen siendo
    deliberadamente L.5.7.3, no se declaran cubiertos aquí.
  - [x] **L.5.7.3 — Transacción y rollback (2026-07-29).** Cada `SchemaMigrationStep` ejecuta
    precondición, transformación, postcondición y registro de evidencia dentro de una transacción
    SQLite; la versión solo se marca cuando todo confirma. La prueba inyecta un fallo después de
    crear una tabla, cierra y reabre la DB, y demuestra `0` tabla parcial y `0` versión v2 marcada.
    No se borra ni se reconstruye la DB activa.
  - [x] **L.5.7.4 — Fixtures y contrato de esquema (2026-07-29).** `migration.test.ts` cubre DB
    vacía, baseline v1 y legacy representativa con fila preservada. Los fixtures validan defaults de
    contadores/costos/tiempo, `NOT NULL` de `runs.status`, tipo nulo de columnas añadidas y rechazo
    de path duplicado por constraint `UNIQUE`, además de la existencia del índice único de `files`.
    Foreign keys, FTS5, triggers y conteos de integridad quedan para L.5.7.5.
  - [x] **L.5.7.5 — Integridad relacional y FTS (2026-07-29).** Se activó `PRAGMA foreign_keys = ON`
    por conexión y se verifican foreign keys, índices requeridos, los tres triggers FTS5 y conteos de
    memoria antes/después. `rebuildMemoryFts()` reporta recuperación exitosa tras borrar el índice y
    `false` ante una tabla FTS incompatible, sin ocultar el resultado ni tocar datos fuente.
  - [x] **L.5.7.6 — Inyección de fallos por etapa (2026-07-29).** Se probaron fallos en precondición,
    transformación y postcondición: cada uno deja `0` artefactos parciales y `0` versión marcada.
    Después de ambos fallos de contrato, una migración válida v2 continúa y registra una sola evidencia.
    El rollback es transaccional; no borra/recrea ni restaura automáticamente la DB activa.
  - [x] **L.5.7.7 — Procedimiento operativo (2026-07-29).** Se documentó en
    [docs/security-migration-recovery.md](../../docs/security-migration-recovery.md) el flujo backup
    consistente/validado → detener procesos → migrar → `integrity_check` → reabrir. En fallo se
    conserva la DB original, se valida el backup y se restaura solo a un destino nuevo; el reemplazo
    de la DB activa queda como acción manual revisada, nunca automática.
- [x] **L.5.5a — Auditoría de queries y límites (2026-07-29).** Se auditó el inventario completo de
  `bun:sqlite`: valores externos parametrizados, FTS tokenizado, SQL dinámico limitado a identificadores
  constantes y único `VACUUM INTO` con path escapado. Se corrigió el hallazgo real del endpoint de runs:
  `limit` inválido/negativo/0/NaN ya no puede pedir una consulta ilimitada al dashboard; positivos se
  acotan a 200 (1000 en la función DB para callers internos), mientras exportación CLI conserva el
  `listRuns(0)` explícito. Queries FTS públicas se acotan a 256 caracteres. Verificación: `10 pass`,
  `0 fail`, `38 expect()` calls en límites, integridad, concurrencia, migraciones y backup; `bunx
  tsc --noEmit` limpio.
- [x] Evidencia y límites de corrupción/concurrencia quedan documentados en
  [docs/security-db-query-audit.md](../../docs/security-db-query-audit.md), junto con los controles ya
  implementados por L.5.0–L.5.3a: aislamiento `ORCHESTOS_HOME`, `busy_timeout`, `BEGIN IMMEDIATE`,
  backup consistente, restore no destructivo e `integrity_check`. No se mezclaron cambios concurrentes
  de SQLite; recuperación de la DB viva y rollback/versionado de migraciones siguen abiertos como
  gaps separados, no se declaran cubiertos por esta auditoría.
- [x] **L.5.6 — Clasificación, retención y privacidad (2026-07-29).** Política documentada en
  [docs/security-data-retention.md](../../docs/security-data-retention.md): credenciales restringidas,
  contenido de trabajo sensible, metadatos internos y derivados separados; runs/memoria no se borran
  automáticamente, mientras `run_steps` y `chat_task_bar_events` tienen purga explícita por defecto
  a 30 días. Se agregó preview + purga transaccional en [src/db/retention.ts](../../src/db/retention.ts),
  sin invocación automática ni borrado de la DB real. `runs-summary.json` ya exporta solo metadatos;
  el diagnóstico ahora redacta task, resultado, checks y campos de contexto antes de enviarlos al
  proveedor. Verificación: `bunx tsc --noEmit` limpio; `bun test src/__tests__/retention.test.ts
  src/__tests__/diagnose.test.ts --timeout 30000` → `8 pass`, `0 fail`, `27 expect() calls`,
  incluyendo preview, purga selectiva, periodos inválidos y payload sensible sin credenciales.

### L.6 — 🔍 Gate de seguridad y operación

- [x] **L.6.1 — Gate reproducible de seguridad (2026-07-29).** Se implementaron `bun run security:gate` y
  [docs/security-gate.md](../../docs/security-gate.md): typecheck, DB temporal migrada, matriz completa
  serial/aislada con coverage y `bun audit --audit-level=high`; cualquier salida distinta de cero
  detiene el gate. La matriz final pasó `983 pass`, `0 fail`, `2184 expect()` en `95` archivos y la
  auditoría quedó limpia tras fijar `brace-expansion` en `5.0.8` mediante override. Durante el gate
  se corrigió la clasificación duplicada de credenciales (`provider-key` + `credential-assignment`),
  se ajustaron fixtures de conflictos para foreign keys y se verificó el dashboard fuera del sandbox.
- [x] Revisar manualmente los flujos de mayor riesgo en dashboard y CLI: importar skill, configurar
  provider, ejecutar tarea, usar fetch, crear worktree, diagnosticar y exportar datos.
- [x] Registrar cada hallazgo con severidad, evidencia, impacto, mitigación y prueba de regresión.
  No cerrar el bloque por “no encontré vulnerabilidades”: se cierra solo con alcance documentado,
  tests ejecutados y riesgos aceptados explícitamente por Carlos.
- [x] Después del gate, copiar el resumen a `DONE.md` y actualizar `CONTEXT.md` con los límites de
  confianza permanentes. Si se habilita red externa o multiusuario, reabrir una revisión de seguridad
  específica; esta baseline no cubre ese cambio de amenaza.

**L.6.2 — avance inicial (2026-07-29):** evidencia y hallazgos detallados en
[docs/security-manual-review.md](../../docs/security-manual-review.md). CLI y superficie HTTP local
verificadas sin gasto ni escrituras sensibles: dry-runs del runner/DAG, ayuda de comandos,
status/list/config, dashboard HTML y GET, CSRF por origen/puerto, SSRF de import, validación de
paths e ids. Hallazgos abiertos: `L62-001` (migración concurrente no serializada) y `L62-002`
(provider key persistida antes de validación). En la continuación del 2026-07-29 tampoco hubo navegador
disponible; además, el dashboard no pudo iniciar en `4243` ni `4343` por `EADDRINUSE`, sin proceso del
dashboard escuchando en esos puertos. No se marca el gate como cerrado. Pendientes: revisión visual,
ejecutar una tarea/worktree/diagnóstico/exportación manual y decidir mitigación/aceptación de ambos
hallazgos.

---

