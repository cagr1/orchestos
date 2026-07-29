# Sistema de roadmaps de OrchestOS

Bloque M.0 (Mes 24, PLAN.md), 2026-07-29. Diseño del sistema — no un roadmap en sí.

**Origen**: Carlos notó que, como desarrollador, también olvida protocolos/configuraciones previas
al trabajar en un lenguaje que no domina a fondo, y que OrchestOS aumenta capacidades (mutation
testing, seguridad) por lectura/intuición sin un orden fijo. La referencia fue `roadmap.sh`. Este
documento decide **cómo** ese conocimiento entra a OrchestOS sin volverse una segunda fuente de
verdad ni documentación aspiracional sin verificar.

---

## 0. Auditoría previa — qué ya existe (obligatoria antes de diseñar, ver PLAN.md M.0)

Antes de crear nada, se verificó qué de esto ya está resuelto en el repo:

| Pieza existente | Qué cubre realmente | Qué NO cubre |
|---|---|---|
| `skills/*.yaml` (`description`, `when_to_use`) | Instrucciones operativas puntuales — "cuándo disparar esta skill durante UNA tarea" | Ningún orden de etapas de ingeniería; no sabe qué falta antes o qué sigue después de la tarea actual |
| `src/graph/resolvers/{rust,go,java,csharp}.ts` + `resolver-registry.ts` | Resolución de imports para el grafo de dependencias del código (Mes 5, S21) | Toolchain, tests, build, seguridad, deploy — es *solo* resolución de paths de import, nada de flujo de trabajo |
| `defaultChecksFor()` ([checks.ts](../../src/run/checks.ts)) | Detecta `.ts/.tsx` → `tsc`+`bun test`; `.js/.html` → `node --check`; assertion-gate | **Cero soporte para Rust/Go/Python** — no genera ningún check para esos lenguajes hoy |
| `language_targets` en `tasks.yaml`/skills | Filtra qué skills aplican a una tarea según lenguaje declarado | No verifica que el lenguaje declarado tenga tooling instalado, ni en qué orden trabajarlo |
| `AGENTS.md` | Reglas de colaboración entre LLMs (git, scope-lock, commits) | Nada específico de lenguaje ni de orden de etapas técnicas |
| `CONTEXT.md` | Snapshot de arquitectura/estado de ESTE repo (hot files, invariantes) | No es una guía reutilizable para otro proyecto/lenguaje |

**Conclusión de la auditoría**: no existe hoy, en ningún archivo, una noción de **orden** entre
etapas de ingeniería (toolchain → build → tests → seguridad → observabilidad → deploy → rollback).
Ese es el único hueco real que este sistema debe llenar — no reemplaza skills, resolvers, ni
`AGENTS.md`/`CONTEXT.md`, se apoya en ellos.

---

## 1. Jerarquía de capas (fuente de verdad)

```
docs/roadmaps/engineering-baseline.md   ← universal, cualquier proyecto/lenguaje
docs/roadmaps/languages/<lenguaje>.md   ← diferencias del lenguaje/ecosistema
docs/roadmaps/project-profile.md        ← evidencia real de ESTE repositorio detectado
        ↓ (consumido por)
skills/*.yaml                           ← cómo ejecutar la tarea (instrucciones al agente)
checks.ts / CI                          ← qué se comprueba automáticamente
AGENTS.md / CONTEXT.md                  ← reglas y estado estable del repo
```

Precedencia: **project-profile > language > universal**. El perfil del proyecto real siempre gana
sobre un default genérico — si `project-profile.md` dice que este repo no usa `clippy`, ninguna
guía de Rust debe imponerlo como obligatorio.

## 2. Las tres capas de conocimiento

1. **Universal** (`engineering-baseline.md`): el orden mínimo antes de tocar código, independiente
   del lenguaje — entender dominio, ubicar límites de confianza, confirmar toolchain, etc.
2. **Lenguaje/ecosistema** (`languages/<lenguaje>.md`): lo que cambia por lenguaje — `cargo` vs
   `go.mod` vs `package.json`, ownership vs GC, goroutines vs async/await, etc.
3. **Proyecto** (`project-profile.md`): lo que es verdad SOLO en este repositorio — comandos reales
   detectados, versión de toolchain instalada, si hay CI, si hay Docker, etc.

## 3. Modelo de etapas (el hueco real que llena este sistema)

El roadmap no es una lista plana de categorías — es una **secuencia de etapas con prerequisitos**,
para poder responder la pregunta real que motivó el bloque: *OrchestOS entra a un proyecto a medio
camino — ¿en qué etapa está, y qué etapa anterior quedó sin resolver aunque nadie la pida?*

