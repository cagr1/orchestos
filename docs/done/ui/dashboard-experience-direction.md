# Dirección de experiencia del Dashboard — OrchestOS

**Estado:** decisión de producto confirmada por Carlos, 2026-09-02.
**Propósito:** fuente persistente para el reemplazo de la interfaz. No es una moodboard ni un
inventario de features: fija la arquitectura de información, la dirección visual y los criterios
con los que se aceptará o rechazará cada pantalla.

## Decisión central

OrchestOS ofrece **un motor y un modelo de datos**, con dos profundidades de interfaz:

1. **Chat** es la entrada por defecto. Un usuario expresa una intención, conversa, adjunta
   contexto, aprueba acciones relevantes y recibe resultados. No necesita saber qué es un run,
   grafo, skill, router o memoria.
2. **Workspace** sirve para trabajo serio por proyecto. Muestra agentes, sesiones, tareas, runs,
   evidencia, configuración y actividad para operar, investigar y decidir.

No son dos productos ni dos bases de datos. El chat, la tarea, el run y el proyecto son los mismos
objetos. Cuando una conversación haya generado trabajo persistente, el usuario puede abrir
**Ver espacio de trabajo** y llegar al proyecto, agente y ejecución exactos que la originaron.
"Simple" y "avanzado" describen profundidad, no una clasificación permanente de usuarios: no se
debe pedir a una persona que elija un modo antes de entender qué necesita.

## Patrón de interfaz adoptado

```text
Proyecto → entidad seleccionada → superficie de trabajo → inspector bajo demanda
```

El proyecto es el contenedor visual de Workspace. Un agente pertenece a un proyecto; una tarea y
su evidencia pertenecen al agente o proyecto que las produjo. Las herramientas profundas aparecen
sólo al seleccionar ese contexto. La aplicación evita convertir su arquitectura interna en la
navegación primaria.

### Qué ve cada profundidad

| Chat | Workspace |
| --- | --- |
| Conversaciones, adjuntos, resultados, trabajo en curso y aprobaciones en lenguaje humano. | Proyectos, agentes agrupados, sesiones, tareas, runs, evidencia y configuración. |
| Un compositor contextual y tarjetas de trabajo vivas; una ejecución puede revelar progreso sin mostrar telemetría cruda. | Un canvas de proyecto con densidad operativa; el inspector abre el detalle de la entidad seleccionada. |
| Acción principal: describir o continuar trabajo. | Acción principal: gobernar, observar, revisar o intervenir sobre trabajo existente. |

## Investigación y fuentes verificables

La decisión se basa en interfaces reales abiertas o documentadas el 2026-09-02. Los enlaces y el
patrón extraído se conservan para que otro modelo o una revisión humana pueda comprobar, ampliar o
cuestionar este análisis.

