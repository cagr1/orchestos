# CI.62 — `ui:gate` borra al arrancar los `runDir` viejos

## Problema
Cada corrida de `scripts/ui-gate/run.mjs` deja `$TMPDIR/ui-gate-<pid>/` con capturas, y nada las borraba. El
2026-11-05 había 1938 carpetas (384 MB). Carlos pidió que lo ya verificado no quede guardado.

## Qué cambiar
Solo `scripts/ui-gate/run.mjs`: al arrancar, antes de crear su propio `runDir`, borra las carpetas
`ui-gate-*` de `os.tmpdir()` cuyo `mtime` tenga más de 24 h. Puede usar `fs.rmSync(dir, { recursive: true, force: true })`
dentro de un try/catch por carpeta, porque un error al borrar no debe frenar el gate. No toca la carpeta propia ni las
recientes, que son las que el cerebro todavía mira. Debe imprimir una línea `cleaned N old ui-gate dirs` solo si
N > 0. La lógica va en una función exportada de `scripts/ui-gate/lib.mjs` que recibe `tmpdir`, `now` y `maxAgeMs`, y
lleva un test (`bun test`) con carpetas de fixture en un temporal propio.

## Qué no tocar
Los flows, `gate:evidence`, `PLAN.md` y `NEXT.md`. No commitear.

## Cómo se verifica
Correr el test nuevo, `bun run lint` y `bun run ui:gate smoke`: una carpeta `ui-gate-x` de fixture con `mtime`
antiguo desaparece y la corrida pasa.
