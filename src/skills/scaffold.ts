import { existsSync } from 'fs'
import { join } from 'path'
import { SUPPORTED_LANGUAGES } from '../detect/languages.ts'

interface LangProfile {
  testCmd?: string
  buildCmd?: string
  lintCmd?: string
  antiPatterns: string[]
}

const LANG_PROFILES: Record<string, LangProfile> = {
  TypeScript: {
    testCmd: 'bun test',
    buildCmd: 'npx tsc --noEmit',
    lintCmd: 'npx eslint .',
    antiPatterns: ['use any to bypass type checking', 'skip describe blocks'],
  },
  JavaScript: {
    testCmd: 'npm test',
    lintCmd: 'npx eslint .',
    antiPatterns: ['skip describe blocks', 'console.log left in production code'],
  },
  Python: {
    testCmd: 'python -m pytest',
    lintCmd: 'ruff check .',
    antiPatterns: ['pass in test body', 'bare except clauses'],
  },
  'C#': {
    testCmd: 'dotnet test',
    buildCmd: 'dotnet build',
    antiPatterns: ['[Ignore] without a documented reason', 'catch (Exception) without logging'],
  },
  'Visual Basic': {
    testCmd: 'dotnet test',
    buildCmd: 'dotnet build',
    antiPatterns: ['On Error Resume Next without handling', 'magic numbers without constants'],
  },
  'F#': {
    testCmd: 'dotnet test',
    buildCmd: 'dotnet build',
    antiPatterns: ['mutable state without justification', 'ignoring Result/Option types'],
  },
  Rust: {
    testCmd: 'cargo test',
    buildCmd: 'cargo build',
    lintCmd: 'cargo clippy',
    antiPatterns: ['unwrap() without justification', 'clone() to avoid lifetime issues'],
  },
  Go: {
    testCmd: 'go test ./...',
    buildCmd: 'go build ./...',
    lintCmd: 'golangci-lint run',
    antiPatterns: ['ignoring error return values', 'panic in library code'],
  },
  Java: {
    testCmd: 'mvn test',
    buildCmd: 'mvn compile',
    antiPatterns: ['catch (Exception e) without handling', '@SuppressWarnings without reason'],
  },
  Kotlin: {
    testCmd: 'gradle test',
    buildCmd: 'gradle build',
    antiPatterns: ['!! operator without null check', 'blocking coroutine in main thread'],
  },
  Ruby: {
    testCmd: 'bundle exec rspec',
    lintCmd: 'rubocop',
    antiPatterns: ['rescue Exception instead of StandardError', 'eval with user input'],
  },
  PHP: {
    testCmd: 'vendor/bin/phpunit',
    lintCmd: 'vendor/bin/phpstan analyse',
    antiPatterns: ['SQL string concatenation', 'echo $_GET without sanitization'],
  },
  Swift: {
    testCmd: 'swift test',
    buildCmd: 'swift build',
    antiPatterns: ['force unwrap without guard', 'retain cycles in closures'],
  },
  R: {
    testCmd: 'Rscript tests/testthat.R',
    antiPatterns: ['T/F instead of TRUE/FALSE', 'attach() polluting namespace'],
  },
  Julia: {
    testCmd: 'julia --project -e "using Pkg; Pkg.test()"',
    antiPatterns: ['global variables in hot paths', 'type instability in tight loops'],
  },
  Dart: {
    testCmd: 'flutter test',
    buildCmd: 'flutter build',
    antiPatterns: ['setState inside async without mounted check', 'dynamic type without reason'],
  },
  Scala: {
    testCmd: 'sbt test',
    buildCmd: 'sbt compile',
    antiPatterns: ['blocking Future without timeout', 'null instead of Option'],
  },
  Elixir: {
    testCmd: 'mix test',
    buildCmd: 'mix compile',
    antiPatterns: ['Process.sleep in tests', 'catching all errors without logging'],
  },
  Haskell: {
    testCmd: 'stack test',
    buildCmd: 'stack build',
    antiPatterns: ['unsafePerformIO without justification', 'partial functions on total data'],
  },
  Shell: {
    lintCmd: 'shellcheck *.sh',
    antiPatterns: ['missing set -e or set -euo pipefail', 'unquoted variables'],
  },
  PowerShell: {
    lintCmd: 'Invoke-ScriptAnalyzer -Path .',
    antiPatterns: ['Write-Host instead of Write-Output', 'positional parameters in functions'],
  },
  SQL: {
    antiPatterns: ['SELECT * in production queries', 'string concatenation in queries (use params)'],
  },
  Vue: {
    testCmd: 'npm run test:unit',
    buildCmd: 'npm run build',
    antiPatterns: ['mutating props directly', 'v-if with v-for on same element'],
  },
  Svelte: {
    testCmd: 'npm run test',
    buildCmd: 'npm run build',
    antiPatterns: ['reactive statement side-effects outside $:', 'direct DOM manipulation'],
  },
}

