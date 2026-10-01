import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useCallback, useEffect, useRef, useState } from 'react'
import '@xterm/xterm/css/xterm.css'

type Props = { projectId: string; sessionTitle: string; onClose?: () => void }

export function OpenCodeTerminal({ projectId, sessionTitle, onClose }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<'connecting' | 'connected' | 'error' | 'exited'>('connecting')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const styles = getComputedStyle(document.documentElement)
    const terminal = new Terminal({
      fontFamily: '"Fira Code", monospace',
      fontSize: 13,
      cursorBlink: true,
      convertEol: false,
      theme: {
        background: styles.getPropertyValue('--app-bg').trim() || '#111827',
        foreground: styles.getPropertyValue('--app-text').trim() || '#e5e7eb',
        cursor: styles.getPropertyValue('--app-accent').trim() || '#8b5cf6',
      },
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(host)
    terminalRef.current = terminal
    const connect = () => {
      fit.fit()
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const socket = new WebSocket(
        `${protocol}//${location.host}/api/terminal?project=${encodeURIComponent(projectId)}&cols=${terminal.cols}&rows=${terminal.rows}`,
      )
      socket.binaryType = 'arraybuffer'
      socketRef.current = socket
      socket.onopen = () => setState('connected')
      socket.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) terminal.write(new Uint8Array(event.data))
        else {
          try {
            const payload = JSON.parse(String(event.data))
            if (payload.type === 'error') {
              setMessage(payload.message)
              setState('error')
            }
            if (payload.type === 'exit') setState('exited')
          } catch {
            /* Ignore malformed control messages. */
          }
        }
      }
      socket.onerror = () => {
        setMessage('No se pudo conectar con OpenCode.')
        setState('error')
      }
      socket.onclose = () => setState((current) => (current === 'connected' ? 'exited' : current))
    }
    connect()
    const input = terminal.onData((data) => {
      if (socketRef.current?.readyState === WebSocket.OPEN)
        socketRef.current.send(JSON.stringify({ type: 'input', data }))
    })
    const observer = new ResizeObserver(() => {
      fit.fit()
      if (socketRef.current?.readyState === WebSocket.OPEN)
        socketRef.current.send(
          JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }),
        )
    })
    observer.observe(host)
    return () => {
      observer.disconnect()
      input.dispose()
      socketRef.current?.close()
      socketRef.current = null
      terminal.dispose()
      terminalRef.current = null
    }
  }, [projectId, attempt])

  const reopen = useCallback(() => {
    terminalRef.current?.clear()
    setMessage('')
    setState('connecting')
    setAttempt((value) => value + 1)
  }, [])

  return (
    <section
      className="flex-1 min-w-0 h-full flex flex-col overflow-hidden"
      aria-label="OpenCode terminal"
    >
      <header className="h-9 shrink-0 flex items-center justify-between border-b border-[var(--app-border)] px-3 text-xs text-[var(--app-text-muted)]">
        <span className="truncate">{sessionTitle}</span>
        <div className="flex items-center gap-2">
          {state === 'connecting' && <span>Conectando…</span>}
          {state === 'error' && (
            <span role="alert" className="text-red-400">
              {message}
            </span>
          )}
          {state === 'exited' && (
            <>
              <span>Proceso terminado</span>
              <button type="button" onClick={reopen} className="text-[var(--app-accent)]">
                Reabrir
              </button>
            </>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Cerrar terminal">
              ×
            </button>
          )}
        </div>
      </header>
      <div ref={hostRef} className="flex-1 min-h-0 p-2" />
    </section>
  )
}
