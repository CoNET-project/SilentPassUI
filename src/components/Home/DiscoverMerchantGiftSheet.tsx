import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, WheelEvent } from 'react'
import { ethers } from 'ethers'
import {
	AlertTriangle,
	Check,
	ChevronRight,
	Copy,
	Gift,
	Loader2,
	Search,
	Share2,
	Sparkles,
	X,
} from 'lucide-react'
import { generateCODE } from '@/services/beamio'
import { fiatPrefix, formatAmount } from '@/services/currency'
import {
	postPurchaseMerchantGiftRedeem,
	quoteCurrencyAmountInUSDCFair,
	USDC2Token,
} from '@/services/BeamioCard'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { parseDiscoverTopupAmountInput, readEoaConetUsdcBalance6 } from '@/utils/discoverEoaUsdcTopup'
import { membershipFeeE6ToHuman } from '@/utils/discoverMembershipFee'
import { searchUsername } from '@/services/beamio'
import { IpfsImg } from '@/components/IpfsImg'
import {
	BeamioSearchResultRow,
	beamioSearchAvatarUrl,
	beamioSearchDisplayName,
	beamioSearchShortAddress,
	makeBeamioSearchAddressOnlyResult,
	sortSearchResultsExactFirst,
} from '@/components/Home/beamioSearchResultPresentation'
import {
	discoverContrastTextOnBrand,
	discoverMixCssColorWithBlack,
	discoverParseCssRgb,
	parseDiscoverMerchantBrandColor,
} from '@/utils/discoverMerchantPromotions'

const GIFT_BRAND_FALLBACK = '#2c2416'

function preventNumericInputStepKeys(e: KeyboardEvent<HTMLInputElement>): void {
	if (
		e.key === 'ArrowUp' ||
		e.key === 'ArrowDown' ||
		e.key === 'PageUp' ||
		e.key === 'PageDown' ||
		e.key === 'Home' ||
		e.key === 'End'
	) {
		e.preventDefault()
		e.stopPropagation()
	}
}

function preventNumericInputWheelStep(e: WheelEvent<HTMLInputElement>): void {
	e.preventDefault()
	e.stopPropagation()
}

function membershipFeeHumanToE6(raw: string | number | undefined | null): string {
	if (raw == null || raw === '') return '0'
	const s = String(raw).replace(/,/g, '').trim()
	if (!s) return '0'
	const n = Number(s)
	if (!Number.isFinite(n) || n <= 0) return '0'
	return String(Math.round(n * 1e6))
}

/** Base membership fee (index 0) from card0 metadata; 0 = non-fee card. */
export function discoverGiftBaseMembershipFeeE6(meta: Record<string, unknown> | null | undefined): string {
	if (meta == null) return '0'
	const baseRaw = meta.baseMembership
	if (baseRaw != null && typeof baseRaw === 'object' && !Array.isArray(baseRaw)) {
		const o = baseRaw as Record<string, unknown>
		if (o.membershipFeeE6 != null && String(o.membershipFeeE6).trim() !== '') {
			try {
				const fee = BigInt(String(o.membershipFeeE6).replace(/,/g, '').trim())
				if (fee > 0n) return fee.toString()
			} catch {
				/* fall through */
			}
		}
		const human = membershipFeeHumanToE6(o.membershipFee as string | number | undefined)
		if (BigInt(human) > 0n) return human
	}
	const tiers = meta.tiers
	if (!Array.isArray(tiers) || tiers.length === 0) return '0'
	const first = tiers[0]
	if (first == null || typeof first !== 'object') return '0'
	const o = first as Record<string, unknown>
	if (o.membershipFeeE6 != null && String(o.membershipFeeE6).trim() !== '') {
		try {
			const fee = BigInt(String(o.membershipFeeE6).replace(/,/g, '').trim())
			if (fee > 0n) return fee.toString()
		} catch {
			return '0'
		}
	}
	return membershipFeeHumanToE6(o.membershipFee as string | number | undefined)
}

