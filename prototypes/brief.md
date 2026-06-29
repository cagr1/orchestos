Quiero rediseñar visualmente el dashboard de OrchestOS para que se sienta tan
pulido como Claude Desktop, Codex y Hermes — sin perder su identidad ni su
stack actual.

ESTADO ACTUAL (no asumir nada, esto es lo que existe hoy):
- Stack: vanilla HTML + CSS + JS (sin framework), servido por un server Bun/TS.
  Archivos: src/dashboard/public/{index.html, styles.css, screens.css,
  app.js, screens-core.js, screens-ops.js, data.js, i18n.js}.
- Layout: CSS grid de 3 zonas — sidebar angosta de solo-iconos (56px,
  iconos + tooltip on hover), header (52px, marca + status badge "IDLE/
  RUNNING" + contador de tareas activas), main scrollable, y un footer
  "terminal" colapsable con log de runs en verde sobre negro (estética
  consola).
- Tema: dark-only, paleta tipo GitHub Dark (bg #0d1117, surface #161b22,
  accent azul #58a6ff), bordes de 1px en casi todo, radius pequeño (6px),
  tipografía system-ui a 14px.
- Pantallas existentes: Chat (burbujas tipo iMessage), Tasks (kanban de 5
  columnas: pending/running/done/failed/blocked, con panel lateral de detalle
  deslizante), Runs (tabla con filas expandibles), Instincts (tabla con
  barras de confianza), Specs, Settings (lista de API keys + setup checklist),
  Memory (búsqueda + tarjetas), Skills (grid de tarjetas).
- Componentes reutilizables: .btn (variantes primary/success/ghost/danger),
  .badge (pills de color), .card, .modal (scrim + modal centrado), tablas
  .tbl, filtros con .field, toasts.
- Funciona bien, es legible y consistente, pero se siente "plano": bordes en
  vez de profundidad real, poco contraste de jerarquía visual, sidebar sin
  identidad (solo iconos), transiciones mínimas, estados vacíos genéricos.

OBJETIVO — mejoras a aplicar (visual, no funcional):
1. Profundidad real: reemplazar el sistema de "borde 1px + fondo plano" por
   capas de elevación (3-4 niveles) usando sombras suaves y diferencias sutiles
   de luminosidad entre superficies, en vez de solo --border. Los modales y el
   panel lateral deberían sentirse "flotando" (sombra grande + blur de fondo),
   no solo "con borde".
2. Sidebar con más intención: mantener el ancho compacto pero darle más
   identidad — separación visual clara entre nav primario/secundario, estado
   activo con glow sutil del accent (no solo borde lateral de 3px), espacio
   para branding más presente arriba.
3. Tipografía con jerarquía más marcada: subir el contraste de peso/tamaño
   entre títulos de pantalla, labels y body text. Hoy todo vive muy cerca de
   13-14px — crear una escala más clara (ej. 11/12/13/15/19/24px) y usar
   letter-spacing negativo en headings grandes para look "premium" (como
   hace Claude Desktop en sus títulos).
4. Radios y espaciado más generosos en componentes "hero" (modal, side-panel,
   compose-bar, chat) — radius-lg más grande (12-16px) en superficies
   flotantes, manteniendo radius pequeño en controles inline (badges, inputs).
5. Microinteracciones: easing curves más vivas (cubic-bezier con ligero
   overshoot en aperturas de modal/panel, no solo ease-out lineal), hover
   states con transform sutil (translateY(-1px) + sombra creciente) en cards
   clicables (kcard, skill-card, mem-card).
6. Accent con más vida: usar el azul actual (#58a6ff) pero agregar glow/
   gradiente sutil en elementos clave (botón primary, status-badge running,
   active nav icon) en vez de solo color plano — el tipo de "glow" que se ve
   en Hermes/Codex en sus indicadores de estado activo.
7. Estados vacíos y de carga con más personalidad: el .placeholder genérico
   actual (icono + texto centrado) debería sentirse menos "error 404" y más
   acompañado — quizás con una ilustración simple inline (SVG) coherente con
   la marca de OrchestOS, no solo un ícono outline gris.
8. Terminal footer: hoy es una franja verde-sobre-negro muy "hacker CLI" que
   contrasta fuerte con el resto. Decidir si se integra mejor visualmente con
   el resto del dashboard (mismos tokens de superficie, solo el texto del log
   en monoespaciado) o si se mantiene como acento deliberado de "consola viva"
   pero mejor enmarcado (con su propia elevación, no solo borde superior).
9. Command-palette feel: considerar un atajo de teclado (Cmd/Ctrl+K) que abra
   un buscador rápido de pantallas/tareas — es el tipo de detalle que hace que
   una app pequeña se sienta como herramienta profesional (presente en Claude
   Desktop, Hermes, VSCode, etc.).

RESTRICCIONES:
- Mantener vanilla CSS (variables CSS actuales en :root de styles.css) — no
  introducir Tailwind, ni frameworks de componentes, ni dependencias nuevas.
  Vanilla bien ejecutado puede lograr este look; el problema no es la
  tecnología, es la falta de capas de profundidad y jerarquía.
- No tocar la lógica de negocio ni los endpoints — esto es 100% capa visual
  (CSS + ajustes mínimos de HTML/markup donde sea necesario para soportar la
  nueva jerarquía visual).
- Mantener el tema dark-only por ahora (no pedir light mode).
- El resultado debe seguir siendo legible y funcional en ventanas chicas
  (es una app de escritorio/local, no necesita responsive mobile).

ENTREGABLE PEDIDO:
Genera 2-3 variantes de prototipo del "shell" completo (sidebar + header +
una pantalla representativa, ej. Tasks con el kanban) aplicando las 9 mejoras
de arriba con interpretaciones visuales distintas entre sí (ej: una más
"glass/elevación marcada", otra más "minimal con acentos de color", otra más
"tipo terminal premium"), para poder comparar antes de aplicar los cambios
al código real del dashboard. Cada variante debe ser un archivo HTML
standalone con su propio <style> inline (sin depender de otros archivos del
proyecto), para poder abrirla directo en el navegador.
