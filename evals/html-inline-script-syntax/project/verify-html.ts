import { readFileSync } from 'node:fs'

const html = readFileSync('public/index.html', 'utf-8')
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
if (scripts.length === 0) throw new Error('expected at least one inline script')
for (const script of scripts) {
  new Function(script[1] ?? '')
}
