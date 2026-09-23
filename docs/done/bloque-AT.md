# Bloque AT — Aterrizar: que se pueda correr

<a id="bloque-at-at-9-1"></a>
### AT.9.1 — Reponer el lint global tras AT.7

  Sin delegación: sin spec; Carlos pidió en conversación mandar a Luna (codex exec) el diagnóstico y el fix mecánico de formato, verificado por el cerebro.

  CI rojo en el run 34991002953 (commit `8e9a028`): `bun run lint` con errores de formato de
  biome, no de reglas. El ítem solo registraba `src/__tests__/migration.test.ts:322` (`477bb43`);
  había cuatro más: `docs/done/evidence/AT.10-live.json` (`64dad00`),
  `docs/done/evidence/ERP.1-live.json` y `src/dashboard/public/screens-core.js` (`1f28156`),
  `scripts/ui-gates/ui81-visual-consistency.mjs` (`8e9a028`). Fix: `bunx biome format --write`
  solo sobre esos cinco; sin tocar warnings/infos.

  Verificación del cerebro: `bunx biome check .` sin errores en los archivos versionados (los
  dos restantes son WIP no commiteado de otra sesión: `src/db/migrate.ts`,
  `docs/done/evidence/UI.8.2-live.json`); de `migration.test.ts` se commitea solo el hunk de
  formato, construido desde `HEAD`. Causa de fondo: el pre-commit no corre `lint`, así que el
  formato roto entra sin aviso.

  Gate en vivo: Playwright real (chromium) contra el dashboard levantado con `HOME` temporal en
  `localhost:4391`, script `scripts/ui-gates/at91-format-smoke.mjs`, evidencia
  `docs/done/evidence/AT.9.1-live.json`. Las pantallas chat/tasks/settings responden 200, cargan
  `screens-core.js`, renderizan `#main` y **no hay ningún `pageerror`**. El script marca FAIL
  por dos `console.error` de red: `400 /api/chat/models` y `409 /api/plan`, que salen de la API
  con un home vacío, no del JS. Comparación A/B en el mismo servidor, sirviendo con
  `page.route` la versión de `HEAD` de `screens-core.js`: mismo `#main` (33,617 caracteres de
  HTML) y los mismos dos errores de red. El reformateo no cambia el comportamiento.

<a id="bloque-at-at-12"></a>
### AT.12 — El tope absoluto de contexto deja de cortar la sesión

Ejecutado por: terra (luna a capacidad) · Spec: docs/specs/AT.12.md

  `.claude/hooks/context-budget.js` ya no llama `process.exit(2)` cuando
  `absoluteLevel === 'block'`. Conserva ese nivel como dato y lo incorpora al aviso recurrente:
  tanto el primer turno como los siguientes llegan a `printWarning()` y terminan con éxito. Los
  umbrales y la clasificación de `scripts/context-budget.ts` no cambiaron.

  Verificación independiente del cerebro: `bunx tsc --noEmit`; `bun test
  scripts/context-budget.test.ts scripts/context-budget-hook.test.ts tests/hooks/context-budget.test.ts`
  (**14 pass / 0 fail**); búsqueda de `process.exit(2)`, el mensaje de cierre forzado y el tope
  absoluto en el hook (**sin coincidencias**); `git diff --check` limpio. La traza manual del
  flujo confirma que `absoluteLevel: 'block'` pasa el guard, actualiza el handoff solo en el primer
  turno y siempre imprime el aviso, sin ruta de salida no cero.

<a id="bloque-at-at-9"></a>
### AT.9 — Cualquier CLI en el chat, sin bloqueo por frontera de lectura

