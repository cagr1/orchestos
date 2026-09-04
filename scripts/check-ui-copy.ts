import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { requiresUiCopyBudget, runCommand } from './agent-governance.ts'

export interface UiCopyBudgetEntry {
  key: string
  context: string
  maxChars: number
}

export interface UiCopyCheckDependencies {
  readFile: (path: string) => string
}

function findLocaleObject(source: string, locale: string): string {
  const match = new RegExp(`\\b${locale}\\s*:\\s*\\{`).exec(source)
  if (!match || match.index === undefined) throw new Error(`no se encontró el locale ${locale} en i18n.js`)
  const start = match.index + match[0].length - 1
  let depth = 0
  let quote = ''
  let escaped = false
  for (let index = start; index < source.length; index++) {
    const char = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      continue
    }
    if (char === '{') depth++
    if (char === '}' && --depth === 0) return source.slice(start, index + 1)
  }
  throw new Error(`el locale ${locale} no tiene un objeto cerrado`)
}

function parseLocale(source: string, locale: string): Map<string, string> {
  const object = findLocaleObject(source, locale)
  const values = new Map<string, string>()
  const fields = /'([^']+)'\s*:\s*'((?:\\.|[^'])*)'/g
  for (const match of object.matchAll(fields)) {
    const key = match[1]
    const rawValue = match[2]
    if (key === undefined || rawValue === undefined) continue
    values.set(key, rawValue.replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n'))
  }
  return values
}

export function checkUiCopyBudget(
  deps: UiCopyCheckDependencies,
  i18nPath: string,
  manifestPath: string,
): string[] {
  const entries = JSON.parse(deps.readFile(manifestPath)) as UiCopyBudgetEntry[]
  const source = deps.readFile(i18nPath)
  const errors: string[] = []
  for (const locale of ['en', 'es']) {
    const values = parseLocale(source, locale)
    for (const entry of entries) {
      const value = values.get(entry.key)
      if (value === undefined) {
        errors.push(`✗ ${locale}.${entry.key}: clave ausente en i18n.js`)
        continue
      }
      if (value.length > entry.maxChars) {
        errors.push(
          `✗ ${locale}.${entry.key}: ${value.length} caracteres; máximo ${entry.maxChars} (${entry.context}). Las explicaciones completas van en title/tooltip, no en el texto visible siempre-on.`,
        )
      }
    }
  }
  return errors
}

export function main(
  root = process.cwd(),
  deps: UiCopyCheckDependencies = { readFile: (path) => readFileSync(path, 'utf8') },
  force = process.argv.includes('--all'),
): number {
  const names = runCommand(['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'], root)
  if (names.exitCode !== 0) {
    console.error(names.stderr.trim())
    return 1
  }
  const paths = names.stdout.split('\n').map((value) => value.trim()).filter(Boolean)
  if (!force && !requiresUiCopyBudget(paths)) {
    console.log('✓ UI copy budget: no aplica al diff staged')
    return 0
  }
  const errors = checkUiCopyBudget(
    deps,
    resolve(root, 'src/dashboard/public/i18n.js'),
    resolve(root, 'src/dashboard/ui-copy-budget.json'),
  )
  if (errors.length > 0) {
    console.error('✗ Texto visible fuera del presupuesto compacto de UI.')
    for (const error of errors) console.error(`  ${error}`)
    return 1
  }
  console.log('✓ UI copy budget: en/es dentro del máximo declarado')
  return 0
}

if (import.meta.main) process.exit(main())
