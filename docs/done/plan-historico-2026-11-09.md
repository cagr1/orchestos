# PLAN.md — rumbo y notas retiradas el 2026-11-09 (histórico)

> Histórico: texto de `PLAN.md` retirado en la limpieza del 2026-11-09. Todos los ítems que nombra están
> cerrados y archivados en `docs/done/bloque-*.md`. No es orden vigente.

## Rumbo — orden cerrado por Carlos (2026-09-22)

*"Terminar interfaz, luego producto mínimo para entrega y luego corregir"* lo que Opus detectó corriendo dentro de
OrchestOS. Una fase a la vez; lo que no está en una fase no se abre sin GO de Carlos. Restricción que manda en las
tres: harness liviano (ver abajo) — la respuesta dentro de OrchestOS tiene que sentirse igual que el CLI directo,
sin peso extra y con reglas claras.

### Fase 1 — Terminar la interfaz (plantilla React de AI Studio, regla UI.13) — CERRADA
Todos sus ítems están archivados en `docs/done/` (UI.13.x, UI.9.8/9.9, UI.10.A, CI.2; el selector nativo de nuevo proyecto lo cerró UI.15).

### Fase 2 — Producto mínimo para entrega (ruta ERP) — EN CURSO
**Decisión de Carlos 2026-10-05:** *"primero lo primero, que funcione"* — ERP.4 no se abría hasta que R.8 dijera, con
evidencia, que el recorrido funciona. Cerrados y archivados: AT.10, R.7, ERP.2, ERP.3, I.7, H.5.3, H.9.4. R.8.1–R.8.6
están cerrados (2026-10-05/12); R.8 queda abierto solo por la contrastación con una tarea real de Carlos, que cubre
ERP.4. El piloto de ERP.4 corrió completo el 2026-10-13 (etapas 1-6; ERP.4.1–ERP.4.13 cerrados).

**Orden vigente** (GO de Carlos 2026-10-13 a UI.24, UI.25 y UI.26; "UI.24 primero, ERP.4 al final", `NEXT.md`):
1. UI.26.5 → UI.26.6 → UI.26.7 (UI.26 absorbió UI.25.2–25.4; UI.25 y UI.26.1–26.4a cerrados 2026-10-13/14).
2. UI.24.4 → UI.24.5 → UI.24.6 (incluye ERP.4.14) → UI.24.7 (UI.24.1–24.3 cerrados 2026-10-13).
3. ~~ERP.4.15 → ERP.4.16 → limpiar `erp-piloto` → veredicto de ERP.4 → cierre de R.8~~ (cerrado 2026-10-15).
4. ~~UI.8.6 (permisos visibles: aprobar en el chat lo que el CLI va a hacer)~~ (cerrado 2026-10-16). Sigue Fase 3.

Fiabilidad abierta, sin orden fijo (se atiende cuando el pre-push la tumba): CI.11, CI.18, CI.19, CI.23, CI.25.
Documentación y código muerto: DOC.1 y LIMP.1 (GO de Carlos 2026-10-14).

### Fase 3 — Correr dentro de OrchestOS igual que el CLI directo
AT.13 (el contexto inyectado dice la verdad y no pesa) → AT.19 (lo que Claude notó dentro del chat; AT.19.1, AT.19.2) → AT.20 → AT.21 → CX.6 → ERP.6 (demostrar que no pesa) → ERP.5 (qué quitar) → ERP.7 (T3 Code) → H.7.2c → H.7.3 (aviso de contexto)
→ AT.11 (adaptadores genéricos).

### Fuera de las tres fases (no se abren sin GO)
H.10.2 (H.9.4 entró a la Fase 2 el 2026-10-05). Los 11 superados por UI.13/UI.14 se retiraron el 2026-09-22 (`docs/done/retirados.md`).

## Fase 1 — Terminar la interfaz

Cerrada. Todos sus ítems están archivados en `docs/done/` (ver "Cerrados — evidencia archivada" al final).

## Fase 2 — notas

**Mantenibilidad (observación transversal):** en la revisión, cli.ts tenía 2923 líneas,
harness.ts 1203 y chat.ts 1237. La concentración de responsabilidades merece atención, pero
el tamaño no demuestra un bug. Extraer únicamente responsabilidades necesarias para los ítems
anteriores, con pruebas de comportamiento; no abrir un refactor masivo por conteo de líneas.

