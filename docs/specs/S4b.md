# Spec S.4b — `plan:render` híbrido + gate de desincronización y de procedencia

Ejecutor: `gpt-5.6-luna` vía `codex exec`. Escrito por el cerebro (Opus 5), 2026-09-09.
Redactado para ejecutarse **sin tomar ni una decisión de diseño**. Si tienes que elegir entre dos
opciones, **para y repórtalo**: el spec está incompleto y se corrige aquí, no en el código.
En la pasada de S.4a paraste ante una contradicción y fue lo correcto — hazlo igual.

Ítem en `PLAN.md` § Bloque S. Léelo entero antes de empezar. Preflight obligatorio:

```
bun run agent:preflight -- --item S.4b --agent codex
```

---

## El modelo, decidido por Carlos: híbrido

- La DB es fuente de los **campos estructurados** (id, estado, delegación, `commit_sha`, título,
  `body`) — eso ya existe desde S.3/S.4a.
- El markdown se sigue leyendo, versionando y **editando a mano**, como siempre.
- La DB guarda además el documento completo como **segmentos ordenados**, de modo que `PLAN.md`
  sea reconstruible **byte a byte**. Requisito explícito de Carlos: *"si quiero después puedo
  borrar los `.md` sabiendo que todo quedó guardado en la DB"*.

**Por qué segmentos y no reconstruir la línea desde los campos:** el parser es *lossy*. En
`plan-status.ts` el título se captura con `(.+?)\.?`, que **descarta si la línea terminaba en
punto o no**, y el `→ [evidencia](...)` no se guarda en `plan_items`. Reconstruir desde los campos
no puede garantizar byte-exactitud. Guardar el texto literal sí, y no debilita nada: los campos
siguen siendo consultables y autoritativos para el gate.

## Flujo de trabajo resultante (no lo cambies)

```
editas PLAN.md a mano  →  bun run plan:reconcile  →  git commit
                                                      └─ el hook compara PLAN.md contra render(DB)
```

El gate **no** obliga a editar la DB a mano: obliga a que **nadie commitee un `PLAN.md` sin haber
reconciliado la DB**. Ese es todo el punto — la DB nunca queda atrás en silencio, que es lo que
pasó con S.3 (quedó `open` en la tabla y `[x]` en el markdown durante un día).

---

## Cambio 1 — Tabla de segmentos

Migración nueva en `src/db/migrate.ts`, siguiendo el estilo de la v7 de S.3 (no inventes otro
patrón; copia la forma de la migración existente).

```
plan_doc_segments(
  doc        TEXT NOT NULL,        -- 'PLAN.md'
  position   INTEGER NOT NULL,     -- orden dentro del documento, 0-based
  kind       TEXT NOT NULL,        -- 'prose' | 'item'
  text       TEXT,                 -- literal, para kind='prose'
  item_id    TEXT,                 -- referencia a plan_items.id, para kind='item'
  PRIMARY KEY (doc, position)
)
```

Requisitos:
- `CHECK` que garantice la exclusividad: `kind='prose'` exige `text NOT NULL` e `item_id NULL`;
  `kind='item'` exige `item_id NOT NULL`.
- Un segmento `item` guarda en `text` el bloque literal del ítem (su línea `- [ ]`/`- [x]` **más**
  sus líneas indentadas de body, tal como aparecen). El `item_id` existe para poder cruzarlo con
  `plan_items`; el `text` existe para el render byte-exacto.
- **No** pongas FK de `item_id` hacia `plan_items` con `RESTRICT`: la reconciliación reescribe
  ambas tablas en la misma transacción y una FK estricta la haría fallar por orden de escritura.
  Valida la correspondencia en el gate (cambio 4), no con una constraint.

## Cambio 2 — `plan:reconcile` también guarda los segmentos

Extiende el modo `--reconcile` que ya escribiste en `scripts/plan-import.ts`. **En la misma
transacción** que ya usa: borra todos los segmentos de `doc='PLAN.md'` y reinsértalos desde el
archivo actual.

La segmentación es puramente posicional, no semántica:
- recorre `PLAN.md` de arriba abajo;
- cada bloque de ítem detectado por el parser (su línea + sus líneas indentadas) es un segmento
  `item`;
- **todo lo demás**, literal y sin interpretar, son segmentos `prose`: frontmatter, encabezados,
  párrafos, citas `>`, tablas, líneas en blanco.

La concatenación de `text` de todos los segmentos en orden de `position` debe ser **idéntica byte
a byte** al archivo original, incluido el salto de línea final. Ese es el invariante; compruébalo
con un assert dentro del propio reconcile antes de commitear la transacción, y aborta si falla.

## Cambio 3 — `bun run plan:render`

Script nuevo `scripts/plan-render.ts` y entrada `"plan:render"` en `package.json`.

- Sin flags: imprime a stdout el `PLAN.md` reconstruido desde `plan_doc_segments`.
- `--check`: compara contra el `PLAN.md` del disco; exit 0 si son idénticos, exit 1 si no,
  imprimiendo el **primer** punto de divergencia (número de línea y ambas versiones). No imprimas
  un diff completo de 1800 líneas.

**Fuera de este ítem:** `DONE.md` y `docs/done/*`. Solo `PLAN.md`.

