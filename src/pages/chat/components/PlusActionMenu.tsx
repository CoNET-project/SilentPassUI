import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react"
import type { LucideIcon } from "lucide-react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Camera, Image as ImageIcon, Sticker, BarChart3, Mic, Clock } from "lucide-react"

type ActionKey = "camera" | "photos" | "stickers" | "polls" | "audio" | "later"

type MenuItem = {
  key: ActionKey
  label: string
  Icon: LucideIcon
  onClick?: () => void
}

type Props = {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement>
  items?: MenuItem[]
}

const DEFAULT_ITEMS: MenuItem[] = [
  { key: "camera", label: "Camera", Icon: Camera },
  { key: "photos", label: "Photos", Icon: ImageIcon },
  { key: "stickers", label: "Stickers", Icon: Sticker },
  { key: "polls", label: "Polls", Icon: BarChart3 },
  { key: "audio", label: "Audio", Icon: Mic },
  { key: "later", label: "Send Later", Icon: Clock }
]

type Pos = {
  top: number
  left: number
  originX: number
  originY: number
  width: number
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function PlusActionMenu({ open, onClose, anchorRef, items = DEFAULT_ITEMS }: Props) {
  const [pos, setPos] = useState<Pos | null>(null)

  // ✅ hooks 必须无条件调用：menuRef 放这里
  const menuRef = useRef<HTMLDivElement | null>(null)

  const overlayRoot = useMemo(() => {
    return document.getElementById("overlay-root") || document.body
  }, [])

  const measure = useCallback(() => {
    const el = anchorRef.current
    if (!el) return

    const r = el.getBoundingClientRect()

    const measuredH = menuRef.current?.getBoundingClientRect().height
    const menuH = measuredH && measuredH > 0 ? measuredH : 48 + items.length * 56

    const menuW = 300
    const safeTop = 10
    const safeBottom = 10

    const left = clamp(
      r.left + r.width / 2 - menuW / 2,
      10,
      window.innerWidth - menuW - 10
    )

    // ✅ 关键：菜单 bottom 在按钮上方 10px
    const desiredTop = (r.top - 10) - menuH

    const top = clamp(
      desiredTop,
      safeTop,
      window.innerHeight - safeBottom - menuH
    )

    const originX = clamp(r.left + r.width / 2 - left, 16, menuW - 16)
    const originY = clamp(r.top + r.height / 2 - top, 16, menuH - 16)

    setPos({ top, left, originX, originY, width: menuW })
  }, [anchorRef, items.length])

  // ✅ open 时：两帧测量（第一次渲染，第二次拿到真实高度）
  useLayoutEffect(() => {
	if (!open) {
		setReady(false)
		setPos(null)
		return
	  }
	
	  setReady(false)
	
	  requestAnimationFrame(() => {
		measure()
		requestAnimationFrame(() => {
		  measure()
		  setReady(true)
		})
	  })
  }, [open, measure])

  useEffect(() => {
    if (!open) return

    const onResize = () => measure()
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onResize, true)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)

    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onResize, true)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose, measure])
  const [ready, setReady] = useState(false)

  // ✅ 这行可以保留（不会导致 hooks 条件调用，因为 hooks 都在前面了）
  if (!overlayRoot) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[9998] bg-black/0"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

			<motion.div
			ref={menuRef}
			className={[
				"fixed z-[9999]",
				"rounded-[26px]",

				// ✅ 背景：白色 10% 透明
				"bg-white/80",

				// ✅ 强模糊（iOS 菜单核心）
				"backdrop-blur-[5px]",
				"supports-[backdrop-filter]:bg-white/50",

				// ✅ 细边框（玻璃边缘）
				"ring-1 ring-white/80",

				// ✅ 多层 shadow（悬浮感）
				"shadow-[\
					0_24px_80px_rgba(15,23,42,0.28),\
					0_8px_24px_rgba(15,23,42,0.18),\
					inset_0_1px_0_rgba(255,255,255,0.35)\
				]",

				"overflow-hidden"
			].join(" ")}
			style={{
				top: pos?.top ?? -9999,
				left: pos?.left ?? -9999,
				width: pos?.width ?? 300,
				transformOrigin: pos
				? `${pos.originX}px ${pos.originY}px`
				: "50% 100%"
			}}
			initial={false}
			animate={
				ready
				? { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }
				: { opacity: 0, scale: 0.98, y: 0, filter: "blur(3px)" }
			}
			exit={{ opacity: 0, scale: 0.22, y: 8, filter: "blur(3px)" }}
			transition={{ type: "spring", stiffness: 560, damping: 42, mass: 0.9 }}
			>
            <div className="py-2">
              {items.map((it, idx) => (
                <motion.button
                  key={it.key}
                  type="button"
                  className={[
                    "w-full px-4 py-3",
                    "flex items-center gap-3",
                    "text-left",
                    "transition",
                    "active:bg-black/5 hover:bg-black/5"
                  ].join(" ")}
                  onClick={() => {
                    it.onClick?.()
                    onClose()
                  }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ delay: 0.03 + idx * 0.02, duration: 0.16 }}
                >
                  <span
                    className={[
                      "h-10 w-10 rounded-full",
                      "bg-white/70",
                      "ring-1 ring-black/5",
                      "grid place-items-center",
                      "shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                    ].join(" ")}
                  >
                    <it.Icon className="h-5 w-5 text-slate-700" strokeWidth={2.2} />
                  </span>

                  <span className="text-[20px] leading-[24px] font-semibold text-slate-900">
                    {it.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    overlayRoot
  )
}
