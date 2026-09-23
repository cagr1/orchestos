# Propuesta — flujo por lote con verificador mecánico (2026-09-23)

Estado: **propuesta, no adoptada.** Nada de esto es regla hasta que Carlos lo apruebe; si lo aprueba,
lo que sobreviva al primer lote pasa a `AGENTS.md` y lo demás se borra.

## 1. El problema, medido

- Cada ítem hoy = un tab nuevo + un prompt de 5 pasos pegado por Carlos. Un tab limpio cuesta
  **57,035 tokens antes del primer tool call** (medición en `CLAUDE.md` § Higiene de contexto), más el
  preflight, más releer PLAN.md/NEXT.md/spec para reorientarse. Ese costo se paga **por ítem**.
- Entre ítems el trabajo se detiene hasta que Carlos vuelve: "espera el GO", "decisión pendiente de
  Carlos", "lo prueba Carlos" aparecen en `NEXT.md`.
- El gate en navegador no existe como comando: vive en `/tmp/ui132b-gate*.mjs` (fuera del repo) y en el
  juicio visual de Opus. Por eso el ciclo no se puede cerrar sin un modelo fuerte mirando capturas.
- 95 de 170 commits del 9 al 22-sep son `docs`. Parte es memoria útil; parte es ceremonia.

Conclusión: no falta paralelismo (el serial es decisión tomada, ver memoria
`feedback-serial-por-decision-no-costumbre`). Falta que el **despacho entre ítems** y la **verificación**
no dependan de una persona.

## 2. Qué se toma de afuera y qué no

| Fuente | Se toma | No se toma, y por qué |
|---|---|---|
| Anthropic, compilador C (16 agentes) | Verificador casi perfecto como condición previa; salida de gates en una línea grepeable | Bucle infinito sin humano: su oráculo era GCC; el nuestro para "se ve como la plantilla" aún no existe |
| Lauren Tan, pstack | `/create-verification-skill`: "verificarlo" pasa a ser **capacidad del repo**, no conversación. Condición de fin explícita. Log de decisiones. Ruteo por complejidad. Versión liviana (`fstack`) para lo chico | `/swarm`, `/arena`, `/interrogate`: multiplican tokens ×N modelos. Ella trabaja con presupuesto corporativo (SpaceXAI) y 4 modelos frontera; sus 2,500 PRs son autoinformados |
| Bend (Victor Taelin, HigherOrderCO) | Las **leyes** como gate: invariantes escritas que el agente corre en ≤1 s tras cada cambio; `gates/_run.ts` = 4 gates con un solo comando; `WONTFIX.txt` = decisiones cerradas en un archivo que el agente lee | El lenguaje en sí: habría que reescribir OrchestOS (TS/React) en Bend, y "fiel a la plantilla" no es un teorema demostrable. Bend no es de Lauren; es de otro autor |
| Simon Willison | Un cambio significativo aterriza a la vez; el paralelo solo para lo que no toca el código | — |

Nota: el post de X no se pudo leer (X devuelve 402 sin sesión). Lo de Lauren sale del README de pstack y de dos
análisis (flaviocopes.com, folkfox.com), no del video.

## 3. La propuesta, por partes

### Paso 0 — construir el verificador (una sola vez, antes del primer lote)

Es la pieza que falta y la que más rinde. Equivale al `/create-verification-skill` de pstack y encaja
con `CI.2` que ya está en PLAN.md (los 12 ui-gates que nada corre).

`bun run ui:gate -- --screen <nombre>` hace cinco cosas y termina con `PASS` o `FAIL: <razón>` en una línea:

1. **Levantar:** arranca el dashboard en un puerto libre, espera a que responda y guarda el PID.
2. **Comprobar salud:** `/` carga sin errores de consola.
3. **Recorrer:** Playwright abre la pantalla y ejecuta el flujo del ítem (clic, escribir, esperar la
   respuesta). Los flujos van en `scripts/ui-gates/<pantalla>.mjs`, versionados; hoy viven en `/tmp`.
4. **Guardar la evidencia:** captura de la app y de la plantilla (`~/Documents/screens/...` levantada
   aparte), diferencia de píxeles con umbral, y aserciones de comportamiento (el botón produce
   el efecto; el texto aparece).
5. **Limpiar:** mata por PID (nunca con `pkill -f`, ver NEXT.md § Avisos) y borra el tmp.

`bun run gate:all` = typecheck + lint + test:coverage + build:app + ui:fidelity:jsx + ui:gate de las pantallas
tocadas. Un comando y una línea de salida, como `gates/_run.ts` de Bend.

**Por qué ahorra cupo:** hoy Opus mira capturas (cada imagen suma ~1–1,6k tokens al contexto y se
reenvía en cada turno siguiente). Con el diff de píxeles, Opus solo lee `PASS`/`FAIL` y abre una
captura cuando falla.

Lo que el verificador **no** cubre: si algo *se siente* bien (taste). Eso sigue siendo de Carlos, en el
paso 5, una vez por lote.

### Paso 1 — el lote

Un lote = 3 a 5 ítems relacionados de la misma fase (ej.: UI.13.4c + Tasks + Runs + Graph). Se escribe
en `NEXT.md`, sin archivos nuevos:

```
## Lote L1 — UI.13 pantallas (abierto 2026-09-2x)
Ítems: UI.13.4c, Tasks, Runs, Graph
Condición de fin: los 4 con `gate:all` PASS, commit y [x] en PLAN.md
Decisiones tomadas: (respuestas de la ronda única)
Paradas: ver § Paso 3
Log:
| ítem | intentos Luna | gate | SHA | min |
```

