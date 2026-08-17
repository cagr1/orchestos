# OrchestOS — Instrucciones para Codex / LLMs

## Regla cero — protocolo común obligatorio

Estas reglas aplican a Codex, Claude, DeepSeek, OpenCode y cualquier otro agente. Antes de editar,
leer [docs/agent-work-protocol.md](docs/agent-work-protocol.md) y ejecutar:

    bun run agent:preflight -- --item <ID> --agent <nombre>

El protocolo define el orden de trabajo, los gates por tipo de cambio y las condiciones de parada.
`AGENTS.md`, `CLAUDE.md`, `PLAN.md` y el protocolo son obligatorios; ninguna instrucción específica
del host puede relajar seguridad, scope-lock, evidencia en vivo ni la prohibición de `--no-verify`.

## Identidad git — PROHIBIDO modificar

El email y nombre de git ya están configurados globalmente y son correctos.
**Nunca ejecutes** ninguno de estos comandos, ni local ni global:

```
git config user.email  ...    # PROHIBIDO
git config user.name   ...    # PROHIBIDO
git config --local ...        # PROHIBIDO salvo que el usuario lo pida explícitamente
git config --global ...       # PROHIBIDO salvo que el usuario lo pida explícitamente
```

La configuración correcta es:
- `user.email = cagr_14@hotmail.com`
- `user.name  = cagr1`

Modificarla rompe el mapa de contribuciones de GitHub silenciosamente.
Si necesitas saber el email activo, usa `git config user.email` (solo lectura).

## Reglas generales

- No uses `--no-verify` en commits salvo que el usuario lo pida.
- No hagas `git push --force` salvo instrucción explícita.
- No crees ni borres ramas remotas sin confirmación del usuario.
- **Memoria evolutiva obligatoria:** toda mejora de proceso, hallazgo, decisión técnica o regla
  transversal descubierta durante el trabajo debe persistirse en el mismo turno. Usa `PLAN.md` para
  cadenas activas y evidencia de ejecución, `AGENTS.md`/`CLAUDE.md` para reglas que deben obedecer los
  LLM y `CONTEXT.md` para memoria estable de arquitectura/estado. Nunca dejes conocimiento operativo
  importante solo en la conversación; al actualizar una regla, conserva el historial y no la elimines
  silenciosamente.
- Cadencia de sincronización: después de 2–3 commits locales (o cuando la rama quede con 3
  commits de ventaja sobre `origin/master`), ejecuta `git push origin master` automáticamente.
  No acumules más commits sin subir; el push normal está autorizado. `--force` sigue prohibido
  salvo instrucción explícita.

## Trabajo en equipo (Claude + Codex, en paralelo)

Carlos trabaja este repo con Claude y Codex a la vez, cada uno en su propia sesión (posiblemente
en un worktree/rama separada). No te va a decir "hacé el ítem X" cada vez — el punto de partida
SIEMPRE es `PLAN.md`. Antes de tocar código:

1. **Leé `PLAN.md` primero.** Es la fuente de verdad de qué falta y en qué orden. Cada ítem abierto
   (`- [ ]`) tiene una etiqueta: `🧠` (requiere criterio de diseño), `⚡` (mecánico, bien
   especificado), `🔍` (gate de revisión). **Agarrá SOLO ítems `⚡`** — los `🧠`/`🔍` son de Claude.
   Si un `⚡` te bloquea porque depende de un `🧠` sin cerrar, PARÁ y decilo, no lo hagas en caliente.
2. **Scope-lock**: ejecutá EXACTAMENTE el ítem que agarraste — nada adyacente, ningún "ya que
   estoy, aprovecho y arreglo esto otro también". Si ves algo fuera de scope que amerita
   arreglarse, anotalo, no lo toques en la misma pasada.
3. **Commit por ítem cerrado**, marcando `[x]` en `PLAN.md` en el mismo commit — así el otro agente
   (o Carlos) ve en `git log`/`PLAN.md` qué ya está tomado, sin necesitar coordinación en vivo.
4. **No pises lo que no es tuyo**: si un ítem `⚡` ya tiene evidencia de que otro agente lo está
   trabajando (branch activo, commit reciente sin mergear), no lo dupliques — avisá.
