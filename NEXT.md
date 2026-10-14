# NEXT — handoff 2026-10-14 (DOC.1: documentación saneada)

Un solo presente. El handoff anterior (2026-10-13/14, con lotes y lecciones por ítem) quedó completo, marcado como
histórico, en `docs/done/sprint-30.md` § "Apéndice 2"; las lecciones durables, en `AGENTS.md` § "Lecciones operativas
de delegación y ui-gate". Orden y rumbo: `PLAN.md` § Rumbo. Arranque: `bun run agent:preflight -- --item <ID> --agent claude`.

## Estado actual
- Cerrados y pusheados: UI.24.1–24.3, UI.25 (UI.25.0, UI.25.1), UI.26.1–26.4a, ERP.4.1–ERP.4.13, CI.12, CI.21, CI.22,
  CI.24, DOC.1 (`331ddf5`), LIMP.1 (`c906eb2`), UI.26.4b; R.8.1–R.8.6 (`PLAN.md`; evidencia en `docs/done/`).
- Abiertos: UI.26.5–26.7, UI.24.4–24.7, ERP.4 (4.14 va dentro de UI.24.6; 4.15, 4.16), R.8 (cierra con ERP.4), UI.8.6,
  AT.13 (puntos 8 y `manifest.ts`), AT.19, CI.11, CI.18, CI.19, CI.23, CI.25. Lista viva: `bun run next`.
- Trampa de `plan:reconcile`: si dice "Could not prove a closing commit SHA", reabrir el ítem (`[ ]`), reconciliar,
  volver a `[x]`, reconciliar, commitear. Ítem delegado: commitear el spec antes (`docs(<ID>): spec`).
- Sin commitear y ajenos (no tocar sin Carlos): `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`,
  `.orchestos/feature-status.json`.

## Orden de lo que sigue
1. UI.26.5 (empieza por la raíz `bg-zinc-950` de `ContextView.tsx:20`, `SpecsView.tsx:45`, `SkillsView.tsx:52`) →
   UI.26.6 (incluye el ancho de Usage y Model routing) → UI.26.7 (solo revisar los inputs de Orquestación).
2. UI.24.4 (Streamdown; incluye saltos simples y decidir si la fila de fase va encima o debajo del texto en vivo) →
   UI.24.5 → UI.24.6 (con ERP.4.14; sacar `AgentComposer.tsx` de `ui:fidelity:jsx`, `package.json:28`) → UI.24.7.
   Los gates de chat leen `div.prose`, `textarea`, `aria-label="Send message"`, `title="Select model and reasoning
   effort"` y los textos "Approve & Run", "Commit & Run", "Retry", además de `div.max-w-2xl` y `div.max-w-3xl`:
   conservarlos o cambiar flujo y componente en el mismo ítem. Mirar siempre la captura, no solo el gate.
3. ERP.4.15 → ERP.4.16 → limpiar las 3 tareas sobrantes de `erp-piloto` (`chat-79f90f32` failed, `chat-f59db027` y
   `chat-ad9e193d` pending; tras ERP.4.16) → veredicto de ERP.4 → cerrar R.8.
   Antes de cerrar ERP.4: el test del 409 de ERP.4.13 (`src/dashboard/handlers/tasks.test.ts:158`) falla con
   `bun test` a secas (verificado 2026-10-14) porque hereda la identidad git global del Mac; debe fijar su entorno.
4. UI.8.6.
5. Fiabilidad, cuando el pre-push la tumba: CI.25 (hacer que deje evidencia antes de UI.26.5 si vuelve), CI.23 (al
   próximo `FAIL tasks` en `relaunched task final state`, leer el detalle JSON y escribir la fase 2 en
   `docs/specs/CI.23.md`), CI.18 (leer el detalle del paso del marcador y la captura `marker-failure`), CI.19, CI.11.

