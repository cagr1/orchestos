# ADE — editor de archivos y Settings tomados de Orca, T3 Code y MonoCode (propuesta, espera GO)

Fuente (2026-11-07): Settings de las tres apps instaladas. Orca y T3 por los textos de su bundle
(`useSettingsNavigationMetadata`, `SettingsPanels`); MonoCode por accesibilidad, pantalla por pantalla.
Inventario crudo: `/tmp/ade-ref/{orca,mono}-inventory.txt` (temporal).

## Qué tenemos hoy (verificado en el código)

- Visor de archivos de **solo lectura**: `DevFilePanel.tsx` pinta `<pre>` con highlight.js; `api/explorer.ts`
  solo hace GET (árbol, archivo, búsqueda).
- Settings → General: `Language` y `I write code`. Appearance: 4 temas y 3 colores. Keybindings: tabla de solo
  lectura con **2 atajos** (`lib/keybindings.ts`: paleta y buscar settings).
- Agents (Providers, Model routing, Executor, API keys), Observe (Health, Usage), Protect (Danger zone), Proyectos.
- Sin sección Chat, Terminal, Editor ni Notificaciones.

## Cómo lo resuelven las referencias

| Tema | Orca | MonoCode | T3 Code |
|---|---|---|---|
| Editar archivos | Monaco; auto-guardado con espera configurable; diffs editables; recarga si cambia en disco | Editor propio; "Format on save" (Prettier) | Solo lectura + "Add to chat" / copiar mención |
| Atajos | Lista + conflicto terminal vs app | 48 comandos con columna "When"; clic graba la tecla nueva; Delete la desactiva | ~20 comandos (thread, terminal, diff, composer) |
| Chat | — | Layout, prompt anclado arriba, revelado suave, Queue/Steer, autocorrección | Envío con Enter vs ⌘Enter, Queue/Steer, streaming por párrafo, confirmar borrar/archivar |
| Notificaciones | Sí | Sonidos + notificación del sistema al terminar o pedir input | Notificaciones de hilo |
| Apariencia | Zoom de UI, fuente del IDE, ocultar archivos ignorados por git | Escala, colores de diff para daltónicos, archivos excluidos | Formato de hora, ancho del chat, colores de diff |
| Terminal | Fuente, cursor, scrollback, padding, tema | — | — |
| Por proyecto | Nombre/ícono, script de setup del worktree, rama base, carpeta de worktrees | Worktrees, archivo | Proyecto por defecto |

## Ítems propuestos — uno a uno, en este orden

Cada ítem: spec corto, ejecutor, verificación en vivo en el dashboard y commit propio.

1. **ADE.1 — Editar archivos desde el explorer.** CodeMirror 6 cargado bajo demanda, no Monaco (Monaco suma
   varios MB y workers; CodeMirror da lo mismo para editar y pesa menos). ⌘S guarda; punto de "sin guardar" en el
   tab; preguntar al cerrar con cambios. Backend: `PUT` de archivo confinado a la raíz del proyecto (rechaza `..`,
   symlinks que salen y binarios). Si el archivo cambia en disco (p. ej. lo editó un agente): sin cambios propios
   se recarga solo; con cambios propios aparece "Conservar el mío / Recargar", como Orca. Así no se bloquea al
   usuario mientras corre una tarea, pero tampoco se pisa en silencio lo que hizo el agente.
2. **ADE.2 — Settings → Editor** (Orca/MonoCode): auto-guardado (apagado / tras N ms), ajuste de línea, tamaño de
   fuente. Depende de ADE.1.
3. **ADE.3 — Atajos reales.** Un registro central de comandos que usen la paleta y los atajos, que pasan de 2 a
   ~20: ir a archivo, buscar en archivos, Settings, mostrar u ocultar el sidebar, cambiar Chat|Dev,
   siguiente/anterior/cerrar tab, terminal nueva u ocultarla, detener el run (Esc), zoom. La tabla muestra los
   atajos que de verdad existen.
4. **ADE.4 — Reasignar atajos** (MonoCode): clic en un atajo graba las teclas nuevas, Delete lo desactiva; avisa
   si choca con otro; se guarda en la config global. Depende de ADE.3.
5. **ADE.5 — Settings → Chat** (MonoCode + T3): enviar con Enter o con ⌘Enter; qué pasa si escribes mientras el
   agente trabaja (encolar o redirigir; primero verifico qué soporta hoy el composer); confirmar antes de
   archivar o borrar un hilo.
6. **ADE.6 — Notificaciones** (las tres): sonido y notificación del sistema cuando una tarea termina o necesita tu
   respuesta y no estás mirando la ventana. Interruptor por tipo.
7. **ADE.7 — Apariencia, parte 2:** escala de la interfaz (⌘= / ⌘- / ⌘0), mostrar u ocultar archivos ignorados
   por git en el explorer, colores de diff para daltónicos.
8. **ADE.8 — Diff por defecto** (Orca/T3): unificado o lado a lado, ocultar cambios de espacios, árbol de
   archivos abierto o cerrado.
9. **ADE.9 — Terminal** (Orca): fuente, tamaño, cursor, scrollback.
10. **ADE.10 — Por proyecto** (Orca): nombre e ícono visibles, script que corre al crear un worktree, rama base.

## Lo que no se adopta (por ahora)

Móvil, SSH y VMs en la nube, voz, computer use, mascotas y juegos, translucidez y blur, integraciones con
Jira/Linear/GitLab, cambio de cuentas por proveedor, telemetría, plugins. No suman al flujo actual o ya
están anotados en `IDEAS.md`.

## Cómo seguimos

GO de Carlos → los ítems pasan a `PLAN.md` y se ejecutan en orden, con un reporte al cerrar el lote.
Recomendación: empezar por ADE.1 + ADE.2 (lo que pediste: editar) y seguir con ADE.3.
