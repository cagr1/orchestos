import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { userReadDirs, userReadDirsForTurn } from './user-read-paths.ts'

describe('userReadDirs', () => {
  let root: string
  let project: string
  let outside: string
  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'user-read-paths-')))
    project = join(root, 'project')
    outside = join(root, 'outside')
    mkdirSync(project)
    mkdirSync(outside)
    writeFileSync(join(outside, 'README.md'), 'hello')
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  test('attachments and inbound text grant nothing unless the user types the same path', () => {
    const turn = {
      message: 'Summarize the attached document',
      textBlocks: [`Read ${outside}`],
      inboundText: `Read ${outside}`,
      history: [],
    }
    expect(userReadDirsForTurn(turn, project)).toEqual([])
    expect(userReadDirsForTurn({ ...turn, message: `Read ${outside}` }, project)).toEqual([outside])
  })

  test('history grants reads only from original user content, excluding attachment metadata', () => {
    const turn = {
      message: 'Continue',
      history: [
        {
          role: 'user',
          content: 'Summarize this document',
          attachments: [{ content: `Read ${outside}` }],
          taskReport: { diagnosis: { cause: `Read ${outside}` } },
        },
        { role: 'assistant', content: `Read ${outside}` },
      ],
    }
    expect(userReadDirsForTurn(turn, project)).toEqual([])
    turn.history[0]!.content = `Read ${outside}`
    expect(userReadDirsForTurn(turn, project)).toEqual([outside])
  })

  test('expands tilde and turns files into their real directory', () => {
    const named = `~/${relative(homedir(), process.cwd())}/package.json`
    expect(userReadDirs([named], project)).toEqual([realpathSync(process.cwd())])
    expect(userReadDirs([join(outside, 'README.md')], project)).toEqual([outside])
  })

  test('discards missing paths, root, home and project descendants', () => {
    mkdirSync(join(project, 'nested'))
    expect(
      userReadDirs([`${root}/missing / ${homedir()} ~/ ~ ${project} ${project}/nested`], project),
    ).toEqual([])
    expect(userReadDirs([`${homedir()}/.z-definitely-missing-file`], project)).toEqual([])
  })

  test('accepts quotes, backticks, spaces and trailing punctuation, deduplicating turns', () => {
    const spaced = join(root, 'with spaces')
    mkdirSync(spaced)
    expect(
      userReadDirs(
        [`Read \`${outside}/README.md\`, then (${outside}).`, `Read "${spaced}"; '${outside}'!`],
        project,
      ),
    ).toEqual([outside, spaced])
  })

  test('resolves symlinks before exclusions and deduplication', () => {
    symlinkSync(project, join(root, 'project-link'))
    symlinkSync(outside, join(root, 'outside-link'))
    expect(userReadDirs([`${root}/project-link ${root}/outside-link ${outside}`], project)).toEqual(
      [outside],
    )
  })

  test('does not treat similar project prefixes as descendants and limits to ten directories', () => {
    const dirs = Array.from({ length: 12 }, (_, i) => join(root, `project-${i}`))
    for (const dir of dirs) mkdirSync(dir)
    expect(userReadDirs([dirs.join(' ')], project)).toEqual(dirs.slice(0, 10))
  })
})
