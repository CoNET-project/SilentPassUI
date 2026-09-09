import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, WheelEvent } from 'react'
import { ethers } from 'ethers'
import { QRCodeCanvas } from 'qrcode.react'
import {
	AlertTriangle,
	AtSign,
	Check,
	ChevronRight,
	Copy,
	Gift,
	Link2,
	Loader2,
	MessageSquare,
	Search,
	Share2,
	ShieldCheck,
	Sparkles,
	Wallet,
	X,
} from 'lucide-react'
import { generateCODE } from '@/services/beamio'
import { fiatPrefix, formatAmount } from '@/services/currency'
import {
	postPurchaseMerchantGiftRedeem,
	quoteCurrencyAmountInUSDCFair,
	readMerchantCardProgramPoints0Balance,
	signMerchantGiftCreditPurchase,
	USDC2Token,
	type MerchantGiftPayWith,
} from '@/services/BeamioCard'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import {
	parseDiscoverTopupAmountInput,
	pollUntilEoaConetUsdcAtLeast,
	readEoaConetUsdcBalance6,
	readEoaUsdcBalance6,
} from '@/utils/discoverEoaUsdcTopup'
import {
	formatQuotedUsdc6ForDisplay,
	payWalletUsdcDepositWithLocalWallet,
} from '@/utils/discoverUsdcTopupSession'
import { membershipFeeE6ToHuman } from '@/utils/discoverMembershipFee'
import { buildMerchantGiftRedeemShareUrl } from '@/utils/merchantGiftRedeemShare'
import {
	computeGiftCreditBurnAmountE6,
	computeGiftCreditMerchantFeeE6,
	parseGiftCreditPurchaseConfig,
} from '@/utils/giftCreditPurchaseMetadata'
import { resolveBeamioAaOnConet } from '@/utils/resolveBeamioAaFromCardFactory'
import { conetDepinProvider } from '@/utils/constants'
import { searchUsername } from '@/services/beamio'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { sendMerchantGiftRedeemChat } from '@/utils/sendMerchantGiftRedeemChat'
import { IpfsImg } from '@/components/IpfsImg'
import beamioQrLogo from '@/components/assets/logo512.png'
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
const AMOUNT_PRESETS = [25, 50, 100, 200] as const

type GiftFlowStep = 1 | 2 | 3
type DeliveryMode = 'friend' | 'link'

type GiftOccasion = {
	id: string
	emoji: string
	label: string
	message: (merchant: string) => string
}

const GIFT_OCCASIONS: GiftOccasion[] = [
	{
		id: 'wellness',
		emoji: '🌿',
		label: 'Wellness Reset',
		message: (m) =>
			`Take time to relax, reset and recharge at ${m}. Enjoy this special treat on me! 🌿`,
	},
	{
		id: 'birthday',
		emoji: '🎂',
		label: 'Birthday Joy',
		message: (m) => `Happy birthday! Here's a little something to enjoy at ${m}. 🎂`,
	},
	{
		id: 'thanks',
		emoji: '✨',
		label: 'Thank You',
		message: (m) => `Thank you — enjoy this gift at ${m}. You deserve it! ✨`,
	},
	{
		id: 'just-because',
		emoji: '🌸',
		label: 'Just Because',
		message: (m) => `Just because. Treat yourself at ${m} — on me! 🌸`,
	},
]

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

function formatPreviewAmount(raw: string): string {
	const n = Number(String(raw).replace(/,/g, '').trim())
	if (!Number.isFinite(n) || n < 0) return '0.00'
	return n.toFixed(2)
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
	/** Return true when a flow step was popped (caller should not close the sheet). */
	registerBackHandler?: (handler: (() => boolean) | null) => void
}

