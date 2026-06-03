# IDEAS.md — OrchestOS

Sumidero de ideas fuera de scope del mes activo.
Lo que ya se implementó → ver [DONE.md](DONE.md) Sección 2.

---

## 🧭 Índice por prioridad (2026-06-03)

Orden de importancia, no de implementación. La dirección de producto pesa más que
features sueltas porque define para quién es la herramienta.

### Tier 0 — Dirección de producto (mayor impacto estratégico)
1. **Muro del cold-start / API key** — el verdadero bloqueo del no-dev. Todo lo demás vive río abajo. (I3/I4 en PLAN + wizard humano que explique qué es una key y dónde sacarla)
2. **Superficie humano vs operador ("modo colaboración")** — la herramienta cambia de trato según el usuario, un solo motor. [Mes 10+]
3. **VISION.md — frase raíz** — brújula de la que cuelga todo.
4. **Landing page / "empieza aquí"** — cara pública de la frase raíz + ruteo. Complementa el onboarding, no lo reemplaza.
5. **Control Center** — evolución de I2 Setup a salud continua.
6. **Vista editable de "lo que OrchestOS sabe del proyecto"** — superficie sobre CONSTITUTION/CONTEXT.
7. **Exponer diagnóstico de fallos en el dashboard** — el motor ya existe (S25+S34), falta UI.

### Tier 1 — Capacidad técnica con ROI (pendientes reales)
8. Resolver imports relativos en Graph (lenguajes no-JS)
9. autoskills — registry de skills por lenguaje/framework
10. Clasificador semántico para `clarify` (solo si hay evidencia de falsos negativos)