Ejecutado por: luna · Spec: docs/specs/AT.9.md

  El chat de proyecto ya no rechaza un CLI cuya frontera declarada de lectura sea `none`. La
  sesión se crea y el turno se ejecuta; el backend devuelve la razón real como
  `readBoundaryWarning` y la UI la muestra una sola vez por sesión. Las sesiones generales no
  reciben el aviso. Codex conserva `--sandbox read-only` para escrituras y declara honestamente
  que no limita la lectura al proyecto; OpenCode tampoco gana una frontera inexistente.

  Codex añade `--skip-git-repo-check` para funcionar desde el directorio temporal del chat general.
  Su home aislado enlaza el `auth.json` ya existente del usuario sin copiar el secreto, y no
  reemplaza un destino regular preexistente. Esto resuelve autenticación, pero no crea una frontera
  de lectura.

  Gate en vivo: Playwright con Chromium contra el dashboard real,
  `docs/done/evidence/AT.9-live.json` — una sesión nueva de proyecto con Codex respondió
  `AT9_PROJECT_OK`, persistió mensajes `user`/`assistant` y mostró exactamente una vez el aviso
  `Codex no limita la lectura a este proyecto`; una sesión general respondió `AT9_GENERAL_OK`,
  persistió ambos mensajes y no incluyó aviso. El servidor se detuvo al terminar.

  Verificación independiente del cerebro: `bunx tsc --noEmit`; cinco archivos de tests relevantes,
  **44 pass / 0 fail**; `bun run security:gate`, **1428 pass / 0 fail**, auditoría sin
  vulnerabilidades `high+`. La primera implementación de Luna fue devuelta por cuatro omisiones
  detectadas en review (helper muerto, replay durable sin aviso, fixture de auth incompleto y regex
  obsoleta); Luna las corrigió antes de aceptar el cierre.

  `bun run lint` conserva un único error ajeno a AT.9: formato en
  `src/__tests__/migration.test.ts:322`, ya versionado y sin cambios en este ítem. Quedó registrado
  como AT.9.1; los doce archivos `src/` de AT.9 sí pasan el formatter.

  Este cierre reemplaza la decisión de producto de AT.3/H.9.2 que bloqueaba con HTTP 400, sin borrar
  su historial ni relajar el mecanismo `--restricted` de Claude. H.9.4 sigue siendo el gate de la
  frontera efectiva para los CLIs que sí la declaran; para los que declaran `none`, verifica el
  aviso honesto en vez de prometer aislamiento.
<a id="plan-orden-at-1"></a>
- [x] **AT.1 — 🧠 Fuerte planifica, chico ejecuta, con diente mecánico.** (cerrado 2026-09-14)
  Ejecutado por: luna · Spec: docs/specs/AT.1.md
  `.claude/hooks/brain-no-code.js` + registro `PreToolUse` en `.claude/settings.json` +
  `tests/hooks/brain-no-code.test.ts` (9 pass, 0 fail; `tsc` limpio), protocolo unificado en
  `aa51d7a`. Gate en vivo en la sesión del cerebro (Opus 5): `Write src/__brain_guard_probe.ts` y
  `echo >> src/__brain_guard_probe_bash.ts` → denegados con el mensaje del hook, sin crear archivos;
  `Write docs/specs/__probe.md` → permitido (borrado después).

<a id="plan-orden-at-2"></a>
- [x] **AT.2 — ⚡ El Sprint Board deja de congelar el dashboard.** (cerrado 2026-09-14)
  Ejecutado por: luna · Spec: docs/specs/AT.2.md
  `src/db/plan-items.ts`: alcanzabilidad por `git rev-list HEAD` cacheada por HEAD y contenido por
  SHA cacheado si no es nulo; test nuevo en `src/db/plan-items.test.ts` (10 pass con plan-import,
  `tsc` limpio, diff revisado contra el spec). Medido en proceso: 3514 ms → 18 ms en la segunda
  llamada, mismo resultado. Dashboard real reiniciado: `/api/plan` 3.85 s → 316 ms → 25 ms; en una
  segunda ronda con el servidor ocupado, 257 ms y 21 ms. La primera llamada tras arrancar sigue
  costando ~3.5 s una vez. Hallazgo aparte, no de este ítem: el primer ciclo de `fetchAll` tras
  arrancar dejó `/api/chat/sessions` en 7–14 s y `/api/chat/models` en 9 s, con un handler de
  sesiones trivial — otro endpoint bloquea el event loop.

<a id="plan-orden-at-3"></a>
- [x] **AT.3 — ⚡ El chat no crea conversaciones que nacen muertas.** (cerrado 2026-09-14)
  Ejecutado por: luna · Spec: docs/specs/AT.3.md
  `cli-registry.ts` expone `projectChatUnavailableMessage()`; `chat-sessions.ts` valida la
  frontera declarada de `KNOWN_CLIS` antes de crear la sesión; `screens-core.js`/`app.js`
  envuelven `ensureChatSession()` en try/catch y muestran el error sin dejar sesión muerta.
  Test nuevo en `chat-sessions.test.ts` (11 pass, `tsc` limpio, diff revisado contra el spec).
  Gate en vivo: Playwright contra el dashboard real, `docs/done/evidence/AT.3-live.json` —
  con `codex` seleccionado (frontera `none`), enviar responde 400 con el mensaje exacto, el
  toast lo muestra (sistema de toaster real de `dist/ui.js`, no el `showToast` legado que el
  spec asumía) y `sessionsAfter === sessionsBefore` (1 → 1). El brazo "con `claude` el chat
  responde" del gate original queda para que Carlos lo confirme al elegir el agente en
  Settings — selección de modelo es decisión suya, no de este cierre
  (`feedback-modelo-decision-final-carlos`).

