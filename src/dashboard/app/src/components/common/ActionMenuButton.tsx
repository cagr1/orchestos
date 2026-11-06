import type { ReactNode, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function ActionMenuButton({
  label,
  menuLabel,
  className,
  children,
  options,
  anchorRef,
}: {
  label: string
  menuLabel: string
  className: string
  children: ReactNode
  options: { label: string; action: () => void }[]
  anchorRef?: RefObject<HTMLElement | null>
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<{ left: number; top: number } | null>(null)
  const [selected, setSelected] = useState(0)
  const close = () => {
    setMenu(null)
    buttonRef.current?.focus()
  }
  useEffect(() => {
    if (menu) menuRef.current?.querySelectorAll<HTMLButtonElement>('button')[selected]?.focus()
  }, [menu, selected])
  useEffect(() => {
    if (!menu) return
    const dismiss = (event: MouseEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      )
        setMenu(null)
    }
    const resize = () => setMenu(null)
    document.addEventListener('mousedown', dismiss)
    window.addEventListener('resize', resize)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      window.removeEventListener('resize', resize)
    }
  }, [menu])
  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        className={className}
        onClick={() => {
          if (menu) return close()
          const rect = buttonRef.current!.getBoundingClientRect()
          setSelected(0)
          setMenu({
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 232)),
            top: rect.bottom + 90 < window.innerHeight ? rect.bottom + 4 : rect.top - 88,
          })
        }}
      >
        {children}
      </button>
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={menuLabel}
            style={anchorRef ? undefined : menu}
            className={
              anchorRef
                ? 'absolute bottom-full left-2.5 mb-1 z-50 w-56 rounded-card bg-app-surface border border-app shadow-2xl p-2 text-xs text-app'
                : 'fixed z-50 w-56 rounded-card bg-app-surface border border-app shadow-2xl p-2 text-xs text-app'
            }
            onKeyDown={(event) => {
              if (event.key === 'Escape' || event.key === 'Tab') {
                event.preventDefault()
                close()
              } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                setSelected(
                  (index) =>
                    (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) %
                    options.length,
                )
              }
            }}
          >
            {options.map((option, index) => (
              <button
                type="button"
                role="menuitem"
                key={option.label}
                tabIndex={selected === index ? 0 : -1}
                onFocus={() => setSelected(index)}
                onClick={() => {
                  close()
                  option.action()
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-control text-left text-app-muted hover:text-app hover:bg-app-elevated/40 focus:bg-app-elevated/40 focus:text-app"
              >
                {option.label}
              </button>
            ))}
          </div>,
          anchorRef?.current ?? document.body,
        )}
    </>
  )
}
