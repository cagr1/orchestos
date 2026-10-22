# Bloque DOC — evidencia de cierre
Evidencia movida literalmente desde PLAN.md en S.2; PLAN.md conserva el índice.

<a id="bloque-doc-doc-1"></a>
### DOC.1 — ⚡ Reconciliar documentación viva con el estado verificable del plan.
 (cerrado 2026-09-08)
  Actualizar el estado operativo de `README.md`, `VISION.md`, `PRODUCT.md`, `CONTEXT.md`,
  `AGENTS.md`, este encabezado y los resúmenes vivos de `MemoriesMD/wiki/projects/orchestos.md`
  y `MemoriesMD/projects/orchestos/estado.md`. Mantener `docs/done/` como historial inmutable y
  no presentar R.6–R.8, H.10.2 ni UI.8.1–UI.8.6 como cerrados. Gate: diff acotado, coherencia
  contra los ítems abiertos/cerrados del plan y `bunx tsc --noEmit` (la documentación no cambia
  comportamiento). **Evidencia:** `bun test` ✅ (1342 pass / 0 fail, 3321 expects, 142 archivos),
  `bunx tsc --noEmit` ✅; se actualizaron las fuentes vivas del repo y los dos resúmenes vivos del
  vault. `docs/done/` quedó intacto como historial.

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.

**Delegación — NO es una leyenda, son muros dirigidos a ti, el que ejecuta (endurecido 2026-07-15):**
- 🧠 = **Claude implementa** — requiere criterio arquitectural o decisión de diseño.
- ⚡ = **DeepSeek implementa** — tarea bien especificada. **Si eres Claude: NO la implementas, NO la
  adelantas porque sea trivial o esté adyacente a lo tuyo, NO te ofreces a hacerla.** Si un ⚡ está
  sin cerrar y bloquea tu 🔍, **PARA y repórtalo** — no lo absorbas.
- 🔍 = **revisión/gate obligatorio por Claude** — independiente de quién implementó.

**Regla de alcance (scope-lock, 2026-07-15):** ejecuta **EXACTAMENTE** el/los ítem(s) que el usuario
nombró — nada adyacente, ni el prerequisito, ni el siguiente, sin instrucción explícita. Si el ítem
nombrado tiene un prerequisito sin cerrar, **PARA y avísalo**; no lo hagas en silencio. Motivo real
(2026-07-15): con "continua con A.4" un LLM tocó A.3 (⚡, ajeno) y se ofreció a hacer A.5 (⚡, ajeno).

**Regla de commits (cadencia, 2026-07-15):** cada ítem cerrado (`[x]`) se commitea **en el mismo
turno** en que se cierra. Tras 2-3 commits locales, `git push origin master` **automáticamente**
(autorización permanente en CLAUDE.md) — **NO pidas permiso por lo ya autorizado, NO acumules** una
pila de cambios sin commitear. `--force` sigue requiriendo pedido explícito.

**Regla de documentación obligatoria (2026-07-02):** todo hallazgo — bug real, deuda técnica, feature huérfana, contradicción entre `tasks.yaml`/DONE.md y el código real — se convierte en un ítem de este archivo (o de IDEAS.md si es backlog no inmediato) ANTES de tocar código. Si no está escrito acá, no se corrige. Motivo: una auditoría completa (2026-07-02) encontró deuda documentada en prosa dentro de DONE.md ("anotado como deuda conocida") que nunca se tradujo a un ítem accionable y por eso nadie la persiguió durante 3 meses (ver Bloque F0).

**Regla de flujo IDEAS→PLAN→DONE (decisión Carlos, 2026-07-02):** cuando una idea pasa de IDEAS.md a PLAN.md (se convierte en el eje o en un bloque de un Mes), **se ELIMINA de IDEAS.md en el mismo commit** — no queda duplicada en ambos. La evidencia de que se realizó vive siempre en DONE.md (documentación extensa al cierre del Mes). IDEAS.md es solo backlog vivo: lo que está ahí es porque NADIE lo está haciendo todavía.

---

## Archivado 2026-10-22 desde PLAN.md (DOC.4)

<a id="bloque-doc-seccion-doc-1-y-limp-1-documentaci-n-al-d-a-y-c"></a>
### DOC.1 y LIMP.1 — Documentación al día y código muerto (GO de Carlos 2026-10-14)

