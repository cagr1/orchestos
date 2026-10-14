// CI.25 — rastro por spawn de CLI (chat/tareas) en el log del dashboard (stderr del proceso).
// Un turno que no responde debe dejar: quién, con qué entorno, cuánto tardó el primer byte,
// cómo terminó y qué dijo stderr. Sin el prompt: los args largos se reemplazan por su tamaño.

const ENV_KEYS = ['HOME', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'ORCHESTOS_HOME'] as const
const STDERR_TAIL_LINES = 8

export function redactSpawnArgs(args: string[]): string[] {
  return args.map((arg) => (arg.length > 160 ? `<${arg.length} chars>` : arg))
}

export function tailLines(text: string, lines = STDERR_TAIL_LINES): string {
  return text.split('\n').filter(Boolean).slice(-lines).join(' | ')
}

export interface SpawnTrace {
  firstByte(): void
  end(exitCode: number | null, stderr: string, timedOut: boolean): void
}

export function startSpawnTrace(
  agent: string,
  pid: number,
  args: string[],
  cwd: string,
  env: Record<string, string | undefined>,
  log: (line: string) => void = (line) => console.error(line),
): SpawnTrace {
  const startedAt = Date.now()
  let firstByteMs: number | null = null
  const envSummary = Object.fromEntries(ENV_KEYS.map((key) => [key, env[key] ?? null]))
  const path = (env.PATH ?? '').split(':').slice(0, 4).join(':')
  log(
    `[cli-spawn] ${JSON.stringify({
      event: 'start',
      agent,
      pid,
      cwd,
      args: redactSpawnArgs(args),
      env: { ...envSummary, PATH: path },
    })}`,
  )
  return {
    firstByte() {
      if (firstByteMs === null) firstByteMs = Date.now() - startedAt
    },
    end(exitCode, stderr, timedOut) {
      log(
        `[cli-spawn] ${JSON.stringify({
          event: 'end',
          agent,
          pid,
          firstByteMs,
          totalMs: Date.now() - startedAt,
          exitCode,
          timedOut,
          stderrTail: tailLines(stderr),
        })}`,
      )
    },
  }
}
