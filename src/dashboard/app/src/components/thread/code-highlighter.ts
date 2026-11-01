import type { CodeHighlighterPlugin } from 'streamdown'
import hljs, { LANGUAGES } from '../../lib/highlight'

const resolveLanguage = (language: string) => {
  const name = language.toLowerCase()
  return Object.hasOwn(LANGUAGES, name) ? LANGUAGES[name] : name
}

export const threadCodeHighlighter: CodeHighlighterPlugin = {
  name: 'shiki', // Streamdown's adapter identifier; the engine here is highlight.js.
  type: 'code-highlighter',
  getSupportedLanguages: () => [...new Set([...hljs.listLanguages(), ...Object.keys(LANGUAGES)])],
  getThemes: () => ['github-light', 'github-dark'],
  supportsLanguage: (language) => !!hljs.getLanguage(resolveLanguage(language)),
  highlight({ code, language }) {
    if (!this.supportsLanguage(language)) {
      return { tokens: code.split('\n').map((content) => [{ content }]) }
    }

    const template = document.createElement('template')
    // highlight.js escapes source text before emitting its own token spans.
    template.innerHTML = hljs.highlight(code, { language: resolveLanguage(language) }).value
    const tokens: { content: string; htmlAttrs: Record<string, string> }[][] = [[]]
    const visit = (node: Node, classes: string[]) => {
      if (node.nodeType === Node.TEXT_NODE) {
        for (const [index, content] of (node.textContent ?? '').split('\n').entries()) {
          if (index > 0) tokens.push([])
          tokens[tokens.length - 1].push({ content, htmlAttrs: { className: classes.join(' ') } })
        }
        return
      }
      const next = node instanceof Element ? [...classes, ...node.classList] : classes
      for (const child of node.childNodes) visit(child, next)
    }
    visit(template.content, [])
    return { tokens }
  },
}
