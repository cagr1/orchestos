# Bloque CX — evidencia de cierre

### CX — Contexto por ventana y consumo real (ABIERTO 2026-10-04)

> Origen: revisión con Carlos 2026-10-04. Dos temas separados. **Contexto** = cuánto ocupa la ventana del
> modelo, como en Claude Desktop, recalculado al cambiar de modelo (naranja/rojo, no un aviso). **Consumo** =
> uso real, acotado a OrchestOS: chat/tareas propios + tabs CLI en proyectos registrados (no todo el CLI como
> Orca). Plan aprobado por Carlos ("GO en ese orden"). Fuera: proyectos no registrados, OpenCode.

<a id="plan-orden-cx-1"></a>
- [x] **CX.1 — ⚡ `gate:evidence` exporta 0 runs de `ui:gate`.** (cerrado 2026-10-04) `scripts/ui-gate/run.mjs:16` crea su propio home
  y pisa el `ORCHESTOS_HOME` aislado del wrapper → exporta de una DB vacía (visto en I.7.2: "0 exported").
  Gate: `gate:evidence -- ui:gate <flujo>` exporta >0 runs de un flujo que ejecuta tareas.
  Ejecutado por: luna (2 rondas) · Spec: docs/specs/CX.1.md
  Dos causas: `run.mjs` pisaba el home del wrapper (ahora respeta `ORCHESTOS_GATE_EVIDENCE_HOME`; capturas en
  `runDir`), y el purge de cada flujo borraba sus runs antes del export (en modo evidencia se desligan antes del
  cleanup).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CX.1-live.json`; `auto-flow` 26/26 con
  `2 exported` (claude/haiku + codex/gpt-6-luna en la DB durable).

<a id="plan-orden-cx-2"></a>
- [x] **CX.2 — 🧠 El anillo de contexto mide el hilo activo y se recalcula al cambiar de modelo.** (cerrado 2026-10-04) Hoy
  `scripts/session-status.ts:176-195` toma el transcript más reciente del CLI en el proyecto (puede ser un tab
  de Claude Code ajeno al hilo). Debe usar el contexto acumulado del hilo (último turno, con caché) dividido
  por la ventana del modelo elegido en el selector; cambia en el acto al cambiar de modelo. Colores ya
  existentes (`ContextRing.tsx`: ≥60 naranja, ≥80 rojo). Gate en vivo con el dashboard real.
  Ejecutado por: luna (3 rondas) · Spec: docs/specs/CX.2.md
  Hecho: `GET /api/chat/sessions/:id/context?model=` (último turno: input + caché + output sobre la ventana del
  catálogo; `null` si no se conoce) y el composer avisa el modelo elegido. Ronda 2: ids con fecha
  (`claude-haiku-4-5-20251001`) y modelos decorados (`… via Codex CLI (effort: …)`) no resolvían ventana. Ronda 3:
  el gate comparaba contra el endpoint sin `?model=` y dejaba el modelo alternativo puesto.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CX.2-live.json`; `chat-streaming` 17/17 (anillo
  7,263/200,000 = 3.63% en Haiku → 0.73% al elegir Sonnet 5 sin enviar, y vuelve), `codex-live` 14/14;
  `test:coverage` 1621/0.

<a id="plan-orden-cx-3"></a>
- [x] **CX.3 — ⚡ Hook de Claude Code: solo % de ventana.** (cerrado 2026-10-04) Quitar el tope absoluto AT.5
  (`scripts/context-budget.ts:45`, 60k/90k, dispara con el arranque de 57k) y el nivel `block`; el texto dice la
  causa. Gate: tests del hook + corrida sobre un transcript real.
  Ejecutado por: luna · Spec: docs/specs/CX.3.md
  Hecho: fuera `ABSOLUTE_BUDGET_THRESHOLDS`/`absoluteLevel`; el aviso dice `<pct> de la ventana de <modelo>
  (<used> / <window> tokens)`. Verificado sobre el transcript real de esta sesión: 214,777 / 1,000,000 (21.5%),
  `level: ok`, hook sin salida. `test:coverage` 1617/0.

<a id="plan-orden-cx-4"></a>
- [x] **CX.4 — 🧠 Los runs guardan tokens reales.** (cerrado 2026-10-04) Columnas de caché (lectura/escritura) con migración;
  `external.ts:444,534` y `codex.ts:236` dejan de descartarlas; costo de Codex con precio de caché del catálogo;
  `elapsed_ms` del chat deja de ser 0. Gate: run real de Claude y Codex con caché > 0 en la DB.
  Ejecutado por: luna · Spec: docs/specs/CX.4.md
  Hecho: migración 20 (`cache_read_tokens`/`cache_write_tokens`); semántica común input no cacheado + caché
  aparte; Codex resta `cached_input_tokens` y cobra caché con `knownCostWithCache` (precio de caché del catálogo
  OpenRouter, si no `priceIn`); `elapsed_ms` real en el chat; `/api/usage` devuelve las sumas de caché.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CX.4-live.json`; `auto-flow` 26/26 exportado:
  claude/haiku input 4,697 + caché 31,516/10,928, 13.4 s; codex/gpt-6-luna input 23,841 + caché 64,512, 23.0 s.
  `chat-streaming` 15/15, `codex-live` 14/14; `test:coverage` 1620/0. No visto en DB: los runs de chat (el purge
  de los flujos los borra); lo cubren tests y el anillo de CX.2.

<a id="plan-orden-cx-5"></a>
- [x] **CX.5 — 🧠 Consumo de proyectos registrados.** (cerrado 2026-10-04) La pantalla de uso suma transcripts de Claude Code/Codex
  cuyo cwd es un proyecto registrado (costo por catálogo, con caché) + runs de API de la tabla `runs`, sin
  contar dos veces los runs CLI; separa "chat/tareas de OrchestOS" de "tabs CLI". Gate en vivo.
  Ejecutado por: luna (3 rondas) · Spec: docs/specs/CX.5.md
  Hecho: migración 21 `runs.cli_session_id` (session_id de Claude, thread_id de Codex) para no contar dos veces;
  `src/usage/cli-transcripts.ts` lee Claude (dedupe por `message.id`, escritura de caché 1 h aparte) y Codex (último
  `total_token_usage`, caché restada) de los proyectos registrados, incluidos sus worktrees ya borrados.
  Rondas 2-3, medidas en vivo: el catálogo en disco sin precios de caché cobraba la caché unas 20 veces más cara
  ($7,752); las sesiones de Codex viven en `CODEX_HOME` de Orca, no en `~/.codex`; sin API key el catálogo no se
  bajaba (el endpoint de OpenRouter es público) y todo salía sin precio.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CX.5-live.json`; Settings → Usage en el dashboard
  real: OrchestOS $3.88 · tabs CLI $1,131 (2.83B tokens, 349 sesiones); `test:coverage` 1626/0.
  Pendiente menor: la fila `<synthetic>` (0 tokens) se muestra; "Avg cost / run" mezcla runs y sesiones.

---