| Fuente | Evidencia revisada | Patrón que se adopta / límite |
| --- | --- | --- |
| [Orca ADE](https://www.onorca.dev/) · [repositorio](https://github.com/stablyai/orca) | Tour público: Projects → worktrees/tareas → agentes, terminal/diff/browser dentro del workspace seleccionado. | Proyecto y trabajo activo primero; herramientas profundas sólo dentro de contexto. No copiar su orientación exclusiva a código/worktrees. |
| [PI Dashboard](https://pi-dashboard.dev/) · [capturas y README](https://github.com/BlackBeltTechnology/pi-agent-dashboard/blob/develop/README.md) | Sesiones agrupadas por carpeta; cada una comunica estado, modelo, tiempo y tokens; la sesión abre el workbench. | Agrupación por proyecto, señales compactas de vida y disclosure progresivo. No copiar una consola de sesiones como home para todo usuario. |
| [Lightdash AI Agents](https://demo.lightdash.com/projects/2014e038-ff4b-4761-ae6f-fbf551e7b468/ai-agents/165a3354-b44f-4bae-a953-e46c64f96724/edit) · [docs](https://docs.lightdash.com/agents) | Un agente vive dentro de un proyecto y su configuración es contextual; composición de app moderna, no chat aislado. | Proyecto como límite de contexto, configuración contextual y paneles con buena composición. No copiar su dominio BI ni su paleta. |
| [Langfuse demo compartido](https://cloud.langfuse.com/project/clkpwwm0m000gmm094odg11gi) · [modelo de trazas](https://langfuse.com/docs/observability/best-practices) | Trace tree, timeline, sesión y detalle de input/output/costo/latencia. | Inspector forense de un run. No usar su alta densidad como superficie principal. |
| [ChatGPT Projects](https://help.openai.com/en/articles/10169521-projects-in-chatgpt) · [Claude Artifacts](https://support.anthropic.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them) | Chat es una entrada natural; un artefacto relevante puede abrir una superficie dedicada sin abandonar la conversación. | Transición de conversación a objeto/espacio persistente sin obligar al usuario a conocer la infraestructura. |
| [operate.to](https://www.operate.to/) | Une chat con proyectos y actividad de agentes, aunque conserva una identidad de control-plane. | Precedente parcial para la doble profundidad; OrchestOS se diferencia al enlazarla con evidencia y control local. |

**Conclusión de la investigación:** ningún referente se copia como producto completo. Orca aporta la
jerarquía proyecto→trabajo, PI la economía de señales y la agrupación, Lightdash la composición de
aplicación y configuración contextual, y Langfuse el detalle de diagnóstico. ChatGPT/Claude
confirman que una conversación puede abrir superficies persistentes sin obligar a comenzar en un
dashboard de operador.

## Arquitectura visual

### Shell

- Un rail izquierdo contiene selector de workspace, proyectos fijados/recientes, Activity y
  Settings. No lista diez capacidades internas como navegación primaria.
- El canvas central pertenece a una sola cosa a la vez: conversación, proyecto, agente o
  ejecución seleccionada. Su título, toolbar y contenido cambian con ese contexto.
- El inspector derecho es **condicional**. Se abre al seleccionar un agente, tarea, archivo, run
  o configuración; no existe como riel vacío permanente que reduzca el canvas.
- El acceso a Workspace desde Chat preserva la selección contextual; abrir una tarea no conduce a
  una tabla genérica sino a su proyecto y entidad de origen.

### Proyecto y agentes

- Los agentes se muestran como **groupboxes persistentes**, no como tarjetas KPI decorativas.
  Cada grupo responde de un vistazo: qué está haciendo, cuál fue su última acción y si necesita
  atención humana.
- La información de vida usa un estado compacto, nombre, resumen, tiempo relativo y, cuando sea
  relevante, modelo o presupuesto. El detalle técnico queda fuera del primer golpe de vista.
- Activity es una vista transversal deliberada para cruzar proyectos; no justifica que Runs,
  Graph, Specs, Skills, Memory e Instincts vivan como destinos globales de primer nivel.

### Configuración y profundidad

- Configuración global: Settings.
- Configuración del proyecto: dentro del proyecto.
- Configuración de agente, modelo y permisos: dentro del agente o acción que los usa.
- Formularios extensos o configuraciones con consecuencias: página o inspector, nunca modal
  gigantesco.
- Modales: confirmación breve, decisión irreversible o creación mínima. No se usan como atajo
  para evitar diseñar una superficie contextual.

## Sistema de componentes y composición

Estas reglas complementan los tokens y el carril de estado ya definidos en `PLAN.md` UI.3.5.

- **Tabs:** cambian vistas pares de la entidad ya seleccionada (por ejemplo, actividad, archivos,
  evidencia). No sustituyen la navegación global ni esconden dominios diferentes sin contexto.
- **Selects:** controles buscables y consistentes (`Combobox`); no `<select>` nativos sin estilo.
  El selector debe mostrar el nombre humano y el detalle útil, no obligar a memorizar IDs.
- **Botones y acciones:** una acción primaria por superficie. Acciones secundarias salen en
  hover/focus o menú contextual; las destructivas nunca compiten visualmente con el flujo normal.
- **Contenedores:** tres niveles de superficie neutrales, borde y espaciado antes que sombras
  pesadas. Se prohíbe usar `.card` como envoltorio por defecto o una grilla de métricas para
  representar entidades vivas.
- **Color:** señal semántica y acción primaria, nunca decoración. Se conservará una identidad
  propia de OrchestOS; no se copiarán colores de Orca, PI, Lightdash o Langfuse. La paleta exacta
  se decidirá mediante composiciones aprobadas, no por intuición durante implementación.
- **Tipografía:** los tokens de UI.3.5 gobiernan escala; sans para intención y prosa, mono para
  IDs, modelos, costo, fechas, rutas y evidencia. La jerarquía se construye primero con tamaño,
  peso, espacio y alineación, no con cajas de color.
- **Motion:** sólo para cambio de estado, apertura/cierre de inspector, feedback o progreso.
  Duración breve y `prefers-reduced-motion` obligatorio; no hay coreografías de carga.

## Confianza y seguridad en Chat

La simplicidad no puede volver opaco al agente. Antes de filesystem, shell, web, API externa o
gasto relevante, Chat debe comunicar en lenguaje humano qué hará, sobre qué alcance y cuándo pide
aprobación. Workspace permite revisar la evidencia completa de esa misma acción.

Esta regla aplica el insight `INS-2026-014`: los permisos y límites de herramientas deben ser
explícitos antes de producción; un prompt no es un límite de seguridad.

## Anti-patrones explícitos

- Un home lleno de KPI cards, gráficos o tablas que no permite actuar.
- Dos productos o dos modelos de datos para Chat y Workspace.
- Un toggle persistente que obliga a elegir “usuario simple” o “avanzado”.
- Sidebar de capacidades internas: Chat, Tasks, Runs, Graph, Memory, Skills, Specs, etc.
- Inspector derecho vacío y permanente.
- Colores, glassmorphism, badges o sombras usados para simular calidad.
- Modales extensos usados como configuración principal.
- Ocultar permisos, costos o acciones con impacto en nombre de una interfaz sencilla.

## Criterios de aceptación del rediseño

1. Una persona puede iniciar y seguir trabajo desde Chat sin conocer el vocabulario interno.
2. Un operador puede llegar desde cualquier chat al proyecto, agente y evidencia que lo explican.
3. El primer viewport de Workspace responde qué está vivo, qué requiere atención y qué proyecto
   está seleccionado sin una pared de telemetría.
4. Todo panel, tab, select, drawer, modal y estado se verifica en el dashboard real con navegador
   y teclado, incluidos loading, vacío, error, foco y `prefers-reduced-motion`.
5. Ningún cambio visual se declara terminado sin una composición aprobada y evidencia de la
   implementación real; una captura bonita no reemplaza interacción ni persistencia.

## Secuencia de implementación

La dirección no autoriza una reescritura en caliente. Mantener una fuente de estado y contratos
existentes mientras cambia la superficie; cada tramo se implementa con un gate real. El orden y
la asignación viven en `PLAN.md` (`UI.3.5`–`UI.7`), actualizado por esta decisión.