- [x] **DOC.1 — 🔍 La documentación dice lo que de verdad está hecho.** (abierto 2026-10-14) Rumbo, estados de
  padres, NEXT.md con un solo presente y CONTEXT.md contrastados contra `git log`.
  Ejecutado por: criterio (delegate) · Spec: docs/specs/DOC.1.md
  (cerrado 2026-10-14) Rumbo con el orden real (UI.26 → UI.24 → ERP.4 → UI.8.6), R.8 cierra con ERP.4, AT.13 con
  una sola verdad (puntos 1-7 resueltos por MR.1.d2 `3b8c9b2`), NEXT.md con un solo presente (lo histórico en
  `docs/done/sprint-30.md` § Apéndice 2), lecciones durables a `AGENTS.md`, estado vigente en `CONTEXT.md`. El cerebro
  corrigió el encabezado de UI.25 (decía ABIERTO) y añadió AT.19.
  Evidencia (cerebro): diff leído completo; SHAs citados comprobados (`3b8c9b2`); `plan:reconcile` 71 ítems; `bun run
  next` sin ítems perdidos.
- [x] **LIMP.1 — 🔍 Fuera el código muerto.** (abierto 2026-10-14) Exports, archivos y funciones sin consumidor y
  comentarios que describen código que ya no existe; cada borrado con su evidencia (grep + gates). Decisiones de la
  limpieza general del 2026-10-13: el nombre propio y los marcadores del plan van en ítems propios, no aquí.
  Ejecutado por: criterio (rondas 1-2) + mecanico (ronda 3) · revisión qa · Spec: docs/specs/LIMP.1.md
  (cerrado 2026-10-14) 77 archivos de `src/`, −1048/+154: `ThreadsView.tsx` y `lib/elevated.tsx` borrados; 26
  funciones/constantes sin ninguna referencia borradas (incl. `ToolCallCounter`/`ToolCallLimitError`, regla que
  nunca se activaba, y su rama en `scheduler.ts`); ~130 `export` sin consumidor quitados; comentarios que nombraban
  lo borrado corregidos. Conservados con evidencia: `db/backup.ts` (import dinámico en test), `orcaProjectData.ts`
  (señal de backend de `roadmap-profile.test.ts:238`), `readBoundaryWarning` (tiene consumidores),
  `r6-runs-browser.png` (citado en evidencia), familia vendorizada. Inventario: knip 5. La revisión de `qa` encontró
  9 restos sin borrar → ronda 3; ningún defecto de comportamiento.
  Evidencia (cerebro): grep de cada símbolo borrado = 0 referencias; typecheck, lint, build:app verdes;
  `test:coverage` 1770/1 — el único fallo es el test del 409 (`tasks.test.ts:158`, identidad git global del Mac,
  anotado en NEXT.md), que pasa 7/7 con `GIT_CONFIG_GLOBAL` aislado. `ui:fidelity:jsx` ya estaba rojo desde
  `a9d5736` (UI.26.4a), sin relación.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/LIMP.1-live.json` — `chat-streaming` 24/24,
  `codex-live` 14/14.

- [x] **LIMP.2 — ⚡ ⌘K abre la paleta general fuera de Settings.** (abierto y cerrado 2026-10-21, GO de Carlos) `CommandPalette.tsx:43` deja el
  "abrir" vacío: ⌘K solo cierra, aunque el botón 🔍 del header y su tooltip prometen el atajo. Decisión: en Settings ⌘K
  sigue abriendo el buscador de Settings (`OrchestSettingsView.tsx:606`); fuera de Settings abre la paleta general.
  La nota previa "nunca se abre" era falsa: el botón 🔍 del header (`ShellHeader.tsx:34`) sí la abría. Arreglo: prop
  `onOpen` en `CommandPalette`, `App.tsx` la pasa solo fuera de Settings.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/LIMP.2-live.json` (`shell-look` 49/49, dos pasos nuevos:
  ⌘K abre y Escape cierra en Chat; en Settings la general no abre, medido antes de Escape por hallazgo P2 de `qa`).
  Spec: docs/specs/LIMP.2.md (borrado) · Ejecutado por: GPT (mecanico) · QA: GPT (qa).
