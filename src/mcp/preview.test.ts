import { expect, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserContext, Page, Route } from 'playwright'
import { NO_PREVIEW_URL, PREVIEW_TOOLS, PreviewSession } from './preview.ts'
import { runMcpServer } from './server.ts'

class FixtureContext extends EventEmitter {
  routeHandler?: (route: Route) => Promise<void>
  async route(_pattern: string, handler: (route: Route) => Promise<void>) {
    this.routeHandler = handler
  }
}

class FixturePage extends EventEmitter {
  current = 'about:blank'
  fixtureContext = new FixtureContext()
  redirects = new Map<string, string>()
  fetched: string[] = []
  fulfilled: string[] = []
  continued: string[] = []
  popup?: FixturePage
  closed = false
  context() {
    return this.fixtureContext as unknown as BrowserContext
  }
  async close() {
    this.closed = true
  }
  clicked?: { selector?: string; text?: string; timeout: number }
  destination?: string
  fullPage?: boolean
  async route(_pattern: string, handler: (route: Route) => Promise<void>) {
    this.fixtureContext.routeHandler = handler
  }
  async request(url: string, type = 'document'): Promise<{ status(): number } | undefined> {
    let aborted = false
    let redirected: string | undefined
    await this.fixtureContext.routeHandler?.({
      request: () => ({ resourceType: () => type, url: () => url }),
      abort: async () => {
        aborted = true
      },
      continue: async () => {
        this.continued.push(url)
      },
      fetch: async (options: { url: string; maxRedirects: number }) => {
        expect(options.maxRedirects).toBe(0)
        this.fetched.push(options.url)
        const location = this.redirects.get(options.url)
        return {
          status: () => (location ? 302 : 200),
          headers: () => (location ? { location } : {}),
        }
      },
      fulfill: async (options: {
        response?: { headers(): { location?: string } }
        headers?: { location?: string }
      }) => {
        this.fulfilled.push(url)
        const location = options.response?.headers().location ?? options.headers?.location
        if (location) redirected = new URL(location, url).href
      },
    } as unknown as Route)
    if (aborted) throw new Error('aborted')
    if (redirected) return this.goto(redirected)
  }
  async goto(url: string): Promise<{ status(): number }> {
    const redirected = await this.request(url)
    if (redirected) return redirected
    this.emit('request', { isNavigationRequest: () => true, frame: () => this })
    this.current = url
    return { status: () => 200 }
  }
  mainFrame() {
    return this
  }
  url() {
    return this.current
  }
  async title() {
    return 'Fixture'
  }
  async screenshot(options: { fullPage: boolean }) {
    this.fullPage = options.fullPage
    return Buffer.from('png fixture')
  }
  locator(selector: string) {
    return {
      click: async ({ timeout }: { timeout: number }) => {
        this.clicked = { selector, timeout }
        if (this.popup) this.fixtureContext.emit('page', this.popup)
        if (this.destination) await this.goto(this.destination)
      },
    }
  }
  getByText(text: string, options: { exact: boolean }) {
    expect(options).toEqual({ exact: false })
    return {
      first: () => ({
        click: async ({ timeout }: { timeout: number }) => {
          this.clicked = { text, timeout }
          if (this.destination) await this.goto(this.destination)
        },
      }),
    }
  }
  async waitForURL() {}
  async waitForLoadState(state: string, options: { timeout: number }) {
    expect(state).toBe('networkidle')
    expect(options.timeout).toBe(5000)
  }
}

