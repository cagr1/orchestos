# Auditoría de cierre — 2026-11-10

Pedida por Carlos al entrar en fase de cierre. Análisis de Fable 5.2 sobre tres informes de agentes (código, `IDEAS.md`
y referencias, gates y desktop) más lectura directa. Lo verificado en código lleva `archivo:línea`; lo demás está
marcado. Ítems: `PLAN.md` § "Abiertos — auditoría 2026-11-10". Orden de ejecución: `NEXT.md`.

## Veredicto

El núcleo cumple la intención (varios LLM, resultado demostrable) y es más sólido de lo que `IDEAS.md` sugiere. La
verificación es más delgada que la promesa. Cerrar el producto es tapar esos huecos y recortar proceso, no sumar ideas.

## Fuerte

- Cadena completa chat → tarea → ejecutor en worktree → contrato → checks → revisor → merge, con fila de evidencia en
  cada fallo conocido (`src/run/harness.ts:441,490,543,615,900`).
- Fronteras que fallan cerradas: chat de solo lectura (`src/run/executors/external.ts:436-460,545`); motores que
  exigen worktree.
- Registro de CLIs abierto (`src/run/executors/cli-registry.ts:93-238`): sumar un LLM no toca tipos cerrados.
- Sin dependencias nativas: PTY y SQLite son de Bun (`src/dashboard/terminal.ts:58`, `src/db/sqlite.ts:1`).
- Presupuesto de salida derivado de ventana menos prompt (`harness.ts:322-351`).

## Débil

| Debilidad | Ítem |
|---|---|
| El merge commitea más de lo que el contrato vio | AUD.1 |
| Un nombre de archivo de este repo, tratado como especial en proyectos ajenos | AUD.2 |
| Excepción inesperada sin fila: se pierde "el porqué del fallo" | AUD.3 |
| El fallo es texto libre; la causa clasificada no se guarda por run | AUD.4 |
| Llamada LLM oculta tras cada tarea, mezclando proyectos | AUD.5 |
| Procesos nietos huérfanos (no verificado en vivo) | AUD.6 |
| Servidor local sin token; shell por WebSocket al alcance de cualquier proceso | AUD.7 |
| Código y endpoints sin uso | AUD.8 |
| Gates: señal mezclada con ruido de andamiaje y de modelos en vivo | AUD.9, CI.81 |
| `harness.ts` y `contract.ts` fuera de la mutación nocturna | AUD.10 |

Sin ítem, para decidir:

- **El "equipo" es ejecutor + revisor condicional.** Sin criterios de aceptación el QA se salta y la tarea queda
  `done` (`harness.ts:830-835`). Ver "Qué adoptar" → veredicto por spec.
- **Checks por defecto solo Bun/TS/JS** (`src/run/checks.ts:73-113`): en otro lenguaje casi no hay verificación.
- **Proceso mayor que producto.** Últimos 100 commits: ~25 % gates, ~30 % producto, resto docs. Todo lo abierto en
  `PLAN.md` antes de esta auditoría eran intermitentes de los propios gates. La nocturna tarda más de 5,5 h.

## Dirección por ítem (para escribir cada spec)

- **AUD.3** — el `catch` general inserta una fila con estado de fallo y el mensaje; `runId` nunca vacío.
- **AUD.4** — columna `failure_kind` en `runs`, poblada por `classifyCliFailure` más los tipos que el harness ya
  distingue (parseo, contrato, output faltante, check, QA, excepción). La UI de evidencia la muestra. `diagnose.ts`
  deja de clasificar con LLM lo que ya es determinista. Va después de AUD.3.
- **AUD.5** — quitar la llamada automática de `src/cli.ts:1303-1331`; queda como acción explícita y filtrada por
  proyecto.
- **AUD.6** — primero reproducir en vivo; si se confirma, matar el grupo como ya hace `src/mcp/readonly.ts:622`.
- **AUD.7** — token por proceso generado al arrancar, exigido en toda ruta `/api` y en el WebSocket, más chequeo de
  `Host`. Prerrequisito de desktop.
