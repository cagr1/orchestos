#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const [, , templatePath, appPath] = process.argv

if (!templatePath || !appPath) {
  console.error('Usage: node scripts/ui-fidelity/check-jsx.mjs <template> <app>')
  process.exit(2)
}

const allowPath = path.resolve('scripts/ui-fidelity/jsx-allow.json')

function readSource(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    console.error(`Cannot read ${filePath}: ${error.message}`)
    process.exit(2)
  }
}

function addCount(counts, value) {
  const normalized = value.trim()
  if (!normalized) return
  counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
}

function addClassTokens(counts, value) {
  for (const token of value.split(/\s+/)) addCount(counts, token)
}

function extractClassNames(source) {
  const counts = new Map()
  const attribute = /\bclassName\s*=\s*/g
  let match

  while ((match = attribute.exec(source))) {
    let cursor = match.index + match[0].length
    while (/\s/.test(source[cursor] ?? '')) cursor += 1

    if (source[cursor] === '"' || source[cursor] === "'") {
      const quote = source[cursor++]
      const end = source.indexOf(quote, cursor)
      if (end !== -1) addClassTokens(counts, source.slice(cursor, end))
      continue
    }

    if (source[cursor] !== '{') continue
    const expressionStart = ++cursor
    let depth = 1
    let quote = null
    let template = false
    let escaped = false

    for (; cursor < source.length && depth > 0; cursor += 1) {
      const character = source[cursor]
      if (escaped) {
        escaped = false
        continue
      }
      if (character === '\\' && (quote || template)) {
        escaped = true
        continue
      }
      if (quote) {
        if (character === quote) quote = null
        continue
      }
      if (character === "'" || character === '"') {
        quote = character
        continue
      }
      if (character === '`') {
        template = !template
        continue
      }
      if (template) continue
      if (character === '{') depth += 1
      if (character === '}') depth -= 1
    }

    const expression = source.slice(expressionStart, cursor - 1)
    for (const part of expression.matchAll(
      /(?:^|[^\\])(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)')/g,
    )) {
      addClassTokens(counts, part[1] ?? part[2] ?? '')
    }
    for (const part of expression.matchAll(/`([^`]*)`/g)) {
      addClassTokens(counts, part[1].replace(/\$\{[\s\S]*?\}/g, ' '))
    }
  }
  return counts
}

function extractElements(source) {
  const counts = new Map()
  for (const match of source.matchAll(/<([A-Za-z][A-Za-z0-9_.:-]*)\b/g)) {
    addCount(counts, match[1])
  }
  return counts
}

function loadAllowList() {
  if (!fs.existsSync(allowPath)) return []
  const parsed = JSON.parse(fs.readFileSync(allowPath, 'utf8'))
  return Array.isArray(parsed) ? parsed : [parsed]
}

function loadSampleText() {
  const samplePath = path.resolve('scripts/ui-fidelity/jsx-sample-text.json')
  if (!fs.existsSync(samplePath)) return []
  const parsed = JSON.parse(fs.readFileSync(samplePath, 'utf8'))
  return Array.isArray(parsed) ? parsed : [parsed]
}

function relativeOrBasename(filePath) {
  return [filePath, path.basename(filePath), path.relative(process.cwd(), filePath)]
}

function allowedCount(allowList, value, filePath) {
  return allowList
    .filter(
      (entry) => entry?.valor === value && relativeOrBasename(filePath).includes(entry.archivo),
    )
    .reduce((total, entry) => total + 1, 0)
}

const template = readSource(templatePath)
const app = readSource(appPath)
const allowList = loadAllowList()
const sampleText = loadSampleText()
const missing = []

for (const [value, required] of extractClassNames(template)) {
  const available = extractClassNames(app).get(value) ?? 0
  const exempted = allowedCount(allowList, value, templatePath)
  for (let index = available; index < required - exempted; index += 1) {
    missing.push(
      `className "${value}" (template line ${template.slice(0, template.indexOf(value)).split('\n').length})`,
    )
  }
}

for (const [value, required] of extractElements(template)) {
  const available = extractElements(app).get(value) ?? 0
  for (let index = available; index < required; index += 1) {
    const position = template.indexOf(`<${value}`)
    missing.push(
      `element <${value} (template line ${template.slice(0, position).split('\n').length})`,
    )
  }
}

for (const entry of allowList) {
  if (entry?.archivo && entry?.valor && relativeOrBasename(templatePath).includes(entry.archivo)) {
    console.log(`allow: ${entry.archivo} · ${entry.valor} · ${entry.motivo}`)
  }
}

for (const entry of sampleText) {
  if (!entry?.archivo || !entry?.texto) continue
  if (!relativeOrBasename(appPath).includes(entry.archivo)) continue
  if (app.includes(entry.texto)) {
    const line = app.slice(0, app.indexOf(entry.texto)).split('\n').length
    missing.push(`sample text "${entry.texto}" (app line ${line})`)
  }
}

if (missing.length > 0) {
  console.error(`JSX fidelity failed: ${missing.length} missing occurrence(s) in ${appPath}`)
  for (const item of missing) console.error(`- ${item}`)
  process.exit(1)
}

console.log(`JSX fidelity passed: ${path.basename(appPath)}`)
