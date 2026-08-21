---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-29-abierto--orquestador-real--cc0-auditoria-en-curso
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.

**Delegación — NO es una leyenda, son muros dirigidos a ti, el que ejecuta (endurecido 2026-07-15):**
- 🧠 = **Claude implementa** — requiere criterio arquitectural o decisión de diseño.
- ⚡ = **DeepSeek implementa** — tarea bien especificada. **Si eres Claude: NO la implementas, NO la
  adelantas porque sea trivial o esté adyacente a lo tuyo, NO te ofreces a hacerla.** Si un ⚡ está
  sin cerrar y bloquea tu 🔍, **PARA y repórtalo** — no lo absorbas.
- 🔍 = **revisión/gate obligatorio por Claude** — independiente de quién implementó.

**Regla de alcance (scope-lock, 2026-07-15):** ejecuta **EXACTAMENTE** el/los ítem(s) que el usuario
nombró — nada adyacente, ni el prerequisito, ni el siguiente, sin instrucción explícita. Si el ítem
nombrado tiene un prerequisito sin cerrar, **PARA y avísalo**; no lo hagas en silencio. Motivo real
(2026-07-15): con "continua con A.4" un LLM tocó A.3 (⚡, ajeno) y se ofreció a hacer A.5 (⚡, ajeno).

**Regla de commits (cadencia, 2026-07-15):** cada ítem cerrado (`[x]`) se commitea **en el mismo
turno** en que se cierra. Tras 2-3 commits locales, `git push origin master` **automáticamente**
(autorización permanente en CLAUDE.md) — **NO pidas permiso por lo ya autorizado, NO acumules** una
pila de cambios sin commitear. `--force` sigue requiriendo pedido explícito.

**Regla de documentación obligatoria (2026-07-02):** todo hallazgo — bug real, deuda técnica, feature huérfana, contradicción entre `tasks.yaml`/DONE.md y el código real — se convierte en un ítem de este archivo (o de IDEAS.md si es backlog no inmediato) ANTES de tocar código. Si no está escrito acá, no se corrige. Motivo: una auditoría completa (2026-07-02) encontró deuda documentada en prosa dentro de DONE.md ("anotado como deuda conocida") que nunca se tradujo a un ítem accionable y por eso nadie la persiguió durante 3 meses (ver Bloque F0).

**Regla de flujo IDEAS→PLAN→DONE (decisión Carlos, 2026-07-02):** cuando una idea pasa de IDEAS.md a PLAN.md (se convierte en el eje o en un bloque de un Mes), **se ELIMINA de IDEAS.md en el mismo commit** — no queda duplicada en ambos. La evidencia de que se realizó vive siempre en DONE.md (documentación extensa al cierre del Mes). IDEAS.md es solo backlog vivo: lo que está ahí es porque NADIE lo está haciendo todavía.

---

## MES 30 — Dejar de reinventar la UI: React + Tailwind + shadcn/ui (ABIERTO 2026-08-21)

> **Mes 29 cerrado (2026-08-21)** — ver resumen y link a DONE.md más abajo. Este bloque queda
> abierto: puede arrancar `UI.0`.

### Decisión y por qué (2026-08-18, NO RE-LITIGAR)

Carlos decide adoptar el estándar de facto de la industria para la UI del dashboard. La decisión
**está tomada y no se vuelve a discutir** — ningún LLM debe re-proponer "hacerlo a mano en vanilla",
pedir que se re-justifique, ni volver a plantear el trade-off. Si un LLM cree que hay un problema
técnico concreto en la *ejecución*, lo dice; la *dirección* no se re-abre.

**La evidencia que motivó la decisión sale de este mismo archivo:**

- v0.12 (Mes 21) tuvo que **inventar 4 reglas de diseño propias desde cero** (anclaje de elementos
  fijos, altura de toprow, overflow en el nivel correcto, hover-swap CSS) — ver línea del cierre de
  v0.12 más abajo. Son problemas que Radix UI resuelve de fábrica hace años.
- Mes 21 registró **13 ajustes "premium dashboard"** con causa raíz individual cada uno.
- El patrón `render()` → `innerHTML` → `wire()` (62 `innerHTML` + 186 `addEventListener`) **es** un
  mini-framework escrito a mano. La pregunta nunca fue "¿meto un framework?" sino "¿mantengo el mío
  o uso el que ya resolvió esto?".
- Costo real medido por Carlos: horas por un `<select>`. Meses de "hacerlo sencillo" salieron **más
  caros en tiempo** que adoptar la librería.

**Verificación externa (2026-08-18)**: Claude Desktop es Electron; el combo dominante en apps de
este tipo es React + Vite/Bun + Tailwind + shadcn/ui. Codex integra shadcn/ui vía MCP como registry
de referencia. shadcn/ui está construido sobre **Radix Primitives** (accesibilidad, foco, teclado,
overflow, z-index ya resueltos) + Tailwind. No hay equivalente igual de maduro para vanilla JS.

### Estado inicial medido (2026-08-18, no estimado)