function yamlItem(s: string): string {
  // Quote strings that start with YAML special chars or contain quotes
  if (/^[\[{\|>&*!,'"%@`]/.test(s) || s.includes('"') || s.includes("'")) {
    // Use double-quote wrapping, escaping any internal double quotes
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return s
}

export function scaffoldSkillYaml(language: string, skillId?: string): string {
  const id = skillId ?? `${language.toLowerCase().replace(/[^a-z0-9]/g, '-')}-development`
  const profile = LANG_PROFILES[language]

  const verifiers = profile
    ? [
        ...(profile.testCmd ? [profile.testCmd] : []),
        ...(profile.buildCmd ? [profile.buildCmd] : []),
        ...(profile.lintCmd ? [profile.lintCmd] : []),
      ]
    : ['run your project test suite']

  const antiPatterns = profile?.antiPatterns ?? [
    'skip tests to save time',
    'hardcoded credentials or secrets',
    'ignoring error handling',
  ]

  const testCmd = profile?.testCmd ?? 'run your test suite'
  const safeLang = language.replace(/[^a-z0-9]/gi, '-')

  return `id: ${id}
version: 1.0.0
name: ${safeLang} Development
description: General-purpose development skill for ${safeLang} projects. Customize verifiers, anti_patterns, and examples for your specific project.
targets:
  - claude
  - cursor
  - openai
when_to_use:
  - When implementing new features in ${safeLang}
  - When reviewing or refactoring ${safeLang} code
  - When debugging issues in a ${safeLang} project
inputs_required:
  - Task description or feature specification
  - Relevant file paths to modify or create
instructions: |
  Follow these practices for ${safeLang} development:

  1. Understand the task fully before writing any code.
  2. Write clean, idiomatic ${safeLang} — follow the conventions already present in the codebase.
  3. Verify your changes compile/parse before marking done.
  4. Run the test suite. If tests fail, fix them — do not delete or skip.
  5. Only modify files declared in output[]. Nothing else.
verifiers:
${verifiers.map(v => `  - ${yamlItem(v)}`).join('\n')}
anti_patterns:
${antiPatterns.map(a => `  - ${yamlItem(a)}`).join('\n')}
examples:
  - title: Basic feature implementation
    input: "Add a ${safeLang} function that validates email format"
    output: "Implement the function, write a test, run the test suite (${testCmd.replace(/"/g, '')}), confirm green."
language_targets:
  ${language.toLowerCase().replace(/[^a-z0-9]/g, '')}:
    verifiers:
${verifiers.map(v => `      - ${yamlItem(v)}`).join('\n')}
    anti_patterns:
${antiPatterns.map(a => `      - ${yamlItem(a)}`).join('\n')}
  default:
    verifiers:
      - run your test suite
    anti_patterns:
      - skip tests to save time
      - ignore error handling
`
}

export function getSkillsDir(projectRoot?: string): string {
  if (projectRoot) return join(projectRoot, 'skills')
  return join(process.cwd(), 'skills')
}

export function languageHasSkillCoverage(language: string, skillsDir: string): boolean {
  if (!existsSync(skillsDir)) return false
  const { readdirSync, readFileSync } = require('fs')
  try {
    const files = readdirSync(skillsDir).filter((f: string) => f.endsWith('.yaml') || f.endsWith('.yml'))
    const langKey = language.toLowerCase().replace(/[^a-z0-9]/g, '')
    for (const file of files) {
      const content = readFileSync(join(skillsDir, file), 'utf-8')
      if (content.includes(`language_targets:`) && content.includes(`${langKey}:`)) return true
    }
    return false
  } catch {
    return false
  }
}

export { SUPPORTED_LANGUAGES }
