/** Pure URL policy shared by the dashboard and the MCP browser. */
export function localPreviewUrl(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value)
  const hostWithPort = /^[^\s/:?#]+:\d+(?:[/?#]|$)/.test(value)
  try {
    const url = new URL(hasScheme && !hostWithPort ? value : `http://${value}`)
    const host = url.hostname
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
      (host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '[::1]' ||
        host.endsWith('.localhost'))
      ? url.href
      : null
  } catch {
    return null
  }
}
