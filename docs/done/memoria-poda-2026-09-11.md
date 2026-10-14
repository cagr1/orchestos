# Propuesta de poda de MEMORY.md — 2026-09-11

Estado: **PROPUESTA, NADA APLICADO.** Requiere GO explícito de Carlos por cubo.

## Por qué

`startup-guard` disparó este arranque: 10,159 tokens est. vs. límite 9,000
(`.claude/hooks/startup-guard.js:24`). Desglose: `~/.claude/CLAUDE.md`=3,677,
`CLAUDE.md` del repo=2,208, `MEMORY.md`=4,274.

## El dato que define el diseño

Los 468K de la carpeta de memoria **no cuestan contexto**. Los archivos individuales solo
entran por recall cuando son relevantes. Lo que se carga en cada sesión es el índice
`MEMORY.md`: 99 líneas ≈ 4,274 tokens.

Corolario duro: **quitar una línea del índice = apagar esa memoria**, aunque el archivo siga
en disco. Prueba viva: `project-engine-external-plan.md` existe pero nunca estuvo en el
índice — invisible desde siempre. Podar sin criterio desactiva reglas en silencio, el mismo
patrón que la Regla cero de `CLAUDE.md` condena (hook desincronizado 11 días).

Matiz verificado: 41 memorias están citadas por wikilink `[[slug]]` desde `PLAN.md` y `docs/`.
Sacarlas del índice **no** rompe esos enlaces (apuntan al archivo, que se conserva); solo apaga
el recall automático.

## Arquitectura propuesta: tres niveles, no dos

| Nivel | Qué contiene | Costo por sesión |
|---|---|---|
| `MEMORY.md` (cargado) | Solo reglas de comportamiento vivas que **ningún mecanismo hace cumplir** | ~1,400 tok |
| `REFERENCE.md` (NO cargado) | Gotchas técnicos: importan al tocar ese código, no al arrancar | 0 |
| `archive/` (NO cargado) | Caducadas y duplicadas | 0 |

La razón de separar `REFERENCE.md` en vez de archivarlo: un gotcha de `dns.resolve4` no sirve
al arrancar la sesión, sirve cuando alguien toca SSRF. Se consulta con grep sobre ese archivo,
y casi todos ya tienen diente mecánico (CI, tests, hooks) que atrapa el error igual.

---

## CUBO B — ya vive en un CLAUDE.md que se carga igual (doble pago)

Sale del índice. La regla **sigue aplicándose** porque el `CLAUDE.md` se carga en cada sesión.

| Memoria | Dónde ya está |
|---|---|
| feedback-idioma-espejo | `~/.claude/CLAUDE.md:83` + hook `UserPromptSubmit` que lo inyecta cada turno |
| feedback-git-config | repo `CLAUDE.md:30` § Identidad git — PROHIBIDO |
| feedback-push-automatico | repo `CLAUDE.md:65` |
| feedback-no-compactar-contexto | `~/.claude/CLAUDE.md:196` § Costo de contexto, punto 4 |
| feedback-limite-contexto-70 | `~/.claude/CLAUDE.md:196` (mismo punto) |
| feedback-avisar-contexto-antes-no-despues | `~/.claude/CLAUDE.md:196` (mismo punto) |
| feedback-planificar-cambios-grandes | repo `CLAUDE.md:100` § Planificar antes de cambios grandes |
| feedback-respuestas-breves-detalle-en-planmd | `~/.claude/CLAUDE.md:91` § Concisión + output style |
| feedback-nunca-xhigh-ni-max | `~/.claude/CLAUDE.md:172-189` § Nivel de esfuerzo por rol |
| feedback-config-alcance-global | `~/.claude/CLAUDE.md:56` § Alcance de config |
| feedback-cerebro-piensa-planifica-delega | `~/.claude/CLAUDE.md:139` § Reparto de modelos |
| feedback-cuidar-cupo-claude-delegar-codex | `~/.claude/CLAUDE.md:139` § Reparto de modelos |
| codex-delegation-workflow | `~/.claude/CLAUDE.md:139` § Reparto de modelos |
| feedback-codex-escribe-el-gate | `~/.claude/CLAUDE.md:139` § Reparto de modelos |
| reference-roster-cerebro-ejecutores | `~/.claude/CLAUDE.md:157-163` (Opus conduce, Astra techo) |
| feedback-plugins-mcp-por-proyecto | `~/.claude/CLAUDE.md:56` § Alcance (lo nombra explícito) |
| reference-context-cost-measurement | `~/.claude/CLAUDE.md:205` (fórmula literal) |
| reference-concise-output-style-no-builtin | `~/.claude/CLAUDE.md:91` (lo dice textual) |
| reference-conectores-cuenta-no-son-mcp-proyecto | repo `CLAUDE.md:114-145` § Higiene de contexto |
| feedback-avisar-arranque-pesado | repo `CLAUDE.md:142` + hook `startup-guard.js` (EXISTE) |
| reference-ci-host-environment-drift | repo `CLAUDE.md:90-112` § Verificar contra CI (con ToolchainProbe) |
| feedback-verificar-gates-en-vivo | repo `CLAUDE.md:40` § Regla cero — la nombra por slug |
| feedback-dashboard-no-solo-cli | repo `CLAUDE.md:40` § Regla cero — la nombra por slug |
| workflow-rules | `~/.claude/CLAUDE.md:91` + convención de delegación :227 |
| no-repeat-in-chat | output style Concise, regla 7 "Referencia, no repitas" |
| project-state | **hook `session-resume.js`** ya inyecta `bun run next` en cada SessionStart |

