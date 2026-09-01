### MES 17 — La capa de confianza: ejecutores externos detrás de la verificación

Origen: IDEAS.md #15, decisión de Carlos (2026-07-02) tras la revisión estratégica que originó el Mes 16 — "la jugada que convierte a OrchestOS de runner casero a capa de confianza". Tesis: el valor diferenciador de OrchestOS es la capa de verificación (contrato + checks + evidencia + QA + diagnose), no el ejecutor propio — un ejecutor externo (Claude Code headless) es una tercera implementación de `ExecutorEngine` (Mes 16 G) que **edita** en vez de reescribir, eliminando por diseño el riesgo de fidelidad que G.5 encontró en el agéntico interno con archivos grandes.

**Tabla de estado de bloques**

| Bloque | Contenido | Estado |
|---|---|---|
| A.1 | Diseño — `docs/external-executor-design.md`, las 4 decisiones (contrato/costo/timeout/archivos fuera de contrato) | ✅ SÍ |
| A.2 | Revisión del diseño con Carlos antes de código | ✅ SÍ |
| B.1 | `executors/external.ts` — spawn en worktree, timeout, diff → `FileChange[]` | ✅ SÍ |
| B.2 | `engine: 'external'` como tercer `TaskEngine` — schema, config, CLI, dashboard | ✅ SÍ |
| B.3 | Tests con mock del subproceso (11 casos) | ✅ SÍ |
| B.4 | Fix EISDIR en directorios untracked (hallazgo de los tests de B.3) | ✅ SÍ |
| C.1 | Superficie: selector + CLI + bloque "Process" en el detalle del run | ✅ SÍ |
| C.2 | Detección honesta si el binario no está instalado (3 puntos, 1 fuente de verdad) | ✅ SÍ |
| D.1 | Gate en vivo con dinero real — encontró y corrigió un bug real de parseo de `git status` | ✅ SÍ |
| H.1 | Cierre formal del mes | ✅ SÍ (este registro) |

**A.1/A.2 — Diseño**
`docs/external-executor-design.md` decidió: (a) contrato al ejecutor externo vía prompt explícito + `--allowedTools` (coarse) — la frontera real de seguridad sigue siendo `enforceContract()` post-hoc, igual que en single-shot/agéntico; (b) costo parseado de `--output-format json` de Claude Code (`usage`, `total_cost_usd`, `num_turns` reales) — sin JSON válido, costo desconocido explícito, nunca `$0` silencioso (F0.8); (c) timeout vía campo opcional `opts.timeoutMs` (aditivo a `ExecutorEngine.run()`, no rompe los otros 2 engines) — garantía de terminación, no tope de gasto; (d) archivos fuera de `output[]` — diff completo del worktree se entrega tal cual a `enforceContract()` sin filtrar, el `finally` existente de `runTask()` ya descarta cualquier worktree vivo, sin lógica de revert nueva. Alcance v1: solo Claude Code headless (`claude -p`), sin adaptador opencode — `engine: 'external'` genérico deja el punto de extensión abierto sin construirlo. Revisado y aprobado por Carlos con una aclaración añadida al doc (§1.1): "external" es la herramienta de agente, no el LLM — un usuario sin Claude Code simplemente no usa ese engine, sigue teniendo single-shot/agéntico con cualquier proveedor configurado.

**Bloque B — Implementación del engine**
`externalEngine` (`src/run/executors/external.ts`) exige modo worktree sin excepción (un proceso no controlado no puede editar el repo real sin sandbox desechable — requisito nuevo que los otros 2 engines no necesitan porque nunca tocan disco antes de que el harness decida). Spawnea `claude -p --output-format json --append-system-prompt <contrato> --allowedTools Edit,Write,Read,Glob,Grep` con timeout wall-clock (`SIGTERM`), lee el diff completo vía `git status --porcelain -uall` tras el proceso, y lo entrega como `FileChange[]` sin filtrar. `engine: 'external'` como tercer valor de `TaskEngine` (schema + config + CLI `--engine` + selector del dashboard + badge morado). B.4 destapó un `EISDIR` real al crashear con directorios untracked en el diff — corregido con `statSync.isFile()` antes del read. 11+2 tests nuevos, todos con worktree real + mock de `Bun.spawn` (mismo patrón de inyección que `agentic-engine.test.ts` con `globalThis.fetch`).

