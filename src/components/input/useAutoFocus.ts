import { useEffect, useRef } from 'react'

export const useAutoFocus = <T extends HTMLElement>(show: boolean) => {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    if (!show) return

    // 下一帧再 focus，兼容动画 / conditional render
    const id = requestAnimationFrame(() => {
      ref.current?.focus()
    })

    return () => cancelAnimationFrame(id)
  }, [show])

  return ref
}