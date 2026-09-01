## MES 24 — M: guías reproducibles por lenguaje y ecosistema (nuevo, 2026-07-29)

**Tabla de estado de bloques al cierre (2026-07-29)**

| Bloque | Estado |
| --- | --- |
| M.0–M.5 | ✅ Cerrados con evidencia en este registro |
| Límites de roadmap | ⏳ Decisión pendiente de Carlos, heredada en Mes 25 |

**Motivo:** detectar que un repositorio contiene Rust, Go, Python o TypeScript no significa saber
cómo trabajarlo correctamente. El conocimiento actual de OrchestOS está repartido entre detección de
lenguajes, skills, `AGENTS.md`, comandos descubiertos del proyecto y la intuición del desarrollador.
Eso permite empezar una tarea, pero no garantiza que se hayan considerado toolchain, dependencias,
tests, seguridad, observabilidad, build, despliegue y rollback.

**Decisión de arquitectura:** sí, el conocimiento debe vivir en Markdown versionado, pero en capas.
No se creará un `roadmap.md` monolítico ni se tratará `roadmap.sh` como una autoridad ejecutable.
La fuente de verdad será:

1. `docs/roadmaps/engineering-baseline.md`: orden universal para cualquier proyecto.
2. `docs/roadmaps/languages/<lenguaje>.md`: diferencias de Rust, Go, Python, TypeScript, etc.
3. `docs/roadmaps/project-profile.md`: decisiones y comandos reales del repositorio detectado.
4. `skills/*.yaml`: instrucciones operativas que el agente recibe durante una tarea.
5. `AGENTS.md`/`CONTEXT.md`: reglas y contexto estable del proyecto, no listas genéricas de aprendizaje.

El Markdown es la memoria durable y revisable; la detección del proyecto y los checks deben convertir
esa memoria en evidencia ejecutable. Una guía que solo se inyecta en el prompt, pero no verifica sus
comandos, es documentación aspiracional y no un control de calidad.

**Secuenciación (2026-07-29):** Bloque L (seguridad) sigue abierto en L.1. M no compite por foco —
M.0/M.1 (diseño + guía universal, baratos) pueden avanzar en paralelo por ser prerequisito de
lectura, pero M.2 en adelante (perfiles por lenguaje, integración) no arranca en serio hasta que
L llegue al menos a L.4 (los ítems ⚡ restantes son mecánicos y baratos). No abrir un cuarto bloque
nuevo mientras K/L/M sigan con ítems sin cerrar.

