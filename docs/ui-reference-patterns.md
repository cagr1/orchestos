# Patrones extraídos de las referencias visuales — OrchestOS

**Estado:** insumo de implementación, 2026-09-02. Complementa
`docs/dashboard-experience-direction.md` (que fija la decisión de producto); este archivo fija
**la anatomía concreta** que se va a construir, para que ninguna pantalla se diseñe por intuición
durante la implementación.

**Fuente:** capturas tomadas por Carlos el 2026-09-02, en `~/Documents/screens/` (fuera del repo,
por peso): `Orca1_main.png`, `Orca_agents.png`, `Orca_general.png`, `Orca_integrations.png`,
`Orca_stats.png`, `Orca_voice.png`, `lightdash_main.png`, `lightdash_agents.png`,
`lightdash_Identity.png`, `lightdash_memory.png`, `lightdash_history.png`,
`lightdash_profile.png`. PI Dashboard no se pudo instalar; su anatomía se extrajo del README del
repo (`BlackBeltTechnology/pi-agent-dashboard`, rama `develop`).

**Regla que gobierna todo lo de abajo:** se toma **estructura, anatomía y jerarquía**. No se toma
paleta, tipografía de marca ni componentes literales. La identidad visual de OrchestOS es propia
(`dashboard-experience-direction.md` § Sistema de componentes).

---

## A. Orca — el modelo estructural principal (dark, mismo dominio, mismo usuario)

### A.1 El rail izquierdo tiene 3 capacidades globales, no 10
Orca lista exactamente `Tasks`, `Automations`, `Orca Mobile`, luego `Search`, luego la sección
`Projects` con el árbol. Nada más es destino global.

**Corrección para OrchestOS:** el nav actual (`app.js:123-132`) tiene 10 entradas —
`chat · project · instincts · skills · tasks · runs · graph · memory · specs · settings`.
Baja a: **`Chat` · `Activity`** arriba, **`Proyectos`** (árbol) en el medio, **`Settings`** abajo.
Las 7 capacidades restantes dejan de ser destinos y pasan a tabs de la entidad seleccionada.

### A.2 El "groupbox de agente" NO es una card: es una fila de árbol colapsable
Jerarquía literal de Orca en el rail:

```
Proyecto (icono + nombre)
└── rama  [primary]
    ├── worktree (nombre + pin)
    └── 2 agents  ⌄            ← header colapsable con contador
        ├── [C] Handoff y resolución…            1h
        └── [◉] or…              gpt-5.6-terra   17m
```

Fila de agente = `[glifo del agente] [título truncado] [modelo] [tiempo relativo]`.
**Sin borde, sin caja, sin badge de color.**

**Esto resuelve la cardinalidad** (la pregunta abierta de la auditoría §6.3): con 5 agentes no hay
5 cards compitiendo, hay 5 filas bajo un header `5 agents ⌄` que colapsa. No hace falta inventar
regla de priorización.