## Decisiones de Carlos vigentes
- 2026-10-13: veredicto de utilidad de ERP.4 = "sirve, pero todavía no solo"; ERP.4 se cierra al terminar su lote.
- 2026-10-13: sin regla de presupuesto: un fallo se diagnostica y se arregla en el producto ("si aplico una regla de
  presupuesto no mejoro, solo limito").
- 2026-10-13: árbol sucio = seguir bloqueando + tarea `pending` + "Commit & Run" en el hilo (ERP.4.13); reintento desde
  el hilo (GO); `chat-retry-report` NO entra al pre-push.
- 2026-10-13: Memory = entrada mecánica por tarea terminada, sin LLM (ERP.4.16). Sin UI nueva en Settings para ese
  lote: Carlos revisará Settings pestaña por pestaña (dashboard real) y dirá qué sirve y qué sobra.
- 2026-10-13: nada hardcodeado en el ejecutor que muestra la tarea: dice quién la hizo según la config (ERP.4.11).
- 2026-10-13/14: UI.24 primero, ERP.4 al final. Referencias vivas: gr8r-taskmanagement.vercel.app (medidas en
  `PLAN.md` § UI.26), Arc UI (uiarc.dev; los bloques Pro no se compran), MusicKind
  (`~/Projects/projects/portfolio/dist/projects/musickind-screen@1x.webp`).
- 2026-10-14: DOC.1 y LIMP.1 (GO).

## Decisiones de Carlos 2026-10-14 (respuesta a AT.19 y `readBoundaryWarning`)
- (a) `create_task` en lugar del marcador: GO, implementar sin presentar plan → AT.20.
- (b) Shell de solo lectura: sí, para todos los LLM, nunca solo para uno → AT.21 (mismo servidor MCP que AT.20).
- Le interesa ver la ventana de contexto real en Chat y en Dev → CX.6. `readBoundaryWarning` (aviso de privacidad,
  no un número) sigue sin mostrarse; la frontera de lectura está verificada por el gate `read-boundary`.
- Orden: AT.20 → AT.21 → CX.6, antes de seguir con UI.26.5.

## Pendientes sin ítem (una sola lista; abrir ítem solo si Carlos lo pide)
Verificados el 2026-10-14 contra el código salvo "(sin re-verificar)".
- Propuesta sin aplicar, decide Carlos: negar `git stash` en el hook writer-lock o en `bin/delegate` (fuente en
  `method/` del vault); el ejecutor lo corrió dos veces seguidas (UI.26.2 y UI.26.3) pese a `AGENTS.md`.
- Herramienta: `delegate investigar` y todo rol `claude` con `--tools` fallan (`~/.agent-method/bin/delegate:147,167-171`);
  esquive en `AGENTS.md`; el arreglo va en `method/` del vault.
- startup-guard ciego a lo que de verdad carga: no mira `~/.claude/skills/*`, `~/.claude/skills/synced/` ni
  `~/.claude/plugins/synced/` (`.claude/hooks/startup-guard.js` sin lectura de esas rutas); Claude Docs cargó pese a
  `disabledMcpServers` (2026-10-10). Candidato a CTX-GUARD.2.
- `readBoundaryWarning` sin consumidor (`src/dashboard/types.ts:90`, `app/src/api/chat.ts:14,77`; decisión de Carlos:
  sin aviso) → LIMP.1 comprobó que sí tiene consumidores (`chat.ts`, `chat-sessions.ts`, `api/chat.ts`): quitarlo cambia lógica, decide Carlos. Cuando el CLI se queda sin cupo ("out of usage credits") el chat lo muestra como
  respuesta normal, no como error (sin re-verificar).
- Intermitentes vistos una vez, sin ítem (si se repiten, abrir): `CC.2 — chat sessions backend` con timeout de 5 s
  dentro de `test:coverage` (2026-10-13; pasa solo); `restart-mid-run` caso A, reporte "failed · attempt 1/3" con
  reintento pendiente cuando el gate exige coincidir con el estado final (2026-10-13; decidir si un intento fallido con
  reintento pendiente debe decir "failed"); `chat-context`, diálogo de nuevo chat sin Claude (sonda de CI.10 en
  negativo bajo carga, 2026-10-05).
- `waitForTaskRun` (`app/src/api/chat.ts`) espera hasta 10 min ante un `pending` con intento fallido: no se midió si
  deja el botón pulsado ocupado todo ese tiempo.
- Settings → Tasks muestra "Create First Task" (`OrchestSettingsView.tsx:2463`; contradice "Tasks solo por chat") y
  "Loading live settings…" fijo en la cabecera (2026-10-03, sin re-verificar). Settings → Skills: la pestaña
  "Instincts" aparece resaltada además de "Skills" (2026-10-02, sin re-verificar).
- `src/run/logger.ts:50-53` (`write`) hace `appendFileSync` sin guarda: lanza ENOENT si el cleanup de un flujo ya borró
  el `runs/` del proyecto (visto en `ui-gate-68402/dashboard.log`, 2026-09-28).
- CX.5: fila `<synthetic>` (0 tokens) visible en "CLI tabs"; "Avg cost / run" mezcla runs y sesiones (sin re-verificar).
  Runs de chat con caché no vistos en DB (el purge de los gates los borra; el anillo de CX.2 los usa y funciona).
- H.5.3: `elapsed_ms` no cuenta el cuelgue de Codex; `effort` del rol no llega a `cli_effort` del eval (sin verificar
  si se aplica). El cuelgue en sí es CI.11.
- "Clonar desde URL" (paso 2 de "+ Add project"): en espera por decisión de Carlos; feature nueva → plan corto antes.
- Decisión pendiente de Carlos (UI.13.4b): la frontera por argumentos no frena `node -e`/`sh -c`; la barrera real es
  sandbox de proceso o lista de binarios permitidos. AT.14 cerró solo el hueco del hook `brain-no-code`.
- Ajustes menores: idioma solo traduce Settings; fuente del prototipo = del sistema; reemplazar el prompt base del CLI
  es el punto 8 de AT.13.
- Migración de ruta (2026-09-28): confirmar con Carlos que Orca detecta el proyecto en
  `~/Projects/projects/orchestos`.
- Sin identificar: qué borró `~/Library/Caches/ms-playwright` y un `duplicate column name` que salió una vez
  (2026-10-13). Sin verificar a ojo: el bloque "Executor reply" de la pestaña Contract (se comprobó por texto visible);
  el botón `Run` de Settings → Plan no se probó en vivo.

## Datos del entorno vigentes
- Repo en `/Users/carlosgallardo/Projects/projects/orchestos` (migrado 2026-09-28; plantilla en `~/Projects/screens`).
  Restos inofensivos dejados a propósito: `~/.claude/projects/-Users-carlosgallardo-Documents-projects-orchestos`
  (transcripciones para /resume) y entradas `[projects."…/Documents/…"]` en los `config.toml` de Codex dentro de Orca.
- Codex corre con `CODEX_HOME` de Orca (`~/Library/Application Support/orca/codex-accounts/*/home`); sin API key de
  OpenRouter el catálogo se baja igual (endpoint público).
- El flujo `opencode-terminal` NO va en el pre-push (necesita el binario opencode; CI no lo tiene).
- Delegación: por rol con `~/.agent-method/bin/delegate <rol> <spec>`; modelos solo en `~/.agent-method/roster.conf`.
  El cerebro no edita código (hook `brain-no-code`): los ejecutores van por `ORCHESTOS_ROLE=executor`.
- `git stash list` conserva 5 stashes viejos (UI.12.2b, UI.11, AT.10 parcial, wip cascada E.16, config local): no aplicar.
- Piloto ERP.4: repo `~/Projects/projects/erp-piloto`; conductor Playwright en `docs/done/evidence/ERP.4/conductor/`
  (copiar a `/tmp/erp4/`, crear `cmd/`, `out/`, `shots/`; `node driver.mjs` en segundo plano, `do.sh`, `stage.sh`,
  `screen.mjs`); registro de hallazgos en `docs/done/evidence/ERP.4/piloto-2026-10-12.md`.

## Lección LIMP.1 (2026-10-14)
Inventario de código muerto: `bunx knip@5 --config /tmp/limp1/knip.json` (config fuera del repo; entradas `src/cli.ts`,
`scripts/**`, `app/src/main.tsx`, `.claude/hooks/*.js`). Falsos positivos vistos: fixtures, `assets.d.ts`, `tailwindcss`
(lo usa el CSS), archivos que un test lee por ruta (`db/backup.ts`, `orcaProjectData.ts`). Un símbolo borrado puede dejar
falso el comentario que lo explicaba: revisar comentarios reescritos.
