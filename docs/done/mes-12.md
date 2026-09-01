### MES 12 — Endurecimiento: red de seguridad antes de la autonomía

Origen: auditoría de seguridad/testing/backend/frontend (2026-06-19) — calificación de entrada Seguridad B · Testing B+ · Backend A- · Frontend C+/B-. Eje: convertir la disciplina manual en garantías automáticas, hardening previo al runner de grafo autónomo (ver IDEAS.md § Largo plazo).

**BLOQUE A — Red de seguridad del motor crítico**
- A1 (⚡) Tests de `enforceContract`/`parseLLMResponse` (`src/run/contract.ts`) — write autorizado, write bloqueado fuera de `allowedPaths` con `CONTRACT VIOLATION` y cero escritura, parseo de bloques `<<<FILE:...>>>`, traversal `../` bloqueado — 2026-06-19
- A2 (⚡) Tests de `executePlan` (`src/run/scheduler.ts`) con `executeOne` mockeado — orden topológico, cascada de `skipped` por dependencia fallida, `timed_out`, agregación de cost/tokens/ms, `all_passed` — 2026-06-19
- A3 (🔍) Gate de mutación: comentado el `throw` del guard de `enforceContract` — 3 tests se pusieron rojos y el path traversal `../outside-project.txt` se materializó en disco, confirmando que el test detecta la regresión real. Revertido: 19/19 verde — 2026-06-19

**BLOQUE B — Guardarraíles automáticos: CI + pre-commit**
- B1 (⚡) `.github/workflows/ci.yml` — `bun install` + `bun test` + `bun run typecheck` en push/PR a `master` — 2026-06-19
- B2 (⚡) `scripts/pre-commit.sh` instalado en `.git/hooks/pre-commit` — `tsc --noEmit` antes de cada commit — 2026-06-19
- B3 (⚡) `noUnusedLocals`/`noUnusedParameters` activados en `tsconfig.json` + limpieza de código muerto en `planner.ts`, `harness.ts`, `server.ts`, `registry.ts`, `embeddings.ts`, `cli.ts`, `archive.ts` y otros — 2026-06-19
- B4 (🔍) Gate: PR #2 con test roto a propósito (`expect(1+1).toBe(999)`) — CI lo bloqueó en 10s. Rama eliminada, master limpio: 421 pass · 0 fail — 2026-06-19

**BLOQUE C — Cierre del XSS latente del dashboard**
- C1 (⚡) Auditoría de los ~30 `innerHTML` del front — los que renderizan datos dinámicos (skills, tareas, memoria, instincts, contenido importado) pasan por el helper `esc()` o se migraron a `textContent`; los que solo insertan constantes `ICON.*` se dejaron intactos — 2026-06-19
- C2 (🔍) Gate con payload real: skill creado vía `POST /api/skills` con `name`/`description` conteniendo `<img src=x onerror=alert(1)>` y `<script>alert()</script>` — verificado en vivo con Chrome DevTools MCP en la pantalla Skills: cero `alert()` disparado, cero nodos `<script>`/`<img>` inyectados en el DOM, texto visible escapado literalmente. Skill de prueba borrado tras verificar — 2026-06-19

**BLOQUE D — Split del god-file `server.ts`**
- D1 (🧠) Diseño documentado en `docs/dashboard-server-split.md` — mapa símbolo→archivo, grafo de dependencias sin ciclos, orden de extracción por riesgo. `route()` se mantiene como única export que consume `skills-api.test.ts` — 2026-06-19
- D2 (⚡) Extracción ejecutada siguiendo D1 — 13 módulos nuevos (`http.ts`, `settings-store.ts`, `llm/clients.ts`, `prompts/curator.ts`, 9 handlers de dominio en `handlers/`), comportamiento idéntico — 2026-06-19
- D3 (🔍) Gate re-verificado de forma independiente (sin confiar en el self-check de DeepSeek): `tsc --noEmit` limpio, 421 pass · 0 fail, lectura línea por línea de los 13 archivos contra el original — CSRF same-origin check, containment de `serveStatic`, `confirm:true` obligatorio en delete, rollback de API key en 401 y masking de keys, todos idénticos. `server.ts` quedó en 159 líneas (vs. 1727 original) — 2026-06-19

**Decisiones de diseño Mes 12**
- El hardening (Bloques A-C) precede a cualquier autonomía — no se construye un runner que se conduce solo encima de un motor sin red de tests.
- Los gates de seguridad (A3, C2) verifican que el test detecta la regresión real, no solo que "pasa" — mutación deliberada del guard, payload XSS real en vivo.
- D1 es la única pieza con criterio arquitectural del mes (Claude); D2/D3 son ejecución mecánica y verificación, delegables.
- `route()` se preserva como single entry point del routing tras el split — ningún test de integración necesitó reescritura.

**Lista prohibida Mes 12** _(lo que NO se hizo — referencia histórica)_
- Runner de grafo autónomo (el loop que se conduce solo) — deliberadamente fuera de alcance hasta que A-D cerraran. Candidato directo para Mes 13 (ver IDEAS.md § Largo plazo).
- `brainstorming`/planning socrático, `verification-before-completion`, par `requesting/receiving-code-review`, endurecimiento Iron Law/Common Rationalizations/Red Flags — siguen en backlog desde Mes 11.
- Micrófono / dictado en Chat — falta `STTProvider` abstraction.
- Resolver imports relativos en Graph (lenguajes no-JS).
- Clasificador semántico para `clarify`.
- Design.md condicional (OpenSpec).
- KuzuDB — sin evidencia de escala.
- autoskills registry — decisión de formato pendiente.

**Métrica Mes 12 — SÍ (2026-06-19)**
Motor crítico (`contract.ts` + `scheduler.ts`) con tests y gate de mutación confirmado contra regresión real. CI en GitHub Actions bloqueando PRs rotos (verificado en vivo, PR #2). Pre-commit hook con `tsc --noEmit`. XSS cerrado con payload real probado en el dashboard corriendo. `server.ts` partido de 1727 a 159 líneas en 13 módulos, re-verificado línea por línea sin cambios de comportamiento. 421 tests · 0 fail · tsc sin errores.

---

