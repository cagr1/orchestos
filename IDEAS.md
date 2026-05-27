# IDEAS.md — OrchestOS

Sumidero de ideas fuera de scope del mes activo.
Lo que ya se implementó → ver [DONE.md](DONE.md) Sección 2.
No se implementa nada de aquí hasta que el mes correspondiente esté cerrado.

---

## 🔄 EN PROGRESO — Mes 3 activo

### Skills ecosystem con estructura real (S14)
Schema extendido: `when_to_use`, `verifiers`, `anti_patterns`, `examples`.
5 skills a escribir: `pre-task-alignment`, `diagnose`, `tdd-enforcer`,
`context-compression`, `improve-architecture`.
Ver PLAN.md → SEMANA 14.

---

## 💡 Pendiente — Mes 4

### Language-aware skills

**Problema**: el detector de lenguaje ya existe (`src/detect/languages.ts`) pero las skills
lo ignoran. Una skill `tdd-enforcer` escrita para TypeScript le dice al LLM "corre `npm test`"
— inútil en un proyecto .NET. Cisepro.Web lo demostró: 0 files indexados = v0 solo cubre TS/JS/Python.

**Propuesta**: campo `language_targets` en el schema de skill:
```yaml
id: tdd-enforcer
language_targets:
  typescript:
    verifiers: ["npm test", "bun test"]
    anti_patterns: ["skip describe blocks", "use any to bypass types"]
  csharp:
    verifiers: ["dotnet test"]
    anti_patterns: ["[Ignore] attribute without reason"]
  python:
    verifiers: ["pytest", "python -m unittest"]
    anti_patterns: ["pass in test body"]
  default:
    verifiers: ["run your test suite"]
    anti_patterns: ["empty test body"]
```
El compiler inyecta solo la sección del lenguaje detectado.

**Prerequisito**: S14 (skills schema extendido).

---

### Model roles config — cerebro + ejecutor pesado + ejecutor ligero

**Problema**: el usuario quiere elegir al inicio del proyecto qué modelo actúa como
cerebro (planner) y qué modelos ejecutan tareas pesadas vs ligeras.

```yaml
# orchestos.config.yaml
models:
  planner:        claude-opus-4-7
  executor_heavy: codex
  executor_light: deepseek-v3
  default:        openrouter/deepseek
```

Mapping automático con `classifyTask` que ya existe:
- `plan` → planner
- `fix` / `refactor` → executor_heavy
- `generate` / `edit` → executor_light
- Sin config → default para todo

**Por qué es distinto**: nadie hace routing por **complejidad de tarea** mapeada a un
clasificador existente. LangChain/CrewAI asignan por rol semántico, no por complejidad.

**Prerequisito**: S11 ✅ (executor por tarea) + `orchestos init` que lea `orchestos.config.yaml`.

---

### Skills de ciclo de vida — security-review, qa-structured, test-writer

**`security-review`**
- Antes de mergear código que toca auth, inputs del usuario, queries SQL.
- `anti_patterns`: hardcoded secrets, SQL string concatenation, eval() en user input, sin validación de inputs.
- Inspirado en OWASP Top 10 — solo los errores más comunes.

**`qa-structured`**
- Guía al LLM en *cómo* evaluar después de implementar, antes de marcar done.
- Diferencia vs `acceptance_criteria[]`: esa define *qué* evaluar; esta define *cómo*.
- `anti_patterns`: test solo el happy path, ignorar error handling, hacer QA del propio output sin distancia.

**`test-writer`**
- Para agregar tests a código existente (distinto de `tdd-enforcer` que va antes de implementar).
- `when_to_use`: "When adding tests to existing code", "When coverage is below threshold".

**Prerequisito**: S14 (skills schema extendido).

---

## 💡 Pendiente — Mes 5

### Multi-lenguaje en Code Graph ✅ PARCIALMENTE IMPLEMENTADO

