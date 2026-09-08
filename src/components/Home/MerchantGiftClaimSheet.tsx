import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ethers } from 'ethers'
import {
	AlertTriangle,
	Bolt,
	Calendar,
	CheckCircle2,
	Gift,
	Loader2,
	Lock,
	MessageCircle,
} from 'lucide-react'
import {
	BeamioCircularBackButton,
	BEAMIO_CIRCULAR_BACK_ROW_CLASS,
} from '@/components/BeamioCircularBackButton'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useMerchantCardDatabase } from '@/providers/MerchantCardDatabaseProvider'
import { postCardRedeem } from '@/services/BeamioCard'
import { mapServerError } from '@/locale/mapServerError'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { pickMerchantCardListTitle } from '@/utils/merchantCardDatabase'
import { IpfsImg } from '@/components/IpfsImg'

type Props = {
	cardAddress: string
	redeemCode: string
	onClose: () => void
	onSuccess?: (tx?: string) => void
	/** Navigate to chat with sender when available */
	onReplyInChat?: () => void
}

/**
 * Merchant gift redeem claim (beamiocard + redeemcode) — Instant Vault Top-Up sheet.
 * Not the coupon ticket claim UI.
 */
export default function MerchantGiftClaimSheet({
	cardAddress,
	redeemCode,
	onClose,
	onSuccess,
	onReplyInChat,
}: Props) {
	const { profiles, setShowFooter } = useDaemonContext()
	const { resolveName, resolveImage, registerCardAddresses, peekMetadata } =
		useMerchantCardDatabase()
	const [entered, setEntered] = useState(false)
	const [closing, setClosing] = useState(false)
	const [phase, setPhase] = useState<'ready' | 'success'>('ready')
	const [submitting, setSubmitting] = useState(false)
	const [panelError, setPanelError] = useState<string | null>(null)
	const [txHash, setTxHash] = useState<string | null>(null)
	const inFlightRef = useRef(false)

	const card = useMemo(() => {
		const raw = cardAddress.trim()
		return raw && ethers.isAddress(raw) ? ethers.getAddress(raw) : ''
	}, [cardAddress])

	const code = redeemCode.trim()

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	useEffect(() => {
		const frame = requestAnimationFrame(() => setEntered(true))
		return () => cancelAnimationFrame(frame)
	}, [])

	useEffect(() => {
		if (card) registerCardAddresses([card])
	}, [card, registerCardAddresses])

	const merchantTitle = useMemo(() => {
		if (!card) return 'Merchant gift'
		const fromDb = resolveName(card)?.trim()
		if (fromDb) return fromDb
		const peek = peekMetadata?.(card)
		return pickMerchantCardListTitle({
			metaName: peek?.name,
			fallback: 'Merchant gift',
		})
	}, [card, resolveName, peekMetadata])

	const merchantImage = card ? resolveImage(card) : ''

	const close = useCallback(() => {
		if (closing || submitting) return
		setClosing(true)
		window.setTimeout(onClose, 300)
	}, [closing, submitting, onClose])

	const handleClaim = async () => {
		if (inFlightRef.current || submitting || phase === 'success') return
		setPanelError(null)
		if (!card) {
			setPanelError('This redeem link is missing a valid program card address.')
			return
		}
		if (!code) {
			setPanelError('Redeem code is missing.')
			return
		}
		const profile = profiles?.[0]
		const privateKeyArmor = resolveSigningPrivateKeyArmor(profile)
		const toUserEOA = (profile?.keyID ?? '').trim()
		if (!privateKeyArmor || !toUserEOA || !ethers.isAddress(toUserEOA)) {
			setPanelError('Unlock your wallet with your Access Password to claim this gift.')
			return
		}

		inFlightRef.current = true
		setSubmitting(true)
		try {
			const ret = await postCardRedeem(card, code, ethers.getAddress(toUserEOA))
			if (!ret.success) {
				setPanelError(mapServerError(ret.error, 'redeemFailed'))
				return
			}
			const tx = typeof ret.tx === 'string' ? ret.tx : undefined
			setTxHash(tx ?? null)
			setPhase('success')
			onSuccess?.(tx)
		} catch (e: unknown) {
			setPanelError(mapServerError((e as Error)?.message))
		} finally {
			inFlightRef.current = false
			setSubmitting(false)
		}
	}

	const shortCode =
		code.length > 14 ? `${code.slice(0, 6)}…${code.slice(-4)}` : code || '—'

	return (
		<div
			className="fixed inset-0 z-[10000] bg-[#faf9fe] transition-transform duration-300 ease-out dark:bg-slate-950"
			style={{
				transform: closing || !entered ? 'translateX(100%)' : 'translateX(0)',
			}}
		>
			<div className="flex h-full flex-col overflow-y-auto">
				<div
					className="px-5 pt-[max(1rem,env(safe-area-inset-top,0px))]"
				>
					<div className={BEAMIO_CIRCULAR_BACK_ROW_CLASS}>
						<BeamioCircularBackButton
							variant="onLight"
							onClick={close}
							disabled={submitting}
							className="absolute left-0 top-0"
						/>
					</div>
					<header className="pb-4 pt-2">
						<div className="flex items-center gap-2">
							{merchantImage ? (
								<div className="h-9 w-9 overflow-hidden rounded-full bg-slate-100">
									<IpfsImg
										src={merchantImage}
										alt=""
										className="h-full w-full object-cover"
									/>
								</div>
							) : (
								<div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dbe1ff] text-[#004bc3]">
									<Gift className="h-4 w-4" aria-hidden />
								</div>
							)}
							<div className="min-w-0">
								<h1 className="truncate text-[22px] font-semibold tracking-tight text-[#1a1b1f] dark:text-slate-100">
									{phase === 'success' ? 'Gift claimed' : 'Gift claim'}
								</h1>
								<p className="text-[12px] font-semibold uppercase tracking-wider text-[#5d5e63]">
									Non-custodial · Self-hosted
								</p>
							</div>
						</div>
					</header>
				</div>

				<main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
					{phase === 'ready' ? (
						<>
							<div className="flex flex-col items-center gap-1.5 pt-1 text-center">
								<div className="inline-flex items-center gap-1.5 rounded-full bg-[#72fe88]/25 px-3 py-1 text-[#00531c]">
									<Bolt className="h-4 w-4" aria-hidden />
									<span className="text-[12px] font-semibold uppercase tracking-wider">
										Instant vault top-up
									</span>
								</div>
								<h2 className="pt-1 text-[28px] font-bold tracking-tight text-[#1a1b1f] dark:text-slate-100">
									Claim your gift at {merchantTitle}
								</h2>
								<p className="max-w-[320px] text-[15px] text-[#5d5e63]">
									Redeem adds store credits to your Smart Wallet for this merchant program.
								</p>
							</div>

							<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2f2b27] via-[#25221e] to-[#1a1816] p-4 text-[#faf9fe] shadow-md">
								<div className="flex items-center justify-between gap-2">
									<div className="flex min-w-0 items-center gap-2">
										<span className="rounded-full bg-[#baa479]/20 px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-wider text-[#edd8af]">
											Gift voucher
										</span>
										<span className="truncate text-[15px] font-medium text-[#d4cfc9]">
											{merchantTitle}
										</span>
									</div>
									<span className="shrink-0 font-mono text-[12px] font-semibold tracking-wider text-[#baa479]">
										{shortCode}
									</span>
								</div>
								<div className="mt-3 rounded-xl bg-[#baa479]/15 px-3 py-2">
									<p className="text-[12px] font-medium text-[#f7efe1]">
										Credits clear to your self-hosted Smart Wallet after on-chain redeem.
									</p>
								</div>
								<div className="mt-3 flex items-center gap-2 text-[#c7bfb6]">
									<Gift className="h-5 w-5 shrink-0 text-[#edd8af]" aria-hidden />
									<p className="text-[15px]">Tap Claim gift below to settle.</p>
								</div>
							</div>
						</>
					) : (
						<>
							<div className="flex flex-col items-center gap-1.5 pt-1 text-center">
								<div className="inline-flex items-center gap-1.5 rounded-full bg-[#72fe88]/40 px-3 py-1 text-[#00531c]">
									<Bolt className="h-4 w-4" aria-hidden />
									<span className="text-[12px] font-semibold uppercase tracking-wider">
										Instant vault top-up
									</span>
								</div>
								<h2 className="pt-1 text-[28px] font-bold tracking-tight text-[#1a1b1f] dark:text-slate-100">
									Gift added to your vault
								</h2>
								<p className="max-w-[320px] text-[15px] text-[#5d5e63]">
									Settled for {merchantTitle}. Credits are ready in your Smart Wallet.
								</p>
							</div>

							<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2f2b27] via-[#25221e] to-[#1a1816] p-4 text-[#faf9fe] shadow-md">
								<div className="flex items-center justify-between gap-2">
									<div className="flex min-w-0 items-center gap-2">
										<span className="rounded-full bg-[#baa479]/20 px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-wider text-[#edd8af]">
											Vault updated
										</span>
										<span className="truncate text-[15px] font-medium text-[#d4cfc9]">
											{merchantTitle}
										</span>
									</div>
									<span className="shrink-0 font-mono text-[12px] font-semibold tracking-wider text-[#baa479]">
										{shortCode}
									</span>
								</div>
								<div className="mt-3 rounded-xl bg-white/5 p-3">
									<div className="flex items-center justify-between pb-1">
										<span className="text-[12px] font-semibold uppercase tracking-wider text-[#c7bfb6]">
											Store credits
										</span>
										<span className="rounded bg-[#007e2f]/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
											Gift claimed
										</span>
									</div>
									<p className="text-[15px] text-[#f7efe1]">
										Available in your {merchantTitle} vault for in-store use.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3 rounded-xl bg-[#eeedf3] p-3.5 dark:bg-slate-800">
								<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dbe1ff] text-[#004bc3]">
									<CheckCircle2 className="h-4 w-4" aria-hidden />
								</div>
								<div>
									<p className="text-[12px] font-semibold uppercase tracking-wider text-[#1a1b1f] dark:text-slate-100">
										Zero settlement friction
									</p>
									<p className="text-[15px] text-[#5d5e63]">
										Redeemable at this merchant for eligible purchases immediately after confirm.
									</p>
								</div>
							</div>
						</>
					)}

					{panelError ? (
						<div
							role="alert"
							className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
						>
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
							<p>{panelError}</p>
						</div>
					) : null}

					<div className="flex flex-col gap-2.5 pt-1">
						{phase === 'ready' ? (
							<button
								type="button"
								onClick={() => void handleClaim()}
								disabled={submitting || !card || !code}
								aria-busy={submitting}
								className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#004bc3] text-[17px] font-semibold text-white shadow-md transition active:scale-[0.99] disabled:opacity-60"
							>
								{submitting ? (
									<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
								) : (
									<Gift className="h-5 w-5" aria-hidden />
								)}
								{submitting ? 'Claiming…' : 'Claim gift'}
							</button>
						) : (
							<>
								<button
									type="button"
									onClick={close}
									className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#004bc3] text-[17px] font-semibold text-white shadow-md transition active:scale-[0.99]"
								>
									<Calendar className="h-5 w-5" aria-hidden />
									Done
								</button>
								{onReplyInChat ? (
									<button
										type="button"
										onClick={onReplyInChat}
										className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e3e2e7] text-[17px] font-medium text-[#1a1b1f] transition active:scale-[0.99] dark:bg-slate-800 dark:text-slate-100"
									>
										<MessageCircle className="h-5 w-5 text-[#004bc3]" aria-hidden />
										Reply in Chat
									</button>
								) : null}
							</>
						)}
					</div>

					<div className="flex items-center justify-center gap-1.5 pb-2 pt-1 text-[#737687]">
						<Lock className="h-3.5 w-3.5" aria-hidden />
						<p className="text-center text-[11px] font-semibold uppercase tracking-wider">
							{txHash
								? `On-chain redeem · ${txHash.slice(0, 10)}…`
								: 'CoNET · Non-custodial vault'}
						</p>
					</div>
				</main>
			</div>
		</div>
	)
}