test('Preview browser is lazy, injectable, local-only, bounded and closed on stdin end', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'preview-mcp-'))
  const page = new FixturePage()
  let launched = 0
  let closed = 0
  const session = new PreviewSession(dir, async () => {
    launched++
    return {
      page: page as unknown as Page,
      browser: {
        close: async () => {
          closed++
        },
      },
    }
  })
  try {
    expect(await session.call('preview_navigate', {})).toMatchObject({
      isError: true,
      content: [{ text: NO_PREVIEW_URL }],
    })
    expect(await session.call('preview_navigate', { url: 'https://example.com' })).toMatchObject({
      isError: true,
    })
    expect(launched).toBe(0)
    writeFileSync(join(dir, 'url'), 'http://localhost:3000\n')
    mkdirSync(join(dir, 'shots'))
    for (let i = 0; i < 55; i++)
      writeFileSync(join(dir, 'shots', `20000101-000000-${String(i).padStart(3, '0')}.png`), 'old')
    const shot = await session.call('preview_screenshot', { fullPage: true })
    expect(shot.isError).toBe(false)
    expect(shot.content[0]).toMatchObject({
      type: 'image',
      data: Buffer.from('png fixture').toString('base64'),
      mimeType: 'image/png',
    })
    const marker = shot.content.find((part) => part.type === 'text')
    if (marker?.type !== 'text') throw new Error('missing screenshot marker')
    expect(marker.text).toMatch(/^preview-shot:\d{8}-\d{6}-\d{3}\.png$/)
    expect(
      readFileSync(join(dir, 'shots', marker.text.slice('preview-shot:'.length)), 'utf8'),
    ).toBe('png fixture')
    expect(readdirSync(join(dir, 'shots'))).toHaveLength(50)
    expect(page.fullPage).toBe(true)
    expect(launched).toBe(1)
    await page.request('https://cdn.example.com/font.woff', 'font')
    expect(await session.call('preview_console', {})).toMatchObject({
      content: [{ text: 'No console errors' }],
    })
    page.emit('console', { type: () => 'log', text: () => 'ignore' })
    page.emit('pageerror', new Error('broken'))
    page.emit('requestfailed', {
      url: () => 'http://localhost/no',
      failure: () => ({ errorText: 'failure' }),
    })
    page.emit('response', { url: () => 'http://localhost/404', status: () => 404 })
    for (let i = 0; i < 110; i++)
      page.emit('console', { type: () => 'warning', text: () => 'x'.repeat(800) })
    const consoleResult = await session.call('preview_console', {})
    const output = consoleResult.content[0]
    if (output?.type !== 'text') throw new Error('missing console output')
    expect(output.text.split('\n')).toHaveLength(100)
    expect(output.text.split('\n').every((line) => line.length <= 500)).toBe(true)
    expect(output.text).toContain('HTTP 404')
    expect(output.text).toContain('pageerror: broken')
    expect(output.text).toContain('requestfailed:')
    expect(await session.call('preview_navigate', {})).toMatchObject({
      content: [
        { text: JSON.stringify({ title: 'Fixture', url: 'http://localhost:3000/', status: 200 }) },
      ],
    })
    expect(await session.call('preview_console', {})).toMatchObject({
      content: [{ text: 'No console errors' }],
    })
    expect((await session.call('preview_click', {})).isError).toBe(true)
    expect((await session.call('preview_click', { selector: 'a', text: 'go' })).isError).toBe(true)
    expect((await session.call('preview_screenshot', { fullPage: 'yes' })).isError).toBe(true)
    expect((await session.call('preview_click', { text: 'go' })).isError).toBe(false)
    expect(page.clicked).toEqual({ text: 'go', timeout: 5000 })
    page.destination = 'https://example.com'
    expect((await session.call('preview_click', { selector: 'a' })).isError).toBe(true)
    expect(page.url()).toBe('http://localhost:3000/')
    expect((await session.call('preview_screenshot', {})).isError).toBe(true)
    await runMcpServer(
      { tools: [...PREVIEW_TOOLS], root: dir, previewDir: dir, previewSession: session },
      (async function* () {
        yield ''
      })(),
      () => {},
    )
    expect(closed).toBe(1)
  } finally {
    await session.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

for (const destination of ['https://example.com/private', '/next']) {
  test(`Preview checks redirect before fulfilling: ${destination}`, async () => {
    const page = new FixturePage()
    const start = 'http://localhost:3000/'
    page.redirects.set(start, destination)
    const session = new PreviewSession('/unused', async () => ({
      page: page as unknown as Page,
      browser: { close: async () => {} },
    }))
    try {
      const result = await session.call('preview_navigate', { url: start })
      if (destination.startsWith('https:')) {
        expect(result).toMatchObject({
          isError: true,
          content: [{ type: 'text', text: 'The agent can only open localhost URLs' }],
        })
        expect(page.fetched).toEqual([start])
        expect(page.fulfilled).toEqual([])
        expect(page.url()).toBe('about:blank')
      } else {
        expect(result.isError).toBe(false)
        // La cadena se comprueba entera antes de entregar la redirección; el fixture vuelve a pasar
        // el destino por la ruta (Chromium real no lo hace).
        expect(page.fetched).toEqual([
          start,
          'http://localhost:3000/next',
          'http://localhost:3000/next',
        ])
        expect(page.fulfilled).toEqual([start, 'http://localhost:3000/next'])
        expect(page.url()).toBe('http://localhost:3000/next')
        await page.request('https://cdn.example.com/font.woff', 'font')
        expect(page.continued).toEqual(['https://cdn.example.com/font.woff'])
      }
    } finally {
      await session.close()
    }
  })
}

for (const destination of ['https://example.com/', 'http://localhost:3000/popup']) {
  test(`Preview closes new pages and keeps the original: ${destination}`, async () => {
    const page = new FixturePage()
    const popup = new FixturePage()
    popup.current = destination
    page.popup = popup
    const session = new PreviewSession('/unused', async () => ({
      page: page as unknown as Page,
      browser: { close: async () => {} },
    }))
    try {
      await session.call('preview_navigate', { url: 'http://localhost:3000/' })
      // A popup's initial document must also encounter the context interceptor.
      popup.fixtureContext = page.fixtureContext
      if (destination.startsWith('https:')) {
        await expect(popup.request(destination)).rejects.toThrow('aborted')
        await session.call('preview_navigate', { url: 'http://localhost:3000/' })
      }
      const result = await session.call('preview_click', { selector: 'a' })
      expect(popup.closed).toBe(true)
      expect(result.isError).toBe(destination.startsWith('https:'))
      if (result.isError)
        expect(result.content).toEqual([
          { type: 'text', text: 'The agent can only open localhost URLs' },
        ])
      expect(page.url()).toBe('http://localhost:3000/')
      expect(page.closed).toBe(false)
    } finally {
      await session.close()
    }
  })
}
