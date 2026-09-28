# AT.14 — brain-no-code ve los intérpretes con script en línea

Hueco visto en MR.1.d2 (NEXT.md, 2026-09-28): el cerebro editó `src/` con `python3 - <<EOF … open('src/…','w')`
y `.claude/hooks/brain-no-code.js` no lo vio (en Bash solo detecta `>`, `tee`, `sed -i`/`perl -i`).
Ampliar **ese** hook; sin hook nuevo, sin texto nuevo en CLAUDE.md/memoria. Sigue fallando abierto y
`ORCHESTOS_ROLE=executor` sigue exento.

## Cambios

1. **`.claude/hooks/brain-no-code.js`** — en `shouldDeny`, rama `Bash`, antes del bucle de segmentos y sobre el
   comando **entero** (el cuerpo del heredoc cruza `;`/`|`, no partirlo): denegar si se cumplen las tres:
   - hay un intérprete con script en línea: `python`/`python3`, `node`, `bun`, `deno`, `ruby` o `perl` seguido de
     `-e`, `-c`, `--eval`, `-` o de un heredoc `<<` (incluye `<<'EOF'`, `<<-EOF`);
   - hay una llamada que escribe: `open(` con modo `'w'`/`'a'`/`'x'`/`'r+'` (comillas simples o dobles),
     `write_text`, `write_bytes`, `writeFile`, `writeFileSync`, `appendFile`, `appendFileSync`, `Bun.write`,
     `createWriteStream`, `File.write`;
   - algún literal entre comillas del comando es ruta de código según `isCodePath` (relativa o absoluta bajo
     `ROOT`, mismas `CODE_PREFIXES`).
   La razón del deny usa el mismo `MESSAGE_PREFIX` con esa ruta.
   No deniega: `bun run scripts/x.ts`, `node scripts/x.mjs`, `python3 -c "print(open('src/a.ts').read())"`
   (lee), ni un script en línea que escribe fuera de las rutas de código (`open('/tmp/x','w')`, `PLAN.md`).
2. **`tests/hooks/brain-no-code.test.ts`** — bug del test: `runHook` hereda `process.env`, así que con
   `ORCHESTOS_ROLE=executor` en el entorno (Luna) los casos de deny salen con stdout vacío. Construir el env sin
   `ORCHESTOS_ROLE` y añadirlo solo si se pasa `role`.
3. Tests nuevos (deny): `python3 - <<'EOF'\nopen('src/a.ts','w').write('x')\nEOF`;
   `python3 -c "from pathlib import Path; Path('tests/a.ts').write_text('x')"`;
   `node -e "require('fs').writeFileSync('scripts/a.ts','x')"`; `bun -e "await Bun.write('.claude/hooks/x.js','x')"`;
   ruta absoluta `<root>/src/a.ts` dentro de un heredoc. Tests (allow): los cuatro "No deniega" de arriba, y el
   primer caso de deny con `role = 'executor'`.

## Verificación (obligatoria antes de reportar)
`bunx tsc --noEmit`, `bun run lint`, `bun test tests/hooks/brain-no-code.test.ts` y `bun test` completo (baseline
del cerebro fuera del sandbox: 1561 pass, 0 fail; en tu sandbox ~3 fallos de entorno: `adversarial-review`,
`EADDRINUSE` — los de `brain-no-code` deben desaparecer con el punto 2). Reporta la salida real. No commitees.
No invoques `codex exec` ni delegues a otro agente.

## Fuera de esta pasada
Detectar escritura por `cp`/`mv`/`install`/`dd` hacia rutas de código; scripts guardados en archivo y luego
ejecutados.
