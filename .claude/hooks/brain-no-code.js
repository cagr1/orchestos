#!/usr/bin/env node
/**
 * Hook `PreToolUse`: impide que el cerebro escriba código salvo fixes chicos (AT.22).
 * El ejecutor explícito queda permitido y cualquier error falla abierto.
 *
 * Spec: docs/specs/AT.1.md.
 */
import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT =
  process.env.BRAIN_GUARD_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CODE_PREFIXES = ['src/', 'tests/', 'scripts/', '.claude/hooks/']
const SMALL_FIX_MAX_LINES = 20
const MESSAGE_PREFIX =
  'Cerebro no escribe código (AGENTS.md § Protocolo de delegación): escribe el spec en docs/specs/<ID>.md y delega su ejecución a otro modelo. Ruta:'

function relativePath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return null

  let result = isAbsolute(filePath) ? relative(ROOT, filePath) : filePath
  result = result.replaceAll('\\', '/').replace(/^\.\//, '')
  result = posix.normalize(result)

  const worktreePrefix = /^\.orchestos\/worktrees\/[^/]+\//
  if (worktreePrefix.test(result)) result = result.replace(worktreePrefix, '')
  result = posix.normalize(result)

  return result
}

function isCodePath(filePath) {
  const result = relativePath(filePath)
  return (
    result !== null &&
    !result.startsWith('..') &&
    CODE_PREFIXES.some((prefix) => result.startsWith(prefix))
  )
}

function lineCount(value) {
  if (typeof value !== 'string') return null
  return value === '' ? 0 : value.split('\n').length
}

function editSize(edit) {
  if (edit?.replace_all === true) return null
  const oldLines = lineCount(edit?.old_string)
  const newLines = lineCount(edit?.new_string)
  if (oldLines === null || newLines === null) return null
  return Math.max(oldLines, newLines)
}

function multiEditSize(edits) {
  if (!Array.isArray(edits) || edits.length === 0) return null
  let total = 0
  for (const edit of edits) {
    const size = editSize(edit)
    if (size === null) return null
    total += size
  }
  return total
}

function cleanToken(token) {
  return token.replace(/^(['"])(.*)\1$/, '$2')
}

function shellTokens(segment) {
  const tokens = []
  const tokenPattern = /(['"])(?:\\.|(?!\1)[^\\])*\1|\\.|[^\s]+/g
  for (const match of segment.matchAll(tokenPattern)) tokens.push(cleanToken(match[0]))
  return tokens
}

function hasCodeRedirect(segment) {
  for (let index = 0; index < segment.length; index += 1) {
    const character = segment[index]
    if (character !== '>' || /[\d&]/.test(segment[index - 1] ?? '')) continue

    const operatorLength = segment[index + 1] === '>' ? 2 : 1
    const target = segment.slice(index + operatorLength).match(/^\s*([^\s;|&<>]+)/)?.[1]
    if (target && isCodePath(cleanToken(target))) return true
    index += operatorLength - 1
  }
  return false
}

function hasCodeTee(segment) {
  const tokens = shellTokens(segment)
  if (tokens[0] !== 'tee') return false
  return tokens.slice(1).some((token) => !token.startsWith('-') && isCodePath(token))
}

function hasInPlaceEdit(segment) {
  const tokens = shellTokens(segment)
  if (tokens[0] !== 'sed' && tokens[0] !== 'perl') return false

  const hasInPlaceFlag = tokens.some((token) => token.startsWith('-') && token.includes('i'))
  return hasInPlaceFlag && tokens.some((token) => !token.startsWith('-') && isCodePath(token))
}

function hasInlineCodeWrite(command) {
  const interpreter = /(?:^|[;&|]\s*)(?:python3?|node|bun|deno|ruby|perl)(?=\s|$)/m
  const inlineScript = /(?:^|\s)(?:-e|-c|--eval|-)(?=\s|$)|<<-?\s*(['"]?)[A-Za-z_][\w]*\1/
  const writeCall =
    /\bopen\s*\([^)]*,\s*(['"])(?:w|a|x|r\+)\1\s*\)|\b(?:write_text|write_bytes|writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream)\s*\(|\bBun\.write\s*\(|\bFile\.write\s*\(/
  if (!interpreter.test(command) || !inlineScript.test(command) || !writeCall.test(command))
    return null

  const pathLiterals = /(['"])([^'"\s]+)\1/g
  for (const match of command.matchAll(pathLiterals)) {
    const literal = match[2]
    if (isCodePath(literal)) return relativePath(literal)
  }
  return null
}

function shouldDeny(input) {
  if (process.env.ORCHESTOS_ROLE === 'executor') return null

  const toolName = input?.tool_name
  const toolInput = input?.tool_input
  if (!toolInput || typeof toolInput !== 'object') return null

  if (toolName === 'Edit' || toolName === 'Write' || toolName === 'MultiEdit') {
    const path = relativePath(toolInput.file_path)
    if (!path || !isCodePath(toolInput.file_path)) return null
    if (toolName === 'Write') return { path }
    const size = toolName === 'Edit' ? editSize(toolInput) : multiEditSize(toolInput.edits)
    if (size === null || size > SMALL_FIX_MAX_LINES) return { path, sizeDenied: true }
    if (path.startsWith('.claude/hooks/')) return { path }
    return null
  }
  if (toolName === 'NotebookEdit') {
    const path = relativePath(toolInput.notebook_path)
    return path && isCodePath(toolInput.notebook_path) ? path : null
  }
  if (toolName !== 'Bash' || typeof toolInput.command !== 'string') return null

  const inlineWritePath = hasInlineCodeWrite(toolInput.command)
  if (inlineWritePath) return inlineWritePath

  const segments = toolInput.command.split(/&&|\|\||[;|]/)
  for (const segment of segments) {
    if (hasCodeRedirect(segment) || hasCodeTee(segment) || hasInPlaceEdit(segment)) {
      const tokens = shellTokens(segment)
      const path = tokens.find((token) => isCodePath(token))
      return relativePath(path) ?? path
    }
  }
  return null
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'))
  const result = shouldDeny(input)
  if (!result) return
  const denial = typeof result === 'string' ? { path: result } : result

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `${MESSAGE_PREFIX} ${denial.path}${denial.sizeDenied && (input.tool_name === 'Edit' || input.tool_name === 'MultiEdit') ? ' (fix chico: Edit de hasta 20 líneas sí se permite)' : ''}`,
      },
    }),
  )
}

try {
  main()
} catch {
  // Fallar abierto: el guard no puede impedir el uso normal de Claude Code.
}
