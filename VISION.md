---
type: product-vision
project: orchestos
created: 2026-06-04
owner: Carlos Gallardo
status: borrador-v1
---

# VISION.md — OrchestOS

Brújula del producto. No es backlog (eso vive en [IDEAS.md](IDEAS.md)) ni historial
(eso vive en [DONE.md](DONE.md)). Es la frase de la que cuelga todo lo demás: si una
feature no sirve a esto, no entra.

---

## La frase raíz

> **OrchestOS convierte lo que una persona quiere lograr en trabajo de agentes que se
> puede verificar — para que dirigir software no exija saber programar.**

_(Borrador v1 — refinar con uso real. El test es: si alguien pregunta "¿qué es OrchestOS?",
esta frase basta. Aún suena un poco a dos ideas pegadas; la versión final debería elegir
cuál pesa más.)_

**Alternativas en juego:**
- Ángulo acceso: *"Dirigir agentes que programan, sin saber programar."*
- Ángulo confianza: *"Trabajo de agentes que puedes comprobar, no solo confiar."*

Las dos columnas del producto son **acceso universal** (cualquiera puede dirigirlo) y
**trabajo verificable** (contratos, evidencia, QA, memoria). La frase final debe sostener
ambas sin volverse una lista de features.

---

## El corazón — la tesis que lo originó

> "Cualquier persona debe poder usar esta herramienta sin saber de código."
> — Carlos Gallardo, 2026-05-27

Claude Code, Cursor, Copilot asumen que el usuario sabe programar. OrchestOS apuesta a
ser la primera herramienta de agentes que funcione para alguien que nunca abrió una
terminal — sin sacrificar el rigor que un dev exige.

---

## Qué problema resuelve

Delegar trabajo de software a un agente hoy exige: saber prompts, leer diffs, entender
qué es un commit, y confiar a ciegas en que el agente hizo lo correcto. OrchestOS quita
las dos fricciones: la **barrera técnica** (no necesitas el vocabulario) y la **barrera de
confianza** (no confías a ciegas — hay contrato, checks y evidencia de cada paso).

## Para quién

- **El no-dev** que tiene una intención clara ("quiero que el formulario valide el email")
  pero no sabe ni quiere saber cómo se implementa.
- **El dev** que quiere delegar trabajo acotado y verificable sin renunciar al control —
  contratos, sandbox, evidencia.

Un solo motor. La superficie cambia según quién mira (ver "Una herramienta, dos superficies").

## Qué lo hace distinto

- **Contract-first**: cada tarea declara qué archivos puede tocar. El agente no puede
  salirse del contrato — es verificación dura, no una sugerencia.
- **Evidencia, no fe**: cada run deja checks deterministas + QA + costo + qué intentó.
- **Aprende del proyecto**: memoria persistente, instincts con confianza, diagnóstico de
  fallos. La herramienta mejora con el uso real, no con configuración.
- **Agnóstico de harness**: no es un wrapper de Claude Code. Tiene protocolo propio.

## El flujo ideal

1. Conectas el proyecto (y resuelves la única barrera dura: la API key — ver IDEAS).
2. Dices qué quieres lograr, en tu idioma, sin jerga.
3. OrchestOS te muestra qué va a hacer antes de hacerlo (preview).
4. Ejecuta en sandbox; si algo no cumple el contrato, no se mergea.
5. Ves qué pasó y por qué — y la herramienta aprende para la próxima.

## Qué NO es

- **No es un SaaS** (no hasta que 10+ usuarios lo pidan explícitamente).
- **No es un harness** (no compite con Claude Code / Cursor — los puede usar como executor).
- **No es un chat genérico** — el chat es entrada conversacional, pero el corazón es
  trabajo verificable con contrato.
- **No es "dos productos"** — no hay una UI simple y otra avanzada. Es un motor con
  niveles de exposición.

---

## El norte — dirección de largo plazo

Lo que sigue NO es backlog inmediato. Es hacia dónde apunta el producto. Las features
concretas que sirven a estas direcciones viven en IDEAS.md, ordenadas por esfuerzo.

### 1. Acceso universal sin saber código

El estándar contra el que se mide cada decisión de UX: ¿podría usar esto alguien que nunca
programó? Los nombres internos (executor, instinct, spec, run) no deben aparecer crudos
frente a un no-dev. La traducción ya empezó (E1: instincts → "hábitos"; C5: executors →
"Rápido/Preciso/Económico").

### 2. Una herramienta, dos superficies (humano vs operador)

El aporte estructural más importante para Mes 10+. Hoy el sidebar expone Runs · Specs ·
Instincts · Memory como hermanos — todas abstracciones internas.

**Principio (no negociable):** NO se construyen dos UIs paralelas. Eso duplica
mantenimiento. Es **un solo motor con jerarquía de prominencia**:
- **Superficie humana (por defecto)**: qué quieres lograr · qué está pasando · qué
  aprendió · qué necesita tu aprobación.
- **Superficie operador (detrás de un toggle)**: Runs, cost breakdown, memory conflicts,
  spec lint, evidencia cruda.

El poder no se quita — se **degrada de prominencia** hasta que se necesita. La decisión
"modo simple encima del modo complejo" fue **rechazada** explícitamente: la forma correcta
es degradar/agrupar, no construir una segunda interfaz.

### 3. Onboarding adaptativo — ¿sabes programar?

El usuario **declara** si programa (no se detecta). A partir de ahí la herramienta ajusta
el trato: el no-dev recibe un wizard que genera tasks/constitution/checks en lenguaje
natural; el dev va directo a comandos. Es la materialización de "dos superficies" en el
primer contacto.

### 4. Landing page — la cara pública de esta frase

Misma fuente que este documento, dos formatos. VISION.md = brújula interna; landing =
proyección pública + ruteo ("¿por dónde empiezo?"). Se escribe DESPUÉS de fijar la frase
raíz. **Condición no negociable**: la landing nunca reemplaza arreglar el muro del API key
dentro del producto. Una puerta bonita a un muro sigue siendo un muro.

---

## Principios ganados (decisiones que ya probamos)

- **CLI-first fue la fundación correcta.** El dashboard (Mes 8-9) no reemplazó el CLI — lo
  envuelve. Cada botón es un comando que ya existía y estaba probado. Construir la UI antes
  del CLI sólido habría sido construir sobre arena.
- **El dashboard llegó cuando el CLI estaba estable**, no antes. La regla "UI después de
  motor probado" se cumplió y funcionó.
- **i18n desde el día uno del dashboard** (J1) — `t()` global en lugar de strings
  hardcodeados. Coste de adopción cero si se hace antes de escalar pantallas.
- **El humano decide siempre.** Diagnóstico sugiere, no ejecuta. Instincts auto nacen
  `unverified`. Ningún aprendizaje automático llega al motor sin aprobación.
