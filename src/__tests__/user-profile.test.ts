import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stringify } from 'yaml'
import { buildChatSystemPrompt } from '../chat/chat-context.ts'
import { orchestosDir } from '../config/orchestos-home.ts'
import { readUserProfile, writeUserProfile } from '../config/user-profile.ts'
import { handleApiProfileGet, handleApiProfilePut } from '../dashboard/handlers/profile.ts'
import { route } from '../dashboard/server.ts'
import { getUserSkillsDir } from '../skills/registry.ts'

const originalHome = process.env.ORCHESTOS_HOME
let home: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'orchestos-user-profile-'))
  process.env.ORCHESTOS_HOME = home
})
afterEach(() => {
  if (originalHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = originalHome
  rmSync(home, { recursive: true, force: true })
})

describe('global user profile', () => {
  test('absent, unreadable and invalid profiles are unanswered', () => {
    expect(readUserProfile()).toEqual({ codes: null })
    mkdirSync(orchestosDir(), { recursive: true })
    const path = join(orchestosDir(), 'profile.json')
    for (const raw of ['{', 'null', '[]', '{}', '{"codes":"false"}', '{"codes":0}']) {
      writeFileSync(path, raw)
      expect(readUserProfile()).toEqual({ codes: null })
    }
    rmSync(path)
    mkdirSync(path)
    expect(readUserProfile()).toEqual({ codes: null })
  })

  test('writes both boolean values atomically and leaves no temporary file', () => {
    for (const codes of [false, true]) {
      writeUserProfile({ codes })
      expect(readUserProfile()).toEqual({ codes })
      expect(JSON.parse(readFileSync(join(orchestosDir(), 'profile.json'), 'utf8'))).toEqual({
        codes,
      })
      expect(readdirSync(orchestosDir())).toEqual(['profile.json'])
    }
  })

  test('GET and PUT routes read and persist the global profile', async () => {
    expect(await handleApiProfileGet().json()).toEqual({ codes: null })
    for (const codes of [false, true]) {
      const response = await route(
        new Request('http://localhost:4242/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codes }),
        }),
        4242,
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ codes })
      const get = await route(new Request('http://localhost:4242/api/profile'), 4242)
      expect(await get.json()).toEqual({ codes })
      expect(readUserProfile()).toEqual({ codes })
    }
  })

  test('PUT rejects malformed JSON and every non-boolean without changing the profile', async () => {
    writeUserProfile({ codes: true })
    for (const body of [
      '{',
      'null',
      '[]',
      '{}',
      '{"codes":null}',
      '{"codes":"no"}',
      '{"codes":0}',
    ]) {
      const response = await handleApiProfilePut(
        new Request('http://localhost/api/profile', {
          method: 'PUT',
          body,
        }),
      )
      expect(response.status).toBe(400)
      expect(readUserProfile()).toEqual({ codes: true })
    }
  })
})

describe('chat profile instructions', () => {
  const input = { autoTaskInstruction: 'task instruction', now: new Date('2026-11-07T12:00:00Z') }
  test('true, null and absent keep the same prompt, independent of the stored profile', () => {
    writeUserProfile({ codes: false })
    const original = buildChatSystemPrompt(input)
    expect(buildChatSystemPrompt({ ...input, userCodes: true })).toBe(original)
    expect(buildChatSystemPrompt({ ...input, userCodes: null })).toBe(original)
    expect(original).not.toContain('User profile:')
  })
  test('false interviews before create_task with a fallback when grilling is missing', () => {
    const prompt = buildChatSystemPrompt({ ...input, userCodes: false, projectRoot: home })
    expect(prompt).toContain(
      'User profile:\nThe user does not write code. Before calling `create_task`, interview them',
    )
    expect(prompt).toContain('goal, users, data and success criteria')
  })
  test('profile is its own section when project state is absent or present', () => {
    const withoutState = buildChatSystemPrompt({ ...input, userCodes: false, projectRoot: home })
    expect(withoutState).not.toContain('Project state:')
    expect(withoutState).toContain('User profile:')

    const withState = buildChatSystemPrompt({
      ...input,
      userCodes: false,
      projectRoot: home,
      tasks: [{ id: 'task-1', status: 'running', description: 'Existing task' }],
    })
    expect(withState.indexOf('\n\nUser profile:')).toBeGreaterThan(
      withState.indexOf('Project state:'),
    )
  })
  test('false loads grilling from the disabled library and prefers project instructions', () => {
    const library = getUserSkillsDir()
    mkdirSync(library, { recursive: true })
    const skill = {
      id: 'grilling',
      name: 'Grilling',
      version: '1.0.0',
      description: 'Interview',
      targets: ['openai'],
      instructions: 'LIBRARY INTERVIEW',
    }
    writeFileSync(join(library, 'grilling.yaml'), stringify(skill))
    const args = { ...input, userCodes: false, projectRoot: home }
    expect(buildChatSystemPrompt(args)).toContain('LIBRARY INTERVIEW')
    mkdirSync(join(home, 'skills'), { recursive: true })
    writeFileSync(
      join(home, 'skills', 'grilling.yaml'),
      stringify({ ...skill, instructions: 'PROJECT INTERVIEW' }),
    )
    const prompt = buildChatSystemPrompt(args)
    expect(prompt).toContain('PROJECT INTERVIEW')
    expect(prompt).not.toContain('LIBRARY INTERVIEW')
    expect(buildChatSystemPrompt({ ...args, userCodes: true })).not.toContain('PROJECT INTERVIEW')
  })
})
