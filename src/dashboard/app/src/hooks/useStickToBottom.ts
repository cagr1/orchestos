import { type RefObject, useCallback, useEffect, useRef } from 'react'

export function useStickToBottom(
  containerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
) {
  const stuck = useRef(true)
  const lastTop = useRef(0)

  const stickToBottom = useCallback(() => {
    stuck.current = true
    const container = containerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
      lastTop.current = container.scrollTop
    }
  }, [containerRef])

  useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    lastTop.current = container.scrollTop
    const onScroll = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight
      if (distance <= 80) stuck.current = true
      else if (container.scrollTop < lastTop.current) stuck.current = false
      lastTop.current = container.scrollTop
    }
    container.addEventListener('scroll', onScroll)
    const observer = new ResizeObserver(() => {
      // Scroll events fire before ResizeObserver callbacks.
      // A pending self-scroll must not detach the thread.
      if (stuck.current) {
        container.scrollTop = container.scrollHeight
        lastTop.current = container.scrollTop
      }
    })
    observer.observe(content)
    observer.observe(container)

    return () => {
      container.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [containerRef, contentRef])

  return { stickToBottom }
}