- **AUD.8** — borrar `agents/hardening.ts`, `db/backup.ts`, `db/retention.ts`; los endpoints sin interfaz se borran
  salvo los que alimenten una idea elegida abajo (`/api/runs/analyze` para #71, `/api/instincts/propose` para #72).
- **AUD.9** — separar los flujos deterministas (CLI falso) de los que dependen de un modelo en vivo; solo los
  primeros cuentan como gate. `ORCHESTOS_HOME` por `env` explícito (CI.81). Fijar la variable de `chat-timeout`.
- **AUD.10** — un shard nocturno para `harness.ts` + `contract.ts` + `worktree-diff.ts` + `sandbox.ts`; borrar las 7
  configs de Stryker que el workflow no ejecuta.

## `IDEAS.md`: qué entra al cierre

- **Entran** (después de AUD.1–AUD.7): #72 instinto fallo→pass, #71 vista de evals, #51 rewind, #45/#57 gasto real,
  #42 auto-repair (necesita AUD.4).
- **No entran**: #10 cliente MCP, #56 paralelo, #64 símbolos, #73 remoto, #8 dictado, #44 cascada automática, #30,
  #34, #26. #10, #56 y #44 contradicen decisiones cerradas de Carlos.
- **Ya resueltas u obsoletas**: #39 (salvo `promptInjectionMode`), #47, #29.

## Desktop: Tauri o Electron

Ninguno todavía. El trabajo previo es común y está sin hacer (lista verificada en `IDEAS.md` § #41, nota del
2026-11-10): seis re-lanzamientos con `process.execPath run <fuente>`, dashboard servido desde disco, `bun install` al
arrancar, caché sin hash, AUD.7.

Recomendación cuando toque: **Tauri**. Respeta el invariante de peso (`PLAN.md:41-45`) y el frontend no usa nada
exclusivo de Chromium (xterm con renderizador DOM, sin `showDirectoryPicker`). Costo: los gates solo corren en
Chromium (`scripts/ui-gate/run.mjs:222`); haría falta un subconjunto en WebKit. Electron solo si el repaso en Safari
muestra problemas reales. No verificado: `navigator.clipboard` y `color-mix` en WKWebView.

## ODD: qué adoptar

Fuente y resumen: `IDEAS.md`, corrección del 2026-11-10. ODD es método de trabajo; RDD es la capa de revisión.

- **En el producto**
  - *Veredicto por spec*: los criterios de una tarea son `S#` con las frases literales del usuario, y el revisor
    responde por cada uno. Cierra el hueco del QA que se salta.
  - *Candidato congelado*: se mergea el árbol que se verificó. Es AUD.1.
- **En el proceso** (decide Carlos; cambia `~/.agent-method`, no este repo)
  - Tamaño por reanudabilidad: lo que se retoma con el pedido + `git diff` no necesita ítem, spec ni ejecutor.
  - Un solo documento por trabajo grande, con el pedido literal; los ejecutores reciben la referencia, no una
    paráfrasis.
  - Choca con "el cerebro no toma el teclado". Recomendación: mantener esa regla para código y aplicar la de tamaño
    solo a docs, specs y plan.
- **No adoptar**: el binario `gentle-ai` ni Engram. El candado de escritor y los hooks ya hacen cumplir lo que ODD
  solo sugiere.

## Referencias

No hay clones locales de T3, Orca ni MonoCode; solo copias volátiles en `/tmp/ade-ref/`. `docs/sources-registry.yaml`
no registra T3 ni MonoCode, y MonoCode nunca se leyó como código. Si van a seguir siendo referencia, registrarlas con
SHA como las otras nueve.

## No verificado en esta auditoría

- Casi todo el front React, `chat.ts` completo, `codex-app-server.ts`, `mcp/server.ts`, `tests/`.
- `LIMITATIONS.md:7` ("Sequential only"): el dashboard lanza un proceso por tarea; no se descartó concurrencia.
- La causa de CI.81 es hipótesis: los logs de la corrida del 2026-11-09 ya estaban borrados.
- Nada se probó en vivo: no se levantó el dashboard.
