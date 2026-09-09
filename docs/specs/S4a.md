# Spec S.4a — Recuperar al índice los 7 ítems invisibles y dar vía de reconciliación

Ejecutor: `gpt-5.6-luna` vía `codex exec`. Escrito por el cerebro (Opus 5), 2026-09-09.
Este spec está redactado para ejecutarse **sin tomar ni una decisión de diseño**. Si en algún
punto tienes que elegir entre dos opciones, **para y repórtalo**: el spec está incompleto y se
corrige aquí, no en el código.

Ítem en `PLAN.md` § Bloque S. Léelo antes de empezar. Preflight obligatorio:

```
bun run agent:preflight -- --item S.4a --agent codex
```

---

## Contexto: qué está roto y por qué importa

`scripts/plan-status.ts:37` define:

```ts
const ITEM_LINE_RE =
  /^- \[( |x)\] \*\*([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*) — (🧠|⚡|🔍) (.+?)\.?\*\*(?:\s*\(cerrado (\d{4}-\d{2}-\d{2})[^)]*\))?/
```

El grupo del ID —`([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)`— solo admite alfanuméricos y puntos. Por eso
estos 7 ítems, todos cerrados y con evidencia completa, son **invisibles** para el parser:

```
R.2-bis   R.2-ter   R.3-bis   R.4-bis   R.5-bis   R.5-ter   H.8.3'
```

Ese parser alimenta `.orchestos/feature-status.json` (vía `scripts/generate-feature-status.ts`) y
la tabla `plan_items` (vía `scripts/plan-import.ts`). Ambos derivados tienen 69 ítems donde
`PLAN.md` tiene 76. El handoff y el hook de `SessionStart` leen `feature-status.json`, así que el
arranque de sesión muestra un plan incompleto.

No hay pérdida de datos: la evidencia de los 7 está en `docs/done/bloque-R.md` y
`docs/done/bloque-H.md`, con ancla `<a id="...">`, enlazada desde `PLAN.md`. **No edites esos
archivos**: son la fuente que este trabajo vuelve a indexar.

---

## Cambio 1 — El regex del ID admite `-` y `'`

En `scripts/plan-status.ts:37`, reemplaza **únicamente** el grupo 2 del regex:

```
de:  ([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)
a:   ([A-Za-z0-9][A-Za-z0-9.'-]*)
```

Requisitos, todos verificables:

- `H.8.3'` lleva el apóstrofe **al final**, no entre segmentos: tratar `-`/`'` como separadores
  internos no lo captura. Por eso el patrón es "primer carácter alfanumérico, luego cualquier
  combinación de alfanuméricos, punto, guion y apóstrofe".
- **No toques ninguna otra parte del regex.** El discriminador de "esta línea es un ítem de
  trabajo" sigue siendo el emoji de delegación tras ` — `. Eso es lo que ya excluye solas las
  líneas de cierre de sprint (`**SÍ — Sprint 27 cerrado…**`, `**PARCIAL — …**`), y debe seguir
  excluyéndolas después de tu cambio.
- La clase de caracteres no incluye espacio ni `—`, así que el `*` no puede desbordarse hasta el
  guion largo. No añadas caracteres a la clase.
- Actualiza el comentario de cabecera del archivo (líneas 9-14) solo si queda inexacto.

## Cambio 2 — Vía de reconciliación en `plan-import.ts`

Hoy `scripts/plan-import.ts:49-50` aborta si la tabla ya tiene filas:

```ts
if (existing !== 0) throw new Error('plan_items is already seeded; plan import runs once')
```

Ese guard es correcto para el sembrado inicial y **se conserva** para la invocación sin flags.
Añade un modo de reconciliación:

- Flag `--reconcile` en el bloque `import.meta.main`.
- Con `--reconcile`, se omite el guard y se recorre `parsePlanItemSources(plan)` haciendo
  `upsertPlanItem(...)` de cada ítem, con exactamente los mismos campos y la misma transacción que
  usa hoy el sembrado. No dupliques la lógica: extrae el cuerpo del bucle a una función que ambos
  modos usen.
- Script en `package.json`: `"plan:reconcile": "bun run scripts/plan-import.ts --reconcile"`.
- Sin `--reconcile`, el comportamiento actual no cambia (sigue siendo one-shot y sigue lanzando el
  mismo error con el mismo texto).

**Corrección del 2026-09-09 — reconciliar también BORRA (decisión del cerebro, no la tomes tú).**
`upsertPlanItem` inserta y actualiza, pero **no elimina**. Verificado tras tu primera pasada:
`plan_items` quedó con **78** filas para **77** ítems de PLAN.md; la que sobra es `S.4`, cuyo ítem
fue reemplazado por `S.4a`/`S.4b` en el commit `ccf3a79`. Una fila huérfana no es inocua: cuando
S.4b genere `PLAN.md` desde la DB, **resucitaría un `S.4` que ya no existe** y el gate lo
declararía sincronizado — el mismo fantasma que este ítem vino a eliminar, entrando por la puerta
de atrás.

Dentro de la **misma transacción** del modo `--reconcile`, elimina de `plan_items` toda fila cuyo
`id` no esté entre los ids parseados de `PLAN.md`.

- **Si un `DELETE` falla por la foreign key de `plan_item_deps` (`ON DELETE RESTRICT`): aborta la
  transacción entera y reporta.** Nunca borres en cascada ni toques `plan_item_deps` para
  destrabarlo: esas dependencias las carga Carlos a mano y perderlas en silencio es peor que la
  fila huérfana. Hoy la tabla está vacía, así que el caso no debería dispararse — el requisito
  existe para cuando deje de estarlo.
