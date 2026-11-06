import { execFile } from 'node:child_process'
import type { Plugin } from '@opencode-ai/plugin'

const lastRunBySession = new Map<string, number>()

export const ContextBudgetPlugin: Plugin = async ({ client, directory }) => ({
  async event({ event }) {
    if (
      event.type !== 'session.idle' &&
      !(event.type === 'session.status' && event.properties.status.type === 'idle')
    )
      return
    try {
      const properties = event.properties as { sessionID?: unknown }
      if (typeof properties.sessionID !== 'string' || properties.sessionID.length === 0) return
      const sessionID = properties.sessionID
      const previousRun = lastRunBySession.get(sessionID)
      const now = Date.now()
      if (previousRun !== undefined && (previousRun < 0 || now - previousRun < 3_000)) return
      // El signo negativo indica que la ejecución de esta sesión sigue en curso.
      lastRunBySession.set(sessionID, -now)

      // Mantener disponible el ciclo de eventos de OpenCode mientras el hook llama a Bun y git.
      const message = await new Promise<string>((resolve) => {
        const child = execFile(
          'node',
          ['.claude/hooks/context-budget.js'],
          {
            cwd: directory,
            encoding: 'utf8',
            timeout: 5_000,
            windowsHide: true,
          },
          (error, stdout) => resolve(error ? '' : stdout.trim()),
        )
        child.stdin?.on('error', () => {})
        child.stdin?.end(
          JSON.stringify({
            transcript_path: `opencode-session:${properties.sessionID}`,
            session_id: properties.sessionID,
          }),
        )
      })
      if (!message) return
      await client.tui.showToast({ body: { message, variant: 'warning' } })
    } catch {
      // Fallar de forma abierta: el aviso de contexto no debe interferir con un turno de OpenCode.
    } finally {
      const properties = event.properties as { sessionID?: unknown }
      if (typeof properties.sessionID === 'string' && properties.sessionID.length > 0) {
        lastRunBySession.set(properties.sessionID, Date.now())
      }
    }
  },
})