### Paso 2 — ronda única de decisiones (Carlos, ~10 min, al abrir el lote)

Antes de arrancar, Opus lee los 3-5 ítems y la plantilla y hace **una sola** ronda de preguntas, cada una con su
recomendación. Es la palanca que la memoria ya había identificado ("decidir en lote los pendientes de Carlos")
y que no se estaba aplicando. Lo que no se pregunta ahí y aparece después es una parada (Paso 3), no un goteo.

### Paso 3 — el bucle por ítem (Opus, sin volver a Carlos)

```
por cada ítem del lote:
  1. Opus escribe spec corto (qué, dónde archivo:línea, cuál ui:gate lo prueba)
  2. Luna: codex exec -m gpt-5.6-luna … < /dev/null  (segundo plano)
     └─ mientras tanto Opus escribe el spec del ítem siguiente (no toca código → sin colisión)
  3. Opus lee SOLO: git diff --stat + salida de gate:all   (no el log entero de Luna)
  4. FAIL → Opus reescribe la instrucción puntual → Luna reintenta (máx. 2)
  5. PASS → commit, [x]+fecha+SHA en PLAN.md, fila en el log; push cada 2-3 commits
```

**Paradas (las únicas razones para volver a Carlos antes de cerrar el lote):**

1. `gate:all` en FAIL después de 2 reintentos.
2. Una decisión de producto que la ronda del Paso 2 no cubrió.
3. Una acción irreversible o fuera de lo autorizado (borrar datos, force push, tocar la identidad de git).
4. Tope de presupuesto alcanzado (Paso 6).

Al parar, Opus deja en NEXT.md: el ítem, qué falló, la evidencia y **la pregunta concreta con su
recomendación**, y deja de trabajar.

### Paso 4 — por qué esto no pierde el control que hoy tienes

- Sigue siendo serial: un ítem aterriza a la vez.
- Cada commit sigue pasando pre-commit y pre-push (los hooks no cambian).
- Lo que cambia es **cuándo** revisas: al final del lote, sobre el producto corriendo, no ítem por ítem sobre
  reportes. La memoria dice que revisar al final "se acumula"; es cierto con lotes grandes. Por eso el tope es 5.
- Si el primer lote sale peor, se vuelve al flujo actual sin haber tocado nada del producto.

### Paso 5 — tu revisión (Carlos, ~15 min por lote)

Recorres las pantallas del lote en el dashboard real. Lo que rechazas entra como **primer ítem del lote
siguiente**, con tu frase literal en el spec. Esa corrección es además el dato que la memoria menciona para el
futuro reviewer/improver.

### Paso 6 — control de consumo (la parte que te importa)

De dónde sale el gasto, de mayor a menor, y qué lo controla:

| Fuente de gasto | Hoy | Con lote | Control |
|---|---|---|---|
| Arranque del tab (57k tokens) | 1 por ítem | 1 por lote | — (baja solo) |
| Reorientarse (PLAN/NEXT/spec) | por ítem | 1 por lote | — |
| Contexto de Opus que crece dentro del tab | chico | crece con cada ítem | tope de 5 ítems; Opus no lee logs de Luna, solo el diff --stat y el gate |
| Capturas en el contexto de Opus | varias por ítem | solo cuando hay FAIL | diff de píxeles en el Paso 0 |
| Reintentos de Luna | sin tope escrito | máx. 2 por ítem | parada 1 |
| Luna (cupo Codex) | igual | igual | es otro proveedor: no toca el cupo de Claude |
| Revisión con varios modelos | — | no se usa por ítem | solo al cerrar la fase (regla Codex existente) |

Lectura honesta: **por ítem debería costar igual o menos** (se paga una vez lo que hoy se paga en cada
ítem). **Por hora cuesta más**, porque ya no hay tiempo muerto esperando: el mismo cupo se gasta en menos
horas de reloj. Si tu plan tiene ventana de 5 h, un lote puede acercarte al límite de la ventana antes que
hoy. No sé qué plan tienes exactamente (no lo verifiqué); la parada 4 existe para esto: un tope de ítems por
ventana que eliges tú.

Lo que **no** copiaría de quienes tienen Max o presupuesto corporativo: varios agentes en paralelo, varios
modelos compitiendo por la misma tarea (`/arena`), revisión de cada diff con varios modelos (`/interrogate`)
y corridas de noche sin tope. Todas multiplican el gasto; su velocidad sale de ahí, no de un método secreto.

## 4. Cómo se sabe si funcionó

El primer lote se mide con el log del Paso 1 contra el flujo actual:

- minutos por ítem (desde el spec hasta el commit);
- cuántas veces volvió a Carlos antes del cierre (objetivo: 0-1);
- ítems rechazados en tu revisión del Paso 5 (si sube frente a hoy, el verificador tiene huecos);
- porcentaje de la ventana de cupo usado por el lote.

Si en esas métricas no mejora, se descarta y se anota por qué.

## 5. Decisiones que necesito de Carlos

1. ¿Paso 0 primero (el verificador, ~1 ítem de trabajo, se solapa con CI.2) o arrancar el lote con el gate
   actual y construir el verificador después? **Recomiendo el Paso 0 primero**: sin él, el bucle vuelve a
   depender de que Opus mire capturas y no se cierra.
2. Tamaño del primer lote: **recomiendo 3** (UI.13.4c + 2 pantallas) para medir sin arriesgar la ventana.
3. Tope de presupuesto por lote: número de ítems por ventana de cupo, según tu plan.
