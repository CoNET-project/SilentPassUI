import React, {useRef, useState, useEffect, useMemo} from "react"
import LockModeSwitch from '@/components/switch/LockModeSegmented'
import { ShieldCheck } from 'lucide-react'
import { flushSync } from "react-dom"
type Prof = {
	securityCodeDigits: string
	setSecurityCodeDigits: (val: string) => void
}

function clampDigits(v: string) {
  return v.replace(/\D/g, "").slice(0, 6)
}

const formatSecurityCode = (value: string) => {
	// 只保留数字
	const digits = value.replace(/\D/g, "").slice(0, 6)

	// 分成两段
	const left = digits.slice(0, 3).padEnd(3, "•")
	const right = digits.slice(3, 6).padEnd(3, "•")

	return `${left}-${right}`
}


const Securitycode = ({securityCodeDigits, setSecurityCodeDigits}: Prof) => {

	const [isFocused, setIsFocused] = useState(false)
	const [securityOn, setSecurityOn] = useState(false)
	const inputRef = useRef<HTMLInputElement | null>(null)

	const [hasError, setHasError] = useState(false)
	const digits = useMemo(() => clampDigits(securityCodeDigits), [securityCodeDigits])

	const activeIndex = useMemo(() => {
		
		// 当前应该输入的格子：0..5
		const idx = Math.min(digits.length, 5)
		return idx
	}, [digits.length])

	const focusOtp = () => {
		if (!securityOn) return
		inputRef.current?.focus()
	}


	return (
		<div className="pt-2 mb-4 w-full">
			<div className="flex w-full items-center gap-3">
				{/* 左：Icon 永远左对齐 */}
				<ShieldCheck
					className={
						`w-5 h-5 flex-shrink-0 ${
						securityOn
							? "text-red-500/80"
							: "text-slate-400/50"
						}`
					}
				/>

				{/* 中：Input 区域，自适应剩余宽度；不可见也占位但不影响两端对齐 */}
				<div className="flex-1 min-w-0">
				{securityOn ? (
					<div
						className={`
							rounded-2xl border bg-slate-50 px-3.5 py-3
							${hasError ? "border-rose-400/80" : "border-slate-200"}
						`}
						>
						{/* ✅ 6 格展示（外层可点，点任何位置都会 focus 到隐藏 input） */}
						<button
							type="button"
							onClick={focusOtp}
							className="w-full"
						>
							<div className="grid grid-cols-6 gap-2">
							{Array.from({ length: 6 }).map((_, i) => {
								const ch = digits[i] ?? ""
								const isActive = isFocused && i === activeIndex && digits.length < 6

								return (
								<div
									key={i}
									className={`
									h-10 rounded-xl
									flex items-center justify-center
									font-mono text-[16px] tabular-nums
									transition
									${hasError ? "text-rose-600" : "text-slate-900"}
									${ch ? "bg-white/60" : "bg-white/30"}
									${isActive ? "ring-2 ring-sky-300/80 bg-white" : "ring-0"}
									`}
								>
									{ch ? ch : <span className="text-slate-300 select-none">•</span>}
								</div>
								)
							})}
							</div>
						</button>

						{/* ✅ 真实 input：iOS one-time-code 依赖它（隐藏但可 focus / autofill） */}
						<input
							ref={inputRef}
							type="text"
							inputMode="numeric"
							pattern="[0-9]*"
							autoComplete="one-time-code"
							enterKeyHint="done"
							aria-label="Security code"
							value={digits}
							onChange={(e) => {
								const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 6)
								setSecurityCodeDigits(onlyDigits)
								if (onlyDigits.length === 6) setHasError(false)
							}}
							onFocus={() => {
								setIsFocused(true)
								setHasError(false)
							}}
							onBlur={() => {
								setIsFocused(false)
								if (digits.length > 0 && digits.length < 6) {
									setHasError(true)
								}
							}}
							className="
								absolute
								opacity-0
								pointer-events-none
								w-px h-px
								-z-10
								left-0 top-0
								caret-transparent
								selection:bg-transparent
							"
						/>

						{/* ✅ 不满 6 位的错误提示（最小侵入） */}
						{hasError && (
							<p className="mt-1 text-[11px] text-rose-500 text-center">
								Enter 6-digit security code
							</p>
						)}
						</div>
				) : (
					// 关闭时：可选的占位（不想显示就留空也行）
					<div className="text-left">
						<div className="text-sm font-semibold text-slate-900">Security code</div>
						<div className="text-xs text-slate-500">Optional · 6 digits (123-456)</div>
					</div>
				)}
				</div>

				{/* 右：Switch 永远右对齐 */}
				<div className="flex-shrink-0">
				<LockModeSwitch
					value={securityOn}
					onChange={() => {
						if (!securityOn) {
							// ✅ 在同一次用户手势里：先把 securityOn 变 true，让 input 挂载
							flushSync(() => setSecurityOn(true))
							// ✅ 然后立刻 focus（此时 input 已经在 DOM 里）
							inputRef.current?.focus()
						} else {
							setSecurityOn(false)
							setSecurityCodeDigits('')
							setHasError(false)
						}
					}}
				/>
				</div>
			</div>
		</div>
	)
}

export default Securitycode