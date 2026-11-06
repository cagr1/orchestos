import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import typescript from 'highlight.js/lib/languages/typescript'
import yaml from 'highlight.js/lib/languages/yaml'

for (const [name, language] of Object.entries({
  bash,
  css,
  javascript,
  json,
  markdown,
  typescript,
  yaml,
})) {
  hljs.registerLanguage(name, language)
}
export const LANGUAGES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  css: 'css',
  bash: 'bash',
  sh: 'bash',
}
export const TOKEN_CLASSES = [
  '[&_.hljs-keyword]:text-app-accent [&_.hljs-selector-tag]:text-app-accent [&_.hljs-name]:text-app-accent',
  '[&_.hljs-string]:text-app-success [&_.hljs-attr]:text-app-accent [&_.hljs-regexp]:text-app-success',
  String.raw`[&_.hljs-number]:text-app-warning [&_.hljs-literal]:text-app-warning [&_.hljs-built\_in]:text-app-accent`,
  '[&_.hljs-comment]:text-app-muted [&_.hljs-comment]:italic [&_.hljs-meta]:text-app-muted',
  '[&_.hljs-title]:text-app-accent [&_.hljs-type]:text-app-warning [&_.hljs-section]:text-app-accent',
].join(' ')

export default hljs
