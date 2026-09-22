import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clearChatModelsCache, handleApiChatModels } from '../handlers/chat.ts'
import { handleApiExplorerTree } from '../handlers/explorer.ts'
import { currentBranch } from '../handlers/projects.ts'

const tempRoots: string[] = []

afterEach(() => {
  clearChatModelsCache()
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('UI.13.5 round 3 contracts', () => {
  test('explorer reports bytes for files but not folders', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-ui135-'))
    tempRoots.push(root)
    mkdirSync(join(root, 'folder'))
    writeFileSync(join(root, 'file.txt'), '12345')

    const body = (await handleApiExplorerTree(
      new URL('http://localhost/api/explorer/tree'),
      root,
    ).json()) as {
      entries: Array<{ name: string; size?: number }>
    }
    expect(body.entries.find((entry) => entry.name === 'file.txt')?.size).toBe(5)
    expect(body.entries.find((entry) => entry.name === 'folder')).not.toHaveProperty('size')
  })

  test('currentBranch returns the repository branch and omits non-git roots', () => {
    const repo = mkdtempSync(join(tmpdir(), 'orchestos-ui135-repo-'))
    const plain = mkdtempSync(join(tmpdir(), 'orchestos-ui135-plain-'))
    tempRoots.push(repo, plain)
    const init = Bun.spawnSync(['git', '-C', repo, 'init'], { stdout: 'ignore', stderr: 'ignore' })
    expect(init.exitCode).toBe(0)
    const commit = Bun.spawnSync(['git', '-C', repo, 'commit', '--allow-empty', '-m', 'init'], {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
      stdout: 'ignore',
      stderr: 'ignore',
    })
    expect(commit.exitCode).toBe(0)
    expect(currentBranch(repo)).toBeTruthy()
    expect(currentBranch(plain)).toBeUndefined()
    const head = Bun.spawnSync(['git', '-C', repo, 'rev-parse', 'HEAD'], {
      stdout: 'pipe',
      stderr: 'ignore',
    })
    writeFileSync(join(repo, '.git', 'HEAD'), new TextDecoder().decode(head.stdout).trim())
    Bun.spawnSync(['git', '-C', repo, 'status'], {
      stdout: 'ignore',
      stderr: 'ignore',
    })
    expect(currentBranch(repo)).toBeUndefined()
  })

  test('chat models cache successful upstream responses and serves them on failure', async () => {
    let calls = 0
    const fetchOk = async () => {
      calls += 1
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'provider/model',
              name: 'Model',
              context_length: 128000,
              pricing: { prompt: '0.000001' },
              supported_parameters: ['reasoning'],
            },
          ],
        }),
        { status: 200 },
      )
    }
    const first = await handleApiChatModels(fetchOk)
    const second = await handleApiChatModels(async () => {
      calls += 1
      throw new Error('offline')
    })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(calls).toBe(1)
    expect(await second.json()).toEqual(await first.clone().json())
  })

  test('chat models return 502 when upstream fails without cache', async () => {
    const response = await handleApiChatModels(async () => {
      throw new Error('offline')
    })
    expect(response.status).toBe(502)
  })

  test('chat models serve an expired cache when upstream fails', async () => {
    const originalNow = Date.now
    try {
      const first = await handleApiChatModels(
        async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
      )
      expect(first.status).toBe(200)
      Date.now = () => originalNow() + 11 * 60 * 1000

      const fallback = await handleApiChatModels(async () => {
        throw new Error('offline')
      })
      expect(fallback.status).toBe(200)
      expect(await fallback.json()).toEqual([])
    } finally {
      Date.now = originalNow
    }
  })
})
