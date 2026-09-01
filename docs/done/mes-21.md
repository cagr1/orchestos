### MES 21 / v0.12 — Producto estable: cerrar papercuts, higiene y paridad antes de features grandes

Origen: eje decidido por Carlos (2026-07-13). Con el motor probado end-to-end (Mes 20/C.1), el norte cambió de "¿puede el motor?" a "¿se siente terminado y confiable?". Regla dura del milestone: cero features nuevas en el motor — solo pulir lo que ya existe.

| Bloque | Contenido | Estado |
|---|---|---|
| A | Borrado masivo en las 5 tablas del dashboard + 9 `confirm()`/`alert()` nativos eliminados (absorbe IDEAS #18) | ✅ SÍ |
| B | Chat renderiza Markdown (`marked` + sanitizador propio) + chips de task/modelo clicables | ✅ SÍ |
| C | Visor de diff por run (contenido, no `git diff` post-hoc) | ✅ SÍ |
| D | Auditoría real de paridad CLI↔dashboard + 3 gaps no-dev cerrados (`task init`, `constitution init`, `summary` PDF) | ✅ SÍ |
| E | Papercuts del aside derecho, 2 rondas + 4 reglas de diseño fijas para toda pantalla nueva | ✅ SÍ |
| F.1 | Cierre formal del milestone (este registro) | ✅ SÍ (2026-07-14) |

**Bloque A — Borrado masivo**
Componente reusable (`state.bulkSelected`, `wireBulkSelect()`, `renderBulkBar()`, `Modal.confirm()`) sobre `POST /api/<recurso>/bulk-delete` en las 5 tablas (runs/tasks/instincts/memory/specs). De paso, cerrado IDEAS #18 completo: los 9 `confirm()`/`alert()` nativos que quedaban en `public/` reemplazados por modales propios — cero diálogos nativos en el dashboard, verificado por grep. Verificado en vivo contra el dashboard real (borrado de tarea confirmado en disco, no solo en memoria).

**Bloque B — Markdown en el Chat**
`marked` v18.0.6 (MIT, UMD, sin build step) + sanitizador DOM propio inline (allow-list de tags, strip de `on*`/`javascript:`). Solo mensajes del asistente — el usuario sigue en texto plano. Chips clicables de `task_id` y modelo dentro de la respuesta (índice construido desde `state.tasks`/catálogo de modelos, longest-first, sin superficie de inyección — `data-*` vienen del state controlado, no del LLM). Hallazgo fuera de scope corregido en el camino (B.3): `state.chatDraft` sobrevive un re-render forzado (mismo patrón que `composeDraft`, Mes 20/C).

**Bloque C — Visor de diff por run**
Diseño decidido: diff calculado por CONTENIDO (`beforeContent`+`contractResult.written` que el harness ya captura), no por `git diff` post-hoc — el worktree se destruye siempre al terminar un run del dashboard. Librería `diff` (jsdiff, MIT). `computeFileDiffs()` en `qa.ts`, columna `file_diffs` persistida, `parseUnifiedDiff()` en frontend con colapso a 15 líneas (nunca trunca datos). Verificado en vivo con una tarea disposable corrida de punta a punta vía CLI real, no seed manual.

**Bloque D — Paridad CLI↔dashboard**
Auditoría real (no asumida) de ~40 subcomandos de `cli.ts` contra `server.ts`/`public/*.js`, verificando invocación real (`fetch()`), no solo existencia de endpoint. Refutó parte de la hipótesis original del bloque: `context compress`/`detect`/`index`/`spec draft` sí tienen paridad real (el dashboard invoca al propio CLI vía `Bun.spawn`). 3 gaps reales cerrados: `task init` (scaffold de `tasks.yaml` extraído a `src/tasks/init.ts`, reusado por CLI y endpoint nuevo `POST /api/tasks/init`), `constitution init` (el editor arranca con el scaffold real en vez de vacío, banner de preview), `summary` PDF (`GET /api/project/summary`, mismo flujo que el CLI). CLI-only intencional documentado sin implementar: `context list` (multi-proyecto), `skill scaffold`/`skill languages`, `runs --export`, `setup`, `run --dry-run`, `context update`, `instinct add` manual. Cierre verificado independientemente ([[feedback-verificar-progreso-delegado]]): código real confirmado en disco, 711 tests · 0 fail.

**Bloque E — Papercuts del aside derecho**
2 rondas sobre feedback puntual de Carlos. Ronda 1 atacó 6 síntomas pero 2 fixes tocaron el síntoma equivocado; ronda 2 (disparada por screenshot real) encontró la causa raíz de cada uno. Nacen 4 reglas de diseño fijas para toda pantalla nueva del dashboard: (1) un elemento fijo dentro de un contenedor que cambia de ancho se ancla al borde que NO se mueve (`margin-left:auto`, nunca orden-en-el-DOM); (2) las filas "toprow" comparten altura exacta y cero padding vertical propio, ni en la fila ni en overrides de estado; (3) un tooltip nunca vive dentro de un contenedor con `overflow:hidden` si su apertura puede escapar esos límites; (4) un riel colapsado que muestra contenido distinto al hover usa swap CSS puro (`display:none`+`:hover`), nunca JS. Verificado en vivo con `getBoundingClientRect()` real y hover por `ref` (no coordenada cruda).

**Decisiones de diseño v0.12**
- Cero features nuevas en el motor durante todo el milestone — disciplina explícita para que el producto "se sienta terminado" antes de seguir agregando capacidad.
- Un `[x]` de una corrida delegada no es evidencia por sí solo — Bloque D verificado independientemente contra código y tests reales antes de darlo por cerrado ([[feedback-verificar-progreso-delegado]]).

**Hallazgos documentados, no resueltos en este milestone (backlog)**
- IDEAS.md #40 — editor de Constitution sigue con auto-save silencioso por tecla (el scaffold de D.1.b resolvió el *contenido* inicial, no el auto-save en sí); Carlos pidió además revisar cuáles tabs del panel Project vale la pena conservar antes de invertir más ahí.
- Mes 20/C.2 sigue pausado (dashboard premium multi-archivo) — candidato de pre-flight del próximo milestone.

**Métrica v0.12 — SÍ (2026-07-14)**
Higiene de datos (borrado masivo, cero diálogos nativos), Markdown+chips en el Chat, visor de diff por run, y paridad CLI↔dashboard auditada con 3 gaps no-dev reales cerrados y verificados independientemente. Cero features nuevas en el motor, disciplina del milestone respetada de punta a punta. 711 tests · 0 fail · `tsc --noEmit` limpio. Primer tag formal del proyecto: `v0.12`.

