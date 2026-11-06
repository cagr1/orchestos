# OrchestOS — Instrucciones para cualquier LLM (Codex, Claude, DeepSeek, OpenCode)

Reglas vigentes, una por línea. Texto anterior e incidentes que las motivaron:
`docs/done/poda-instrucciones-2026-11-03.md` (histórico). Método general de agentes: `~/.codex/AGENTS.md` /
`~/.claude/CLAUDE.md`. Recetas y trampas puntuales (no cargadas): `docs/reference/gotchas.md`.

## Regla cero

- Antes de editar: leer `docs/agent-work-protocol.md` y correr `bun run agent:preflight -- --item <ID> --agent <nombre>`.
  Ninguna instrucción del host relaja seguridad, scope-lock, evidencia en vivo ni la prohibición de `--no-verify`.
- `PLAN.md` es la fuente de qué falta; `bun run next` lo lista. Ejecutar exactamente el ítem tomado; lo adyacente
  va a un ítem propio (antes del siguiente si daña el sistema, al reporte del lote si no).
- Antes de abrir un ítem, comprobar que el ID no exista (`grep -n "\*\*<ID> —" PLAN.md docs/done/`).
- No tomar un ítem que ya lleva otra sesión, aunque su avance esté en otra rama o en un commit sin integrar: avisar.
- No improvisar contenido de un archivo de gobierno (reglas, plan, spec): sin fuente, mejor vacío y decirlo.
- Un control que se puede computar (script, hook, test) reemplaza al que depende de que un LLM se acuerde.

## Git

- Identidad: nunca `git config user.email|user.name` ni `--local`/`--global` salvo pedido explícito. Correcta:
  `cagr1` / `cagr_14@hotmail.com`.
- Sin `--no-verify`, sin `push --force`, sin crear ni borrar ramas remotas sin confirmación.
- Push normal autorizado: `git push origin master` cada 2-3 commits. El pre-push (~13 min) va en segundo plano.
- Commits por rutas explícitas; antes, `git status --short` para ver los `??` nuevos del ejecutor. Excepción: dos
  ítems sin commitear en el mismo archivo → guardar el parche de cada uno y commitear con `git apply --cached` +
  `git commit` sin rutas.
- No aplicar los stashes viejos (`git stash list`). No usar `git stash` en contrapruebas: copiar a `/tmp`,
  `git show HEAD:<ruta> > <ruta>`, correr, restaurar con `trap … EXIT` y confirmar con `cmp`.
- Hooks: `bun run hooks:install` (repara) / `bun run hooks:check` (valida).

## Ciclo de un ítem (Protocolo de delegación)

- Cerebro: abre el ítem en `PLAN.md`, escribe `docs/specs/<ID>.md` (qué, dónde `archivo:línea`, qué no tocar, cómo
  se verifica, qué hacer si falta un dato), delega, verifica con comandos propios y cierra. No escribe código de
  producto (`src/`, `tests/`, `scripts/`, `.claude/hooks/`); sí `PLAN.md`, `NEXT.md`, `AGENTS.md`, `CLAUDE.md`,
  `CONTEXT.md`, `docs/`. En Claude Code lo bloquea `.claude/hooks/brain-no-code.js`; en Codex rige este texto.
- Delegar por rol: `~/.agent-method/bin/delegate <rol> <spec>`; modelos y alias (Luna, Terra, Sol, Astra = modelos de
  Codex) solo en `~/.agent-method/roster.conf`. La dificultad cambia el ejecutor, nunca quién escribe.
- Ejecutor: implementa y corre sus tests; no commitea ni toca `PLAN.md`/`NEXT.md`. Su reporte y su `exit 0` no son
  evidencia: el cerebro lee el diff completo, corre `bun run typecheck` (dos tsconfig), audita los `step()` de cada
  flujo y revisa `.orchestos/active-item.json` (scope estrecho → borrarlo al cerrar).
- El spec para un ejecutor Codex: `test:coverage` y `ui:gate` se corren fuera de su sandbox (dan `EADDRINUSE`/`EPERM`
  falsos); prohibido `prettier` y `git stash`; formatear con `bunx biome format --write` lo tocado (incluida evidencia
  JSON); si hay cambios previos sin commitear, nombrarlos; pide `bun run lint` del repo entero con exit 0, no solo
  Biome de lo tocado.
