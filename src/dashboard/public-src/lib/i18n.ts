/**
 * Puente de i18n vanilla → React (UI.0, Mes 30 · Costo 3 del plan).
 *
 * i18n NO se migra: las 223 llamadas a `t()` de `app.js` y el diccionario de
 * `i18n.js` se quedan como están, y React sigue llamando a `window.t()`.
 * Lo único que falta es que React se ENTERE cuando cambia el idioma: `setLang()`
 * solo escribía en `localStorage` y el llamador hacía `App.rerender()`, que repinta
 * DOM vanilla — una isla React se quedaba con el idioma viejo hasta desmontarse.
 *
 * El puente son dos mitades:
 *  1. `i18n.js` ahora emite `orchestos:langchange` dentro de `setLang()` (fuente única:
 *     cualquier llamador futuro lo obtiene gratis, sin acordarse de avisar).
 *  2. Acá, `useT()` se suscribe a ese evento con `useSyncExternalStore`, así las islas
 *     se repintan con el idioma nuevo SIN remontarse (conservan su estado local).
 *
 * El remount que hace `installIslandBridge` cubriría las islas de `#main`, pero no las
 * de sidebar/header/rightpanel, y perdería estado. Por eso el hook es el mecanismo real
 * y el remount solo la red de seguridad.
 */
import { useSyncExternalStore, useCallback } from 'react'

export const LANG_CHANGE_EVENT = 'orchestos:langchange'

type Translate = (key: string, ...args: unknown[]) => string

declare global {
  interface Window {
    t?: Translate
    getLang?: () => string
    setLang?: (lang: string) => void
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(LANG_CHANGE_EVENT, onChange)
  // `storage` cubre el cambio de idioma hecho en OTRA pestaña del dashboard.
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(LANG_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readLang(): string {
  return window.getLang?.() ?? 'en'
}

/** Idioma actual, reactivo. */
export function useLang(): string {
  return useSyncExternalStore(subscribe, readLang, () => 'en')
}

/**
 * `t()` reactivo. La identidad de la función cambia cuando cambia el idioma —
 * a propósito: es lo que hace que `useMemo`/`useCallback` que dependan de `t`
 * se recalculen solos en vez de quedar con el texto viejo.
 */
export function useT(): Translate {
  const lang = useLang()
  return useCallback(
    (key: string, ...args: unknown[]) => {
      void lang // dependencia real: re-crea el traductor al cambiar el idioma
      return window.t?.(key, ...args) ?? key
    },
    [lang],
  )
}
