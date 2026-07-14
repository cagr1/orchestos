# Visor de diff por run — design doc (v0.12 / Bloque C)

**Estado:** borrador para revisión (C.1) — no tocar código hasta aprobación, mismo protocolo
que `auto-split-design.md` (Mes 20/A.1).
**Contexto completo:** [PLAN.md — v0.12 Bloque C](../PLAN.md)
**Alcance de este documento:** solo **C.1** (diseño). C.2 (implementación) y C.3 (verificación
en vivo) son bloques separados, posteriores a la aprobación de este doc.

---

## El problema concreto

OrchestOS calcula un cambio de archivos en cada run pero nunca se lo enseña al humano. Hoy:
- `enforceContract()` (`contract.ts:75-113`) escribe los archivos y devuelve `written: FileChange[]`
  — pero `FileChange` es solo `{ path, content }`: **contenido final completo, no un diff**.
- El detalle de run del dashboard (`screens-ops.js` `SCREENS.runs.detail()`) no muestra absolutamente
  nada de archivos cambiados — ni la lista de paths, que ya existe en columnas de `runs`
  (`files_attempted`/`files_authorized`/`files_blocked`).

Es la pieza de confianza (ver qué cambió antes de confiar en el resultado) que Claude Desktop/
Cursor/Orca tienen y OrchestOS no. Alcance de este bloque: **read-only** — mostrar el diff, no
aprobar/rechazar (esa es una superficie de acción nueva, se evalúa después con la misma
disciplina "leer vs actuar" del Mes 13).

---

## Decisión 1 — el diff se genera por contenido, no por `git diff`

**Investigación previa (verificada contra el código, no supuesta):**

| Engine | ¿Worktree git real? | ¿Qué produce hoy? |
|---|---|---|
| `single-shot.ts` | No — nunca toca disco | `FileChange[]` (contenido final, parseado de la respuesta LLM) |
| `agentic.ts` | No — buffer `Map<string,string>` en memoria (línea 103) | `FileChange[]` (contenido final del buffer) |
| `external.ts` | Sí — requiere worktree (línea 198-202) | `FileChange[]` vía `readWorktreeDiff()` (`external.ts:92-112`), que lee `git status --porcelain` **solo para listar paths tocados**, después lee el contenido completo de disco. **No usa `git diff` en ningún punto.** |

Ningún engine produce un diff textual real hoy — los 3 convergen al mismo shape `{path, content}`
completo. Si este bloque construyera el diff a partir de `git diff` solo funcionaría para
`external` (el único con worktree real), dejando `single-shot`/`agentic` sin cobertura — o
peor, con dos caminos de implementación distintos para el mismo feature.

**Además, el worktree no sobrevive al run.** `mergeWorktreeBack()` (`sandbox.ts:77-153`) llama
`worktree.cleanup()` tanto en el camino de éxito (`strategy: 'commit'`, harness.ts:564-567) como
en discard — **siempre**, salvo `keepWorktree: true`, que es una opción **solo de CLI**
(`cli.ts`, flag `--keep-worktree`) y el dashboard nunca la pasa. Un `git diff` post-hoc contra
runs disparados desde el dashboard **no tiene worktree contra el cual correr** una vez terminado
el run — llegaría tarde siempre.

**Decisión:** el diff se calcula por **contenido, en memoria, durante el run** — combinando lo
que el harness YA captura para otro propósito:
- `beforeContent = snapshotContents(ctx.effectiveRoot, ctx.task.output)` (`harness.ts:264`) —
  hoy solo se usa para `restoreContents()` en caso de revert (QA fail / check fail).
- `contractResult.written` (`FileChange[]`, contenido final autorizado) — ya disponible en el
  mismo scope, en el camino de éxito (`harness.ts:571`).

Esto cubre los 3 engines de forma **uniforme** (el cálculo vive en `harness.ts`, después de que
cualquier engine ya normalizó su salida a `FileChange[]`) y no depende del ciclo de vida del
worktree. `readWorktreeDiff()`/`external.ts` no se tocan — siguen sirviendo su propósito actual
(producir el `FileChange[]` final para el contrato); el diff es una capa nueva encima, no un
reemplazo.

