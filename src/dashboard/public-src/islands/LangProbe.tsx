/**
 * Isla de prueba de UI.0 — es el instrumento de validación del ítem, no una feature.
 *
 * Se monta SOLO con `?island-probe=1` en la URL: el Mes 30 tiene prohibido cambiar
 * comportamiento durante la migración, así que el dashboard normal no la ve nunca.
 *
 * Prueba, en vivo y a la vez, las cuatro cosas que UI.0 tiene que dejar funcionando:
 *  1. React monta dentro del DOM vanilla sin romperlo.
 *  2. Las utilidades Tailwind pintan con la paleta EXISTENTE (los tokens de ui.css) —
 *     si el mapeo estuviera mal, esto se ve fuera de tema al instante.
 *  3. `t()` cambia de idioma en vivo, sin recargar (puente de i18n, Costo 3).
 *  4. El contador local NO se reinicia al cambiar el idioma: si se reiniciara,
 *     significaría que la isla se remontó en vez de repintarse — es decir, que el
 *     puente reactivo no funciona y solo funcionaba el remount de rescate.
 * Y muestra cuántas islas hay montadas: si ese número crece con el poll de 30s o al
 * navegar, el registro de islas está leakeando.
 */
import { useState } from 'react'
import { useT, useLang } from '../lib/i18n.ts'
import { mountedIslandCount } from '../lib/islands.ts'

export function LangProbe() {
  const t = useT()
  const lang = useLang()
  const [count, setCount] = useState(0)

  return (
    <div className="mb-3 rounded-md border border-border bg-card p-3 font-sans text-foreground">
      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
        UI.0 island probe
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>
          lang: <code className="font-mono text-primary">{lang}</code>
        </span>
        <span>
          t(): <code className="font-mono text-primary">{t('graph.allDone.btn')}</code>
        </span>
        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="rounded-md bg-primary px-3 py-1 text-primary-foreground hover:opacity-90"
        >
          local state: {count}
        </button>
        <span className="text-muted-foreground">
          mounted islands: {mountedIslandCount()}
        </span>
      </div>
    </div>
  )
}
