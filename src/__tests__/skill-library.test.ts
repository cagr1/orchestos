import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stringify } from 'yaml'
import { pickAutoSkill } from '../dashboard/handlers/chat.ts'
import {
  __setLibraryUrlCheckForTests,
  handleApiSkillEnabled,
  handleApiSkillPhases,
  handleApiSkillsLibrary,
  handleApiSkillsList,
} from '../dashboard/handlers/skills.ts'
import { route } from '../dashboard/server.ts'
import type { RunContext } from '../run/middleware.ts'
import { skillRoute } from '../run/middlewares/skill-route.ts'
import { buildPrompt } from '../run/prompt.ts'
import {
  buildSkillInstructions,
  isKnownSkillId,
  listAllSkillCandidates,
  renderSkillCatalog,
  resolveGates,
  resolvePhaseSkills,
} from '../skills/catalog.ts'
import { convertSkillMarkdown, skillMarkdownUrl } from '../skills/markdown-import.ts'
import {
  getUserSkillsDir,
  listSkillFiles,
  listSkillFilesWithOrigin,
  loadSkill,
  resolveEnabledSkillPath,
  resolveSkillPath,
  setSkillEnabled,
  validateSkill,
} from '../skills/registry.ts'
import type { Task } from '../tasks/schema.ts'

const markdown =
  '---\nname: Library Test\ndescription: Use when testing.\n---\n# Instructions\nRead [guide](references/guide.md).'
