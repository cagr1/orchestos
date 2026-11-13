---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: etapa-1--uso-normal
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

## Rumbo

Orden de Carlos (2026-11-12): *"comenzemos con los que realmente afectarían a OrchestOS su uso normal para comenzar a
probarlo yo mismo y darme cuenta de mis errores y luego corregir esos huecos de Windows y por último pasar todo a
Tauri"*. Motivo: meses sin feedback de uso; de los últimos 200 commits, 94 eran de CI, auditoría, gates o tests y 46
`feat`. Lo que no está en una etapa no se abre sin GO de Carlos.

- **Etapa 1 — Lo que rompe el uso normal:** AUD.14 → AUD.17 → AUD.16 → SES.1 (§ "Etapa 1"). En curso.
- **Etapa 2 — Uso real:** Carlos trabaja en OrchestOS en vez de Orca. Cada fallo o hueco que encuentre se abre como
  ítem con su evidencia y va antes que cualquier pendiente. Los huecos de la interfaz salen de ese uso, no de revisar
  pantallas.
- **Etapa 3 — Windows:** WIN.1 (§ "Etapa 3"). Primero la prueba de humo; después un ítem por fallo.
- **Etapa 4 — Tauri:** empaquetar como app de escritorio. Decidido Tauri y no Electron (Carlos, 2026-11-12: "pasar
  todo a Tauri"). Hoy vive en `IDEAS.md` #41 con sus prerrequisitos; se gradúa a este plan al abrir la etapa.
- **La auditoría no se reabre:** un ítem AUD o CI nuevo entra solo si sale de un fallo visto usando OrchestOS o deja el
  CI rojo. Lo que no rompe el uso normal quedó aparcado (§ "Aparcados").

Rumbos anteriores (histórico): "Terminar interfaz, luego producto mínimo para entrega y luego corregir" (Carlos,
2026-09-22), con sus Fases 1 a 3 cerradas y el lote de auditoría AUD.1–AUD.28 fuera de fase (2026-11-10), en
`docs/done/plan-historico-2026-11-09.md`.

## Restricción de producto: harness liviano — decisión de Carlos (2026-09-17)

**Pedido textual:** *"quiero un harness o orquestador light sin ahogar el trabajo de los agentes
cerebro"*. Origen: usando Orca, Carlos observa que consume ~2 GB de RAM y concluye que OrchestOS
no debe ir por ahí.

**Medición del 2026-09-17, no estimación** (`ps -o rss=`, ambos corriendo en la misma máquina):

| Proceso | RSS |
| --- | --- |
| OrchestOS (`bun run src/cli.ts dashboard`) | **121 MB** |
| Orca (suma de sus procesos, en ese momento) | **1,270 MB** |

OrchestOS ya es ~10× más liviano. **Eso deja de ser una casualidad y pasa a ser un invariante que
se defiende:** toda propuesta que agregue un runtime residente (swarms, memoria vectorial, índice
persistente, servidor extra) declara su costo en RAM antes de entrar, y se compara contra estos
121 MB. Es el mismo criterio con el que `IDEAS.md#64` deja a Serena MCP condicionada a medición
antes/después en vez de adoptarla por fe.

**"Sin ahogar al cerebro" es la otra mitad y limita lo anterior:** liviano no puede significar
recortarle contexto, herramientas o criterio al modelo que piensa. El ahorro sale de *dónde corre
el trabajo* (delegar al ejecutor, que gasta su propio contexto y su propio cupo — medido: 145,664
tokens de Luna que nunca entraron en el contexto del cerebro), no de podar al cerebro.

## Etapa 1 — lo que rompe el uso normal

En este orden. AUD.14, AUD.17 y AUD.16 salieron de la revisión de validadores del 2026-11-11 (lectura de un
subagente, sin informe aparte): cada cita se comprueba con grep al escribir el spec. Cada uno migra sus parseos a
`src/boundary` y baja `scripts/boundary-budget.json`.

- [x] **AUD.17 — Bodies y archivos con tipo incorrecto dan 500 en vez de 400; `.env` admite saltos de línea.**
  (abierto 2026-11-11, cerrado 2026-11-13) `POST /api/settings` (`src/dashboard/handlers/setup.ts:172-186` → `settings-store.ts:62-66`)
  escribe `"x\nOPENROUTER_API_KEY=…"` como línea nueva en `~/.orchestos/.env`. Resto: casts `as T` en `tasks.ts:276-295`,
  `instincts.ts:58-62,84-88,117`, `specs.ts:12-16`, `chat.ts:142-145,253,876`; body `null` en `run-graph.ts:75`,
  `system.ts:8`, `skills.ts:217`; `package.json.name` no string (`src/detect/manifest.ts:20`); línea JSON-RPC `null`
  (`src/mcp/server.ts:125,232`, `codex-app-server.ts:173-177`); precios de OpenRouter sin rango
  (`src/router/model-catalog.ts:166-172`).
  Cierre: bodies de settings, tasks (create/run/commit-run/bulk-delete), instincts, specs, chat, run-graph,
  system/reset y skills delete pasan por `readBody` con schema → 400 con causa; se conservan los mensajes 400
  previos. Settings rechaza valores con `\r`/`\n` y `writeEnv` también (defensa). `manifest.ts` acepta solo `name`
  texto; MCP responde `-32600` a mensajes no-objeto; codex-app-server trata `null` como respuesta inválida; precios
  negativos de OpenRouter = desconocido. `boundary-budget` 58/59 → 55/43.
  Gates: tsc, lint, test:coverage 2854/0; diff leído entero por el cerebro (otro proveedor).
  Gate en vivo: navegador Playwright, `settings-shell` 24/24 con HOME temporal, `docs/done/evidence/AUD.17-settings-shell.json`.
  Paso nuevo: key con salto de línea → 400 y keys intactas, key válida se guarda, tarea con `description: 5` → 400.
  Además `curl` contra el dashboard real, `docs/done/evidence/AUD.17-live.json` (`.env` intacto).
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/AUD.17.md

- [ ] **AUD.16 — Skills: `validateSkill` devuelve el objeto crudo y el id de la URL no se cruza con el del contenido.**
  (abierto 2026-11-11) `src/skills/registry.ts:138-226` (`when_to_use: "x"` → `.map is not a function` en
  `src/skills/targets/_shared.ts:15`, rompe el prompt de QA); `src/dashboard/handlers/skills.ts:160-186`, `:593-622`;
  índice del registry casteado en `src/skills/fetch.ts:47-48,73`; el import ignora `review.status: rejected`.

- [ ] **SES.1 — Cerrar una sesión de verdad.** (abierto 2026-11-12; Carlos: va justo después del lote AUD) La X del
  tab (`App.tsx:172`, `closeDevTab`) solo quita el tab de la UI: la sesión sigue activa y su turno corriendo. Archivar
  (`handlers/chat-sessions.ts:551`, `handleApiChatSessionArchive`) marca `archived` sin detener el turno en curso: el
  CLI queda vivo y la sesión desaparece del sidebar. Borrar ya rechaza con turno activo (409). Diseño (patrón de
  JetBrains "Terminate / Disconnect", VS Code `confirmOnKill`, tmux detach/kill): **tab = vista, sesión = proceso**.
  (1) Cerrar un tab ocioso: se cierra sin preguntar. (2) Cerrar un tab con turno en curso: diálogo "Detener y cerrar"
  / "Dejar corriendo" / "Cancelar", con "recordar" en Settings. (3) Sesiones en segundo plano: punto de "corriendo"
  en el sidebar y contador en la barra; al terminar, aviso. (4) Archivar = detener turno (`stopChatTurn`, grupo de
  procesos completo vía AUD.6) + archivar, nunca sin detener. (5) Cerrar la app o el dashboard con turnos vivos:
  aviso con la lista. (6) Al arrancar, turnos huérfanos (proceso muerto, turno `pending`) se marcan y se ofrecen
  reanudar. Verificación: test que archiva con turno en curso y comprueba que no queda proceso; test del diálogo
  por estado del tab; prueba en vivo en el dashboard de los tres caminos (ocioso, detener, dejar corriendo).

## Etapa 3 — Windows

- [ ] **WIN.1 — Prueba de humo en Windows: instalar, arrancar el dashboard, un turno de chat y una tarea.**
  (abierto 2026-11-12; Carlos: "no sé si funcione en Windows") Nunca se corrió en Windows: los 5 workflows de
  `.github/workflows/` usan `ubuntu-latest` y el desarrollo es en macOS. Sospechas por grep del 2026-11-12, sin probar:
  en `src/` (sin tests ni la app) solo `dashboard/handlers/projects.ts:142,164` consulta `process.platform`, y 16
  archivos usan construcciones POSIX (grupos de procesos, `SIGKILL`, modos de archivo, shell, `/dev/null`, `which`),
  entre ellos `run/process-tree.ts`, `dashboard/terminal.ts`, `dashboard/auth-token.ts`, `dashboard/settings-store.ts`,
  `run/sandbox.ts`, `mcp/readonly.ts` y los ejecutores `codex-app-server.ts`, `generic-cli.ts`, `opencode-server.ts`.
  Fase 1: en un Windows real (o `windows-latest`) instalar, correr `orchestos dashboard`, enviar un turno de chat con
  un CLI y correr una tarea; guardar la salida de cada paso que falle. Fase 2: un ítem `WIN.n` por fallo, primero lo
  que impide arrancar. Nada se arregla a ciegas antes de la fase 1. Si lo roto es mucho, publicar "macOS/Linux;
  Windows experimental" lo decide Carlos.

## Decisiones pendientes de Carlos

- Estados de sesión `ended` con **resume/fork** (§C.3) — PI y Codex los tienen; OrchestOS no (anotado en UI.8;
  sin verificar si sigue vigente).
---

## Aparcados

→ [12 ítems fuera del plan desde el 2026-11-12: CI.19, CI.54, CI.55, CI.57, CI.69, CI.76, CI.81, AUD.8, AUD.9,
AUD.10, AUD.27, AUD.28](docs/done/aparcados-2026-11-12.md)

## Retirados

→ [11 ítems superados por UI.13/UI.14, retirados 2026-09-22](docs/done/retirados.md)

## Cerrados — evidencia archivada

→ [cerrados de AT](docs/done/bloque-AT.md)
→ [cerrados de DOC](docs/done/bloque-DOC.md)
→ [cerrados de H](docs/done/bloque-H.md)
→ [cerrados de I](docs/done/bloque-I.md)
→ [cerrados de R](docs/done/bloque-R.md)
→ [cerrados de S](docs/done/bloque-S.md)
→ [cerrados de ERP](docs/done/bloque-ERP.md)
→ [cerrados de CI](docs/done/bloque-CI.md)
→ [cerrados de CX](docs/done/bloque-CX.md)
→ [cerrados de MR](docs/done/bloque-MR.md)
→ [cerrados de GOV](docs/done/bloque-GOV.md)
→ [cerrados de UI](docs/done/bloque-UI.md)
→ [cerrados de CTX-GUARD](docs/done/bloque-CTX-GUARD.md)
→ [cerrados de SEC](docs/done/bloque-SEC.md)
→ [cerrados de OC](docs/done/bloque-OC.md)
→ [cerrados de ADE](docs/done/bloque-ADE.md)
→ [cerrados de AUD](docs/done/bloque-AUD.md)
→ [cerrados de DEV](docs/done/bloque-DEV.md)
→ [cerrados de ONB](docs/done/bloque-ONB.md)
→ [cerrados de RUN](docs/done/bloque-RUN.md)
→ [cerrados de UI / Sprint 30](docs/done/sprint-30.md)
→ [cerrados de Sprint 1](docs/done/sprint-01.md)
→ [cerrados de Sprint 2](docs/done/sprint-02.md)
→ [cerrados de Sprint 3](docs/done/sprint-03.md)
→ [cerrados de Sprint 4](docs/done/sprint-04.md)
→ [cerrados de Sprint 5](docs/done/sprint-05.md)
→ [cerrados de Sprint 6](docs/done/sprint-06.md)
→ [cerrados de Sprint 7](docs/done/sprint-07.md)
→ [cerrados de Sprint 8](docs/done/sprint-08.md)
→ [cerrados de Sprint 9](docs/done/sprint-09.md)
→ [cerrados de Sprint 10](docs/done/sprint-10.md)
→ [cerrados de Sprint 11](docs/done/sprint-11.md)
→ [cerrados de Sprint 12](docs/done/sprint-12.md)
→ [cerrados de Sprint 13](docs/done/sprint-13.md)
→ [cerrados de Sprint 14](docs/done/sprint-14.md)
→ [cerrados de Sprint 15](docs/done/sprint-15.md)
→ [cerrados de Sprint 16](docs/done/sprint-16.md)
→ [cerrados de Sprint 17](docs/done/sprint-17.md)
→ [cerrados de Sprint 18](docs/done/sprint-18.md)
→ [cerrados de Sprint 19](docs/done/sprint-19.md)
→ [cerrados de Sprint 20](docs/done/sprint-20.md)
→ [cerrados de Sprint 21](docs/done/sprint-21.md)
→ [cerrados de Sprint 22](docs/done/sprint-22.md)
→ [cerrados de Sprint 23](docs/done/sprint-23.md)
→ [cerrados de Sprint 24](docs/done/sprint-24.md)
→ [cerrados de Sprint 25](docs/done/sprint-25.md)
→ [cerrados de Sprint 26](docs/done/sprint-26.md)
→ [cerrados de Sprint 27](docs/done/sprint-27.md)
→ [cerrados de Sprint 28](docs/done/sprint-28.md)
→ [cerrados de Sprint 29](docs/done/sprint-29.md)
→ [cerrados de SET](docs/done/bloque-SET.md)
→ [cerrados de TRUST](docs/done/bloque-TRUST.md)
→ [cerrados de CHAT](docs/done/bloque-CHAT.md)
→ [cerrados de SKILLS](docs/done/bloque-SKILLS.md)
→ [cerrados de CFG](docs/done/bloque-CFG.md)
→ [cerrados de TCLI](docs/done/bloque-TCLI.md)
→ [decisiones de Carlos](docs/done/decisiones.md#entregable-rapido) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#ruta-erp) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#i-0-el-orden) — Fase 1
→ [decisiones de Carlos](docs/done/decisiones.md#sprint-30-decision) — Fase 1
