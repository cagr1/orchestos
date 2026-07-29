# OrchestOS — Threat model y límites de confianza

Bloque L.0 (Mes 23, PLAN.md), 2026-07-29. Verificado leyendo el código real, no asumido.

**Alcance declarado**: OrchestOS tal como se usa hoy — herramienta local de desarrollo, un solo
usuario, dashboard en `127.0.0.1`, sin autenticación multiusuario. Si el dashboard se expone fuera
de loopback o se vuelve multiusuario, este documento deja de cubrir el modelo de amenaza real y debe
reabrirse una revisión específica (ya anotado como límite explícito en L, PLAN.md).

---

## 1. Activos y daño si se comprometen

| Activo | Dónde vive | Daño si se filtra/corrompe |
|---|---|---|
| API keys (OpenRouter/Anthropic/OpenAI/Ollama host) | `~/.orchestos/.env`, texto plano ([settings-store.ts](../src/dashboard/settings-store.ts)) | Gasto no autorizado en la cuenta del proveedor, suplantación de llamadas |
| Código fuente del proyecto del usuario | filesystem, escrito por `enforceContract()` ([contract.ts](../src/run/contract.ts)) | Corrupción/pérdida de trabajo si el contrato falla; exfiltración si un canal externo lo reenvía |
| Archivos fuera del proyecto | filesystem general | Solo alcanzable si `enforceContract`/sandbox tienen un bug — es el activo que el contrato existe para proteger |
| DB SQLite (`~/.orchestos/*.sqlite`, [sqlite.ts](../src/db/sqlite.ts)) | tablas `runs`, `memory_entries`, `instincts`, `files`, `code_edges`, `context_chunks`, `projects`, `run_steps`, `chat_task_bar_events`, `memory_conflicts` | Historial completo de tareas, prompts, resultados, costos y memoria — lectura expone todo el uso del sistema |
| Prompts/contexto enviado a proveedores LLM | en memoria + persistido en `runs`/`run_steps` | Puede contener código propietario, credenciales pegadas por error, contenido de archivos completos |
| Costos/telemetría de uso | `runs`, tab Usage | Bajo impacto directo, pero permite inferir actividad/volumen de trabajo |
| Capacidad de ejecutar comandos (`Bun.spawn`) | `checks.ts`, `sandbox.ts`, `executors/{codex,external,opencode}.ts`, `cli.ts` | El daño más alto: ejecución arbitraria si un input hostil llega a construir el comando |
| Git worktrees / rama activa | `sandbox-policy.ts`, `git-lock.ts` | Pérdida de trabajo no commiteado, merge-back corrupto, branch equivocada |

---

## 2. Actores y entradas no confiables

| Actor/entrada | Confiable hoy | Por qué |
|---|---|---|
| Usuario local (Carlos) | Sí | Único operador, dueño de la máquina |
| Proceso local comprometido (malware, otra app) | **No** — pero fuera de alcance | Cualquier proceso con el mismo UID puede leer `~/.orchestos/.env` en texto plano; es un riesgo del modelo "un solo usuario, una sola máquina", no algo que OrchestOS pueda mitigar por software sin cifrado en reposo (decisión pendiente, ver L.1) |
| Tarea/skill importada (`tasks.yaml`, `/api/skills/import`) | **No** | Puede declarar `output`/`checks` arbitrarios; `enforceContract` es la única barrera real |
| Contenido web (`fetch` en el chat, `executeFetchUrl`) | **No** | Mitigado por `ssrf.ts` (bloquea loopback/privado/`.local`, resuelve DNS antes de confiar) — dato, no instrucción, solo por convención de prompt hoy (ver gap §5) |
| Imagen/OCR (`tesseract.js`, [ocr.ts](../src/chat/ocr.ts)) | **No** | Texto extraído de una imagen entra al chat como contenido de usuario; ya hay un caso probado en Mes 19 donde un intento de prompt injection en una imagen fue ignorado por el modelo, pero eso depende del modelo, no de un guard estructural |
| Salida de un LLM (executor, QA, curador de skills, chat) | **No** | Es la entrada más frecuente y menos confiable: `parseLLMResponse`/`enforceContract` existen exactamente porque un LLM puede intentar escribir fuera de `output[]` |
| CLI externo (Codex, opencode, Claude Code headless) | Parcialmente | Corren como subprocess con `cwd` fijado al worktree/root; su salida (diff, JSON) se trata como no confiable y pasa por el mismo contrato que el executor interno |
| Petición HTTP al dashboard | Solo si es same-origin | `isSameOrigin()` bloquea POST/PUT/DELETE cross-origin; no hay autenticación — cualquier proceso en la misma máquina que pueda alcanzar `127.0.0.1:4242` puede mutar sin credencial |

---

## 3. Límites de confianza (verificados en código)

### 3.1 Dashboard HTTP ↔ resto del sistema
- Bind explícito a `127.0.0.1` ([server.ts:287](../src/dashboard/server.ts)) — no escucha en todas las interfaces por default.
- `isSameOrigin()` ([http.ts](../src/dashboard/http.ts)) exige header `Origin` igual al del server para todo POST/PUT/DELETE; sin eso, 403. **No hay autenticación por sesión/token** — el control es solo de origen, no de identidad. Cualquier proceso local (o pestaña de otro sitio si el navegador no bloqueara CORS antes) que alcance el puerto sin origin hostil pasa.
- Estático servido con `realpathSync` + verificación de que el path resuelto sigue bajo `STATIC_BASE_REAL` ([http.ts](../src/dashboard/http.ts)) — bloquea traversal vía symlink o `..`.
- **Autorización/logging**: no hay logging de qué endpoint mutó qué desde qué origen; para una herramienta de un solo usuario el gap es aceptado por ahora, documentado como tal (no silenciado).

