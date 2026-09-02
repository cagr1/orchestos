# Product

## Users

Dos audiencias sobre el mismo sistema, no dos productos separados:

- **Usuario de Chat**: entra con una intención en lenguaje natural y espera conversar, delegar,
  aprobar acciones importantes y recibir resultados sin aprender la arquitectura de agentes.
- **Operador de Workspace**: trabaja deliberadamente sobre proyectos; necesita ver agentes,
  sesiones, tareas, runs, evidencia, costos y configuración para gobernar trabajo serio.

Carlos representa hoy ambos perfiles. El contexto típico combina sesiones de trabajo concentradas
con agentes CLI en paralelo, pero la superficie Chat debe poder servir a usuarios no técnicos.

## Product Purpose

OrchestOS es una aplicación de orquestación de agentes con una progresión de profundidad:
Chat permite expresar una intención y seguir su resultado; Workspace revela el mismo trabajo
como proyecto, agentes, sesiones, tareas, runs y evidencia. Éxito = que el usuario común complete
su trabajo sin aprender términos internos y que el operador pueda explicar qué corrió, qué falló,
por qué y cuánto costó sin salir del navegador.

## Brand Personality

Una aplicación local, moderna y deliberada: tranquila en Chat, densa pero gobernable en Workspace.
El pulido comunica calidad mediante composición, jerarquía, profundidad sutil y microinteracciones
intencionales; nunca mediante decoración que compita con el trabajo.

## Anti-references

No hay un anti-referente nombrado explícitamente más allá de los bans estándar del skill (gradientes decorativos, hero-metric template, cards idénticas, eyebrows en cada sección). El criterio de validación explícito del usuario es empírico, no narrativo: cualquier hallazgo o fix debe verificarse en vivo contra el dashboard real corriendo (Playwright — captura + hover/focus real), no solo leyendo CSS estático. Ya hubo regresiones reales detectadas únicamente así (tooltips rotos por `overflow:hidden`, `<select>` sin estilizar, emojis rotos).

## Design Principles

- **Profundidad progresiva**: Chat → trabajo contextual → Workspace. Ninguna persona debe
  navegar por conceptos de implementación para completar una tarea sencilla.
- **Proyecto como contenedor visual**: en Workspace, los agentes, sesiones y evidencia
  pertenecen a un proyecto; no se presentan como pantallas globales inconexas.
- **Densidad sin agobio**: información rica sólo en el contexto que la requiere; el detalle
  aparece en inspector o superficie seleccionada, nunca como pared de métricas.
- **El pulido sirve a la claridad**: profundidad, motion y detalle son medios para que el estado del sistema se entienda más rápido, no decoración.
- **Una realidad, dos vistas**: Chat y Workspace representan las mismas conversaciones, proyectos,
  tareas y runs. Nunca duplican ni migran datos entre productos.
- **Verificar en vivo, no solo en código**: ningún cambio visual se considera terminado sin verificación real en el navegador (captura + interacción), porque varios bugs reales ya se escaparon de la sola lectura de CSS/HTML.
- **Sistema existente, no otra reescritura de stack**: el rediseño evoluciona los tokens CSS y
  las islas React/componentes ya introducidos; no agrega una librería visual o una segunda fuente
  de estado para perseguir la apariencia.
- **Dark-only por decisión, no por default**: el tema oscuro es la elección deliberada (no "porque las herramientas se ven cool en dark") — no se pide light mode.

## Accessibility & Inclusion

WCAG AA como estándar (contraste ≥4.5:1 texto body, ≥3:1 texto grande) y soporte de `prefers-reduced-motion` en toda animación nueva. Sin requisitos adicionales más allá de eso — es una herramienta de un solo usuario interno, pero se mantiene el estándar igual.