**26 entradas.** `project-state` es el caso más limpio: el hook imprime el estado del plan al
arrancar, así que la memoria pagaba por el mismo dato dos veces y encima se desactualiza.

---

## CUBO C — caducadas / muertas → `archive/`

| Memoria | Evidencia |
|---|---|
| feedback-mes18-gate-evidencia-b1b | El propio texto dice "RESUELTO 2026-07-09" |
| project-codex-subscription-window | Ventana venció 2026-08-22 |
| project-machine-migration | Evento del 2026-06-29, ya ocurrido |
| project-engine-external-plan | Huérfano (nunca en el índice) + superado por E.16 |
| project-cc-d-agent-consolidation | Archivado en `docs/done/sprint-29.md` (`PLAN.md:1447`) |
| project-skills-auto-activation | N-AUTO descartado; "Bloque O" ya no existe en `PLAN.md` |
| project-improver-and-4-states-candidate | Investigado y NO implementado 2026-07-16 |
| feedback-mes18-* / project-real-timeline | (timeline: ver nota abajo) |

**7 entradas** (`project-real-timeline` NO se archiva — ver cubo D).

---

## CUBO R — gotchas técnicos → `REFERENCE.md` (fuera del arranque)

Todos verificados como código vivo hoy. Salen del índice cargado; se consultan por grep al
tocar el área. Los marcados con diente ya fallan solos si alguien los viola.

| Memoria | Área | Diente que ya lo atrapa |
|---|---|---|
| reference-bun-mock-module-gotcha | tests | suite |
| reference-dns-resolve-gotcha | `src/dashboard/ssrf.ts` | — |
| reference-test-fixtures-leak-into-real-db | tests | — (recurrente, ver nota) |
| reference-tests-depend-on-migrated-db | tests | `scripts/test-preload.ts` |
| reference-model-catalog-cache-path-gotcha | `src/router/model-catalog.ts` | — |
| reference-model-combo-pattern | dashboard | — |
| reference-skill-contract-wiring | `src/skills/` | — |
| reference-git-lock-worktree-pattern | `src/run/git-lock.ts` | — |
| reference-sandbox-exec-y-bun-test-ruta | tests | — |
| reference-biome-warnings-no-son-rojo | lint | CI |
| reference-ci-lint-no-esta-en-hooks | lint | CI |
| reference-settings-json-requires-restart | config | — |
| reference-macos-documents-tcc-block | SO | — |
| reference-csharp-dotnet-readiness | `src/run/checks.ts` | — |
| reference-codex-exec-exit-0-con-error | Codex | — |
| reference-codex-modelo-real-rollout | Codex | `scripts/adversarial-review.ts` |
| reference-codex-sandbox-orchestos-db | Codex | `AGENTS.md` |
| reference-codex-model-aliases | Codex | — |
| reference-claude-cli-flags | CLI | — |
| reference-cerrar-item-plan-procedencia | PLAN.md | `scripts/plan-gate.ts` |
| reference-verificar-contra-la-fuente | gates | `scripts/plan-status.ts` |
| reference-orca-rate-limit-no-contexto | statusline | — |
| reference-design-system-orchestos | dashboard React | — |
| reference-react-islands-vanilla-dashboard | dashboard React | — |
| reference-migrar-pantalla-react-orchestos | dashboard React | — |
| reference-tailwind-sin-preflight-orchestos | dashboard React | — |
| reference-3d-animation-skills-conditional | skills | — |
| reference-agent-orchestrator-ui-inspiracion | UI (para I.5) | — |
| reference-external-repos | investigación (25KB) | — |
| reference-omniroute-cascade-pattern | investigación | — |
| project-obsidian-vault | vault | hook knowledge-radar |
| project-dreaming-setup | dreaming | scheduled task 2am |
| project-mintlify-docs | docs | — |
| project-codex-colaborador | contexto | — |
| project-auditor-corridas-pendiente | pendiente 2026-09-18 | — |
| project-dogfooding-clonar-carlosgallardo-dev | pendiente tras H.8.3 | — |