- [x] **LIMP.3 — 🔍 `AgentChoice` deja de ser una lista cerrada de 5 marcas.** (abierto y cerrado 2026-10-21, GO de Carlos)
  Resto de AT.11: el registro de adaptadores ya es abierto, pero `schema.ts:39` y sus 7 consumidores (config, DB,
  handlers de chat-sessions/tasks/config) fuerzan `'local'|'claude'|'opencode'|'codex'|'api'`. Sin cambio visible ni
  migración (`agent` es `TEXT` sin CHECK). Fuera de alcance, decidido: lectores de transcripts por CLI (adaptadores
  legítimos), agrupación por marca de Usage (cambio visible) y columnas `codex_*`/`claude_*` (migración sin ganancia).
  Resultado: `AgentChoice = string`; el chat valida contra el registro (sin cast) y la config contra `taskAgentIds()`
  de `engine-cascade.ts` (un solo mapa agente→motor, misma lista que antes). La r1 validaba la config contra el registro
  de chat: QA (Sol) mostró que importar config abría la DB (`ENOTDIR` con `ORCHESTOS_HOME=/dev/null`) y que una regla
  con un adaptador nuevo perdía su agente en `taskFieldsFromRule`; r2 lo corrige, QA r2 sin defectos. Ejecutar tareas
  con adaptadores nuevos es una feature aparte, sin ítem. Evidencia (cerebro): typecheck, biome, `test:coverage`
  1906/0, import de config con `ORCHESTOS_HOME=/dev/null` exit 0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/LIMP.3-live.json` (`model-routing` 18/18, `chat-roles` 10/10).
  Ejecutado por: GPT (criterio-alt, r1 y r2), QA GPT (qa) · Spec: docs/specs/LIMP.3.md
- [x] **WT.1 — 🔍 Dos worktrees se pisan el registro del plan.** (abierto y cerrado 2026-10-21, Carlos: "mira lo mejor") El
  ledger (`plan_items` + `plan_doc_segments` en la DB de `~/.orchestos`) es uno solo: `plan:reconcile` en master borró
  UI.27/UI.27.1 (rama `ui/UI.27`, worktree `orchestos-ui27`) como huérfanos y reemplaza el documento entero
  (`plan-import.ts:108-123`), así que el pre-commit del otro worktree falla en `plan:render --check`. Decisión: el
  worktree principal es dueño del ledger compartido; un worktree secundario usa uno propio y no toca el compartido.
  Arreglo: `scripts/plan-worktree-home.ts` detecta por git (`--git-dir` ≠ `--git-common-dir`) y, solo en los CLI del
  ledger (`plan-import`, `plan-render`, `plan-gate`, `next`), apunta `ORCHESTOS_HOME` a `<git-dir>/orchestos-plan` antes
  de importar `src/db/sqlite.ts`. El dashboard y el resto del pre-commit siguen en la DB compartida; master no cambia.
  Una DB privada vacía se reconstruye con un reconcile (SHAs de cerrados desde git). Evidencia (cerebro): typecheck,
  `plan-worktree-home.test.ts` 1/1 (38 expect, repo + `git worktree add` reales, ambas direcciones), `test:coverage`
  1907/0. QA (Sol) sin defectos. Integrar una rama sigue igual: rebase sobre master y reconcile en master.
  Ejecutado por: GPT (criterio-alt), QA GPT (qa) · Spec: docs/specs/WT.1.md
- [x] **CUOTA.1 — 🔍 La barra marca 100% de Claude desde el 28-sep sin que nadie lo vea.** (abierto y cerrado 2026-10-21, Carlos)
  Causa: sin lecturas nuevas desde `Sep 28 10:18` (la `statusLine` apuntaba a `~/Documents/projects/orchestos`; luego
  Orca la reescribió sin el tee) y `ShellStatusBar.tsx:44` pinta 100% toda ventana ya reiniciada. Restaurado a mano
  2026-10-21 (respaldo `~/.claude/settings.json.bak.20261021-statusline`): tee → Orca; lectura fresca 96%/10%. Falta que
  no vuelva a pasar en silencio. Arreglo: una ventana reiniciada sin lectura posterior vale `null` (por ventana: la
  otra sigue visible) y el motivo "no data since <edad>" va en tooltip/popover, la píldora no cambia de ancho;
  `scripts/claude-statusline-wiring.js` diagnostica si `statusLine` pasa por el tee (expansión `~`/`$HOME` como el
  shell) y lo avisan la barra y `startup-guard.js`; a igual reset y uso gana la lectura más reciente. QA (Sol) r1: 3
  hallazgos P2 (ventana vieja ocultaba la vigente, fecha vieja al fusionar sesiones, `"~/…"` falso positivo), los tres
  con test de su reproducción en r2. QA r2 no corrida: cupo de Sol agotándose (Carlos, 2026-10-21).
  Evidencia (cerebro): typecheck, tests 45/0, `test:coverage` 1921/0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CUOTA.1-live.json` (`usage-bar` 19/19, lectura vieja → "no data since 1 h").
  Ejecutado por: GPT (criterio-alt r1/r2, mecanico textos), QA GPT (qa r1) · Spec: docs/specs/CUOTA.1.md
