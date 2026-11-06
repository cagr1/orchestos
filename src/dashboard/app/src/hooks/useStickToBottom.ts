import { type RefObject, useCallback, useEffect, useRef } from 'react'

export function useStickToBottom(
  containerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
) {
  const stuck = useRef(true)

  const stickToBottom = useCallback(() => {
    stuck.current = true
    const container = containerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [containerRef])

  useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    // Layout changes (including scroll anchoring and clamping after shrinkage)
    // can move scrollTop upwards too. Only user input may detach the thread.
    let pointerDown = false
    let touchY: number | undefined
    const detach = () => {
      stuck.current = false
    }
    const onWheel = (event: WheelEvent) => {
      if (container.scrollTop > 0 && !event.ctrlKey && !event.defaultPrevented && event.deltaY < 0)
        detach()
    }
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY
    }
    const onTouchMove = (event: TouchEvent) => {
      const nextY = event.touches[0]?.clientY
      if (container.scrollTop > 0 && nextY !== undefined && touchY !== undefined && nextY > touchY)
        detach()
      touchY = nextY
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || container.scrollTop <= 0) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest('input, textarea, select'))
      )
        return
      if (
        ['ArrowUp', 'PageUp', 'Home'].includes(event.key) ||
        (event.key === ' ' && event.shiftKey)
      )
        detach()
    }
    let lastTop = container.scrollTop
    const onPointerDown = () => {
      pointerDown = true
    }
    const onPointerUp = () => {
      pointerDown = false
    }
    const onScroll = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight
      if (distance <= 80) stuck.current = true
      else if (pointerDown && container.scrollTop < lastTop) detach()
      lastTop = container.scrollTop
    }
    container.addEventListener('scroll', onScroll)
    container.addEventListener('wheel', onWheel, { passive: true })
    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: true })
    container.addEventListener('keydown', onKeyDown)
    container.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    const observer = new ResizeObserver(() => {
      if (stuck.current) {
        container.scrollTop = container.scrollHeight
        lastTop = container.scrollTop
      }
    })
    observer.observe(content)
    observer.observe(container)

    return () => {
      container.removeEventListener('scroll', onScroll)
      container.removeEventListener('wheel', onWheel)
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('keydown', onKeyDown)
      container.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      observer.disconnect()
    }
  }, [containerRef, contentRef])

  return { stickToBottom }
}
