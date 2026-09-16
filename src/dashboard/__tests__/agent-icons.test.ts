import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'

const dataSource = readFileSync(new URL('../public/data.js', import.meta.url), 'utf8')
const sidebarSource = readFileSync(
  new URL('../public-src/islands/shell/Sidebar.tsx', import.meta.url),
  'utf8',
)

describe('UI.9.2 CLI icon coverage', () => {
  it('keeps a non-empty mark for every executor mode, including transport aliases', () => {
    for (const brand of ['claude', 'openai', 'opencode', 'gemini', 'kimi', 'glm']) {
      expect(dataSource).toMatch(new RegExp(`\\n  ${brand}:[\\s\\S]*?<svg`))
    }
    expect(dataSource).toContain('deepseek: ICON.deepseek')
    expect(dataSource).toMatch(/deepseek:\n\s*'<svg/)
    expect(dataSource).toContain("codex: 'openai'")
    expect(dataSource).toContain("api: 'globe'")
    expect(dataSource).toContain("local: 'term'")
    expect(dataSource).toContain('return AGENT_ICONS[key] || ICON[AGENT_ICON_ALIASES[key]] || ICON.spark')
  })

  it('uses the resolver for both new CLI rows and existing sessions', () => {
    expect(sidebarSource).toContain('api.agentIcon(info.id)')
    expect(sidebarSource).toContain('api?.agentIcon(session.agent)')
  })
})
