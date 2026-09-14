# AT.9 — Cualquier CLI en el chat, sin bloqueo por frontera de lectura

## Decisión cerrada

Carlos confirmó el 2026-09-14 la propuesta de `NEXT.md`: el usuario puede elegir cualquier CLI
instalado. La ausencia de una frontera técnica de lectura produce un aviso informativo, nunca un
400 ni un bloqueo. Si el CLI falla, se devuelve su error real. No cambies la capability declarada:
Codex y OpenCode siguen teniendo `readBoundary.kind = 'none'`; el producto debe decir la verdad.

## Alcance exacto

1. `src/run/executors/cli-registry.ts`
   - Reemplaza el helper con semántica de indisponibilidad por uno con semántica de aviso. El texto
     para Codex debe ser exactamente `Codex no limita la lectura a este proyecto`.
   - `provisionCliConfigHome()`: solo para `cliId === 'codex'`, si `~/.codex/auth.json` existe,
     crea dentro del home aislado `auth.json` como symlink a ese archivo. No copies el secreto. Si
     el origen no existe, continúa sin crear el link para que Codex emita su error real. La segunda
     provisión debe ser idempotente y no debe reemplazar un path ajeno inesperado.
   - No cambies otros `configHome`: Codex es el único registro que redirige una variable de home y
     el diagnóstico no reprodujo el problema en los demás CLIs.

2. `src/dashboard/handlers/chat.ts`
   - Renombra `projectChatReadBoundaryError()` a `projectChatReadBoundaryWarning()` y conserva la
     sonda inyectable. Devuelve `null` si hay frontera efectiva y el aviso del registro si no.
   - Calcula el aviso solo cuando `hasProjectContext` es verdadero. Elimina el retorno 400.
   - Incluye `readBoundaryWarning` en todas las respuestas exitosas del turno de chat CLI
     (`claude`, `codex`, `opencode`) cuando corresponda; no lo incluyas en sesiones generales ni
     en respuestas del agente API.

3. `src/dashboard/handlers/chat-sessions.ts`
   - Para una sesión de proyecto con un CLI cuya frontera declarada sea `none`, crea y persiste la
     sesión con 201. Devuelve el `ChatSessionRow` más `readBoundaryWarning`.
   - Para Claude no dupliques aquí una sonda al binario: la creación usa la capability declarada;
     el turno calcula la capability efectiva y avisa si el binario instalado no sostiene
     `--restricted`.

4. `src/dashboard/types.ts`
   - Extiende el contrato de creación/respuesta solo en lo necesario para el campo opcional
     `readBoundaryWarning?: string`. No lo persistas en SQLite.

5. `src/dashboard/public/app.js` y `src/dashboard/public/screens-core.js`
   - Añade estado transitorio en memoria, indexado por `sessionId`, para recordar si el aviso ya se
     mostró. No uses `localStorage` ni cambies el esquema de DB.
   - Tanto `ensureChatSession()`/`startNewChatSession()` como una respuesta exitosa de `/api/chat`
     deben pasar el campo por un único helper de UI. Ese helper llama `showToast(warning)` sin
     variante `error`, como máximo una vez por sesión. Marca el aviso como mostrado antes de llamar
     al toast para evitar duplicados por respuestas concurrentes.
   - Al borrar una sesión, limpia su entrada del estado transitorio.

6. `src/run/executors/codex.ts`
   - `buildCodexChatArgs()` debe incluir `--skip-git-repo-check` para que el chat general funcione
     en su cwd temporal. Conserva `--sandbox read-only` y `--ignore-user-config`.
   - No cambies OpenCode: su comando `opencode run` no exige repositorio Git y no redirige un home
     aislado; no existe el fallo hermano en el código inspeccionado.

7. Tests:
   - `src/dashboard/__tests__/chat-read-boundary.test.ts`: actualiza nombres y expectativas de
     bloqueo a aviso, incluida la capability efectiva de Claude.
   - `src/dashboard/__tests__/chat-sessions.test.ts`: cambia el caso Codex de 400/sin fila a
     201/fila persistida/aviso exacto; conserva el caso general sin aviso.
   - `src/__tests__/cli-registry.test.ts`: cubre symlink de auth, origen inexistente e idempotencia.
     Usa homes temporales inyectables o aislamiento del proceso; nunca leas ni alteres el auth real
     de Carlos en el test.
   - `src/__tests__/codex-engine.test.ts`: afirma `--skip-git-repo-check` y conserva las
     expectativas de sandbox/config aislada.
   - Añade o amplía un test de frontend existente si hay infraestructura directa para probar que
     el mismo aviso solo genera un toast por sesión. No introduzcas una dependencia nueva solo para
     este test; el gate Playwright cubre la integración visible.

8. Documentación de cierre, a cargo del cerebro: no edites `PLAN.md`, `NEXT.md`, `AGENTS.md`,
   `CLAUDE.md`, `CONTEXT.md`, `docs/done/**` ni borres este spec. El cerebro conservará el historial
   de AT.3/H.9.2 y ajustará H.9.4 después de verificar.

## Fuera de alcance

- Crear un sandbox de lectura propio de OrchestOS.
- Cambiar la frontera de escritura o los flags read-only existentes.
- Probar o cambiar tasks con Codex de punta a punta.
- Corregir AT.4, R.7, R.8, H.9.4 o cualquier hallazgo adyacente.
- Tocar `.claude/settings.json`, `orchestos.config.yaml` o los documentos sin versionar actuales.

## Gates del ejecutor

Ejecuta, como mínimo:

```sh
bunx tsc --noEmit
bun test src/dashboard/__tests__/chat-read-boundary.test.ts src/dashboard/__tests__/chat-sessions.test.ts src/__tests__/cli-registry.test.ts src/__tests__/codex-engine.test.ts
```

No commitees y no ejecutes el gate Playwright. Entrega el diff y la salida real de los comandos al
cerebro. Si un requisito exige una decisión no descrita aquí, para y repórtala; no amplíes scope.
