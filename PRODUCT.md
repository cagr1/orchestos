# Product

## Register

product

## Users

Carlos Gallardo — dueño y único usuario habitual del dashboard. Lo usa en dos modos: como humano (chat, tareas simples, sin código) y como operador (Tasks/Runs/Graph Runner/Memory/Specs, modo avanzado). El contexto de uso es sesiones de trabajo concentradas, frecuentemente en paralelo con la terminal de Claude Code — el dashboard es la superficie visual de un sistema de agentes autónomos (orquestación de tareas LLM, runner de grafo, memoria persistente).

## Product Purpose

OrchestOS Dashboard es la interfaz de control de un sistema de orquestación de agentes de IA: permite lanzar, monitorear y diagnosticar tareas y grafos de tareas ejecutados por LLMs, sin tener que leer logs de CLI o tocar la base de datos directamente. Éxito = poder confiar en el dashboard como fuente de verdad del estado del sistema (qué corrió, qué falló, por qué, cuánto costó) y poder operar el sistema completo (incluyendo el runner de grafo autónomo) sin salir del navegador.

## Brand Personality

Fácil e intuitivo, con el mismo feeling de Hermes / Claude Desktop: denso en información pero nunca abrumador, con detalles cuidados (profundidad sutil, microinteracciones intencionales) que comunican calidad sin saturar. No es una herramienta "fría" de operador puro — tiene pulido, pero el pulido sirve a la claridad, nunca la compite.

## Anti-references

No hay un anti-referente nombrado explícitamente más allá de los bans estándar del skill (gradientes decorativos, hero-metric template, cards idénticas, eyebrows en cada sección). El criterio de validación explícito del usuario es empírico, no narrativo: cualquier hallazgo o fix debe verificarse en vivo contra el dashboard real corriendo (Playwright — captura + hover/focus real), no solo leyendo CSS estático. Ya hubo regresiones reales detectadas únicamente así (tooltips rotos por `overflow:hidden`, `<select>` sin estilizar, emojis rotos).

## Design Principles

- **Densidad sin agobio**: mucha información en pantalla (tablas, badges, métricas) pero con jerarquía clara que evite la sensación de saturación.
- **El pulido sirve a la claridad**: profundidad, motion y detalle son medios para que el estado del sistema se entienda más rápido, no decoración.
- **Verificar en vivo, no solo en código**: ningún cambio visual se considera terminado sin verificación real en el navegador (captura + interacción), porque varios bugs reales ya se escaparon de la sola lectura de CSS/HTML.
- **Vanilla, sin frameworks nuevos**: CSS plano sobre las variables ya definidas en `:root` de `styles.css` — no Tailwind, no librería de componentes.
- **Dark-only por decisión, no por default**: el tema oscuro es la elección deliberada (no "porque las herramientas se ven cool en dark") — no se pide light mode.

## Accessibility & Inclusion

WCAG AA como estándar (contraste ≥4.5:1 texto body, ≥3:1 texto grande) y soporte de `prefers-reduced-motion` en toda animación nueva. Sin requisitos adicionales más allá de eso — es una herramienta de un solo usuario interno, pero se mantiene el estándar igual.