**Bloque C — Superficie**
Selector `external` en el composer de Tasks + `--engine external` en CLI (ambos ya cubiertos por B.2) + bloque "Process" nuevo en el detalle del run (binary + command reconstruido, con el system prompt real reemplazado por el placeholder `<contract>` para no inflar la DB). C.2: detección honesta del binario ausente con una sola fuente de verdad (`findClaudeBinary()`/`claudeUnavailableMessage()`) reusada por el engine guard, la CLI, y el endpoint `GET /api/system/engines/external/availability` — warning inline en el composer con link de instalación, sin fallo críptico en runtime.

**Bloque D — Gate en vivo (dinero real, misma tarea brownfield de G.5)**
Misma tarea que G.5 (agregar 1 línea de JSDoc a `handleApiSkillsList`, `src/dashboard/handlers/skills.ts`, 419 líneas), corrida con dinero real 3 veces contra el ejecutor externo. **Bug real encontrado y corregido** (mismo patrón que G.5 — dinero real destapó infraestructura rota que ningún mock había mostrado): Claude Code editó el archivo exactamente como se pidió en el worktree las dos primeras corridas (confirmado con `git diff` manual), pero `externalEngine` reportaba `files: []` de todos modos → "missing declared output". Causa raíz: el `git()` compartido de `sandbox.ts` hace `.trim()` sobre TODO el stdout de `git status --porcelain`, comiéndose el espacio inicial de la primera línea cuando es una modificación sin stage (`" M path"` → `"M path"`) — el parseo de columna fija de `readWorktreeDiff()` asumía ese espacio, así que `"M src/foo.ts"` quedaba `"rc/foo.ts"` (path inexistente, descartado en silencio). Ningún test de B.3 lo cubría porque todos escribían archivos nuevos (`"?? path"`, sin el espacio literal en juego). Fix: spawn directo sin el trim global para este parseo + test de regresión que modifica un archivo ya trackeado.

**3ra corrida (con el fix) — evidencia de la tesis**: fidelidad del diff perfecta (una sola línea, cero cambios en el resto, confirmado con `tsc --noEmit` manual exit 0); `enforceContract` funciona idéntico sin cambios, autorizando exactamente el path declarado; `checks` explícitos corrieron y pasaron pese a la ausencia de `node_modules` en el worktree (`bunx` resuelve desde la caché global de Bun); costo real $0.15-0.22 por corrida — **25-70× más caro que single-shot** ($0.0032 en G.5) para la misma tarea trivial, esperable por la exploración multi-turno propia de Claude Code. El QA-LLM dio un falso negativo sobre un diff objetivamente correcto — misma fragilidad de juez-LLM ya conocida (D3, Mes 14), no un bug nuevo del externo.

**Hallazgos documentados, no corregidos en este mes** (candidatos de backlog, IDEAS.md):
- #19 — tareas `engine: external` sin `checks:` explícitos pierden silenciosamente su única red determinista (`defaultChecksFor()` devuelve `[]` sin `node_modules`, y external exige worktree sin excepción) — el QA-LLM queda como único filtro, y ya se demostró falible en este mismo gate.

**Decisiones de diseño Mes 17**
- "Externo" es la herramienta de agente, no el LLM — aclaración añadida al diseño tras la revisión de Carlos, evita confundir `engine: external` con un cuarto proveedor de LLM.
- La frontera real de seguridad sigue siendo `enforceContract()` post-hoc para los 3 engines por igual — el prompt/`--allowedTools` del externo es mejor esfuerzo, no el control.
- Un gate 🔍 con dinero real volvió a encontrar un bug de infraestructura real que ningún test con mocks había mostrado (mismo patrón que G.5, Mes 14 D2/D3, Mes 13 Bloque A — ver [[feedback-verificar-gates-en-vivo]]) — el parseo de `git status --porcelain` corrompido por un `.trim()` compartido demasiado agresivo.

**Métrica Mes 17 — SÍ (2026-07-05)**
Tercer `ExecutorEngine` (externo, Claude Code headless) diseñado, implementado, expuesto en dashboard+CLI, y verificado en vivo con dinero real contra la misma tarea brownfield que motivó el mes anterior. La capa de verificación (`enforceContract`/checks/QA) funciona idéntica sin cambios sobre un motor que OrchestOS no controla — confirma la tesis. El gate en vivo encontró y corrigió un bug real de parseo antes de cerrar. 617 tests · 0 fail · `tsc --noEmit` limpio.

---

