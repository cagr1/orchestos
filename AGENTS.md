# OrchestOS — Instrucciones para Codex / LLMs

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

## Qué está listo para tomar ahora (2026-07-27)

Carlos trabaja hoy/mañana principalmente contigo (cupo semanal de Claude alto, reset el jueves).
Estos ítems están escritos como spec ejecutable — el diseño ya está decidido en PLAN.md, no hace
falta que Claude esté en el loop:

- **PLAN.md § Bloque K — K.1, K.2, K.3, K.5** (⚡). Es el CORE del producto: hacer que el QA
  verifique ejecutando en vez de leer. Cada uno cierra solo, son independientes entre sí, y el
  spec incluye qué validar. Empezá por K.1 o K.3 (los más acotados).
- **PLAN.md § Bloque J — J.1** (⚡). Coverage gate con umbral-trinquete. Chico y autocontenido.

**NO tomes**:
- **K.4** — 🧠 con 3 decisiones de diseño sin resolver, marcadas explícitas en el ítem. Es el
  diferenciador central; requiere plan corto confirmado por Carlos antes de codear.
- **H.8** — 🧠, pase visual final. Necesita verificación en vivo en navegador con juicio estético.
- La tarea `debug-codex-cli-deepseek` de `tasks.yaml` (`output: []` inválido, fantasma de un falso
  positivo) — está anotada en PLAN.md § Bloque H, pendiente de decisión de Carlos. No la borres ni
  la corrijas sin que él lo pida.

## Pre-commit hook

El proyecto tiene un pre-commit hook en `scripts/pre-commit.sh` que corre `tsc --noEmit` antes de cada commit. Se instala automáticamente copiándolo a `.git/hooks/pre-commit`. Si clonas el repo en otro lado, ejecuta:

    cp scripts/pre-commit.sh .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
