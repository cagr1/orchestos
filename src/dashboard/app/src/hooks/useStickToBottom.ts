import { type RefObject, useCallback, useEffect, useRef } from 'react'

export function useStickToBottom(
  containerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
) {
  const stuck = useRef(true)

  const stickToBottom = useCallback(() => {
    stuck.current = true
    const container = containerRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [containerRef])

  useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    const onScroll = () => {
      stuck.current = container.scrollHeight - container.scrollTop - container.clientHeight <= 80
    }
    container.addEventListener('scroll', onScroll)
    const observer = new ResizeObserver(() => {
      if (stuck.current) container.scrollTop = container.scrollHeight
    })
    observer.observe(content)

    return () => {
      container.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [containerRef, contentRef])

  return { stickToBottom }
}
