import React, { useEffect, useState } from 'react'
import { QrCode, Nfc, ChevronRight, Info, Gift } from 'lucide-react'
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
	/** Redeem Gift Voucher: enter the existing voucher scan/redeem area */
	onRedeemGiftVoucher: () => void
	/** Close and finish later */
	onFinishLater: () => void
	address?: string
	balanceFiat?: string
	beamioTag?: string
}

/**
 * Onboarding 最后一屏 — 使用 createBeamioTag.html 的全屏 Beamio 视觉语言。
 */
export default function WalletReadyScreen({
	onCashierTopUp,
	onNfcSync,
	onRedeemGiftVoucher,
	onFinishLater,
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

	return (
		<div className="relative h-full min-h-0 overflow-hidden bg-[#f9f9fe] font-[Inter,system-ui,sans-serif] text-[#1a1c1f] selection:bg-[#004bc3]/20">
			<div className="pointer-events-none fixed inset-0 z-0 scale-105 overflow-hidden opacity-40 blur-xl">
				<header className="flex items-center justify-between px-6 py-4">
					<div className="text-lg font-bold tracking-tighter">Digital Wallet</div>
					<div className="h-10 w-10 rounded-full bg-[#e2e2e7]" />
				</header>
				<main className="space-y-8 px-6">
					<div className="flex h-48 flex-col justify-between rounded-lg bg-gradient-to-br from-[#004bc3] to-[#1562f0] p-6">
						<div className="text-sm text-white/80">Main Account</div>
						<div className="text-4xl font-bold text-white">$12,450.00</div>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="h-32 rounded-lg bg-[#f3f3f8]" />
						<div className="h-32 rounded-lg bg-[#f3f3f8]" />
						<div className="h-32 rounded-lg bg-[#f3f3f8]" />
						<div className="h-32 rounded-lg bg-[#f3f3f8]" />
					</div>
				</main>
			</div>

			<div className="fixed inset-0 z-40 flex items-end justify-center bg-[#1a1c1f]/5 p-0 backdrop-blur-[2px] md:items-center md:p-6">
				<div className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-t-[3rem] border border-white/20 bg-[#f9f9fe]/80 shadow-[0_4px_32px_rgba(0,0,0,0.08)] backdrop-blur-2xl md:rounded-[2rem]">
					<div className="flex w-full shrink-0 justify-center pt-4 md:hidden">
						<div className="h-1.5 w-10 rounded-full bg-[#e2e2e7]" />
					</div>

					<div className="min-h-0 flex-1 space-y-10 overflow-y-auto px-8 pb-12 pt-8 [@media(max-height:760px)]:space-y-7 [@media(max-height:760px)]:pb-8 [@media(max-height:760px)]:pt-6">
						<div className="space-y-2 text-center md:text-left">
							<span className="inline-block rounded-full bg-[#004bc3]/10 px-3 py-1 text-[10px] font-extrabold tracking-[0.2em] text-[#004bc3]">
								STEP 05 • FINAL
							</span>
							<h1 className="text-4xl font-extrabold uppercase leading-tight tracking-tight text-[#1a1c1f] [@media(max-height:760px)]:text-3xl">
								ONE LAST STEP
							</h1>
							<p className="text-lg leading-relaxed text-[#424655] [@media(max-height:760px)]:text-base">
								Activate Your Digital Wallet
							</p>
						</div>

						<div className="grid grid-cols-1 gap-6 [@media(max-height:760px)]:gap-4">
							<button
								type="button"
								onClick={onCashierTopUp}
								className="group relative flex items-center rounded-lg bg-white p-6 text-left transition-all duration-300 hover:bg-[#f9f9fe] hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/35 [@media(max-height:760px)]:p-5"
							>
								<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#f3f3f8] text-[#004bc3] transition-transform duration-300 group-hover:scale-110 [@media(max-height:760px)]:h-14 [@media(max-height:760px)]:w-14">
									<QrCode className="h-10 w-10 [@media(max-height:760px)]:h-8 [@media(max-height:760px)]:w-8" strokeWidth={2} aria-hidden />
								</div>
								<div className="ml-6 min-w-0 flex-1">
									<h3 className="text-lg font-bold text-[#1a1c1f]">Show to Cashier to Top up</h3>
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
									className="group relative flex items-center rounded-lg bg-white p-6 text-left transition-all duration-300 hover:bg-[#f9f9fe] hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/35 [@media(max-height:760px)]:p-5"
								>
									<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#f3f3f8] text-[#004bc3] transition-transform duration-300 group-hover:scale-110 [@media(max-height:760px)]:h-14 [@media(max-height:760px)]:w-14">
										<Nfc className="h-10 w-10 [@media(max-height:760px)]:h-8 [@media(max-height:760px)]:w-8" strokeWidth={2} aria-hidden />
									</div>
									<div className="ml-6 min-w-0 flex-1">
										<h3 className="text-lg font-bold text-[#1a1c1f]">Tap NFC Key to Sync</h3>
										<p className="mt-1 text-sm leading-snug text-[#424655]">
											Hold your device near the Beamio station to auto-link.
										</p>
									</div>
									<div className="ml-4 shrink-0 text-[#c3c6d8] transition-colors group-hover:text-[#004bc3]">
										<ChevronRight className="h-7 w-7" strokeWidth={2} aria-hidden />
									</div>
								</button>
							) : null}

							<button
								type="button"
								onClick={onRedeemGiftVoucher}
								className="group relative flex items-center rounded-lg bg-white p-6 text-left transition-all duration-300 hover:bg-[#f9f9fe] hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/35 [@media(max-height:760px)]:p-5"
							>
								<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#f3f3f8] text-[#004bc3] transition-transform duration-300 group-hover:scale-110 [@media(max-height:760px)]:h-14 [@media(max-height:760px)]:w-14">
									<Gift className="h-10 w-10 [@media(max-height:760px)]:h-8 [@media(max-height:760px)]:w-8" strokeWidth={2} aria-hidden />
								</div>
								<div className="ml-6 min-w-0 flex-1">
									<h3 className="text-lg font-bold text-[#1a1c1f]">Redeem Gift Voucher</h3>
									<p className="mt-1 text-sm leading-snug text-[#424655]">
										Activate your account using a gift link or by scanning a voucher QR code.
									</p>
								</div>
								<div className="ml-4 shrink-0 text-[#c3c6d8] transition-colors group-hover:text-[#004bc3]">
									<ChevronRight className="h-7 w-7" strokeWidth={2} aria-hidden />
								</div>
							</button>
						</div>

						<div className="flex items-start gap-4 rounded-lg bg-[#f3f3f8] p-6">
							<Info className="h-6 w-6 shrink-0 text-[#004bc3]" strokeWidth={2} aria-hidden />
							<p className="text-[13px] leading-relaxed text-[#424655]">
								Your wallet remains inactive for security until a hardware connection is established. This ensures only you can access your encrypted assets.
							</p>
						</div>

						<div className="flex justify-center pt-2">
							<button
								type="button"
								onClick={onFinishLater}
								className="rounded-full px-6 py-2 text-sm font-medium text-[#424655] transition-colors hover:bg-[#e8e8ed] hover:text-[#1a1c1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/35"
							>
								Close and finish later
							</button>
						</div>
					</div>

					<div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-[#004bc3] via-[#1562f0] to-[#465c99]" />
				</div>
			</div>

			<div className="pointer-events-none fixed -right-[100px] top-20 -z-10 h-80 w-80 rounded-full bg-[#004bc3]/5 blur-[100px]" />
			<div className="pointer-events-none fixed -left-[100px] bottom-20 -z-10 h-80 w-80 rounded-full bg-[#465c99]/5 blur-[100px]" />
		</div>
	)
}