const originalHome = process.env.ORCHESTOS_HOME
const originalFetch = globalThis.fetch
let home: string
let root: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'skills-library-home-'))
  root = join(home, 'project')
  mkdirSync(join(root, 'skills'), { recursive: true })
  process.env.ORCHESTOS_HOME = home
})
afterEach(() => {
  __setLibraryUrlCheckForTests()
  globalThis.fetch = originalFetch
  if (originalHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = originalHome
  rmSync(home, { recursive: true, force: true })
})

function seed(id = 'library-test', dir = getUserSkillsDir()) {
  mkdirSync(dir, { recursive: true })
  const skill = convertSkillMarkdown(markdown, 'https://example.com/skills/').skill
  writeFileSync(join(dir, `${id}.yaml`), stringify({ ...skill, id }))
  return join(dir, `${id}.yaml`)
}
function request(body: unknown, path = '/api/skills/library', method = 'POST') {
  return new Request(`http://localhost:4242${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('SKILL.md conversion', () => {
  test('keeps the body, normalizes the id, records source and warns about auxiliary files', () => {
    const { skill, warnings } = convertSkillMarkdown(markdown, 'https://example.com/skills/')
    expect(skill.id).toBe('library-test')
    expect(skill.name).toBe('Library Test')
    expect(skill.instructions).toBe('# Instructions\nRead [guide](references/guide.md).')
    expect(skill.targets).toEqual(['claude', 'openai'])
    expect(skill.source?.url).toBe('https://example.com/skills/')
    expect(Number.isNaN(Date.parse(skill.source!.fetchedAt))).toBe(false)
    expect(warnings).toEqual(['Auxiliary file was not imported: references/guide.md'])
  })
  test('warns on same-repository absolute links without fetching external references', () => {
    const body =
      markdown +
      '\nSee [local](https://github.com/o/r/blob/main/reference.md) and [other](https://example.net/guide).'
    const { warnings } = convertSkillMarkdown(body, 'https://github.com/o/r/tree/main/skill')
    expect(warnings).toContain(
      'Auxiliary file was not imported: https://github.com/o/r/blob/main/reference.md',
    )
    expect(warnings.some((warning) => warning.includes('example.net'))).toBe(false)
  })
  test('accepts CRLF and multiline descriptions', () => {
    const { skill } = convertSkillMarkdown(
      '---\r\nname: test\r\ndescription: |\r\n  First\r\n  Second\r\n---\r\nBody',
      'https://example.com/',
    )
    expect(skill.description).toContain('Second')
    expect(skill.instructions).toBe('Body')
  })
  test('rejects missing frontmatter, invalid metadata, empty body, invalid id and YAML input', () => {
    for (const text of [
      '# No frontmatter',
      '---\n[]\n---\nBody',
      '---\nname: 5\n---\nBody',
      '---\nname: !!!\ndescription: x\n---\nBody',
      '---\nname: test\ndescription: x\n---\n',
      'id: yaml-skill',
    ])
      expect(() => convertSkillMarkdown(text, 'https://example.com/')).toThrow()
  })
  test('supports descriptions up to 1024 and instructions up to 32000 for every skill', () => {
    const skill = convertSkillMarkdown(markdown, 'https://example.com/').skill
    expect(() =>
      validateSkill(
        { ...skill, description: 'd'.repeat(1024), instructions: 'i'.repeat(32000) },
        'test',
      ),
    ).not.toThrow()
    expect(() => validateSkill({ ...skill, description: 'd'.repeat(1025) }, 'test')).toThrow('1024')
    expect(() => validateSkill({ ...skill, instructions: 'i'.repeat(32001) }, 'test')).toThrow(
      '32000',
    )
  })
  test('normalizes blob, tree and raw GitHub URLs to the same file and folder source', () => {
    const folder = 'https://github.com/o/r/tree/main/skills/test'
    const raw = 'https://raw.githubusercontent.com/o/r/main/skills/test/SKILL.md'
    for (const input of [folder, 'https://github.com/o/r/blob/main/skills/test/SKILL.md', raw]) {
      expect(skillMarkdownUrl(input).fetchUrl.href).toBe(raw)
      expect(skillMarkdownUrl(input).sourceUrl).toBe(folder)
    }
    expect(skillMarkdownUrl('https://example.com/SKILL.md').fetchUrl.href).toBe(
      'https://example.com/SKILL.md',
    )
    for (const input of [
      'file:///SKILL.md',
      'https://github.com/o/r',
      'https://example.com/skill.yaml',
      'https://u:p@example.com/SKILL.md',
    ])
      expect(() => skillMarkdownUrl(input)).toThrow()
  })
})

describe('project activation and precedence', () => {
  test('lists skills in alphabetical id order regardless of creation order', () => {
    const projectSkills = join(root, 'skills')
    seed('zebra', projectSkills)
    seed('alpha', projectSkills)
    seed('middle', projectSkills)

    const ids = listSkillFilesWithOrigin(root)
      .filter(({ origin }) => origin === 'project')
      .map(({ path }) =>
        path
          .split('/')
          .at(-1)
          ?.replace(/\.ya?ml$/, ''),
      )
    expect(ids).toEqual([...ids].sort())
  })
  test('library is off by default, excluded from selection, and enabled independently per project', () => {
    const path = seed()
    expect(listSkillFilesWithOrigin(root)).toContainEqual({ path, origin: 'user-library' })
    expect(listSkillFiles(root)).not.toContain(path)
    expect(listAllSkillCandidates(root).some((s) => s.id === 'library-test')).toBe(false)
    expect(pickAutoSkill([{ id: 'library-test' }], root)).toBeUndefined()
    expect(() => resolveEnabledSkillPath('library-test', root)).toThrow('disabled')
    setSkillEnabled('library-test', true, root)
    expect(listSkillFiles(root)).toContain(path)
    expect(pickAutoSkill([{ id: 'library-test' }], root)).toBe('library-test')
    expect(resolveEnabledSkillPath('library-test', root)).toBe(path)
    expect(listSkillFiles(home)).not.toContain(path)
    expect(JSON.parse(readFileSync(join(root, '.orchestos/skills.json'), 'utf8'))).toEqual({
      enabled: ['library-test'],
    })
    setSkillEnabled('library-test', false, root)
    expect(listSkillFiles(root)).not.toContain(path)
  })
  test('runtime prompt, middleware and QA gates use the selected project activation', async () => {
    const path = seed()
    writeFileSync(
      path,
      stringify({ ...loadSkill(path), activation: { mode: 'automatic', phases: ['review'] } }),
    )
    const task = {
      skill: 'library-test',
      input: [],
      output: [],
      description: 'Test library',
    } as unknown as Task
    const ctx = {
      task,
      opts: { projectRoot: root },
      skillInstructions: '',
    } as unknown as RunContext
    let nextCalled = false
    await skillRoute(ctx, async () => {
      nextCalled = true
    })
    expect(nextCalled).toBe(true)
    expect(ctx.skillInstructions).toBe('')
    expect(buildPrompt(task, '', root).system).not.toContain('# Instructions')
    expect(
      resolveGates('test', 'review', root).some((gate) => gate.skill.id === 'library-test'),
    ).toBe(false)
    expect(isKnownSkillId('library-test', root)).toBe(false)
    setSkillEnabled('library-test', true, root)
    expect(
      resolveGates('test', 'review', root).some((gate) => gate.skill.id === 'library-test'),
    ).toBe(true)
    expect(isKnownSkillId('library-test', root)).toBe(true)
    // An ordinary execution skill reaches both runtime loaders once enabled.
    const skill = loadSkill(path)
    delete skill.activation
    writeFileSync(path, stringify(skill))
    await skillRoute(ctx, async () => {})
    expect(ctx.skillInstructions).toContain('# Instructions')
    expect(buildPrompt(task, '', root).system).toContain('# Instructions')
  })
  test('a disabled library override cannot re-enter selection through the Pro catalog', () => {
    seed('code-review')
    expect(listAllSkillCandidates(root).some((skill) => skill.id === 'code-review')).toBe(false)
    setSkillEnabled('code-review', true, root)
    expect(listAllSkillCandidates(root).filter((skill) => skill.id === 'code-review')).toHaveLength(
      1,
    )
  })
  test('project overrides library, which overrides built-in even when disabled', () => {
    const id = 'frontend-design'
    expect(
      listSkillFilesWithOrigin(root).find(({ path }) => path.endsWith(`/${id}.yaml`))?.origin,
    ).toBe('built-in')
    const library = seed(id)
    expect(resolveSkillPath(id, root)).toBe(library)
    expect(listSkillFiles(root).some((path) => path.endsWith(`/${id}.yaml`))).toBe(false)
    const project = seed(id, join(root, 'skills'))
    expect(resolveSkillPath(id, root)).toBe(project)
    expect(listSkillFiles(root)).toContain(project)
    expect(
      listSkillFilesWithOrigin(root).filter(({ path }) => path.endsWith(`/${id}.yaml`)),
    ).toEqual([{ path: project, origin: 'project' }])
  })
  test('invalid activation state fails closed and selector descriptions stay at 200 characters', () => {
    const path = seed()
    mkdirSync(join(root, '.orchestos'))
    writeFileSync(join(root, '.orchestos/skills.json'), '{"enabled":"library-test"}')
    expect(listSkillFiles(root)).not.toContain(path)
    const skill = loadSkill(path)
    writeFileSync(path, stringify({ ...skill, description: 'd'.repeat(1024) }))
    setSkillEnabled(skill.id, true, root)
    const candidate = listAllSkillCandidates(root).find((s) => s.id === skill.id)!
    expect(candidate.description).toHaveLength(200)
    expect(renderSkillCatalog([{ ...candidate, description: 'd'.repeat(1024) }])).toBe(
      `- library-test: ${'d'.repeat(200)}`,
    )
  })
})

describe('library endpoints', () => {
  test('imports without a provider, returns warnings, lists disabled and rejects duplicate ids', async () => {
    __setLibraryUrlCheckForTests(async () => null)
    globalThis.fetch = (async () => new Response(markdown)) as unknown as typeof fetch
    const response = await handleApiSkillsLibrary(request({ url: 'https://example.com/SKILL.md' }))
    expect(response.status).toBe(200)
    expect((await response.json()).warnings).toHaveLength(1)
    expect(loadSkill(join(getUserSkillsDir(), 'library-test.yaml')).instructions).toContain(
      '# Instructions',
    )
    const rows = await handleApiSkillsList(root).json()
    expect(rows.find((row: { id: string }) => row.id === 'library-test')).toMatchObject({
      origin: 'user-library',
      enabled: false,
    })
    expect(
      (await handleApiSkillsLibrary(request({ url: 'https://example.com/SKILL.md' }))).status,
    ).toBe(409)
  })
  test('blocks private URLs without fetching and rejects oversized streamed content', async () => {
    let fetched = false
    globalThis.fetch = (async () => {
      fetched = true
      return new Response(markdown)
    }) as unknown as typeof fetch
    expect(
      (await handleApiSkillsLibrary(request({ url: 'http://127.0.0.1/SKILL.md' }))).status,
    ).toBe(400)
    expect(fetched).toBe(false)
    __setLibraryUrlCheckForTests(async () => null)
    for (const headers of [
      new Headers(),
      new Headers({ 'Content-Length': String(256 * 1024 + 1) }),
    ]) {
      globalThis.fetch = (async () =>
        new Response('x'.repeat(256 * 1024 + 1), { headers })) as unknown as typeof fetch
      expect(
        (await handleApiSkillsLibrary(request({ url: 'https://example.com/SKILL.md' }))).status,
      ).toBe(413)
    }
  })
  test('toggles only library skills and requires a project header on the route', async () => {
    seed()
    const url = new URL('http://localhost:4242/api/skills/library-test/enabled')
    const response = await handleApiSkillEnabled(
      request({ enabled: true }, url.pathname, 'PUT'),
      url,
      root,
    )
    expect(response.status).toBe(200)
    expect(listAllSkillCandidates(root).some((s) => s.id === 'library-test')).toBe(true)
    expect(
      (await handleApiSkillEnabled(request({ enabled: 'yes' }, url.pathname, 'PUT'), url, root))
        .status,
    ).toBe(400)
    const builtIn = new URL('http://localhost:4242/api/skills/tdd-enforcer/enabled')
    expect(
      (
        await handleApiSkillEnabled(
          request({ enabled: true }, builtIn.pathname, 'PUT'),
          builtIn,
          root,
        )
      ).status,
    ).toBe(404)
    expect((await route(request({ enabled: true }, url.pathname, 'PUT'), 4242)).status).toBe(400)
  })
})

describe('SK.2 library phase configuration', () => {
  test('persists validated phases, preserves triggers, reloads and clears activation', async () => {
    const path = seed()
    writeFileSync(
      path,
      stringify({ ...loadSkill(path), activation: { mode: 'suggest', triggers: ['testing'] } }),
    )
    const url = new URL('http://localhost/api/skills/library-test/phases')
    const call = (phases: unknown) =>
      handleApiSkillPhases(request({ phases }, url.pathname, 'PUT'), url, root)
    expect((await call(['implement', 'fix'])).status).toBe(200)
    expect(loadSkill(path).activation).toEqual({
      mode: 'automatic',
      phases: ['implement', 'fix'],
      triggers: ['testing'],
    })
    expect(
      (await handleApiSkillsList(root).json()).find((s: { id: string }) => s.id === 'library-test')
        .phases,
    ).toEqual(['implement', 'fix'])
    expect((await call([])).status).toBe(200)
    expect(loadSkill(path).activation).toBeUndefined()
    expect(
      (await handleApiSkillsList(root).json()).find((s: { id: string }) => s.id === 'library-test')
        .phases,
    ).toEqual([])
  })
  test('rejects invalid/duplicate phases, non-library origins, invalid ids and unscoped routing', async () => {
    seed()
    const url = new URL('http://localhost/api/skills/library-test/phases')
    for (const phases of [['build'], ['fix', 'fix'], null, 'fix', [5]]) {
      expect(
        (await handleApiSkillPhases(request({ phases }, url.pathname, 'PUT'), url, root)).status,
      ).toBe(400)
    }
    for (const id of ['missing', 'tdd-enforcer']) {
      const url = new URL(`http://localhost/api/skills/${id}/phases`)
      expect(
        (await handleApiSkillPhases(request({ phases: ['fix'] }, url.pathname, 'PUT'), url, root))
          .status,
      ).toBe(404)
    }
    seed('library-test', join(root, 'skills'))
    expect(
      (await handleApiSkillPhases(request({ phases: ['fix'] }, url.pathname, 'PUT'), url, root))
        .status,
    ).toBe(404)
    const invalid = new URL('http://localhost/api/skills/INVALID/phases')
    expect(
      (await handleApiSkillPhases(request({ phases: [] }, invalid.pathname, 'PUT'), invalid, root))
        .status,
    ).toBe(400)
    expect((await route(request({ phases: [] }, url.pathname, 'PUT'), 4242)).status).toBe(400)
  })
})

