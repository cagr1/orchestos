---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-12-activo
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.
**Delegación**:
- 🧠 = Claude implementa — requiere criterio arquitectural o decisión de diseño
- ⚡ = DeepSeek implementa — tarea bien especificada, ejecuta leyendo el plan
- 🔍 = revisión obligatoria por Claude — gate antes de cerrar el sprint, independiente de quién implementó

---

## MES 12 — Endurecimiento: red de seguridad antes de la autonomía

Prerequisitos verificados al entrar: Mes 11 cerrado ✅ · 402 tests · 0 fail · `tsc` verde · `strict: true`.

Eje del mes: **convertir la disciplina manual en garantías automáticas.** El motor está maduro, pero las dos piezas que ejecutan el trabajo real (contract enforcement, scheduler) no tienen tests, no hay CI que corra el suite, y el front tiene XSS latente. Es el hardening que debe preceder al **runner de grafo autónomo** (ver IDEAS.md § Largo plazo) — no se construye un loop que se conduce solo encima de piezas sin red.

Origen: auditoría de seguridad/testing/backend/frontend (2026-06-19). Calificación de entrada: Seguridad B · Testing B+ · Backend A- · Frontend C+/B-.

Orden estricto: A → B → C → D. A y B son los que más bajan el riesgo por unidad de esfuerzo.

---

### Bloque A — Red de seguridad del motor crítico (⚡ + 🔍)

`enforceContract()` ([src/run/contract.ts](src/run/contract.ts)) es lo único que impide que el LLM escriba fuera de `--output`, y tiene **0 tests**. `executePlan()` ([src/run/scheduler.ts](src/run/scheduler.ts)) orquesta sub-tareas con cascada de dependencias y tampoco tiene tests — y es el embrión del runner autónomo.

- [x] A1 Tests de `enforceContract` / `parseLLMResponse` (⚡) — casos: write autorizado se escribe; write fuera de `allowedPaths` lanza `CONTRACT VIOLATION` y NO escribe nada; `parseLLMResponse` con bloques válidos, sin bloques (throw), path vacío (throw); intento de path con `../` que no esté en `allowedPaths` → bloqueado. Usar `tmp/` para los writes y limpiar en `afterEach`.
- [x] A2 Tests de `executePlan` (scheduler) (⚡) — inyectar `executeOne` mockeado (no worktrees reales: mockear `./sandbox.ts` y `../agents/hardening.ts`). Cubrir: orden topológico respetado; fallo de una sub-tarea marca dependientes como `skipped` con reason; timeout → `timed_out`; agregación de cost/tokens/ms correcta; `all_passed` refleja el resultado.
- [x] A3 🔍 Gate: verificar que los tests **fallan** si se rompe el guard — comentar el `throw` del `blocked.length > 0` y confirmar que A1 se pone rojo. Un test de seguridad que no detecta la regresión que debe detectar no sirve. Revertir el cambio tras confirmar. (2026-06-19) — 3 tests se pusieron rojos al comentar el guard; el path traversal `../outside-project.txt` se materializó en disco y fue detectado. Revertido: 19/19 verde.

---

### Bloque B — Guardarraíles automáticos: CI + pre-commit (⚡)

Hoy los 402 tests solo corren si Carlos se acuerda. No hay nada que impida commitear código roto. La disciplina existe; falta el guardarraíl.

- [x] B1 GitHub Actions (⚡) — `.github/workflows/ci.yml`: en push y PR a `master`, instalar Bun, `bun install`, `bun test`, `bun run typecheck`. Que falle el workflow si cualquiera falla.
- [x] B2 Pre-commit hook (⚡) — hook local (`.git/hooks/pre-commit` o script en `scripts/` documentado en CLAUDE.md) que corra `tsc --noEmit` antes de cada commit. Barato y bloquea commits que no tipan. NO usar `--no-verify` para saltarlo.
- [x] B3 Activar `noUnusedLocals` y `noUnusedParameters` en tsconfig (⚡) — limpiar el código muerto que aparezca. Si algún unused es intencional, prefijar con `_`. Cierra el hueco de calidad que hoy deja pasar código sin uso.
- [x] B4 🔍 Gate: abrir un PR de prueba con un test roto a propósito y confirmar que CI lo bloquea; revertir. (2026-06-19) — PR #2 bloqueado por CI en 10s (`ci fail`). Rama eliminada, master limpio: 421 pass · 0 fail.

