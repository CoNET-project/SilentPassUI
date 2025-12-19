import React, { useEffect, useRef, useState } from "react"

type Phase = "visible" | "pop" | "shrink" | "idle"

function IOSGlassPillButton({
	open,
	onToggle,
	children
}: {
	open: boolean
	onToggle: () => void
	children?: React.ReactNode
}) {
  const [phase, setPhase] = useState<Phase>(open ? "pop" : "visible")

  const t1 = useRef<number | null>(null)
  const t2 = useRef<number | null>(null)

  const clearTimers = () => {
    if (t1.current) window.clearTimeout(t1.current)
    if (t2.current) window.clearTimeout(t2.current)
    t1.current = null
    t2.current = null
  }

  // 监听 open：open=true 启动动画；open=false 解除 idle 显示按钮
  useEffect(() => {
    clearTimers()

    // open=false：解除 idle，显示按钮（不做“出现动画”）
    if (!open) {
      setPhase("visible")
      return
    }

    // open=true：从 visible 启动一次动画（如果已经在动画/idle，就不重复启动）
    setPhase(prev => {
      if (prev !== "visible") return prev

      // 1) pop（快速到 1.5x）
      t1.current = window.setTimeout(() => {
        setPhase("shrink") // 2) shrink（缓慢缩到 0.5 + fade）
      }, 90)

      // 3) 结束后进入 idle（隐藏）
      t2.current = window.setTimeout(() => {
        setPhase("idle")
      }, 90 + 350)

      return "pop"
    })

    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => () => clearTimers(), [])

  // ✅ idle：按钮不显示
  if (phase === "idle") return null

  const clickable = !open && phase === "visible"

  return (
	<div className="relative flex-none">
    <button
      type="button"
      onClick={() => {
        if (!clickable) return
        onToggle() // 让外部把 open 设为 true，动画由 open=true 驱动
      }}
      className={`
        relative inline-flex items-center justify-center gap-1.5
        rounded-full px-3.5 py-2
        text-[12px] font-semibold tracking-wide
        text-slate-900
        select-none origin-center
        backdrop-blur-xl
        shadow-[0_8px_20px_rgba(15,23,42,0.10)]

        ${clickable ? "cursor-pointer" : "cursor-default pointer-events-none"}

        transition-[transform,opacity]
        ${phase === "visible" ? "transition-none scale-100 opacity-100" : ""}
        ${phase === "pop" ? "scale-[1.5] opacity-100 duration-100 ease-out" : ""}
        ${phase === "shrink" ? "scale-[0.5] opacity-0 duration-350 ease-[0.2,0.8,0.2,1]" : ""}
      `}
      style={{
			/* ✅ 只有：透明 + 模糊 */
			WebkitBackdropFilter: "blur(16px) saturate(160%)",
			backdropFilter: "blur(16px) saturate(160%)",

			/* ✅ 纯透明底（无渐变、无高光） */
			background: "rgba(255,255,255,0.10)",

			/* ✅ iOS 风格细边框 */
			border: "1px solid rgba(255,255,255,0.8)"
      }}
    >

      <span className="relative z-10 inline-flex items-center gap-1.5">
        {children}
      </span>
    </button>
	</div>
  )
}

export default IOSGlassPillButton
