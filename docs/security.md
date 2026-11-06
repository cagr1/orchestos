# OrchestOS — Política de seguridad vigente

Baseline local, usuario único (bloque L, 2026-07-29; verificado contra el código 2026-10-14).
Revisiones históricas y modelo de amenazas: `docs/done/security/`.

## Gate

    bun run security:gate

Falla en el primer código no cero. Corre, en orden: typecheck; `db:migrate` en un `ORCHESTOS_HOME`
temporal (no toca `~/.orchestos/db.sqlite`); la batería completa de Bun, serial y aislada, con
cobertura en `coverage/security-gate`; `bun audit --audit-level=high`. El temporal se borra en
`finally`. La auditoría de dependencias no tiene fallback offline: un servicio caído es un fallo,
no evidencia de que las dependencias estén sanas. Implementación: `scripts/security-gate.ts`.

## Fetch y contenido no confiable (SSRF)

- Los fetch iniciados por contenido externo aceptan solo `http:`/`https:`, puertos 80/443 y sin
  usuario/contraseña. Se bloquean loopback, unspecified, RFC1918, link-local/metadata, IPv6 ULA,
  IPv6 link-local, multicast e IPv4-mapped en IPv6. El hostname se resuelve con el resolver del
  sistema y cualquier dirección privada bloquea la petición (`src/dashboard/ssrf.ts`).
- Chat `fetch_url` (`src/dashboard/handlers/chat.ts`): `redirect: 'error'`, timeout 10 s, solo
  text/markdown/JSON, lectura incremental con tope de 256 KB. Import remoto de skills
  (`src/dashboard/handlers/skills.ts`): misma política, timeout 15 s, tope 256 KB.
- Se resuelve DNS una segunda vez tras la respuesta; si pasó de público a privado, el resultado se
  descarta. Reduce la ventana de DNS rebinding pero no es pinning de socket: el `fetch` de Bun no
  expone resolución fijada. Esa garantía exigiría un cliente HTTP propio; no se simula.
- Web, OCR, adjuntos, `read_file` y resultados de búsqueda de memoria se envuelven en
  `<untrusted-data source="...">` (`src/security/untrusted-content.ts`). El system prompt los declara
  dato, nunca instrucción. Es defensa de prompt, no frontera criptográfica.
- Tests: `src/__tests__/ssrf.test.ts`, `chat-fetch-url.test.ts`, `chat-read-project-tools.test.ts`.

## Filesystem y subprocesos

| Operación | Aceptado | Rechazado |
|---|---|---|
| `read_file` / `list_dir` | Relativo, dentro del root real | Absoluto, `..`, traversal URL-encoded, symlink hacia fuera |
| `enforceContract` | Output declarado, archivo regular, cadena de padres dentro del root | No declarado, symlink de escritura, archivo especial, escape |
| `run_check.cwd` | `.` o directorio existente dentro del root | `../`, absoluto fuera, archivo, symlink que escapa |
| diff de worktree | Archivos regulares que Git reporta dentro del worktree | Path no resoluble dentro del worktree |
| worktree | Repo Git con branch y root válidos | Root inexistente/no Git, branch inválida, estado sucio |

- `src/run/path-policy.ts` normaliza, decodifica hasta 3 capas de encoding, rechaza traversal léxico
  y verifica `realpath` del segmento existente. En escritura rechaza cruzar symlinks, aunque apunten
  dentro del proyecto (evita cambiar el destino entre validación y escritura).
- Los comandos van a `Bun.spawn` como arrays, sin interpolación de shell. El entorno se filtra con
  `safeChildEnv()`: `PATH`, locale/temp, CI, `ORCHESTOS_*` y credenciales explícitas de proveedores.
  stdout/stderr de checks se limita antes de persistir; todos los runners tienen timeout y señal.
- Fuera de modelo: un proceso local ya comprometido con el mismo UID. Test: `path-policy.test.ts`.

## Datos y retención

| Datos | Clasificación | Regla |
|---|---|---|
| Credenciales (API keys, tokens, private keys) | Restringido | Nunca persistir sin redacción; no exportar |
| Contenido de trabajo (prompts, resultados, errores, diffs, checks, memoria) | Sensible | Local; redacción antes de enviar a un proveedor |
| Código/contexto (`agents_md`, `CONTEXT.md`, chunks, OCR) | Sensible | No exportar por defecto |
| Metadatos operativos (modelo, tokens, costo, estado, ids) | Interno | Pueden ir en summaries |
| Índices derivados (hashes, edges, embeddings, FTS) | Interno/sensible | Se borran con el proyecto; un embedding no es anónimo |
| Configuración (perfil, rutas, comandos) | Interno | Revisar rutas en exports |

- `projects`, `files`, `code_edges`, `context_chunks`, `memory_entries`, `runs`, `instincts`:
  retención indefinida; borrado explícito por id o acción del usuario (los instincts no verificados
  siguen sujetos al reset de datos de prueba).
- `run_steps` y `chat_task_bar_events`: efímeros; purga manual tras 30 días
  (`src/db/retention.ts`). Toda purga ofrece preview, devuelve conteos por tabla y es transaccional.
- `runs-summary.json` no incluye prompt, resultado crudo, checks completos, diffs ni memoria.
- El diagnóstico LLM pasa por `redactSensitive()`; un proveedor externo nunca recibe una API key de
  un run antiguo.
- Backups: copia sensible completa, `0600`, fuera de Git, sin envío automático ni purga automática.

## Migración y recuperación de SQLite (`~/.orchestos/db.sqlite`)

Procedimiento manual; la migración nunca reemplaza la base viva con un backup. Ensayar con un
`ORCHESTOS_HOME` aislado. Funciones en `src/db/backup.ts`.

1. Backup consistente (`VACUUM INTO`, sin copiar el WAL a mano):
   `bun -e 'import { createDatabaseBackup } from "./src/db/backup.ts"; console.log(createDatabaseBackup("/tmp/orchestos-db-pre-migration.sqlite"))'`
2. Validarlo antes de parar la app:
   `bun -e 'import { verifyDatabaseBackup } from "./src/db/backup.ts"; const r = verifyDatabaseBackup("/tmp/orchestos-db-pre-migration.sqlite"); console.log(r); if (!r.ok) process.exit(1)'`
3. Parar OrchestOS (dashboard y CLI que usen el mismo directorio).
4. `bun run db:migrate` (idempotente).
5. `PRAGMA integrity_check` sobre la base viva en solo lectura; debe devolver `ok`.
6. Reabrir y revisar el arranque; conservar el backup hasta ejercitar la migración.

Si falla: conservar la base original y la salida; no borrar ni restaurar encima. Revalidar el backup
y restaurarlo a un archivo nuevo (`restoreDatabaseBackup(backup, destino)` rechaza backups corruptos
y destinos existentes); correr `integrity_check` sobre el destino. Reemplazar la base viva es una
acción de mantenimiento revisada aparte, fuera de `runMigrations()` y nunca automática. Antes de un
borrado masivo, crear un backup validado.
