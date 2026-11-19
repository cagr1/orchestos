import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { check, z } from '../boundary/index.ts'
import { localPreviewUrl } from '../preview/local-url.ts'
import { validPreviewShotName } from '../preview/paths.ts'

export const PREVIEW_TOOLS = [
  'preview_navigate',
  'preview_screenshot',
  'preview_console',
  'preview_click',
] as const
export const NO_PREVIEW_URL =
  'No preview URL: open the Preview tab in Dev and enter your dev server URL'
const LOCAL_ONLY = 'The agent can only open localhost URLs'

export function previewToolDefinitions() {
  return [
    {
      name: 'preview_navigate',
      description: 'Open the local app Preview URL.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string' } },
        additionalProperties: false,
      },
    },
    {
      name: 'preview_screenshot',
      description: 'Capture the local app Preview.',
      inputSchema: {
        type: 'object',
        properties: { fullPage: { type: 'boolean' } },
        additionalProperties: false,
      },
    },
    {
      name: 'preview_console',
      description: 'Read console and network errors since the last Preview navigation.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'preview_click',
      description: 'Click a selector or matching text in the local app Preview.',
      inputSchema: {
        type: 'object',
        properties: { selector: { type: 'string' }, text: { type: 'string' } },
        additionalProperties: false,
      },
    },
  ]
}

export type PreviewBrowserFactory = () => Promise<{ browser: Pick<Browser, 'close'>; page: Page }>

