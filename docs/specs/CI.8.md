# CI.8 — codex-live compara markdown crudo contra texto renderizado

Pre-push 2026-10-01 bloqueado: `codex-live` falla en 3 pasos ('both exchanges remain visible in order after turn 2',
'timeline DOM alternates user 1, assistant 1, user 2, assistant 2' y su variante 'after reload') aunque el DOM
muestra el orden correcto: `["…Remember the word MANGO-E41TOSAJ…","I’ll remember MANGO-E41TOSAJ in this conversation.",
"…What word did I ask you to remember?…","MANGO-E41TOSAJ. Mangoes are tropical fruits…"]`. Reproduce corriéndolo solo.

Causa probable: `firstAnswer` / `secondCompletion.content` salen de la API (markdown crudo: backticks, `**`, saltos
de línea) y se buscan con `includes` dentro del `innerText` renderizado por react-markdown, donde ese marcado ya no está.

Arreglo en `scripts/ui-gate/flows/codex-live.mjs`, solo ahí:
1. Helper `plain(text)`: quita marcado markdown inline (`` ` ``, `**`, `__`, `*`, `_` de énfasis, `#` de encabezado,
   `[x](url)`→`x`), normaliza comillas tipográficas a rectas y colapsa espacios en blanco a uno; trim.
2. Todas las comparaciones de texto de respuesta del asistente contra el DOM (`proseTexts`, `orderIndex`,
   `completedOrder`, las equivalentes tras reload y el paso 'user bubbles contain no agent markup') usan `plain()` en
   ambos lados. Para `orderIndex` basta comparar con un prefijo de 40 caracteres de `plain(answer)`.
3. El `detalle` de esos pasos incluye `plain(firstAnswer).slice(0,80)` para que el próximo fallo sea diagnosticable.
No relajes la intención de los pasos (orden user1<asst1<user2<asst2 y 2 respuestas visibles).
Pasa `bunx biome check scripts/ui-gate/flows/codex-live.mjs` y
`bunx biome lint --only=correctness/noUndeclaredVariables scripts/ui-gate/flows`. No commitees.
