#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const sourceRoot = process.argv[2] || 'src/dashboard/app/src'
const cssPath = process.argv[3] || 'src/dashboard/app/dist/main.css'

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(fullPath)
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [fullPath] : []
  })
}

function escapeSelector(value) {
  return value.replace(/([\\/:.%[\](),])/g, '\\$1')
}

if (!fs.existsSync(sourceRoot) || !fs.existsSync(cssPath)) {
  console.error(`CSS check failed: missing ${!fs.existsSync(sourceRoot) ? sourceRoot : cssPath}`)
  process.exit(1)
}

const source = walk(sourceRoot)
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')
const css = fs.readFileSync(cssPath, 'utf8')
const classPattern =
  /(?:[\w-]+:)*(?:bg|text|border|divide|ring|fill|stroke|from|to|via|outline|shadow)-app(?:-[\w-]+)?(?:\/\d+)?/g
const classes = [...new Set(source.match(classPattern) ?? [])].sort()
const missing = classes.filter((className) => !css.includes(escapeSelector(className)))

if (css.includes('<alpha-value>')) {
  console.error('CSS check failed: compiled CSS contains <alpha-value>')
  process.exit(1)
}

if (missing.length) {
  console.error(
    `CSS check failed: ${missing.length} app utility/variant(s) missing from ${cssPath}`,
  )
  for (const className of missing) console.error(`- ${className}`)
  process.exit(1)
}

console.log(`CSS check passed: ${classes.length} app utility/variant(s) present`)