---

### Bloque C — Cerrar el XSS latente del dashboard (⚡ + 🔍)

~30 usos de `innerHTML` en el front y un solo helper `esc()` ([src/dashboard/public/data.js:41](src/dashboard/public/data.js:41)) sin uso garantizado. Vector real: un skill importado desde URL externa con `<script>` en `name`/`description` se ejecutaría al renderizar la galería.

- [x] C1 Auditar los `innerHTML` que renderizan datos dinámicos (⚡) — todo lo que venga de skills, tareas, memoria, instincts o contenido importado pasa por `esc()`, o se migra a `textContent`. Los `innerHTML` que solo insertan constantes `ICON.*` se pueden dejar. Listar en el commit cuáles se tocaron.
- [x] C2 🔍 Gate: importar un skill con `<img src=x onerror=alert(1)>` y `<script>` en `name` y `description`, abrir la pantalla Skills, confirmar que NO ejecuta y que se ve el texto escapado. (2026-06-19) — creado vía `POST /api/skills` con payload crudo (name: `<img src=x onerror=alert(1)><script>alert(2)</script>`, description: `<script>alert(3)</script> desc`), abierto en `#skills` con Chrome DevTools MCP: cero `alert()`, cero nodos `<script>`/`<img>` en el DOM, `innerHTML` de la card muestra `&lt;img...&gt;&lt;script&gt;...` escapado. Texto literal visible en pantalla. Skill de prueba borrado tras verificar.

---

### Bloque D — Partir el god-file `server.ts` (🧠)

[src/dashboard/server.ts](src/dashboard/server.ts) son 1727 líneas: routing + handlers + prompts del curador + LLM-glue, todo junto. Crece cada mes y cada vez cuesta más tocarlo. Decisión de diseño, no mecánica → Claude.

- [x] D1 🧠 Diseño del split (2026-06-19) — mapa completo de módulos documentado en [docs/dashboard-server-split.md](docs/dashboard-server-split.md): `http.ts`, `settings-store.ts`, `llm/clients.ts`, `prompts/curator.ts`, 9 handlers de dominio en `handlers/`. Tabla símbolo→archivo con las líneas exactas de `server.ts` (1727 líneas), grafo de dependencias sin ciclos (`server.ts → handlers/* → stores/providers`), y orden de ejecución por riesgo para D2. `route()` queda como orquestador delgado — sigue siendo la única export que usa `skills-api.test.ts`.
- [x] D2 Ejecutar la extracción (⚡ siguiendo el diseño de D1) — mover código sin cambiar comportamiento. `route()` sigue exportado (los tests de `skills-api.test.ts` dependen de él). (2026-06-19)
- [x] D3 🔍 Gate: 421 tests siguen verdes + `tsc --noEmit` limpio tras el split. Cero cambios de comportamiento — es refactor puro. (2026-06-19)
  **Re-verificado de forma independiente (2026-06-19)** — DeepSeek había marcado D2/D3 él mismo al ejecutar, así que se revisó sin confiar en su propio check: `tsc --noEmit` limpio, `bun test` → 421 pass · 0 fail. Lectura línea por línea de los 13 archivos nuevos (`http.ts`, `settings-store.ts`, `llm/clients.ts`, `prompts/curator.ts`, los 9 `handlers/*.ts`) contra el `server.ts` original (git history) — lógica idéntica handler por handler, incluyendo los puntos sensibles: CSRF same-origin check, containment de `serveStatic` contra path traversal, `confirm:true` obligatorio en delete de skills, rollback de API key en 401, masking de keys. `route()` conserva el mismo orden de rutas y los mismos checks. Única diferencia encontrada: la regex de `extractPdfText` en `handlers/chat.ts` usa ` -￿` en vez del rango con caracteres Unicode literales del original — notación distinta, mismo conjunto de códigos, sin cambio de comportamiento. `server.ts` quedó en 159 líneas (vs. 1727).

---

**Nota:** el **runner de grafo autónomo** (el loop que se conduce solo, ver IDEAS.md § Largo plazo) NO entra en Mes 12 — entra cuando A–D estén cerrados. `executePlan` ya tiene la cascada de dependencias; el runner es ponerle un conductor encima, pero con el motor crítico ya cubierto por tests (Bloque A).

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
