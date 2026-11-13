---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: etapa-2--uso-real
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

## Rumbo

Orden de Carlos (2026-11-12): *"comenzemos con los que realmente afectarían a OrchestOS su uso normal para comenzar a
probarlo yo mismo y darme cuenta de mis errores y luego corregir esos huecos de Windows y por último pasar todo a
Tauri"*. Motivo: meses sin feedback de uso; de los últimos 200 commits, 94 eran de CI, auditoría, gates o tests y 46
`feat`. Lo que no está en una etapa no se abre sin GO de Carlos.

- **Etapa 1 — Lo que rompe el uso normal:** AUD.14 → AUD.17 → AUD.16 → SES.1. Cerrada 2026-11-13.
- **Etapa 2 — Uso real (en curso):** Carlos trabaja en OrchestOS en vez de Orca. Cada fallo o hueco que encuentre se abre como
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

## Etapa 2 — Uso real

Lo que Carlos reporte usando OrchestOS se abre aquí con su evidencia y va primero. Cerrados de la etapa 1 y de
esta etapa: `docs/done/bloque-AUD.md` (AUD.16, AUD.17), `docs/done/bloque-SES.md`, `docs/done/bloque-USO.md`,
`docs/done/bloque-LRN.md`.

- [x] **USO.3 — Peticiones de sobra, modelos que no existen y borde del sidebar.** Gate en vivo: navegador contra el dashboard real, `docs/done/evidence/USO.3-live.json`: un cambio Chat→Dev bajó de ~40 a 28 llamadas `/api`; Dev quieto, de 20 a 4 en 20 s; los selectores ya no muestran `GPT-Reserve` ni el grupo `OLDER`; los bordes del sidebar y del inspector llegan hasta arriba. (reportado por Carlos 2026-11-13)
  Causas: `scripts/build-app.ts` no definía `NODE_ENV` y se servía React de desarrollo, cuyo StrictMode duplica cada
  carga; la línea de tiempo de Dev se pedía cada 1 s aunque estuviera quieta (ahora 5 s, 300 ms con turno en curso)
  y las tareas cada 1 s aunque ninguna corriera (ahora 5 s); nada se sondea con la pestaña oculta. Codex marca
  `gpt-reserve` con `visibility: "hide"` y el parser lo ignoraba; Claude sumaba un grupo `Older` y modelos del
  historial que Claude Code ya no ofrece (decisión de Carlos: una sola lista del catálogo). Tests en
  `chat-cli-models.test.ts`; `bun test src/dashboard` 737/737.
  Ejecutado por: claude-opus-5-5 (fix chico) · revisión qa: sin defectos
- [x] **USO.4 — Divisor bajo la barra superior en vez de bordes hasta arriba.** Gate en vivo: navegador contra el dashboard real, `docs/done/evidence/USO.4-live.json`. (pedido de Carlos 2026-11-13: los bordes hasta arriba de USO.3 se veían mal)
  `ShellHeader.tsx` lleva `border-b border-app`; se retira la prolongación con `--shell-aside-*` de USO.3.
  Ejecutado por: claude-opus-5-5 (fix chico)
- [ ] **LRN.1 — OrchestOS aprende de los errores.** (abierto 2026-11-13; GO de Carlos a D1–D6; va después de SES.1 y
  no bloquea el uso real) Diseño: `docs/specs/LRN-1-opinion-fable.md`. Decisiones: D1 alcance por proyecto, global
  solo por promoción manual; D2 tope 1.000 tokens o 15 lecciones; D3 proponer ante firma repetida ≥2, par
  fallo→arreglo o corrección explícita en chat; D4 graduación a `AGENTS.md` manual con diff; D5 60 días sin uso →
  `review`, nunca borrado; D6 primer lote F0+F1 (cimientos sin LLM + chat recibe y propone).
  Hechos: F0 (LRN.1a), F1 (LRN.1b), F3 (LRN.1c), en `docs/done/bloque-LRN.md`. Falta F2 (propuesta automática desde
  tareas), que espera datos de uso de F0.

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
  2026-11-13: confirmado por lectura que la terminal integrada no abre en Windows: usa `$SHELL`, `/bin/zsh` o
  `/bin/sh` como respaldo (`dashboard/terminal.ts:36-39`). La detección de CLIs debería funcionar: arma el PATH con
  `delimiter` y omite el login shell si no hay `$SHELL` (`run/executors/cli-discovery.ts:31-43`). La fase 1 la corre
  Carlos con Claude en su máquina Windows; al cerrar, un job `windows-latest` con `bun run test:coverage` en CI.

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
→ [cerrados de SES](docs/done/bloque-SES.md)
→ [cerrados de USO](docs/done/bloque-USO.md)
→ [cerrados de LRN](docs/done/bloque-LRN.md)
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
