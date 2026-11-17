export function normalizePreviewUrl(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value)
  const hostWithPort = /^[^\s/:?#]+:\d+(?:[/?#]|$)/.test(value)
  try {
    const url = new URL(hasScheme && !hostWithPort ? value : `http://${value}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function previewUrlKey(projectId: string): string {
  return `orchestos-preview-url:${projectId}`
}
