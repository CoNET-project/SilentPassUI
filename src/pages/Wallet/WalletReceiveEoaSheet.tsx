import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, Copy, Link2, Wallet } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import baseIcon from '@/components/assets/base-logo.png'
import { buildReceiveEoaQrUri } from '@/utils/receiveFromWalletApps'
import { BEAMIO_EOA_WALLET_ACCENT } from '@/utils/beamioWalletAccent'

function shortAddr(address: string): string {
	const a = address.trim()
	if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return a
	return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export default function WalletReceiveEoaSheet({
	eoa,
	open,
	onClose,
	setShowFooter,
}: {
	eoa: string
	open: boolean
	onClose: () => void
	setShowFooter: (show: boolean) => void
}) {
	const [copiedKind, setCopiedKind] = useState<'idle' | 'address' | 'uri'>('idle')
	const receiveUri = useMemo(() => buildReceiveEoaQrUri(eoa), [eoa])
	const accent = BEAMIO_EOA_WALLET_ACCENT

	useEffect(() => {
		if (!open) return
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [open, setShowFooter])

	useEffect(() => {
		if (copiedKind === 'idle') return
		const t = window.setTimeout(() => setCopiedKind('idle'), 2000)
		return () => window.clearTimeout(t)
	}, [copiedKind])

	const copyText = useCallback(async (text: string, kind: 'address' | 'uri') => {
		const value = text.trim()
		if (!value) return
		try {
			await navigator.clipboard.writeText(value)
			setCopiedKind(kind)
		} catch {
			setCopiedKind('idle')
		}
	}, [])

	const close = useCallback(() => {
		setCopiedKind('idle')
		onClose()
	}, [onClose])

	return createPortal(
		<AnimatePresence>
			{open ? (
				<>
					<motion.div
						key="wallet-receive-eoa-backdrop"
						className="fixed inset-0 z-[10020] bg-black/40 backdrop-blur-md dark:bg-black/50"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						role="button"
						tabIndex={-1}
						aria-label="Close"
						onClick={close}
					/>
					<motion.div
						key="wallet-receive-eoa-sheet"
						role="dialog"
						aria-modal="true"
						aria-labelledby="wallet-receive-eoa-title"
						className="fixed bottom-0 left-0 right-0 z-[10021] flex max-h-[92dvh] flex-col overflow-hidden overscroll-contain rounded-t-2xl bg-white pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-[0_-20px_50px_rgba(0,0,0,0.14)] dark:bg-slate-900"
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						exit={{ y: '100%' }}
						transition={{ type: 'spring', damping: 32, stiffness: 320 }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="mx-auto w-full max-w-lg overflow-y-auto px-5 pb-1">
							<div className="flex justify-center pb-3 pt-2">
								<div className="h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-600" />
							</div>
							<div className="flex items-center">
								<BeamioCircularBackButton variant="onLight" onClick={close} tabIndex={-1} />
							</div>
							<header className="pb-5 pt-6">
								<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#737687] dark:text-slate-400">
									Main wallet
								</p>
								<h2
									id="wallet-receive-eoa-title"
									className="mt-1 text-[1.375rem] font-bold tracking-tight text-[#191c1d] dark:text-slate-100"
								>
									Receive
								</h2>
								<p className="mt-1 text-sm leading-snug text-[#737687] dark:text-slate-400">
									Scan or paste this Base payment link in any wallet to send funds to your EOA.
								</p>
							</header>

							{!eoa || !receiveUri ? (
								<div
									role="alert"
									className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
								>
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
									<p>Wallet address unavailable</p>
								</div>
							) : (
								<>
									<div className="mb-4 flex items-center justify-center">
										<span className="inline-flex items-center gap-1.5 rounded-full border border-[#dce2f7] bg-[#e9edff] px-2.5 py-1 text-xs font-semibold text-[#424655]">
											<img src={baseIcon} alt="" className="h-3.5 w-3.5 rounded-full" />
											Base
										</span>
									</div>
									<div className="flex justify-center">
										<div className="rounded-xl border border-[#e8eaed] bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
											<QRCodeCanvas
												value={receiveUri}
												size={200}
												level="M"
												includeMargin={false}
												bgColor="#ffffff"
												fgColor="#000000"
												className="block rounded-sm"
											/>
										</div>
									</div>

									<button
										type="button"
										onClick={() => void copyText(eoa, 'address')}
										className="mt-5 flex w-full items-center gap-2 rounded-full border px-3 py-2.5 text-left transition active:scale-[0.99]"
										style={{
											borderColor: accent.border,
											backgroundColor: accent.surfaceBg,
											color: accent.bodyText,
										}}
										aria-label="Copy wallet address"
										tabIndex={-1}
									>
										<Wallet className="h-3.5 w-3.5 shrink-0 text-[#0051d1]" strokeWidth={2.25} aria-hidden />
										<span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">
											{shortAddr(eoa)}
										</span>
										{copiedKind === 'address' ? (
											<Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
										) : (
											<Copy className="h-4 w-4 shrink-0 text-[#0051d1]" aria-hidden />
										)}
									</button>

									<button
										type="button"
										onClick={() => void copyText(receiveUri, 'uri')}
										className="mt-3 flex w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition active:scale-[0.99] dark:border-slate-600 dark:bg-slate-800"
										aria-label="Copy payment link"
										tabIndex={-1}
									>
										<Link2 className="h-3.5 w-3.5 shrink-0 text-[#0878f9]" strokeWidth={2.25} aria-hidden />
										<span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-[#424655] dark:text-slate-200">
											{receiveUri}
										</span>
										{copiedKind === 'uri' ? (
											<Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
										) : (
											<Copy className="h-4 w-4 shrink-0 text-[#0878f9]" aria-hidden />
										)}
									</button>

									<p className="mt-4 text-center text-sm leading-snug text-[#737687] dark:text-slate-400">
										No token or amount is set. The scanner chooses what to send on Base.
									</p>
								</>
							)}
						</div>
					</motion.div>
				</>
			) : null}
		</AnimatePresence>,
		document.body,
	)
}
