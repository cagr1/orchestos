### MES 20 — Que OrchestOS entregue de verdad: dogfooding contra un producto real

Origen: Carlos (2026-07-09) le pidió a OrchestOS un producto premium real (dashboard de cripto React+TS+Vite) — "no quiero avanzar si OrchestOS no puede hacer una página". El intento destapó bugs nunca antes probados. Descubrimiento central: un LLM no sabe cuántos tokens necesita antes de empezar — se corta en seco si se acaba el presupuesto a mitad. La ventaja de OrchestOS (DAG de sub-tareas con contratos, S22) ya existía a medias; faltaba el gatillo automático.

| Bloque | Contenido | Estado |
|---|---|---|
| P.1/P.2 | Pre-flight: loop de tools con texto vacío corregido; `maxTokens` adaptado al saldo real | ✅ SÍ |
| A.1/A.2 | Diseño del auto-split (estimador, gatillo, control humano, fallback), aprobado por Carlos | ✅ SÍ |
| B.1-B.3 | `shouldSplit()`, gatillo en harness/CLI, superficie de aprobación en dashboard | ✅ SÍ |
| C.1 | Primer entregable real end-to-end (`crypto-page-v1`), gate 🔍 con dinero real | ✅ SÍ |
| C.2 | Dashboard premium multi-archivo (React+TS+Vite, motor agéntico) | ⏳ **PAUSADO** — carry-over |
| H.1 | Cierre formal del mes (+ cierre pendiente de Mes 19) | ✅ SÍ (este registro, 2026-07-14) |

**Pre-flight (dogfooding, 2026-07-09)**
Dos bugs bloqueantes encontrados antes de abrir el mes formalmente: (P.1) `runToolLoop()` devolvía burbujas de chat vacías cuando un mensaje disparaba más de `maxTurns` rondas de tool calls — fix con ronda final sin tools + mensaje explícito. (P.2) `maxTokens` pedía el techo absoluto del modelo (128K) sin ver el saldo real disponible — OpenRouter pre-autoriza contra el peor caso, bloqueando cuentas con saldo bajo aunque el gasto real fuera centavos; fix con `parseAffordableTokens()` que reintenta con el presupuesto real que el 402 reporta.

**Bloque A/B — Auto-split**
Diseño resolvió 4 decisiones: estimador barato (`output.length × 2048 > maxTokens × 0.7`, sin dinero real), gatillo que reusa el generador function-calling existente de `planner.ts` (sin motor nuevo), control humano obligatorio (el usuario aprueba el plan de sub-tareas antes de gastar — mismo principio "nunca auto-run silencioso" del chat), fallback documentado. Implementado en `harness.ts`/`scheduler.ts` sin construir motor nuevo. Superficie en dashboard: `GET /api/tasks/:id/split-plan` + `POST /api/tasks/:id/approve-split` + badge "⚡ Split".

**Bloque C — Gate de verificación real**
C.1: tarea `crypto-page-v1` (HTML+CSS+JS autocontenido, datos live de CoinGecko) corrida real ($0.19, QA pass). Hallazgo real: ni los checks deterministas ni el QA-LLM detectaron un error de sintaxis JS (`:` en vez de `+` en una concatenación) que rompía el script entero — encontrado abriendo la página de verdad en el navegador, no por ningún check automático (gap documentado en IDEAS.md #36, sigue abierto). C.2 (dashboard premium multi-archivo) quedó **pausado**: 2 intentos fallidos por configuración de modelo llevaron a la regla [[feedback-modelo-decision-final-carlos]] (incidente de $5.00 quemados); reintentar C.2 está gated en (1) decisión explícita de modelo por Carlos y (2) el presupuesto de outputs de tools del executor agéntico (IDEAS.md #32, prerequisito). v0.12 se priorizó por delante de C.2.

**Decisiones de diseño Mes 20**
- Ningún LLM decide el modelo de una corrida real por su cuenta ni lo arrastra de memoria de otra sesión — siempre `orchestos.config.yaml` o instrucción explícita de Carlos en el momento (regla nacida de este mes, [[feedback-modelo-decision-final-carlos]]).
- Auto-split: el usuario ve y aprueba el plan de sub-tareas antes de gastar, nunca corre solo.

**Hallazgos documentados, no resueltos en este mes (backlog)**
- IDEAS.md #36 — `defaultChecksFor` no valida sintaxis de JS embebido en HTML/`.js` (el gap real que dejó pasar el bug de C.1).
- IDEAS.md #32 — presupuesto de outputs de tools en el executor agéntico, prerequisito para reabrir C.2.
- **C.2 sigue abierto** — dashboard premium multi-archivo, la pregunta original de Carlos ("¿puede OrchestOS entregar un producto premium?") sigue sin responder con dato real. Candidato a pre-flight del próximo milestone.

**Métrica Mes 20 — PARCIAL (2026-07-14, cierre formal diferido)**
Auto-split diseñado, implementado y con superficie en dashboard; el mecanismo end-to-end se probó con éxito en un entregable simple (C.1). El gate original y más exigente (C.2, dashboard premium) queda pausado por decisión explícita de alcance de Carlos, no por falla — gated en dos prerequisitos concretos (modelo + #32). 711 tests · 0 fail · `tsc --noEmit` limpio (estado actual del repo, no snapshot del mes).

---

