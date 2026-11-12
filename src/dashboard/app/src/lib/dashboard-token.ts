const STORAGE_KEY = 'orchestos.dashboardToken'
export const TOKEN_REQUIRED_EVENT = 'orchestos:dashboard-token-required'
const installed = new WeakSet<Window>()

export function readDashboardToken(): string {
  return window.localStorage.getItem(STORAGE_KEY) ?? ''
}

export function installDashboardToken(): void {
  if (installed.has(window)) return
  installed.add(window)
  const params = new URLSearchParams(window.location.hash.slice(1))
  const token = params.get('t')
  if (token) {
    window.localStorage.setItem(STORAGE_KEY, token)
    params.delete('t')
    const hash = params.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ''}`,
    )
  }
  // Pegar la URL con token en una pestaña abierta solo cambia el hash: recargar para tomarlo al arrancar.
  window.addEventListener('hashchange', () => {
    if (new URLSearchParams(window.location.hash.slice(1)).get('t')) window.location.reload()
  })
  const originalFetch = window.fetch.bind(window)
  window.fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/'))
      return originalFetch(input, init)
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    )
    headers.set('x-orchestos-token', readDashboardToken())
    const response = await originalFetch(input, { ...init, headers })
    if (response.status === 401) {
      const body = await response
        .clone()
        .json()
        .catch(() => null)
      if (body?.error === 'dashboard token required')
        window.dispatchEvent(new Event(TOKEN_REQUIRED_EVENT))
    }
    return response
  }, window.fetch)
}

if (typeof window !== 'undefined') installDashboardToken()
