const STATES = [
  'message-user',
  'message-assistant',
  'message-attachments',
  'message-pdf',
  'thinking',
  'thinking-steps-running',
  'thinking-steps-done',
  'composer-empty',
  'composer-with-files',
  'card',
  'badges',
  'banner',
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
