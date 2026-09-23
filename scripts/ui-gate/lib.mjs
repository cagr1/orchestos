export function lintFlowSource(source) {
  if (/window\.(?:OrchestOS|state)\b/.test(source)) {
    return 'navega por window'
  }

  if (/page\.evaluate\([\s\S]{0,500}(?:location|history)/.test(source)) {
    return 'navega por window'
  }

  return null
}

export function formatResult(result) {
  const passed = result.steps.filter((step) => step.ok).length
  if (result.pass) return `PASS ${result.flujo} ${passed}/${result.steps.length}`

  const failed = result.steps.find((step) => !step.ok)
  const step = failed?.nombre ?? 'flow'
  const detail = failed?.detalle ?? result.errores[0] ?? 'unknown error'
  return `FAIL ${result.flujo}: ${step}: ${detail}`
}
