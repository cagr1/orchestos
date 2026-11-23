/** USO.38 — Ctrl+C: limpia y sale con espera acotada; una segunda señal sale al instante. */
export const SHUTDOWN_GRACE_MS = 3_000
const EXIT_CODES = { SIGINT: 130, SIGTERM: 143 } as const
type ShutdownSignal = keyof typeof EXIT_CODES

export function installShutdownSignals(
  cleanup: () => unknown,
  options: {
    exit?: (code: number) => void
    graceMs?: number
    target?: Pick<NodeJS.Process, 'on' | 'off'>
  } = {},
): () => void {
  const exit = options.exit ?? ((code: number) => process.exit(code))
  const target = options.target ?? process
  let shuttingDown = false
  const handlers = (Object.keys(EXIT_CODES) as ShutdownSignal[]).map((signal) => {
    const handler = () => {
      const code = EXIT_CODES[signal]
      if (shuttingDown) return exit(code)
      shuttingDown = true
      const force = setTimeout(() => exit(code), options.graceMs ?? SHUTDOWN_GRACE_MS)
      void Promise.resolve()
        .then(cleanup)
        .catch((error) => console.error('[dashboard] Shutdown cleanup failed', error))
        .finally(() => {
          clearTimeout(force)
          exit(code)
        })
    }
    target.on(signal, handler)
    return [signal, handler] as const
  })
  return () => {
    for (const [signal, handler] of handlers) target.off(signal, handler)
  }
}
