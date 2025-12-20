import React, {useRef, useState, useEffect, useMemo} from "react"
import LockModeSwitch from '@/components/switch/LockModeSegmented'
import { ShieldCheck } from 'lucide-react'
import { flushSync } from "react-dom"
type Prof = {
	securityCodeDigits: string
	setSecurityCodeDigits: (val: string) => void
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
					<div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
						<input
							ref={inputRef}
							type="text"
							inputMode="numeric"
							pattern="[0-9]*"
							autoComplete="one-time-code"
							enterKeyHint="done"
							value={isFocused ? securityCodeDigits : formatSecurityCode(securityCodeDigits)}
							onChange={(e) => {
								const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 6)
								setSecurityCodeDigits(onlyDigits)
							}}
							onFocus={() => setIsFocused(true)}
							onBlur={() => setIsFocused(false)}
							className="
								w-full
								bg-transparent
								text-base
								tracking-[0.35em]
								pl-[0.35em]
								text-center
								outline-none
								text-slate-900
								font-mono
							"
							placeholder="•••-•••"
						/>
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
						}
					}}
				/>
				</div>
			</div>
		</div>
	)
}

export default Securitycode