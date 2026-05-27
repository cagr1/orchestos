# IDEAS.md — OrchestOS

Sumidero de ideas fuera de scope del mes activo.
Lo que ya se implementó → ver [DONE.md](DONE.md) Sección 2.

---

## 💡 Pendiente — Mes 5

### Sandbox por tarea (git worktree)

Cada tarea corre en un worktree aislado. Si QA falla, el worktree se descarta.
Elimina la necesidad de `restoreContents`.

**Prerequisito**: harness separado ✅

---

### `orchestos spec <id>` — Spec-Driven flow

Paso que falta del flujo completo: `constitución ✅ → spec → clarify ✅ → plan → validar ✅ → tareas → ejecutar`

`orchestos spec create <id>` — escribe una descripción aprobada antes de ejecutar.
El harness rechaza ejecutar si la tarea no tiene spec aprobado.
Diferencia con `description`: spec es declaración explícita de intención firmada.

**Prerequisito**: CONSTITUTION.md ✅ + clarify ✅ + harness ✅

---

### Sub-agentes con contextos aislados

Una tarea "plan" genera sub-tareas. Cada sub-tarea tiene su propio contexto y QA stage.

**Prerequisito**: harness ✅ + scheduler robusto + sandbox (worktrees)

---

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

## Feedback
_(se llena cuando haya un usuario externo real usando orchestos en su proyecto)_