**Estado**: El graph ahora indexa C#, Rust, Go, Java, Kotlin, Ruby, PHP, Swift, Elixir, Haskell, Lua, Perl.
Import extraction específica por lenguaje con regex para cada uno.

**Pendiente**:
- Resolver imports relativos para lenguajes no-JS (hoy solo JS/Python tienen resolución de paths)
- KuzuDB cuando el grafo llegue a 10K+ nodos

---

### autoskills — Registry de skills por lenguaje/framework

**Referencia**: `npx autoskills` — repo de midudev: https://github.com/midudev/autoskills

**Problema que resuelve**: Cuando trabajas en un proyecto con un lenguaje o framework que no está
en tus skills locales, hoy `skill scaffold` genera un YAML genérico. Con autoskills, podrías
descargar una skill curada por la comunidad para ese lenguaje/framework específico.

**Integración propuesta**:
```bash
orchestos skill fetch --language rust          # descarga rust-development de autoskills registry
orchestos skill fetch --framework nextjs       # descarga nextjs-development
orchestos skill fetch --list                   # lista skills disponibles en el registry
```

**Flujo completo**:
1. `orchestos task run --explain <id>` detecta lenguaje del proyecto
2. Si ninguna skill local tiene `language_targets.<lang>` → avisa al usuario
3. Usuario decide: `orchestos skill scaffold --language <lang>` (local, genérico)
   o `orchestos skill fetch --language <lang>` (registry, curado por comunidad)
4. Skill descargada en `skills/<id>.yaml` → editable localmente

**Decisión de diseño pendiente**: autoskills usa npx (npm registry) → ¿queremos un
registry propio en orchestos o simplemente wrappear autoskills como fuente?

**Prerequisito**: `skill scaffold` ✅ ya implementado como base local.

---

### Sandbox por tarea (git worktree)

Cada tarea corre en un worktree aislado. Si QA falla, el worktree se descarta.
Elimina la necesidad de `restoreContents`.

Prerequisito: harness separado ✅

---

## 💡 Pendiente — Mes 5+

### Spec-Driven flow completo (spec-kit)

`constitución → spec → clarificar → plan → validar → tareas → ejecutar`

En Mes 3 está `validar` (`acceptance_criteria[]` ✅).
Falta para Mes 4:
- **Constitución**: `CONSTITUTION.md` — qué puede/no puede modificar el agente
- **Spec**: `orchestos spec <id>` — descripción aprobada antes de ejecutar
- **Clarificar**: si hay ambigüedad, el harness pregunta antes de gastar tokens

Prerequisito: harness ✅ + acceptance_criteria ✅.

---

### Sub-agentes con contextos aislados

Una tarea "plan" genera sub-tareas. Cada sub-tarea tiene su propio contexto y QA stage.
Prerequisito: harness ✅ + scheduler robusto + worktrees.

---

---

## 🎯 VISIÓN A LARGO PLAZO — Dashboard + acceso universal

> "Cualquier persona debe poder usar esta herramienta sin saber de código."
> — Carlos Gallardo, 2026-05-27

### Por qué el dashboard está en la lista prohibida ahora

El CLI primero no es un límite — es la fundación. Cada botón del dashboard futuro
es un comando CLI que ya existe y funciona. Si el CLI no es sólido, el dashboard
no tiene sobre qué pararse. El proyecto anterior tenía dashboard pero el backend
no estaba 100% alineado — se rehízo desde cero por eso.

**Regla**: dashboard después de tener el CLI estable y un usuario real que lo usa.

---

### 💡 [MES 6+] Dashboard — capa visual sobre el CLI existente

**Qué es**: una interfaz web (o desktop) que expone los comandos del CLI como botones,
formularios y vistas. No reemplaza el CLI — lo envuelve.