function GiftFriendCapsule({
	item,
	onClear,
}: {
	item: searchResult
	onClear: () => void
}) {
	const tag = (item.username ?? '').trim()
	const name = beamioSearchDisplayName(item)
	const seed = tag || item.address || '@Beamio'

	return (
		<div className="rounded-2xl border border-[#1562f0]/25 bg-white p-4 shadow-sm dark:border-[#6ba3ff]/30 dark:bg-slate-800">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-[#c3c6d8]/40 bg-white py-1 pl-1 pr-3 dark:border-slate-600 dark:bg-slate-900">
					<IpfsImg
						src={item.image?.trim() || beamioSearchAvatarUrl(seed)}
						alt=""
						className="h-9 w-9 shrink-0 rounded-full border border-slate-200/80 object-cover dark:border-slate-600"
					/>
					<div className="min-w-0 flex-1 leading-tight">
						<p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{name}</p>
						{tag ? (
							<p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
								@{tag} · {beamioSearchShortAddress(item.address)}
							</p>
						) : (
							<p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
								{beamioSearchShortAddress(item.address)}
							</p>
						)}
					</div>
				</div>
				<button
					type="button"
					className="rounded-full p-2 text-[#424655] hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
					onClick={onClear}
					aria-label="Clear selection"
					tabIndex={-1}
				>
					<X className="h-5 w-5" aria-hidden />
				</button>
			</div>
		</div>
	)
}

type Props = {
	cardAddress: string
	merchantTitle: string
	currency: string
	metadataRoot?: Record<string, unknown> | null
	profile: { privateKeyArmor?: string | null; keyID?: string; aaAccount?: string } | null | undefined
	onClose: () => void
	onSuccess?: () => void
}

export default function DiscoverMerchantGiftSheet({
	cardAddress,
	merchantTitle,
	currency,
	metadataRoot,
	profile,
	onClose,
	onSuccess,
}: Props) {
	const ccy = ((currency || 'USD').toUpperCase() || 'USD') as ICurrency
	const prefix = fiatPrefix(ccy)
	const baseFeeE6 = useMemo(() => discoverGiftBaseMembershipFeeE6(metadataRoot), [metadataRoot])
	const isFeeCard = useMemo(() => {
		try {
			return BigInt(baseFeeE6) > 0n
		} catch {
			return false
		}
	}, [baseFeeE6])
	/** Same brand chrome as MerchantCardTopUpFlow / Discover merchant detail. */
	const brandColor = useMemo(
		() => parseDiscoverMerchantBrandColor(metadataRoot) ?? GIFT_BRAND_FALLBACK,
		[metadataRoot],
	)
	const brandControl = useMemo(
		() => discoverMixCssColorWithBlack(brandColor, 0.14) ?? brandColor,
		[brandColor],
	)
	const onBrandText = useMemo(() => discoverContrastTextOnBrand(brandColor), [brandColor])
	/** Labels / secondary on brand fill — same hierarchy as Top-up `text-white/70`. */
	const onBrandMuted = useMemo(
		() => (onBrandText === '#ffffff' ? 'rgba(255,255,255,0.75)' : 'rgba(17,24,39,0.72)'),
		[onBrandText],
	)
	const brandShadow = useMemo(() => {
		const rgb = discoverParseCssRgb(brandColor)
		if (!rgb) return '0 8px 28px rgba(15, 23, 42, 0.18)'
		return `0 8px 28px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`
	}, [brandColor])
	const brandControlShadow = useMemo(() => {
		const rgb = discoverParseCssRgb(brandControl)
		if (!rgb) return '0 4px 16px rgba(15, 23, 42, 0.16)'
		return `0 4px 16px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`
	}, [brandControl])
	const minHuman = isFeeCard ? membershipFeeE6ToHuman(baseFeeE6) || '0' : '0.01'

	const [amountText, setAmountText] = useState(isFeeCard ? minHuman : '')
	const [panelError, setPanelError] = useState<string | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const submitInFlightRef = useRef(false)

	const [friendQuery, setFriendQuery] = useState('')
	const [friendResults, setFriendResults] = useState<searchResult[]>([])
	const [friendLoading, setFriendLoading] = useState(false)
	const [showFriendDropdown, setShowFriendDropdown] = useState(false)
	const [selectedFriend, setSelectedFriend] = useState<searchResult | null>(null)
	const friendRequestId = useRef(0)

	const [issuedCode, setIssuedCode] = useState<string | null>(null)
	const [issuedShareUrl, setIssuedShareUrl] = useState<string | null>(null)
	const [issuedTopupCreditE6, setIssuedTopupCreditE6] = useState<string | null>(null)
	const [copyStatus, setCopyStatus] = useState<'idle' | 'ok'>('idle')

	const myAddress = (profile?.keyID ?? '').trim().toLowerCase()
	const normalizedFriendQuery = friendQuery.trim()
	const canSearchFriend = normalizedFriendQuery.length >= 2 && !selectedFriend

	useEffect(() => {
		if (!canSearchFriend) {
			setFriendResults([])
			setFriendLoading(false)
			setShowFriendDropdown(false)
			return
		}
		const id = ++friendRequestId.current
		setFriendLoading(true)
		const timer = window.setTimeout(async () => {
			const res = await searchUsername(normalizedFriendQuery).catch(() => null)
			const list = Array.isArray(res?.results) ? (res!.results as searchResult[]) : []
			const filtered = list.filter((r) => {
				const addr = String(r.address ?? '').toLowerCase()
				return !myAddress || addr !== myAddress
			})
			if (
				ethers.isAddress(normalizedFriendQuery) &&
				!filtered.some((r) => r.address?.toLowerCase() === normalizedFriendQuery.toLowerCase())
			) {
				filtered.push(makeBeamioSearchAddressOnlyResult(normalizedFriendQuery))
			}
			if (id !== friendRequestId.current) return
			setFriendResults(sortSearchResultsExactFirst(filtered, normalizedFriendQuery))
			setFriendLoading(false)
			setShowFriendDropdown(true)
		}, 350)
		return () => window.clearTimeout(timer)
	}, [normalizedFriendQuery, canSearchFriend, myAddress, selectedFriend])

	const buildShareMessage = (code: string) => {
		const title = merchantTitle.trim() || 'merchant'
		const friendTag = (selectedFriend?.username ?? '').trim()
		const hello = friendTag ? `@${friendTag}` : 'friend'
		return `Hi ${hello} — here's a ${title} gift redeem code:\n${code}\nOpen Beamio Discover and enter the code to claim.`
	}

	const handleCopyCode = async () => {
		if (!issuedCode) return
		try {
			await navigator.clipboard.writeText(issuedCode)
			setCopyStatus('ok')
			window.setTimeout(() => setCopyStatus('idle'), 2000)
		} catch {
			setPanelError('Could not copy the code. Please copy it manually.')
		}
	}

	const handleShare = async () => {
		if (!issuedCode) return
		const text = buildShareMessage(issuedCode)
		const url = issuedShareUrl?.trim()
		try {
			if (typeof navigator.share === 'function') {
				await navigator.share(url ? { text, url } : { text })
				return
			}
			await navigator.clipboard.writeText(url ? `${text}\n${url}` : text)
			setCopyStatus('ok')
			window.setTimeout(() => setCopyStatus('idle'), 2000)
		} catch {
			/* user cancelled share — keep panel */
		}
	}

	const handlePurchase = async () => {
		setPanelError(null)
		if (submitInFlightRef.current || submitting) return
		if (issuedCode) return

		const card = cardAddress.trim()
		if (!card || !ethers.isAddress(card)) {
			setPanelError('Merchant card is unavailable.')
			return
		}
		const pk = resolveSigningPrivateKeyArmor(profile)
		const from = (profile?.keyID ?? '').trim()
		if (!pk || !from || !ethers.isAddress(from)) {
			setPanelError('Unlock your wallet with your Access Password to pay.')
			return
		}

		const parsed = parseDiscoverTopupAmountInput(amountText, ccy)
		if (!parsed.ok) {
			setPanelError(parsed.error)
			return
		}

		let totalE6: bigint
		try {
			totalE6 = ethers.parseUnits(parsed.apiAmount, 6)
		} catch {
			setPanelError('Enter a valid amount.')
			return
		}
		if (totalE6 <= 0n) {
			setPanelError('Enter a valid amount greater than 0.')
			return
		}

		let feeE6 = 0n
		try {
			feeE6 = BigInt(baseFeeE6)
		} catch {
			feeE6 = 0n
		}
		if (feeE6 > 0n && totalE6 < feeE6) {
			setPanelError(
				`Gift amount must be at least ${prefix}${minHuman} (base membership fee).`,
			)
			return
		}

		const membershipFeeE6 = feeE6 > 0n ? feeE6.toString() : '0'
		const topupPrincipalE6 = feeE6 > 0n ? (totalE6 - feeE6).toString() : totalE6.toString()

		submitInFlightRef.current = true
		setSubmitting(true)
		try {
			const { usdc, usdc6 } = await quoteCurrencyAmountInUSDCFair(ccy, parsed.apiAmount)
			const bal = await readEoaConetUsdcBalance6(profile as profile)
			if (bal < usdc6) {
				setPanelError(
					`Insufficient CoNET-USDC. Need about ${usdc} USDC; your balance is ${ethers.formatUnits(bal, 6)}.`,
				)
				return
			}

			const auth = await USDC2Token(pk, usdc, card)
			const { code } = generateCODE('')
			const redeemCode = String(code ?? '').trim()
			if (!redeemCode) {
				setPanelError('Could not generate a redeem code. Try again.')
				return
			}

			const result = await postPurchaseMerchantGiftRedeem({
				cardAddress: card,
				from: auth.from,
				usdcAmount: auth.usdcAmount,
				userSignature: auth.userSignature,
				nonce: auth.nonce,
				validAfter: auth.validAfter,
				validBefore: auth.validBefore,
				redeemCode,
				membershipFeeE6,
				topupPrincipalE6,
			})
			if (!result.success) {
				setPanelError(result.error ?? 'Gift purchase failed.')
				return
			}
			const plain = (result.redeemCode ?? redeemCode).trim()
			setIssuedCode(plain)
			setIssuedShareUrl(result.shareUrl?.trim() || null)
			setIssuedTopupCreditE6(result.topupCreditE6 ?? topupPrincipalE6)
			onSuccess?.()
		} catch (e) {
			setPanelError((e as Error)?.message ?? 'Gift purchase failed.')
		} finally {
			submitInFlightRef.current = false
			setSubmitting(false)
		}
	}

	const merchantLabel = merchantTitle.trim() || 'this merchant'
	const giftFooterTip = isFeeCard
		? `Minimum ${prefix}${minHuman}. Non-members get membership from the fee portion; members get full store credit.`
		: 'Recipient gets store credit for this amount — plus any Top-up Multiplier the merchant configured.'

	if (issuedCode) {
		const creditHuman = issuedTopupCreditE6
			? membershipFeeE6ToHuman(issuedTopupCreditE6) ||
				formatAmount(Number(ethers.formatUnits(issuedTopupCreditE6, 6)), ccy)
			: null
		return (
			<section className="mx-auto flex w-full max-w-lg flex-col gap-5" aria-label="Gift code ready">
				<header className="px-0.5">
					<div className="flex items-center gap-1.5">
						<Sparkles className="h-3.5 w-3.5 shrink-0 text-[#C9A227]" strokeWidth={2} aria-hidden />
						<span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af]">
							Gift ready to share
						</span>
					</div>
					<h2 className="mt-2 font-serif text-[22px] font-semibold leading-snug tracking-tight text-[#0F172A] dark:text-slate-100 sm:text-[24px]">
						Your redeem code is ready
					</h2>
					<p className="mt-2 text-[13px] leading-relaxed text-[#6b7280] dark:text-slate-400">
						Copy it now — shown once and never stored on our servers. Anyone with the code can claim
						{isFeeCard ? ' (membership for new members, or store credit)' : ' store credit'}
						{creditHuman ? ` — about ${prefix}${creditHuman} toward #0 after claim` : ''}.
					</p>
				</header>

				<div
					className="overflow-hidden rounded-[20px] px-4 pb-4 pt-3.5 shadow-[0_8px_28px_rgba(15,23,42,0.18)]"
					style={{ backgroundColor: brandColor, color: onBrandText, boxShadow: brandShadow }}
				>
					<div className="flex items-center justify-between gap-2">
						<span
							className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
							style={{ backgroundColor: brandControl, color: onBrandText }}
						>
							Gift
						</span>
						<p
							className="min-w-0 flex-1 truncate text-center font-serif text-[15px] font-semibold tracking-tight"
							style={{ color: onBrandText }}
						>
							{merchantLabel}
						</p>
						<span className="w-[4.5rem] shrink-0" aria-hidden />
					</div>
					<p
						className="mt-4 break-all rounded-xl bg-white/[0.08] px-4 py-3 font-mono text-[15px] font-semibold tracking-wide ring-1 ring-white/10"
						style={{ color: onBrandText }}
					>
						{issuedCode}
					</p>
				</div>

				<div className="flex flex-col gap-2.5">
					<button
						type="button"
						onClick={() => void handleCopyCode()}
						className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[15px] font-bold transition active:scale-[0.98]"
						style={{
							backgroundColor: brandControl,
							color: onBrandText,
							boxShadow: brandControlShadow,
						}}
					>
						{copyStatus === 'ok' ? (
							<Check className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
						) : (
							<Copy className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
						)}
						<span>{copyStatus === 'ok' ? 'Copied' : 'Copy gift code'}</span>
						<ChevronRight className="h-5 w-5 opacity-80" strokeWidth={2.25} aria-hidden />
					</button>
					<button
						type="button"
						onClick={() => void handleShare()}
						className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#e8ecf0] bg-white px-5 py-3 text-[14px] font-semibold text-[#0F172A] shadow-sm transition active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
					>
						<Share2 className="h-4 w-4 text-[#6b7280]" strokeWidth={2.25} aria-hidden />
						Share with a friend
					</button>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex w-full items-center justify-center px-5 py-2 text-[14px] font-semibold text-[#6b7280] dark:text-slate-400"
					>
						Done
					</button>
				</div>

				{panelError ? (
					<div
						role="alert"
						className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
					>
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
						<p>{panelError}</p>
					</div>
				) : null}
			</section>
		)
	}

	return (
		<section className="mx-auto flex w-full max-w-lg flex-col gap-5" aria-label="Send a merchant gift">
			<header className="px-0.5">
				<div className="flex items-center gap-1.5">
					<Sparkles className="h-3.5 w-3.5 shrink-0 text-[#C9A227]" strokeWidth={2} aria-hidden />
					<span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af]">
						Treat someone special
					</span>
				</div>
				<h2 className="mt-2 font-serif text-[22px] font-semibold leading-snug tracking-tight text-[#0F172A] dark:text-slate-100 sm:text-[24px]">
					Gift Store Credit & Open Redeem
				</h2>
				<p className="mt-2 text-[13px] leading-relaxed text-[#6b7280] dark:text-slate-400">
					Pay with CoNET-USDC for {merchantLabel}. You only sign offline — no network gas for you or
					the recipient. The merchant does not need to sign.
				</p>
			</header>

			<div
				className="overflow-hidden rounded-[20px] px-4 pb-4 pt-3.5 shadow-[0_8px_28px_rgba(15,23,42,0.18)]"
				style={{ backgroundColor: brandColor, color: onBrandText, boxShadow: brandShadow }}
			>
				<div className="flex items-center justify-between gap-2">
					<span
						className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
						style={{ backgroundColor: brandControl, color: onBrandText }}
					>
						Gift
					</span>
					<p
						className="min-w-0 flex-1 truncate text-center font-serif text-[15px] font-semibold tracking-tight"
						style={{ color: onBrandText }}
					>
						{merchantLabel}
					</p>
					<span className="w-[4.5rem] shrink-0" aria-hidden />
				</div>
				<div className="mt-4 grid grid-cols-2 gap-3">
					<div className="rounded-xl bg-white/[0.12] px-3 py-3 ring-1 ring-white/20">
						<p
							className="text-[10px] font-semibold uppercase tracking-[0.12em]"
							style={{ color: onBrandMuted }}
						>
							Currency
						</p>
						<p
							className="mt-1.5 text-[22px] font-bold leading-none tracking-tight tabular-nums"
							style={{ color: onBrandText }}
						>
							{ccy}
						</p>
						<p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />
							Card pricing
						</p>
					</div>
					<div className="rounded-xl bg-white/[0.12] px-3 py-3 ring-1 ring-white/20">
						<p
							className="text-[10px] font-semibold uppercase tracking-[0.12em]"
							style={{ color: onBrandMuted }}
						>
							{isFeeCard ? 'Min gift' : 'From'}
						</p>
						<p
							className="mt-1.5 text-[22px] font-bold leading-none tracking-tight tabular-nums"
							style={{ color: onBrandText }}
						>
							{prefix}
							{minHuman}
						</p>
						<p className="mt-2 text-[11px] font-medium" style={{ color: onBrandMuted }}>
							{isFeeCard ? 'Membership floor' : 'Open amount'}
						</p>
					</div>
				</div>
			</div>

			<label className="block">
				<span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
					Gift amount ({ccy})
				</span>
				<div className="relative">
					<span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 min-w-[2.75rem] text-[15px] font-semibold text-[#6b7280]">
						{prefix}
					</span>
					<input
						id="discover-gift-amount"
						type="number"
						inputMode="decimal"
						autoComplete="off"
						enterKeyHint="done"
						min={minHuman}
						step="0.01"
						value={amountText}
						onChange={(e) => {
							setAmountText(e.target.value)
							setPanelError(null)
						}}
						onKeyDown={preventNumericInputStepKeys}
						onWheel={preventNumericInputWheelStep}
						disabled={submitting}
						className="w-full rounded-2xl border border-[#e8ecf0] bg-white py-3.5 pl-16 pr-4 text-[16px] font-semibold text-[#111827] outline-none ring-0 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
						onFocus={(e) => {
							e.currentTarget.style.borderColor = brandColor
						}}
						onBlur={(e) => {
							e.currentTarget.style.borderColor = ''
						}}
						placeholder={minHuman}
					/>
				</div>
			</label>

			<div>
				<span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
					Share with a friend (optional)
				</span>
				{selectedFriend ? (
					<GiftFriendCapsule item={selectedFriend} onClear={() => setSelectedFriend(null)} />
				) : (
					<div className="relative">
						<Search
							className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]"
							aria-hidden
						/>
						<input
							type="search"
							value={friendQuery}
							onChange={(e) => setFriendQuery(e.target.value)}
							disabled={submitting}
							placeholder="@BeamioTag or address"
							autoComplete="off"
							className="w-full rounded-2xl border border-[#e8ecf0] bg-white py-3 pl-10 pr-4 text-[14px] text-[#111827] outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
							onFocus={(e) => {
								e.currentTarget.style.borderColor = brandColor
							}}
							onBlur={(e) => {
								e.currentTarget.style.borderColor = ''
							}}
						/>
						{friendLoading ? (
							<Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#6b7280]" aria-hidden />
						) : null}
						{showFriendDropdown && friendResults.length > 0 ? (
							<ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-[#e8ecf0] bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900">
								{friendResults.map((r) => (
									<li key={r.address}>
										<BeamioSearchResultRow
											item={r}
											query={friendQuery}
											onSelect={(item) => {
												setSelectedFriend(item)
												setFriendQuery('')
												setFriendResults([])
												setShowFriendDropdown(false)
											}}
										/>
									</li>
								))}
							</ul>
						) : null}
					</div>
				)}
				<p className="mt-1.5 text-[12px] text-[#9ca3af] dark:text-slate-400">
					Selecting a friend only helps you share. Anyone with the code can claim.
				</p>
			</div>

			{panelError ? (
				<div
					role="alert"
					className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
				>
					<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
					<p>{panelError}</p>
				</div>
			) : null}

			<div className="flex flex-col gap-2.5">
				<button
					type="button"
					onClick={() => void handlePurchase()}
					disabled={submitting}
					aria-busy={submitting}
					className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[15px] font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
					style={{
						backgroundColor: brandControl,
						color: onBrandText,
						boxShadow: brandControlShadow,
					}}
				>
					{submitting ? (
						<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
					) : (
						<Gift className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
					)}
					<span>{submitting ? 'Creating gift…' : 'Pay with CoNET-USDC & Gift'}</span>
					{!submitting ? (
						<ChevronRight className="h-5 w-5 opacity-80" strokeWidth={2.25} aria-hidden />
					) : null}
				</button>
				<p className="inline-flex items-start justify-center gap-1.5 px-2 text-center text-[12px] font-medium leading-snug text-emerald-700 dark:text-emerald-400">
					<Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
					<span>{giftFooterTip}</span>
				</p>
			</div>
		</section>
	)
}
