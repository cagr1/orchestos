import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { Loader2, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppearanceSettings } from '../../lib/appearance-settings'
import { KEYBINDINGS, reachesAppFromTerminal } from '../../lib/keybindings'
import { readTerminalSettings, subscribeTerminalSettings } from '../../lib/terminal-settings'
import '@xterm/xterm/css/xterm.css'

type Props = {
  projectId: string
  /** `shell` abre la shell del usuario; por defecto OpenCode. */
  kind?: 'opencode' | 'shell'
}

export function OpenCodeTerminal({ projectId, kind = 'opencode' }: Props) {
  const { uiScale } = useAppearanceSettings()
  const isShell = kind === 'shell'
  const hostRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const resizeRef = useRef<(() => void) | null>(null)
  const uiScaleRef = useRef(uiScale)
  uiScaleRef.current = uiScale
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<'connecting' | 'connected' | 'error' | 'exited'>('connecting')
  const [message, setMessage] = useState('')
  const [hasOutput, setHasOutput] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const reopen = useCallback(() => {
    terminalRef.current?.clear()
    setMessage('')
    setHasOutput(false)
    stateRef.current = 'connecting'
    setState('connecting')
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const getTerminalTheme = () => {
      const styles = getComputedStyle(host)
      return {
        background: styles.getPropertyValue('--app-bg').trim() || '#111827',
        foreground: styles.getPropertyValue('--app-text').trim() || '#e5e7eb',
        cursor: styles.getPropertyValue('--app-accent').trim() || '#8b5cf6',
      }
    }
    const settings = readTerminalSettings()
    const terminal = new Terminal({
      ...settings,
      fontSize: Math.round(settings.fontSize * uiScaleRef.current),
      convertEol: false,
      theme: getTerminalTheme(),
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    // Keep control keys in xterm, except the new-terminal shortcut.
    terminal.attachCustomKeyEventHandler(
      (event) =>
        !KEYBINDINGS.some(
          (binding) => binding.match(event) && reachesAppFromTerminal(binding, event),
        ),
    )
    terminal.open(host)
    const viewport = host.querySelector<HTMLElement>('.xterm-viewport')
    if (viewport) viewport.style.backgroundColor = getTerminalTheme().background
    terminalRef.current = terminal
    if (isShell) terminal.focus()
    const connect = () => {
      if (host.clientWidth > 0 && host.clientHeight > 0) fit.fit()
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const socket = new WebSocket(
        `${protocol}//${location.host}/api/terminal?project=${encodeURIComponent(projectId)}${isShell ? '&kind=shell' : ''}&cols=${terminal.cols}&rows=${terminal.rows}`,
      )
      socket.binaryType = 'arraybuffer'
      socketRef.current = socket
      socket.onopen = () => setState('connected')
      socket.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          setHasOutput(true)
          terminal.write(new Uint8Array(event.data))
        } else {
          try {
            const payload = JSON.parse(String(event.data))
            if (payload.type === 'error') {
              setMessage(payload.message)
              setState('error')
            }
            if (payload.type === 'exit') {
              if (payload.binaryChanged === true) reopen()
              else {
                stateRef.current = 'exited'
                setState('exited')
              }
            }
          } catch {
            /* Ignore malformed control messages. */
          }
        }
      }
      socket.onerror = () => {
        setMessage(
          isShell ? 'Could not connect to the terminal.' : 'No se pudo conectar con OpenCode.',
        )
        setState('error')
      }
      socket.onclose = () => {
        if (socketRef.current !== socket) return
        setState((current) => (current === 'connected' ? 'exited' : current))
      }
    }
    connect()
    const input = terminal.onData((data) => {
      if (stateRef.current === 'exited' && data === '\r') {
        reopen()
        return
      }
      if (socketRef.current?.readyState === WebSocket.OPEN)
        socketRef.current.send(JSON.stringify({ type: 'input', data }))
    })
    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return
      fit.fit()
      if (socketRef.current?.readyState === WebSocket.OPEN)
        socketRef.current.send(
          JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }),
        )
    }
    resizeRef.current = resize
    const unsubscribeSettings = subscribeTerminalSettings(() => {
      const settings = readTerminalSettings()
      Object.assign(terminal.options, settings, {
        fontSize: Math.round(settings.fontSize * uiScaleRef.current),
      })
      resize()
    })
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    const themeHost = host.closest('[data-theme]')
    const themeObserver = new MutationObserver(() => {
      const theme = getTerminalTheme()
      terminal.options.theme = theme
      const viewport = host.querySelector<HTMLElement>('.xterm-viewport')
      if (viewport) viewport.style.backgroundColor = theme.background
    })
    if (themeHost)
      themeObserver.observe(themeHost, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      unsubscribeSettings()
      observer.disconnect()
      themeObserver.disconnect()
      input.dispose()
      socketRef.current?.close()
      socketRef.current = null
      terminal.dispose()
      terminalRef.current = null
      resizeRef.current = null
    }
  }, [projectId, attempt, isShell, reopen])

  useEffect(() => {
    if (!terminalRef.current) return
    terminalRef.current.options.fontSize = Math.round(readTerminalSettings().fontSize * uiScale)
    resizeRef.current?.()
  }, [uiScale])

  return (
    <section
      className="flex-1 min-w-0 h-full flex flex-col overflow-hidden"
      aria-label={isShell ? 'Project terminal' : 'OpenCode terminal'}
    >
      <div className="relative flex-1 min-h-0 p-2">
        {/* xterm mouse coordinates use unscaled CSS cells; cancel the ancestor zoom here. */}
        <div
          ref={hostRef}
          className="min-h-0"
          style={{ zoom: 1 / uiScale, width: `${uiScale * 100}%`, height: `${uiScale * 100}%` }}
        />
        {!hasOutput && state !== 'error' && state !== 'exited' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-[var(--app-text-muted)]">
            <Loader2
              size={16}
              className="animate-spin"
              role="status"
              aria-label={isShell ? 'Iniciando terminal' : 'Iniciando OpenCode'}
            />
          </div>
        )}
        {(state === 'error' || state === 'exited') && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 text-sm text-[var(--app-text-muted)]">
            {state === 'error' && <span role="alert">{message}</span>}
            <button
              type="button"
              onClick={reopen}
              className="text-[var(--app-accent)]"
              aria-label="Reabrir"
              title="Reabrir"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
