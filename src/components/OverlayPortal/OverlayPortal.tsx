import { useEffect } from "react"
import { createPortal } from "react-dom"

export function OverlayPortal({
  open,
  children
}: {
  open: boolean
  children: React.ReactNode
}) {
  const el = document.getElementById("overlay-root")
  if (!open || !el) return null

  return createPortal(
    <OverlayShell>{children}</OverlayShell>,
    el
  )
}

function OverlayShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prevOverflow = document.documentElement.style.overflow
    const prevOverscroll = document.documentElement.style.overscrollBehavior
    document.documentElement.style.overflow = "hidden"
    document.documentElement.style.overscrollBehavior = "none"

    return () => {
      document.documentElement.style.overflow = prevOverflow
      document.documentElement.style.overscrollBehavior = prevOverscroll
    }
  }, [])

  return (
    <div
      className="
        fixed inset-0 z-[9999]
        h-[100dvh] w-[100dvw]
        overflow-hidden
        "
    >
      {children}
    </div>
  )
}
