type TerminalOptions = {
  cwd: string
  cols: number
  rows: number
  command?: string[]
  onData: (data: Uint8Array) => void
  onExit: (code: number) => void
}

export type TerminalSession = {
  readonly pid: number
  write(data: string): void
  resize(cols: number, rows: number): void
  close(): Promise<void>
}

const sessions = new Set<TerminalSession>()

export function resolveOpenCodeCommand(
  which: (name: string) => string | null = Bun.which,
): string[] {
  const binary = which('opencode')
  if (!binary) throw new Error('OpenCode no está instalado (no se encontró "opencode" en el PATH)')
  return [binary]
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback
}

export function createTerminalSession(options: TerminalOptions): TerminalSession {
  const command = options.command ?? resolveOpenCodeCommand()
  const terminal = new Bun.Terminal({
    cols: clamp(options.cols, 2, 500, 80),
    rows: clamp(options.rows, 2, 200, 24),
    data: (_terminal, data) => options.onData(data),
  })
  let child: ReturnType<typeof Bun.spawn>
  let exited = false
  let terminalClosed = false
  let closing: Promise<void> | null = null
  child = Bun.spawn(command, {
    cwd: options.cwd,
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    terminal,
  })
  const session: TerminalSession = {
    pid: child.pid,
    write(data) {
      if (!exited) terminal.write(data)
    },
    resize(cols, rows) {
      if (!exited) terminal.resize(clamp(cols, 2, 500, 80), clamp(rows, 2, 200, 24))
    },
    close() {
      if (closing) return closing
      closing = (async () => {
        if (!exited) {
          child.kill('SIGTERM')
          await Promise.race([
            child.exited,
            Bun.sleep(2000).then(() => {
              if (!exited) child.kill('SIGKILL')
            }),
          ])
          if (!exited) await child.exited
        }
        if (!terminalClosed) {
          terminalClosed = true
          terminal.close()
        }
        sessions.delete(session)
      })()
      return closing
    },
  }
  sessions.add(session)
  void child.exited.then((code) => {
    exited = true
    if (!terminalClosed) {
      terminalClosed = true
      terminal.close()
    }
    sessions.delete(session)
    options.onExit(code)
  })
  return session
}

export async function stopTerminalSessions(): Promise<void> {
  await Promise.all([...sessions].map((session) => session.close()))
}
