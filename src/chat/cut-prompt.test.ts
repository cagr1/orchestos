import { expect, test } from 'bun:test'
import { cutPrompt } from './cut-prompt'

test('cut rewrites the existing NEXT.md and follows the project rules in order', () => {
  const prompt = cutPrompt({ hasNextMd: true })
  expect(prompt).toContain('AGENTS.md, CLAUDE.md and plan')
  expect(prompt).toContain('rewrite NEXT.md as one present, not a log')
  expect(prompt).toContain('with SHAs')
  expect(prompt).toContain('Otherwise leave it open')
  expect(prompt.indexOf('1. Item')).toBeLessThan(prompt.indexOf('2. Handoff'))
  expect(prompt.indexOf('2. Handoff')).toBeLessThan(prompt.indexOf('3. Commit'))
  expect(prompt).toContain('explicit paths (never the whole index)')
  expect(prompt).toContain('in the foreground')
  expect(prompt).toContain('Do not create tasks in this turn')
  expect(prompt).toContain('Perform the wrap-up yourself')
  expect(prompt).toEndWith(
    'Do not release locks or close the session: OrchestOS checks the result.',
  )
})

test('cut without NEXT.md forbids creating it and asks for a final Handoff', () => {
  const prompt = cutPrompt({ hasNextMd: false })
  expect(prompt).toContain('do not create NEXT.md')
  expect(prompt).toContain('final reply under a ## Handoff heading')
  expect(prompt).not.toContain('rewrite NEXT.md')
})