### A.3 Selección = un único contenedor con borde; todo lo demás es plano
Sólo el proyecto/rama activo tiene borde + fondo levemente más claro. Es la aplicación literal de
la regla de UI.3.5 ("la jerarquía se hace con línea de 1px + espaciado, no con caja de
borde+fondo+sombra") — y la prueba de que funciona en un producto real.

### A.4 La anomalía se muestra inline, donde vive
`Detached HEAD @ e67d136` aparece como pill ámbar **en la fila del repo afectado**, no como
notificación global ni banner superior.

**Corrección:** OrchestOS hoy tiende al aviso global. Los estados anómalos (tarea bloqueada, run
fallido, worktree sucio) van en la fila de su entidad.

### A.5 Barra de estado inferior permanente
Orca la mantiene idéntica en todas las pantallas, incluida Settings:

```
✳ 22% used 3h 15m   ⚠ Refresh failed   ⟳          3.78 GB · >_ 8 · ⑂ 2
```

Izquierda: **porcentaje de contexto consumido + tiempo de sesión**. Centro: avisos. Derecha:
recursos (memoria, shells abiertos, ramas).

**Corrección — esto es exactamente la superficie que le falta a `H.7.5`.** El % de contexto **no
va en una card del home**: va en la barra de estado, siempre visible, en mono, sin caja. Resuelve
también la pregunta abierta de la auditoría §6.1 (dónde vive el costo en Chat): mismo lugar.

### A.6 El estado de permisos nunca se oculta
Sobre el compositor, una tira permanente de una línea:
`▶▶ bypass permissions on · 1 shell · ← for agents`

**Corrección para `UI.8.6` / `INS-2026-014`:** el modo peligroso se declara siempre, en texto
plano y bajo peso visual — no en un modal que se acepta una vez y se olvida.

### A.7 Las tabs del canvas son documentos/sesiones abiertas, no capacidades
`PLAN.md` · `orchestos` · `Handoff y re… [C]` (activa) · `PRODUCT.md` · `+`, con el glifo del
agente en la sesión activa y `▷ Command` a la derecha. Confirma la regla ya escrita: *"tabs
cambian vistas pares de la entidad ya seleccionada"*.

### A.8 Settings es pantalla completa con nav propio agrupado por dominio
`← Back to app`, `Search settings ⌘F`, y luego secciones con label en **mayúsculas pequeñas
muted**:

- `Onboarding checklist` (suelto, arriba)
- **AI CAPABILITIES** — Agents · AI Provider Accounts `OPTIONAL` · Orchestration · Computer Use · Voice
- **SET UP** — General · Integrations · Mobile
- **WORKFLOWS** — Git & Source Control · Task Sources · Terminal · Quick Commands · Browser · Mobile Emulator

El ítem seleccionado lleva contenedor con borde; el hover, relleno sutil sin borde.

### A.9 Anatomía de fila de setting — el patrón más reusable de todos
```
Label (peso medio, ~15px)                          [control alineado a la derecha]
Descripción (muted, ~13px, 1–2 líneas)
```
**Sin divisores entre filas**: la separación es espacio en blanco. Un único contenedor redondeado
agrupa todas las filas de la pantalla.

**Corrección directa al reclamo de Carlos** (*"Settings no parece usable, hay cosas que hay que
desaparecer o darles sentido"*): cada setting explica qué hace en una línea, junto al control. Hoy
OrchestOS tiene controles sin explicación.

### A.10 El selector de agente es un grupo de chips, no un `<select>`
`Auto` · `>_ No agent (blank terminal)` · `✳ Claude` · `◉ Codex ✓` · `OpenCode` · `Hermes`
El seleccionado lleva fondo más claro + borde + `✓`. Cada chip tiene el icono de su proveedor.

**Corrección:** reemplaza el picker de agente pendiente de `CC.D2`/`UI.6`. Con 4–6 opciones fijas,
chips; el `Combobox` buscable se reserva para listas largas (modelos), como ya manda
`reference-model-combo-pattern`.

### A.11 Permisos = segmented control de dos estados
`Agent Permissions ⓘ` → `[ Yolo | Manual ]`, con descripción debajo: *"Choose whether Orca launches
agents with fewer permission prompts or with manual checks."*

Responde la pregunta que Carlos hizo sobre YOLO: es un **setting binario con nombre honesto**, no
un flag oculto.

### A.12 Confirmación externa de `INS-2026-016`
Orca tiene un setting llamado **Prompt Cache Timer**: *"Claude caches your conversation to reduce
costs. When idle too long the cache expires and the next message resends full context at higher
cost. This shows a countdown so you know when to resume."*

Un competidor trata el prompt cache como configuración de primera clase. Refuerza que el Bloque
H.7 no era sobreingeniería.

---

## B. Lightdash — se toma la estructura de configuración (light: el color no se toma)

### B.1 Settings agrupado por ALCANCE, no por feature
`Your settings` (Profile, Password, Warehouse connections, Scheduled deliveries, Personal access
tokens) · `Organization settings` (All projects, Ask AI…) · `Current project`.

**Ésta es la corrección exacta al Settings de OrchestOS.** Hoy mezcla config global, de proyecto y
de agente en una sola lista plana. Pasa a tres grupos por alcance:
**`Global` · `Proyecto` · `Agente`** — lo que además hace cumplir la regla ya escrita en
`dashboard-experience-direction.md` § Configuración y profundidad.

### B.2 Las capacidades profundas viven dentro de su capacidad padre
`Ask AI ⌄` contiene `Threads` · `Agents` · `Evals` · `MCP` · `Memories`.

**Precedente directo:** `Evals`, `Memory`, `Specs`, `Skills` e `Instincts` de OrchestOS no son
destinos globales — son sub-secciones de la capacidad a la que pertenecen. Confirma A.1 desde un
producto distinto.

### B.3 Toolbar de tabla
`[búsqueda] | [filtro ⌄ con borde punteado cuando está inactivo] [toggle con label] … [contador
"6 agents"]`, y **una sola** acción primaria arriba a la derecha (`New Agent`).

### B.4 Las celdas vacías nunca quedan en blanco
`No tags`, `None`, `No restrictions` — itálica muted. Nunca una celda vacía que parezca un bug.

### B.5 El nombre de la entidad es un chip con avatar, no texto plano
`[▣] AI Product Analyst` dentro de un pill con borde sutil.

---

## C. PI Dashboard — anatomía de la tarjeta de sesión (extraída del README)

### C.1 Agrupación jerárquica: `folder → branch → OpenSpec context`
Coincide con Orca (A.2). Dos productos independientes llegaron a la misma jerarquía: es el patrón,
no una preferencia.

### C.2 Campos exactos de la fila de sesión
- contexto de carpeta y rama
- cambios de spec adjuntos
- **gasto de tokens en vivo**
- modelo **+ nivel de thinking**
- **barra de uso de contexto**
- tiempo transcurrido con **contador vivo** ("live ticking counters on running operations")

**Corrección:** la *barra de uso de contexto* es el componente concreto que le falta a `H.7.5`, y
el *nivel de thinking* junto al modelo valida el `cli_effort` genérico de `H.8`.

### C.3 Estados de sesión
`running` (streaming vivo) · `completed` (duración final) · `ended` (preservada para **resume /
fork**) · `historical` (contenido lazy-loaded desde archivos de sesión).

**Decisión pendiente para Carlos:** OrchestOS hoy no tiene `ended` con resume/fork. Orca sí tiene
fork de sesión (`codex fork` existe en el CLI). Es una decisión de producto, no de UI.

### C.4 El detalle de sesión es un workbench, no una tabla
Chat bidireccional · spec adjunta aplicable · prompts `ask_user` interactivos · gauge de tokens ·
**tool-call cards** que abren el archivo en el editor · preview markdown con mermaid.

---

## D. Lo que estas referencias corrigen del OrchestOS actual — resumen accionable

| # | Hallazgo en el código actual | Corrección tomada de la referencia |
| --- | --- | --- |
| 1 | Nav de 10 capacidades globales (`app.js:123-132`) | A.1 · B.2 — 2 globales + árbol de proyectos + Settings |
| 2 | Sin modelo para "groupbox de agente" | A.2 — fila de árbol colapsable con contador, no card |
| 3 | 33 `.card` como contenedor por defecto | A.3 — sólo la selección lleva contenedor |
| 4 | Avisos globales de estado | A.4 — anomalía inline en la fila afectada |
| 5 | `H.7.5` sin superficie definida; costo sin lugar en Chat | A.5 · C.2 — barra de estado inferior permanente + barra de uso de contexto |
| 6 | Permisos/YOLO invisibles en la UI | A.6 · A.11 — tira permanente + segmented `Yolo \| Manual` |
| 7 | Settings plano y "sin sentido" (reclamo de Carlos) | B.1 — agrupado por alcance: Global / Proyecto / Agente |
| 8 | Settings sin explicación por control | A.9 — label + descripción de una línea + control a la derecha |
| 9 | `<select>` nativo para agente y para `cli_effort` (`screens-core.js:1117`) | A.10 — chips con icono; Combobox sólo para listas largas |
| 10 | Sin `ended`/resume/fork de sesión | C.3 — decisión de producto pendiente |