**36 entradas.**

RIESGO CERRADO el mismo día (commit `f827631`), a pedido de Carlos: en vez de devolver
`reference-test-fixtures-leak-into-real-db` al índice, se le dio el diente que nunca tuvo.
`scripts/test-preload.ts` aísla la DB de la suite en un home temporal y
`scripts/db-isolation.test.ts` pone CI en rojo si alguien rompe el aislamiento. Queda vigente
que los **gates en vivo** sí escriben en la DB real: eso es por diseño y no lo cubre el fix.

---

## CUBO D — se quedan en `MEMORY.md` (~30 líneas, ~1,400 tok)

Reglas de comportamiento vivas, sin duplicado y sin diente mecánico. Si se apagan, se rompe algo.

- feedback-modelo-decision-final-carlos — NO NEGOCIABLE, incidente de $5
- feedback-no-reinventar-ui-usar-libreria — decisión cerrada, evita reproponer vanilla
- feedback-serial-por-decision-no-costumbre — evita reproponer paralelismo ya descartado
- feedback-tasks-solo-por-chat — dicho 3 veces
- feedback-home-siempre-chat — se rompió 2 veces
- feedback-siempre-cerrar-servidor
- feedback-acabados-elegantes-siempre
- feedback-avisar-antes-de-crear-estado
- feedback-arreglar-los-hermanos-del-bug
- feedback-verificar-progreso-delegado + feedback-delegar-verificacion-no-reejecutar (fusionar en 1 línea)
- feedback-guardian-del-orden
- feedback-orden-desarrollo — 4 acciones al cerrar Mes
- feedback-ideas-plan-done-flow
- feedback-delegacion-scope-commits — scope-lock
- feedback-marcar-plan-al-cerrar
- feedback-revisor-adversarial-cruzado
- feedback-investigar-antes-de-refutar
- feedback-trabajo-en-equipo-sin-microgestion
- feedback-no-verificar-llm-confiable-mecanico
- feedback-codex-sesiones-paralelas-no-preguntar
- feedback-codex-no-en-paralelo-con-claude
- feedback-context-no-max-tokens
- feedback-skill-autoselect-tiebreak
- feedback-subir-al-repo-significa-push
- feedback-reiniciar-dashboard-tras-cambio
- feedback-ui-toprow-alignment-rules
- feedback-no-restriccion-por-identidad-agente
- feedback-deteccion-generica-no-por-cli
- feedback-deteccion-no-decision-automatica — citada en `PLAN.md:842`
- project-real-timeline — "Mes N" ≠ mes calendario; evita malinterpretar fechas del plan

**30 entradas**, reescritas a una línea más corta cada una.

---

## Números

| | Antes | Después |
|---|---|---|
| Líneas en el índice | 99 | 30 |
| `MEMORY.md` | 4,274 tok | ~1,400 tok |
| Arranque total | 10,159 tok | **~7,300 tok** (bajo el umbral de 9,000) |

Ningún archivo se borra. Todo es reversible con un `mv`.

## Lo que NO hace esta propuesta

- No toca los dos `CLAUDE.md`.
- No borra archivos.
- No baja el umbral del guard.