<a id="plan-orden-at-4"></a>
- [x] **AT.4 — 🔍 `/api/session/status`, no GC, es lo que congela el dashboard.** (cerrado 2026-09-15)
  Ejecutado por: luna · Spec: docs/specs/AT.4.md
  Causa raíz confirmada, medida: `readActiveSessionStatuses` (`scripts/session-status.ts`)
  parseaba los 371 transcripts completos por cada uno de los 5 CLIs (de 7) sin sesión
  activa, sin cortar — ~1.4s por pasada × 5 ≈ 7s, coincide con los 7–15s reportados.
  `detectInstalledClis` (cacheado, 45–160ms) y `readCodexRateLimitsLive` (68–73ms) se
  descartan como causa, medidos por separado. Fix: una sola pasada sobre los transcripts,
  `readSessionMetrics` una vez por archivo (no por CLI×archivo), corte temprano cuando
  todos los CLIs detectados ya tienen match. Medido antes/después: 7.0–9.2s → 1.5–1.7s.
  Gate en vivo: `docs/done/evidence/AT.4-live.json` — estáticos concurrentes con
  `/api/session/status` en curso bajaron de 7–15s a ~613ms. `bunx tsc --noEmit` y
  `bun test scripts/session-status.test.ts` (incluye test nuevo: lee cada transcript
  como máximo una vez) en verde. Dashboard bajado al cierre.

<a id="plan-orden-at-5"></a>
- [x] **AT.5 — 🧠 Freno mecánico de costo de sesión: umbral absoluto + bloqueo real.**
  (cerrado 2026-09-14)
  Ejecutado por: luna · Spec: docs/specs/AT.5.md
  `ABSOLUTE_BUDGET_THRESHOLDS` (warn 60k, block 90k tokens absolutos de la llamada actual,
  independiente de la ventana del modelo) en `scripts/context-budget.ts`, sin tocar el
  umbral por-% existente. `.claude/hooks/context-budget.js`: `exit 2` + mensaje en stderr
  cuando `absoluteLevel === 'block'`, se repite en cada prompt (no es aviso de una sola
  vez); `isBudget()` ampliado para aceptar `level: 'ok'` (necesario para no descartar un
  budget con ventana grande y `absoluteLevel` alto). `.claude/settings.json`:
  `bashOutputMaxChars: 8000` (clave real verificada contra la documentación de hooks/
  settings — `BASH_MAX_OUTPUT_LENGTH` de NEXT.md no existe). 8 tests nuevos verdes
  (`scripts/context-budget.test.ts` + `tests/hooks/context-budget.test.ts`, integración
  real contra `bun run context:budget`), `tsc` limpio, `bun run lint` exit 0 (verificado por
  el cerebro — el reporte de Luna decía "falla", eran warnings preexistentes, no errores).
  Diff acotado a los 5 archivos declarados.

<a id="plan-orden-at-6"></a>
- [x] **AT.6 — ⚡ Lint en rojo: 3 archivos sin formatear/ordenar.** (cerrado 2026-09-14)
  Ejecutado por: luna · Spec: docs/specs/AT.6.md
  `bunx biome check --write` sobre los 3 archivos declarados; solo formato + orden de
  imports, sin cambio de comportamiento (diff revisado). `bun run lint` exit 0 (verificado
  por el cerebro — el reporte de Luna decía "sigue fallando", pero corría contra un estado
  previo; no era evidencia). `bunx tsc --noEmit` limpio, 14 tests verdes en los dos
  archivos de test tocados.