| Pieza | Números reales |
|---|---|
| Pantallas en `window.SCREENS` | **11** — chat, runner, tasks, memory, project, instincts, runs, graph, settings, specs, skills |
| JS de frontend | **~8.300 líneas** — `app.js` 2612, `screens-ops.js` 2408, `screens-core.js` 1647, `i18n.js` 1618, `data.js` 184, `theme.js` 31 |
| CSS | **~2.043 líneas** — `screens.css` 1193, `styles.css` 850 |
| Framework casero | 62 `innerHTML` + 186 `addEventListener`, patrón `render()`/`wire()` |
| Build step | **Ninguno** — `<script src>` globales en `index.html`, sin módulos ES, sin bundler |
| Tests de frontend | **Cero** — los 13 de `src/dashboard/__tests__/` son de handlers/API |
| Tokens de diseño | **30 CSS vars** ya definidas (`--bg`, `--surface`, `--accent`, `--radius`, …) |
| Bun | 1.3.14 — **transpila TSX nativo y tiene bundler propio** |

### Stack elegido

**React 19 + TypeScript + Tailwind v4 + shadcn/ui (sobre Radix), bundleado con `bun build`.**

**No Vite, no Rollup, no webpack, no esbuild.** El punto no obvio que abarata toda la migración:
Bun 1.3.14 ya hace TSX nativo y bundlea. El build es una línea, en el runtime que el repo ya usa.
Tailwind v4 entra por `bun-plugin-tailwind` dentro del mismo `Bun.build()`.

### Costos reales — declarados ANTES, no descubiertos después

1. **Aparece un build step donde hoy no hay ninguno.** Hoy: editar `.js` → recargar. Después:
   `bun run build:ui` (o watch). Toca el flujo de desarrollo y probablemente `scripts/pre-commit.sh`.
   Es el precio real de la decisión y no es negociable.
2. **Coverage gate.** Los umbrales de `scripts/check-coverage.ts` (72.98% / 59.71%) miden
   `src/**/*.ts`. Meter `.tsx` mueve el número. Decidir **explícitamente**: excluir el UI del
   coverage o recalibrar **contra el log de CI, nunca contra el Mac**
   (ver regla "Verificar contra CI" en CLAUDE.md y `reference-ci-host-environment-drift`).
3. **i18n NO se migra.** 223 llamadas a `t()` solo en `app.js`, sistema propio con `window.t`.
   React sigue llamando `window.t()`. Migrar i18n está **fuera de alcance de todo el Mes 30**.
4. **Las 4 reglas de diseño de v0.12** se verifican una por una contra Radix, en vivo. Radix las
   resuelve — pero eso **se comprueba, no se asume** (regla cero de CLAUDE.md: nada se entrega sin
   verificar contra el dashboard real corriendo, no mocks).
5. **11 pantallas.** No es un fin de semana. Carlos asume ese costo explícitamente (2026-08-18).

### Ítems

- [ ] **UI.0 — 🧠 Andamiaje (ninguna pantalla migrada).**
  `public-src/` con React+TS; `bun build` → `public/dist/`; script `build:ui`;
  `bun-plugin-tailwind`. Mapeo de las **30 CSS vars actuales** a tokens shadcn
  (`--background`, `--foreground`, `--border`, `--primary`, `--muted`, `--destructive`, `--radius`)
  — **shadcn adopta la paleta existente, no al revés**: el look actual se preserva.
  Convivencia: React monta en contenedores dentro del DOM vanilla; nada existente se rompe.
  **Validación**: el dashboard actual sigue funcionando idéntico + pipeline de build listo.

- [ ] **UI.1 — 🔍 GATE DE ABORTAR: el combobox de modelo.**
  Una sola isla React dentro del dashboard vanilla actual: reemplazar `buildModelSelect()` por
  shadcn `Command` + `Popover` (patrón combobox buscable — que es literalmente lo que exige
  `reference-model-combo-pattern`, resuelto de fábrica).
  **Es el componente exacto que costó horas.** Si en ~1 día queda mejor que lo actual y se comporta
  bien **verificado en vivo** (dashboard real corriendo), la tesis quedó probada y se sigue.
  Si no, **se aborta acá** habiendo perdido un día en vez de meses.

- [ ] **UI.2 — 🧠 Design system: los 6 componentes que se repiten.**
  Button, Input/Search, Select/Combobox, Dialog, Toast (reemplaza `showToast`), Tabs.
  Más primitives del shell (`cn()`, variantes). Todo shadcn, cero CSS a mano.

- [ ] **UI.3 — 🧠 Shell: sidebar + header + rightpanel + search.**
  El navbar/toolbar/panel colapsable — donde viven las 4 reglas de diseño descubiertas a los golpes.
  Va **después** del design system, no antes, porque toca las 11 pantallas a la vez.

- [ ] **UI.4 — 🧠 Pantallas, en orden de valor.**
  `specs` y `skills` primero (las más chicas — validan el patrón de migración de pantalla completa),
  después `chat` (la home, mayor valor visual), `tasks`, `runs`, `graph`, y `settings` al final
  (la más grande, ~900 líneas).
  **Una pantalla = un commit = verificación en vivo.** Sin acumular (regla de cadencia de commits).
  **Migrar ≠ rediseñar**: primero paridad funcional, las mejoras visuales vienen después.

