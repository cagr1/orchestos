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
