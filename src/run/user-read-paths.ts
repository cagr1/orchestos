import { realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path'

export function userReadDirsForTurn(
  turn: { message: string; history: { role: string; content: string }[] },
  projectRoot: string,
): string[] {
  // Only typed user text grants reads; attachments, inbound data and model metadata do not.
  return userReadDirs(
    [turn.message, ...turn.history.filter((row) => row.role === 'user').map((row) => row.content)],
    projectRoot,
  )
}

/** Existing paths explicitly named in the conversation grant directory reads only. */
export function userReadDirs(texts: string[], projectRoot: string): string[] {
  const home = realpathSync(homedir())
  let project = resolve(projectRoot)
  try {
    project = realpathSync(projectRoot)
  } catch {}
  const dirs = new Set<string>()
  for (const text of texts) {
    // Quoted paths may contain spaces. Bare paths stop at whitespace or quotes.
    const paths = /(?:^|[\s([{=:])(?:`([^`\n]+)`|"([^"\n]+)"|'([^'\n]+)'|((?:~\/|\/)[^\s`"'<>]*))/g
    for (const match of text.matchAll(paths)) {
      const value = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').replace(
        /[.,;:!?)\]}]+$/,
        '',
      )
      if (!value.startsWith('/') && value !== '~' && !value.startsWith('~/')) continue
      const expanded =
        value === '~' ? home : value.startsWith('~/') ? join(home, value.slice(2)) : value
      try {
        const path = realpathSync(expanded)
        const stat = statSync(path)
        if (!stat.isDirectory() && !stat.isFile()) continue
        const dir = stat.isFile() ? dirname(path) : path
        const rel = relative(project, dir)
        if (
          dir === parse(dir).root ||
          dir === home ||
          rel === '' ||
          (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))
        )
          continue
        dirs.add(dir)
        if (dirs.size === 10) return [...dirs]
      } catch {
        // Missing, unreadable, or broken symlink paths grant nothing.
      }
    }
  }
  return [...dirs]
}