- [ ] **UI.5 — 🧠 Limpieza.**
  Borrar el `render()`/`wire()` muerto; `screens.css`/`styles.css` reducidos a tokens;
  `index.html` con un solo `<script>`.

- [ ] **UI.6 — 🧠 La UI de sesiones y proyectos (backend ya listo por CC.2/CC.3).**
  Absorbida desde el Mes 29 el 2026-08-18: CC.2 y CC.3 entregan schema + endpoints + tests, y toda
  su superficie visual se construye acá, en React, **nunca en vanilla**.
  Sidebar izquierdo: **toggle Chat | Code** arriba (shadcn `Tabs`), y debajo el árbol de proyectos
  como carpetas colapsables (shadcn `Collapsible`/`Sidebar`) con sus sesiones. En `Code` se ven los
  proyectos con sus agentes; en `Chat` se ven las conversaciones — incluidas las "generales"
  (`project_id NULL`). Cada sesión muestra su agente (inmutable) y su modo (mutable).
  El picker de agente de CC.D2 se reconstruye acá apuntando a `PATCH /api/chat/sessions/:id`,
  ya no a `PUT /api/config`.

- [ ] **UI.7 — 🧠 Navegación nueva: muere "modo avanzado", nace "Observabilidad".**
  Absorbe el ex-CC.4 y el ex-BB.3. Elimina `navModeBtn` y el flag
  `localStorage['orchestos-mode']` (`app.js:1593`, `2263`, `2286-2337`) — el eje deja de ser
  normal/avanzado y pasa a ser Chat/Code.
  En el lugar exacto que ocupaba "modo avanzado" (abajo de todo, justo arriba de Settings) va el
  grupo colapsable **Observabilidad**: Tasks · Runs · Graph · Specs · Skills.
  Memory · Instincts · Project van dentro de Settings (veredicto de CC.0).
  `SCREENS.runner` se borra (deuda CC.0-D5).
  **Gate 🔍 en vivo**: es el equivalente visual de CC.5 — dos proyectos, una sesión por proyecto,
  cada una con un CLI distinto, verificado con navegador real.

### Fuera de alcance del Mes 30 (explícito)

- Migrar i18n a una librería.
- Tocar handlers, endpoints o cualquier cosa de `src/dashboard/*.ts` que no sea servir el bundle.
- Cambiar navegación, rutas o comportamiento funcional — **este mes es puramente visual/estructural**.
- Rediseñar pantallas mientras se migran.

### Riesgo principal

No es React. Es que **a mitad de camino queden dos sistemas conviviendo indefinidamente.**
Por eso UI.1 es un gate de abortar real, y por eso el orden es shell→pantallas y no al revés.

---

## MES 29 — Que "OrchestOS" deje de quedarle grande al sistema (abierto 2026-08-16, cerrado 2026-08-21) → [DONE.md](DONE.md)

Eje de Carlos: "para llamarlo orquestador debería poder abrir varios chats, cada uno con el CLI de
mi gusto, para varios proyectos — hoy solo funciona para 1". Diagnóstico verificado en código, no
opinión. CC.0 (auditoría de 11 tabs, veredictos vive/va-a-settings/se-borra). CC.1/CC.1b/CC.1c
(chat corre por el CLI elegido, no solo por API — 5 niveles reales de esfuerzo). CC.D1-D4
(`executor_mode`+`executorEngine` → un solo campo `agent`, guiado por el Agent Client Protocol de
Zed; picker de agente en el chat, 8 pasadas hasta el diseño final; nombres de modelo legibles;
gate en vivo con Playwright). CC.2/CC.2a/CC.3 (sesiones de chat persistentes por proyecto +
multi-proyecto real backend-puro — mata los 10 `resolve('.')`). **CC.5** (gate final: dos
proyectos reales, cada uno sobre un CLI distinto, verificado por API contra la SQLite real —
encontró y arregló 2 bugs de producto en el camino: resolución del path del CLI desde la
instalación en vez del proyecto orquestado, y una condición de carrera en `graph-runner.ts` que
hacía fallar SIEMPRE la segunda tarea de cualquier grafo). **CC.1-D1** (Carlos corrigió el diseño:
el 422 que bloqueaba chat con codex/opencode era una restricción de implementación no pedida — se
abrió a los tres CLIs, con la frontera de lectura/escritura puesta por el flag real de cada
binario, verificado en vivo incluso contra un prompt adversarial). **CC.0-D6** (evidencia de gates
en vivo ya no se pierde con el tmpdir — `bun run gate:evidence` la copia a la DB real marcada
`task_class=gate:*`). Detalle completo, evidencia y las 8 pasadas de CC.D2 → [DONE.md § Mes 29](DONE.md).

---

## MES 28 — Backlog canónico, categoría Medio (abierto 2026-08-15, cerrado 2026-08-18) → [DONE.md](DONE.md)

