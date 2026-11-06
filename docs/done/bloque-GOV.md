<a id="plan-orden-gov-1"></a>
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

<a id="plan-orden-gov-2"></a>
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

<a id="plan-orden-gov-3"></a>
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