### Tier 2 — Largo plazo / esperar evidencia
11. KuzuDB — upgrade del graph (no antes de 10K+ nodos)
12. Onboarding adaptativo "¿sabes programar?" (se funde con Tier 0 #2)

### ⚠️ Stale — ya shipeado, migrar a DONE
- ~~Embeddings semánticos en suggestContext~~ → **S24 ✅** (Mes 6)
- ~~Agente de diagnóstico de fallos~~ → **S25 ✅** (Mes 6)
- ~~Function calling para el planner~~ → **S23 ✅** (Mes 6)
- _(las fichas detalladas siguen abajo por contexto histórico — no son backlog)_

### 📚 Referencia (no es backlog)
- Inspiración externa: DeerFlow · ECC · Engram · gentle-ai · OpenSpec

---

## 💡 Pendiente — Mes 6 (ideas de Mes 5 que no entraron)

### Resolver imports relativos en Graph (lenguajes no-JS)

Hoy solo JS/Python tienen resolución de paths relativos en `code_edges`.
Para C#, Rust, Go, Java, Ruby → los imports se guardan pero `to_file_id` siempre queda `null`.

**Trabajo**: extender `resolveImport()` con lógica por extensión de archivo.

---

### autoskills — Registry de skills por lenguaje/framework

**Referencia**: `npx autoskills` — repo de midudev: https://github.com/midudev/autoskills

**Problema que resuelve**: `skill scaffold` genera YAML genérico local. Con autoskills
se descargaría una skill curada por la comunidad para ese lenguaje/framework específico.

**Integración propuesta**:
```bash
orchestos skill fetch --language rust          # descarga rust-development de autoskills registry
orchestos skill fetch --framework nextjs       # descarga nextjs-development
orchestos skill fetch --list                   # lista skills disponibles en el registry
```

**Flujo completo**:
1. `task run --explain <id>` detecta lenguaje del proyecto
2. Si ninguna skill local tiene `language_targets.<lang>` → avisa al usuario
3. Usuario elige: `skill scaffold` (local, genérico) ó `skill fetch` (registry, curado)
4. Skill descargada en `skills/<id>.yaml` → editable localmente

**Decisión pendiente**: ¿registry propio o wrappear autoskills como fuente?

**Prerequisito**: `skill scaffold` ✅ implementado como base local.

---

## 💡 Pendiente — Mes 6 (IA específica con ROI demostrable)

### Embeddings semánticos en `suggestContext`

**Problema real**: `context suggest` usa scoring por keywords. Si la tarea dice "implementar pago con Stripe" y el archivo clave es `src/billing/processor.ts` sin la palabra "stripe", no lo encuentra.

**Solución**: reemplazar el scoring actual con cosine similarity sobre embeddings, manteniendo la misma interfaz CLI.

**Implementación mínima** (sin cambiar ninguna API pública):
1. Columna `embedding TEXT` (JSON array) en tabla `files`.
2. En `indexProject()`: si el archivo no tiene embedding o SHA1 cambió → llamar al provider de embeddings y guardar.
3. En `suggestContext()`: embedding del texto de la tarea → cosine similarity → re-rank combinado con graph traversal actual.
4. Flag `--no-embed` en `orchestos index` para proyectos sin API key.

**Costo**: `text-embedding-3-small` ≈ $0.02/1M tokens. 500 archivos × 500 tokens = $0.005 total, indexado una vez. Dedup por SHA1 — no se regenera si el archivo no cambió.

**Abstracción**: definir `EmbeddingProvider` interface (como `ProviderClient`) con implementaciones OpenAI + Ollama local (nomic-embed).

**Métrica de éxito**: % de runs donde al menos un archivo de `suggested_context` termina en `files_authorized`. Measurable con las columnas que ya existen en la tabla `runs`.

**Prerequisito**: CLI estable Mes 5 ✅ + columna `suggested_context` en `runs`.

---

### Agente de diagnóstico de fallos

**Problema real**: cuando un task llega a `failed_permanent` (3 retries), no hay forma automática de saber por qué. El usuario tiene que leer `runs --detail` manualmente y adivinar qué cambiar.

**Solución**: activado automáticamente al llegar a `failed_permanent`, un LLM (haiku) lee los últimos 3 runs del task, analiza el patrón (¿check? ¿QA? ¿parse error? ¿criterio específico?) y devuelve sugerencias concretas para modificar la task definition.

**No ejecuta nada** — solo sugiere. El usuario decide si aplica.

**Output ejemplo**:
```
Task 'add-payment-service' falló 3 veces.

Patrón detectado: QA falla siempre en criterio #2 ("debe incluir manejo de errores").
Sugerencia: añade a acceptance_criteria: "El archivo debe tener un bloque try/catch alrededor de la llamada a Stripe".
```

**Comando**: `orchestos task diagnose <id>` o automático en `task run --all` al llegar a `failed_permanent`.

**Métrica de éxito**: % de tareas que pasan en el siguiente intento después de aplicar una sugerencia del agente.

**Prerequisito**: S22 cerrado + tabla `runs` con criterios individuales almacenados.

---

### Function calling para el planner de S22

**Problema real**: el planner de S22 devuelve YAML con `subtasks: [{id, description, acceptance}]`. Los LLMs generan YAML con errores de indentación o comillas que rompen el parser.

**Solución**: en lugar de pedir YAML libre, usar function calling con schema estricto:
```typescript
tools: [{ name: "create_subtask", input_schema: { properties: { id, description, acceptance[] } } }]
```

El LLM llama a `create_subtask` N veces. Cada call es validada por el SDK antes de llegar al código.

**Solo para providers que lo soporten**: anthropic + openai. Para openrouter depende del modelo — verificar en tiempo de ejecución y caer al parser YAML como fallback.

**Prerequisito**: S22.1–S22.2 definidos.

---

## 💡 Pendiente — Mes 5+ / largo plazo

### KuzuDB — upgrade del graph

Migrar `code_edges` + `files` a KuzuDB (embebible, Cypher, Rust) cuando el grafo llegue a 10K+ nodos.
Hoy con SQLite y regex es suficiente. No antes de tener evidencia real de escala.

---

### Clasificador semántico para clarify

Hoy `needsClarify` es heurística de palabras clave (verbo ambiguo + sin input[]).
Con un LLM call extra (barato, haiku) se podría detectar ambigüedad real semánticamente.

**Costo**: un call extra por task run. Solo vale la pena si hay evidencia de falsos negativos.

---

## 🎯 VISIÓN A LARGO PLAZO — Dashboard + acceso universal

> "Cualquier persona debe poder usar esta herramienta sin saber de código."
> — Carlos Gallardo, 2026-05-27

### Por qué el dashboard está prohibido ahora

El CLI primero no es un límite — es la fundación. Cada botón del dashboard futuro
es un comando CLI que ya existe. Si el CLI no es sólido, el dashboard no tiene base.

**Regla**: dashboard después de CLI estable + al menos 1 usuario real que lo usa.

---

### [MES 6+] Dashboard — capa visual sobre el CLI existente

Interfaz web o desktop que expone los comandos del CLI como botones, formularios y vistas.
No reemplaza el CLI — lo envuelve.

| CLI | UI equivalente |
|-----|---------------|
| `orchestos init <path>` | Botón "Nuevo proyecto" + selector de carpeta |
| `orchestos task list` | Tabla de tareas con estado visual |
| `orchestos task run --explain <id>` | Modal "Vista previa antes de ejecutar" |
| `orchestos task run --id <id>` | Botón "▶ Ejecutar esta tarea" |
| `orchestos runs --detail <id>` | Panel de evidencia expandible |
| `orchestos context suggest "<text>"` | Input libre → lista de archivos sugeridos |
| `orchestos skill list` | Galería de skills con descripción |

**Stack recomendado** (a decidir en su momento):
- Electron — desktop, acceso a filesystem nativo, sin servidor. Más cercano al CLI.
- Tauri + Next.js — si se quiere distribuir como app instalable multiplataforma.
- NO SaaS hasta tener 10+ usuarios que lo pidan explícitamente.

**Prerequisito**: CLI completo hasta Mes 5 + al menos 1 usuario externo real.

---

### [MES 7+] Onboarding adaptativo — ¿sabes programar?

Wizard de primera vez que genera `tasks.yaml` + `CONSTITUTION.md` + `checks[]`
en lenguaje natural, sin que el usuario sepa qué es un executor o un YAML.

**La diferencia clave**: Claude Code, Cursor, Copilot asumen que el usuario sabe programar.
orchestos puede ser la primera herramienta de agentes que funcione para alguien
que nunca abrió una terminal.

**Prerequisito**: dashboard funcional (Mes 6) + spec-driven flow (Mes 5).

---

---

## 🪞 Revisión de producto externa (2026-06-03)

> Crítica externa al cerrar el primer ciclo de dashboard usable. Fuerte en narrativa
> y arquitectura de información, débil en ingeniería (no conocía lo ya shipeado).
> Aquí queda **solo lo genuinamente nuevo**, con nota de qué ya existe para no reconstruir.

**Filtro aplicado** — descartado por ya estar hecho:
- "Fallos enseñables" → ya: S25 (diagnóstico auto) + S34 (runs→instincts). Falta solo *exponer en UI* (ver F-abajo).
- "Health center" → ya: I1/I2 Setup. El delta real es *salud continua* (ver entry Control Center).
- "Renombrar instincts → Hábitos" → ya: E1.
- "Project Brief" → ya existe como archivos: CONSTITUTION.md + CONTEXT.md. Falta solo *vista editable* (ver entry).
- "Modo simple encima del modo complejo" → **rechazado**: duplica UIs. La forma correcta es degradar/agrupar, no construir una segunda interfaz (ver entry humano/operador).

---

### [Mes 10+] Arquitectura de información: superficie humana vs operador

**El aporte más valioso de la review.** Alinea con la tesis raíz (línea 130: "cualquier
persona sin saber de código"). Hoy el sidebar expone Runs · Specs · Instincts · Memory
como ítems hermanos — todas abstracciones internas que un no-dev no entiende.

**NO** es construir dos UIs paralelas (eso duplica mantenimiento). Es **una sola IA de
navegación con jerarquía**:
- **Superficie por defecto (humano)**: qué quieres lograr · qué está pasando · qué aprendió · qué necesita tu aprobación.
- **Superficie avanzada (operador, detrás de un toggle)**: Runs, cost breakdown, memory conflicts, spec lint, evidencia cruda.

El poder no se quita — se **degrada de prominencia** hasta que se necesita.

**Decisión pendiente**: ¿toggle global "modo avanzado" en Settings, o progressive
disclosure por pantalla (cada vista tiene su "ver detalle técnico")?

**Prerequisito**: dashboard Mes 9 estable. NO antes — es una decisión estructural, no un parche.

---

### VISION.md — frase raíz del producto

No existe un documento de narrativa. La "VISIÓN A LARGO PLAZO" está dispersa en tablas
de comandos. Falta una brújula de una frase de la que cuelgue todo lo demás.

**Borrador a refinar** (no copiar literal — es lista de features disfrazada de frase):
> "OrchestOS convierte una intención humana en trabajo verificable de agentes,
> con memoria, contratos y evidencia."

**Contenido mínimo de VISION.md**: qué problema resuelve · para quién · qué lo hace
distinto · flujo ideal · **qué NO es**. Brújula, no marketing.

**Por qué importa**: si alguien nuevo pregunta "¿qué es OrchestOS?", hoy la respuesta
técnica es demasiado larga. La frase raíz es el test de si el producto está claro.

---

### Control Center — evolución de I2 Setup a salud continua

I1/I2 resuelven el setup *de una vez*. El delta nuevo: una vista de **estado vivo** que
responde, en cualquier momento:
- ¿Está listo para trabajar? ¿Qué falta?
- ¿Qué tareas están bloqueadas?
- ¿Qué espera aprobación humana? (instincts propuestos, specs en draft)
- ¿Qué está costando dinero? (cost acumulado, runs caros)
- ¿Qué aprendió recientemente?

**No es pantalla nueva desde cero** — es extender la Setup screen (I2) de checklist
estático a dashboard de salud. Reusa datos que ya existen: tasks, runs, instincts, costs.

**Prerequisito**: I2 cerrado.

---

### Vista editable de "lo que OrchestOS sabe del proyecto"

CONSTITUTION.md y CONTEXT.md ya existen como archivos. Falta una vista humana editable
que los exponga sin que el usuario abra un .md: propósito · stack · reglas importantes ·
tono/preferencias · archivos críticos · **lo que no debe tocar**.

**Trabajo**: pantalla que lee/escribe esos dos archivos vía API (similar a Settings →
.env). No es capacidad nueva — es superficie editable sobre archivos existentes.

---

### Exponer diagnóstico de fallos en el dashboard

El motor ya existe (S25 auto-trigger en `failed_permanent` + S34 propone instincts).
Hoy solo se ve por CLI (`runs --detail`, `task diagnose`). Falta surface en UI:

Cuando una tarea llega a `failed`: "qué intentó · por qué falló · qué cambiaría ·
[convertir en hábito] · [reintentar con esta corrección]".

**Trabajo**: panel en la pantalla Tasks/Runs que llama a la lógica de diagnóstico ya
implementada. **No tocar el motor** — solo conectar UI a lo que ya devuelve.

---

### Landing page / "empieza aquí" — puerta de entrada y ruteo

**Referencia**: modelo openclaw — entrada orientada a tareas, "ve directo a lo que necesitas".

**Qué resuelve**: el "¿por dónde empiezo?". No es marketing — es **ruteo**.
- **No-dev**: lo lleva directo a *conectar* · *crear primera tarea* · *entender qué es esto*, sin leer un README técnico.
- **Dev**: referencia rápida, va directo a comandos/flujos sin onboarding.

**Relación con VISION.md**: misma fuente, dos formatos. VISION.md = brújula interna ·
landing = cara pública. Escribir VISION.md primero; la landing es su proyección.

**Condición crítica (no negociable)**: la landing **NO reemplaza** arreglar el muro del
API key dentro del producto (Tier 0 #1). Si la puerta es bonita pero el primer run igual
pide una "key" que el usuario no entiende, solo hiciste un camino más lindo al mismo muro.
La landing va *al lado* del onboarding, nunca encima.

**Decisión pendiente**: ¿estática (parte del repo, sirve el dashboard server) o
documentación viva que refleje el estado real del proyecto conectado?

**Prerequisito**: VISION.md redactado + decisión sobre el wizard de onboarding.

---

---

## 🔬 Inspiración externa — repos analizados

### Estado de patrones extraídos

| Patrón | Repo | Estado |
|--------|------|--------|
| Middleware chain ordenado | DeerFlow | ✅ S31 — `src/run/middleware.ts` + middlewares/ |
| Skills con tool policy (`allowed_tools`) | DeerFlow | ✅ S22.0.1 |
| Memoria estructurada en capas | DeerFlow | ✅ parcial — `memory_entries` S22.0.3 |
| Subagent executor con status tracking | DeerFlow | ✅ S22 |
| Instincts con confidence scoring | ECC | ✅ S33 — `src/instincts/` |
| Context monitor hook | ECC | ✅ S27 — wired en harness, persiste en DB |
| Continuous learning v2 (hooks→instincts) | ECC | ✅ S34 — `analyze/propose.ts` |
| Cost tracker via transcript parsing | ECC | ✅ S35 — `src/run/transcript-parser.ts` |
| Detección de conflictos via BM25 | Engram | ✅ S26 |
| `topic_key` upsert (no duplicar) | Engram | ✅ S22.0.3 |
| DAG con contratos Read/Write | gentle-ai | ✅ S22.0.2 + scheduler |
| apply-progress continuity | gentle-ai | ✅ S22.5a |
| Reglas de delegación con umbrales | gentle-ai | ✅ docs/AGENTS.md |

---

### DeerFlow (ByteDance) — `github.com/bytedance/deer-flow`

**Repo**: https://github.com/bytedance/deer-flow  
**Stack**: Python · LangGraph · LangChain · FastAPI  
**Stars**: ~70K | "SuperAgent harness" para tareas de minutos a horas

#### 4 patrones directamente aplicables a OrchestOS

**1. Middleware chain ordenado**  
14 middlewares con orden fijo y responsabilidad única. Cada middleware se puede reemplazar por instancia custom o desactivar con feature flag. Implementado en:
- `backend/packages/harness/deerflow/agents/lead_agent/agent.py` — `_build_middlewares()`
- `backend/packages/harness/deerflow/agents/factory.py` — `_assemble_from_features()`

Orden relevante para OrchestOS: `DanglingToolCall → ToolErrorHandling → Summarization → Todo → Memory → SubagentLimit → LoopDetection → Clarification (siempre último)`

**2. Skills con tool policy (`SKILL.md` + `allowed_tools`)**  
Cada skill = directorio con `SKILL.md` (descripción) + lista `allowed_tools`. El agente solo ve las tools autorizadas para esa skill — es una política de seguridad. Categorías `public` (bundled) y `custom` (usuario).  
- Implementado en: `backend/packages/harness/deerflow/skills/types.py` + `tool_policy.py`
- Aplicable en OrchestOS: restringir qué tools puede usar cada skill definida en `skills/*.yaml`

**3. Memoria estructurada en capas**  
En lugar de un blob genérico, divide la memoria en:
```json
{
  "user": { "workContext", "personalContext", "topOfMind" },
  "history": { "recentMonths", "earlierContext", "longTermBackground" },
  "facts": []
}
```
- Implementado en: `backend/packages/harness/deerflow/agents/memory/storage.py`
- Aplicable en OrchestOS: separar memoria de sesión corta, media y larga en lugar del contexto plano actual

**4. Subagent executor con status tracking**  
`ThreadPoolExecutor` + `asyncio`. Cada subagente tiene `SubagentResult` con estados (`PENDING → RUNNING → COMPLETED / FAILED / TIMED_OUT`) y `cancel_event` para cancelación limpia.  
- Implementado en: `backend/packages/harness/deerflow/subagents/executor.py`
- Aplicable directamente en **S22** (sub-agentes con contextos aislados)

#### Lo que NO aplica
- Atado a LangGraph/LangChain — OrchestOS tiene protocolo propio
- Sandbox Docker — overkill para el estado actual
- Auth/JWT gateway — específico a su SaaS

---

### ECC (affaan-m) — `github.com/affaan-m/ECC`

**Repo**: https://github.com/affaan-m/ECC  
**Stack**: JavaScript · Node.js · Python (hooks)  
**Stars**: ~197K | Sistema de operaciones para harnesses (Claude Code, Cursor, Codex, Gemini, Zed)

#### 4 patrones directamente aplicables a OrchestOS

**1. Instincts — comportamientos atómicos con confidence scoring**  
Evolución de las skills: en lugar de archivos monolíticos, cada instinct es una sola acción con peso:
```yaml
id: prefer-functional-style
trigger: "when writing new functions"
confidence: 0.7       # 0.3 tentativo → 0.9 casi certero
domain: code-style
scope: project        # o global — aislado por proyecto
evidence: [...]       # qué observaciones lo crearon
```
Instincts se agrupan automáticamente en skills/comandos cuando se repiten. Proyecto-scoped por defecto; promueve a global si aparece en 2+ proyectos.
- Implementado en: `skills/continuous-learning-v2/SKILL.md` + `.claude/homunculus/instincts/`
- Aplicable en OrchestOS: skills actuales (`skills/*.yaml`) podrían evolucionar a instincts atómicos que el harness aprende del proyecto real

**2. Context monitor hook — vigilancia activa del agente en cada tool call**  
`PostToolUse` hook que lee métricas de bridge e inyecta warnings al agente:
- Contexto < 35% → warning; < 25% → crítico
- Costo > $5 → notice; > $10 → warning; > $50 → crítico
- Mismo tool llamado 3+ veces seguido → loop detection
- Archivos modificados > 20 → scope creep warning

Usa debounce (cada 5 calls) para no saturar. Escritura atómica de estado para evitar race conditions entre subprocesos.
- Implementado en: `scripts/hooks/ecc-context-monitor.js`
- Aplicable en OrchestOS: runs largos de S22 necesitan exactamente esto — avisar al agente antes de que se quede sin contexto o entre en loop

**3. Continuous learning v2 — aprender de transcripts via hooks**  
Lección clave documentada explícitamente en el repo:
> *"v1 usaba skills para observar. Skills son probabilísticas (50-80%). v2 usa hooks — 100% confiable. Un agente Haiku analiza en background."*

Pipeline: `PreToolUse/PostToolUse → observations.jsonl → Haiku analiza → instinct con confidence → cluster → skill/comando/agent`

OrchestOS ya guarda todo en `runs`. Añadir análisis al final de cada run para extraer instincts del proyecto es viable sin cambiar el esquema actual.
- Implementado en: `skills/continuous-learning-v2/` + `scripts/hooks/evaluate-session.js`
- Aplicable en OrchestOS: `task run` al llegar a `completed` → analiza el run → propone instinct si detecta patrón nuevo

**4. Cost tracker via transcript parsing**  
Lee `transcript_path` del Stop hook, suma tokens de cada turn del JSONL. Si existe archivo de costo authoritativo del harness (TTL 300s) lo prefiere sobre el cálculo propio. Guarda a `costs.jsonl` con filas por sesión.  
Relevante para S22: cuando corramos N sub-agentes en paralelo, cada `SubagentResult` debería incluir costo real acumulado.
- Implementado en: `scripts/hooks/cost-tracker.js`
- Aplicable en OrchestOS: sumar costo por run y por tarea — columna `cost_usd` en tabla `runs`

#### Lo que NO aplica
- Reglas por harness (`.cursor/rules`, `.codex/`, `.gemini/`) — OrchestOS no es un harness
- Plugin marketplace — prematuro
- Sistema de instalación multi-plataforma — irrelevante

---

### Engram (Gentleman-Programming) — `github.com/Gentleman-Programming/engram`

**Repo**: https://github.com/Gentleman-Programming/engram  
**Stack**: Go · SQLite + FTS5 · MCP server · HTTP API · TUI  
**Stars**: ~3.8K | Sistema de memoria persistente agnóstico de harness

#### Veredicto: útil pero enfocado — solo 2 patrones aplican directamente

Engram no es un framework de agentes ni un harness. Es exclusivamente un motor de memoria persistente. OrchestOS ya tiene SQLite y un sistema de memoria propio, así que no se adopta el binario sino los patrones de diseño de su motor interno.

**1. Detección de conflictos en memoria via BM25**  
Cuando un agente guarda una nueva observación, Engram busca automáticamente candidatos similares con FTS5 (BM25 scoring) y los marca como posibles conflictos. Luego un LLM judge decide la relación:
```
conflict_with | supersedes | compatible | scoped | related | not_conflict
```
Esto resuelve el problema que va a aparecer en S22: cuando múltiples sub-agentes escriben memorias del mismo proyecto, inevitablemente se contradicen. Sin detección de conflictos, la memoria se corrompe silenciosamente.
- Implementado en: `internal/store/relations.go` + `internal/mcp/mcp.go` (herramienta `mem_judge`)
- Aplicable en OrchestOS: al hacer `memory.save()` desde cualquier agente, correr BM25 contra las entradas existentes del proyecto y avisar si hay candidato con score > threshold

**2. `topic_key` — actualizar en lugar de duplicar**  
Cada observación tiene un `topic_key` estable. Si ya existe una entrada con ese key, el nuevo `mem_save` la actualiza en lugar de crear un duplicado. Sin esto, la memoria crece indefinidamente con versiones obsoletas del mismo hecho.  
El patrón aplica directamente a la memoria en capas de DeerFlow que ya está en IDEAS: `workContext`, `personalContext`, `topOfMind` son exactamente topic_keys estables.
- Implementado en: `internal/store/store.go` (`AddPromptIfMissing` / `upsert` por topic_key)
- Aplicable en OrchestOS: añadir campo `topic_key` a la tabla de memoria y hacer upsert en lugar de insert

#### Lo que NO aplica
- El binario Go completo / servidor MCP — OrchestOS tiene su propia capa de comunicación
- Cloud sync y export a Obsidian — demasiado específicos a su caso de uso
- TUI de memoria — prematuro para el estado actual del proyecto

---

### gentle-ai (Gentleman-Programming) — `github.com/Gentleman-Programming/gentle-ai`

**Repo**: https://github.com/Gentleman-Programming/gentle-ai  
**Stack**: Go · SDD workflow engine · multi-harness installer  
**Stars**: ~3.4K | CLI que instala flujos SDD (Spec-Driven Development) en cualquier harness

#### Veredicto: sí vale — 3 patrones directamente aplicables a S22

gentle-ai implementa SDD como un DAG de fases con contratos explícitos de lectura/escritura entre agentes. OrchestOS ya tiene ideas de spec-driven flow y sub-agentes — gentle-ai muestra cómo conectarlos correctamente.

**1. Tabla de dependencias de fases (DAG con contratos Read/Write)**  
Cada fase del pipeline declara exactamente qué artefactos lee y cuáles escribe. Sin esto, las fases corren fuera de orden o con contexto incompleto:

| Fase | Lee | Escribe |
|------|-----|---------|
| `explore` | nada | `explore` |
| `propose` | `explore` (opcional) | `proposal` |
| `spec` | `proposal` (obligatorio) | `spec` |
| `design` | `proposal` (obligatorio) | `design` |
| `tasks` | `spec + design` (obligatorio) | `tasks` |
| `apply` | `tasks + spec + design + apply-progress` | `apply-progress` |
| `verify` | `spec + tasks + apply-progress` | `verify-report` |

Aplicable en OrchestOS: cuando S22 genere sub-tareas desde una tarea padre, cada sub-tarea debería declarar qué artefactos de otras sub-tareas necesita antes de poder correr.
- Implementado en: `internal/assets/claude/sdd-orchestrator.md` (tabla "SDD Phases")

**2. apply-progress continuity — no perder progreso entre batches**  
Cuando una tarea larga se divide en batches, el orquestador DEBE buscar el artefacto `apply-progress` anterior, pasárselo al sub-agente con instrucción explícita de merge, y guardar el resultado combinado. Sin esto, cada batch sobreescribe el anterior.

Protocolo exacto del orquestador:
> *"PREVIOUS APPLY-PROGRESS EXISTS at topic_key 'sdd/{change}/apply-progress'. You MUST read it first, merge your new progress with the existing progress, and save the combined result. Do NOT overwrite — MERGE."*

Aplicable en OrchestOS: `task run` con sub-agentes paralelos → cada sub-agente escribe su progreso parcial con merge, no con insert.
- Implementado en: `internal/assets/claude/sdd-orchestrator.md` (sección "Apply-Progress Continuity")

**3. Reglas de delegación del orquestador con umbrales concretos**  
El orquestador tiene reglas explícitas de cuándo delegar vs hacer inline. Útil como plantilla para la lógica de S22:

| Acción | ¿Inline o delegar? |
|--------|-------------------|
| Leer 1-3 archivos para decidir | inline ✅ |
| Leer 4+ archivos para explorar | delegar |
| Escribir 1 archivo mecánico | inline ✅ |
| Escribir 2+ archivos con nueva lógica | delegar |
| Bash para estado (git, status) | inline ✅ |
| Bash para ejecución (tests, build) | delegar |

Regla adicional: después de ~20 tool calls sin delegación y con complejidad creciente → pausar y delegar en lugar de continuar monolíticamente.
- Implementado en: `internal/assets/claude/sdd-orchestrator.md` (tabla "Delegation Rules")

#### Lo que NO aplica
- El binario Go / instalador multi-harness — OrchestOS no es un harness
- Dependencia de Engram para artefactos — OrchestOS tiene su propia persistencia
- Los adaptadores por harness (Claude/Cursor/Codex adapters)

---

---

## 🔬 Inspiración externa — OpenSpec (Fission-AI)

### OpenSpec — `github.com/Fission-AI/OpenSpec`

**Repo**: https://github.com/Fission-AI/OpenSpec
**Stack**: Markdown schemas · YAML · slash commands (agnóstico de harness)
**Contexto**: recomendado por usuario externo que lo usa hace ~1 año en producción.

**Qué es**: Framework SDD (Spec-Driven Development) que genera una carpeta por feature con 4 artefactos: `proposal.md + specs/*.md + design.md + tasks.md`. Corre sobre cualquier AI assistant (Claude, GPT-4, Copilot).

### Estado de patrones extraídos

| Patrón | Estado |
|--------|--------|
| WHEN/THEN scenarios en acceptance_criteria | ✅ S28 — spec lint + draft prompt |
| Capabilities contract (proposal → sub-tasks) | ✅ S32 — spec draft + frontmatter capabilities |
| Archive de specs completados con fecha | ✅ S29 — spec archive + list --all |
| Delta headers (ADDED/MODIFIED/REMOVED) | ✅ S32 — spec lint delta headers |
| Design.md condicional para tareas complejas | Pendiente — Mes 9+ |

---

#### 3 patrones directamente aplicables a OrchestOS

**1. WHEN/THEN scenario format en `acceptance_criteria`**
Hoy OrchestOS guarda `acceptance_criteria[]` como strings libres. El QA LLM los evalúa sin estructura. OpenSpec obliga el formato:
```
#### Scenario: <nombre>
WHEN [condición observable]
THEN [resultado esperado]
```
Con normativa SHALL/MUST (no "should" ni "may").

**Aplicable en OrchestOS**: `orchestos spec draft` podría generar criterios con este formato. El QA prompt recibiría escenarios estructurados → evaluación más precisa y reproducible. Las discrepancias de QA bajarían porque el criterio es menos ambiguo.
- **Prerequisito**: S20 ✅ + spec.ts conoce el formato de body

**2. Capabilities contract (propuesta → sub-tareas)**
En el `proposal.md` de OpenSpec hay una sección `Capabilities:` que lista explícitamente qué specs se van a crear. Esto crea un contrato verificable: si el proposal dice `add-payment-service` y `add-webhook-handler`, deben existir esos dos archivos de spec.

**Aplicable en OrchestOS**: cuando `orchestos task run --expand <id>` llama al planner, podría leer la sección `capabilities:` del spec aprobado para pre-seeding los sub-tasks. Actualmente el planner genera sub-tasks desde cero desde la descripción — con el capabilities contract, las sub-tasks tendrían nombres predecibles y el spec ya define cuántas hay.
- **Prerequisito**: S20 ✅ + S23 (planner) ✅

**3. Archive de specs con fecha**
Cuando una tarea llega a `completed` y se mergea, el spec queda en `.orchestos/specs/{id}.md` sin señal de que está terminado salvo el campo `status`. OpenSpec mueve el artefacto a `archive/{date}-{id}/`.

**Aplicable en OrchestOS**: `orchestos spec archive <id>` — mueve el spec a `.orchestos/specs/archive/YYYY-MM-DD-{id}.md`. El harness podría llamarlo automáticamente post-merge. Beneficio: `spec list` queda limpio de specs completados, y el historial es auditable por fecha.
- **Prerequisito**: S20 ✅

#### Lo que NO aplica
- El sistema completo de carpetas por feature — OrchestOS usa task IDs, estructura plana es más simple
- Los slash commands `/opsx:*` — OrchestOS tiene su propio CLI
- `IMPLEMENTATION_ORDER.md` — `depends_on` en tasks.yaml es más programático
- Integración con 25+ herramientas — OrchestOS es agnóstico de harness por diseño

---

## Feedback
_(se llena cuando haya un usuario externo real usando orchestos en su proyecto)_