---

## Decisión 2 — cobertura: los 3 engines, no solo `external`

Consecuencia directa de la Decisión 1: como el cálculo vive en `harness.ts` sobre datos ya
uniformes, **los 3 engines quedan cubiertos sin código específico por engine**. Responde la
pregunta abierta original del ítem C.1 del plan ("¿solo los 3 engines o también single-shot/
agentic?") — la respuesta es: los 3, gratis, por construcción.

---

## Decisión 3 — status por archivo: solo `added` / `modified`, nunca `deleted`

`enforceContract()` (`contract.ts:103-110`) **solo escribe** — no hay ninguna rama que borre un
archivo. El contrato del LLM (`<<<FILE:path>>>...<<<ENDFILE>>>` o tool `write_file`) no tiene
primitiva de delete. Por lo tanto:

```
existed=false (snapshot antes) + presente en written → status: 'added'
existed=true  (snapshot antes) + presente en written → status: 'modified'
```

No hay tercer caso alcanzable por este camino. (Nota aparte, fuera de alcance: si en el futuro
se agrega una primitiva de delete al contrato, este diseño necesita revisarse — no es hoy.)

---

## Decisión 4 — dónde se calcula y qué se persiste

**Punto de inserción:** `harness.ts`, camino de éxito (`status: 'done'`, línea ~571), donde
`beforeContent` y `contractResult.written` ya están ambos en scope. Se calcula un
`fileDiffs: FileDiffEntry[]` justo antes del `insertRun()` de esa rama:

```ts
interface FileDiffEntry {
  path: string
  status: 'added' | 'modified'
  diff: string   // unified diff completo (formato estándar) — nunca recortado (ver Decisión 6)
}
```

**Persistencia:** nueva columna `file_diffs TEXT` en la tabla `runs` (migración adicional,
mismo patrón que las columnas JSON existentes — `checks_json`, `cost_breakdown_json`), con
`JSON.stringify(fileDiffs)`.

**Por qué solo en el camino de éxito (`status: 'done'`), no en fail/blocked/retry:**
En los caminos de fallo el harness ya llama `restoreContents(ctx.effectiveRoot, beforeContent)`
(harness.ts:452, 504, 548) — el archivo vuelve al estado anterior, así que "lo que cambió" no
tiene valor de revisión (nunca se quedó cambiado). Calcular el diff ahí sería trabajo sin
consumidor real. Si más adelante se quiere mostrar "qué intentó cambiar el intento fallido"
(debug, no revisión), es una extensión posterior, no parte de C.1-C.3.

---

## Decisión 5 — algoritmo de diff: librería `diff` (jsdiff), no artesanal

No hay ninguna librería de diff en `package.json` hoy. Escribir un algoritmo de diff línea a
línea a mano (LCS) es reinventar una rueda bien resuelta y con casos borde reales (líneas sin
newline final, CRLF, etc.). Se propone `diff` (jsdiff, MIT, ~25M descargas/semana, cero
dependencias) — incorporación server-side vía `bun add diff`, mismo criterio de licencia ya
aplicado a `marked` (Bloque B.1) y `tesseract.js`.

Uso: `diff.createPatch(path, before, after)` produce un unified diff estándar (el mismo formato
que `git diff`) sin necesitar git instalado ni un repo real detrás. `diff.diffLines()` se usa
además para el renderizado (Decisión 5b) — el patch unificado es lo que se persiste; las líneas
estructuradas son lo que arma la UI línea por línea.

### 5b. Renderizado — mismo patrón visual que Claude Desktop / GitHub (decidido con Carlos)

No se muestra el texto crudo del unified diff (encabezados `@@ -a,b +c,d @@`, prefijos `+`/`-`
como caracteres de texto). Se renderiza como vista de diff real:
- Cada línea en su propia fila, con **fondo verde** (agregada) o **fondo rojo** (removida) — sin
  color para líneas de contexto sin cambios.
- **Gutter** con `+`/`-` a la izquierda de cada línea (no como parte del texto seleccionable).
- Líneas de contexto alrededor de cada hunk (3 líneas antes/después, estándar de `diff`/git) —
  no todo el archivo si el archivo es grande y el cambio es puntual.
- Encabezado con el path del archivo y badge de status (`added`/`modified`) + conteo `+N -M`.
- Font monoespaciada, mismo tratamiento que los code blocks que ya trajo Markdown (Bloque B.1) —
  reusar esas CSS vars, no crear un segundo sistema de estilos de código.

`diffLines()` (jsdiff) devuelve el array de partes `{value, added?, removed?}` que la UI
recorre para pintar cada línea — no hace falta parsear el texto del unified diff a mano.

---

## Decisión 6 — tamaño grande: colapsar, nunca perder datos (sin truncado real)

Decisión revisada tras discutirlo: **no truncar con pérdida de datos**. El patrón que ya usan
Claude Desktop/GitHub para diffs grandes no es cortar el contenido — es **colapsar visualmente**
detrás de un "Mostrar N líneas más", con el diff completo siempre disponible al expandir. Esto es
consistente con la regla ya vigente en el proyecto (OCR/context: "avisar, nunca degradar en
silencio").

Concretamente:
- El diff completo se calcula y se persiste siempre — nunca se recorta el dato en `file_diffs`.
- La UI colapsa hunks que superen un umbral de líneas visibles (propuesta: >40 líneas por
  archivo se muestran las primeras ~15 + botón "Mostrar todo (N líneas)"). Es un comportamiento
  de presentación, no de datos.
- `FileDiffEntry.truncated` deja de ser necesario como campo de datos (nada se trunca de verdad)
  — se elimina del contrato; el colapso es 100% responsabilidad del frontend en C.2.

---

## Contrato para C.2 (implementación, bloque separado)

Lo que C.2 recibe ya decidido por este documento:

| Pieza | Contrato |
|---|---|
| Cálculo | Función pura `computeFileDiffs(before: ContentSnapshot, written: FileChange[]): FileDiffEntry[]` — nuevo módulo pequeño, o vive en `contract.ts` junto a `FileChange`. |
| Hook | Una llamada en `harness.ts` línea ~571 (camino `status: 'done'`), pasando `beforeContent` + `contractResult.written`. |
| DB | Migración: columna `file_diffs TEXT` en `runs`. `insertRun()` recibe `file_diffs: string \| null`. |
| API | `GET /api/runs/:id` (`runs.ts` handler) — agregar `fileDiffs` al `RunRow` que hoy NO lo expone (`runRecordToRow()` no pasa ninguna columna de archivos al frontend todavía). |
| UI | Nuevo grupo en `SCREENS.runs.detail()` (`screens-ops.js`) — lista de archivos con badge `added`/`modified`, diff expandible (reusar CSS de code block que ya trajo Markdown en Bloque B, no reinventar estilos). |

**No entra en C.2:** botones de aprobar/rechazar/revertir — eso es superficie de acción, fuera
del alcance read-only de este bloque.

---

## Verificación propuesta para C.3

Reusar `crypto-page-v1` (Mes 20/C.1) — un run real ya verificado con archivos generados reales.
Confirmar en vivo: el diff mostrado en el dashboard coincide con el contenido real de los
archivos en el proyecto, para al menos un archivo `added` (primera corrida) y, si hay una
segunda corrida sobre el mismo path, un caso `modified`.

---

## Decisiones confirmadas con Carlos (2026-07-13) — C.1 cerrado

1. **Renderizado**: estándar visual tipo Claude Desktop/GitHub (líneas +/- coloreadas con
   gutter, no texto crudo de unified diff) — ver Decisión 5b arriba.
2. **Truncado**: no es necesario truncar con pérdida de datos — se colapsa visualmente en la UI
   (patrón "Mostrar N líneas más"), el diff completo siempre se persiste — ver Decisión 6 revisada.
3. **Status `added`/`modified` únicamente, sin deletes**: confirmado.
4. **Sin backfill retroactivo**: confirmado — runs anteriores a este cambio no tendrán
   `file_diffs` (columna nueva, `NULL` para historial); el diff aparece solo para runs nuevos.

**GO para C.2.**
