# OrchestOS — Instrucciones para Claude / LLMs

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

## Pre-commit hook

El proyecto tiene un pre-commit hook en `scripts/pre-commit.sh` que corre `tsc --noEmit` antes de cada commit. Se instala automáticamente copiándolo a `.git/hooks/pre-commit`. Si clonas el repo en otro lado, ejecuta:

    cp scripts/pre-commit.sh .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