**Mapeo CLI → UI**:
| CLI | UI equivalente |
|-----|---------------|
| `orchestos init <path>` | Botón "Nuevo proyecto" + selector de carpeta |
| `orchestos task list` | Tabla de tareas con estado visual (colores, íconos) |
| `orchestos task run --explain <id>` | Modal "Vista previa antes de ejecutar" |
| `orchestos task run --id <id>` | Botón "▶ Ejecutar esta tarea" |
| `orchestos runs --detail <id>` | Panel de evidencia expandible |
| `orchestos context suggest "<text>"` | Input libre → lista de archivos sugeridos |
| `orchestos skill list` | Galería de skills con descripción y botón "Aplicar" |

**Stack recomendado** (a decidir en su momento):
- Electron (desktop, sin servidor, acceso a filesystem nativo) — más cercano al CLI
- Next.js + Tauri (web + desktop) — si se quiere distribuir como app instalable
- NO SaaS hasta tener 10+ usuarios que lo pidan explícitamente

**Prerequisito**: CLI completo hasta Mes 5 + al menos 1 usuario externo real.

---

### 💡 [MES 7+] Onboarding adaptativo — ¿sabes programar?

**El problema que resuelve**: hoy orchestos asume que el usuario sabe qué es un
`tasks.yaml`, qué es un executor, qué es un check. Un primo que quiere un bot de
trading no sabe nada de eso — y no tiene por qué.

**Flujo propuesto en el setup wizard** (primera vez que se abre la app):

```
Paso 1 — Pregunta de nivel:
  "¿Trabajas habitualmente con código?"
  [ ] Sí, soy desarrollador / tengo experiencia técnica
  [ ] Sé lo básico, puedo leer código pero no escribirlo
  [ ] No, nunca he programado

Paso 2 — Según respuesta:
  → Desarrollador: flujo normal (CLI available, tasks.yaml visible, full control)
  → Básico: wizard que genera tasks.yaml por él, checks sugeridos automáticamente
  → No programador: modo guiado completo (ver abajo)
```

**Modo guiado para no-programadores**:

El agente no pregunta "¿qué escribo en tasks.yaml?". Pregunta en lenguaje natural:
```
"¿Qué quieres construir?" → "un bot que compre y venda criptomonedas"
"¿En qué plataforma?" → "no sé, en la que sea más fácil"
"¿Tienes cuenta en algún exchange? (Binance, Coinbase...)" → "tengo Binance"
"¿Cuánto dinero máximo puede mover sin pedirte confirmación?" → "$10"
```

Esas respuestas se traducen internamente a:
- Stack detectado / sugerido
- tasks.yaml generado con description en lenguaje técnico
- CONSTITUTION.md con límites (ej: "no ejecutar trades > $10 sin confirmación explícita")
- checks[] con validaciones de seguridad (ej: "no hay API keys hardcodeadas")
- acceptance_criteria[] en términos que el usuario pueda verificar

**Precauciones extras para usuarios sin experiencia técnica**:
- `acceptance_criteria` siempre requerido — no puede ejecutar sin criterios
- `checks` incluye al menos uno de seguridad por defecto
- `--explain` es obligatorio antes del primer run (no puede saltárselo)
- Logs en lenguaje simple, no técnico: "✅ Tu bot fue creado correctamente" vs "QA pass"
- Límites de costo visibles en pantalla antes de ejecutar: "Esta tarea costará aprox. $0.003"
- Opción "¿Qué hace esto?" en cada elemento — tooltip explicativo

**La diferencia clave con Claude Code u otras herramientas**:
Claude Code, Cursor, Copilot — todos asumen que el usuario sabe programar.
orchestos puede ser la primera herramienta de agentes LLM que funcione para
alguien que nunca ha abierto una terminal, porque el contrato declarativo
(tasks.yaml + output[] + checks[]) puede generarse por el agente en base a
preguntas en lenguaje natural.

**Prerequisito**: dashboard funcional (Mes 6) + spec-driven flow (Mes 5) +
CONSTITUTION.md + modo --explain obligatorio.

---

## Feedback usuario 1
_(se llena cuando haya un usuario externo real usando orchestos en su proyecto)_

## Feedback Mes 3
_(se llena al cerrar Mes 3)_
