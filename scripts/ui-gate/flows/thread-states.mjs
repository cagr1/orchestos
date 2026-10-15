const STATES = [
  'message-user',
  'message-assistant',
  'message-attachments',
  'markdown-response',
  'markdown-incomplete',
  'message-pdf',
  'thinking',
  'thinking-steps-running',
  'thinking-steps-done',
  'composer-empty',
  'composer-with-files',
  'card',
  'badges',
  'banner',
  'task-held',
  'task-running',
  'task-failed',
  'task-blocked',
  'task-done',
]

export default async function threadStates({ page, base, step, shot, visible, consoleErrors }) {
  for (const themeName of ['orchestos', 'graphite', 'carbon', 'light']) {
    const themeQuery = themeName === 'orchestos' ? '' : `&theme=${themeName}`
    await page.goto(`${base}/?view=thread-states${themeQuery}`, { waitUntil: 'domcontentloaded' })
    const sheet = page.getByTestId('thread-states-sheet')
    await step(`sheet-visible-${themeName}`, await visible(sheet), `${themeName} sheet visible`)

    for (const id of STATES) {
      await step(
        `${themeName}-state-${id}`,
        await visible(page.getByTestId(`state-${id}`)),
        `${themeName}: state-${id} visible`,
      )
    }

    const PALETTE =
      '\\b(?:emerald|zinc|rose|sky|amber|teal|purple|indigo|blue|red|green|slate|gray|violet|pink|cyan|orange|yellow)-\\d+\\b'
    const markdown = page.getByTestId('state-markdown-response')
    const breaks = await markdown.evaluate((root) => {
      const paragraph = [...root.querySelectorAll('p')].find((p) =>
        p.textContent?.includes('src/a.ts'),
      )
      if (!paragraph) return { lines: 0, brs: 0 }
      const lineHeight = Number.parseFloat(getComputedStyle(paragraph).lineHeight) || 20
      return {
        lines: Math.round(paragraph.getBoundingClientRect().height / lineHeight),
        brs: paragraph.querySelectorAll('br').length,
      }
    })
    await step(
      `${themeName}-single-line-breaks`,
      breaks.lines >= 3 || breaks.brs >= 2,
      `${themeName}: paragraph ${breaks.lines} lines, ${breaks.brs} <br>`,
    )
    const incompleteText = await page.getByTestId('state-markdown-incomplete').innerText()
    await step(
      `${themeName}-incomplete-markdown-clean`,
      !incompleteText.includes('**') && !incompleteText.includes('```'),
      `${themeName}: visible text ${JSON.stringify(incompleteText.slice(0, 80))}`,
    )
    const copyButton = markdown
      .locator('button[title*="opy" i], button[aria-label*="opy" i]')
      .first()
    await step(
      `${themeName}-code-block-copy`,
      await visible(copyButton),
      `${themeName}: code block copy button visible`,
    )
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'])
      .catch(() => {})
    await copyButton.click().catch(() => {})
    const clipboard = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
    await step(
      `${themeName}-code-block-copied`,
      clipboard.includes('const answer = 42'),
      `${themeName}: clipboard ${JSON.stringify(clipboard.slice(0, 40))}`,
    )
    const codeFrame = await markdown.evaluate((root) => {
      const block = root.querySelector('[data-streamdown="code-block"]')
      const prose = root.querySelector('.prose')
      const message = prose?.closest('.group')
      if (!block || !message) return { borders: -1, ratio: 0 }
      const bordered = [block, ...block.querySelectorAll('*')]
        .filter((element) => Number.parseFloat(getComputedStyle(element).borderTopWidth) > 0)
        .map((element) => {
          const style = getComputedStyle(element)
          return `${element.tagName.toLowerCase()}[${element.getAttribute('data-streamdown') ?? ''}] ${element.className} (${style.borderTopWidth})`
        })
      return {
        borders: bordered.length,
        bordered,
        ratio: block.getBoundingClientRect().width / message.getBoundingClientRect().width,
      }
    })
    await step(
      `${themeName}-code-block-single-frame`,
      codeFrame.borders <= 1 && codeFrame.ratio >= 0.9,
      `${themeName}: ${codeFrame.borders} bordered elements (${codeFrame.bordered?.join(' | ')}), ${(codeFrame.ratio * 100).toFixed(1)}% ChatMessage width`,
    )
    const codeHeader = await markdown.evaluate((root) => {
      const header = root.querySelector('[data-streamdown="code-block-header"]')
      const code = root.querySelector('[data-streamdown="code-block"] code')
      if (!header || !code)
        return {
          delta: Number.POSITIVE_INFINITY,
          missing: `${header ? '' : 'header '}${code ? '' : 'code'}`.trim(),
        }
      const language = [...header.querySelectorAll('*')].find(
        (element) => element.textContent?.trim() === 'ts',
      )
      const copy = root.querySelector('[data-streamdown="code-block-actions"] button')
      if (!language || !copy)
        return {
          delta: Number.POSITIVE_INFINITY,
          missing: `${language ? '' : 'language '}${copy ? '' : 'copy button'}`.trim(),
          languageCenter: null,
          copyCenter: null,
        }
      const languageRect = language.getBoundingClientRect()
      const copyRect = copy.getBoundingClientRect()
      const languageCenter = languageRect.top + languageRect.height / 2
      const copyCenter = copyRect.top + copyRect.height / 2
      return {
        delta: Math.abs(language.getBoundingClientRect().left - code.getBoundingClientRect().left),
        languageCenter,
        copyCenter,
        verticalDelta: Math.abs(languageCenter - copyCenter),
      }
    })
    await step(
      `${themeName}-code-header-aligned`,
      codeHeader.delta <= 2 && codeHeader.verticalDelta <= 2,
      `${themeName}: ${codeHeader.missing ? `missing ${codeHeader.missing}; ` : ''}language label/code left delta ${codeHeader.delta.toFixed(1)} px; label center ${codeHeader.languageCenter?.toFixed(1) ?? 'missing'} px, copy center ${codeHeader.copyCenter?.toFixed(1) ?? 'missing'} px, vertical delta ${codeHeader.verticalDelta?.toFixed(1) ?? 'missing'} px`,
    )
    const palette = await page.evaluate((source) => {
      const re = new RegExp(source)
      return [...document.querySelectorAll('[data-testid^="state-markdown-"] *')]
        .map((el) => el.getAttribute('class') ?? '')
        .filter((c) => re.test(c))
    }, PALETTE)
    await step(
      `${themeName}-no-palette-in-thread-markdown`,
      palette.length === 0,
      `${themeName}: ${palette.length} palette classes ${palette.slice(0, 2).join(' | ')}`,
    )

    const TASK_STATES = {
      'task-held': {
        state: 'held',
        label: 'Ready to run',
        actions: ['Approve & Run', 'Reject'],
        earlier: 0,
      },
      'task-running': { state: 'running', label: 'Running', actions: [], earlier: 0 },
      'task-failed': { state: 'failed', label: 'Failed', actions: ['Retry'], earlier: 1 },
      'task-blocked': {
        state: 'blocked',
        label: 'Uncommitted changes',
        actions: ['Commit & Run'],
        earlier: 0,
      },
      'task-done': { state: 'done', label: 'Done', actions: [], earlier: 2 },
    }
    for (const [id, expected] of Object.entries(TASK_STATES)) {
      const section = page.getByTestId(`state-${id}`)
      const cards = section.locator('[data-task-id]')
      const count = await cards.count()
      await step(
        `${themeName}-${id}-one-card`,
        count === 1,
        `${themeName}: ${id} one card per task (${count})`,
      )
      const card = cards.first()
      const state = await card.getAttribute('data-task-state')
      const labelText = await card.locator('[data-task-state-label]').innerText()
      await step(
        `${themeName}-${id}-state-label`,
        state === expected.state && labelText.trim() === expected.label,
        `${themeName}: ${id} state ${state}, label ${JSON.stringify(labelText)}`,
      )
      const taskId = await card.getAttribute('data-task-id')
      const cardText = await card.innerText()
      await step(
        `${themeName}-${id}-no-uuid-text`,
        Boolean(taskId) && !cardText.includes(taskId),
        `${themeName}: ${id} innerText has no task id`,
      )
      const copy = card.getByRole('button', { name: 'Copy task id' })
      await step(
        `${themeName}-${id}-copy-id`,
        (await copy.getAttribute('title')) === taskId,
        `${themeName}: ${id} copy button title is the id`,
      )
      for (const action of expected.actions) {
        const inside = await card.getByRole('button', { name: action, exact: true }).count()
        const total = await section.getByRole('button', { name: action, exact: true }).count()
        await step(
          `${themeName}-${id}-action-${action}`,
          inside === 1 && total === 1,
          `${themeName}: ${id} "${action}" inside card (${inside}/${total})`,
        )
      }
      if (expected.earlier > 0) {
        const header = card.locator('button[aria-expanded]').filter({ hasText: 'earlier' })
        const headerText = (await header.innerText()).trim()
        const before = await header.getAttribute('aria-expanded')
        await step(
          `${themeName}-${id}-earlier-collapsed`,
          before === 'false' && headerText.startsWith(String(expected.earlier)),
          `${themeName}: ${id} "${headerText}" aria-expanded=${before}`,
        )
        await header.click()
        await page.waitForTimeout(600)
        const after = await header.getAttribute('aria-expanded')
        const open = await visible(card.getByText('Attempt 1/3', { exact: false }).last())
        await step(
          `${themeName}-${id}-earlier-open`,
          after === 'true' && open,
          `${themeName}: ${id} aria-expanded=${after}, attempts visible=${open}`,
        )
      }
    }
    const taskPalette = await page.evaluate((source) => {
      const re = new RegExp(source)
      return [...document.querySelectorAll('[data-task-id], [data-task-id] *')]
        .map((el) => el.getAttribute('class') ?? '')
        .filter((c) => re.test(c))
    }, PALETTE)
    await step(
      `${themeName}-no-palette-in-task-card`,
      taskPalette.length === 0,
      `${themeName}: ${taskPalette.length} palette classes ${taskPalette.slice(0, 2).join(' | ')}`,
    )

    const doneState = page.getByTestId('state-thinking-steps-done')
    await doneState.locator('button').first().click()
    await page.waitForTimeout(600)
    await step(
      `${themeName}-thinking-steps-open`,
      await visible(doneState.getByText('Write the fix')),
      `${themeName}: a step becomes visible after clicking the header`,
    )
    const alignment = await page.evaluate(() => {
      const states = [
        ['state-thinking', 'Thinking'],
        ['state-thinking-steps-running', 'Running Bash'],
        ['state-thinking-steps-done', 'Thought for 8 s'],
      ]
      const assistantText = document.querySelector('[data-testid="state-message-assistant"] p')
      const assistantLeft = assistantText?.getBoundingClientRect().left ?? Number.NaN
      const phaseLefts = states.map(([id, label]) => {
        const state = document.querySelector(`[data-testid="${id}"]`)
        const phase = [...(state?.querySelectorAll('span') ?? [])].find(
          (span) => span.textContent?.trim() === label,
        )
        return phase?.getBoundingClientRect().left ?? Number.NaN
      })
      return {
        assistantLeft,
        phaseLefts,
        differences: phaseLefts.map((left) => Math.abs(left - assistantLeft)),
      }
    })
    await step(
      `${themeName}-thinking-aligned`,
      alignment.differences.every((difference) => difference <= 1),
      `phase lefts ${alignment.phaseLefts.map((left) => left.toFixed(2)).join(', ')} px; assistant p left ${alignment.assistantLeft.toFixed(2)} px; differences ${alignment.differences.map((difference) => difference.toFixed(2)).join(', ')} px`,
    )
    const mutedStyle = await doneState.getByText('Write the fix').evaluate((el) => {
      const mutedReference = document.querySelector(
        '[data-testid="thread-states-sheet"] .text-muted-foreground',
      )
      return {
        color: getComputedStyle(el).color,
        referenceColor: mutedReference ? getComputedStyle(mutedReference).color : '',
        fontWeight: getComputedStyle(el).fontWeight,
      }
    })
    await step(
      `${themeName}-thinking-steps-muted`,
      mutedStyle.color === mutedStyle.referenceColor && mutedStyle.fontWeight === '400',
      `step color ${mutedStyle.color}; muted reference ${mutedStyle.referenceColor}; font-weight ${mutedStyle.fontWeight}`,
    )
    const sheetText = await sheet.innerText()
    await step(
      `${themeName}-no-invented-words`,
      !/Moonwalking|Refining|Planning/.test(sheetText),
      `${themeName}: no invented thinking words in the sheet`,
    )

    const family = await sheet.evaluate((el) => getComputedStyle(el).fontFamily)
    await step(`${themeName}-font-inter`, /Inter/.test(family), `font-family: ${family}`)
    await page.evaluate(() => document.fonts.ready)
    const interLoaded = await page.evaluate(() => document.fonts.check("14px 'Inter Variable'"))
    await step(
      `${themeName}-font-inter-loaded`,
      interLoaded,
      "document.fonts.check('Inter Variable')",
    )

    const surfaceLadder = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const context = canvas.getContext('2d', { willReadFrequently: true })
      const labLightness = (color) => {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
        const linearize = (channel) => {
          const value = channel / 255
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        }
        const y =
          (0.2126729 * linearize(red) + 0.7151522 * linearize(green) + 0.072175 * linearize(blue)) /
          1.0000001
        const delta = 6 / 29
        const f = y > delta ** 3 ? Math.cbrt(y) : y / (3 * delta ** 2) + 4 / 29
        return 116 * f - 16
      }
      const rootStyle = getComputedStyle(document.documentElement)
      const lightness = Array.from({ length: 8 }, (_, index) =>
        labLightness(rootStyle.getPropertyValue(`--surface-${index + 1}`).trim()),
      )
      return lightness
    })
    const ladderIncreasing = themeName !== 'light'
    const ladderMonotone = surfaceLadder.every(
      (value, index) =>
        index === 0 ||
        (ladderIncreasing ? value > surfaceLadder[index - 1] : value < surfaceLadder[index - 1]),
    )
    await step(
      `${themeName}-surface-ladder`,
      ladderMonotone,
      `L*: ${surfaceLadder.map((value) => value.toFixed(2)).join(' → ')}; ${ladderIncreasing ? 'strictly increasing' : 'strictly decreasing'}`,
    )

    const clarity = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const context = canvas.getContext('2d', { willReadFrequently: true })
      const labLightness = (color) => {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
        const linearize = (channel) => {
          const value = channel / 255
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        }
        const r = linearize(red)
        const g = linearize(green)
        const b = linearize(blue)
        const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / 1.0000001
        const delta = 6 / 29
        const f = y > delta ** 3 ? Math.cbrt(y) : y / (3 * delta ** 2) + 4 / 29
        return 116 * f - 16
      }
      const bubble = document.querySelector(
        '[data-testid="state-message-user"] .group > div.whitespace-pre-wrap',
      )
      const bubbleL = labLightness(getComputedStyle(bubble).backgroundColor)
      let background = bubble.parentElement
      while (
        background &&
        Number.parseFloat(
          getComputedStyle(background).backgroundColor.match(
            /rgba?\([^)]*[,/]\s*([\d.]+)\s*\)$/,
          )?.[1] ?? '1',
        ) === 0
      ) {
        background = background.parentElement
      }
      const backgroundL = labLightness(
        getComputedStyle(background ?? document.documentElement).backgroundColor,
      )
      return {
        bubbleL,
        backgroundL,
        difference: Math.abs(bubbleL - backgroundL),
      }
    })
    await step(
      `${themeName}-user-bubble-clarity`,
      clarity.difference >= 6,
      `L* bubble ${clarity.bubbleL.toFixed(2)}, background ${clarity.backgroundL.toFixed(2)}, difference ${clarity.difference.toFixed(2)}; minimum 6`,
    )
    await page.waitForTimeout(800)
    await shot(`thread-states-${themeName}`, { fullPage: true })
  }

  await step(
    'no-pdf-worker-request',
    await page.evaluate(
      () => !performance.getEntriesByType('resource').some(({ name }) => /pdf\.worker/i.test(name)),
    ),
    'no PDF worker network request',
  )
  await step('no-console-errors', consoleErrors().length === 0, `errors: ${consoleErrors().length}`)

  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await step('home-chat', await visible(page.locator('textarea')), 'default route loads the chat')
}
