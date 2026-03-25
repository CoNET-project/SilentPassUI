import React from 'react'
import { Check, Wallet, Store, CreditCard, Shield, ArrowRight } from 'lucide-react'

type WalletReadyScreenProps = {
	/** 保留兼容 LoadingPage 传参；新布局不展示余额 */
	usdcBalance?: string
	onGoToHome: () => void
	address?: string
	balanceFiat?: string
	/** 用于头像首字与 @handle 胶囊，如 alex.tag → @alex.tag */
	beamioTag?: string
}

const LIME = '#A3E635'

/**
 * Master Key / 恢复流程后：账户已创建，引导进入 CashTrees 前激活 Smart Account
 */
export default function WalletReadyScreen({
	onGoToHome,
	beamioTag,
}: WalletReadyScreenProps) {
	const handle = (beamioTag || '').replace(/^@/, '').trim()
	const displayHandle = handle ? `@${handle}` : '@beamio'
	const initial = (handle.charAt(0) || 'B').toUpperCase()

	return (
		<div
			className="box-border flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#F7F8FA] px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] dark:bg-slate-950"
			style={{ height: '100dvh', maxHeight: '100dvh' }}
		>
			<div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col">
				{/* Success header */}
				<div className="flex shrink-0 flex-col items-center text-center">
					<div
						className="mb-3 flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full sm:mb-4 sm:h-[4.5rem] sm:w-[4.5rem] dark:shadow-[0_0_0_8px_rgba(163,230,53,0.15),0_12px_40px_rgba(163,230,53,0.2)]"
						style={{
							backgroundColor: LIME,
							boxShadow: `0 0 0 8px rgba(163, 230, 53, 0.2), 0 12px 40px rgba(163, 230, 53, 0.35)`,
						}}
					>
						<Check size={32} strokeWidth={3.5} className="text-[#0F172A]" aria-hidden />
					</div>
					<h1
						className="text-xl font-bold leading-tight tracking-tight text-[#0F172A] sm:text-[1.75rem] dark:text-slate-100"
					>
						Account Created
					</h1>
					<p className="mt-2 max-w-[280px] text-[15px] font-medium leading-snug text-slate-500 dark:text-slate-400">
						Your secure identity is ready to use.
					</p>
				</div>

				{/* Profile pill */}
				<div className="mt-3 flex shrink-0 justify-center sm:mt-5">
					<div
						className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white py-2.5 pl-2.5 pr-5 shadow-sm dark:border-slate-600 dark:bg-slate-800"
						style={{ boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)' }}
					>
						<div
							className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
							style={{ backgroundColor: LIME }}
							aria-hidden
						>
							{initial}
						</div>
						<span className="text-base font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
							{displayHandle}
						</span>
					</div>
				</div>

				{/* Activation card — flex-1 + inner scroll so the viewport never gains a page scrollbar */}
				<div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-800/90 dark:shadow-xl sm:mt-5">
					<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 py-4 sm:px-6 sm:py-5">
						<div className="mx-auto mb-3 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-200 bg-slate-50 sm:mb-4 sm:h-[4.5rem] sm:w-[4.5rem] dark:border-slate-600 dark:bg-slate-900/50">
							<Wallet className="h-7 w-7 text-slate-400 sm:h-8 sm:w-8 dark:text-slate-500" strokeWidth={1.75} aria-hidden />
						</div>
						<h2 className="shrink-0 text-center text-base font-bold text-[#0F172A] sm:text-lg dark:text-slate-100">
							Next: Activate Wallet
						</h2>
						<p className="mx-auto mt-2 max-w-[300px] shrink-0 text-center text-[13px] leading-snug text-slate-500 sm:mt-3 sm:text-[14px] sm:leading-relaxed dark:text-slate-400">
							To deploy your Smart Account on the network, you&apos;ll need to complete a quick setup inside the app:
						</p>

						<ul className="mt-3 flex shrink-0 flex-col gap-2 sm:mt-4 sm:gap-3">
						<li className="flex items-center gap-3 rounded-2xl bg-slate-100/90 px-3 py-2.5 sm:px-4 sm:py-3.5 dark:bg-slate-900/60">
							<span
								className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full dark:bg-lime-400/20"
								style={{ backgroundColor: `${LIME}33` }}
							>
								<Store
									className="h-[18px] w-[18px] text-[#4d7c0f] dark:text-lime-300"
									strokeWidth={2.2}
									aria-hidden
								/>
							</span>
							<span className="text-left text-[14px] font-semibold text-slate-800 dark:text-slate-200">
								Load cash at any Alliance Store
							</span>
						</li>
						<li className="flex items-center gap-3 rounded-2xl bg-slate-100/90 px-3 py-2.5 sm:px-4 sm:py-3.5 dark:bg-slate-900/60">
							<span
								className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full dark:bg-lime-400/20"
								style={{ backgroundColor: `${LIME}33` }}
							>
								<CreditCard
									className="h-[18px] w-[18px] text-[#4d7c0f] dark:text-lime-300"
									strokeWidth={2.2}
									aria-hidden
								/>
							</span>
							<span className="text-left text-[14px] font-semibold text-slate-800 dark:text-slate-200">
								Or sync a pre-funded physical card
							</span>
						</li>
						</ul>
					</div>

					<div className="shrink-0 border-t border-slate-100/80 px-5 py-3 dark:border-slate-700/80 sm:px-6 sm:py-3.5">
						<div
							className="flex items-center justify-center gap-2 rounded-xl py-2 dark:bg-lime-400/15 sm:py-2.5"
							style={{ backgroundColor: `${LIME}26` }}
						>
							<Shield
								className="h-4 w-4 shrink-0 text-[#3f6212] dark:text-lime-400"
								strokeWidth={2.5}
								aria-hidden
							/>
							<span className="text-[11px] font-bold tracking-widest text-[#3f6212] dark:text-lime-300">
								ZERO SETUP FEES
							</span>
						</div>
					</div>
				</div>

				<div className="mt-3 shrink-0 sm:mt-4">
					<button
						type="button"
						onClick={onGoToHome}
						className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0F172A] text-[17px] font-bold text-white shadow-[0_12px_32px_rgba(15,23,42,0.25)] transition-transform active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:shadow-lg"
					>
						Enter CashTrees
						<ArrowRight className="h-5 w-5" strokeWidth={2.5} aria-hidden />
					</button>
				</div>
			</div>
		</div>
	)
}