- Imprime cuántas filas se borraron y con qué ids.

**Prohibido en este ítem:** tocar la tabla `plan_item_deps`. Está vacía a propósito (decisión de
S.3: las dependencias las carga Carlos en S.6, no se infieren de la prosa). `upsertPlanItem` no la
toca; no le agregues nada que sí lo haga.

## Cambio 3 — Regenerar los derivados

```
bun run plan:status      # regenera .orchestos/feature-status.json
bun run plan:reconcile   # reconcilia plan_items
```

Ambos archivos van en el commit.

---

## El test, primero y contra un fixture

Escribe el test **antes** del fix y compruébalo fallando. Va en el archivo de tests que ya cubre
`plan-status.ts`; si no existe, créalo junto al script.

**Contra un fixture en tmpdir — nunca contra el `PLAN.md` vivo.** Esta es una lección con costo:
el test de S.3 asserteaba sobre el PLAN.md real y se rompió con el propio commit que cerró el ítem
(commit `8fd2e3f`). Un test que asserta sobre un archivo vivo del repo no prueba el código, prueba
el estado del repo.

El fixture es un string de PLAN.md sintético con tres ítems y nada más:

```
- [x] **R.2-bis — 🔍 Título de prueba.** (cerrado 2026-09-06)
- [x] **H.8.3' — ⚡ Otro título.** (cerrado 2026-09-04)
- [ ] **S.9 — 🧠 Ítem normal abierto.**
```

Aserciones:
- `parsePlanFeatureStatus(fixture)` devuelve **3** ítems con ids exactos `R.2-bis`, `H.8.3'`, `S.9`.
  Contra el código actual devuelve 1 — **verifica que falla antes de tocar el regex** y pega esa
  salida en el reporte.
- Un fixture que contenga una línea de cierre de sprint (`- [x] **SÍ — Sprint 27 cerrado.**`, sin
  emoji de delegación) sigue devolviendo 0 ítems para esa línea: la exclusión no se rompió.

---

## Gate de cierre — números exactos, no "pasa"

Reporta cada uno con su salida real:

1. El test nuevo falla antes del fix y pasa después (pega ambas salidas).
2. `plan_items` = **77** filas. `.orchestos/feature-status.json` = **77** ítems. Ninguna fila
   huérfana: el conjunto de ids de `plan_items` es **idéntico** al de `PLAN.md`, en ambas
   direcciones.
   > Corrección del 2026-09-09: el spec decía 76. Estaba mal — el cerebro contó antes de que
   > `ccf3a79` partiera `S.4` en `S.4a`/`S.4b`, que suma un ítem. **Hiciste bien en parar**: la
   > contradicción era del spec, no de tu trabajo. Verificado por el cerebro de forma
   > independiente, incluido que el PLAN.md de `ccf3a79` ya parseaba 77 con el regex nuevo.
3. Los 7 ids recuperados están presentes en ambos.
4. `S.3` queda `status='done'` con `commit_sha = 4d019b6…`.
   > Corrección del 2026-09-09: el spec decía `d866f92`. También estaba mal.
   > `git log -S '- [x] **S.3 —' -- PLAN.md` devuelve `4d019b6`, que es el commit que marcó `[x]`;
   > `d866f92` solo trajo el código. El sha correcto es el del **cierre**, no el de la
   > implementación. `commitShaFor()` ya hace lo correcto; el número escrito a mano era el erróneo.
5. **Ningún ítem `done` puede quedar con el sha de fallback.** `commitShaFor()`
   (`plan-import.ts:22-42`) busca con `git log -S "- [x] **<id> —" -- PLAN.md` y, si no encuentra
   nada, **cae a `git rev-parse HEAD`**. Un sha de HEAD satisface el `CHECK` de la tabla y deja el
   índice mintiendo, que es peor que la fila ausente. Para cada ítem `done`, comprueba que
   `git show --stat <commit_sha>` menciona `PLAN.md`. **Si alguno cae al fallback: para, no lo
   inventes, y repórtalo aquí.**
6. `bunx tsc --noEmit` → exit 0.
7. `bun run test:coverage` → el comando **exacto** del workflow de CI. No `bun test` a secas: el
   gate de cobertura vive dentro de ese script.
8. `bun run lint` → **juzga por el exit code, no por el conteo de warnings.** Biome sale 0 con los
   879 warnings heredados de master; eso no es un fallo. Compara contra la base si dudas.
9. `git diff --check` → limpio.

## Fuera de alcance — no lo toques

- `plan:render` y el gate de pre-commit: son **S.4b**, otro ítem.
- `plan_item_deps`.
- La evidencia de `docs/done/*.md`.
- Cualquier otro ítem del Bloque S, o de los bloques R, H, I, UI.
- `orchestos.config.yaml`.
- `git config` en cualquier forma (regla dura de `CLAUDE.md`).
- No uses `--no-verify`.

Hallazgos adyacentes: documéntalos en el reporte, **no los corrijas en caliente** (protocolo
`docs/agent-work-protocol.md`, paso 7).

## Cierre

Un commit por ítem, sin `--no-verify`. En la evidencia de `PLAN.md`, incluye la línea:

```
Ejecutado por: gpt-5.6-luna · Spec: docs/specs/S4a.md
```

Este spec **se borra en el commit que cierra S.4a** (`AGENTS.md:74-76`): para entonces su contenido
vive en el código y su evidencia en `PLAN.md`.

No marques `[x]` tú. El cerebro verifica de forma independiente y cierra.
