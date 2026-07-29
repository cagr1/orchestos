# L6.2 — Revisión manual de seguridad y operación

Fecha: 2026-07-29  
Alcance: dashboard local y CLI, usando `ORCHESTOS_HOME` temporal cuando la operación podía tocar SQLite.

## Evidencia ejecutada

### CLI

- Las ayudas de `orchestos`, `skill`, `config`, `setup`, `task`, `task run`, `task diagnose` y
  `runs` salieron con código 0.
- `orchestos run --dry-run ...` salió con código 0, mostró modelo/contrato de archivos y no llamó
  al proveedor.
- `orchestos run --graph --dry-run --project test-project` salió con código 0 y mostró DAG,
  circuit breakers y límite de iteraciones sin ejecutar tareas.
- `config show`, `task list` y `task status` salieron con código 0; la tarea quedó `pending` y el
  costo `$0.00000`.

### Dashboard/API local

La sesión no expuso un navegador controlable, por lo que la revisión visual queda pendiente. Se
ejercitó la superficie HTTP que consume la UI mediante `route()` y `Request`:

- `GET /`, `/api/health`, `/api/tasks`, `/api/skills`, `/api/settings` y `/api/setup`: `200`.
  `/api/settings` devolvió la key enmascarada (`sk-or-••••9679`), nunca su valor completo.
- `POST /api/tasks/init` con origen en otro puerto o remoto: `403`. Con el mismo origen: `409`
  porque `tasks.yaml` ya existe; no se sobreescribió.
- Importar skill desde `http://127.0.0.1/...`: `400`, bloqueado por SSRF.
- Crear skill con id `../../escape`: `400`; provider sin key: `400`; explorer con
  `../../etc/passwd`: `400`.

## Hallazgos

### L62-001 — Migración concurrente no serializada

- Severidad: media (disponibilidad local; no es exfiltración).
- Evidencia: dos procesos CLI arrancados simultáneamente con el mismo `ORCHESTOS_HOME` hicieron
  que uno fallara con `SQLiteError: duplicate column name: context_source` en `safeAddColumn()`.
- Impacto: dos procesos iniciados a la vez pueden dejar uno sin arrancar.
- Mitigación actual: no ejecutar dos boots concurrentes contra una DB nueva/legacy.
- Regresión requerida: lock de migración o `ALTER TABLE` idempotente bajo lock SQLite; fuera del
  alcance de L6.2, abrir ítem separado antes de corregirlo.

### L62-002 — Provider key persistida antes de validación

- Severidad: media (persistencia inesperada de secreto/estado inválido).
- Evidencia: `handleApiSetupApiKey()` escribe en `~/.orchestos/.env` antes del `fetch` de validación;
  solo revierte HTTP 401. Timeout, error de red u otra respuesta dejan la key persistida.
- Impacto: una key ingresada para una prueba fallida puede quedar almacenada en texto plano aunque
  el usuario no haya confirmado una configuración válida.
- Mitigación actual: la respuesta y logs no imprimen la key; el archivo está fuera del repo.
- Regresión requerida: validar antes de persistir o escribir con rollback para todo resultado no
  válido; fuera del alcance de L6.2.

## Límites y pendientes

- El dashboard sigue siendo localhost, usuario único y sin auth multiusuario; L2 documenta esa
  decisión. No se probó una tarea real con dinero, worktree real ni exportación real: se usaron
  dry-runs y endpoints de validación.
- Falta la revisión visual/interactiva en navegador y los flujos manuales de ejecutar tarea, crear
  worktree, diagnosticar y exportar. L6.2 permanece abierto hasta completarlos y hasta que Carlos
  decida la mitigación/aceptación de `L62-001` y `L62-002`.
