# NEXT — handoff 2026-10-09 → siguiente tab

## Orden vigente
1. CI.16 (usage-bar intermitente, diagnóstico en PLAN.md; espera GO) → luego R.8.2.
2. CI.15 cerrado 2026-10-10 (Mutation `38040297323` sin `contract-a1`).
Cerrados 2026-10-07/09: CI.15 (arreglo), R.8.1.1 (marcador al final de frase + caché del catálogo CLI). Detalle en PLAN.md.
Lección: Luna (codex exec) en sandbox no puede abrir puertos → `EADDRINUSE` falso en tests que levantan servidor;
decirle en el prompt que el baseline ya se verificó fuera del sandbox.

## CI.14 cerrado (2026-10-06) — histórico. Pendientes que eran EN ORDEN, sin saltar (regla de Carlos: nada se deja "porque no rompe lo siguiente")
1. `enforceContract` (tests de `contract.ts`) flaky bajo Stryker: 615 kills falsos en la corrida del 10-02. Abrir ítem.
2. R.8.1.1 (plan presentado, espera GO): el marcador `[[orchestos:task]]` pegado al final de la frase no crea tarea
   (2/4 corridas de auto-flow) y queda visible; `chat.ts:118`, `chat-live.ts:3`, prompt `chat.ts:1267`. Además
   "Loading models…" bloquea el envío ~5 s tras recargar (medido 4.7–5.2 s): medir qué petición es la lenta.
3. Luego R.8.2.
Arranque: `bun run agent:preflight -- --item <ID> --agent claude` (abrir antes el ítem en PLAN.md). Detalle de R.8.1.1:
respuesta real que falló = `OrchestOS creará una tarea para crear claude-nota.md con una sola línea: nota de claude.
[[orchestos:task]]` (misma línea). El test `src/dashboard/__tests__/chat-task-marker.test.ts:12` exige que el marcador
a mitad de frase NO cuente: el arreglo acepta solo el marcador al FINAL de la última línea. Verificar con auto-flow 3
corridas seguidas. Captura de "Loading models…": `AgentComposer.tsx:130-172` (getChatModels + getCliModels), envío
bloqueado en `:249`.

## R.8.1 cerrado (2026-10-05) — histórico (el orden vigente es el de arriba)
Arranque (tras /clear): `bun run agent:preflight -- --item R.8.2 --agent claude`. auto-flow 31/31 (detalle en PLAN.md).
Nuevo pendiente: composer muestra "Loading models…" tras recargar un hilo (captura en la evidencia de R.8.1).
`read-boundary.mjs`, IDEAS.md y orchestos.config.yaml siguen sin commitear y ajenos.

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
- `chat-context` falló en el pre-push: el diálogo de nuevo chat no listó Claude (sonda de CI.10 en negativo bajo carga); pasó al reintentar (2026-10-05).
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

## R.8 corto hecho (2026-10-05) — NO listo para ERP.4. GO de Carlos: R.8.1 → R.8.6 en orden (PLAN.md). Siguiente: R.8.1
Arranque (tras /clear): `bun run agent:preflight -- --item R.8.1 --agent claude`. Ojo: `bun run next` lista ERP.4
primero por posición en PLAN.md; el orden real es el del Rumbo (R.8.1 primero). Dashboard ajeno en `localhost:4242`
(PID 41821, desde 13:17): preguntar a Carlos antes de cerrarlo.
A: 5/6 gates verdes; read-boundary inconcluso (Claude se niega sin invocar Read; 2 corridas más: inconcluso y timeout
180 s). B: revisión de Sol en `docs/done/evidence/R.8-revision-sol-2026-10-05.md` — 5 hallazgos altos: continuidad
historial→CLI tras recarga sin gate; QA/checks sin prueba sustantiva ni negativa; auto-flow acepta estado terminal
fallido y "sin botón 5 s" como aprobación; sin recarga/reinicio tras producir tareas (gap I.7.2); privacidad del
contexto del CLI sin prueba. Medios: pasos `true` literales, nombres de pasos que exceden lo comprobado.
`scripts/ui-gate/flows/read-boundary.mjs` tiene reintentos de Luna SIN commitear: se rehace en R.8.5 (no commitear tal cual).

## H.9.4 cerrado (2026-10-05) — siguiente: R.8 corto
Gate `read-boundary` PASS 6/6 (`docs/done/evidence/H.9.4-live.json`).
Pendientes nuevos: borrar `readBoundaryWarning` (sin consumidor, decisión de Carlos: sin aviso); cuando el CLI se queda
sin cupo ("out of usage credits") el chat lo muestra como respuesta normal, no como error.

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
