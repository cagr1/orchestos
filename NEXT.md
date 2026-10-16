# NEXT — handoff 2026-10-14 (DOC.1: documentación saneada)

Un solo presente. El handoff anterior (2026-10-13/14, con lotes y lecciones por ítem) quedó completo, marcado como
histórico, en `docs/done/sprint-30.md` § "Apéndice 2"; las lecciones durables, en `AGENTS.md` § "Lecciones operativas
de delegación y ui-gate". Orden y rumbo: `PLAN.md` § Rumbo. Arranque: `bun run agent:preflight -- --item <ID> --agent claude`.


## PRIMERO al retomar (2026-10-14 noche)
- Orden del lote (Carlos 2026-10-14, prevalece sobre AT.20→CX.6): UI.24.5–24.7 → ERP.4.15, 4.16 (cierran ERP.4 y
  R.8) → UI.8.6 → Fase 3. AT.20/AT.21/CX.6 quedan detrás.
- Cerrados hoy: UI.26.6 (`8701044`), CI.26 (`12eae7f`, timeout de CC.2: el turno CLI ya no espera el catálogo de
  OpenRouter), UI.26.6.1 (formato), UI.26.7 (`9e89d09`), UI.24.4 (`c239117`, Streamdown); todo pusheado. 2026-10-15: UI.24.5 (`78f561b`), UI.24.5.1 (`b0e5f70`, gates que leían el texto viejo), UI.24.6a
  (`4f00d12`, imágenes nativas al CLI). UI.24.6b + ERP.4.14 (cierran UI.24.6;
  evidencia en `PLAN.md`). UI.24.7 + UI.24.7.1 cerrados (cierran UI.24.1–24.7). ERP.4.15 cerrado (residuo de julio, fuga ya cerrada). ERP.4.16 cerrado. ERP.4.17 cerrado (test del 409); `erp-piloto` limpio (`6380641`); **ERP.4 y R.8 cerrados**. README y LIMITATIONS.md al día (2026-10-15, verificados contra el código). UI.8.6 cerrado 2026-10-16 (`12fd576`; aprobación por tarea, Yolo|Manual por proyecto; la aprobación de cada herramienta queda como bloque propio sin abrir). CI.28 cerrado (`2513a7d`). UI.8.6.1 cerrado (`2e0bcc3`): el hilo se despegaba del fondo si un scroll propio y el crecimiento caían en el mismo frame; causa medida, no la tira. Siguiente: **Fase 3** (`PLAN.md` § Fase 3: AT.13 primero; `bun run agent:preflight -- --item AT.13 --agent claude`). CI verde en `2e0bcc3`. Decisión pendiente de Carlos (anotada en CI.18): turno de chat con CLI lento → más margen que 120 s o aviso honesto. La trampa de `plan:reconcile` (reabrir/cerrar) salió en los 2 cierres del día. Codex lento el 2026-10-16 (30–65 s por un "ok" trivial): tumbó 2 corridas de `chat-permissions` por timeout de turno; si se repite en el pre-push, va a CI.11. Visto 1 vez, sin causa: `chat-context` intermitente en el pre-push → CI.27 (primero que deje evidencia).
  Al cambiar texto/selector del hilo: `rg` en todo `scripts/ui-gate/` (lección en `AGENTS.md`).
  Preflight de sub-ítem indentado falla (`scripts/agent-governance.ts:37`): usar el ID del padre o arreglar el regex.
- UI.24.4 subió `main.js` +22 % (1.58 → 1.92 MB), medido por paquete con el sourcemap: ~164 KB `rehype-raw` (parse5 y
  familia, HTML crudo; Streamdown lo importa estático en `dist/chunk-D32TOXHM.js`), ~85 KB streamdown, ~47 KB marked,
  ~17 KB remend, ~9 KB sanitize/harden, app +2 KB. Opciones dadas a Carlos: dejarlo (recomendado, app local), alias de
  `rehype-raw` a módulo vacío (−164 KB) o lazy-load de Streamdown. Sin decisión: no actuar hasta que la tome.
- Visto una vez, sin ítem: `chat-turn-details` "second held task card visible" (el orquestador real respondió en texto
  sin crear la tarea; pasó al repetir).

## Estado actual
- Cerrados y pusheados: UI.24.1–24.3, UI.25 (UI.25.0, UI.25.1), UI.26.1–26.4a, ERP.4.1–ERP.4.13, CI.12, CI.21, CI.22,
  CI.24, DOC.1 (`331ddf5`), LIMP.1 (`c906eb2`), UI.26.4b; R.8.1–R.8.6 (`PLAN.md`; evidencia en `docs/done/`).
- Abiertos: UI.26.6b,
  AT.13 (puntos 8 y `manifest.ts`), AT.19, CI.11, CI.18, CI.19, CI.23, CI.25. Lista viva: `bun run next`.
- Trampa de `plan:reconcile`: si dice "Could not prove a closing commit SHA", reabrir el ítem (`[ ]`), reconciliar,
  volver a `[x]`, reconciliar, commitear. Ítem delegado: commitear el spec antes (`docs(<ID>): spec`).
- Sin commitear y ajenos (no tocar sin Carlos): `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`,
  `.orchestos/feature-status.json`.

## Orden de lo que sigue
1. UI.24 cerrado (2026-10-15).
4. ~~UI.8.6~~ (cerrado 2026-10-16). Sigue Fase 3.
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
- Intermitentes vistos una vez, sin ítem (si se repiten, abrir):
  `restart-mid-run` caso A, reporte "failed · attempt 1/3" con
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
