### MES 18 — Chat como entrada única: detección de intención de tarea

Origen: IDEAS.md #12, decisión de Carlos (2026-07-02) tras el cierre de Mes 17 — que el chat sea el medio de comunicación principal de OrchestOS (como Open WebUI/Hermes/Claude Desktop), con Tasks pasando a ser un visor y no el lugar donde se crea el trabajo. Pregunta que lo disparó: si el usuario describe trabajo ejecutable sin decir "tarea", ¿el sistema lo detecta y ofrece convertirlo?

| Bloque | Contenido | Estado |
|---|---|---|
| A | Diseño de guardrails (`docs/chat-task-detection-design.md`) + revisión con Carlos | ✅ SÍ |
| B.2/B.2.1 | Tools de lectura `read_plan`/`read_tasks`/`read_ideas` + fix de clamp de output tokens | ✅ SÍ |
| B.1.a/B.1.b-ui | Instrumentación de `chat-create-task-bar` (`chat_task_bar_events`) + tab "Chat evidence" | ✅ SÍ |
| B.1.b / C.1 | Clasificador semántico de intención de tarea, activado con evidencia real | ✅ SÍ (Bloque J) |
| D | Auto-selección semántica de skill (ex-IDEAS #21) | ✅ SÍ |
| E | Paridad CLI↔Dashboard, 9 gaps cerrados (ex-IDEAS #9b) | ✅ SÍ |
| F | Fechas en hora local en vez de UTC crudo | ✅ SÍ |
| G | Auditoría visual `/impeccable audit` (ex-IDEAS #23) | ✅ SÍ |
| I | "Premium dashboard" — 13 ajustes reportados por Carlos | ✅ SÍ |
| J | Dogfooding real del Chat — activa B.1.b + 2 bugs reales | ✅ SÍ |
| H.1 | Cierre formal del mes | ✅ SÍ (este registro) |

**Bloque A/B/C — Detección de intención de tarea**
Diseño (A.1, aprobado por Carlos "GO" 2026-07-05) fijó el orden: primero instrumentar la barra existente para generar evidencia real, el LLM clasificador solo se implementa si aparecen falsos negativos concretos — nunca "porque se puede". Tools de solo lectura `read_plan`/`read_tasks`/`read_ideas` registradas en `runToolLoop()` (mismo patrón que `FETCH_URL_TOOL`), verificadas en vivo con `claude-haiku-4-5` citando contenido real de PLAN.md. Bug real encontrado al verificar (B.2.1): `handleApiChat` calculaba `chatMaxTokens` sin clamp al tope real de salida del proveedor — mismo bug que el harness ya había corregido en G.5 (Mes 17), corregido con `Math.min(available, maxOutputTokensFor(model))`. Instrumentación (B.1.a): tabla `chat_task_bar_events` + tab de solo lectura "Chat evidence" en Project para que Carlos revise la evidencia sin depender de un query de Claude. El clasificador (B.1.b) quedó **en espera de evidencia real** (criterio: ~30-40 mensajes reales con variedad, sin fecha fija) hasta que el dogfooding del Bloque J la produjo.

**Bloque D — Auto-selección semántica de skill**
Origen: prueba real de Carlos con una landing usando "skills de diseño" no dio el resultado esperado — ninguna skill se auto-aplicaba (`skill-route.ts` solo leía `task.skill` explícito). Se escribieron 4 skills de diseño nativas (`frontend-design`, `ux-guidelines`, `design-brief-inference`, `design-tokens`) y un motor de clasificación (`listAllSkillCandidates()`) que agrega candidatos al mismo call de `/api/natural` que ya generaba el draft (sin call adicional). Selector en el composer: 1 candidato preseleccionado, 2+ con "None" preseleccionada, 0 sin campo. Gate en vivo: draft de landing → 4 candidatos de diseño; draft de bugfix de auth → sugirió `diagnose`/`bug-hypothesis`/`code-review` (skills de ingeniería que ya existían y nunca se auto-aplicaban) — confirma que el motor discrimina por dominio real, no un sí/no de diseño.

**Bloque E — Paridad CLI↔Dashboard**
Barrido formal de los ~45 subcomandos de `cli.ts` contra `server.ts` encontró 9 gaps reales sin superficie en el dashboard (specs lifecycle, instinct confidence/propose, task explain/clarify, detect/index, config init/show, context suggest, memory conflicts, runs --analyze). Los 9 se cerraron: `memory conflicts` (panel con banner de conteo), `runs --analyze` (botón inline sin `alert()`), `spec approve/lint/archive/create` (botones en detail row), `instinct set-confidence/propose/add` (slider + botón, + fix de bug real de 146 proposals duplicados por race condition, UNIQUE INDEX agregado), `task run --explain/--clarify` (SidePanel con textarea + resultado inline; todos los `alert()`/`prompt()` del dashboard reemplazados por `showToast()`/`Modal`), `detect`/`index` (botones con `confirm()` tras hallazgo real de sobreescritura accidental de `AGENTS.md`), `config init/show` + edición de roles (2 bugs reales corregidos: `<select>` sin proteger contra el poll de 30s, y fallback forzado a un modelo no elegido por el usuario en el campo QA opcional), `context suggest` (chips clicables, embeddings con fallback a keyword-matching).

**Bloque F — Fechas en hora local**
6 lugares mostraban el string UTC crudo de SQLite sin convertir. Helper único `formatLocalDate()` (`data.js`) usando `toLocaleString()`/`toLocaleDateString()` del navegador, reemplazando los 6 `.slice()` — no toca cómo se guarda la fecha en DB, solo la presentación.

**Bloque G — Auditoría visual `/impeccable audit`**
Health Score 12/20 (Aceptable). 2 P1 reales (overflow horizontal en mobile por falta de `min-width:0` en items de grid; filas de tabla sin foco de teclado completo), 2 P2 (side-stripe de acento en 4 componentes, reemplazado por fondo tintado; colores hardcodeados fuera de tokens), 1 P3 (`prefers-reduced-motion` — falso positivo, ya cubierto por una regla catch-all existente).

**Bloque I — "Premium dashboard"**
Carlos pidió el estándar Hermes/Claude Desktop/Codex tras el Bloque G. 13 ajustes verificados en vivo, todos con causa raíz real en vez de parches cosméticos: eliminación de filas redundantes en Settings (I.1), fix de recorte del combo QA por `overflow:hidden` heredado + grid de 2 columnas para roles (I.2), auditoría de líneas divisorias decorativas vs. funcionales (I.3), padding en card de zona destructiva (I.4), wiring completo de `resolveConflict()` que existía sin usar (I.5), hallazgo de que las ~20 "memorias" que Carlos veía eran 100% fixtures de tests filtrándose a la DB real por falta de `afterAll` en 2 archivos — no un bug del motor de memoria (I.6, recurrencia del patrón de IDEAS #20), botón deshabilitado con mensaje "Nothing to run" cuando no hay tareas pendientes en Graph Runner (I.7), DELETE agregado a Runs/Memory/Specs/Instincts con la restricción de seguridad propia de cada uno (I.8), i18n completo de la pantalla Specs (I.9), selector de 3 temas (OrchestOS/Dark 2026/Bright) vía `theme.js` + tokens extraídos de VS Code, sin `<select>` nativo (I.11), 2 bugs reales del tema Bright (sombra vertical fantasma por falta de `min-height:0` en `.main`; íconos de sidebar ilegibles en hover por color de texto fijo) (I.12), y un 3er bug de la misma familia encontrado sin que Carlos lo reportara aún: el `box-shadow` del side-panel se filtraba fuera de pantalla incluso cerrado porque vivía en la regla base y no en `.open` (I.13). Gate consolidado (I.10) verificado en vivo contra el dashboard real: Settings/Model routing/tema Bright/fechas/mobile 375px sin overflow, sin regresiones.

**Bloque J — Dogfooding real del Chat**
Carlos usando el Chat real para pedir trabajo real (landing de cripto, tienda de ropa) confirmó en vivo el falso negativo exacto que B.1.b pedía como evidencia — 34 mensajes reales acumulados desde 2026-07-05, decisión explícita de Carlos de activar el clasificador ya (J.1): `classifyTaskIntent()` llama al mismo modelo barato default con un prompt binario, fail-safe a `isTask:false`; la barra aparece de inmediato citando el `reason`, sin auto-run. De la misma sesión, 2 bugs reales adicionales: imágenes al chat sin gating de visión — corregido con `supportsVision` en `ModelInfo` y rechazo 422 con mensaje claro antes de mandar el `image_url` block (J.2); el guard de presupuesto de contexto existía en `harness.ts` pero no en el chat — corregido con `CHAT_MIN_OUTPUT_BUDGET` (J.3). Gate en vivo con dinero real (J.4) confirmó los 3 fixes contra el servidor real.

**Decisiones de diseño Mes 18**
- Nunca auto-run silencioso — el chat sugiere y pre-llena, el usuario siempre confirma antes de gastar dinero real en un executor.
- El clasificador semántico no se implementa "porque se puede" — se gatea en evidencia real de falsos negativos (mismo principio que ya rigió instincts/patterns en meses anteriores).
- Un hallazgo de "datos sin sentido" en el dashboard (I.6) volvió a ser fixtures de test filtrándose a la DB real — segunda vez que aparece este patrón (IDEAS #20 lo había "resuelto" una vez) — sospechar de esto primero ante cualquier hallazgo similar futuro.
- El estándar de "premium" no es solo funcional — 4 de los 13 ajustes de Bloque I fueron bugs de contraste/sombra que solo aparecen en un tema no probado antes (Bright), no regresiones de los 3 temas existentes.

**Hallazgos documentados, no resueltos en este mes (backlog)**
- IDEAS.md #19 — tareas `engine: external` sin `checks:` explícitos pierden su única red determinista (heredado de Mes 17, sigue sin corregir).
- `upsertMemory()`/`persistSubTaskMemory()` (sub-tasks con memoria) nunca se disparó para el proyecto real OrchestOS — o el flujo nunca corrió en producción, o la vía está efectivamente muerta en la práctica (hallazgo de I.6, fuera de alcance del audit "premium dashboard").
- IDEAS.md #13/#24 — OCR para imágenes del chat (elimina la dependencia de que el modelo elegido tenga visión, complementa el gating de J.2) y adjuntar varios archivos a la vez — evaluados como candidatos para el próximo Mes, repo de referencia (`baidu/Unlimited-OCR`) aún sin leer.

**Métrica Mes 18 — SÍ (2026-07-09)**
El chat detecta intención de tarea con evidencia real (34 mensajes reales, falso negativo confirmado y corregido), paridad CLI↔Dashboard cerrada (9/9 gaps), auditoría visual + "premium dashboard" resueltos con causa raíz en cada uno (nunca parches cosméticos), y el dogfooding real de Carlos encontró y corrigió 2 bugs reales de producción (visión sin gating, guard de contexto no conectado al chat) antes de que afectaran a un uso real. 649 tests · 0 fail · `tsc --noEmit` limpio.

---