Bloque BB (2026-08-16): un solo selector real de "cómo corre OrchestOS" (`executor_mode` unificado,
5 motores, artefactos del host filtrados, comparación medida de los 3 CLIs). Bloque AA: IDEAS `#6`
graduada (`design.md` condicional vía OpenSpec, con gate CLI+dashboard). **11/11 ítems cerrados** —
BB.6 (costo ficticio de `codex`) quedó abierto del 16 al 18 y se cerró con un guard antes del
spawn, sin fabricar el número ni tocar schema. La categoría Medio de IDEAS.md NO se agotó a
propósito (decisión de Carlos: idea por idea, no toda la categoría de una vez). Detalle completo,
diagnóstico de BB.6 y evidencia de los 11 ítems → [DONE.md § Mes 28](DONE.md).

---

## MES 27 — Backlog canónico, categoría Bajo-medio (X–Z)

- [x] **SÍ — Mes 27 cerrado (2026-08-13), parcial por diseño**
  Categoría **Bajo-medio** del backlog canónico: `#33` (Bloque X, refuter en el QA loop —
  segunda opinión barata que revierte falsos-negativos del juez antes de quemar un retry, mirror
  asimétrico de K.4b) y `#37` (Bloque Y, badge "Free" + preset "empezar gratis" para modelos
  `:free` de OpenRouter) cerrados completos. `#51` (Bloque Z, acciones por mensaje en el chat)
  cerrado **parcial a propósito**: copiar + timestamp implementados, "rebobinar" queda fuera
  porque la propia idea lo liga a `#50` (sesiones persistentes en SQLite, sin implementar) —
  rebobinar una conversación que solo vive en memoria JS no tiene el mismo sentido. `#4` y `#30`
  verificados y saltados antes de tocar código: ninguno cumple el gate de evidencia que su propio
  texto en IDEAS.md exige. Un bug real no pedido encontrado y arreglado al verificar Y en vivo: la
  selección de rol en Settings → Model routing se revertía en silencio (rerender post-selección
  recalculaba desde el config del servidor, no desde la elección recién hecha). 1122 tests · 0
  fail · `tsc --noEmit` limpio · `bun run test:coverage` verde en cada cierre.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 26 — Backlog canónico, categoría Bajo (Q–W)