**Decisiones pendientes de Carlos dentro de UI.8** (no las toma ningún LLM):
1. `agents` como tabla propia o proyección derivada (UI.8.2).
2. Estados de sesión `ended` con **resume/fork** (§C.3) — PI y Codex los tienen; OrchestOS no.
3. Si UI.8.6 entra en este bloque o sale como bloque propio con backend separado. — Decidido 2026-10-16: entra la aprobación por tarea; la de cada herramienta sale como bloque propio.

## Fase 3 — Correr dentro de OrchestOS igual que el CLI directo

**Después de iniciar:** AT.11 (registro extensible completo), migración visual de pantallas
secundarias, resume/fork avanzado, orquestación de flotas y mejoras de aprendizaje nocturno.
H.10.2 sigue abierto; no es condición de entrada si el piloto no usa ese proceso. UI.8.6 completo
puede entregarse después, pero el piloto debe mostrar permisos reales y los límites de H.9.4.
La corrida sobre carlosgallardo.dev citada en AT queda como smoke opcional, no criterio de éxito.
Revisión documental de esta ruta: preflight AT.10 válido; verificación por lectura, sin corrida
ERP ni prueba visual nueva. Los ítems permanecen abiertos hasta sus gates reales.

**AT.11 adelantado (GO de Carlos 2026-10-26):** "cualquier CLI" sin instalar nada ni escribir código por CLI. Hoy cada
motor es código a mano (`src/run/executors/task-engines.ts:37-51`) y el único PTY está fijo a `opencode`
(`src/dashboard/terminal.ts:19`). Modelo: capa común configurable (como Orca: cualquier CLI de terminal) + adaptadores
ricos por CLI solo para streaming/sesiones/cuotas (como T3 Code). Fuera: chat con CLI genérico (necesita streaming).

## Fuera de fase

**Fuera de scope declarado de H.9:** `opencode` (mismo criterio que H.8 — sin contrato
verificado); el sandbox de **escritura** de las tareas (worktrees ya lo cubren, es otro eje); la
frontera de red/SSRF (`src/dashboard/ssrf.ts` ya existe y no se toca); y cualquier cambio al
vault o a `~/.claude`/`~/.codex` de Carlos — el vault sigue alimentando el trabajo de desarrollo
igual que hoy, lo que se corta es que el **producto** lo herede por accidente.

### H.6 — Fuera de alcance de este bloque (anotado, no se toca)

- `src/cli.ts` tiene **2439 líneas y 63 edges** — god file evidente. Es lo segundo que critica
  un externo después del README, pero no es un hueco de harness. Va a `IDEAS.md` si Carlos lo
  aprueba; **no se refactoriza dentro del Bloque H**.
- Cobertura de líneas 62.91% y `src/skills/fetch.ts` en 0% de funciones. El trinquete ya sube
  solo; no abrir ítem salvo decisión explícita.
- Todo el gobierno del repo está en español con README en inglés. Decisión de producto, no
  defecto — no tocar sin que Carlos lo pida.

## Rumbo vigente del 2026-11-09 al 2026-11-12 (histórico)

Reemplazado el 2026-11-12 por el rumbo "uso normal → uso real → Windows → Tauri" de `PLAN.md`.

Orden de Carlos (2026-09-22): *"Terminar interfaz, luego producto mínimo para entrega y luego corregir"*. Lo que no
está en una fase no se abre sin GO de Carlos.

- **Fase 1 — Terminar la interfaz:** cerrada.
- **Fase 2 — Producto mínimo para entrega:** en curso. Sus bloques de producto están cerrados (el último, ADE, el
  2026-11-09); quedan abiertos solo los ítems de fiabilidad de abajo.
- **Fase 3 — Correr dentro de OrchestOS igual que el CLI directo:** todos sus ítems nombrados (AT.11, AT.13,
  AT.19–21, CX.6, ERP.5–7, H.7.2c, H.7.3) están cerrados.
- **Siguiente:** decide Carlos — otro bloque de producto o el mes de uso real.
- **Fuera de fase (2026-11-10):** la auditoría abrió AUD.1–AUD.10 (§ "Abiertos — auditoría"). Ninguno tiene fase ni
  prioridad: las asigna Carlos. Antes de esta nota, el Rumbo no los mencionaba.

Rumbo y notas anteriores: `docs/done/plan-historico-2026-11-09.md` (histórico).
