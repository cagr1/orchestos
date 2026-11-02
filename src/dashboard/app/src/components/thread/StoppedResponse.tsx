export function StoppedResponse({ stopped }: { stopped?: boolean }) {
  return stopped ? <p className="mt-2 text-xs text-app-muted">Respuesta detenida</p> : null
}