- [x] **SÍ — Mes 26 cerrado (2026-08-08)**
  Categoría **Bajo** completa del backlog canónico de IDEAS.md, 7 ideas (Q `#2` verification-before-completion, R `#3` requesting/receiving-code-review, S `#5` Ruby resolver, T `#19` symlink de node_modules en worktrees, U `#40` Guardar/Limpiar en Constitution, V `#46` spike de Graphify, W `#58` tool-policy.ts dead code). Tres de los siete destaparon bugs reales no pedidos al verificar antes de escribir contenido: **S** — `indexProject()` perdía todo edge cross-file en un pase único (universal, no solo Rust/C#, desde S21) más 2 bugs de resolver, arreglado antes de agregar Ruby (0% → 100% de resolución en los 5 lenguajes); **T** — el symlink de `node_modules` en worktrees se colaba al commit real sin un pathspec de exclusión (`.gitignore` con slash no matchea un symlink); **U** — quitar el autosave de Constitution expuso una pérdida de datos silenciosa contra el poll de 30s del dashboard (guard por foco no cubría el nuevo flujo de botones). **V** fue spike puro: Graphify instalado, comparado, revertido byte a byte — no se adopta el binario (dependencia de runtime de una startup en pivot a SaaS), se roban 2 patrones como IDEAS #59/#60. **W** decidido por Carlos explícitamente: borrar en vez de cablear. 1111 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` verde en cada cierre.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 25 — Pendientes heredados de los cierres 22–24 + backlog canónico (N, O, P)

- [x] **SÍ — Mes 25 cerrado (2026-08-06)**
  Cerró los pendientes heredados de Mes 22-24 (K.6.2-R7, L.5.7, L.6.2, M ×2) y abrió la ejecución del backlog canónico por esfuerzo de IDEAS.md (regla desde 2026-07-30: el orden de IDEAS.md es el único orden de ejecución). Tres bloques completos: **N** — endurecimiento de skills (Iron Law/Common Rationalizations/Red Flags) portado a `buildSections()`/al ejecutor propio (N.4.5, hallazgo real: el endurecimiento llegaba a Claude Code/Cursor pero nunca al runner de OrchestOS) y auditado contra las fuentes reales (`obra/superpowers`, `mattpocock/skills`) skill por skill, no por nombre — match nominal ≠ match semántico fue el hallazgo de método (N.7b/N.7c). **O** — las skills se activan solas: contrato de activación (`activation.mode/phases/triggers`, O.0), skills resueltas desde la instalación no desde `cwd` (O.1), el planner ve el catálogo y asigna skill por sub-tarea (O.2), gates transversales (`security-review`/`qa-structured`) que el mismo LLM ejecutor no puede descartar (O.3) — verificado en vivo con dinero real contra un proyecto scratch: código con SQL concatenada + credenciales hardcodeadas fue rechazado por el QA judge citando OWASP explícitamente, el checklist inyectado llegó al juez real (O.4). **P** — vigilancia de deriva de fuentes externas (`sources-drift`): registro por path exacto (no repo completo), detección mecánica vía `gh api`, y un paso opcional de resumen vía LLM que lee el diff real y redacta una propuesta para revisión humana (P.4), nunca aplica nada solo. Hallazgo real de hygiene durante O.3: `ctx.allowedTools` en `tool-policy.ts` es dead code (ningún ejecutor lo lee) — documentado y registrado como IDEAS.md #58 en vez de cablearlo sin plan. 1099 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` (comando exacto de CI) verde.
  Ver historial completo → [DONE.md](DONE.md).

---

## v0.12 (MES 21) — Producto estable: cerrar papercuts, higiene y paridad antes de features grandes

- [x] **SÍ — v0.12 cerrado (2026-07-14)**
  Higiene de datos (borrado masivo en 5 tablas + cero diálogos nativos, absorbe IDEAS #18), Chat con Markdown/sanitizador propio + chips de task/modelo clicables, visor de diff por run calculado por contenido (no `git diff` post-hoc), y auditoría real de paridad CLI↔dashboard con 3 gaps no-dev cerrados (`task init`, `constitution init`, `summary` PDF) y verificados independientemente contra código real ([[feedback-verificar-progreso-delegado]]). Nacen 4 reglas de diseño fijas para toda pantalla nueva (anclaje de elementos fijos, altura de toprow, overflow en el nivel correcto, hover-swap CSS). Cero features nuevas en el motor, disciplina del milestone respetada de punta a punta. 711 tests · 0 fail · `tsc --noEmit` limpio. Primer tag formal del proyecto: `v0.12`.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 20 — Que OrchestOS entregue de verdad: dogfooding contra un producto real

- [x] **PARCIAL — Mes 20 cerrado formalmente (2026-07-14), con un gate abierto a propósito**
  Auto-split (el gatillo automático que le faltaba al motor de sub-tareas) diseñado, implementado y con superficie de aprobación en dashboard — el usuario ve y aprueba el plan de sub-tareas antes de gastar. Probado con éxito en un entregable simple end-to-end (`crypto-page-v1`, gate 🔍 con dinero real). **El gate original y más exigente (C.2, dashboard premium multi-archivo React+TS+Vite) sigue PAUSADO** por decisión explícita de alcance de Carlos — gated en 2 prerequisitos concretos: decisión de modelo ([[feedback-modelo-decision-final-carlos]], nacida de un incidente de $5.00 quemados este mismo mes) y presupuesto de outputs de tools del executor agéntico (IDEAS.md #32). Candidato de pre-flight del próximo milestone (ver abajo). 711 tests · 0 fail · `tsc --noEmit` limpio (estado actual, no snapshot del mes).
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 19 — El chat lee cualquier imagen: OCR + múltiples adjuntos

- [x] **SÍ — Mes 19 cerrado (2026-07-09)**
  El chat lee imágenes con cualquier modelo vía OCR local (`tesseract.js`, sin dependencia de que el modelo elegido tenga visión), soporta múltiples adjuntos (`st.chatFiles[]`, límite 5), y el wrapper de seguridad "dato externo, nunca instrucción" fue verificado contra un intento real de prompt injection en una imagen (el modelo lo ignoró). `task_class: ocr` diferido sin evidencia de caso de uso interno — vuelve a IDEAS.md #30. 649 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## Pre-flight — gap conocido antes de abrir el próximo milestone

**Actualizado al cierre de Mes 27 (2026-08-13)** — sin gap bloqueante nuevo identificado durante
Mes 27 (el único hallazgo real, el bug de reversión de rol en Model routing de Y.2, se resolvió
dentro de su propio bloque). Historial completo de los tres cierres → [DONE.md](DONE.md).

**Remanentes explícitos de Bajo-medio (no son deuda oculta, están documentados)**:
- `#4` y `#30` siguen parqueados — no cumplen el gate de evidencia de su propio texto en
  IDEAS.md. Se re-evalúan solo si aparece evidencia nueva (falsos negativos reales de `clarify`
  para `#4`; caso de uso real dentro de OrchestOS mismo para `#30`).
- `#51` (rebobinar) sigue bloqueado por `#50` — no se re-visita hasta que `#50` (sesiones
  persistentes en SQLite) se implemente.

**Próximo milestone: por decidir con Carlos** — el orden lo fija
[IDEAS.md § 🧭 Backlog canónico por esfuerzo](IDEAS.md); con **Mínimo**, **Bajo** y **Bajo-medio**
(salvo los 3 remanentes de arriba) atendidas, la categoría **Medio** es la siguiente en el índice.

---

## MES 18 — Chat como entrada única: detección de intención de tarea

- [x] **SÍ — Mes 18 cerrado (2026-07-09)**
  Chat con detección semántica de intención de tarea activada con evidencia real (34 mensajes reales, falso negativo confirmado y corregido — Bloque J), paridad CLI↔Dashboard cerrada (9/9 gaps, Bloque E), auto-selección de skill por dominio (Bloque D), auditoría visual + 13 ajustes "premium dashboard" con causa raíz real en cada uno (Bloques G/I), y 2 bugs reales de producción encontrados y corregidos por dogfooding directo de Carlos (imágenes sin gating de visión, guard de contexto no conectado al chat). 649 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 17 — La capa de confianza: ejecutores externos detrás de la verificación

- [x] **SÍ — Mes 17 cerrado (2026-07-05)**
  Tercer `ExecutorEngine` (ejecutor externo, Claude Code headless) diseñado (`docs/external-executor-design.md`), implementado (`executors/external.ts`, worktree obligatorio, diff completo sin filtrar), expuesto en dashboard+CLI (selector, bloque "Process", detección honesta de binario ausente), y verificado en vivo con dinero real (Bloque D) contra la misma tarea brownfield que motivó el mes anterior (G.5) — encontró y corrigió un bug real de parseo de `git status --porcelain` en el camino (mismo patrón de gates 🔍 con dinero real de G.5/Mes 14/Mes 13). Confirma la tesis: `enforceContract`/checks/QA funcionan idénticos sobre un motor que OrchestOS no controla, a costa de 25-70× el costo de single-shot. 617 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 15.F0 — Integridad: los instrumentos de medición deben decir la verdad antes de tocar el motor

- [x] **SÍ — F0 cerrado (2026-07-02)**
  Auditoría completa (arquitecto + debugger + QA + dev) antes de tocar el motor: suite determinista (0 `mock.module()`, inyección de dependencias en su lugar), `tasks.yaml` reconciliado (6 tareas non-done resueltas con decisión explícita), `maxTokens` ignorado en providers directos conectado, modelo retirado (`claude-3-haiku`) reemplazado, pricing con fallback $0 silencioso migrado al catálogo real. 524 tests · 0 fail al cerrar. Desbloqueó el Mes 16.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 16 — El giro del timón: motor honesto + ejecutor agéntico

- [x] **SÍ — Mes 16 cerrado (2026-07-02)**
  Origen: revisión estratégica externa (Fable 5, 2026-07-01) — 6 hallazgos reales del corazón del producto. F1-F4 corrigieron las fallas puntuales del ejecutor (retry ciego, QA autocalificado, evidencia incompleta, contrato sin normalizar paths), todos verificados en vivo. Bloque G ejecutó la decisión de arquitectura: capa de verificación desacoplada del ejecutor (`ExecutorEngine`), single-shot extraído sin cambio de comportamiento (G.2), ejecutor agéntico nuevo reusando `runToolLoop()` (G.3), superficie completa en dashboard+CLI (G.4), y un gate comparativo con dinero real (G.5) que encontró y corrigió 2 bugs reales de `maxTokens` hardcodeado en `tool-call.ts`/`harness.ts` — reverificado en vivo sin truncar. 585 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 14 — Autonomía interna: el runner que conduce el grafo solo

- [x] **SÍ — Mes 14 cerrado (2026-06-29)**
  `orchestos run --graph` recorre el DAG completo de `tasks.yaml` sin intervención humana en el happy path (Bloques 0/A/B); ante un fallo, bloquea solo la rama afectada y la decisión retry/bloqueo la toma `diagnoseTask()`, no el humano (A.R hardening). Superficie completa en CLI + dashboard (Bloque C). Verificado en vivo en el dashboard real y en un smoke e2e contra el `tasks.yaml` real de producción del propio proyecto — 2 bugs reales destapados y corregidos en el camino (falso positivo de QA sin checks deterministas, retry sin tope en fallos de check) (Bloque D). En paralelo: control de reasoning effort por modelo end-to-end (BLOQUE BACK/FRONT) y pulido visual del dashboard vía auditoría `impeccable` (10 fixes, incluido un loop de rerender que borraba inputs activos). 518 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 13 — OrchestOS conectado: del aislamiento al conocimiento externo

- [x] **SÍ — Mes 13 cerrado (2026-06-23)**
  Pre-flight de UI (edición de skills real, ícono YAML, TTL+refresh de modelos). Web fetch real en el chat (`runToolLoop()` multi-turno + guard SSRF) — 2 bugs reales corregidos solo al verificar en vivo (falso positivo SSRF por `dns.resolve4()`, arity de `executeFetchUrl`). Registro de skills de la comunidad (217 reales, `idleTimeout` corregido) + prompt del curador ajustado para que `description` sea condición de disparo, no resumen. 468 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 12 — Endurecimiento: red de seguridad antes de la autonomía

- [x] **SÍ — Mes 12 cerrado (2026-06-19)**
  Tests del motor crítico (`contract.ts`, `scheduler.ts`) con gate de mutación confirmado contra regresión real. CI en GitHub Actions bloqueando PRs rotos (verificado en vivo, PR #2) + pre-commit hook + `noUnusedLocals`. XSS cerrado con payload real probado en el dashboard corriendo. `server.ts` partido de 1727 a 159 líneas en 13 módulos, re-verificado línea por línea sin cambios de comportamiento. 421 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 11 — OrchestOS como experto: autoría de skills con curador

- [x] **SÍ — Mes 11 cerrado (2026-06-10)**
  Curador LLM (`/api/skills/curate`, retry hasta 2 veces) + pantalla Skills con tres puertas (escribir · importar · exportar) + pack "pro" de 8 skills de ingeniería en `skills/pro/` importables con un click + paridad CLI (`skill curate`/`skill import`). 402 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 4 — Routing inteligente + skills que se adaptan al proyecto

- [x] **SÍ — Mes 4 cerrado (2026-05-27)**
  Routing activo (`config show`), 11 skills, language_targets, CONSTITUTION.md en system prompt, `context compress` genera CONTEXT.md, `runs --detail` reporta tokens.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 5 — Confiabilidad para uso diario: e2e real + sandbox + spec-driven

- [x] **SÍ — Mes 5 cerrado (2026-05-28)**
  Sandbox por git worktree (S19), Spec-Driven con gate en harness (S20), resolvers multi-lenguaje + autoskills fetch (S21), sub-agentes con context isolation + memoria persistente + tool policy (S22). 110 tests · 0 fail. Smoke real sub-agentes: write-greeting→write-response (44s, memory_entries escritas). selectMemories bug corregido (depIds ID→topic_key resolution).
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 6 — IA con ROI demostrable + observabilidad de sub-agentes

- [x] **SÍ — Mes 6 cerrado (2026-05-28)**
  S23 function calling planner (elimina errores YAML estructuralmente), S24 embeddings semánticos (`embed_hits` en runs), S25 diagnóstico de fallos auto-trigger en `failed_permanent`, S26 BM25 conflict detection en memoria.
  `embed_hits > 0` en 12 runs reales · 212 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 7 — Observabilidad activa + calidad del pipeline

- [x] **SÍ — Mes 7 cerrado (2026-06-02)**
  S27 context-monitor wired (warnings persistidos en DB + visibles en `runs --detail`), S28 WHEN/THEN acceptance criteria (`spec lint` + draft prompt + QA prompt), S29 spec archive (`spec archive` + `spec list --all`), S30 aprendizaje continuo v1 (`runs --analyze` + hook post-completion en `task run`). 256 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 8 — Pipeline robusto + aprendizaje activo

- [x] **SÍ — Mes 8 cerrado (2026-06-02)**
  S31 middleware chain (10 middlewares de enrichment, harness refactorizado), S32 capabilities contract + delta headers en specs, S33 instincts con confidence scoring, S34 continuous learning v2 (runs→instincts loop cerrado), S35 cost tracker por sub-agente, S36 dashboard local Bun + vanilla JS (4 vistas desde SQLite).
  369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 9 — Dashboard usable: de observador a orquestador

- [x] **SÍ — Mes 9 cerrado (2026-06-04)**
  Dashboard convertido en interfaz principal: 10 bloques (A–J), input natural con preview IA, i18n en/es, instalador de un solo archivo, chat panel + model selector shipeados fuera de plan. 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 10 — El producto que alguien que nunca programó puede usar

- [x] **SÍ — Mes 10 cerrado (2026-06-04)**
  Wizard API key (3 proveedores, validación real, rollback en 401) · toggle humano/operador navegable con persistencia · diagnóstico de fallos en Tasks · archivos en Chat · Control Center con 5 bloques de salud · Ollama auto-detectado · 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## Knowledge promotions

<!-- knowledge-promotion:KP-20260817-102752-93e4d5 -->
### Planificar antes de cambios multi-módulo

- Insight: `INS-2026-005` (adopted/high)
- Razón: El incidente del hook desincronizado y las entregas de UI/configuración sin wiring demuestran que las reglas narrativas no bastan; se necesita un protocolo universal con gates mecánicos y evidencia en vivo para cualquier LLM.
- Acción propuesta: Agregar al Mes 29 un bloque de gobernanza cross-LLM: orden obligatorio de preflight, verificación de scope y trabajo paralelo, doctor de hooks, gates de seguridad/typecheck/tests y prohibición de cerrar UI/configuración sin prueba real de navegador y backend.
- Regla: Si una modificación cambia arquitectura o atraviesa varias capas, presentar alcance, pasos, validación y exclusiones antes de editar.
- Evidencia en vault: projects/orchestos/decisions, projects/orchestos/aprendizajes
<!-- /knowledge-promotion:KP-20260817-102752-93e4d5 -->

- [x] **GOV.1 — 🧠 Protocolo universal y verificable para cualquier LLM.** (2026-08-17) Una sola fuente de
  verdad define el orden obligatorio antes de editar, los límites de alcance, los gates por tipo
  de cambio y qué hacer cuando falta evidencia. `AGENTS.md` y `CLAUDE.md` deben apuntar al mismo
  protocolo; un preflight debe validar ítem abierto + hooks sin drift; pre-commit debe impedir
  cerrar cambios de dashboard/configuración sin evidencia explícita de navegador real. El gate
  debe distinguir con honestidad lo mecánicamente verificable de lo que sigue requiriendo criterio.

  **Implementado:** `docs/agent-work-protocol.md` es la fuente común; `AGENTS.md`/`CLAUDE.md`
  obligan a ejecutar `bun run agent:preflight -- --item <ID> --agent <nombre>`; el preflight
  valida ítem abierto, muestra cambios ajenos y bloquea hooks ausentes/con drift usando
  `git rev-parse --git-path hooks` (portable a worktrees). `agent:live-gate` bloquea commits que
  toquen dashboard/config sin un `[x]` y una línea `Gate en vivo:` con navegador/browser/Playwright
  en el diff staged de `PLAN.md`. El protocolo declara honestamente que el hook verifica que la
  evidencia esté documentada, no que sea verdadera: observar el flujo sigue siendo gate humano/LLM.

  **Evidencia:** `bun run agent:preflight -- --item GOV.1 --agent codex` ✅; `bun run hooks:check`
  ✅; `bunx tsc --noEmit` ✅; `bun test scripts/agent-governance.test.ts` (3 pass) ✅;
  `bun run test:coverage` (1157 pass, 0 fail) ✅. `bun run security:gate` llegó al audit y bloqueó
  por dos vulnerabilidades transitivas preexistentes; quedan registradas en GOV.2, no ocultas ni
  corregidas fuera de alcance. Insight decisivo: `INS-2026-005`; `INS-2026-004` evitó confundir
  coverage con capacidad real de detectar regresiones.

- [x] **GOV.2 — 🔍 Resolver audit de dependencias high sin actualización ciega.** (2026-08-17) Hallazgo del gate
  GOV.1: `bun audit` reporta `fast-uri >=3.0.0 <3.1.5` vía Stryker/Ajv y
  `brace-expansion >=4.0.0 <5.0.9` vía Stryker/minimatch y glob/minimatch. Evaluar actualización
  compatible y correr suite + mutation shards relevantes; no usar `bun update --latest` a ciegas.

  **Resolución mínima:** no se actualizaron Stryker, Ajv, Glob ni Minimatch. `package.json` fija
  overrides de `fast-uri: 3.1.5` y `brace-expansion: 5.0.9`; ambos permanecen dentro de los rangos
  que sus padres ya aceptaban (`ajv@8.18.0` → `fast-uri ^3.0.1`; `minimatch@10.2.5` →
  `brace-expansion ^5.0.5`). `bun.lock` confirma únicamente esos dos saltos de parche. Advisories
  cerrados: `GHSA-7p8r-x3mc-p8w7` y `GHSA-rgw5-rvv9-x895`.

  **Evidencia:** `bun pm ls --all` → `fast-uri@3.1.5`/`brace-expansion@5.0.9`; `bun audit
  --audit-level high` ✅; `bunx tsc --noEmit` ✅; `bun run test:coverage` (1157 pass, 0 fail) ✅;
  `bun run security:gate` completo ✅; `bun run mutation:qa` arrancó Stryker, ejecutó 429 mutantes
  y terminó en 4m01s con score 46.79% ✅. La fuente primaria (GitHub Advisory Database) y el
  registry npm confirman las primeras versiones corregidas. Insight aplicado: `INS-2026-005` —
  cambio acotado, sin actualización multi-capa.

- [x] **GOV.3 — 🔍 Evaluar advisory moderate de `qs` sin mezclar alcance.** (2026-08-17) El audit total posterior
  a GOV.2 conserva `GHSA-q8mj-m7cp-5q26`: `qs@6.15.1` llega fijado exactamente por
  `typed-rest-client@2.3.1` dentro de Stryker. No bloquea `security:gate` (`high+`), pero debe
  evaluarse por separado antes de forzar un override sobre una dependencia con versión exacta.

  **Resolución mínima:** `package.json` añade `qs: 6.15.3` a los overrides existentes. Se conserva
  `@stryker-mutator/core@9.6.1` y `typed-rest-client@2.3.1`: actualizar este último a `3.x` rompería
  el rango `~2.3.0` declarado por Stryker y ampliaría el alcance. `bun.lock` cambia únicamente
  `qs 6.15.1 → 6.15.3`, sus dependencias internas (`side-channel ^1.1.1` y
  `es-define-property ^1.0.1`) y el registro del override. El override corrige la resolución de este
  repositorio, pero no modifica el manifest upstream de `typed-rest-client`; debe reevaluarse al
  actualizar Stryker o cuando ese cliente publique/adopte una versión compatible sin el pin vulnerable.

  **Evidencia:** `bun run agent:preflight -- --item GOV.3 --agent codex` ✅; baseline
  `bunx tsc --noEmit` ✅; `bun pm ls --all` → `typed-rest-client@2.3.1` y `qs@6.15.3`; `bun audit`
  → cero vulnerabilidades ✅; `bun run security:gate` completo (1157 pass, 0 fail, audit limpio) ✅;
  `bun run mutation:qa` ejecutó el consumidor real Stryker, 429 mutantes en 4m00s, score 46.79% ✅.
  Knowledge radar: sin insights aplicables; no se promovió ni inventó conocimiento.