5. Antes de escribir código nuevo, correr `bunx tsc --noEmit` y la suite de tests relevante — igual
   criterio que ya pide el pre-commit hook, pero verificalo vos ANTES de terminar, no dejes que el
   hook sea la primera vez que se entera de un error de tipos.

## Estado tomable

La sección fechada “Qué está listo para tomar ahora (2026-07-30)” fue retirada el 2026-08-17 porque
había quedado obsoleta mientras `PLAN.md` ya estaba en Mes 29. Desde ahora el estado se deriva en
cada preflight de los ítems abiertos de `PLAN.md`; nunca se duplica aquí un snapshot que pueda mentir.

## Hooks

Instalar o reparar ambos hooks con un único comando portable para repo principal y worktrees:

    bun run hooks:install

Validar sin modificar:

    bun run hooks:check

## Estado operativo de seguridad (2026-07-29)

L.0–L.6.1 del baseline están cerrados. L.6.2 sigue abierto: la revisión CLI/HTTP inicial y sus
límites viven en `docs/security-manual-review.md`; falta una sesión con navegador para la revisión
visual y los flujos manuales de ejecución/worktree/diagnóstico/exportación. Hallazgos pendientes
`L62-001` (migración concurrente) y `L62-002` (provider key persistida antes de validación). No
corregirlos fuera de un ítem explícito de `PLAN.md`.

## Invariantes de arquitectura permanentes

Recuperados el 2026-08-17: vivían solo en `CONTEXT.md` y se perdieron en un regen manual. Portados
acá porque `CONTEXT.md` nunca es la fuente, solo un derivado — y porque `orchestos context update`
resultó tener un bug real (sobreescribe `AGENTS.md` con una plantilla autodetectada genérica en vez
de leerlo como fuente; ver PLAN.md, ítem de hallazgo 2026-08-17). No volver a correr ese comando
hasta que el bug esté arreglado.

**Invariante QA**: cuando una tarea tiene criterios de aceptación, `runQA` solo puede devolver
`pass` si la respuesta del proveedor contiene exactamente un resultado por criterio y cada
criterio aprobado tiene evidencia literal real en el archivo indicado. Una respuesta incompleta,
malformada o con cardinalidad incorrecta debe fallar de forma segura; una respuesta JSON que no
sea un objeto también debe fallar de forma segura. No relajar esta regla para mejorar el mutation
score.

**Invariante roadmap** (Bloque M, Mes 24): `docs/roadmaps/` (universal → disciplina → lenguaje →
project-profile) nunca marca `verified` sin un comando real ejecutado y su salida citada; sin
evidencia, el estado correcto es `known` (conocimiento general) o `missing` (se buscó y no está)
— nunca un `pass` implícito. `orchestos roadmap check` es determinista y evidence-based: cero
heurísticas que inventen `detected` sin una señal real de filesystem/código. Límites conocidos, no
bugs a esconder: (1) no existe mecanismo que provisione `docs/roadmaps/` dentro de un proyecto
NUEVO — `orchestos init` no lo hace. (2) el presupuesto de contexto de `loadRoadmapContext` (12k
chars) no alcanza para las 6 disciplinas + lenguajes de OrchestOS mismo — se recorta con `missing`
visible, nunca en silencio, pero el recorte es real. Pendientes de decisión de Carlos antes de
ampliarse a proyectos externos reales.

**Invariante contrato de skill** (2026-07-30): un campo del YAML de una skill (`skills/*.yaml`)
solo llega al LLM si está en los tres puntos: `SkillDef` y `validateSkill()`
(`src/skills/registry.ts`) y **`buildSections()`** (`src/skills/targets/_shared.ts`) — este
último es el ÚNICO renderer skill→prompt, compartido por los tres targets
(`claude`/`cursor`/`openai`). `validateSkill()` **no rechaza campos desconocidos**: un campo mal
cableado carga sin error y se descarta en silencio — el modo de fallo es contenido muerto, no una
excepción. Si la skill se crea o importa por el dashboard, el contrato descrito al LLM curador
(`src/dashboard/prompts/curator.ts`) debe incluirlo o toda skill importada nace sin ese campo. El
orden de las secciones dentro de `buildSections()` es parte del contrato — es el orden en que el
modelo lee la skill.
