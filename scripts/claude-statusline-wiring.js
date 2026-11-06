import { resolve } from 'node:path'

/** Diagnose the configured command without executing it or changing settings. */
export function isClaudeStatuslineWired(settings, home, pathExists) {
  const command = settings?.statusLine?.command
  if (typeof command !== 'string') return false
  const tokens = command.match(/(?:"[^"\n]*"|'[^'\n]*'|[^\s"'|;&])+|[|;&]+/g) ?? []
  return tokens.some((token, index) => {
    const path = token.replace(/^(["'])(.*)\1$/, '$2')
    if (!path.endsWith('/claude-statusline-tee.sh')) return false
    const preceding = tokens.slice(0, index)
    const boundary = preceding.findLastIndex((part) => /^[|;&]+$/.test(part))
    const prefix = preceding
      .slice(boundary + 1)
      .filter((part) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(part))
    if (prefix.length !== 0 && !(prefix.length === 1 && /^(?:.*\/)?(?:sh|bash)$/.test(prefix[0])))
      return false
    const expanded = (token.match(/"[^"]*"|'[^']*'|[^"']+/g) ?? [])
      .map((part, partIndex) => {
        if (part.startsWith("'")) return part.slice(1, -1)
        const doubleQuoted = part.startsWith('"')
        const value = doubleQuoted ? part.slice(1, -1) : part
        return (
          !doubleQuoted && partIndex === 0 ? value.replace(/^~(?=\/|$)/, home) : value
        ).replace(/\$\{HOME\}|\$HOME\b/g, () => home)
      })
      .join('')
    return pathExists(resolve(expanded))
  })
}