| # | Etapa | Prerequisito (etapa anterior en `verified`/`not-applicable`) | Salida esperada |
|---|---|---|---|
| 1 | **Entorno** — runtime/lenguaje, versión, package manager | — (primera etapa) | Toolchain identificado y ejecutable en este entorno |
| 2 | **Estructura** — layout del proyecto, entrypoints, módulos | 1 | Mapa de dónde vive qué |
| 3 | **Dependencias** — manifiesto, lockfile, instalación reproducible | 1 | Build reproducible entre máquinas |
| 4 | **Compilación/Build** | 2, 3 | Artefacto o proceso que corre sin errores de compilación |
| 5 | **Formato/Lint** | 4 | Convención de estilo aplicable y verificable |
| 6 | **Tests unitarios** | 4 | Suite ejecutable con resultado determinista |
| 7 | **Tests de integración/E2E** | 6 | Camino feliz real verificado, no solo unidades aisladas |
| 8 | **Seguridad** — secretos, dependencias, superficie de ataque | 3, 4 | Sin secretos expuestos, dependencias auditadas |
| 9 | **Observabilidad** — logs, métricas, errores | 4 | Se puede saber si algo falló sin leer código |
| 10 | **CI/CD** | 5, 6, 8 | Pipeline reproducible, no manual |
| 11 | **Despliegue** | 10 | Proceso de release documentado |
| 12 | **Rollback/recuperación** | 11 | Camino de vuelta ante un release roto |

Una etapa nunca se marca `verified` si su prerequisito sigue `missing` — eso es precisamente el
diagnóstico de "qué debería estar antes" que un desarrollador (humano o LLM) puede pasar por alto.

## 4. Estados explícitos (obligatorios, no opcionales)

| Estado | Significado |
|---|---|
| `known` | Viene de conocimiento general del lenguaje (documentación/entrenamiento) — **no verificado en este repo**. Nunca se presenta como si fuera un hecho confirmado. |
| `detected` | Un archivo/config real del repo sugiere esto (ej. existe `Cargo.toml`), pero el comando asociado no se corrió todavía. |
| `verified` | Se ejecutó el comando exacto en este repo y su salida real quedó citada como evidencia — mismo estándar de cita literal que `qa.ts` exige en K.4a. Nunca se marca `verified` de memoria. |
| `missing` | Se buscó explícitamente y no existe (ej. no hay lint configurado) — un hueco real, no un olvido de documentarlo. |
| `not-applicable` | La etapa no aplica a este tipo de proyecto (ej. "despliegue" en una librería sin release propio) — decisión explícita, no silencio. |

## 5. Esquema común de cada guía (`engineering-baseline.md` y `languages/<lenguaje>.md`)

Cada archivo de guía sigue esta estructura fija:

```markdown
# <Título>

## Propósito y supuestos
## Toolchain / versiones esperadas
## Estructura de proyecto esperada
## Comandos de desarrollo (dev, watch, run)
## Formato / lint
## Compilación
## Tests (unit / integration / E2E)
## Dependencias (gestor, lockfile, auditoría)
## Seguridad (secretos, superficie, dependencias)
## Observabilidad (logs, métricas, errores)
## CI/CD
## Despliegue
## Rollback / recuperación
## Checklist de revisión ("antes de cerrar")
## No asumir — alternativas y qué preguntar/detectar en vez de suponer
```

Cada sección de `languages/<lenguaje>.md` y `project-profile.md` lleva su estado (`known` /
`detected` / `verified` / `missing` / `not-applicable`) junto al contenido — nunca texto suelto sin
estado.

## 6. Contrato roadmap ↔ skill ↔ checks

- El **roadmap** explica QUÉ debe comprobarse y EN QUÉ ORDEN (las etapas y sus prerequisitos).
- La **skill** (`skills/*.yaml`) explica CÓMO ejecutar la tarea puntual con ese conocimiento ya
  cargado — no repite el roadmap completo en el prompt, lo referencia.
- `checks.ts`/CI comprueban automáticamente lo que sea mecánico. Si el roadmap declara un check
  obligatorio que no está disponible en el entorno, el resultado es `missing`/`blocked`, **nunca**
  un `pass` implícito por omisión (mismo principio fail-closed que K.1-K.4b en `qa.ts`).
- El QA-LLM puede seguir evaluando calidad de código, pero no sustituye un comando faltante ni
  inventa evidencia de una etapa no verificada.

## 7. Versionado y actualización

- Cada archivo de guía lleva `Última verificación: <fecha>` y el o los comandos usados para
  verificarla — igual que el resto de PLAN.md fecha cada cierre.
- **Regla de evolución** (ya en PLAN.md): un lenguaje/framework nuevo primero crea/actualiza su
  perfil y fixture (M.2); recién después se permite convertirlo en skill automática (M.4). Los
  perfiles no se dan por completos "porque el LLM ya sabe" — se completan con evidencia real
  (M.3/M.5).
- Cuando el tooling de un lenguaje cambia (nueva versión de `cargo`, `go vet` reemplazado, etc.),
  se actualiza el perfil correspondiente en el mismo turno que se detecta la diferencia — no se dejan
  perfiles desactualizados silenciosamente.

## 8. Explícitamente fuera de alcance de M.0

- No se construye todavía ningún perfil de lenguaje concreto (eso es M.2).
- No se conecta todavía a skills/prompts/QA (eso es M.4).
- No se trata `roadmap.sh` como fuente ejecutable — solo fue la inspiración inicial de Carlos; el
  contenido real de cada perfil se verifica contra este repo y este lenguaje, no se copia de ahí.
