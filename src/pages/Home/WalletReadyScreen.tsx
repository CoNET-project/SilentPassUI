import React, { useEffect, useState } from 'react'
import { QrCode, Nfc, ChevronRight, Info } from 'lucide-react'
import { detectDeviceNfcCapability } from '@/utils/cashTreesNativeNfc'

type WalletReadyScreenProps = {
	/** 保留兼容 LoadingPage 传参 */
	usdcBalance?: string
	/** Show to Cashier：进首页并突出 Activate Wallet（收银员充值 QR） */
	onCashierTopUp: () => void
	/**
	 * Tap NFC: go Home then start physical bind; after SUN read, client calls `postNfcLinkApp` then
	 * `postNfcLinkAppClaimWithKey` (EOA privateKey → `POST /api/nfcLinkAppClaimWithKey`) to finish binding.
	 */
	onNfcSync: () => void
	/** Close and finish later */
	onFinishLater: () => void
	address?: string
	balanceFiat?: string
	beamioTag?: string
}

/**
 * Onboarding 最后一屏 — lastStep.htm：模糊主页 + 玻璃底表「ONE LAST STEP」
 */
export default function WalletReadyScreen({
	onCashierTopUp,
	onNfcSync,
	onFinishLater,
	beamioTag,
	usdcBalance = '0',
	balanceFiat,
}: WalletReadyScreenProps) {
	const [deviceHasNfc, setDeviceHasNfc] = useState(() =>
		typeof window !== 'undefined' ? detectDeviceNfcCapability() : false
	)
	useEffect(() => {
		const run = () => setDeviceHasNfc(detectDeviceNfcCapability())
		run()
		const t = window.setTimeout(run, 0)
		return () => clearTimeout(t)
	}, [])

	const handle = (beamioTag || '').replace(/^@/, '').trim()
	const displayHandle = handle ? `@${handle}` : 'you'
	const mockBalance =
		balanceFiat && balanceFiat.trim().length > 0
			? balanceFiat
			: `$${usdcBalance}`.replace(/^\$\$/, '$')

	return (
		<div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f9f9fe] text-[#1a1c1f]">
			{/* Blurred mock home (lastStep background) */}
			<div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
				<div className="h-full min-h-[120%] origin-top scale-105 opacity-40 blur-xl">
					<header className="flex items-center justify-between px-6 py-4">
						<div className="text-lg font-bold tracking-tighter">Digital Wallet</div>
						<div className="h-10 w-10 rounded-full bg-[#e2e2e7]" />
					</header>
					<main className="space-y-8 px-6">
						<div className="flex h-48 flex-col justify-between rounded-lg bg-gradient-to-br from-[#004bc3] to-[#1562f0] p-6">
							<div className="text-sm text-white/80">Main Account</div>
							<div className="text-4xl font-bold tabular-nums text-white">{mockBalance}</div>
						</div>
						<div className="grid grid-cols-2 gap-4">
							{[0, 1, 2, 3].map((i) => (
								<div key={i} className="h-32 rounded-lg bg-[#f3f3f8]" />
							))}
						</div>
					</main>
				</div>
			</div>

			<div className="pointer-events-none fixed top-20 right-[-100px] -z-10 h-80 w-80 rounded-full bg-[#004bc3]/5 blur-[100px]" aria-hidden />
			<div className="pointer-events-none fixed bottom-20 left-[-100px] -z-10 h-80 w-80 rounded-full bg-[#465c99]/5 blur-[100px]" aria-hidden />

			{/* Activation overlay + glass sheet */}
			<div className="absolute inset-0 z-10 flex items-end justify-center bg-[#1a1c1f]/5 backdrop-blur-[2px] md:items-center md:p-6">
				<div
					className="flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-white/20 bg-[#f9f9fe]/80 shadow-[0_4px_32px_rgba(0,0,0,0.08)] backdrop-blur-2xl md:rounded-lg"
					style={{ WebkitBackdropFilter: 'blur(24px)' }}
				>
					<div className="flex w-full justify-center pt-4 md:hidden">
						<div className="h-1.5 w-10 rounded-full bg-[#e2e2e7]" />
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 pb-10 pt-8">
						<div className="space-y-10">
							<div className="space-y-2 text-center md:text-left">
								<span className="inline-block rounded-full bg-[#004bc3]/10 px-3 py-1 text-[10px] font-extrabold tracking-[0.2em] text-[#004bc3]">
									STEP 05 • FINAL
								</span>
								<h1 className="text-4xl font-extrabold uppercase leading-tight tracking-tight text-[#1a1c1f]">
									One last step
								</h1>
								<p className="text-lg leading-relaxed text-[#424655]">Activate Your Digital Wallet</p>
								<p className="text-center text-sm font-medium text-[#424655] md:text-left">
									Signed in as <span className="font-bold text-[#004bc3]">{displayHandle}</span>
								</p>
							</div>

							<div className="grid grid-cols-1 gap-6">
								<button
									type="button"
									onClick={onCashierTopUp}
									className="group relative flex items-center rounded-lg bg-white p-6 text-left transition-all duration-300 hover:bg-[#f9f9fe] hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/35"
								>
									<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#f3f3f8] text-[#004bc3] transition-transform duration-300 group-hover:scale-110">
										<QrCode className="h-9 w-9" strokeWidth={2} aria-hidden />
									</div>
									<div className="ml-6 min-w-0 flex-1">
										<h3 className="text-lg font-bold text-[#1a1c1f]">
											Show to Cashier to Top up
										</h3>
										<p className="mt-1 text-sm leading-snug text-[#424655]">
											Generate a unique code for physical terminal verification.
										</p>
									</div>
									<div className="ml-4 shrink-0 text-[#c3c6d8] transition-colors group-hover:text-[#004bc3]">
										<ChevronRight className="h-7 w-7" strokeWidth={2} aria-hidden />
									</div>
								</button>

								{deviceHasNfc ? (
									<button
										type="button"
										onClick={onNfcSync}
										className="group relative flex items-center rounded-lg bg-white p-6 text-left transition-all duration-300 hover:bg-[#f9f9fe] hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/35"
									>
										<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#f3f3f8] text-[#004bc3] transition-transform duration-300 group-hover:scale-110">
											<Nfc className="h-9 w-9" strokeWidth={2} aria-hidden />
										</div>
										<div className="ml-6 min-w-0 flex-1">
											<h3 className="text-lg font-bold text-[#1a1c1f]">Tap NFC Key to Sync</h3>
											<p className="mt-1 text-sm leading-snug text-[#424655]">
												Hold your device near the Verra station to auto-link.
											</p>
										</div>
										<div className="ml-4 shrink-0 text-[#c3c6d8] transition-colors group-hover:text-[#004bc3]">
											<ChevronRight className="h-7 w-7" strokeWidth={2} aria-hidden />
										</div>
									</button>
								) : null}
							</div>

							<div className="flex items-start gap-4 rounded-lg bg-[#f3f3f8] p-6">
								<Info className="h-6 w-6 shrink-0 text-[#004bc3]" strokeWidth={2} aria-hidden />
								<p className="text-[13px] leading-relaxed text-[#424655]">
									Your wallet remains inactive for security until a hardware connection is established. This ensures only
									you can access your encrypted assets.
								</p>
							</div>

							<div className="flex justify-center pt-2">
								<button
									type="button"
									onClick={onFinishLater}
									className="rounded-full px-6 py-2 text-sm font-medium text-[#424655] transition-colors hover:bg-[#e8e8ed] hover:text-[#1a1c1f]"
								>
									Close and finish later
								</button>
							</div>
						</div>
					</div>

					<div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-[#004bc3] via-[#1562f0] to-[#465c99]" />
				</div>
			</div>
		</div>
	)
}