**Auditoría previa obligatoria, antes de diseñar nada (2026-07-29):** M.0 no empieza por un esquema
en blanco. Antes de escribir `docs/roadmaps/README.md`, grep/leer qué de esto ya existe para no crear
una segunda fuente de verdad — mismo principio que evitó trabajo redundante en K.4a ("la premisa ya
estaba resuelta, reconstruir hubiera sido puro gasto"): qué cubre ya `description` en `skills/*.yaml`
como condición de disparo, qué detecta ya `defaultChecksFor()`/los resolvers multi-lenguaje (Mes 5),
y qué vive ya en `AGENTS.md`/`CONTEXT.md`. El roadmap solo debe cubrir el hueco real: **el orden**
entre esas piezas, que hoy no existe en ningún lado.

**Contrato de evidencia por sección, no opinión de LLM (2026-07-29):** este bloque nace de la misma
tesis que Bloque K — no confiar en que un LLM "lea y sepa". Sería contradictorio que M.1-M.3
terminen siendo exactamente eso al revés: un LLM escribiendo de memoria "así se testea en Go" sin que
nadie lo corra. Ninguna sección de un perfil de lenguaje se marca `verified` sin citar el comando
exacto ejecutado y su salida real (mismo estándar de cita literal que `qa.ts` exige en K.4a); si el
autor no puede correrlo, el estado correcto es `known` (viene de documentación/entrenamiento, no
verificado en este repo), nunca `verified`.

### M.0 — 🧠 Diseño del sistema de roadmaps (prerequisito)

- [x] **M.0 — 🧠 (2026-07-29)** Auditoría previa completada contra el código real (no asumida):
  `skills/*.yaml` solo cubre instrucciones operativas por tarea (`description`/`when_to_use`), los
  resolvers de lenguaje (`src/graph/resolvers/{rust,go,java,csharp}.ts`, Mes 5/S21) solo resuelven
  imports para el grafo de dependencias, `defaultChecksFor()` ([checks.ts](../../src/run/checks.ts)) hoy
  **no genera ningún check para Rust/Go/Python** (solo `.ts/.tsx/.js/.html`), y `AGENTS.md`/
  `CONTEXT.md` son reglas de colaboración y snapshot de arquitectura de este repo, no una guía
  reutilizable de orden de etapas. Ninguna pieza existente cubre el hueco real: **el orden** entre
  toolchain→build→tests→seguridad→observabilidad→deploy→rollback. Diseño completo, esquema,
  modelo de etapas con prerequisitos (12 etapas, cada una gateada en que la anterior esté
  `verified`/`not-applicable`), 5 estados explícitos (`known/detected/verified/missing/
  not-applicable`) y contrato roadmap↔skill↔checks documentados en
  [docs/roadmaps/README.md](../../docs/roadmaps/README.md). No se creó todavía ningún perfil de lenguaje
  concreto (M.2) ni se conectó a skills/QA (M.4) — explícitamente fuera de alcance de este ítem.
- [x] **M.0-R1 — 🧠 (2026-07-29) Corrección de eje: disciplina/rol reemplaza a lenguaje como capa
  principal.** Motivo, no preferencia: Carlos alimentó primero el vault privado (`MemoriesMD`) con
  roadmaps por disciplina (`wiki/roadmaps/{frontend,backend,qa-seguridad}.md`), anclados en áreas
  profesionales ya existentes (`design-frontend`, `software-quality`; backend ancló en
  `agent-engineering` a falta de área propia), mientras el conocimiento por lenguaje (TypeScript,
  ASP.NET Core, Node.js, Android/iOS, Software Architect) sigue crudo sin destilar en `Clippings/`
  del vault. El diseño debía seguir el trabajo real, no al revés. Cambio: capa 2 pasa a ser
  `docs/roadmaps/disciplines/<disciplina>.md` (eje principal — espejo de `wiki/roadmaps/*.md` del
  vault, promovido vía `/knowledge-promote`, nunca copiado automático); `languages/<lenguaje>.md`
  baja a capa 3, secundaria y acotada a entorno/toolchain/idiomas dentro de una disciplina ya
  definida (no repite auth/testing/caching). El modelo de 12 etapas, los 5 estados explícitos y el
  contrato roadmap↔skill↔checks **no cambiaron** — la corrección es solo de eje, no de rigor.
  Detalle completo en [docs/roadmaps/README.md §9](../../docs/roadmaps/README.md). Cierre original de M.0
  preservado arriba, no borrado — mismo criterio que el resto de PLAN.md con reglas que evolucionan.

### M.1 — ⚡ Guía universal de ingeniería

- [x] **M.1 — (2026-07-29) Guía universal de ingeniería.** Se creó
  [docs/roadmaps/engineering-baseline.md](../../docs/roadmaps/engineering-baseline.md) con el flujo mínimo
  antes de modificar código: dominio/arquitectura, límites de confianza, toolchain, configuración,
  comandos, aceptación, pruebas, datos y deploy. Mantiene los estados `known/detected/verified/
  missing/not-applicable` y exige evidencia de comando para `verified`.
- [x] La guía incluye una matriz mínima de calidad: typecheck/compile, unit, integration, E2E,
  coverage, mutation cuando aplique, seguridad, performance, observabilidad y documentación.
- [x] La guía incluye checklist de cierre: diff/scope, errores/retries, inputs inválidos, secretos,
  migraciones, compatibilidad, logs, rollback y evidencia de comandos ejecutados.
- [x] La guía enseña el orden y permite declarar herramientas inexistentes como `missing` o etapas
  no aplicables como `not-applicable`; no exige que todos los lenguajes usen las mismas herramientas.

### M.2 — ⚡ Perfiles iniciales de disciplina (eje principal, M.0-R1) + lenguaje (secundario)

**Orden actualizado por M.0-R1**: empezar por disciplina, no por lenguaje. La fuente autoral son
los roadmaps ya destilados en el vault (`MemoriesMD/wiki/roadmaps/{frontend,backend,qa-seguridad}.md`)
— promoverlos vía `/knowledge-promote` a `docs/roadmaps/disciplines/*.md`, con propuesta/diff y
confirmación explícita de Carlos por cada uno, no copiarlos automático. Recién después, y solo si
un proyecto concreto lo necesita, crear el perfil de lenguaje angosto correspondiente.

- [x] **M.2.1 — (2026-07-29) Promover roadmaps de disciplina desde el vault.** Se promovieron los
  seis roadmaps ya organizados en `MemoriesMD/wiki/roadmaps/` a
  [docs/roadmaps/disciplines/](../../docs/roadmaps/disciplines/): `backend`, `frontend`, `qa-seguridad`,
  `architecture`, `devops` y `ai-agents`. La promoción conserva la fuente, fecha y estado global;
  cada contenido entra como `known`, nunca como `verified`, hasta ejecutarse contra un proyecto real.
  Se incorporaron explícitamente buenas prácticas de API/SQL, seguridad, performance, system design,
  AWS/operación y agent loop/tool security. No se promovieron los perfiles de lenguaje secundarios
  ni se conectaron todavía skills/QA (M.2/M.4 restantes).
- [x] **M.2.2 — (2026-07-29) Perfiles secundarios de lenguaje.** Se crearon perfiles versionados y
  angostos para TypeScript/Bun, Rust y Go en
  [docs/roadmaps/languages/](../../docs/roadmaps/languages/). Cada uno distingue lenguaje, runtime,
  package/dependency manager, framework, persistencia y tipo de entrega sin duplicar las disciplinas.
  TypeScript/Bun queda `detected` con evidencia real; Rust queda `known` y Go `detected` solo por un
  fixture, con las herramientas de producción ausentes marcadas `missing`.
- [x] Rust: el perfil cubre `cargo`/`Cargo.toml`, edición/formato, compilación, tests, documentación,
  errores/resultados, ownership/concurrencia, dependencias y checks de seguridad; `clippy`/auditoría
  no se declaran disponibles sin detección.
- [x] Go: el perfil cubre `go.mod`, formato, `go test`, build, `vet`/static analysis, errores,
  goroutines/race conditions, contexto/timeouts, dependencias y checks de seguridad; herramientas
  ausentes quedan explícitamente `missing`.
- [x] TypeScript/Bun: el perfil cubre runtime/package manager real, typecheck, tests, lint/format,
  bundling, dependencias, secretos, SSRF/XSS y diferencias entre servidor, cliente y scripts.
- [x] Cada perfil incluye sección “No asumir” con comandos alternativos, diferencias entre library/
  service/CLI y qué información debe pedir o detectar OrchestOS.

### M.3 — 🧠 Perfil efectivo del proyecto

- [x] **M.3 — 🧠 (2026-07-29)** Auditoría previa (mismo principio de M.0): `src/detect/{manifest,
  languages,conventions,profile}.ts` YA detecta manifest/runtime/framework/deps, lenguajes políglotas
  con % (`LangStat[]`, top 5) y convenciones — usado hoy por `context update` para AGENTS.md/
  CONTEXT.md. M.3 no reimplementa esto: lo reusa y agrega solo lo que faltaba (disciplina/lenguaje
  de `docs/roadmaps/` aplicable + infraestructura + estado explícito). Nuevo módulo
  [src/detect/roadmap-profile.ts](../../src/detect/roadmap-profile.ts): `buildRoadmapProfile()` combina
  manifest/languages/conventions/commands existentes con detección de disciplinas (backend por
  framework conocido O servidor custom vía patrón de código como `Bun.serve(`/`createServer(`/
  `express()`; frontend por `.html`; qa-seguridad por conteo real de `*.test.*`/`*.spec.*`; devops
  por `.github/workflows`/`Dockerfile`; architecture/ai-agents sin heurística confiable →
  `not-applicable` explícito, no inventado), CI/Docker/DB (por dependencia conocida O uso real de
  `bun:sqlite` en código fuente) y 4 archivos de instrucciones (AGENTS/CLAUDE/CONTEXT/PLAN.md).
  Estados `known/detected/verified/missing/not-applicable` en cada hallazgo — nunca texto sin estado.
  `verified` solo en toolchain: `Bun.version` (introspección real del runtime) y `bunx tsc --version`
  (comando real ejecutado, cae a omitido si no está disponible, nunca bloquea). Perfiles de lenguaje
  se cruzan contra `docs/roadmaps/languages/` por PREFIJO de slug, no nombre exacto — encontró y
  corrigió en el camino que el perfil real de TypeScript quedó nombrado `typescript-bun.md`, no
  `typescript.md`; una búsqueda por nombre exacto lo hubiera marcado `missing` por error.
  `renderProjectProfileMarkdown()` genera `docs/roadmaps/project-profile.md`. CLI:
  `orchestos roadmap show` (lee el archivo cacheado) y `orchestos roadmap check` (re-detecta,
  regenera el archivo, imprime disciplinas/lenguajes/pendientes). **Dogfooding real, no solo unit
  tests**: correr `orchestos roadmap check` contra OrchestOS mismo destapó un bug de heurística
  (backend salía `not-applicable` porque el dashboard usa `Bun.serve` custom, no un framework npm
  conocido) — corregido agregando detección por patrón de código, no solo por dependencia declarada.
  19 tests nuevos en [roadmap-profile.test.ts](../../src/__tests__/roadmap-profile.test.ts) (fixtures
  aislados en `mkdtempSync` + 2 casos de dogfooding contra `process.cwd()` real). Verificación:
  `bun test src/__tests__/roadmap-profile.test.ts` (`19 pass`, `0 fail`, `38 expect() calls`),
  `bun run typecheck` limpio, suite completa `1002 pass`, `0 fail`, `2278 expect() calls` en `96`
  archivos. **Limitación honesta, no resuelta**: `ai-agents` sale `not-applicable` para OrchestOS
  mismo (un orquestador de agentes) porque la heurística solo busca SDKs de terceros (`@anthropic-ai/
  sdk`, `openai`, etc.) en dependencias — OrchestOS llama proveedores por HTTP directo, sin SDK
  declarado. Documentado en el código y acá en vez de forzar una heurística débil que invente un
  `detected` sin evidencia real.

### M.4 — ⚡ Integración con skills, prompts y QA

- [x] Hacer que una tarea de implementación cargue el roadmap relevante junto con la skill, sin
  duplicar instrucciones ni inflar innecesariamente el contexto del LLM.
- [x] Convertir los pasos verificables del roadmap en `verifiers`/checks deterministas cuando sea
  posible; registrar el comando, exit code, duración y versión utilizada.
- [x] Si el roadmap declara un check obligatorio no disponible, el resultado debe ser `blocked` o
  `missing`, nunca `pass` por omisión. El QA-LLM puede evaluar calidad, pero no sustituye comandos
  faltantes ni inventa evidencia.
- [x] Añadir tests de selección: proyecto Rust → perfil Rust; proyecto Go → perfil Go; mixto → perfiles
  combinados; comando ausente → estado explícito; override del proyecto → gana al default.

  Implementado en `src/roadmaps/context.ts` y el middleware de enrichment: el roadmap seleccionado
  se inyecta después de la skill, con límites de 4k por perfil, 3k por documento y 12k total. El
  proyecto puede declarar inclusiones/exclusiones en `docs/roadmaps/project-overrides.yaml`; el
  override actual selecciona explícitamente `architecture` y `ai-agents` para OrchestOS porque la
  heurística no puede inferir esas disciplinas con seguridad. `cargo test` y `go test ./...` se
  agregan como checks cuando hay manifiesto y toolchain verificado; cada resultado conserva comando,
  exit code, duración y versión observada. Si falta el toolchain para un output Rust/Go, la tarea
  queda `blocked` antes del LLM y el contexto registra `missing/blocked`, nunca `pass`.
  Tests: `src/__tests__/roadmap-context.test.ts` (4 casos Rust/Go/mix/override/missing), más
  `roadmap-profile.test.ts` y `checks.test.ts`. Verificación M4: `bunx tsc --noEmit` limpio y
  `bun test src/__tests__/roadmap-context.test.ts src/__tests__/checks.test.ts src/__tests__/roadmap-profile.test.ts`
  (51 pass, 0 fail).

### M.5 — 🔍 Gate de onboarding técnico

- [x] **M.5 — 🔍 (2026-07-29)** Flujo completo probado con `orchestos roadmap check` +
  `loadRoadmapContext()` reales (no simulados) contra 3 fixtures: OrchestOS mismo, y dos proyectos
  nuevos creados para este gate —
  [tests/fixtures/roadmap-onboarding/rust-hello](../../tests/fixtures/roadmap-onboarding/rust-hello)
  (`Cargo.toml` + `src/main.rs` con test inline `#[cfg(test)]`) y
  [.../go-hello](../../tests/fixtures/roadmap-onboarding/go-hello) (`go.mod` + paquete con `_test.go`
  real). Cada fixture recibió una copia puntual de los docs de disciplina/lenguaje relevantes
  (`qa-seguridad.md` + `rust.md`/`go.md`) para poder probar el flujo de selección/consumo end-to-end
  — no hay todavía un mecanismo que provisione esto automáticamente (hallazgo, ver abajo).

  **Bug real encontrado y corregido por el gate** (el tercero de esta cadena, tras los 2 de M.3):
  la detección de `qa-seguridad` solo reconocía la convención JS/TS (`*.test.ts`/`*.spec.js`) —
  ambos fixtures, con tests reales, salían `missing`. Se agregó reconocimiento de `_test.go` (Go) y
  de `#[cfg(test)]`/directorio `tests/` (Rust) en
  [roadmap-profile.ts](../../src/detect/roadmap-profile.ts) (`findTestSignals()`). 2 tests de regresión
  nuevos confirman ambas convenciones.

  **Checklist del desarrollador nuevo, verificado contra el contenido real de cada doc** (no
  supuesto): `docs/roadmaps/languages/{rust,go}.md` responden qué instalar (`rustc`/`cargo`,
  `go`/módulos), cómo compilar/formatear, cómo testear (`cargo test`, `go test ./...`), seguridad
  (`cargo audit`/`govulncheck`, con nota explícita de que ausencia = `missing`, no se asume), y cada
  uno tiene sección "No asumir" que impide tratar el lenguaje como garantía de tooling. Deploy/
  rollback viven en la disciplina `devops.md`, no en el perfil de lenguaje — confirmado que no se
  duplica contenido entre capas.

  **Verificación en vivo de que nada se inventa** (sin `rustc`/`cargo`/`go` instalados en esta
  máquina): tanto el CLI como `loadRoadmapContext()` muestran `toolchain Rust`/`toolchain Go` como
  `missing` de punta a punta para ambos fixtures — el sistema completo (detección → selección →
  contexto de tarea) nunca produce un `verified` falso cuando el comando real no existe.

  **2 límites reales encontrados y documentados, NO resueltos en este gate** (decisión pendiente de
  Carlos, no de un LLM): (1) `orchestos init` no provisiona `docs/roadmaps/` en un proyecto nuevo —
  hoy el sistema solo tiene contenido real para OrchestOS mismo; (2) el presupuesto de 12k chars de
  `loadRoadmapContext` (M.4) ya no alcanza para las 6 disciplinas + lenguajes que aplican a
  OrchestOS mismo — se recorta con `missing` visible (nunca en silencio), pero el recorte es real.
  Ambos anotados en [CONTEXT.md § Invariante roadmap](../../CONTEXT.md).

  Resumen copiado a [DONE.md § Mes 24](../../DONE.md). Verificación: `bun run typecheck` limpio, suite
  completa `1010 pass`, `0 fail`, `2303 expect() calls` en `98` archivos.

**Regla de evolución:** cuando aparezca un nuevo lenguaje o framework, primero se crea/actualiza su
perfil y fixture; después se permite convertirlo en skill automática. Los hallazgos se documentan en
este bloque antes de modificar el motor. Así OrchestOS aprende de forma acumulativa y no depende de
que Carlos o un LLM recuerden todos los protocolos en cada sesión.

---