const launchBrowser: PreviewBrowserFactory = async () => {
  const { chromium } = await import('playwright')
  let browser: Browser
  try {
    browser = await chromium.launch({ headless: true })
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nInstall Chromium with: bunx playwright install chromium`,
    )
  }
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      serviceWorkers: 'block',
    })
    return { browser, page }
  } catch (error) {
    await browser.close()
    throw error
  }
}

export class PreviewSession {
  private browser?: Pick<Browser, 'close'>
  private page?: Page
  private errors: string[] = []
  private blocked = false
  private navigated = false

  constructor(
    private dir: string,
    private factory: PreviewBrowserFactory = launchBrowser,
  ) {}

  private record(message: string) {
    if (this.errors.length < 100) this.errors.push(message.slice(0, 500))
  }

  private async open(): Promise<Page> {
    if (this.page) return this.page
    const { browser, page } = await this.factory()
    this.browser = browser
    this.page = page
    const context = page.context()
    await context.route('**', async (route) => {
      const request = route.request()
      if (request.resourceType() !== 'document') {
        await route.continue()
        return
      }
      if (!localPreviewUrl(request.url())) {
        this.blocked = true
        await route.abort()
        return
      }
      // Chromium sigue una redirección entregada sin volver a pasar por aquí: se recorre la
      // cadena entera y se entrega una sola redirección al destino final, ya comprobado.
      let current = request.url()
      for (let hop = 0; hop <= 10; hop++) {
        const response = await route.fetch({ url: current, maxRedirects: 0 })
        const location = response.headers().location
        if (response.status() < 300 || response.status() >= 400 || !location) {
          if (hop === 0) await route.fulfill({ response })
          else await route.fulfill({ status: 302, headers: { location: current } })
          return
        }
        current = new URL(location, current).href
        if (!localPreviewUrl(current)) break
      }
      this.blocked = true
      await route.abort()
    })
    context.on('page', (popup) => {
      if (popup === page) return
      if (!localPreviewUrl(popup.url())) this.blocked = true
      void popup.close().catch((error: unknown) => {
        this.record(`page close: ${error instanceof Error ? error.message : String(error)}`)
      })
    })
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning')
        this.record(`${message.type()}: ${message.text()}`)
    })
    page.on('pageerror', (error) => this.record(`pageerror: ${error.message}`))
    page.on('requestfailed', (request) =>
      this.record(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`),
    )
    page.on('response', (response) => {
      if (response.status() >= 400) this.record(`HTTP ${response.status()}: ${response.url()}`)
    })
    page.on('request', (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) this.errors = []
    })
    return page
  }

  private assertLocal(page: Page) {
    if (this.blocked || !localPreviewUrl(page.url())) throw new Error(LOCAL_ONLY)
  }

  private async navigate(input?: string) {
    let value = input
    if (value === undefined) {
      try {
        value = await readFile(join(this.dir, 'url'), 'utf8')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    if (!value?.trim()) throw new Error(NO_PREVIEW_URL)
    const url = localPreviewUrl(value)
    if (!url) throw new Error(LOCAL_ONLY)
    const page = await this.open()
    // Un documento abortado deja a Chromium navegando a chrome-error:// un instante después;
    // sin esperarla, la siguiente navegación se interrumpe.
    if (this.blocked)
      await page
        .waitForURL((current) => current.protocol === 'chrome-error:', { timeout: 2_000 })
        .catch(() => {})
    this.errors = []
    this.blocked = false
    this.navigated = false
    const response = await page.goto(url)
    this.assertLocal(page)
    this.navigated = true
    return { title: await page.title(), url: page.url(), status: response?.status() ?? null }
  }

  async call(name: string, input: unknown) {
    const text = (value: string, isError = false) => ({
      content: [{ type: 'text' as const, text: value }],
      isError,
    })
    try {
      if (name === 'preview_navigate') {
        const args = check(z.object({ url: z.string().optional() }).strict(), input ?? {})
        if (!args.ok) throw new Error(args.error)
        return text(JSON.stringify(await this.navigate(args.data.url)))
      }
      if (name === 'preview_console') {
        const args = check(z.object({}).strict(), input ?? {})
        if (!args.ok) throw new Error(args.error)
        return text(this.errors.join('\n') || 'No console errors')
      }
      if (name === 'preview_screenshot') {
        const args = check(z.object({ fullPage: z.boolean().optional() }).strict(), input ?? {})
        if (!args.ok) throw new Error(args.error)
        if (!this.navigated) await this.navigate()
        const page = await this.open()
        this.assertLocal(page)
        const bytes = await page.screenshot({ type: 'png', fullPage: args.data.fullPage ?? false })
        const shots = join(this.dir, 'shots')
        await mkdir(shots, { recursive: true })
        const name = `${new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').replace('.', '-').replace('Z', '')}.png`
        await writeFile(join(shots, name), bytes)
        const files = (await readdir(shots)).filter(validPreviewShotName).sort()
        for (const old of files.slice(0, Math.max(0, files.length - 50))) await rm(join(shots, old))
        return {
          content: [
            { type: 'image' as const, data: bytes.toString('base64'), mimeType: 'image/png' },
            { type: 'text' as const, text: `preview-shot:${name}` },
          ],
          isError: false,
        }
      }
      const args = check(
        z
          .object({ selector: z.string().min(1).optional(), text: z.string().min(1).optional() })
          .strict()
          .refine(
            (value) => (value.selector !== undefined) !== (value.text !== undefined),
            'Provide exactly one of selector or text',
          ),
        input ?? {},
      )
      if (!args.ok) throw new Error(args.error)
      if (!this.navigated) await this.navigate()
      const page = await this.open()
      this.assertLocal(page)
      this.blocked = false
      const target =
        args.data.selector !== undefined
          ? page.locator(args.data.selector)
          : page.getByText(args.data.text ?? '', { exact: false }).first()
      await target.click({ timeout: 5000 })
      try {
        await page.waitForLoadState('networkidle', { timeout: 5000 })
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error
      }
      this.assertLocal(page)
      return text(page.url())
    } catch (error) {
      return text(
        this.blocked ? LOCAL_ONLY : error instanceof Error ? error.message : String(error),
        true,
      )
    }
  }

  async close() {
    await this.browser?.close()
    this.browser = undefined
    this.page = undefined
    this.navigated = false
  }
}
