import { spawnSync } from 'node:child_process'

export function findProperName(text: string): number[] {
  return text.split('\n').flatMap((line, index) => (/\bcarlos\b/i.test(line) ? [index + 1] : []))
}

if (import.meta.main) {
  const grep = spawnSync('git', ['grep', '-n', '-I', '-w', '-i', 'carlos', '--', 'src'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  if (grep.status !== 0 && grep.status !== 1)
    throw new Error(`git grep failed: ${grep.error ?? grep.status}`)
  const matches = (grep.stdout ?? '').trim().split('\n').filter(Boolean)
  if (matches.length) {
    for (const match of matches) console.error(match.replace(/:(\d+):.*/, ':$1'))
    console.error('✗ nombre propio en src/: escribir User')
    process.exit(1)
  }
}
