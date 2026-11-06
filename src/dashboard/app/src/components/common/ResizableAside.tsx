import { type ReactNode, useEffect, useRef, useState } from 'react'

const limits = {
  left: { min: 200, max: 420, initial: 256 },
  right: { min: 280, max: 640, initial: 384 },
}

export function ResizableAside({
  side,
  className,
  children,
}: {
  side: 'left' | 'right'
  className: string
  children: ReactNode
}) {
  const { min, max, initial } = limits[side]
  const storageKey = `orchestos-aside-${side}-width`
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey))
      return Number.isFinite(saved) && saved >= min ? Math.min(max, saved) : initial
    } catch {
      return initial
    }
  })
  const [availableMax, setAvailableMax] = useState(max)
  const [dragging, setDragging] = useState(false)
  const aside = useRef<HTMLElement>(null)
  const drag = useRef<{ x: number; width: number } | null>(null)
  const renderedWidth = Math.min(width, availableMax)
  const changeWidth = (next: number) => setWidth(Math.max(min, Math.min(availableMax, next)))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(width))
    } catch {
      /* Storage may be disabled. */
    }
  }, [storageKey, width])

  useEffect(() => {
    const workspace = aside.current?.closest('[data-shell-workspace]')
    if (!workspace) return
    const measure = () => {
      const other = workspace.querySelector<HTMLElement>(
        `[data-resizable-aside="${side === 'left' ? 'right' : 'left'}"]`,
      )
      const remaining = workspace.clientWidth - (other?.getBoundingClientRect().width ?? 0) - 360
      setAvailableMax(Math.max(min, Math.min(max, remaining)))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(workspace)
    const observeAsides = () => {
      for (const element of workspace.querySelectorAll('[data-resizable-aside]'))
        observer.observe(element)
      measure()
    }
    const mutations = new MutationObserver(observeAsides)
    mutations.observe(workspace, { childList: true, subtree: true })
    observeAsides()
    return () => {
      observer.disconnect()
      mutations.disconnect()
    }
  }, [side, min, max])

  useEffect(() => {
    if (!dragging) return
    const { userSelect, cursor } = document.body.style
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    return () => {
      document.body.style.userSelect = userSelect
      document.body.style.cursor = cursor
    }
  }, [dragging])

  const stopDragging = () => {
    drag.current = null
    setDragging(false)
  }
  return (
    <aside
      ref={aside}
      data-ff
      data-resizable-aside={side}
      className={`relative ${className}`}
      style={{ width: renderedWidth }}
    >
      <div
        role="separator"
        tabIndex={0}
        aria-label={side === 'left' ? 'Resize navigation sidebar' : 'Resize workspace inspector'}
        aria-orientation="vertical"
        aria-valuenow={renderedWidth}
        aria-valuemin={min}
        aria-valuemax={availableMax}
        className={`absolute top-0 bottom-0 w-1.5 z-30 cursor-col-resize touch-none outline-none group ${side === 'left' ? '-right-[3px]' : '-left-[3px]'}`}
        onDoubleClick={() => changeWidth(initial)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          const direction = (event.key === 'ArrowRight' ? 1 : -1) * (side === 'left' ? 1 : -1)
          changeWidth(renderedWidth + direction * 16)
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          event.currentTarget.focus()
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, width: renderedWidth }
          setDragging(true)
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          changeWidth(
            drag.current.width + (event.clientX - drag.current.x) * (side === 'left' ? 1 : -1),
          )
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId)
          stopDragging()
        }}
        onPointerCancel={stopDragging}
        onLostPointerCapture={stopDragging}
      >
        <span
          className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 group-hover:bg-app-accent group-focus-visible:bg-app-accent ${dragging ? 'bg-app-accent' : ''}`}
        />
      </div>
      {children}
    </aside>
  )
}
