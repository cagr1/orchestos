# S.8 — Archivar la evidencia del Bloque S y dejar el índice en PLAN.md

**Ejecutable sin decisiones adicionales.** Es una tarea de MOVIMIENTO DE TEXTO, no de redacción.
Si algo del spec resulta imposible o falso al tocar los archivos, **parar y reportarlo**, no
improvisar. No reescribas, resumas ni "mejores" ninguna evidencia: se mueve literal.

Preflight obligatorio: `bun run agent:preflight -- --item S.8 --agent <tu-id>`.

## Contexto en una línea

Los 11 ítems del Bloque S (S.1, S.2, S.3, S.4a, S.4b, S.5, S.6, S.6a, S.7a, S.7b, S.7c) están
todos `[x]` con su evidencia completa embebida en `PLAN.md`. `AGENTS.md:38` exige que esa
evidencia viva en `docs/done/bloque-S.md` y que PLAN.md conserve solo el índice.

## 1. Qué hacer, exactamente

### 1.1 Crear `docs/done/bloque-S.md`

Archivo nuevo. Copiar el formato EXACTO de `docs/done/bloque-DOC.md` (léelo primero):

```
# Bloque S — evidencia de cierre
Evidencia movida literalmente desde PLAN.md en S.8; PLAN.md conserva el índice.

<a id="bloque-s-s-1"></a>
### S.1 — ⚡ <título tal como está en PLAN.md>
<el resto del bloque del ítem, literal, sin editar una coma>
```

Un `<a id>` + un `###` por ítem, en el mismo orden en que aparecen en PLAN.md.
Convención del ancla, sin variantes: `bloque-s-` + el ID en minúsculas con el punto convertido a
guion. Los 11 anclas exactos son:

    bloque-s-s-1  bloque-s-s-2  bloque-s-s-3  bloque-s-s-4a  bloque-s-s-4b  bloque-s-s-5
    bloque-s-s-6  bloque-s-s-6a  bloque-s-s-7a  bloque-s-s-7b  bloque-s-s-7c

### 1.2 Reemplazar cada ítem en PLAN.md por una sola línea

Cada uno de los 11 ítems pasa a ser exactamente una línea, con este formato (el mismo de
`DOC.1`, que ya está en PLAN.md — cópialo como referencia):

    - [x] **<ID> — <emoji> <título>.** (cerrado <fecha>) → [evidencia](docs/done/bloque-S.md#<ancla>)

- El **título** es el que ya trae la línea del ítem en PLAN.md; no lo reescribas.
- La **fecha**: si la línea del ítem ya trae `(cerrado YYYY-MM-DD)` o `(YYYY-MM-DD)`, se conserva
  esa. Si el ítem no trae fecha en su primera línea (es el caso de S.1, S.2, S.5, S.6, S.6a),
  búscala en su propia evidencia (`Cerrado 2026-09-09…`, `(2026-09-09)`, etc.) y úsala. Si de
  verdad no hay ninguna fecha en la evidencia de ese ítem, **para y repórtalo**; no inventes una.
- Toda línea del ítem que hoy está en PLAN.md y no cabe en esa única línea se va literal a
  `docs/done/bloque-S.md`. Nada se borra.

### 1.3 Qué NO se mueve

- El **encabezado narrativo** del Bloque S en PLAN.md (desde `## Bloque S — …` hasta justo antes
  de la primera línea `- [x] **S.1`) se queda **intacto** en PLAN.md. No se toca ni se mueve.
- El ítem **S.8** (este mismo, hoy `- [ ]`) **no se toca en absoluto**: no se archiva, no se
  marca `[x]`, no se edita. Lo cierra el verificador.
- Ningún otro bloque (DOC, R, H, I, UI, Sprint…), ningún ítem abierto, `IDEAS.md`, `CONTEXT.md`,
  `AGENTS.md`, `README.md`: **nada de eso se toca**.

## 2. Sincronizar la DB (obligatorio, o el commit se rechaza)

PLAN.md es una vista de la DB. Después de editar PLAN.md, en este orden:

```
bun run plan:reconcile
bun run plan:render -- --check
```

`plan:render -- --check` debe salir **verde y sin diff**. Si sale rojo, para y reporta la salida
cruda; no toques `scripts/plan-render.ts` ni `scripts/plan-import.ts` para hacerlo pasar.

## 3. Gate de no-pérdida (obligatorio, pega la salida cruda de los tres)

Antes de tocar nada, guarda la referencia:

```
cp .orchestos/feature-status.json /tmp/fs-before.json
git rev-parse HEAD
```

Después de los cambios y del `plan:reconcile`:

1. **Ningún ID ni estado cambió** — los 82 IDs y sus 82 estados deben ser idénticos:
   ```
   diff <(jq -S . /tmp/fs-before.json) <(jq -S . .orchestos/feature-status.json)
   ```
   Debe imprimir **nada**. Si imprime algo, para y reporta.
2. **Ninguna línea de evidencia se perdió** — el conteo debe cuadrar:
   ```
   git show HEAD:PLAN.md | wc -l ; wc -l PLAN.md docs/done/bloque-S.md
   ```
   Reporta los tres números. Las líneas que salieron de PLAN.md deben aparecer en
   `docs/done/bloque-S.md` (se admite un delta pequeño y positivo por los encabezados `###`,
   los `<a id>` y las 11 líneas-índice nuevas; un delta **negativo** significa evidencia perdida
   → para y reporta).
3. **Muestreo del ítem más largo** — S.4b es el ítem con más evidencia. Confirma que su texto
   íntegro está en `docs/done/bloque-S.md` y reporta cuántas líneas mide allí frente a cuántas
   medía en `git show HEAD:PLAN.md`.
4. **0 enlaces rotos** — cada uno de los 11 `#bloque-s-…` de PLAN.md debe existir como `<a id>`
   en `docs/done/bloque-S.md`. Verifícalo y reporta el conteo (debe ser 11/11).

## 4. Gates finales

```
bunx tsc --noEmit
bun run lint
git diff --check
```

(No hace falta `test:coverage`: este cambio no toca código. Si el pre-commit lo corre, déjalo.)

## 5. Qué NO tocar

- Archivos permitidos: `PLAN.md`, `docs/done/bloque-S.md` (nuevo) y `.orchestos/feature-status.json`
  (regenerado por el hook, no a mano). Nada más.
- No toques `src/`, `scripts/`, `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `IDEAS.md`, `docs/specs/`.
- No borres este spec.
- No marques S.8 como `[x]`.
- No uses `--no-verify`. No ejecutes `git config`. No hagas `git push`.

## 6. Cierre

UN commit con mensaje `docs(S.8): archivar la evidencia del Bloque S en docs/done/bloque-S.md`,
terminando con la línea `Ejecutado por: gpt-5.6-luna`.
Después reporta: SHA del commit, la salida cruda de los 4 chequeos de §3 y de los 3 gates de §4.