<a id="plan-orden-at-7"></a>
- [x] **AT.7 — 🧠 Recuperar migración histórica de chat retenido.** (cerrado 2026-09-14)
  Ejecutado por: luna · Spec: docs/specs/AT.7.md
  Sin delegación: el spec era un artefacto no versionado y fue eliminado al cerrar el ítem.
  aplicada con el cambio ajeno `run-files-read`, dejando `chat_messages` sin `task_held` ni
  `existing_files` y rompiendo todo POST de chat. Añadir una migración 9 compensatoria, sin
  reescribir el ledger histórico ni la versión 4; cubrir instalación nueva, ledger legado y
  segunda ejecución. **Gate:** backup verificado de `~/.orchestos/db.sqlite`, migración oficial,
  `PRAGMA table_info(chat_messages)` y POST/GET/recarga reales con respuesta exacta.
  **Estado 2026-09-14:** backup `~/.orchestos/backups/at7-pre-migration-2026-09-14.sqlite`
  verificado, v9 aplicada, `PRAGMA integrity_check` = `ok`, POST real = `ORCHESTOS_CHAT_OK` y GET
  tras reinicio recuperó ambos mensajes. El fixture de AT.7.1 elimina el fallo de
  `absoluteLevel: null`; `bun run test:coverage` pasa 1420/1420 y el gate de migración queda
  cerrado.

<a id="plan-orden-at-7-1"></a>
- [x] **AT.7.1 — ⚡ Desbloquear el gate de cobertura de AT.7.** (cerrado 2026-09-14)
  Ejecutado por: luna · Spec: docs/specs/AT.7.1.md
  `docs/specs/AT.7.1.md` con Luna antes de cerrar AT.7. El cambio queda limitado al fixture del
  test de contexto: debe proveer un catálogo mínimo aislado al proceso hijo bajo el runtime de
  cobertura, sin tocar la lógica de producción ni los umbrales. **Gate:** la prueba pasa con
  `bunx bun@latest` y `bun run test:coverage` deja de fallar por `absoluteLevel: null`. **Estado
  2026-09-14:** cambio aplicado por Luna en `tests/hooks/context-budget.test.ts`; test específico
  2/2, `tsc` y cobertura completa 1420/1420 pasan.
  **Fuera de scope declarado:** `PLAN.md` registra el cierre y `.orchestos/feature-status.json`
  es el índice derivado exigido por `plan:reconcile`.

<a id="plan-orden-at-8"></a>
- [x] **AT.8 — ⚡ Presupuesto de subagentes: máximo dos, Luna y contexto mínimo.** (cerrado 2026-09-14)
  Sin delegación: código y tests ya existían sin commitear al abrir la sesión
  (`subagent-budget.js` + `subagent-budget.test.ts`, spec `docs/specs/AT.8.md` nunca commiteado);
  se verificó línea por línea contra el spec en vez de reejecutar con Luna, para no duplicar
  trabajo ya hecho.
  `.claude/hooks/subagent-budget.js` implementa `PreToolUse:Agent` + `SubagentStart`/`SubagentStop`
  + `SessionStart`, lock `open(...,'wx')` con TTL, reservas expirables a 60s, estado aislado por
  `session_id` (hash sha256) bajo `.orchestos/subagent-budget/` (gitignored). En Codex la
  limitación queda narrativa (`AGENTS.md`), documentada honestamente: el repo no puede interceptar
  `spawn_agent` del host. El fixture de AT.5/context-budget ya había quedado reparado por AT.7.1.
  **Gate en vivo 2026-09-14:** 2 subagentes admitidos, 3ro denegado con el mensaje exacto del spec,
  ambos terminan, 4to admitido sin bloqueo — corrido en esta misma sesión con agentes reales
  (no simulado). `bun test tests/hooks/subagent-budget.test.ts` 7/7, `bunx bun@latest test
  tests/hooks/context-budget.test.ts tests/hooks/subagent-budget.test.ts` verde, `tsc --noEmit`
  limpio, `bun run test:coverage` 1427/1427 con gates de cobertura en verde.
  **Hallazgo fuera de scope, no tocado:** `bun run lint` sale con 1 error preexistente y no
  relacionado (formato en `src/__tests__/migration.test.ts`), ya listado en `NEXT.md` como
  pendiente aparte.
  **Fuera de scope declarado:** `.claude/settings.json` (registrar los 5 hooks del punto 1 del
  spec), `.gitignore` (ignorar `.orchestos/subagent-budget/`), `AGENTS.md` (nota narrativa de
  presupuesto de delegación que referencia este ítem) y `PLAN.md`/`.orchestos/feature-status.json`
  (cierre del ítem) — el spec solo declaraba `.claude/hooks/**` y `tests/hooks/**`, pero el hook no
  entra en vigor sin el wiring en `settings.json` ni el `.gitignore` de su estado.
