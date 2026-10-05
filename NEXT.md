# NEXT — handoff 2026-10-05 → siguiente tab

## 2026-10-05: PLAN.md/NEXT.md saneados (cerrados → docs/done/). Siguiente: elegir de `bun run next`
Arranque: tab nuevo → `bun run agent:preflight -- --item <ID> --agent claude`. Sin dashboard corriendo.

Cerrado 2026-10-04 (detalle y evidencia en PLAN.md y `docs/done/evidence/`):
- I.7, I.7.2 (reporte de fin de tarea en el chat), I.7.3 (regresión: Approve & Run no ocultaba la tarjeta).
- Bloque CX: CX.1 `gate:evidence` exporta runs de ui:gate · CX.2 anillo de contexto por hilo, recalcula al cambiar
  de modelo · CX.3 hook de Claude Code solo por % de ventana · CX.4 tokens de caché + `elapsed_ms` en runs ·
  CX.5 Settings → Usage = runs de OrchestOS + tabs CLI de proyectos registrados (en vivo: $3.88 + $1,131).
- CI.13: "Run" en Tasks mostraba nada si la tarea fallaba (camino de error verificado solo por lectura).

H.5.3 cerrado 2026-10-05: baseline 8/9 (detalle en `docs/done/bloque-H.md#plan-orden-h-5-3`). Siguiente según
Rumbo: **ERP.4** (piloto de módulo ERP).

Pendientes anotados (sin ítem todavía; abrir si Carlos quiere):
- `usage-bar` falló en el pre-push con ENOTEMPTY al borrar su tmpdir (`orchestos-ui-13-5-*`); pasó al reintentar (2026-10-05).
- H.5.3: Codex se cuelga sin salida a veces (timeout 20 min; huecos de 5-14 min entre trials) — ligar a CI.11;
  `elapsed_ms` no cuenta el cuelgue; `effort` del rol no llega a `cli_effort` del eval (sin verificar si se aplica).
- CX.5: fila `<synthetic>` (0 tokens) visible en "CLI tabs"; "Avg cost / run" mezcla runs y sesiones.
- `chat-roles` flaky dentro del pre-push completo (falló 2 veces, pasa solo); causa no reproducida.
- I.7.2: si el dashboard se reinicia a mitad del run, el reporte de fin se pierde (gap declarado).
- Runs de chat con caché no vistos en DB (el purge de los gates los borra); el anillo de CX.2 los usa y funciona.
- Datos del entorno: Codex corre con `CODEX_HOME` de Orca (`~/Library/Application Support/orca/codex-accounts/*/home`);
  sin API key de OpenRouter el catálogo se baja igual (endpoint público).

Sin commitear y ajenos (no tocar sin Carlos): IDEAS.md, orchestos.config.yaml.

## Pendientes sin ítem heredados (consolidados 2026-10-05 desde handoffs 2026-09-22 → 2026-10-03)
Sin verificar de nuevo hoy salvo lo indicado; abrir ítem solo si Carlos lo pide.
- Settings → Tasks del proyecto muestra "Create First Task" (`OrchestSettingsView.tsx:2533`, verificado hoy en el
  código; contradice "Tasks solo por chat") y "Loading live settings…" fijo en la cabecera (2026-10-03).
- Settings → Skills: la pestaña "Instincts" aparece resaltada (pill) además de "Skills" (visto en capturas 2026-10-02).
- `src/run/logger.ts:52` lanza ENOENT al escribir en `runs/` de un proyecto que el cleanup de un flujo ya borró
  (visto en `ui-gate-68402/dashboard.log`, 2026-09-28).
- Chat: historial en las ramas Claude/OpenCode (hoy solo Codex tiene memoria por thread; OpenCode pasó a terminal en Dev
  con AT.15). Composer que conserva el mensaje durante el turno y Markdown que junta saltos simples ("uno\ndos" →
  "uno dos"): vistos en captura 2026-09-27, UI.18–UI.20 pueden haberlos cubierto, no re-verificado.
- "Clonar desde URL" (paso 2 de "+ Add project"): en espera por decisión de Carlos; feature nueva → plan corto antes.
- Decisión pendiente de Carlos (UI.13.4b): la frontera por argumentos no frena `node -e`/`sh -c`; la barrera real es
  sandbox de proceso o lista de binarios permitidos. AT.14 cerró solo el hueco del hook `brain-no-code`.
- Ajustes menores: idioma solo traduce Settings; fuente del prototipo = del sistema (si Carlos quiere Plus Jakarta Sans
  real es un cambio de una línea); reemplazar el prompt base del CLI (Codex ~96 % del input en el fixture; ver AT.13).
- `usage-bar` falla a veces por `account/rateLimits/read` de Codex (>3 s); fallback candidato en `AGENTS.md` § Lecciones.
- Migración de ruta (2026-09-28): confirmar con Carlos que Orca detecta el proyecto en `~/Projects/projects/orchestos`.

## Datos del entorno vigentes
- Repo en `/Users/carlosgallardo/Projects/projects/orchestos` (migrado 2026-09-28; plantilla en `~/Projects/screens`).
  Restos inofensivos dejados a propósito: `~/.claude/projects/-Users-carlosgallardo-Documents-projects-orchestos`
  (transcripciones para /resume) y entradas `[projects."…/Documents/…"]` en los `config.toml` de Codex dentro de Orca.
- El flujo `opencode-terminal` NO va en el pre-push (necesita el binario opencode; CI no lo tiene).
- Delegación (Carlos): Luna = mecánico, Sonnet 5.5 = criterio, Sol 6.1 (`gpt-6.1-sol`) = QA. El cerebro no puede editar
  código (hook): los ejecutores van por `ORCHESTOS_ROLE=executor codex exec …`.
- `git stash list` conserva 5 stashes viejos (UI.12.2b, UI.11, AT.10 parcial, wip cascada E.16, config local): no aplicar.
- Archivo histórico: handoffs anteriores y logs de lotes L1–L4 en `docs/done/sprint-30.md` § Apéndice; lecciones de
  delegación/ui-gate en `AGENTS.md`; el resto vive en `git log -p NEXT.md`.
