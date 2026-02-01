import React, { useEffect, useState } from "react"
import { Lock, Globe, ShieldCheck } from "lucide-react"

type CardPurchaseProcessingProps = {
	/** 进度 0–1，不传则模拟自动增长 */
	progress?: number
	/** 是否显示为完成（可传给父组件用于跳转） */
	onComplete?: () => void
}

export default function CardPurchaseProcessing({
	progress: progressProp,
	onComplete,
}: CardPurchaseProcessingProps) {
	const [internalProgress, setInternalProgress] = useState(0)
	const progress = progressProp ?? internalProgress

	// 每 200ms +0.005，约 40s 到 100%
	useEffect(() => {
		if (progressProp != null) return
		const t = setInterval(() => {
			setInternalProgress((p) => {
				if (p >= 1) {
					clearInterval(t)
					onComplete?.()
					return 1
				}
				return Math.min(1, p + 0.005)
			})
		}, 200)
		return () => clearInterval(t)
	}, [progressProp, onComplete])

	const percent = Math.round(progress * 100)
	const strokeDashoffset = 283 - 283 * progress // 近似圆周长 2*π*45

	return (
		<div className="w-full h-full min-h-0 bg-white flex flex-col overflow-hidden">
			<div
				className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-6 py-8"
				style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
			>
			{/* 圆形进度 + 锁图标 */}
			<div className="relative w-32 h-32 flex-shrink-0">
				<svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
					{/* 底色圆环 */}
					<circle
						cx="50"
						cy="50"
						r="45"
						fill="none"
						stroke="currentColor"
						strokeWidth="6"
						className="text-blue-100"
					/>
					{/* 进度圆环 */}
					<circle
						cx="50"
						cy="50"
						r="45"
						fill="none"
						stroke="currentColor"
						strokeWidth="6"
						strokeLinecap="round"
						strokeDasharray="283"
						strokeDashoffset={strokeDashoffset}
						className="text-blue-600 transition-[stroke-dashoffset] duration-300"
					/>
				</svg>
				<div className="absolute inset-0 flex items-center justify-center">
					<Lock className="w-8 h-8 text-blue-600" strokeWidth={2.5} />
				</div>
			</div>

			{/* 标题 */}
			<h1 className="mt-8 text-[22px] font-bold text-slate-900 text-center">
				Processing Payment
			</h1>

			{/* 副标题：100% 后仍显示时改为 “Completing the transaction” */}
			<p className="mt-3 text-[15px] text-slate-500 text-center max-w-[280px]">
				{progress >= 1 ? "Completing the transaction" : "Please wait while we confirm your transaction..."}
			</p>

			{/* Base Network 标签 */}
			<div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600">
				<Globe className="w-4 h-4 shrink-0" strokeWidth={2} />
				<span className="text-[14px] font-semibold">Base Network</span>
			</div>

			{/* 横向进度条 */}
			<div className="mt-8 w-full max-w-[280px]">
				<div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
					<div
						className="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out"
						style={{ width: `${percent}%` }}
					/>
				</div>
			</div>

			{/* 底部安全提示 */}
			<div className="mt-8 flex items-center justify-center gap-2 text-slate-400 pb-8">
				<ShieldCheck className="w-4 h-4 shrink-0" strokeWidth={2} />
				<span className="text-[11px] font-semibold tracking-wider uppercase">
					Secure Encrypted Transaction
				</span>
			</div>
			</div>
		</div>
	)
}