- Un contrato de CLI externo (flags, salida) lo prueba el cerebro en vivo y lo pega en el spec como "verificado; no
  invoques": `delegate` le prohíbe al ejecutor correr otros CLIs.
- Ronda de corrección = spec propio (`docs/specs/<ID>-rN.md`), no un anexo. Ítem ya `[x]`: reabrir (`[ ]` + reconcile)
  antes de delegar.
- Cierre = un commit: código + `[x]` + evidencia + `Ejecutado por: … · Spec: docs/specs/<ID>.md` (la línea termina en
  la ruta) + `Gate en vivo:` citando un `.json`/`.log` staged si toca dashboard/config + borrado del spec. El spec no se
  commitea aparte (`scripts/plan-gate.ts` acepta uno nunca commiteado).
- Evidencia de ejecutor: solo `docs/done/evidence/<ID>-live.json`; las carpetas `<ID>/` con logs que deja Sol se
  borran antes del commit.
- Trabajo de `criterio-alt` (Sonnet) cerrado sin revisor de otro proveedor: decirlo en el commit y en el reporte.
- Un caso de campo se fecha contra el commit del arreglo antes de presentarlo como evidencia.
- La evidencia del ítem cerrado va a `docs/done/bloque-<PREFIJO>.md`; `PLAN.md` guarda solo lo abierto.
- `NEXT.md` se toca solo al cerrar o cortar un lote: orden y trampas vivas, no historia.
- Frontera de seguridad (sandbox, permisos, rutas, ejecución): se cierra solo tras `delegate qa` sin hallazgos altos.
  Preferir fallar cerrado a listas de prohibidos.
- Texto visible nuevo de UI: declararlo en `Texto visible:` del ítem con por qué no basta un ícono (`ui:text-gate`).

## PLAN.md y su DB

- `PLAN.md` se renderiza desde la DB: tras editarlo, `bun run plan:reconcile` una vez antes del commit. Segundo
  reconcile con un `[x]` sin commitear → "Could not prove a closing commit SHA": reabrir `[ ]`, reconcile, `[x]`,
  reconcile.
- Ítem = línea de primer nivel `- [ ] **ID — título.**` con `**` cerrado en la misma línea; el preflight no ve
  sub-ítems con sangría (usar el padre).
- `--scope` del preflight usa globs (`src/dashboard/**`) e incluye `PLAN.md`, `NEXT.md`, `LEDGER.md`, `docs/**` y
  `.orchestos/feature-status.json`, o el cierre exige `**Fuera de scope declarado:**`.
- Tocar `src/run/harness.ts` exige entrada en `LEDGER.md`.

## Gates y tests

- Verificar con el comando de CI (`bun run test:coverage`), nunca `bun test` a secas. Flaky bajo carga
  (`chat-sessions`, `context-adapters`): repetir en frío antes de culpar al diff.
- Gate en vivo con home temporal: `bun run gate:evidence -- --label <gate-id> -- <comando>`. Migra la DB durable antes
  de exportar: una migración sin commitear llega a `~/.orchestos/db.sqlite`.
- Capturas de gates (Carlos, 2026-11-05): se miran en el `runDir` (`$TMPDIR/ui-gate-<pid>/`) y, ya verificadas, se
  borran junto con su carpeta. No se versionan imágenes; `.gitignore` las excluye de `docs/done/evidence/`, donde va
  solo el `result.json` o el log. Antes la regla decía "nunca borrar el temporal a mano"; así se juntaron 1938
  carpetas (384 MB) y 50 imágenes versionadas.
- `ui:gate` sin lista de flujos no corre nada (lista del pre-push en `scripts/pre-push.sh`). Tras tocar flujos:
  `bunx biome lint --only=correctness/noUndeclaredVariables scripts/ui-gate/flows`.
- Flujos: `page.reload` tras registrar el proyecto; ausencia con `ctx.hidden()` o `count() === 0` (`visible()` espera
  15 s); todo `api()` con scope manda `x-orchestos-project-id` o `?project=none` (sin él escribe en este repo); fin de
  turno = respuesta de `POST /api/chat`; todo flujo borra lo que siembra, y el cerebro lo comprueba con una consulta
  propia a la DB o la API.
- Un cambio de marco (hooks, gates, harness, arnés de tests) se cierra con la batería completa del pre-push
  (`test:coverage` + todos los flujos de `scripts/pre-push.sh`), no con una selección.