describe('SK.2 execution phase instructions', () => {
  function phaseSkill(id: string, phases: string[], instructions = id, triggers?: string[]) {
    const path = seed(id)
    writeFileSync(
      path,
      stringify({
        ...loadSkill(path),
        name: id,
        instructions,
        activation: { mode: 'automatic', phases, triggers },
      }),
    )
    setSkillEnabled(id, true, root)
  }
  test('resolves in catalog order, respects triggers and excludes review-only gates', () => {
    phaseSkill('phase-a', ['implement', 'review'])
    phaseSkill('phase-b', ['implement', 'review'], 'b', ['authentication'])
    phaseSkill('phase-qa', ['review'])
    const phases = resolvePhaseSkills('add authentication', 'review', root)
    expect(phases.map(({ skill }) => skill.id)).toEqual(['phase-a', 'phase-b'])
    expect(phases.every((s) => s.applied)).toBe(true)
    expect(
      resolvePhaseSkills('other', 'implement', root).find((s) => s.skill.id === 'phase-b'),
    ).toMatchObject({
      applied: false,
      reason: 'ningún trigger coincidió con la descripción de la tarea',
    })
  })
  test('combines primary and two phase skills, deduplicates, omits over-budget and disabled skills', () => {
    phaseSkill('phase-a', ['implement'], 'a'.repeat(16000))
    phaseSkill('phase-b', ['implement'], 'b'.repeat(16000))
    phaseSkill('phase-c', ['implement'], 'c'.repeat(16000))
    const primary = seed('primary')
    writeFileSync(primary, stringify({ ...loadSkill(primary), instructions: 'primary body' }))
    setSkillEnabled('primary', true, root)
    const result = buildSkillInstructions(
      { skill: 'primary', description: 'test' },
      'implement',
      root,
    )
    expect(result.text.indexOf('primary body')).toBeLessThan(
      result.text.indexOf('SKILL GUIDELINES: phase-a'),
    )
    expect(result.text).toContain('SKILL GUIDELINES: phase-b')
    expect(result.text).not.toContain('SKILL GUIDELINES: phase-c')
    expect(result.phaseSkills.find((s) => s.id === 'phase-c')).toEqual({
      id: 'phase-c',
      applied: false,
      reason: 'omitted: skill context budget (48000 chars)',
    })
    const deduped = buildSkillInstructions(
      { skill: 'phase-a', description: 'test' },
      'implement',
      root,
    )
    expect(deduped.text.split('SKILL GUIDELINES: phase-a')).toHaveLength(2)
    setSkillEnabled('phase-b', false, root)
    expect(
      buildSkillInstructions({ description: 'test' }, 'implement', root).phaseSkills.some(
        (s) => s.id === 'phase-b',
      ),
    ).toBe(false)
  })
  test('middleware and standalone prompts use task fix versus doc classification', async () => {
    phaseSkill('fix-skill', ['fix'])
    phaseSkill('doc-skill', ['doc'])
    const task = {
      description: 'test',
      task_class: 'fix',
      input: [],
      output: ['out.txt'],
    } as unknown as Task
    expect(buildPrompt(task, '', root).system).toContain('SKILL GUIDELINES: fix-skill')
    expect(buildPrompt(task, '', root).system).not.toContain('SKILL GUIDELINES: doc-skill')
    task.task_class = 'doc'
    expect(buildPrompt(task, '', root).system).toContain('SKILL GUIDELINES: doc-skill')
    const ctx = { task, taskClass: 'fix', opts: { projectRoot: root } } as RunContext
    await skillRoute(ctx, async () => {})
    expect(ctx.skillInstructions).toContain('SKILL GUIDELINES: fix-skill')
    expect(ctx.phaseSkills).toContainEqual({
      id: 'fix-skill',
      applied: true,
      reason: 'sin triggers declarados — aplica siempre en esta fase',
    })
    expect(
      buildPrompt({ ...task, task_class: undefined, description: 'Fix bug' }, '', root).system,
    ).toContain('SKILL GUIDELINES: fix-skill')
  })
})
