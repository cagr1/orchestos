#!/usr/bin/env node
/**
 * Hook `PreToolUse`: impide que el cerebro de Claude Code escriba código.
 * El ejecutor explícito queda permitido y cualquier error falla abierto.
 *
 * Spec: docs/specs/AT.1.md.
 */
import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT =
  process.env.BRAIN_GUARD_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CODE_PREFIXES = ['src/', 'tests/', 'scripts/', '.claude/hooks/']
const MESSAGE_PREFIX =
  'Cerebro no escribe código (AGENTS.md § Protocolo de delegación): escribe el spec en docs/specs/<ID>.md y delega a Luna. Ejecutor Sonnet: lanzar con ORCHESTOS_ROLE=executor. Ruta:'

function relativePath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return null

  let result = isAbsolute(filePath) ? relative(ROOT, filePath) : filePath
  result = result.replaceAll('\\', '/').replace(/^\.\//, '')

  const worktreePrefix = /^\.orchestos\/worktrees\/[^/]+\//
  if (worktreePrefix.test(result)) result = result.replace(worktreePrefix, '')

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

function shouldDeny(input) {
  if (process.env.ORCHESTOS_ROLE === 'executor') return null

  const toolName = input?.tool_name
  const toolInput = input?.tool_input
  if (!toolInput || typeof toolInput !== 'object') return null

  if (toolName === 'Edit' || toolName === 'Write' || toolName === 'MultiEdit') {
    const path = relativePath(toolInput.file_path)
    return path && isCodePath(toolInput.file_path) ? path : null
  }
  if (toolName === 'NotebookEdit') {
    const path = relativePath(toolInput.notebook_path)
    return path && isCodePath(toolInput.notebook_path) ? path : null
  }
  if (toolName !== 'Bash' || typeof toolInput.command !== 'string') return null

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
  const path = shouldDeny(input)
  if (!path) return

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `${MESSAGE_PREFIX} ${path}`,
      },
    }),
  )
}

try {
  main()
} catch {
  // Fallar abierto: el guard no puede impedir el uso normal de Claude Code.
}
