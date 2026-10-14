# L6.2 — Revisión manual de seguridad y operación

Fecha: 2026-07-29  
Alcance: dashboard local y CLI, usando `ORCHESTOS_HOME` temporal cuando la operación podía tocar SQLite.

## Continuación de la revisión

- Se intentó repetir la revisión visual en esta sesión (2026-07-29), pero no hay navegador integrado
  ni extensión de Chrome disponible en el entorno.
- También se intentó iniciar el dashboard en los puertos `4243` y `4343` con dos `ORCHESTOS_HOME`
  temporales; Bun devolvió `EADDRINUSE` en ambos casos y no fue posible abrir la superficie HTTP real
  desde un navegador. No se mató ningún proceso existente ni se alteró la configuración del usuario.
- Por lo tanto, siguen sin estar verificados visualmente los flujos de ejecutar tarea, crear worktree,
  diagnosticar y exportar. El gate permanece abierto; esta limitación no se cuenta como aprobación.

## Cierre del gate (2026-08-02)

El bloqueo de arriba era del **entorno de aquella sesión**, no del producto. En esta sesión el
dashboard levantó sin problema (`PORT=4311`) y sí hubo navegador controlable (Playwright MCP).

### Revisión visual en navegador real — hecha

Dashboard servido y recorrido en Chromium real, no con `route()`/`Request` simulados:

- **Home = Chat**, sin auto-redirect a Settings — respeta [[feedback-home-siempre-chat]].
- **Project**: pestañas Agent guide / Compressed context / Chat evidence; botón "Download PDF summary".
- **Runs**: 45 runs (41 done / 4 failed), filtros por estado, detalle expandible inline con bloques
  ENGINE (`external (claude-code)`) y PROCESS.
- **Graph Runner**: DAG real de `tasks.yaml` con estados `done`/`pending` por tarea.
- **Advanced mode**: alterna correctamente y revela la navegación completa.
- Sin errores de consola ni fallos de render en el recorrido.

### Flujos pendientes — resueltos

| Flujo | Verificación | Resultado |
|---|---|---|
| **Exportar** | `GET /api/project/summary` en vivo | HTTP 200, PDF válido de 2 páginas (3.545 bytes); `strings` sobre el PDF **no** encuentra `sk-or-*`, `sk-ant-*` ni nombres de variables de API key |
| **Diagnosticar** | Propiedad de seguridad (redacción, añadida 2026-07-30) vía test `diagnose.test.ts` | *"redacts sensitive task and run data before the provider call"* — 6/6 pasan. Más riguroso que una llamada en vivo: prueba el prompt exacto que sale hacia el proveedor |
| **Ejecutar tarea / worktree** | Decisión de Carlos (2026-08-02): cerrar con la cobertura existente en vez de gastar dinero real | `contract.test.ts` (18), `sandbox-policy.test.ts` (8 + mutation testing 2026-07-28), `path-policy.test.ts` (5), `git-lock.test.ts` (4, mutex de worktree entre procesos), más los tests de engine externo/codex/opencode. Las propiedades de **seguridad** (contrato de archivos, política de rutas, aislamiento) están cubiertas; falta solo confirmación end-to-end con dinero, que no es una propiedad de seguridad nueva |

### Verificación extra de exfiltración (no estaba en el alcance original)

`GET /api/runs?limit=50` sobre 45 runs reales: **sin filtración**. No aparecen `sk-or-v1-*`,
`sk-ant-*`, `Bearer <token>` ni `*_API_KEY=`. El listado además no expone `prompt` ni `result`
crudos — los campos servidos son solo metadata (`model`, `provider`, `costUsd`, `qaVerdict`,
`skillId`, tokens, `fileDiffs`, `contextWarnings`).

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

**DECISIÓN (Carlos, 2026-08-02): ACEPTADO — riesgo asumido, no se corrige.**
Motivo: es local, un solo usuario, no hay exfiltración, y la mitigación actual (no arrancar dos
boots simultáneos contra la misma DB) es realista en el uso real. Queda documentado como
**limitación conocida**, no como deuda pendiente.
Si alguna vez se decide corregirlo, el patrón ya existe en el repo y no hay que diseñarlo:
`src/run/git-lock.ts` es un mutex de archivo entre procesos que resuelve exactamente esta forma de
problema para los worktrees (ver [[reference-git-lock-worktree-pattern]]). No abrir ítem por ahora
— aceptado explícitamente.

