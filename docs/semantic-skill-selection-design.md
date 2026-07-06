# Diseño — auto-selección semántica de skill (IDEAS.md #21)

## El problema, en una frase

Hoy una skill solo se aplica si la tarea declara `task.skill` a mano
([skill-route.ts:5](../src/run/middlewares/skill-route.ts#L5) lee únicamente `ctx.task.skill`) —
`/api/natural` ([project.ts:41](../src/dashboard/handlers/project.ts#L41)) ni siquiera setea ese
campo, y `when_to_use` es decorativo, solo se usa al *exportar* una skill
([targets/_shared.ts:6](../src/skills/targets/_shared.ts#L6)), nunca para elegirla. El usuario
tiene que saber que la skill existe y escribir su id de memoria. Este documento decide la forma
exacta del motor que elige por él — o le ofrece elegir, cuando hay ambigüedad real.

## Qué NO se construye acá

- No se toca `skill-route.ts` ni el formato de `SkillDef` — el motor **decide qué id de skill
  poner en `task.skill`**, el resto del pipeline no cambia.
- No hay ranking numérico ni scoring por similitud de embeddings — eso es sobre-ingeniería para
  el volumen de skills que hay hoy (16). Un LLM call barato con la lista completa de
  `when_to_use` alcanza.
- No se mezcla con B.1.b (clasificador de intención de tarea del Mes 18) en el código — son
  primitivos hermanos, no el mismo call (ver sección "Relación con Mes 18").

## (a) Forma del call

Un único LLM call por creación de tarea (`/api/natural` y, más adelante, cualquier otro punto de
entrada que genere un draft — chat, CLI). Mismo espíritu que IDEAS #4 (clasificador de
`clarify`, gated y nunca implementado sin necesidad real) y el patrón ya usado en
[chat-task-detection-design.md](chat-task-detection-design.md): modelo barato, prompt de una
sola pregunta, salida JSON parseada a la defensiva.

- **Modelo**: el más barato con tool-calling disponible (mismo criterio que el clasificador de
  Mes 18) — nunca el modelo que el usuario eligió para *ejecutar* la tarea. Es un call de
  servicio, no de razonamiento pesado.
- **Input**: la `description` del draft (no el `output[]`, no el historial de chat completo) +
  la lista de `{ id, description, when_to_use }` de **todas** las skills instaladas
  (`listSkillFiles()` + `listProSkillFiles()`, [registry.ts:72](../src/skills/registry.ts#L72)).
  16 skills hoy, cada una con `when_to_use` corto — cabe holgado en un prompt barato.
- **Salida**: `{ candidates: string[] }` — cero, uno, o varios ids de skill, nunca un id
  inventado (validar contra la lista real antes de usarlo; si el LLM devuelve un id que no
  existe, se descarta como si no hubiera dicho nada — fail-safe a "sin skill", igual que
  `needsClarify`/el clasificador de Mes 18).
- **Costo**: un call por tarea creada, no por mensaje de chat — mucho más barato en volumen que
  el clasificador de intención de Mes 18 (ese es por mensaje).

## (b) El matiz de Carlos — un candidato vs. varios (2026-07-06)

Esta es la decisión de arquitectura central de este documento, así que se explicita el porqué:

- **`candidates.length === 1`** → se auto-asigna a `task.skill` en el draft, sin fricción. El
  usuario la ve ya puesta en el composer (como hoy ve el `executor` sugerido) y la puede borrar
  si no la quiere — el punto de control humano existente (revisar el draft antes de confirmar)
  ya cubre el caso de un falso positivo aislado.
- **`candidates.length > 1`** (ambigüedad real — típicamente varias skills de diseño compitiendo
  por la misma tarea) → **NO se elige a ciegas**. El composer muestra las opciones con su
  `description` para que el usuario final decida cuál (o ninguna). Mismo principio ya vigente en
  el Mes 18 ("sugerir, nunca auto-ejecutar sin que el humano confirme") y en C.2 del composer
  (aviso inline cuando `engine: external` no tiene el binario disponible) — este documento no
  inventa un patrón de UI nuevo, reusa el que ya existe.
- **`candidates.length === 0`** → no se muestra nada, el campo skill queda vacío, exactamente el
  comportamiento actual (cero cambio para quien no usa skills).

Por qué importa: con 16 skills y creciendo (justo hoy se agregaron 4 de diseño), la ambigüedad
NO es un caso raro — es el caso esperado en cuanto haya 2+ skills del mismo dominio (diseño,
ingeniería). Resolver el empate con una elección humana es más barato y más honesto que
inventar un criterio de desempate arbitrario ("¿por qué eligió `frontend-design` y no
`ux-guidelines` si las dos aplican?").

## (c) Punto de control humano — cómo se ve en el composer

Extensión del `naturalDraft` existente en
[screens-core.js:401](../src/dashboard/public/screens-core.js#L401), mismo patrón visual que el
`<select id="draft-engine">` ya implementado ahí:

```
Sugerencia de skill: [ ] frontend-design — Production-grade visual craft for landing pages...
                     [ ] ux-guidelines   — Priority-ranked, measurable UX checklist...
                     [ ] Ninguna
```

- Un candidato único: el campo aparece ya seleccionado (no un checkbox, un valor pre-cargado),
  el usuario puede cambiarlo a "Ninguna" con un click, igual que hoy puede borrar el `output[]`
  sugerido.
- Varios candidatos: aparecen como opciones de un único `<select>` (mutuamente excluyentes — una
  tarea usa una skill a la vez, ver `skill-route.ts`), con "Ninguna" siempre disponible como
  primera opción.
- Ningún candidato: el campo no se muestra, cero cambio visual respecto a hoy.

Ningún tool call nuevo dispara ejecución — el draft sigue esperando confirmación manual del
usuario antes de crear la tarea, exactamente como el flujo `/api/natural` actual.

## (d) Relación con Mes 18 y con IDEAS #4 — primitivo compartido, no el mismo call

Los tres (clasificador de `clarify`, detección de intención de tarea del chat, y este selector
de skill) son la misma forma: *mirar lenguaje natural, devolver una decisión discreta validada
contra una lista cerrada, fail-safe a "nada"*. Vale la pena, cuando se implemente el primero de
los tres, extraer una función genérica —

```ts
async function classifyAgainstOptions(
  provider: string, model: string,
  input: string, options: { id: string; label: string }[],
): Promise<string[]>  // ids reales de `options`, nunca inventados
```

— en vez de escribir tres prompts/parsers casi idénticos. **No se decide ahora cuál se
implementa primero** (ese orden lo fija el estado de evidencia de cada uno, no este documento) —
solo se deja registrado que comparten forma, para que quien implemente el segundo o el tercero
no reinvente el primero.

## Orden de implementación sugerido (si se abre un Bloque de trabajo)

1. Función `classifyAgainstOptions()` genérica (o inline en el primer consumidor, extraída
   cuando aparezca el segundo — no premature-abstraction si solo hay un consumidor todavía).
2. Wiring en `/api/natural`: agregar la lista de skills al prompt existente o hacer un segundo
   call chico — decidir según cuánto infla el prompt del draft actual (medir antes de decidir).
3. Campo de skill en el composer (`naturalDraft` + `<select>`), mismo patrón que `draft-engine`.
4. Verificación en vivo con dinero real: un draft para una landing comercial debe sugerir
   `frontend-design`/`ux-guidelines`/`design-brief-inference` (ambigüedad real, 3 candidatos) y
   mostrar el selector; un draft de bugfix backend no debe sugerir nada.
