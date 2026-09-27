import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, isAbsolute, resolve } from 'path'

const COMMENT = '# OrchestOS runtime artifacts'
const ENTRIES = ['/runs/*.log', '/.orchestos/agent-home/']

/** Keep OrchestOS runtime files out of the user's project status without changing .gitignore. */
export function excludeRuntimeArtifacts(projectRoot: string): void {
  try {
    const proc = Bun.spawnSync(['git', 'rev-parse', '--git-path', 'info/exclude'], {
      cwd: projectRoot,
      env: { ...process.env },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (proc.exitCode !== 0) return

    const output = proc.stdout.toString().trim()
    if (!output) return
    const excludePath = isAbsolute(output) ? output : resolve(projectRoot, output)
    mkdirSync(dirname(excludePath), { recursive: true })

    const current = existsSync(excludePath) ? readFileSync(excludePath, 'utf8') : ''
    const lines = current.split(/\r?\n/)
    const additions = ENTRIES.filter((entry) => !lines.includes(entry))
    if (additions.length === 0) return

    const needsComment = !lines.includes(COMMENT)
    const prefix = current.length > 0 && !current.endsWith('\n') ? '\n' : ''
    const block = [...(needsComment ? [COMMENT] : []), ...additions].join('\n')
    writeFileSync(excludePath, `${current}${prefix}${block}\n`, 'utf8')
  } catch {
    // Projects without a usable Git metadata directory should still run normally.
  }
}