### L62-002 — Provider key persistida antes de validación

- Severidad: media (persistencia inesperada de secreto/estado inválido).
- Evidencia: `handleApiSetupApiKey()` escribe en `~/.orchestos/.env` antes del `fetch` de validación;
  solo revierte HTTP 401. Timeout, error de red u otra respuesta dejan la key persistida.
- Impacto: una key ingresada para una prueba fallida puede quedar almacenada en texto plano aunque
  el usuario no haya confirmado una configuración válida.
- Mitigación actual: la respuesta y logs no imprimen la key; el archivo está fuera del repo.
- Regresión requerida: validar antes de persistir o escribir con rollback para todo resultado no
  válido; fuera del alcance de L6.2.

**DECISIÓN (Carlos, 2026-08-02): MITIGADO — corregido en el mismo turno.**
Motivo: el cambio es acotado y se trata de un secreto en texto plano, la categoría donde menos
conviene aceptar riesgo.

Fix aplicado en [src/dashboard/handlers/setup.ts](../src/dashboard/handlers/setup.ts): se invirtió
el orden — **primero validar, persistir solo en el camino válido**. La key ya no toca el disco a
menos que el proveedor la acepte (`res.ok` o `400`). La validación no dependía del `.env`
(`cfg.headers(key)` usa el parámetro directo), así que invertir el orden no rompe nada. Se eliminó
el rollback parcial del 401, que ahora es innecesario: ningún camino de fallo escribe.

**Hallazgo colateral, corregido también:** `src/dashboard/settings-store.ts` era el **único** módulo
del proyecto que no honraba `ORCHESTOS_HOME` — apuntaba siempre al `~/.orchestos/.env` REAL, lo que
hacía imposible testear el camino de escritura sin arriesgar las keys de verdad del usuario
([[reference-test-fixtures-leak-into-real-db]], patrón ya recurrente en este repo). Alineado con la
convención que ya usan `db/sqlite.ts`, `router/model-catalog.ts` y `router/opencode-catalog.ts`, y
resolviendo la ruta **por llamada** (no capturada en un `const` de módulo) por el gotcha ya
documentado en `model-catalog.ts:96-99`. `ENV_FILE` (const) pasó a ser `envFilePath()` (función).

Regresión cubierta: [src/dashboard/__tests__/setup-api-key.test.ts](../src/dashboard/__tests__/setup-api-key.test.ts),
6 tests contra un `ORCHESTOS_HOME` temporal — key válida sí persiste; timeout/error de red, 401 y
**500** no persisten (500 es el caso que el fix agrega, antes quedaba guardada); y un fallo no
corrompe la key ya guardada de otro proveedor. Verificado además que el `.env` real del usuario
quedó byte-idéntico tras correr la suite completa.

## Límites y pendientes

- El dashboard sigue siendo localhost, usuario único y sin auth multiusuario; L2 documenta esa
  decisión. ~~No se probó una tarea real con dinero, worktree real ni exportación real~~ —
  **actualizado 2026-08-02**: la exportación sí se probó real (PDF generado y auditado); ejecución
  con dinero real sigue sin probarse, por decisión explícita de Carlos (ver tabla de cierre arriba).
- ~~Falta la revisión visual/interactiva en navegador...~~ — **completado 2026-08-02**, ver
  "Cierre del gate".

## Estado final

**L6.2 CERRADO (2026-08-02).** Revisión visual en navegador real completada; exportar y diagnosticar
verificados; ejecutar/worktree cerrados con la cobertura de tests existente por decisión de Carlos.
`L62-001` **aceptado** (limitación conocida documentada), `L62-002` **mitigado** (corregido con
regresión). Suite al cierre: 1066 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage`
(comando exacto de CI) verde.

Limitación que se mantiene y **no** cuenta como aprobada: no se ejecutó una tarea real con dinero ni
se creó un worktree real en esta revisión. Si alguna vez se quiere cerrar esa zona gris, es una
corrida de unos centavos con `deepseek-v4-flash` sobre una tarea desechable.
