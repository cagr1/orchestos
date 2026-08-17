# OrchestOS — Instrucciones para Claude / LLMs

## Regla cero — vale para CUALQUIER LLM, no solo Claude (2026-08-17, ESTRICTA)

Este archivo, `PLAN.md` y `AGENTS.md` no son sugerencias para un asistente en particular.
Aplican por igual a Claude, Codex, DeepSeek, opencode o cualquier otro modelo/CLI que
trabaje en este repo. La fuente común y el orden obligatorio viven en
`docs/agent-work-protocol.md`. **Antes de tocar código**, ejecutar:

    bun run agent:preflight -- --item <ID> --agent claude

El preflight no sustituye leer las reglas: valida que el ítem exista y siga abierto, muestra el
working tree y bloquea hooks ausentes o desincronizados.

Motivo real, incidente 2026-08-17: el hook `.git/hooks/pre-commit` (no versionado por
git) estuvo 11 días desincronizado de su fuente (`scripts/pre-commit.sh`) — el paso de
`security:secrets` se agregó a la fuente el 29-jul y nadie reinstaló el hook, así que
todos los commits pasaron sin ese chequeo, en silencio, sin error visible. Es el mismo
patrón de fondo que el "botón que no hace nada" en el dashboard: una regla escrita que
nadie hace cumplir mecánicamente deja de existir en la práctica. Corregido con un
self-check en el propio pre-commit (compara `scripts/*.sh` vs `.git/hooks/*`, aborta el
commit si difieren).

**No se admite más "interfaz que no aporta":** ningún botón, config o pantalla se
entrega sin verificar en vivo (dashboard real corriendo, no mocks) que hace lo que dice
que hace — ver `feedback-verificar-gates-en-vivo` y `feedback-dashboard-no-solo-cli` en
memoria. Si una feature no se puede verificar en el momento, se dice explícitamente en
vez de reportarse como lista.

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
- **Push automático (autorización permanente, 2026-07-08):** hacer `git push origin master` automáticamente después de cada 2-3 commits locales, sin esperar a que Carlos lo pida. No aplica a fixes durante debugging activo (commits que se van a amendear/squashear) ni si hay un motivo explícito para retener el push (ej. cambio a mitad de verificar algo). Esta autorización cubre `git push` normal, NO `--force` (eso sigue requiriendo pedido explícito, regla de arriba).

## Planificar antes de cambios grandes (regla 2026-07-17)

Si el pedido implica tocar múltiples módulos/capas o cambia un comportamiento central del sistema
(ej. el routing de modelo/motor, el flujo de auto-creación de tareas del chat) — **no arrancar a
codear archivo por archivo en caliente**. Primero presentar un plan corto (alcance, pasos
concretos, qué queda explícitamente fuera de esta pasada) y esperar confirmación o ajuste de
Carlos. Motivo real: la cascada de selección de motor (local→CLI→API, Bloque E.16) se empezó a
implementar sin plan compartido — Carlos cortó a mitad de camino porque el tamaño del cambio lo
ameritaba. Fixes puntuales de un solo archivo/función (como la mayoría del Bloque E de este Mes)
NO necesitan este paso — la señal es "¿esto toca más de un módulo o redefine un comportamiento
central?", no el conteo de líneas. Ver también la regla de scope-lock más arriba en PLAN.md.

## Hooks de git

El proyecto tiene dos hooks. Si clonas el repo en otra máquina, instala **ambos**:

    bun run hooks:install

- **pre-commit** (`scripts/pre-commit.sh`) — `tsc --noEmit`, `security:secrets`, `ledger:gate`
  y el export de `runs-summary.json`. Rápido, corre en cada commit.
- **pre-push** (`scripts/pre-push.sh`, 2026-08-01) — corre `bun run test:coverage`, el
  comando **exacto** del workflow de CI (~20s).

## Verificar contra CI, no contra tu máquina (regla 2026-08-01)

Al tocar algo que CI ejercita, correr **el comando exacto del workflow** (`bun run
test:coverage`), nunca `bun test` a secas — el gate de cobertura vive dentro de ese
script y `bun test` no lo toca. Motivo real: CI estuvo verde por última vez el
2026-07-13 y rojo en el **100%** de los pushes desde el 2026-07-29, por dos bugs que
solo se manifestaban fuera del Mac:

1. Un test afirmaba que `cargo` no estaba disponible — o sea, afirmaba sobre el PATH
   del host. El Mac no tiene Rust, `ubuntu-latest` sí lo trae preinstalado. Cualquier
   cosa que dependa de un binario del sistema va detrás de una **sonda inyectable**
   (`ToolchainProbe` en `src/detect/roadmap-profile.ts`), nunca de un spawn directo
   dentro del test.
2. El trinquete de cobertura se calibró contra el número del Mac. La cobertura **no es
   igual entre entornos** (Mac 74.08%/60.42% vs CI 72.98%/59.71%), porque según qué
   binarios existan se ejecutan ramas distintas. Los umbrales de
   `scripts/check-coverage.ts` se calibran contra el número del **log de CI**, con
   margen, y solo suben.

Corolario que costó semanas: un CI que falla siempre deja de dar señal. Si CI está
rojo, arreglarlo es prioridad — no ruido de fondo. Y `Mutation Shards` rojo casi nunca
es un problema de mutación: Stryker aborta con "failed tests in the initial test run"
cuando la suite normal falla.