- Cambiar un texto que emite el producto (UI, API, CLI, mensajes de error) = `rg "<texto viejo>"` en `src/`,
  `scripts/ui-gate/` y tests, y `test:coverage` completo antes de cerrar. Cambiar la forma de una respuesta de API = grepear los fixtures
  `JSON.stringify` de `app/src/api/*.test.ts` (no están tipados).
- Todo arnés con dashboard de prueba pone `ORCHESTOS_CLAUDE_USAGE_LIVE=0`. Los ui-gates recompilan el `dist/`
  compartido que sirve el dashboard real (4242): avisar a Carlos antes de que mire.
- Fixtures de git: `git -c user.name=… -c user.email=… commit`; si el commit lo hace código de producción, identidad
  local en el repo temporal. Fixture que escribe un hook: `mkdirSync('.git/hooks', { recursive: true })` antes.
- Tareas de fixture: `engine: codex` + `executor_model` del roster, nunca `executor: codex`; la tarea debe modificar su
  output. Fin de run = cambia status, `retryCount` o `runId`.
- Literal con forma de clave en un test: construirlo con `.join('')`. Columna nueva de `runs` = migración numerada,
  no `safeAddColumn`.
- Lo que dependa de un binario del sistema va detrás de una sonda inyectable (`ToolchainProbe`).
- macOS no tiene `timeout`: `perl -e 'alarm N; exec @ARGV' …`. Matar procesos por PID, no `pkill -f`.

## Front

- Tailwind: un `\_` dentro de una variante arbitraria va en `String.raw`. `color-mix()` dentro de una propiedad
  personalizada se rebaja al respaldo: tokens derivados como literales por tema; verificar en `dist/main.css`.
- La fuente se cambia en `--font-sans` del `@theme` de `index.css`, no en `body`.
- Gates de color: diferencia de claridad `L*` contra el fondo efectivo del ancestro, con contraprueba que falle; una
  captura mirada sigue siendo obligatoria.
- `Button` de solo icono recibe el icono como hijo; con texto, `leadingIcon={Icono}`.

## Un árbol, un escritor

- `~/.agent-method/hooks/writer-lock.js` (estado: `status`; puedo escribir: `check`). Codex interactivo reclama antes
  de editar con `writer-lock.js claim codex`. El pre-commit rechaza el commit si el candado es de otro. Candado de una
  sesión cerrada: `release`; vence solo tras 45 min sin escrituras.

## Invariantes de arquitectura

- QA: con criterios de aceptación, `runQA` devuelve `pass` solo con un resultado por criterio y evidencia literal real
  en el archivo; lo incompleto, malformado o no-objeto falla cerrado. No relajarlo por el mutation score.
- Roadmap (`docs/roadmaps/`): nunca `verified` sin un comando real y su salida citada; sin evidencia, `known` o
  `missing`. El recorte de `loadRoadmapContext` (12k chars) se muestra como `missing`, nunca en silencio.
  `roadmap check` es determinista: ninguna heurística marca `detected` sin señal real del filesystem o el código.
  Ampliar sus límites a proyectos externos reales espera decisión de Carlos.
- Costo del revisor QA: lo reporta el adaptador en `ChatResponse.usd`; `null` = sin precio → `—`. Nunca ramas de
  precio por marca en `harness.ts`. `knownCost` (`src/run/harness.ts:835`) solo entra si el adaptador no informa
  (`undefined`).
- Skill: un campo de `skills/*.yaml` llega al LLM solo si está en `SkillDef`, `validateSkill()`
  (`src/skills/registry.ts`) y `buildSections()` (`src/skills/targets/_shared.ts`, único renderer; su orden es
  contrato) y, si se crea por el dashboard, en `src/dashboard/prompts/curator.ts`. `validateSkill()` no rechaza
  campos desconocidos: el fallo es contenido muerto, no excepción.
- No correr `orchestos context update`: sobreescribe `AGENTS.md` con una plantilla. `CONTEXT.md` es derivado: las
  invariantes salen de este archivo y del código, nunca de él.
- Seguridad: `L62-001` (migración concurrente) y `L62-002` (provider key persistida antes de validar) siguen
  pendientes; no corregirlos fuera de un ítem (`docs/done/security/security-manual-review.md`).
