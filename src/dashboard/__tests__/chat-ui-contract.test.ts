import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'

const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8')

describe('UI.9.2 chat session restoration contract', () => {
  it('loads session metadata before restoring messages and rendering controls', () => {
    const metadataLoad = appSource.indexOf('await this.fetchChatSessions()')
    const historyRestore = appSource.indexOf('this.fetchChatSession(restored.id)')
    expect(metadataLoad).toBeGreaterThanOrEqual(0)
    expect(historyRestore).toBeGreaterThan(metadataLoad)
    expect(appSource).toContain("if (st.chatSessionId && st.chatSessionsStatus !== 'ok') return null")
  })
})