## Cambio 4 — Gate de desincronización en el pre-commit

En `scripts/pre-commit.sh`, junto a los gates que ya existen. Solo cuando `PLAN.md` esté staged:

1. `bun run plan:render --check` contra el contenido **staged** de `PLAN.md` (no el del working
   tree: usa `git show :PLAN.md`). Si difiere → **aborta** con un mensaje que diga exactamente
   qué correr: `bun run plan:reconcile`.
2. Cruce de campos: para cada segmento `kind='item'`, el `status` que el parser lee de su `text`
   debe coincidir con `plan_items.status` de ese `item_id`. Si difieren → aborta. Esto es lo que
   impide que un LLM cambie un `[ ]` por un `[x]` a mano sin que la DB lo registre.

Recuerda el precedente que motiva todo esto (`CLAUDE.md` § Regla cero): el hook vive en
`.git/hooks/` y **no está versionado**. El propio pre-commit ya tiene un self-check que compara
`scripts/*.sh` contra `.git/hooks/*` y aborta si difieren — no lo rompas, y reinstala con
`bun run hooks:install` para probar.

## Cambio 5 — Gate de procedencia

Mismo hook. Se dispara cuando el diff staged de `PLAN.md` convierte un `- [ ] **<ID> —` en
`- [x] **<ID> —`. Para cada ítem así cerrado, exige las dos cosas:

1. El commit **borra** `docs/specs/<ID>.md` — compruébalo con
   `git diff --cached --diff-filter=D --name-only`. El ciclo de vida está en `AGENTS.md:74-76`:
   el spec nace al delegar y muere en el commit que cierra el ítem. Sin spec borrado, no hubo
   delegación.
2. El diff staged añade una línea que empieza por `Ejecutado por:` dentro del body de ese ítem.

**Válvula de escape obligatoria, con rastro:** si en la evidencia del ítem hay una línea que
empieza por `Sin delegación:` seguida de un motivo, el gate pasa para ese ítem. Existe para los
ítems que Carlos cierra a mano y para los 🔍 verificados en vivo sin ejecutor. No la conviertas
en el camino fácil: el mensaje de error del gate debe nombrarla como excepción, no como opción.

Límite que se acepta explícitamente: el hook comprueba **presencia**, no veracidad — igual que el
gate en vivo. No intentes verificar que el modelo declarado sea el real.

---

## Gate de cierre — reporta la salida real de cada punto

1. **Round-trip byte a byte** sobre el `PLAN.md` real: `bun run plan:reconcile` y luego
   `bun run plan:render --check` → exit 0. El archivo tiene 77 ítems, frontmatter, encabezados de
   sprint y bloque, citas `>`, tablas y bloques de código: todo debe volver idéntico.
   Comprueba también `diff <(bun run plan:render) PLAN.md` → sin salida.
2. `plan_doc_segments`: número de filas, cuántas `item` y cuántas `prose`. Las `item` deben ser
   **77** y sus `item_id` deben coincidir exactamente con los ids de `plan_items`.
3. **Prueba negativa del gate de desincronización:** edita `PLAN.md` a mano (cambia un título),
   stagéalo sin reconciliar, e intenta commitear → el hook debe **abortar**. Pega la salida.
   Después reconcilia y comprueba que pasa.
4. **Prueba negativa del gate de procedencia:** un commit que marca `[x]` un ítem sin borrar su
   spec debe **abortar**. Pega la salida. Comprueba también que la válvula `Sin delegación:`
   deja pasar.
5. `bunx tsc --noEmit` → exit 0.
6. `bun run test:coverage` → el comando **exacto** del workflow de CI. No `bun test` a secas.
7. `bun run lint` → **juzga por el exit code**, no por el conteo. Biome sale 0 con los 879
   warnings heredados de master; eso no es un fallo.
8. `git diff --check` → limpio.

Tests: contra **fixtures en tmpdir**, nunca contra el `PLAN.md` vivo (lección de S.3, commit
`8fd2e3f`: un test que asserta sobre un archivo vivo del repo no prueba el código, prueba el
estado del repo). El punto 1 del gate sí se corre contra el archivo real, pero como comprobación
manual, no como test de la suite.

## Fuera de alcance — no lo toques

- `plan_item_deps` y el board: son **S.6**.
- `DONE.md`, `docs/done/*`, `IDEAS.md`.
- El regex de `plan-status.ts` (ya quedó bien en S.4a).
- Cualquier ítem de los bloques R, H, I, UI.
- `orchestos.config.yaml`.
- `git config` en cualquier forma (regla dura de `CLAUDE.md`). No uses `--no-verify`.

Hallazgos adyacentes: documéntalos en el reporte, **no los corrijas en caliente**
(`docs/agent-work-protocol.md`, paso 7).

## Cierre

Un commit para el ítem, sin `--no-verify`. En la evidencia de `PLAN.md` incluye:

```
Ejecutado por: gpt-5.6-luna · Spec: docs/specs/S4b.md
```

Este spec **se borra en el commit que cierra S.4b** (`AGENTS.md:74-76`) — y ese borrado es,
además, la primera prueba real del gate de procedencia que tú mismo acabas de escribir.

No marques `[x]` tú. El cerebro verifica de forma independiente y cierra.