export default function DiscoverMerchantGiftSheet({
	cardAddress,
	merchantTitle,
	currency,
	metadataRoot,
	profile,
	onClose,
	onSuccess,
	registerBackHandler,
}: Props) {
	const { profiles, setProfiles, allNodes } = useDaemonContext()
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
	const brandColor = useMemo(
		() => parseDiscoverMerchantBrandColor(metadataRoot) ?? GIFT_BRAND_FALLBACK,
		[metadataRoot],
	)
	const brandControl = useMemo(
		() => discoverMixCssColorWithBlack(brandColor, 0.14) ?? brandColor,
		[brandColor],
	)
	const onBrandText = useMemo(() => discoverContrastTextOnBrand(brandColor), [brandColor])
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
	const minNum = Number(minHuman) || 0

	const giftCreditConfig = useMemo(
		() => parseGiftCreditPurchaseConfig(metadataRoot ?? null),
		[metadataRoot],
	)
	const creditPayEnabled = giftCreditConfig.enabled

	const [step, setStep] = useState<GiftFlowStep>(1)
	const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('link')
	const [occasionId, setOccasionId] = useState(GIFT_OCCASIONS[0]!.id)
	const [giftNote, setGiftNote] = useState(() =>
		GIFT_OCCASIONS[0]!.message(merchantTitle.trim() || 'this merchant'),
	)
	const [presetAmount, setPresetAmount] = useState<number | null>(100)
	const [amountText, setAmountText] = useState(() => {
		const floor = isFeeCard ? Number(minHuman) || 0 : 0
		const start = Math.max(100, floor)
		return start > 0 ? start.toFixed(floor > 0 && floor === Math.floor(floor) ? 0 : 2) : ''
	})
	const [payWith, setPayWith] = useState<MerchantGiftPayWith>('usdc')
	const [aaPoints0Bal, setAaPoints0Bal] = useState<bigint | null>(null)
	const [aaPoints0Loading, setAaPoints0Loading] = useState(false)
	const [resolvedAa, setResolvedAa] = useState<string | null>(null)
	const [panelError, setPanelError] = useState<string | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const submitInFlightRef = useRef(false)
	const [usdcQuoteLabel, setUsdcQuoteLabel] = useState<string | null>(null)
	/** Combined CoNET-USDC + Base USDC available for Gift USDC settlement. */
	const [usdcAvailableLabel, setUsdcAvailableLabel] = useState<string | null>(null)
	const [usdcSubmitHint, setUsdcSubmitHint] = useState<string | null>(null)

	const [friendQuery, setFriendQuery] = useState('')
	const [friendResults, setFriendResults] = useState<searchResult[]>([])
	const [friendLoading, setFriendLoading] = useState(false)
	const [showFriendDropdown, setShowFriendDropdown] = useState(false)
	const [selectedFriend, setSelectedFriend] = useState<searchResult | null>(null)
	const friendRequestId = useRef(0)

	const [issuedCode, setIssuedCode] = useState<string | null>(null)
	const [issuedShareUrl, setIssuedShareUrl] = useState<string | null>(null)
	const [chatDeliveryHint, setChatDeliveryHint] = useState<string | null>(null)
	const [issuedTopupCreditE6, setIssuedTopupCreditE6] = useState<string | null>(null)
	const [copyCodeStatus, setCopyCodeStatus] = useState<'idle' | 'ok'>('idle')
	const [copyLinkStatus, setCopyLinkStatus] = useState<'idle' | 'ok'>('idle')

	const merchantLabel = merchantTitle.trim() || 'this merchant'
	const previewAmount = formatPreviewAmount(amountText)
	const activeOccasion = GIFT_OCCASIONS.find((o) => o.id === occasionId) ?? GIFT_OCCASIONS[0]!

	const visiblePresets = useMemo(
		() => AMOUNT_PRESETS.filter((n) => n >= minNum || minNum <= 0),
		[minNum],
	)

	useEffect(() => {
		if (!creditPayEnabled && payWith === 'credit') setPayWith('usdc')
	}, [creditPayEnabled, payWith])

	useEffect(() => {
		if (!registerBackHandler) return
		registerBackHandler(() => {
			if (issuedCode) return false
			if (step === 3) {
				setStep(2)
				setPanelError(null)
				return true
			}
			if (step === 2) {
				setStep(1)
				setPanelError(null)
				return true
			}
			return false
		})
		return () => registerBackHandler(null)
	}, [registerBackHandler, step, issuedCode])

	useEffect(() => {
		if (!creditPayEnabled || payWith !== 'credit' || step !== 3) {
			if (payWith !== 'credit') {
				setAaPoints0Bal(null)
				setAaPoints0Loading(false)
			}
			return
		}
		const card = cardAddress.trim()
		const eoa = (profile?.keyID ?? '').trim()
		if (!card || !ethers.isAddress(card) || !eoa || !ethers.isAddress(eoa)) {
			setAaPoints0Bal(null)
			setResolvedAa(null)
			return
		}
		let cancelled = false
		setAaPoints0Loading(true)
		void (async () => {
			try {
				let aa = (profile?.aaAccount ?? '').trim()
				if (!aa || !ethers.isAddress(aa)) {
					aa = (await resolveBeamioAaOnConet(conetDepinProvider, eoa)) ?? ''
				}
				if (cancelled) return
				if (!aa || !ethers.isAddress(aa)) {
					setResolvedAa(null)
					setAaPoints0Bal(null)
					return
				}
				const aaAddr = ethers.getAddress(aa)
				setResolvedAa(aaAddr)
				const bal = await readMerchantCardProgramPoints0Balance(card, aaAddr)
				if (!cancelled) setAaPoints0Bal(bal)
			} catch {
				if (!cancelled) setAaPoints0Bal(null)
			} finally {
				if (!cancelled) setAaPoints0Loading(false)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [creditPayEnabled, payWith, cardAddress, profile?.keyID, profile?.aaAccount, step, amountText])

	useEffect(() => {
		if (step !== 3 || payWith !== 'usdc') {
			setUsdcQuoteLabel(null)
			setUsdcAvailableLabel(null)
			return
		}
		const parsed = parseDiscoverTopupAmountInput(amountText, ccy)
		if (!parsed.ok) {
			setUsdcQuoteLabel(null)
			setUsdcAvailableLabel(null)
			return
		}
		let cancelled = false
		void (async () => {
			try {
				const [{ usdc }, conetBal, baseBal] = await Promise.all([
					quoteCurrencyAmountInUSDCFair(ccy, parsed.apiAmount),
					readEoaConetUsdcBalance6(profile as profile).catch(() => null),
					readEoaUsdcBalance6(profile as profile).catch(() => null),
				])
				if (cancelled) return
				setUsdcQuoteLabel(`Need ~$${usdc} USDC`)
				if (conetBal != null && baseBal != null) {
					const combined = conetBal + baseBal
					setUsdcAvailableLabel(
						`~$${formatQuotedUsdc6ForDisplay(combined)} USDC available`,
					)
				} else if (conetBal != null) {
					setUsdcAvailableLabel(
						`~$${formatQuotedUsdc6ForDisplay(conetBal)} USDC available`,
					)
				} else if (baseBal != null) {
					setUsdcAvailableLabel(
						`~$${formatQuotedUsdc6ForDisplay(baseBal)} USDC available`,
					)
				} else {
					setUsdcAvailableLabel(null)
				}
			} catch {
				if (!cancelled) {
					setUsdcQuoteLabel(null)
					setUsdcAvailableLabel(null)
				}
			}
		})()
		return () => {
			cancelled = true
		}
	}, [step, payWith, amountText, ccy, profile])

	const myAddress = (profile?.keyID ?? '').trim().toLowerCase()
	const normalizedFriendQuery = friendQuery.trim()
	const canSearchFriend = normalizedFriendQuery.length >= 2 && !selectedFriend

	useEffect(() => {
		if (!canSearchFriend || deliveryMode !== 'friend') {
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
	}, [normalizedFriendQuery, canSearchFriend, myAddress, selectedFriend, deliveryMode])

	const giftFacePreview = useMemo(() => {
		const parsed = parseDiscoverTopupAmountInput(amountText, ccy)
		if (!parsed.ok) return null
		try {
			const totalE6 = ethers.parseUnits(parsed.apiAmount, 6)
			if (totalE6 <= 0n) return null
			let feeE6 = 0n
			try {
				feeE6 = BigInt(baseFeeE6)
			} catch {
				feeE6 = 0n
			}
			if (feeE6 > 0n && totalE6 < feeE6) return null
			const membershipFeeE6 = feeE6 > 0n ? feeE6 : 0n
			const topupPrincipalE6 = feeE6 > 0n ? totalE6 - feeE6 : totalE6
			const giftFaceE6 = membershipFeeE6 + topupPrincipalE6
			const credit = computeGiftCreditBurnAmountE6(giftCreditConfig, giftFaceE6)
			return {
				totalE6,
				membershipFeeE6,
				topupPrincipalE6,
				giftFaceE6,
				merchantFeeE6: credit.merchantFeeE6,
				burnAmountE6: credit.burnAmountE6,
			}
		} catch {
			return null
		}
	}, [amountText, ccy, baseFeeE6, giftCreditConfig])

	const buildShareMessage = (code: string, claimUrl: string) => {
		const title = merchantTitle.trim() || 'merchant'
		const friendTag = (selectedFriend?.username ?? '').trim()
		const hello = friendTag ? `@${friendTag}` : 'friend'
		const note = giftNote.trim()
		const noteLine = note ? `\n${note}\n` : '\n'
		if (claimUrl) {
			return `Hi ${hello} — here's a gift for ${title} on Beamio:${noteLine}${claimUrl}\n(Or enter code ${code} in Discover.)`
		}
		return `Hi ${hello} — here's a ${title} gift redeem code:${noteLine}${code}\nOpen Beamio Discover and enter the code to claim.`
	}

	const handleCopyCode = async () => {
		if (!issuedCode) return
		try {
			await navigator.clipboard.writeText(issuedCode)
			setCopyCodeStatus('ok')
			window.setTimeout(() => setCopyCodeStatus('idle'), 2000)
		} catch {
			setPanelError('Could not copy the code. Please copy it manually.')
		}
	}

	const handleCopyClaimLink = async () => {
		const url = issuedShareUrl?.trim()
		if (!url) {
			setPanelError('Claim link is unavailable.')
			return
		}
		try {
			await navigator.clipboard.writeText(url)
			setCopyLinkStatus('ok')
			window.setTimeout(() => setCopyLinkStatus('idle'), 2000)
		} catch {
			setPanelError('Could not copy the claim link. Please copy it manually.')
		}
	}

	const handleShare = async () => {
		if (!issuedCode) return
		const url = issuedShareUrl?.trim() ?? ''
		const text = buildShareMessage(issuedCode, url)
		try {
			if (typeof navigator.share === 'function') {
				await navigator.share(url ? { text, url } : { text })
				return
			}
			await navigator.clipboard.writeText(text)
			setCopyLinkStatus('ok')
			window.setTimeout(() => setCopyLinkStatus('idle'), 2000)
		} catch {
			/* user cancelled share */
		}
	}

	const validateAmountForContinue = (): boolean => {
		setPanelError(null)
		const parsed = parseDiscoverTopupAmountInput(amountText, ccy)
		if (!parsed.ok) {
			setPanelError(parsed.error)
			return false
		}
		let totalE6: bigint
		try {
			totalE6 = ethers.parseUnits(parsed.apiAmount, 6)
		} catch {
			setPanelError('Enter a valid amount.')
			return false
		}
		if (totalE6 <= 0n) {
			setPanelError('Enter a valid amount greater than 0.')
			return false
		}
		let feeE6 = 0n
		try {
			feeE6 = BigInt(baseFeeE6)
		} catch {
			feeE6 = 0n
		}
		if (feeE6 > 0n && totalE6 < feeE6) {
			setPanelError(`Gift amount must be at least ${prefix}${minHuman} (base membership fee).`)
			return false
		}
		return true
	}

	const goStep2 = () => {
		if (!validateAmountForContinue()) return
		setStep(2)
	}

	const goStep3 = () => {
		setPanelError(null)
		if (deliveryMode === 'friend' && !selectedFriend) {
			setPanelError('Select a Beamio friend, or switch to a shareable claim link.')
			return
		}
		setStep(3)
	}

	const selectPreset = (n: number) => {
		setPresetAmount(n)
		setAmountText(String(n))
		setPanelError(null)
	}

	const selectOccasion = (occ: GiftOccasion) => {
		setOccasionId(occ.id)
		setGiftNote(occ.message(merchantLabel))
	}

	const handlePurchase = async () => {
		setPanelError(null)
		if (submitInFlightRef.current || submitting) return
		if (issuedCode) return
		if (!validateAmountForContinue()) return

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

		let feeE6 = 0n
		try {
			feeE6 = BigInt(baseFeeE6)
		} catch {
			feeE6 = 0n
		}

		const membershipFeeE6 = feeE6 > 0n ? feeE6.toString() : '0'
		const topupPrincipalE6 = feeE6 > 0n ? (totalE6 - feeE6).toString() : totalE6.toString()
		const useCredit = payWith === 'credit' && creditPayEnabled

		submitInFlightRef.current = true
		setSubmitting(true)
		setUsdcSubmitHint(null)
		try {
			const { code } = generateCODE('')
			const redeemCode = String(code ?? '').trim()
			if (!redeemCode) {
				setPanelError('Could not generate a redeem code. Try again.')
				return
			}

			if (useCredit) {
				const giftFaceE6 = BigInt(membershipFeeE6) + BigInt(topupPrincipalE6)
				const { burnAmountE6 } = computeGiftCreditBurnAmountE6(giftCreditConfig, giftFaceE6)

				let payerAccount = resolvedAa
				if (!payerAccount || !ethers.isAddress(payerAccount)) {
					const profileAa = (profile?.aaAccount ?? '').trim()
					if (profileAa && ethers.isAddress(profileAa)) {
						payerAccount = ethers.getAddress(profileAa)
					} else {
						payerAccount = (await resolveBeamioAaOnConet(conetDepinProvider, from)) ?? null
					}
				}
				if (!payerAccount || !ethers.isAddress(payerAccount)) {
					setPanelError('Smart Wallet (AA) is required to pay with store credit.')
					return
				}
				payerAccount = ethers.getAddress(payerAccount)

				const bal = await readMerchantCardProgramPoints0Balance(card, payerAccount)
				if (bal < burnAmountE6) {
					const need =
						membershipFeeE6ToHuman(burnAmountE6.toString()) || ethers.formatUnits(burnAmountE6, 6)
					const have = membershipFeeE6ToHuman(bal.toString()) || ethers.formatUnits(bal, 6)
					setPanelError(
						`Insufficient store credit (#0) on your Smart Wallet. Need about ${prefix}${need}; balance is ${prefix}${have}.`,
					)
					return
				}

				const redeemHash = ethers.keccak256(ethers.toUtf8Bytes(redeemCode))
				const auth = await signMerchantGiftCreditPurchase({
					userPrivateKey: pk,
					cardAddress: card,
					from,
					payerAccount,
					membershipFeeE6,
					topupCreditE6: topupPrincipalE6,
					burnAmountE6,
					redeemHash,
				})

				const result = await postPurchaseMerchantGiftRedeem({
					cardAddress: card,
					from: auth.from,
					payWith: 'credit',
					payerAccount: auth.payerAccount,
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
				const claimUrl =
					buildMerchantGiftRedeemShareUrl(card, plain) || result.shareUrl?.trim() || null
				setIssuedCode(plain)
				setIssuedShareUrl(claimUrl)
				setIssuedTopupCreditE6(result.topupCreditE6 ?? topupPrincipalE6)
				await deliverGiftChatIfNeeded(plain, claimUrl, Number(parsed.apiAmount))
				onSuccess?.()
				return
			}

			const { usdc, usdc6 } = await quoteCurrencyAmountInUSDCFair(ccy, parsed.apiAmount)
			let conetBal = await readEoaConetUsdcBalance6(profile as profile)
			let baseBal = 0n
			try {
				baseBal = await readEoaUsdcBalance6(profile as profile)
			} catch {
				baseBal = 0n
			}
			const combined = conetBal + baseBal
			if (combined < usdc6) {
				setPanelError(
					`Insufficient USDC. Need about ${usdc} USDC across CoNET and Base; available ~$${formatQuotedUsdc6ForDisplay(combined)} USDC.`,
				)
				return
			}

			// CoNET-USDC shortfall: bridge Base USDC → EOA CoNET-USDC, then pay full gift in CoNET-USDC.
			if (conetBal < usdc6) {
				const shortfall = usdc6 - conetBal
				if (baseBal < shortfall) {
					setPanelError(
						`Insufficient USDC. Need about ${usdc} USDC; CoNET ~$${formatQuotedUsdc6ForDisplay(conetBal)}, Base ~$${formatQuotedUsdc6ForDisplay(baseBal)}.`,
					)
					return
				}
				const eoa =
					(typeof profile?.keyID === 'string' && ethers.isAddress(profile.keyID)
						? ethers.getAddress(profile.keyID)
						: '') || new ethers.Wallet(pk).address
				setUsdcSubmitHint(
					`Moving ~$${formatQuotedUsdc6ForDisplay(shortfall)} USDC…`,
				)
				const deposit = await payWalletUsdcDepositWithLocalWallet({
					profile: profile as profile,
					privateKeyArmor: pk,
					beneficiaryEoa: eoa,
					usdcAmount6: shortfall,
				})
				if (!deposit.ok) {
					setUsdcSubmitHint(null)
					setPanelError(deposit.error)
					return
				}
				setUsdcSubmitHint('Waiting for USDC…')
				const poll = await pollUntilEoaConetUsdcAtLeast({
					profile: profile as profile,
					minBalance6: usdc6,
					onProgress: (label) => setUsdcSubmitHint(label),
				})
				setUsdcSubmitHint(null)
				if (poll === 'cancelled') {
					setPanelError('Payment cancelled.')
					return
				}
				if (poll !== 'ok') {
					setPanelError(
						'USDC deposit is still confirming. Please try again in a moment.',
					)
					return
				}
				conetBal = await readEoaConetUsdcBalance6(profile as profile)
				if (conetBal < usdc6) {
					setPanelError(
						`USDC is still short after deposit. Need about ${usdc} USDC; balance is ~$${formatQuotedUsdc6ForDisplay(conetBal)}.`,
					)
					return
				}
			}

			setUsdcSubmitHint('Signing USDC payment…')
			const auth = await USDC2Token(pk, usdc, card)
			setUsdcSubmitHint(null)
			const result = await postPurchaseMerchantGiftRedeem({
				cardAddress: card,
				from: auth.from,
				payWith: 'usdc',
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
			const claimUrl =
				buildMerchantGiftRedeemShareUrl(card, plain) || result.shareUrl?.trim() || null
			setIssuedCode(plain)
			setIssuedShareUrl(claimUrl)
			setIssuedTopupCreditE6(result.topupCreditE6 ?? topupPrincipalE6)
			await deliverGiftChatIfNeeded(plain, claimUrl, Number(parsed.apiAmount))
			onSuccess?.()
		} catch (e) {
			setUsdcSubmitHint(null)
			setPanelError((e as Error)?.message ?? 'Gift purchase failed.')
		} finally {
			submitInFlightRef.current = false
			setSubmitting(false)
			setUsdcSubmitHint(null)
		}
	}

	const deliverGiftChatIfNeeded = async (
		_redeemPlain: string,
		claimUrl: string | null,
		amountHuman: number,
	) => {
		setChatDeliveryHint(null)
		if (deliveryMode !== 'friend' || !selectedFriend || !claimUrl?.trim()) return
		const signingPk =
			resolveSigningPrivateKeyArmor(profile as profile) ||
			resolveSigningPrivateKeyArmor(profiles?.[0])
		const profileList = profiles?.length ? profiles : profile ? [profile as profile] : []
		if (!signingPk || !profileList.length) {
			setChatDeliveryHint(
				'Gift purchased. Could not send chat — share the claim link with your friend.',
			)
			return
		}
		const chatRet = await sendMerchantGiftRedeemChat({
			profiles: profileList,
			setProfiles,
			allNodes: allNodes ?? [],
			friend: selectedFriend,
			privateKeyArmor: signingPk,
			amount: Number.isFinite(amountHuman) ? amountHuman : Number(previewAmount) || 0,
			currency: ccy,
			merchantTitle: merchantLabel,
			claimUrl,
			note: giftNote,
		})
		if (!chatRet.ok) {
			setChatDeliveryHint(
				chatRet.error ??
					'Gift purchased. Share the claim link if the chat message did not send.',
			)
		}
	}

	const creditFeeLabel = useMemo(() => {
		if (!giftFacePreview || !creditPayEnabled) return null
		const fee = computeGiftCreditMerchantFeeE6(giftCreditConfig, giftFacePreview.giftFaceE6)
		if (fee <= 0n) return `${prefix}0.00`
		return `${prefix}${membershipFeeE6ToHuman(fee.toString()) || ethers.formatUnits(fee, 6)}`
	}, [giftFacePreview, creditPayEnabled, giftCreditConfig, prefix])

	const payTotalLabel = useMemo(() => {
		if (!giftFacePreview) return `${prefix}${previewAmount}`
		if (payWith === 'credit' && creditPayEnabled) {
			const burn = giftFacePreview.burnAmountE6
			return `${prefix}${membershipFeeE6ToHuman(burn.toString()) || ethers.formatUnits(burn, 6)} store credit`
		}
		return usdcQuoteLabel ?? `${prefix}${previewAmount}`
	}, [giftFacePreview, payWith, creditPayEnabled, prefix, previewAmount, usdcQuoteLabel])

	const payCtaLabel =
		payWith === 'credit' ? 'Confirm & pay with store credit' : 'Confirm & pay with USDC'

	const stepPill = (n: GiftFlowStep, label: string) => (
		<div className="mb-3 inline-flex items-center gap-1.5 self-start rounded-full bg-[#dbe1ff] px-2.5 py-1 text-[#00184a]">
			<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#004bc3]" aria-hidden />
			<span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
				Step {n} of 3 · {label}
			</span>
		</div>
	)

	const brandGiftCard = (
		<div
			className="relative mb-6 overflow-hidden rounded-2xl p-5 shadow-xl"
			style={{ backgroundColor: brandColor, color: onBrandText, boxShadow: brandShadow }}
		>
			<div className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
			<div className="pointer-events-none absolute -bottom-6 -left-6 h-36 w-36 rounded-full bg-black/10 blur-xl" />
			<div className="relative z-10 flex min-h-[164px] flex-col justify-between">
				<div className="flex items-start justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2.5">
						<div
							className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
							style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
						>
							<Gift className="h-5 w-5" strokeWidth={2} aria-hidden />
						</div>
						<div className="min-w-0">
							<p className="truncate text-[17px] font-semibold leading-tight" style={{ color: onBrandText }}>
								{merchantLabel}
							</p>
							<span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: onBrandMuted }}>
								Digital gift voucher
							</span>
						</div>
					</div>
					<div
						className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1"
						style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
					>
						<ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
						<span className="text-[10px] font-semibold uppercase tracking-wide">Face value</span>
					</div>
				</div>
				<div className="mt-6 flex items-end justify-between gap-3">
					<div>
						<span
							className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wider"
							style={{ color: onBrandMuted }}
						>
							Gift balance
						</span>
						<div className="flex items-baseline gap-1">
							<span className="text-[15px] font-bold" style={{ color: onBrandText }}>
								{prefix}
							</span>
							<span className="text-[34px] font-bold leading-none tracking-tight" style={{ color: onBrandText }}>
								{previewAmount}
							</span>
						</div>
					</div>
					<div className="text-right">
						<span
							className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
							style={{ backgroundColor: 'rgba(0,0,0,0.25)', color: onBrandMuted }}
						>
							Digital pass
						</span>
						<p className="mt-1 text-[11px] font-semibold" style={{ color: onBrandText }}>
							{activeOccasion.emoji} {activeOccasion.label}
						</p>
					</div>
				</div>
			</div>
		</div>
	)

	/* ─── Success ─── */
	if (issuedCode) {
		const creditHuman = issuedTopupCreditE6
			? membershipFeeE6ToHuman(issuedTopupCreditE6) ||
				formatAmount(Number(ethers.formatUnits(issuedTopupCreditE6, 6)), ccy)
			: null
		const claimUrl = issuedShareUrl?.trim() ?? ''
		const friendTag = (selectedFriend?.username ?? '').trim()
		const friendName = selectedFriend ? beamioSearchDisplayName(selectedFriend) : ''
		const successDirect = deliveryMode === 'friend' && !!selectedFriend

		return (
			<section className="mx-auto flex w-full max-w-lg flex-col gap-5" aria-label="Gift ready">
				<header className="flex flex-col items-center px-0.5 pt-1 text-center">
					<div className="relative mb-3 flex h-16 w-16 items-center justify-center">
						<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-200/50" />
						<div
							className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
							style={{ backgroundColor: brandControl, color: onBrandText, boxShadow: brandControlShadow }}
						>
							<Check className="h-7 w-7" strokeWidth={2.5} aria-hidden />
						</div>
					</div>
					<div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
						{successDirect ? 'Direct gift ready' : 'Claim link ready'}
					</div>
					<h2 className="text-[22px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100 sm:text-[24px]">
						{successDirect && friendTag ? `Gift ready for @${friendTag}` : 'Gift voucher ready'}
					</h2>
					<p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[#6b7280] dark:text-slate-400">
						{prefix}
						{previewAmount} {merchantLabel} gift
						{creditHuman ? ` — about ${prefix}${creditHuman} store credit after claim` : ''}
						{successDirect && friendName ? `. Share with ${friendName}.` : '. Share the link or code.'}
					</p>
					{chatDeliveryHint ? (
						<div
							role="alert"
							className="mt-3 flex w-full max-w-sm items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-left dark:border-amber-800 dark:bg-amber-950/40"
						>
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
							<p className="text-[12px] leading-snug text-amber-900 dark:text-amber-100">{chatDeliveryHint}</p>
						</div>
					) : null}
				</header>

				{successDirect && selectedFriend ? (
					<div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
						<GiftFriendCapsule item={selectedFriend} onClear={() => setSelectedFriend(null)} />
						<p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
							Anyone with the claim link or code can redeem — share privately with your friend.
						</p>
					</div>
				) : null}

				<div
					className="overflow-hidden rounded-[20px] px-4 pb-4 pt-3.5"
					style={{ backgroundColor: brandColor, color: onBrandText, boxShadow: brandShadow }}
				>
					<div className="flex items-center justify-between gap-2">
						<span
							className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
							style={{ backgroundColor: brandControl, color: onBrandText }}
						>
							Gift
						</span>
						<p className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold tracking-tight">
							{merchantLabel}
						</p>
						<span className="w-[4.5rem] shrink-0" aria-hidden />
					</div>
					{giftNote.trim() ? (
						<p className="mt-3 line-clamp-3 text-[13px] italic leading-snug" style={{ color: onBrandMuted }}>
							“{giftNote.trim()}”
						</p>
					) : null}
					<p
						className="mt-4 break-all rounded-xl bg-white/[0.08] px-4 py-3 font-mono text-[15px] font-semibold tracking-wide ring-1 ring-white/10"
						style={{ color: onBrandText }}
					>
						{issuedCode}
					</p>
				</div>

				{claimUrl ? (
					<div className="flex flex-col items-center gap-3 rounded-[20px] border border-[#e8ecf0] bg-white px-4 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
						<p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9ca3af]">
							Instant claim link
						</p>
						<div className="rounded-[20px] bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.12)] ring-1 ring-slate-100">
							<QRCodeCanvas
								value={claimUrl}
								size={200}
								level="H"
								includeMargin={false}
								bgColor="#ffffff"
								fgColor="#0F172A"
								imageSettings={{
									src: beamioQrLogo,
									height: 48,
									width: 48,
									excavate: true,
								}}
								className="block"
							/>
						</div>
						<p className="w-full break-all px-1 text-center text-[11px] leading-snug text-[#6b7280] dark:text-slate-400">
							{claimUrl}
						</p>
					</div>
				) : null}

				<div className="flex flex-col gap-2.5">
					{claimUrl ? (
						<button
							type="button"
							onClick={() => void handleCopyClaimLink()}
							className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-bold transition active:scale-[0.98]"
							style={{
								backgroundColor: brandControl,
								color: onBrandText,
								boxShadow: brandControlShadow,
							}}
						>
							{copyLinkStatus === 'ok' ? (
								<Check className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
							) : (
								<Link2 className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
							)}
							<span>{copyLinkStatus === 'ok' ? 'Claim link copied' : 'Copy claim link'}</span>
						</button>
					) : null}
					<button
						type="button"
						onClick={() => void handleShare()}
						className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e8ecf0] bg-white px-5 py-3 text-[14px] font-semibold text-[#0F172A] shadow-sm transition active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
					>
						<Share2 className="h-4 w-4 text-[#6b7280]" strokeWidth={2.25} aria-hidden />
						Share
					</button>
					<button
						type="button"
						onClick={() => void handleCopyCode()}
						className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e8ecf0] bg-white px-5 py-3 text-[14px] font-semibold text-[#0F172A] shadow-sm transition active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
					>
						{copyCodeStatus === 'ok' ? (
							<Check className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.25} aria-hidden />
						) : (
							<Copy className="h-4 w-4 shrink-0 text-[#6b7280]" strokeWidth={2.25} aria-hidden />
						)}
						<span>{copyCodeStatus === 'ok' ? 'Code copied' : 'Copy gift code'}</span>
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

	/* ─── Step 1: Configure ─── */
	if (step === 1) {
		return (
			<section className="mx-auto flex w-full max-w-lg flex-col gap-1 pb-4" aria-label="Configure gift">
				{stepPill(1, 'Configure Gift')}
				<h2 className="text-[28px] font-bold leading-tight tracking-tight text-[#0F172A] dark:text-slate-100">
					Send a Gift Card
				</h2>
				<p className="mt-0.5 text-[15px] text-[#5d5e63] dark:text-slate-400">
					Curated store credit for {merchantLabel}
				</p>

				<div className="mt-4">{brandGiftCard}</div>

				<section className="mb-6 flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<label className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider text-[#5d5e63]">
							<span className="text-[#004bc3]">1.</span> Select gift amount
						</label>
						<span className="flex items-center gap-0.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
							Instant mint
						</span>
					</div>
					<div className="grid grid-cols-4 gap-2">
						{visiblePresets.map((n) => {
							const active = presetAmount === n && !Number.isNaN(Number(amountText)) && Number(amountText) === n
							return (
								<button
									key={n}
									type="button"
									onClick={() => selectPreset(n)}
									className={`flex flex-col items-center justify-center rounded-xl px-1 py-3 transition ${
										active ? 'scale-[1.02] shadow-md' : 'bg-[#f4f3f8] text-[#1a1b1f] hover:bg-[#eeedf3] dark:bg-slate-800 dark:text-slate-100'
									}`}
									style={
										active
											? { backgroundColor: brandControl, color: onBrandText, boxShadow: brandControlShadow }
											: undefined
									}
								>
									<span
										className={`text-[12px] font-semibold ${active ? '' : 'text-[#5d5e63]'}`}
										style={active ? { color: onBrandMuted } : undefined}
									>
										{prefix}
									</span>
									<span className="text-[22px] font-semibold leading-none">{n}</span>
								</button>
							)
						})}
					</div>
					<div className="relative w-full">
						<div className="flex items-center rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-700">
							<span className="mr-2 text-[17px] text-[#5d5e63]">{prefix}</span>
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
									setPresetAmount(null)
									setAmountText(e.target.value)
									setPanelError(null)
								}}
								onKeyDown={preventNumericInputStepKeys}
								onWheel={preventNumericInputWheelStep}
								className="w-full bg-transparent text-[17px] text-[#1a1b1f] outline-none placeholder:text-[#5d5e63]/60 dark:text-slate-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
								placeholder="Or enter custom amount"
							/>
							<span className="rounded bg-[#eeedf3] px-2 py-0.5 text-[11px] font-semibold uppercase text-[#5d5e63] dark:bg-slate-700 dark:text-slate-300">
								Custom
							</span>
						</div>
					</div>
					<div className="flex items-center gap-1.5 px-1">
						<Check className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
						<p className="text-[15px] text-[#5d5e63] dark:text-slate-400">
							100% face value received by your recipient
							{isFeeCard ? ` · min ${prefix}${minHuman}` : ''}
						</p>
					</div>
				</section>

				<section className="mb-6 flex flex-col gap-3">
					<label className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider text-[#5d5e63]">
						<span className="text-[#004bc3]">2.</span> Personal message & occasion
					</label>
					<div className="flex items-center gap-2 overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						{GIFT_OCCASIONS.map((occ) => {
							const active = occasionId === occ.id
							return (
								<button
									key={occ.id}
									type="button"
									onClick={() => selectOccasion(occ)}
									className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[15px] transition ${
										active
											? 'shadow-sm'
											: 'bg-[#f4f3f8] text-[#1a1b1f] hover:bg-[#eeedf3] dark:bg-slate-800 dark:text-slate-100'
									}`}
									style={
										active
											? { backgroundColor: brandControl, color: onBrandText }
											: undefined
									}
								>
									<span>{occ.emoji}</span>
									<span>{occ.label}</span>
								</button>
							)
						})}
					</div>
					<div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-700">
						<label
							className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-[#5d5e63]"
							htmlFor="discover-gift-note"
						>
							Note to recipient
						</label>
						<textarea
							id="discover-gift-note"
							rows={3}
							maxLength={200}
							value={giftNote}
							onChange={(e) => setGiftNote(e.target.value)}
							className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[#1a1b1f] outline-none dark:text-slate-100"
						/>
						<div className="mt-2 flex items-center justify-between pt-2">
							<button
								type="button"
								onClick={() => setGiftNote(activeOccasion.message(merchantLabel))}
								className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide transition"
								style={{ color: brandControl }}
							>
								<Sparkles className="h-4 w-4" aria-hidden />
								Reset template
							</button>
							<span className="text-[12px] font-semibold text-[#5d5e63]">
								{giftNote.length}/200
							</span>
						</div>
					</div>
				</section>

				{panelError ? (
					<div
						role="alert"
						className="mb-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
					>
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
						<p>{panelError}</p>
					</div>
				) : null}

				<button
					type="button"
					onClick={goStep2}
					className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[17px] font-semibold shadow-lg transition active:scale-[0.99]"
					style={{
						backgroundColor: brandControl,
						color: onBrandText,
						boxShadow: brandControlShadow,
					}}
				>
					<span>Continue to delivery method</span>
					<ChevronRight className="h-5 w-5" strokeWidth={2.25} aria-hidden />
				</button>
			</section>
		)
	}

	/* ─── Step 2: Delivery ─── */
	if (step === 2) {
		return (
			<section className="mx-auto flex w-full max-w-lg flex-col gap-1 pb-4" aria-label="Choose delivery">
				{stepPill(2, 'Delivery Method')}
				<h2 className="text-[28px] font-bold leading-tight tracking-tight text-[#0F172A] dark:text-slate-100">
					Choose Delivery Method
				</h2>
				<p className="mt-0.5 text-[15px] text-[#5d5e63] dark:text-slate-400">
					Gifting{' '}
					<span className="font-semibold" style={{ color: brandControl }}>
						{prefix}
						{previewAmount} {merchantLabel} voucher
					</span>
				</p>

				<div className="relative mb-5 mt-4 overflow-hidden rounded-xl bg-[#f4f3f8] p-3.5 shadow-sm dark:bg-slate-800">
					<div className="flex items-center gap-3">
						<div
							className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg"
							style={{ backgroundColor: brandColor, color: onBrandText }}
						>
							<Gift className="h-6 w-6" aria-hidden />
						</div>
						<div className="flex min-w-0 flex-1 flex-col">
							<div className="flex items-center justify-between gap-1">
								<span className="truncate text-[12px] font-semibold uppercase tracking-wide text-[#1a1b1f] dark:text-slate-100">
									{merchantLabel} voucher
								</span>
								<button
									type="button"
									onClick={() => {
										setStep(1)
										setPanelError(null)
									}}
									className="rounded bg-[#dbe1ff]/40 px-2 py-0.5 text-[12px] font-semibold transition"
									style={{ color: brandControl }}
								>
									Edit
								</button>
							</div>
							<span className="mt-0.5 text-[17px] font-semibold" style={{ color: brandControl }}>
								{prefix}
								{previewAmount}
							</span>
							{giftNote.trim() ? (
								<div className="mt-0.5 flex items-center gap-1 text-[12px] text-[#5d5e63]">
									<MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
									<span className="truncate">Includes personalized greeting note</span>
								</div>
							) : null}
						</div>
					</div>
				</div>

				<div className="mb-6 flex flex-col gap-3.5">
					{/* Direct @BeamioTag */}
					<button
						type="button"
						onClick={() => {
							setDeliveryMode('friend')
							setPanelError(null)
						}}
						className={`rounded-2xl bg-white p-4 text-left shadow-sm transition dark:bg-slate-900 ${
							deliveryMode === 'friend' ? 'shadow-md ring-2' : 'ring-1 ring-slate-100 dark:ring-slate-700'
						}`}
						style={deliveryMode === 'friend' ? { borderColor: brandControl, outlineColor: brandControl } : undefined}
						aria-pressed={deliveryMode === 'friend'}
					>
						<div className="mb-2.5 flex items-start justify-between gap-3">
							<div className="flex items-center gap-3">
								<div
									className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm"
									style={
										deliveryMode === 'friend'
											? { backgroundColor: brandControl, color: onBrandText }
											: { backgroundColor: '#eeedf3', color: '#424655' }
									}
								>
									<AtSign className="h-6 w-6" strokeWidth={2} aria-hidden />
								</div>
								<div>
									<div
										className="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
										style={
											deliveryMode === 'friend'
												? { backgroundColor: '#dbe1ff', color: '#00184a' }
												: { backgroundColor: '#eeedf3', color: '#5d5e63' }
										}
									>
										{deliveryMode === 'friend' ? (
											<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#004bc3]" />
										) : null}
										Direct · share with a friend
									</div>
									<h3 className="text-[16px] font-semibold leading-snug text-[#1a1b1f] dark:text-slate-100">
										Direct transfer to @BeamioTag
									</h3>
								</div>
							</div>
							<div
								className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
									deliveryMode === 'friend' ? '' : 'bg-[#eeedf3] dark:bg-slate-700'
								}`}
								style={
									deliveryMode === 'friend'
										? { backgroundColor: brandControl, color: onBrandText }
										: undefined
								}
							>
								{deliveryMode === 'friend' ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : null}
							</div>
						</div>
						<p className="mb-3 text-[13px] leading-relaxed text-[#424655] dark:text-slate-400">
							Pick a Beamio friend so your share message is personalized. The claim link still works for
							anyone you send it to.
						</p>
						{deliveryMode === 'friend' ? (
							<div className="flex flex-col gap-3 rounded-xl bg-[#f4f3f8]/70 p-3 dark:bg-slate-800/70">
								{selectedFriend ? (
									<GiftFriendCapsule
										item={selectedFriend}
										onClear={() => setSelectedFriend(null)}
									/>
								) : (
									<div className="relative">
										<label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-[#5d5e63]">
											Recipient tag or address
										</label>
										<div className="relative">
											<span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] font-bold text-[#004bc3]">
												@
											</span>
											<input
												type="search"
												value={friendQuery}
												onChange={(e) => setFriendQuery(e.target.value)}
												placeholder="BeamioTag or address"
												autoComplete="off"
												className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-10 text-[16px] font-semibold text-[#1a1b1f] outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
											/>
											{friendLoading ? (
												<Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#6b7280]" aria-hidden />
											) : (
												<Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" aria-hidden />
											)}
										</div>
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
																setPanelError(null)
															}}
														/>
													</li>
												))}
											</ul>
										) : null}
									</div>
								)}
							</div>
						) : null}
					</button>

					{/* Shareable link */}
					<button
						type="button"
						onClick={() => {
							setDeliveryMode('link')
							setPanelError(null)
						}}
						className={`rounded-2xl bg-white p-4 text-left shadow-sm transition dark:bg-slate-900 ${
							deliveryMode === 'link' ? 'shadow-md ring-2' : 'ring-1 ring-slate-100 dark:ring-slate-700'
						}`}
						style={deliveryMode === 'link' ? { borderColor: brandControl } : undefined}
						aria-pressed={deliveryMode === 'link'}
					>
						<div className="mb-2.5 flex items-start justify-between gap-3">
							<div className="flex items-center gap-3">
								<div
									className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
									style={
										deliveryMode === 'link'
											? { backgroundColor: brandControl, color: onBrandText }
											: { backgroundColor: '#eeedf3', color: '#424655' }
									}
								>
									<Link2 className="h-6 w-6" strokeWidth={2} aria-hidden />
								</div>
								<div>
									<div
										className="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
										style={
											deliveryMode === 'link'
												? { backgroundColor: '#dbe1ff', color: '#00184a' }
												: { backgroundColor: '#eeedf3', color: '#5d5e63' }
										}
									>
										Anyone can claim · link delivery
									</div>
									<h3 className="text-[16px] font-semibold leading-snug text-[#1a1b1f] dark:text-slate-100">
										Create instant gift link
									</h3>
								</div>
							</div>
							<div
								className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
									deliveryMode === 'link' ? '' : 'bg-[#eeedf3] dark:bg-slate-700'
								}`}
								style={
									deliveryMode === 'link'
										? { backgroundColor: brandControl, color: onBrandText }
										: undefined
								}
							>
								{deliveryMode === 'link' ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : null}
							</div>
						</div>
						<p className="text-[13px] leading-relaxed text-[#424655] dark:text-slate-400">
							Generate a smart claim link to share via any messenger. Your friend can claim in Beamio
							Discover with the link or code.
						</p>
					</button>
				</div>

				{panelError ? (
					<div
						role="alert"
						className="mb-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
					>
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
						<p>{panelError}</p>
					</div>
				) : null}

				<button
					type="button"
					onClick={goStep3}
					className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[16px] font-semibold shadow-lg transition active:scale-[0.99]"
					style={{
						backgroundColor: brandControl,
						color: onBrandText,
						boxShadow: brandControlShadow,
					}}
				>
					<span>
						Proceed to checkout ({prefix}
						{previewAmount})
					</span>
					<ChevronRight className="h-5 w-5" strokeWidth={2.25} aria-hidden />
				</button>
			</section>
		)
	}

	/* ─── Step 3: Checkout ─── */
	return (
		<section className="mx-auto flex w-full max-w-lg flex-col gap-1 pb-8" aria-label="Gift checkout">
			{stepPill(3, 'Smart Checkout')}
			<div className="mb-1 flex flex-wrap items-center gap-2">
				<span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
					<ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
					Offline sign · gas sponsored
				</span>
			</div>
			<h2 className="text-[22px] font-semibold tracking-tight text-[#0F172A] dark:text-slate-100">
				Checkout & settlement
			</h2>
			<p className="text-[15px] text-[#5d5e63] dark:text-slate-400">
				{merchantLabel} digital gift card
				{deliveryMode === 'friend' && selectedFriend?.username
					? ` · to @${selectedFriend.username.trim()}`
					: ' · shareable claim link'}
			</p>

			{deliveryMode === 'friend' && selectedFriend ? (
				<div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
					<p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#5d5e63]">
						Target recipient
					</p>
					<GiftFriendCapsule item={selectedFriend} onClear={() => setSelectedFriend(null)} />
				</div>
			) : null}

			<div className="mt-4">{brandGiftCard}</div>

			<div className="mb-6 flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-semibold tracking-tight text-[#1a1b1f] dark:text-slate-100">
						Select settlement asset
					</h3>
					<span className="text-xs font-medium text-[#5d5e63]">Offline signature</span>
				</div>

				<button
					type="button"
					onClick={() => {
						setPayWith('usdc')
						setPanelError(null)
					}}
					disabled={submitting}
					className={`rounded-2xl p-4 text-left transition ${
						payWith === 'usdc'
							? 'bg-white shadow-md ring-2 dark:bg-slate-900'
							: 'bg-[#f4f3f8] hover:bg-white dark:bg-slate-800'
					}`}
					style={payWith === 'usdc' ? { outlineColor: brandControl } : undefined}
				>
					<div className="flex items-start justify-between gap-3">
						<div className="flex items-start gap-3">
							<div
								className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
								style={{ backgroundColor: '#dbe1ff', color: '#004bc3' }}
							>
								<Wallet className="h-5 w-5" strokeWidth={2} aria-hidden />
							</div>
							<div>
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-base font-semibold text-[#1a1b1f] dark:text-slate-100">
										USDC
									</span>
									<span className="rounded-full bg-[#dbe1ff] px-2 py-0.5 text-[11px] font-semibold text-[#00184a]">
										EOA
									</span>
								</div>
								<p className="mt-1 text-xs text-[#5d5e63]">
									{usdcAvailableLabel ??
										usdcQuoteLabel ??
										'Quoted in USDC at checkout'}
								</p>
								{usdcAvailableLabel && usdcQuoteLabel ? (
									<p className="mt-0.5 text-xs text-[#5d5e63]">{usdcQuoteLabel}</p>
								) : null}
							</div>
						</div>
						{payWith === 'usdc' ? (
							<span className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-700">
								<Check className="h-3.5 w-3.5" aria-hidden /> Selected
							</span>
						) : null}
					</div>
				</button>

				{creditPayEnabled ? (
					<button
						type="button"
						onClick={() => {
							setPayWith('credit')
							setPanelError(null)
						}}
						disabled={submitting}
						className={`rounded-2xl p-4 text-left transition ${
							payWith === 'credit'
								? 'bg-white shadow-md ring-2 dark:bg-slate-900'
								: 'bg-[#f4f3f8] hover:bg-white dark:bg-slate-800'
						}`}
					>
						<div className="flex items-start justify-between gap-3">
							<div className="flex items-start gap-3">
								<div
									className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
									style={{ backgroundColor: brandColor, color: onBrandText }}
								>
									<Gift className="h-5 w-5" strokeWidth={2} aria-hidden />
								</div>
								<div>
									<div className="flex flex-wrap items-center gap-2">
										<span className="text-base font-semibold text-[#1a1b1f] dark:text-slate-100">
											Store credit ({merchantLabel})
										</span>
										{giftCreditConfig.feeKind === 'percent' && giftCreditConfig.percentBps > 0 ? (
											<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
												{(giftCreditConfig.percentBps / 100).toFixed(2)}% gift fee
											</span>
										) : null}
									</div>
									<p className="mt-1 text-xs text-[#5d5e63]">
										{aaPoints0Loading
											? 'Checking Smart Wallet #0…'
											: aaPoints0Bal != null
												? `Available: ${prefix}${
														membershipFeeE6ToHuman(aaPoints0Bal.toString()) ||
														ethers.formatUnits(aaPoints0Bal, 6)
													}`
												: 'Burn #0 from your Smart Wallet'}
										{giftFacePreview && payWith === 'credit'
											? ` · Burn about ${prefix}${
													membershipFeeE6ToHuman(giftFacePreview.burnAmountE6.toString()) ||
													ethers.formatUnits(giftFacePreview.burnAmountE6, 6)
												}`
											: ''}
									</p>
								</div>
							</div>
							{payWith === 'credit' ? (
								<span className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-700">
									<Check className="h-3.5 w-3.5" aria-hidden /> Selected
								</span>
							) : null}
						</div>
					</button>
				) : null}
			</div>

			{isFeeCard ? (
				<div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
					<div className="flex items-start gap-3">
						<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-amber-800">
							<AlertTriangle className="h-4 w-4" aria-hidden />
						</div>
						<div>
							<h4 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
								Membership fee card
							</h4>
							<p className="mt-1.5 text-xs leading-relaxed text-amber-950/80 dark:text-amber-100/80">
								Non-members may receive membership from the fee portion of this gift; existing members
								typically receive full store credit toward #0. Minimum gift is {prefix}
								{minHuman}.
							</p>
						</div>
					</div>
				</div>
			) : null}

			<div className="mb-6 flex flex-col gap-3.5 rounded-2xl bg-[#f4f3f8] p-5 shadow-sm dark:bg-slate-800">
				<div className="flex items-center justify-between pb-1">
					<div className="flex items-center gap-2">
						<span className="text-sm font-semibold text-[#1a1b1f] dark:text-slate-100">Settlement ledger</span>
					</div>
					<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
						No hidden fees
					</span>
				</div>
				<div className="flex items-center justify-between text-xs">
					<span className="text-[#5d5e63]">Gift face value</span>
					<span className="font-semibold text-[#1a1b1f] dark:text-slate-100">
						{prefix}
						{previewAmount}
					</span>
				</div>
				{payWith === 'credit' && creditPayEnabled ? (
					<div className="flex items-center justify-between text-xs">
						<span className="text-[#5d5e63]">Merchant gift fee</span>
						<span className="font-semibold" style={{ color: brandControl }}>
							{creditFeeLabel ? `+ ${creditFeeLabel}` : '—'}
						</span>
					</div>
				) : null}
				<div className="flex items-center justify-between text-xs">
					<span className="text-[#5d5e63]">Network gas</span>
					<span className="font-semibold text-emerald-700 dark:text-emerald-400">Free (sponsored)</span>
				</div>
				<div className="my-1 h-px bg-slate-200 dark:bg-slate-600" />
				<div className="flex items-center justify-between text-sm">
					<span className="font-semibold text-[#1a1b1f] dark:text-slate-100">Total deducted</span>
					<span className="text-base font-bold" style={{ color: brandControl }}>
						{payTotalLabel}
					</span>
				</div>
			</div>

			{usdcSubmitHint && payWith === 'usdc' ? (
				<div
					className="mb-3 flex gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200"
					aria-live="polite"
				>
					<Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
					<p>{usdcSubmitHint}</p>
				</div>
			) : null}

			{panelError ? (
				<div
					role="alert"
					className="mb-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
				>
					<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
					<p>{panelError}</p>
				</div>
			) : null}

			<button
				type="button"
				onClick={() => void handlePurchase()}
				disabled={submitting}
				aria-busy={submitting}
				className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
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
				<span>
					{submitting
						? usdcSubmitHint && payWith === 'usdc'
							? usdcSubmitHint
							: 'Creating gift…'
						: payCtaLabel}
				</span>
				{!submitting ? <ChevronRight className="h-5 w-5 opacity-80" strokeWidth={2.25} aria-hidden /> : null}
			</button>
			<p className="mt-2 text-center text-[12px] font-medium leading-snug text-emerald-700 dark:text-emerald-400">
				You only sign offline — no network gas for you or the recipient.
			</p>
		</section>
	)
}
