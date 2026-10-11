# R.8.3 ronda 5 — el andamiaje de `qa-negative` deja evidencia cuando un comando falla (spec autónomo)

Ítem de PLAN.md: R.8.3 (preflight: `bun run agent:preflight -- --item R.8.3 --agent codex`). El árbol ya contiene
cambios sin commitear de R.8.3, verificados por el cerebro: **son de este ítem, no los toques ni te detengas por
ellos.** No leas los otros specs de R.8.3: este archivo es todo el trabajo.

**Candado de escritor:** `writer-lock.js status` dirá `ocupado: claude 9c7c1af4`. Esa es la sesión cerebro que te
delegó; `bin/delegate` te pasa su token y eres su ejecutor, no una segunda sesión. Edita: el hook no te lo niega. Solo
detente si una edición es rechazada mecánicamente, y entonces cita el mensaje exacto.

## Defecto
1 de 3 corridas de `bun run ui:gate qa-negative` falló en el andamiaje:
`flow: Command failed: git -c user.name=ui-gate -c user.email=ui-gate@example.invalid commit -qm task fixture`.
El helper `run` (`scripts/ui-gate/flows/qa-negative.mjs:~9-11`) usa `stdio: 'ignore'`, así que el motivo de git se
pierde. Primero evidencia; la causa no se adivina.

## Cambio — únicamente `scripts/ui-gate/flows/qa-negative.mjs`, función `run`
```js
function run(command, args, cwd) {
  try {
    execFileSync(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  } catch (error) {
    const detail = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim().slice(-600)
    throw new Error(`${command} ${args.join(' ')} failed (exit ${error.status ?? 'n/a'}): ${detail || 'sin salida'}`)
  }
}
```
Nada más cambia: ni reintentos, ni pasos, ni otros flows.

## No tocar
Cualquier otro archivo. No commitear. No correr `test:coverage` ni `ui:gate` (el sandbox no abre puertos).

## Verificación del ejecutor
- `node --check scripts/ui-gate/flows/qa-negative.mjs`
- `bunx biome check scripts/ui-gate/flows/qa-negative.mjs`