### 3.2 CLI ↔ filesystem
- `enforceContract()` es el único punto de escritura real desde una respuesta LLM: compara cada `file.path` contra `allowedPaths` (normalizados) y **lanza** si algo cae fuera — no bloquea en silencio, para el run entero.
- No hay canonicalización explícita contra `../`/symlinks dentro de `enforceContract` más allá de `normalizeRelPath()` — el aislamiento real de "no puede tocar nada fuera del proyecto" depende de que el proceso corra dentro del worktree (sandbox), no de un chequeo de paths absoluto. Riesgo anotado para L.3 (matriz de path traversal), no resuelto aquí.

### 3.3 Filesystem ↔ SQLite
- DB vive en `~/.orchestos/*.sqlite` ([sqlite.ts](../src/db/sqlite.ts)), fuera del repo del proyecto — un `git clone` del proyecto no expone el historial de otro usuario, pero tampoco hay separación por proyecto verificada aquí (queda para L.5).

### 3.4 Subprocesses (`Bun.spawn`)
Todos los puntos de spawn usan **arrays de argumentos**, nunca interpolación de shell — se listaron los 8 sitios reales: `checks.ts:135`, `sandbox.ts:16` (git), `executors/external.ts:163`, `executors/opencode.ts:150`, `executors/worktree-diff.ts:44` (git), `executors/codex.ts:91`, `providers/codex.ts:13`, `dashboard/handlers/{project,tasks,specs}.ts`. Eso cierra la clase de bug más común (command injection vía concatenación de strings). Pendiente de auditar en L.3: timeouts consistentes, límites de stdout/stderr uniformes y entorno heredado vs. mínimo — hoy varía por sitio y no está unificado.

### 3.5 Proveedores externos (LLM APIs, fetch)
- `checkSsrSafe()` ([ssrf.ts](../src/dashboard/ssrf.ts)) bloquea localhost, IPv6 link-local, rangos privados IPv4, dominios `.local`/`.localhost`, y resuelve DNS antes de fiarse del hostname (mismo resolver que `fetch()`, ya corregido un falso positivo real con `dns.resolve4()` en Mes 13). No verificado todavía: redirecciones (una URL pública que redirige a una privada), DNS rebinding entre el check y el fetch real, IPv6 público. Anotado para L.4.

### 3.6 Worktrees
- `resolveSandboxMode()` ([sandbox-policy.ts](../src/run/sandbox-policy.ts)) exige working tree limpio antes de usar worktree, cae a `cwd` (sin aislamiento) si no hay git o está en detached HEAD — con warning explícito, no en silencio. `git-lock.ts` serializa auto-commits vs. merge-back entre procesos concurrentes (mutex de archivo).

---

## 4. Controles ya existentes (confirmados, no asumidos)

- SSRF: `src/dashboard/ssrf.ts` + `ssrf.test.ts`.
- Sandbox/worktree: `sandbox-policy.ts` + `sandbox-policy.test.ts` (K.6.3.2, mutation score 84.93%).
- Contrato de escritura de archivos: `contract.ts` — bloquea archivos fuera de `output[]` declarado.
- `Bun.spawn` con arrays de argumentos en todos los 8 sitios verificados — no hay interpolación de shell.
- Same-origin check para mutaciones HTTP (`isSameOrigin`).
- Traversal check en estáticos servidos (`realpathSync` + prefix check).
- Same-origin check + bind a loopback ya limitan la superficie de red antes de necesitar auth real.
- QA de dos capas (Bloque K): checks mecánicos + LLM judge con evidencia forzada + juez adversarial opt-in — no es un control de seguridad per se, pero reduce la probabilidad de que código con vulnerabilidades introducidas por un LLM pase sin que nada lo note.

## 5. Gaps reales (no cerrados por este documento — quedan para L.1-L.6)

1. **Sin autenticación** en el dashboard más allá de same-origin — aceptable para "un usuario, una máquina", roto si se expone a LAN/internet (L.2).
2. **API keys en texto plano** en `~/.orchestos/.env`, sin cifrado en reposo — decisión de keychain del sistema pendiente, no improvisar cifrado propio (L.1).
3. **Contenido externo tratado como dato "por convención de prompt"**, no por un guard estructural que impida que texto de una URL/imagen/skill cambie tools, paths o criterios de aceptación — probado una vez que un modelo lo ignoró, no que el sistema lo garantice (L.4).
4. **Sin matriz de path traversal explícita** contra `enforceContract`/sandbox/tools (symlinks, rutas absolutas, encoding) — depende hoy de la disciplina de cada call site, no de un test central (L.3).
5. **Sin auditoría de dependencias** (`bun audit` o equivalente) ni en CI ni local — fuera del alcance original de L, candidato aparte (ver conversación 2026-07-28 sobre supply-chain, todavía sin bloque propio en PLAN.md).
6. **Sin backup/retención documentada de la SQLite** ni clasificación de qué se puede exportar (L.5).

## 6. Explícitamente fuera de alcance de esta baseline

- Exposición fuera de `127.0.0.1` (LAN/internet) — requiere autenticación real, CSRF, rate limiting; no se diseña especulativamente aquí.
- Multiusuario / autorización por proyecto entre distintas identidades.
- Cifrado en reposo de la DB completa (solo las API keys se identifican como candidato explícito en L.1).
- Certificación/compliance formal (SOC2, etc.) — no es el objetivo de una herramienta local de desarrollo.
