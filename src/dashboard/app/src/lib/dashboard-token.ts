const installed = new WeakSet<Window>()

export function readDashboardToken(): string {
  return window.document?.querySelector('meta[name="orchestos-token"]')?.getAttribute('content') ?? ''
}

export function installDashboardToken(): void {
  if (installed.has(window)) return
  installed.add(window)
  const params = new URLSearchParams(window.location.hash.slice(1))
  const token = params.get('t')
  if (token) {
    params.delete('t')
    const hash = params.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ''}`,
    )
  }
  window.localStorage.removeItem('orchestos.dashboardToken')
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
    if (response.ok) window.sessionStorage.removeItem('orchestos.tokenReload')
    if (response.status === 401) {
      const body = await response
        .clone()
        .json()
        .catch(() => null)
      if (body?.error === 'dashboard token required' && !window.sessionStorage.getItem('orchestos.tokenReload')) {
        window.sessionStorage.setItem('orchestos.tokenReload', '1')
        window.location.reload()
      }
    }
    return response
  }, window.fetch)
}

if (typeof window !== 'undefined') installDashboardToken()