- [x] **MOD.1 — 🔍 El catálogo de cada CLI sale de la fuente del CLI, con nombre y versión.** (abierto y cerrado 2026-10-21,
  Carlos: "siempre debe mostrar el modelo con su versión, no solo para Claude") Claude arma su lista con el historial de
  uso (`chat-cli-models.ts:107`): Sonnet 5.5 no aparece hasta usarlo. El CLI ya guarda su catálogo oficial en
  `~/.claude/cache/model-catalog/*-cc.json` (`id` + `name` "Sonnet 5.5"), como Codex `models_cache.json`.
  Arreglo: `parseClaudeModelCatalog` + lectura del `surface: "cc"` más reciente; `main` primero, `overflow` y los ids
  que solo están en el historial en el grupo `Older`; sin catálogo, como antes. Test de contrato por CLI (Claude,
  Codex, OpenCode: lista no vacía, `name` legible). Evidencia (cerebro): typecheck, `chat-cli-models.test.ts` 16/0;
  dashboard real (puerto 4399, home real, apagado después) `GET /api/chat/cli-models` → Opus 5.5, Sonnet 5.5,
  Fable 5.1, Haiku 5.5, luego `Older`. Límite: el flujo usa home temporal sin catálogo; "Sonnet 5.5" en el selector
  se vio por la API, no con clic en el navegador. QA de otro proveedor no corrida: Codex sin cupo; revisó el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/MOD.1-live.json` (`composer-picker` 5/5).
  Ejecutado por: Claude Sonnet (criterio, r1 y r2), revisión del cerebro · Spec: docs/specs/MOD.1.md
- [x] **DOC.2 — 🔍 `docs/` solo con lo relevante.** (abierto 2026-10-14, GO de Carlos) 36 archivos sueltos clasificados
  por contenido contra HEAD: lo vigente se fusiona o comprime, lo histórico pasa a `docs/done/`, lo obsoleto se borra.
  Ejecutado por: criterio (delegate) · clasificación: leer · Spec: docs/specs/DOC.2.md
  (cerrado 2026-10-14) Raíz de `docs/` de 43 archivos / 5 325 líneas a 4 + `specs/` activos / 676 líneas:
  `agent-work-protocol.md` comprimido (87→67, lo que repite `AGENTS.md` apunta allí), `security.md` fusiona 5 políticas
  vigentes (verificadas contra el código), `SPEC.md` y `sources-registry.yaml` se quedan. A `docs/done/`: 9 diseños
  (`design/`), 4 revisiones de seguridad (`security/`), 4 de UI (`ui/`), la poda de memoria y la revisión del bloque S.
  Borrados: la propuesta de flujo por lote (ya regla), `sub-agents-flow.md` (duplicado y viejo), 4 capturas sin
  referencia y 7 specs de ítems cerrados. Referencias actualizadas (21 comentarios de `src/`, `AGENTS.md`,
  `CONTEXT.md`, enlaces en `docs/done/`).
  Evidencia (cerebro): diff de `src/` = solo rutas en comentarios; `git grep` de rutas viejas fuera de `docs/done/` e
  `IDEAS.md` = 0; preflight lee el protocolo; typecheck y lint verdes; `plan:reconcile` 73 ítems.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/DOC.2-live.json` — `chat-streaming` 24/24.

- [x] **DOC.3 — 🔍 README e instaladores coinciden con el código.** (abierto 2026-10-16) Lo que la auditoría de la doc
  de Mintlify (cagr1/docs `d2ea823`) encontró falso en el repo: `skill fetch --language`, el pin de executor sin
  `executor_model`, `planner_model` sin efecto, "via Haiku" (hoy rol Auxiliary) y `OPENROUTER_API_KEY` "requerida" en
  `install.sh`/`install.ps1`; IDEAS.md #25 registra el repo y el sitio de docs.
  (cerrado 2026-10-16) README: `skill fetch --list | --name <id>` (vía dashboard); §4 fija una tarea con `engine` +
  `executor_model` (`executor` solo no cambia nada, `auto-route.ts:12-44`); `planner_model` fuera de la referencia
  (se parsea y nadie lo lee); `runs --analyze`, `task diagnose` y el juez de memoria = rol Auxiliary. Comentarios de
  `diagnose.ts`, `patterns.ts`, `judge.ts`, `graph-runner.ts` y el `--model` de `cli.ts` al día. Instaladores: las
  keys son opcionales y ya no cortan la instalación si se dejan vacías.
  Sin delegación: documentación.
  Evidencia (cerebro): cada afirmación contrastada con `cli-skill-fetch.ts`, `auto-route.ts`, `tasks/schema.ts`,
  `patterns.ts:144`, `diagnose.ts:167`; `bash -n install.sh`; pre-commit y pre-push verdes.

