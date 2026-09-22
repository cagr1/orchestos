/**
 * UI.12.2a (2026-09-21): el CSS vanilla solo puede bajar; la UI nueva vive en islas React.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runCommand, type RunCommand } from './agent-governance.ts'

export interface CssBaseline {
  total: number
  autorizacion: string
}

export interface CssRatchetResult {
  errors: string[]
  lowered: CssBaseline | null
}

export function countLines(source: string): number {
  if (source.length === 0) return 0
  const lines = source.split('\n')
  if (source.endsWith('\n')) lines.pop()
  return lines.length
}

export function checkCssRatchet(
  total: number,
  staged: CssBaseline,
  head: CssBaseline | null,
): CssRatchetResult {
  const errors: string[] = []
  const hasNewAuthorization =
    head !== null &&
    staged.autorizacion !== head.autorizacion &&
    staged.autorizacion.startsWith('CSS+ autorizado por Carlos:')

  if (head !== null && staged.total > head.total && !hasNewAuthorization) {
    errors.push(
      `✗ El tope CSS no puede subir: HEAD=${head.total}, staged=${staged.total}. Usa una autorización nueva de Carlos para excederlo.`,
    )
  }

  if (total > staged.total) {
    errors.push(
      `✗ El CSS vanilla supera el tope: total=${total}, staged=${staged.total}. La UI nueva va en la isla React con los className del prototipo.`,
    )
  }

  return {
    errors,
    lowered: errors.length === 0 && total < staged.total ? { ...staged, total } : null,
  }
}

function stagedFile(root: string, path: string, run: RunCommand): string | null {
  const result = run(['git', 'show', `:${path}`], root)
  if (result.exitCode !== 0) return null
  return result.stdout
}

function headFile(root: string, path: string, run: RunCommand): string | null {
  const result = run(['git', 'show', `HEAD:${path}`], root)
  if (result.exitCode !== 0) return null
  return result.stdout
}

export function main(root = process.cwd(), run: RunCommand = runCommand): number {
  const cssPaths = ['src/dashboard/public/styles.css', 'src/dashboard/public/screens.css']
  const cssSources = cssPaths.map((path) => stagedFile(root, path, run))
  const baselineSource = stagedFile(root, 'scripts/css-baseline.json', run)
  if (cssSources.some((source) => source === null) || baselineSource === null) {
    console.error('✗ No se pudo leer el CSS o baseline staged con git show :ruta.')
    return 1
  }

  let staged: CssBaseline
  let head: CssBaseline | null = null
  try {
    staged = JSON.parse(baselineSource) as CssBaseline
    const headSource = headFile(root, 'scripts/css-baseline.json', run)
    head = headSource === null ? null : (JSON.parse(headSource) as CssBaseline)
  } catch (error) {
    console.error(`✗ JSON de baseline inválido: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }

  const total = cssSources.reduce((sum, source) => sum + countLines(source ?? ''), 0)
  const result = checkCssRatchet(total, staged, head)
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(error)
    return 1
  }

  if (result.lowered !== null) {
    const baselinePath = resolve(root, 'scripts/css-baseline.json')
    writeFileSync(baselinePath, `${JSON.stringify(result.lowered, null, 2)}\n`)
    const added = run(['git', 'add', 'scripts/css-baseline.json'], root)
    if (added.exitCode !== 0) {
      console.error(added.stderr.trim() || '✗ No se pudo stagear el baseline CSS actualizado.')
      return 1
    }
    console.log(`✓ Tope CSS bajado a ${result.lowered.total}.`)
  } else {
    console.log(`✓ Trinquete CSS: ${total}/${staged.total}.`)
  }
  return 0
}

if (import.meta.main) process.exit(main())
