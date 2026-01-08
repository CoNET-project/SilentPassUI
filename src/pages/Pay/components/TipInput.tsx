import { useEffect, useMemo, useRef, useState } from "react"
import { fiatPrefix, getDecimals } from '@/services/currency'
type TipInputProps = {
	value?: number // tip percent, e.g. 18 means 18%
	onChange?: (v: number) => void
	presets?: number[] // default: [15,18,20,25]
	disabled?: boolean
	className?: string
	// 可选：当用户开始输入自定义值时，是否自动切换到 custom 模式
	autoEnterCustomOnType?: boolean
	currentCurrency: ICurrency
	modeChange: (val: "preset" | "custom") => void
}

export default function TipInput({
	value = 0,
	onChange,
	presets = [10, 15, 18, 20],
	disabled,
	className,
	autoEnterCustomOnType = true,
	currentCurrency,
	modeChange
}: TipInputProps) {
  const safePresets = useMemo(() => {
    const uniq = Array.from(new Set(presets)).filter(n => isFinite(n) && n > 0)
    return uniq.sort((a, b) => a - b)
  }, [presets])

  

  
	const inputRef = useRef<HTMLInputElement | null>(null)
	const [forcedCustom, setForcedCustom] = useState(false)
	const isPresetValue = safePresets.includes(value) && !forcedCustom
	const [mode, setMode] = useState<"preset" | "custom">(isPresetValue ? "preset" : "custom")
	const [customText, setCustomText] = useState(isPresetValue ? "" : String(value))
  	
  	const localCurrency = useMemo(() => {
		return fiatPrefix(currentCurrency)
	}, [currentCurrency])

	useEffect(() => {
		modeChange(mode)
	}, [mode])
	
	useEffect(() => {
		const preset = safePresets.includes(value)

		// ✅ 外部 value 是 preset：允许同步回 preset UI
		if (preset) {
			if (!forcedCustom) {
				setMode("preset")
				setCustomText("")
			}
			return
		}

		// ✅ 外部 value 非 preset：只切到 custom / lock，但不要覆盖正在输入的 customText
		setForcedCustom(true)
		setMode("custom")
	}, [value, safePresets, forcedCustom])

	function commit(v: number) {
		  if (mode === "custom") {
			const amt = Math.max(v, 0) // 金额：只做 >=0（如你想允许空=0）
			onChange?.(Number.isFinite(amt) ? amt : 0)
			return
		}

		// preset：百分比 0-100
		const clamped = Math.min(Math.max(v, 0), 100)
		onChange?.(Number.isFinite(clamped) ? clamped : 0)
	}

	function onPickPreset(p: number) {
		if (disabled) return
		setForcedCustom(false)
		setMode("preset")
		setCustomText("")
		const clamped = Math.min(Math.max(p, 0), 100)
		onChange?.(clamped)
	}

	function onOpenCustom() {
		if (disabled) return
		setForcedCustom(true)
		setMode("custom")
		onChange?.(0)
		requestAnimationFrame(() => inputRef.current?.focus())
	}

	function sanitizePercentText(s: string) {
		const decimals = getDecimals(currentCurrency)
		// 只留数字与一个小数点
		const t = s.replace(/[^\d.]/g, "")
		const parts = t.split(".")
		if (parts.length <= 1) return t
		return `${parts[0]}.${parts.slice(1).join("")}` // 合并多余点
	}

	function parsePercent(s: string) {
			if (!s) return 0
			const n = Number(s)
			return Number.isFinite(n) ? n : 0
		}


	function sanitizeMoneyText(s: string) {
		const decimals = Math.max(0, getDecimals(currentCurrency) || 0)

		// 只留数字与小数点
		const t = s.replace(/[^\d.]/g, "")

		// 去掉多余小数点（只保留第一个）
		const firstDot = t.indexOf(".")
		if (firstDot === -1) return t

		const intPart = t.slice(0, firstDot)
		const fracRaw = t.slice(firstDot + 1).replace(/\./g, "") // 移除后续点
		const frac = fracRaw.slice(0, decimals)

		// decimals=0 时，不允许小数
		return decimals === 0 ? intPart : `${intPart}.${frac}`
	}

	function parseMoney(s: string) {
		if (!s) return 0
		const n = Number(s)
		return Number.isFinite(n) ? n : 0
	}

  const PILL_BASE =
    "relative inline-flex items-center justify-center select-none " +
    "rounded-full px-4 h-10 text-[14px] font-semibold tracking-tight " +
    "transition active:scale-[0.98]"

  // iOS 半透明水滴（glass/droplet）按钮
  const DROPLET =
    "bg-white/55 dark:bg-slate-900/35 backdrop-blur-md " +
    "shadow-[0_10px_30px_rgba(15,23,42,0.10)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] " +
    "ring-1 ring-black/5 dark:ring-white/10 " +
    "before:content-[''] before:absolute before:inset-0 before:rounded-full " +
    "before:bg-[radial-gradient(120%_120%_at_30%_20%,rgba(255,255,255,0.85),rgba(255,255,255,0.10)_55%,transparent_70%)] " +
    "before:pointer-events-none"

  const ACTIVE =
    "text-blue-600 dark:text-blue-300 " +
    "ring-1 ring-blue-500/25 dark:ring-blue-300/25 " +
    "shadow-[0_12px_36px_rgba(37,99,235,0.18)]"

  const INACTIVE = "text-slate-700 dark:text-slate-200"

  const DISABLED = "opacity-50 pointer-events-none"

  return (
    <div className={["w-full", className || ""].join(" ")}>
      {/* label row */}
      {/* <div className="flex items-center justify-between mb-2">
        <div className="text-[13px] text-slate-500 dark:text-slate-400">Tip</div>
        <div className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
          {Math.round(value * 100) / 100}%
        </div>
      </div> */}

      {/* pills */}
      <div className="flex flex-wrap gap-2">
        {safePresets.map(p => {
          const active = mode === "preset" && value === p
          return (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => onPickPreset(p)}
              className={[
                PILL_BASE,
                DROPLET,
                active ? ACTIVE : INACTIVE,
                disabled ? DISABLED : "",
              ].join(" ")}
            >
              <span className="relative z-[1]">{p}%</span>
            </button>
          )
        })}

        {/* Custom pill */}
        <button
          type="button"
          disabled={disabled}
          onClick={onOpenCustom}
          className={[
            PILL_BASE,
            DROPLET,
            mode === "custom" ? ACTIVE : INACTIVE,
            disabled ? DISABLED : "",
          ].join(" ")}
        >
          <span className="relative z-[1]">
            {mode === "custom" ? "Custom" : "Custom"}
          </span>
        </button>
      </div>

      {/* custom input */}
      {mode === "custom" && (
        <div className="mt-3">
          <div
            className="
              flex items-center gap-2
              rounded-[18px]
              bg-white/60 dark:bg-slate-900/35
              backdrop-blur-md
              ring-1 ring-black/5 dark:ring-white/10
              shadow-[0_10px_30px_rgba(15,23,42,0.08)]
              px-4 h-12
            "
          >

			<div className="text-[14px] text-slate-500 dark:text-slate-400">
				{ localCurrency }
			</div>
            {/* <div className="text-[14px] text-slate-500 dark:text-slate-400">%</div> */}

			<input
				ref={inputRef}
				inputMode="decimal"
				placeholder={getDecimals(currentCurrency) > 0 ? "e.g. 2.50" : "e.g. 2"}
				value={customText}
				onChange={e => {
					if (disabled) return
					const s = sanitizeMoneyText(e.currentTarget.value)
					setCustomText(s)

					if (autoEnterCustomOnType && mode !== "custom") setMode("custom")

					// ✅ 输入中间态：先不回传（否则父容器回写会干扰小数点）
					if (s === "" || s === "." || s.endsWith(".")) return

					commit(parseMoney(s))
				}}
				onBlur={() => {
					// 失焦再提交一次，保证最终数值同步
					commit(parseMoney(customText))
				}}
				className="
					flex-1 bg-transparent
					text-[16px] font-semibold
					text-slate-800 dark:text-slate-100
					placeholder:text-slate-400 dark:placeholder:text-slate-500
					focus:outline-none
				"
			/>

            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setCustomText("")
                commit(0)
                requestAnimationFrame(() => inputRef.current?.focus())
              }}
              className="
                h-9 px-3 rounded-full
                bg-black/5 dark:bg-white/10
                text-[13px] font-semibold
                text-slate-600 dark:text-slate-200
                active:scale-[0.98] transition
              "
            >
              Clear
            </button>
          </div>

          {/* <div className="mt-2 text-[12px] text-slate-400 dark:text-slate-500">
            Common in North America: 15–25%. You can enter any number (0–100).
          </div> */}
        </div>
      )}
    </div>
  )
}
