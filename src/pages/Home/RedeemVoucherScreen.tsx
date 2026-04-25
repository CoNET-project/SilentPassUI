import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Gift, ShieldCheck, Ticket } from 'lucide-react'
import ScanBtn, { type ScanButtonHandle } from '@/components/scanBtn/ScanButton'
import { onWalletEvent } from '@/services/beamio'

type RedeemVoucherScreenProps = {
	onBack: () => void
	onActivateVoucher: (voucherInput: string) => void
}

export default function RedeemVoucherScreen({ onBack, onActivateVoucher }: RedeemVoucherScreenProps) {
	const [voucherInput, setVoucherInput] = useState('')
	const [touched, setTouched] = useState(false)
	const scanButtonRef = useRef<ScanButtonHandle | null>(null)

	const trimmedVoucher = voucherInput.trim()
	const showError = touched && !trimmedVoucher

	useEffect(() => {
		const off = onWalletEvent('scan:url', (url: string) => {
			if (!url?.trim()) return
			setVoucherInput(url.trim())
			setTouched(false)
		})
		return () => {
			if (typeof off === 'function') off()
		}
	}, [])

	const handleActivate = () => {
		setTouched(true)
		if (!trimmedVoucher) return
		onActivateVoucher(trimmedVoucher)
	}

	return (
		<div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f9f9fe] font-[Inter,system-ui,sans-serif] text-[#1a1c1f] selection:bg-[#004bc3]/20">
			<header className="fixed left-0 right-0 top-0 z-50 bg-[#f9f9fe]/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)] backdrop-blur-[20px]">
				<div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-6">
					<button
						type="button"
						onClick={onBack}
						className="flex h-10 w-10 items-center justify-center rounded-full text-[#1562f0] transition-transform hover:bg-[#f3f3f8] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/35"
						aria-label="Back"
					>
						<ArrowLeft className="h-5 w-5" strokeWidth={2.4} aria-hidden />
					</button>
					<h1 className="text-lg font-bold tracking-[-0.02em] text-[#1a1c1f]">Redeem Voucher</h1>
					<div className="h-10 w-10" aria-hidden />
				</div>
			</header>

			<main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-10 overflow-y-auto px-6 pb-32 pt-24 [@media(max-height:760px)]:gap-7 [@media(max-height:760px)]:pb-28">
				<section className="mt-4 space-y-2">
					<h2 className="text-3xl font-black tracking-[-0.03em] text-[#1a1c1f]">Experience Beamio.</h2>
					<p className="leading-relaxed text-[#424655]">
						Enter your access code below or scan the physical voucher provided to activate your premium benefits.
					</p>
				</section>

				<section className="space-y-6">
					<div className="group">
						<label
							htmlFor="beamio-voucher-input"
							className="mb-3 block px-1 text-xs font-bold uppercase tracking-widest text-[#424655]"
						>
							Voucher Link or Code
						</label>
						<div className="relative">
							<input
								id="beamio-voucher-input"
								value={voucherInput}
								onChange={(e) => {
									setVoucherInput(e.currentTarget.value)
									if (touched) setTouched(false)
								}}
								onBlur={() => setTouched(true)}
								onKeyDown={(e) => {
									if (e.key !== 'Enter') return
									e.preventDefault()
									handleActivate()
								}}
								className="h-16 w-full rounded-2xl border-none bg-[#e2e2e7] px-6 pr-14 text-lg font-medium text-[#1a1c1f] placeholder:text-[#737687]/50 transition-all focus:outline-none focus:ring-2 focus:ring-[#1562f0]/25"
								placeholder="Ex: BEAMIO-XXXX-XXXX"
								type="text"
								autoCapitalize="characters"
								autoComplete="off"
							/>
							<div className="pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 items-center">
								<Ticket className="h-6 w-6 text-[#1562f0] opacity-40" strokeWidth={2.2} aria-hidden />
							</div>
						</div>
						{showError ? (
							<p className="mt-2 px-1 text-[13px] font-semibold text-[#ba1a1a]">
								Enter or scan a voucher link/code to continue.
							</p>
						) : null}
					</div>

					<div className="flex items-center gap-6 py-4">
						<div className="h-px flex-1 bg-[#e8e8ed]" />
						<span className="text-xs font-black uppercase tracking-[0.2em] text-[#737687]">OR</span>
						<div className="h-px flex-1 bg-[#e8e8ed]" />
					</div>

					<button
						type="button"
						onClick={() => scanButtonRef.current?.start()}
						className="group relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/35"
					>
						<div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[2rem] border-2 border-dashed border-[#c3c6d8] bg-[#f3f3f8] transition-colors group-hover:bg-[#e8e8ed]">
							<div className="rounded-full bg-white p-5 shadow-sm">
								<Camera className="h-10 w-10 text-[#1562f0]" strokeWidth={2.2} aria-hidden />
							</div>
							<div className="text-center">
								<span className="block font-bold text-[#1a1c1f]">Scan QR Code</span>
								<span className="block text-sm text-[#424655]">Point camera at the voucher</span>
							</div>
						</div>
						<div className="absolute left-8 top-8 h-8 w-8 rounded-tl-lg border-l-2 border-t-2 border-[#1562f0]" />
						<div className="absolute right-8 top-8 h-8 w-8 rounded-tr-lg border-r-2 border-t-2 border-[#1562f0]" />
						<div className="absolute bottom-8 left-8 h-8 w-8 rounded-bl-lg border-b-2 border-l-2 border-[#1562f0]" />
						<div className="absolute bottom-8 right-8 h-8 w-8 rounded-br-lg border-b-2 border-r-2 border-[#1562f0]" />
					</button>
				</section>

				<section className="grid grid-cols-2 gap-4">
					<div className="flex flex-col gap-3 rounded-[2rem] bg-[#f3f3f8] p-6">
						<ShieldCheck className="h-6 w-6 text-[#1562f0]" strokeWidth={2.2} aria-hidden />
						<p className="text-xs font-bold text-[#1a1c1f]">Secure Activation</p>
						<p className="text-[10px] leading-tight text-[#424655]">
							Instant verification via Beamio's blockchain-backed infrastructure.
						</p>
					</div>
					<div className="flex flex-col gap-3 rounded-[2rem] bg-[#f3f3f8] p-6">
						<Gift className="h-6 w-6 text-[#1562f0]" strokeWidth={2.2} aria-hidden />
						<p className="text-xs font-bold text-[#1a1c1f]">Gift Access</p>
						<p className="text-[10px] leading-tight text-[#424655]">
							Apply credits or subscription periods directly to your wallet.
						</p>
					</div>
				</section>
			</main>

			<footer className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-[#f9f9fe] via-[#f9f9fe]/95 to-transparent px-6 pb-10 pt-6">
				<div className="mx-auto max-w-2xl">
					<button
						type="button"
						onClick={handleActivate}
						className="flex h-16 w-full items-center justify-center gap-3 rounded-full bg-gradient-to-br from-[#004bc3] to-[#1562f0] text-lg font-bold text-white shadow-[0_8px_32px_rgba(21,98,240,0.3)] transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/40"
					>
						Activate Account
						<ArrowRight className="h-5 w-5" strokeWidth={2.4} aria-hidden />
					</button>
					<p className="mt-4 px-8 text-center text-[11px] text-[#424655] opacity-60">
						By activating, you agree to Beamio's Terms of Service and Privacy Policy. Voucher codes are single-use only.
					</p>
				</div>
			</footer>

			<ScanBtn ref={scanButtonRef} hidden />
		</div>
	)
}
