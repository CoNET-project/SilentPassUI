import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, WheelEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
	Utensils,
	Wallet,
	X,
	Lock,
	CheckCircle2,
	Flower2,
	Receipt,
	MessageCircle,
	Store,
} from 'lucide-react'
import {
	classifyDiscoverMerchantCategory,
	discoverProgramDescriptionFromMetadata,
	parseDiscoverPrimaryCategoryId,
	type DiscoverCategoryTab,
} from '@/utils/discoverMerchantCategory'
import { pickNonFactoryMerchantAssetUrl } from '@/utils/isFactoryDefaultMerchantAssetUrl'
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
	discoverMixCssColorWithWhite,
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

type GiftStep1Kind = 'generic' | 'food-beverage' | 'health-beauty'

type GiftThemedOccasion = GiftOccasion & {
	subtitle: string
}

type GiftAmountChip = { value: number; caption: string }

const FOOD_OCCASIONS: GiftThemedOccasion[] = [
	{
		id: 'treat-meal',
		emoji: '🍽️',
		label: 'Treat a Meal',
		subtitle: 'Warm comfort',
		message: (m) => `Lunch is on me! Enjoy the best dishes at ${m}.`,
	},
	{
		id: 'birthday',
		emoji: '🎂',
		label: 'Happy Birthday',
		subtitle: 'Sweet surprise',
		message: (m) => `Happy birthday! Enjoy a delicious meal at ${m} — my treat.`,
	},
	{
		id: 'coffee',
		emoji: '☕',
		label: 'Coffee & Drinks',
		subtitle: 'Casual sip',
		message: (m) => `Coffee is on me at ${m}. Enjoy a casual sip!`,
	},
	{
		id: 'celebrate',
		emoji: '🎉',
		label: 'Celebrate',
		subtitle: 'Big milestone',
		message: (m) => `Let’s celebrate at ${m}. Dinner is on me!`,
	},
]

const HEALTH_OCCASIONS: GiftThemedOccasion[] = [
	{
		id: 'self-care',
		emoji: '🛁',
		label: 'Self-Care Day',
		subtitle: 'Warm pampering',
		message: (m) => `Take some time to relax and recharge at ${m}. You deserve it!`,
	},
	{
		id: 'birthday',
		emoji: '🎂',
		label: 'Happy Birthday',
		subtitle: 'Sweet glow surprise',
		message: (m) => `Happy birthday! A little pampering at ${m} — enjoy glowing self-care.`,
	},
	{
		id: 'recovery',
		emoji: '🌿',
		label: 'Recovery & Reset',
		subtitle: 'Post-workout / therapy',
		message: (m) => `Wishing you full recovery and deep renewal at ${m}.`,
	},
	{
		id: 'just-because',
		emoji: '💝',
		label: 'Just Because',
		subtitle: 'A thoughtful treat',
		message: (m) => `Just because. Enjoy this wellness gift at ${m}.`,
	},
]

const FOOD_AMOUNT_CHIPS: GiftAmountChip[] = [
	{ value: 25, caption: 'Quick bite' },
	{ value: 50, caption: 'Most Popular' },
	{ value: 100, caption: 'Full dinner' },
	{ value: 150, caption: 'Feast for two' },
]

const HEALTH_AMOUNT_CHIPS: GiftAmountChip[] = [
	{ value: 50, caption: 'Quick Refresh' },
	{ value: 100, caption: 'Signature Care' },
	{ value: 200, caption: 'Deep Rebalance' },
	{ value: 300, caption: 'Full Transform' },
]

function resolveGiftStep1Kind(
	category?: DiscoverCategoryTab | string | null,
	merchantTitle?: string,
	metadataRoot?: Record<string, unknown> | null,
	programDescriptionHint?: string | null,
): GiftStep1Kind {
	const rawCategoryId = parseDiscoverPrimaryCategoryId(metadataRoot ?? null)
	const classified = classifyDiscoverMerchantCategory({
		name: merchantTitle?.trim() || '',
		programDescription: [
			discoverProgramDescriptionFromMetadata(metadataRoot ?? null),
			typeof programDescriptionHint === 'string' ? programDescriptionHint.trim() : '',
		]
			.filter(Boolean)
			.join('\n'),
		// Only raw metadata ids. A Discover tab like `local-services` is already classified
		// and must not short-circuit dining copy in the program description.
		categoryId: rawCategoryId,
	})
	if (classified === 'food-beverage') return 'food-beverage'
	if (classified === 'health-beauty') return 'health-beauty'
	if (category === 'food-beverage' || category === 'food') return 'food-beverage'
	if (category === 'health-beauty') return 'health-beauty'
	return 'generic'
}

function themeAmountChips(kind: GiftStep1Kind): GiftAmountChip[] {
	if (kind === 'food-beverage') return FOOD_AMOUNT_CHIPS
	if (kind === 'health-beauty') return HEALTH_AMOUNT_CHIPS
	return AMOUNT_PRESETS.map((value) => ({ value, caption: '' }))
}

function occasionSubtitle(occ: GiftOccasion): string {
	return 'subtitle' in occ && typeof (occ as GiftThemedOccasion).subtitle === 'string'
		? (occ as GiftThemedOccasion).subtitle
		: ''
}

function themeDefaultAmount(kind: GiftStep1Kind): number {
	return kind === 'food-beverage' ? 50 : 100
}

function themeCustomBounds(kind: GiftStep1Kind): { min: number; max: number } | null {
	if (kind === 'food-beverage') return { min: 10, max: 1000 }
	if (kind === 'health-beauty') return { min: 20, max: 1500 }
	return null
}

function themeNoteMax(kind: GiftStep1Kind): number {
	return kind === 'generic' ? 200 : 140
}

function themeDefaultOccasionId(kind: GiftStep1Kind): string {
	if (kind === 'food-beverage') return FOOD_OCCASIONS[0]!.id
	if (kind === 'health-beauty') return HEALTH_OCCASIONS[0]!.id
	return GIFT_OCCASIONS[0]!.id
}

function themeOccasionCatalog(kind: GiftStep1Kind): GiftOccasion[] {
	if (kind === 'food-beverage') return FOOD_OCCASIONS
	if (kind === 'health-beauty') return HEALTH_OCCASIONS
	return GIFT_OCCASIONS
}

function formatGiftStartAmount(start: number): string {
	if (!(start > 0)) return ''
	return Number.isInteger(start) ? String(start) : start.toFixed(2)
}

function themeDeliveryLead(
	kind: GiftStep1Kind,
	prefix: string,
	amount: string,
	merchant: string,
): string {
	if (kind === 'food-beverage') {
		return `Choose how your friend receives this ${prefix}${amount} dining treat.`
	}
	if (kind === 'health-beauty') {
		return `Choose how your friend receives this ${prefix}${amount} wellness gift.`
	}
	return `Choose how your friend receives this ${prefix}${amount} voucher at ${merchant}.`
}

function themeRedeemHint(kind: GiftStep1Kind): string {
	if (kind === 'food-beverage') return 'Dine-in & takeout'
	if (kind === 'health-beauty') return 'In-clinic treatments & sessions'
	return 'Redeem at this merchant'
}

function themeStep3PassTitle(kind: GiftStep1Kind): string {
	if (kind === 'food-beverage') return 'Dining Gift Pass'
	if (kind === 'health-beauty') return 'Wellness & Spa Pass'
	return 'Digital Gift Pass'
}

function themeStep3VoucherBadge(kind: GiftStep1Kind): string {
	if (kind === 'health-beauty') return 'Wellness voucher'
	return 'Gift voucher'
}

function themeStep3Lead(kind: GiftStep1Kind, merchant: string, recipientHandle: string | null): string {
	if (kind === 'food-beverage') {
		return recipientHandle
			? `Treating ${recipientHandle} to ${merchant}`
			: `Dining gift card for ${merchant} · shareable claim link`
	}
	if (kind === 'health-beauty') {
		return recipientHandle
			? `Gifting a wellness session to ${recipientHandle} at ${merchant}`
			: `Wellness gift for ${merchant} · shareable claim link`
	}
	return recipientHandle
		? `${merchant} digital gift card · to ${recipientHandle}`
		: `${merchant} digital gift card · shareable claim link`
}

function themeStep3PerkTitle(kind: GiftStep1Kind): string {
	if (kind === 'food-beverage') return 'First-time visitor note'
	if (kind === 'health-beauty') return 'Welcome wellness note'
	return 'Recipient note'
}

function themeStep3PerkBody(kind: GiftStep1Kind, prefix: string, amount: string, merchant: string): string {
	const face = `${prefix}${amount}`
	if (kind === 'food-beverage') {
		return `Your friend receives ${face} dining credit at ${merchant}. Unclaimed gifts return automatically in 24h.`
	}
	if (kind === 'health-beauty') {
		return `Your friend receives ${face} wellness credit at ${merchant}. Unclaimed gifts return automatically in 24h.`
	}
	return `Your friend receives ${face} store credit at ${merchant}. Unclaimed gifts return automatically in 24h.`
}

function chatToFriendSearchResult(chat: chatData): searchResult | null {
	const addr = String(chat.address ?? '').trim()
	if (!addr) return null
	const b = chat.beamio
	return {
		address: addr,
		created_at: b?.created_at ?? 0,
		first_name: b?.first_name ?? '',
		last_name: b?.last_name ?? '',
		image: b?.image ?? '',
		username: String(b?.username ?? '').trim(),
		follow_count: b?.follow_count ?? '',
		follower_count: b?.follower_count ?? '',
	}
}

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
	accentColor,
}: {
	item: searchResult
	onClear: () => void
	accentColor: string
}) {
	const tag = (item.username ?? '').trim()
	const name = beamioSearchDisplayName(item)
	const seed = tag || item.address || '@Beamio'

	return (
		<div
			className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-800"
			style={{ borderColor: `${accentColor}40` }}
		>
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
	category?: DiscoverCategoryTab | string | null
	merchantImage?: string | null
	/** Extra dining / About copy when metadata category is missing or generic. */
	programDescription?: string | null
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
	category,
	merchantImage,
	programDescription,
}: Props) {
	const { profiles, setProfiles, allNodes, setChatHomeItem } = useDaemonContext()
	const navigate = useNavigate()
	const step1Kind = useMemo(
		() => resolveGiftStep1Kind(category, merchantTitle, metadataRoot, programDescription),
		[category, merchantTitle, metadataRoot, programDescription],
	)
	const occasionCatalog = themeOccasionCatalog(step1Kind)
	const spotlightUrl = pickNonFactoryMerchantAssetUrl(merchantImage)
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
	const brandTint = useMemo(
		() => discoverMixCssColorWithWhite(brandControl, 0.82) ?? '#eeedf3',
		[brandControl],
	)
	const brandSelectedRing = useMemo(
		() => `${brandControlShadow}, 0 0 0 2px ${brandControl}`,
		[brandControl, brandControlShadow],
	)
	const minHuman = isFeeCard ? membershipFeeE6ToHuman(baseFeeE6) || '0' : '0.01'
	const minNum = Number(minHuman) || 0

	const giftCreditConfig = useMemo(
		() => parseGiftCreditPurchaseConfig(metadataRoot ?? null),
		[metadataRoot],
	)
	const creditPayEnabled = giftCreditConfig.enabled

	const [step, setStep] = useState<GiftFlowStep>(1)
	const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('link')
	const [occasionId, setOccasionId] = useState(() => themeDefaultOccasionId(step1Kind))
	const [giftNote, setGiftNote] = useState(() => {
		const occ =
			occasionCatalog.find((o) => o.id === themeDefaultOccasionId(step1Kind)) ?? occasionCatalog[0]!
		return occ.message(merchantTitle.trim() || 'this merchant')
	})
	const [presetAmount, setPresetAmount] = useState<number | null>(() => themeDefaultAmount(step1Kind))
	const [amountText, setAmountText] = useState(() => {
		const floor = isFeeCard ? Number(minHuman) || 0 : 0
		const start = Math.max(themeDefaultAmount(step1Kind), floor)
		return formatGiftStartAmount(start)
	})
	const [showDigitalReceipt, setShowDigitalReceipt] = useState(false)
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
	const activeOccasion = occasionCatalog.find((o) => o.id === occasionId) ?? occasionCatalog[0]!

	const visiblePresets = useMemo(
		() => themeAmountChips(step1Kind).filter((chip) => chip.value >= minNum || minNum <= 0),
		[minNum, step1Kind],
	)
	const noteMax = themeNoteMax(step1Kind)
	const appliedStep1KindRef = useRef(step1Kind)

	useEffect(() => {
		if (appliedStep1KindRef.current === step1Kind) return
		appliedStep1KindRef.current = step1Kind
		if (step !== 1 || issuedCode) return
		const occId = themeDefaultOccasionId(step1Kind)
		const catalog = themeOccasionCatalog(step1Kind)
		const occ = catalog.find((o) => o.id === occId) ?? catalog[0]!
		setOccasionId(occId)
		setGiftNote(occ.message(merchantTitle.trim() || 'this merchant'))
		const floor = isFeeCard ? Number(minHuman) || 0 : 0
		const start = Math.max(themeDefaultAmount(step1Kind), floor)
		setPresetAmount(themeDefaultAmount(step1Kind))
		setAmountText(formatGiftStartAmount(start))
	}, [step1Kind, step, issuedCode, merchantTitle, isFeeCard, minHuman])

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
	const recentFriends = useMemo(() => {
		const chats: chatData[] = Array.isArray(profiles?.[0]?.chats) ? profiles[0]!.chats! : []
		const seen = new Set<string>()
		const rows: searchResult[] = []
		const sorted = chats
			.filter((chat) => chat && !chat.hide && String(chat.address ?? '').trim())
			.slice()
			.sort((a, b) => {
				const ta = a.messages?.[a.messages.length - 1]?.createdAt ?? a.beamio?.created_at ?? 0
				const tb = b.messages?.[b.messages.length - 1]?.createdAt ?? b.beamio?.created_at ?? 0
				return tb - ta
			})
		for (const chat of sorted) {
			const item = chatToFriendSearchResult(chat)
			if (!item) continue
			const key = item.address.toLowerCase()
			if (myAddress && key === myAddress) continue
			if (seen.has(key)) continue
			seen.add(key)
			rows.push(item)
			if (rows.length >= 8) break
		}
		return rows
	}, [profiles, myAddress])
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

	const openGiftFriendChat = () => {
		if (!selectedFriend) return
		setChatHomeItem(selectedFriend)
		onClose()
		navigate('/chat')
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
		const bounds = themeCustomBounds(step1Kind)
		if (bounds) {
			const human = Number(ethers.formatUnits(totalE6, 6))
			if (human < bounds.min) {
				setPanelError(`Gift amount must be at least ${prefix}${bounds.min.toFixed(2)}.`)
				return false
			}
			if (human > bounds.max) {
				setPanelError(`Gift amount must be at most ${prefix}${bounds.max.toFixed(2)}.`)
				return false
			}
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
		<div
			className="mb-3 inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1"
			style={{ backgroundColor: brandTint, color: brandControl }}
		>
			<span
				className="h-1.5 w-1.5 animate-pulse rounded-full"
				style={{ backgroundColor: brandControl }}
				aria-hidden
			/>
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
							{step1Kind === 'food-beverage' ? (
								<Utensils className="h-5 w-5" strokeWidth={2} aria-hidden />
							) : step1Kind === 'health-beauty' ? (
								<Flower2 className="h-5 w-5" strokeWidth={2} aria-hidden />
							) : (
								<Gift className="h-5 w-5" strokeWidth={2} aria-hidden />
							)}
						</div>
						<div className="min-w-0">
							<p className="truncate text-[17px] font-semibold leading-tight" style={{ color: onBrandText }}>
								{merchantLabel}
							</p>
							<span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: onBrandMuted }}>
								{step1Kind === 'food-beverage'
									? 'Dining Gift Pass'
									: step1Kind === 'health-beauty'
										? 'Wellness Gift Pass'
										: 'Digital gift voucher'}
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
		const chatSent = successDirect && !chatDeliveryHint
		const friendHandle = friendTag ? `@${friendTag}` : friendName || 'your friend'
		const friendInitial = (friendTag || friendName || 'F').replace(/^@/, '').charAt(0).toUpperCase()
		const wellnessPassBg = discoverMixCssColorWithBlack(brandColor, 0.38) ?? brandColor

		const digitalReceipt = showDigitalReceipt ? (
			<div className="flex flex-col gap-3">
				{claimUrl ? (
					<div className="flex flex-col items-center gap-3 rounded-[20px] border border-[#e8ecf0] bg-white px-4 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
						<p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9ca3af]">
							Digital receipt
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
				<p className="break-all rounded-xl bg-slate-50 px-4 py-3 font-mono text-[15px] font-semibold tracking-wide text-[#0F172A] ring-1 ring-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700">
					{issuedCode}
				</p>
				<div className="flex flex-col gap-2">
					{claimUrl ? (
						<button
							type="button"
							onClick={() => void handleCopyClaimLink()}
							className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e8ecf0] bg-white px-5 py-3 text-[14px] font-semibold text-[#0F172A] shadow-sm transition active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
						>
							{copyLinkStatus === 'ok' ? (
								<Check className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.25} aria-hidden />
							) : (
								<Link2 className="h-4 w-4 shrink-0 text-[#6b7280]" strokeWidth={2.25} aria-hidden />
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
				</div>
			</div>
		) : null

		const themedActions = (
			<div className="flex flex-col gap-3">
				{successDirect ? (
					<button
						type="button"
						onClick={openGiftFriendChat}
						className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[16px] font-bold transition active:scale-[0.99]"
						style={{
							backgroundColor: brandControl,
							color: onBrandText,
							boxShadow: brandControlShadow,
						}}
					>
						<MessageCircle className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
						<span>Say Hi in Chat</span>
					</button>
				) : claimUrl ? (
					<button
						type="button"
						onClick={() => void handleCopyClaimLink()}
						className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[16px] font-bold transition active:scale-[0.99]"
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
					onClick={() => setShowDigitalReceipt(true)}
					disabled={showDigitalReceipt}
					className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#e3e2e7] px-5 py-3.5 text-[14px] font-semibold text-[#0F172A] transition active:scale-[0.99] disabled:cursor-default dark:bg-slate-800 dark:text-slate-100"
				>
					<Receipt className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
					<span>{showDigitalReceipt ? 'Digital receipt below' : 'View Digital Receipt'}</span>
				</button>
				{digitalReceipt}
				<button
					type="button"
					onClick={onClose}
					className="inline-flex w-full items-center justify-center px-5 py-2 text-[14px] font-semibold text-[#6b7280] dark:text-slate-400"
				>
					Done
				</button>
			</div>
		)

		const chatHintAlert = chatDeliveryHint ? (
			<div
				role="alert"
				className="flex w-full items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-left dark:border-amber-800 dark:bg-amber-950/40"
			>
				<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
				<p className="text-[12px] leading-snug text-amber-900 dark:text-amber-100">{chatDeliveryHint}</p>
			</div>
		) : null

		const panelErrorAlert = panelError ? (
			<div
				role="alert"
				className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
			>
				<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
				<p>{panelError}</p>
			</div>
		) : null

		if (step1Kind === 'food-beverage') {
			return (
				<section className="mx-auto flex w-full max-w-lg flex-col" aria-label="Dining gift ready">
					<div className="flex flex-col items-center px-2 pb-6 pt-1 text-center">
						<div className="relative mb-4 flex h-24 w-24 items-center justify-center">
							<div
								className="absolute inset-0 rounded-full blur-xl"
								style={{ backgroundColor: brandControl, opacity: 0.28 }}
								aria-hidden
							/>
							<div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white shadow-md dark:bg-slate-900">
								<Utensils className="h-11 w-11" strokeWidth={1.75} style={{ color: brandControl }} aria-hidden />
							</div>
							<div
								className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full shadow-sm"
								style={{ backgroundColor: brandControl, color: onBrandText }}
							>
								<Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
							</div>
						</div>
						<h2 className="text-[28px] font-bold leading-[34px] tracking-tight text-[#0F172A] dark:text-slate-100">
							Table is Set!
						</h2>
						<p className="mt-2 max-w-xs px-2 text-[15px] leading-relaxed text-[#424655] dark:text-slate-400">
							{successDirect ? (
								<>
									Your treat for{' '}
									<span className="font-semibold" style={{ color: brandControl }}>
										{friendHandle}
									</span>{' '}
									at <span className="font-semibold text-[#0F172A] dark:text-slate-100">{merchantLabel}</span> is
									ready to be enjoyed.
								</>
							) : (
								<>
									Your treat at{' '}
									<span className="font-semibold text-[#0F172A] dark:text-slate-100">{merchantLabel}</span> is ready
									to share.
								</>
							)}
						</p>
						{chatHintAlert ? <div className="mt-3 w-full max-w-sm">{chatHintAlert}</div> : null}
					</div>

					<div
						className="relative mb-5 overflow-hidden rounded-2xl p-6 shadow-xl"
						style={{ backgroundColor: brandColor, color: onBrandText, boxShadow: brandShadow }}
					>
						<div className="relative z-10 mb-6 flex items-center justify-between gap-2">
							<div className="flex min-w-0 items-center gap-2">
								<div
									className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
									style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
								>
									<Utensils className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
								</div>
								<span
									className="truncate text-[12px] font-semibold uppercase tracking-wider"
									style={{ color: onBrandMuted }}
								>
									{merchantLabel}
								</span>
							</div>
							<span
								className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wider"
								style={{ backgroundColor: 'rgba(255,255,255,0.16)', color: onBrandText }}
							>
								Dining Gift Pass
							</span>
						</div>
						<div className="relative z-10 mb-6">
							<span
								className="mb-1 block text-[12px] font-semibold uppercase tracking-widest"
								style={{ color: onBrandMuted }}
							>
								Pass Value
							</span>
							<div className="flex items-baseline gap-1">
								<span className="text-[22px] font-bold" style={{ color: onBrandText }}>
									{prefix}
								</span>
								<span className="text-[34px] font-bold leading-none tracking-tight" style={{ color: onBrandText }}>
									{previewAmount}
								</span>
							</div>
						</div>
						<div
							className="relative z-10 flex items-center justify-between gap-3 border-t pt-4"
							style={{ borderColor: 'rgba(255,255,255,0.12)' }}
						>
							{successDirect ? (
								<div className="flex min-w-0 items-center gap-2">
									<div
										className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
										style={{ backgroundColor: brandControl, color: onBrandText }}
									>
										{friendInitial}
									</div>
									<div className="min-w-0 text-left">
										<p className="truncate text-[15px] font-semibold">{friendHandle}</p>
										<p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: onBrandMuted }}>
											Beamio Smart Tag
										</p>
									</div>
								</div>
							) : (
								<p className="text-[12px] font-semibold" style={{ color: onBrandMuted }}>
									Share the claim link or code
								</p>
							)}
							<div className="shrink-0 text-right">
								<span className="block text-[12px] font-semibold uppercase" style={{ color: onBrandMuted }}>
									Power
								</span>
								<span className="text-[12px] font-semibold">100% face value</span>
							</div>
						</div>
					</div>

					{chatSent ? (
						<div className="mb-4 flex items-center gap-3 rounded-2xl bg-[#f4f3f8] p-4 dark:bg-slate-800">
							<div
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
								style={{ backgroundColor: `${brandControl}22`, color: brandControl }}
							>
								<MessageSquare className="h-5 w-5" strokeWidth={2} aria-hidden />
							</div>
							<div className="min-w-0 flex-1 text-left">
								<p className="text-[15px] font-semibold text-[#0F172A] dark:text-slate-100">
									Card bubble dispatched
								</p>
								<p className="mt-0.5 text-[12px] font-semibold text-[#424655] dark:text-slate-400">
									A greeting card bubble was sent to {friendHandle} in peer messages.
								</p>
							</div>
						</div>
					) : null}

					<div className="mb-6 space-y-3 rounded-2xl bg-[#eeedf3] p-4 dark:bg-slate-800">
						<div className="flex items-start gap-3">
							<div
								className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
								style={{ backgroundColor: `${brandControl}22`, color: brandControl }}
							>
								<Wallet className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
							</div>
							<div className="min-w-0 flex-1 text-left">
								<p className="text-[15px] font-semibold text-[#0F172A] dark:text-slate-100">Ready to claim</p>
								<p className="text-[13px] text-[#424655] dark:text-slate-400">
									Store credit unlocks on this merchant card when they redeem
									{creditHuman ? ` — about ${prefix}${creditHuman} after claim` : ''}.
								</p>
							</div>
						</div>
					</div>

					{themedActions}

					<div className="mt-6 flex flex-col items-center space-y-2 px-4 text-center">
						<div className="flex items-center gap-1.5 text-[#424655]/80">
							<Lock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
							<span className="text-[11px] font-semibold uppercase tracking-wider">Protected by Beamio</span>
						</div>
						<p className="text-[11px] font-semibold leading-tight text-[#737687]">
							Unclaimed gifts return automatically in 24h. Valid for dine-in and takeout.
						</p>
					</div>
					{panelErrorAlert ? <div className="mt-4">{panelErrorAlert}</div> : null}
				</section>
			)
		}

		if (step1Kind === 'health-beauty') {
			return (
				<section className="mx-auto flex w-full max-w-lg flex-col" aria-label="Wellness gift ready">
					<div className="flex flex-col items-center px-1 pb-4 pt-2 text-center">
						<div className="relative mb-3 flex h-24 w-24 items-center justify-center">
							<div
								className="absolute inset-0 rounded-full blur-xl"
								style={{ backgroundColor: brandControl, opacity: 0.28 }}
								aria-hidden
							/>
							<div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-md dark:bg-slate-900">
								<Flower2 className="h-8 w-8" strokeWidth={1.75} style={{ color: brandControl }} aria-hidden />
							</div>
							<div
								className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full shadow-sm"
								style={{ backgroundColor: brandControl, color: onBrandText }}
							>
								<Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
							</div>
						</div>
						<h2 className="text-[28px] font-bold leading-[34px] tracking-tight text-[#0F172A] dark:text-slate-100">
							A Touch of Care
						</h2>
						<p className="mt-1 max-w-[280px] text-[15px] text-[#424655] dark:text-slate-400">
							{successDirect ? (
								<>
									Your wellness gift for{' '}
									<span className="font-semibold" style={{ color: brandControl }}>
										{friendHandle}
									</span>{' '}
									at <span className="font-semibold text-[#0F172A] dark:text-slate-100">{merchantLabel}</span> is
									ready.
								</>
							) : (
								<>
									Your wellness gift at{' '}
									<span className="font-semibold text-[#0F172A] dark:text-slate-100">{merchantLabel}</span> is ready
									to share.
								</>
							)}
						</p>
						{chatHintAlert ? <div className="mt-3 w-full max-w-sm">{chatHintAlert}</div> : null}
					</div>

					<div
						className="relative mb-4 overflow-hidden rounded-2xl p-6 shadow-xl"
						style={{ backgroundColor: wellnessPassBg, color: onBrandText, boxShadow: brandShadow }}
					>
						<div className="pointer-events-none absolute -bottom-6 -right-6 opacity-10" aria-hidden>
							<Flower2 className="h-40 w-40" strokeWidth={1} />
						</div>
						<div className="relative z-10 mb-6 flex items-start justify-between gap-3">
							<div className="min-w-0 text-left">
								<span
									className="mb-0.5 block text-[12px] font-semibold uppercase tracking-wider"
									style={{ color: onBrandMuted }}
								>
									Wellness Gift Pass
								</span>
								<h3 className="truncate text-[22px] font-semibold tracking-tight">{merchantLabel}</h3>
							</div>
							<div
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
								style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
							>
								<Flower2 className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
							</div>
						</div>
						<div className="relative z-10 mb-5 text-left">
							<div className="flex flex-wrap items-baseline gap-1.5">
								<span className="text-[15px]" style={{ color: onBrandMuted }}>
									{prefix}
								</span>
								<span className="text-[34px] font-bold leading-none tracking-tight">{previewAmount}</span>
								<span
									className="ml-1 rounded-full px-2 py-0.5 text-[12px] font-semibold"
									style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}
								>
									Face value
								</span>
							</div>
							{successDirect ? (
								<p className="mt-1 flex items-center gap-1 text-[15px]" style={{ color: onBrandMuted }}>
									<Lock className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
									Delivered for <strong style={{ color: onBrandText }}>{friendHandle}</strong>
								</p>
							) : null}
						</div>
						<div
							className="relative z-10 flex items-center justify-between border-t pt-3"
							style={{ borderColor: 'rgba(255,255,255,0.12)' }}
						>
							<div className="flex items-center gap-1.5">
								<span
									className="h-2 w-2 rounded-full"
									style={{ backgroundColor: brandControl }}
									aria-hidden
								/>
								<span className="text-[12px] font-semibold" style={{ color: onBrandMuted }}>
									Open redeem ready
								</span>
							</div>
							<span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: onBrandMuted }}>
								Protected
							</span>
						</div>
					</div>

					<div className="mb-4 space-y-2">
						<div className="flex items-center justify-between px-1 text-[12px] font-semibold uppercase tracking-wider text-[#5d5e63]">
							<span>Delivery verification</span>
							<span className="inline-flex items-center gap-1" style={{ color: brandControl }}>
								<CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
								Ready
							</span>
						</div>
						{chatSent ? (
							<div className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
								<div
									className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
									style={{ backgroundColor: `${brandControl}22`, color: brandControl }}
								>
									<MessageSquare className="h-5 w-5" strokeWidth={2} aria-hidden />
								</div>
								<div className="min-w-0 flex-1 text-left">
									<h4 className="text-[17px] font-semibold text-[#0F172A] dark:text-slate-100">
										Care voucher dispatched
									</h4>
									<p className="mt-0.5 text-[15px] text-[#424655] dark:text-slate-400">
										A wellness greeting was delivered to {friendHandle} via Beamio chat.
									</p>
								</div>
							</div>
						) : null}
						<div className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
							<div
								className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
								style={{ backgroundColor: `${brandControl}22`, color: brandControl }}
							>
								<Wallet className="h-5 w-5" strokeWidth={2} aria-hidden />
							</div>
							<div className="min-w-0 flex-1 text-left">
								<h4 className="text-[17px] font-semibold text-[#0F172A] dark:text-slate-100">Ready to claim</h4>
								<p className="mt-0.5 text-[15px] text-[#424655] dark:text-slate-400">
									After they claim, the gift becomes store credit at {merchantLabel}
									{creditHuman ? ` — about ${prefix}${creditHuman}` : ''}.
								</p>
							</div>
						</div>
					</div>

					{spotlightUrl ? (
						<div className="mb-4 overflow-hidden rounded-2xl bg-[#f4f3f8] p-4 dark:bg-slate-800">
							<p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#5d5e63]">
								Merchant spotlight
							</p>
							<div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900">
								<IpfsImg
									src={spotlightUrl}
									alt=""
									className="h-28 w-full object-cover"
								/>
							</div>
						</div>
					) : null}

					{themedActions}

					<div className="mt-4 space-y-1.5 px-2 text-center">
						<div className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-[#5d5e63]">
							<Lock className="h-[15px] w-[15px]" strokeWidth={2} style={{ color: brandControl }} aria-hidden />
							<span>Protected by Beamio</span>
						</div>
						<p className="text-[12px] font-semibold leading-relaxed text-[#424655] dark:text-slate-400">
							Unclaimed gifts return automatically in 24h. Valid for in-clinic treatments and sessions.
						</p>
					</div>
					{panelErrorAlert ? <div className="mt-4">{panelErrorAlert}</div> : null}
				</section>
			)
		}

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
					{chatHintAlert}
				</header>

				{successDirect && selectedFriend ? (
					<div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
						<GiftFriendCapsule
							item={selectedFriend}
							onClear={() => setSelectedFriend(null)}
							accentColor={brandControl}
						/>
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

				{panelErrorAlert}
			</section>
		)
	}

	/* ─── Step 1: Configure ─── */
	if (step === 1) {
		return (
			<section className="mx-auto flex w-full max-w-lg flex-col gap-1 pb-4" aria-label="Configure gift">
				{stepPill(1, 'Configure Gift')}
				<h2 className="text-[28px] font-bold leading-tight tracking-tight text-[#0F172A] dark:text-slate-100">
					{step1Kind === 'food-beverage'
						? 'Treat someone to a meal'
						: step1Kind === 'health-beauty'
							? 'Send a wellness gift'
							: 'Send a Gift Card'}
				</h2>
				<p className="mt-0.5 text-[15px] text-[#5d5e63] dark:text-slate-400">
					{step1Kind === 'food-beverage'
						? `Dining gift for ${merchantLabel}`
						: step1Kind === 'health-beauty'
							? `Care gift for ${merchantLabel}`
							: `Curated store credit for ${merchantLabel}`}
				</p>

				<div className="mt-4">{brandGiftCard}</div>

				<section className="mb-6 flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<label className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider text-[#5d5e63]">
							<span style={{ color: brandControl }}>1.</span> Select gift amount
						</label>
						<span
							className="flex items-center gap-0.5 text-[12px] font-semibold"
							style={{ color: brandControl }}
						>
							Instant mint
						</span>
					</div>
					<div className="grid grid-cols-4 gap-2">
						{visiblePresets.map((chip) => {
							const n = chip.value
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
									{chip.caption ? (
										<span
											className="mt-1 text-center text-[9px] font-semibold uppercase leading-tight tracking-wide"
											style={active ? { color: onBrandMuted } : undefined}
										>
											{chip.caption}
										</span>
									) : null}
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
						<Check className="h-4 w-4 shrink-0" strokeWidth={2.5} style={{ color: brandControl }} aria-hidden />
						<p className="text-[15px] text-[#5d5e63] dark:text-slate-400">
							100% face value received by your recipient
							{isFeeCard ? ` · min ${prefix}${minHuman}` : ''}
						</p>
					</div>
				</section>

				<section className="mb-6 flex flex-col gap-3">
					<label className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider text-[#5d5e63]">
						<span style={{ color: brandControl }}>2.</span> Personal message & occasion
					</label>
					<div className="flex items-center gap-2 overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						{occasionCatalog.map((occ) => {
							const active = occasionId === occ.id
							const subtitle = occasionSubtitle(occ)
							return (
								<button
									key={occ.id}
									type="button"
									onClick={() => selectOccasion(occ)}
									className={`flex shrink-0 flex-col items-start gap-0.5 rounded-2xl px-3.5 py-2 text-left transition ${
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
									<span className="flex items-center gap-1.5 text-[15px]">
										<span>{occ.emoji}</span>
										<span>{occ.label}</span>
									</span>
									{subtitle ? (
										<span
											className="text-[11px] font-semibold"
											style={active ? { color: onBrandMuted } : undefined}
										>
											{subtitle}
										</span>
									) : null}
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
							maxLength={noteMax}
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
								{giftNote.length}/{noteMax}
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
		const merchantInitial = merchantLabel.replace(/^@/, '').trim().charAt(0).toUpperCase() || '?'
		const redeemHint = themeRedeemHint(step1Kind)
		const SummaryKindIcon =
			step1Kind === 'food-beverage' ? Utensils : step1Kind === 'health-beauty' ? Flower2 : Gift
		const selectRecentFriend = (item: searchResult) => {
			setSelectedFriend(item)
			setFriendQuery('')
			setFriendResults([])
			setShowFriendDropdown(false)
			setPanelError(null)
		}

		return (
			<section className="mx-auto flex w-full max-w-lg flex-col gap-1 pb-6" aria-label="How would you like to deliver?">
				<div className="flex items-center justify-between gap-3">
					{stepPill(2, 'Delivery Method')}
					<span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5d5e63]">
						Step 2 / 3
					</span>
				</div>
				<h2 className="text-[28px] font-bold leading-tight tracking-tight text-[#0F172A] dark:text-slate-100">
					How would you like to deliver?
				</h2>
				<p className="mt-0.5 text-[15px] text-[#5d5e63] dark:text-slate-400">
					{themeDeliveryLead(step1Kind, prefix, previewAmount, merchantLabel)}
				</p>

				<div className="relative mb-4 mt-4 overflow-hidden rounded-xl bg-white p-3.5 shadow-sm dark:bg-slate-900">
					<div className="flex items-center gap-3">
						<div
							className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg"
							style={{ backgroundColor: brandColor, color: onBrandText }}
						>
							{spotlightUrl ? (
								<IpfsImg src={spotlightUrl} alt="" className="h-full w-full object-cover" />
							) : (
								<div className="flex h-full w-full items-center justify-center text-[18px] font-bold">
									{merchantInitial}
								</div>
							)}
							<div
								className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded"
								style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: brandControl }}
							>
								<SummaryKindIcon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
							</div>
						</div>
						<div className="flex min-w-0 flex-1 flex-col">
							<div className="flex items-center justify-between gap-2">
								<span
									className="truncate text-[11px] font-semibold uppercase tracking-[0.08em]"
									style={{ color: brandControl }}
								>
									{activeOccasion.label}
								</span>
								<div className="flex shrink-0 items-center gap-2">
									<span className="text-[17px] font-semibold text-[#1a1b1f] dark:text-slate-100">
										{prefix}
										{previewAmount}
									</span>
									<button
										type="button"
										onClick={() => {
											setStep(1)
											setPanelError(null)
										}}
										className="rounded px-2 py-0.5 text-[12px] font-semibold transition"
										style={{ backgroundColor: brandTint, color: brandControl }}
									>
										Edit
									</button>
								</div>
							</div>
							<p className="mt-0.5 truncate text-[16px] font-medium text-[#1a1b1f] dark:text-slate-100">
								{merchantLabel}
							</p>
							<div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[#5d5e63]">
								<CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: brandControl }} aria-hidden />
								<span className="truncate">{redeemHint}</span>
							</div>
							{giftNote.trim() ? (
								<div className="mt-0.5 flex items-center gap-1 text-[12px] text-[#5d5e63]">
									<MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
									<span className="truncate">Includes personalized greeting note</span>
								</div>
							) : null}
						</div>
					</div>
				</div>

				<div className="mb-4 flex flex-col gap-2" role="radiogroup" aria-label="Delivery method">
					{/* Direct @BeamioTag */}
					<div
						role="radio"
						aria-checked={deliveryMode === 'friend'}
						tabIndex={0}
						onClick={() => {
							setDeliveryMode('friend')
							setPanelError(null)
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault()
								setDeliveryMode('friend')
								setPanelError(null)
							}
						}}
						className="cursor-pointer rounded-xl bg-white p-6 text-left shadow-sm transition dark:bg-slate-900"
						style={
							deliveryMode === 'friend'
								? { boxShadow: brandSelectedRing }
								: { boxShadow: '0 0 0 1px #e8ecf0' }
						}
					>
						<div className="flex items-start justify-between gap-3">
							<div className="flex items-center gap-3">
								<div
									className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
									style={
										deliveryMode === 'friend'
											? { backgroundColor: brandTint, color: brandControl }
											: { backgroundColor: '#eeedf3', color: '#424655' }
									}
								>
									<AtSign className="h-6 w-6" strokeWidth={2} aria-hidden />
								</div>
								<div>
									<div className="flex flex-wrap items-center gap-1.5">
										<h3 className="text-[17px] font-semibold leading-snug text-[#1a1b1f] dark:text-slate-100">
											Send to @BeamioTag
										</h3>
										<span
											className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
											style={{ backgroundColor: `${brandControl}18`, color: brandControl }}
										>
											Direct
										</span>
									</div>
									<p className="mt-0.5 text-[15px] text-[#5d5e63] dark:text-slate-400">
										Pick a friend for a personalized share message.
									</p>
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
						{deliveryMode === 'friend' ? (
							<div
								className="mt-4 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-700"
								onClick={(e) => e.stopPropagation()}
								onKeyDown={(e) => e.stopPropagation()}
							>
								{selectedFriend ? (
									<>
										<GiftFriendCapsule
											item={selectedFriend}
											onClear={() => setSelectedFriend(null)}
											accentColor={brandControl}
										/>
										{(selectedFriend.username ?? '').trim() ? (
											<div
												className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1"
												style={{ backgroundColor: `${brandControl}18`, color: brandControl }}
											>
												<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
												<span className="text-[11px] font-semibold uppercase tracking-wider">
													Recipient ready: @{selectedFriend.username.trim()}
												</span>
											</div>
										) : null}
									</>
								) : (
									<div className="relative">
										<label
											htmlFor="gift-recipient-handle"
											className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5d5e63]"
										>
											Recipient Beamio handle
										</label>
										<div className="relative">
											<span
												className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[17px] font-semibold text-[#5d5e63]"
											>
												@
											</span>
											<input
												id="gift-recipient-handle"
												type="search"
												value={friendQuery}
												onChange={(e) => setFriendQuery(e.target.value)}
												placeholder="Username"
												autoComplete="off"
												className="h-12 w-full rounded-lg bg-[#f4f3f8] py-2.5 pl-8 pr-10 text-[17px] text-[#1a1b1f] outline-none dark:bg-slate-800 dark:text-slate-100"
											/>
											{friendLoading ? (
												<Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#6b7280]" aria-hidden />
											) : (
												<Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" aria-hidden />
											)}
										</div>
										{showFriendDropdown && friendResults.length > 0 ? (
											<ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-[#e8ecf0] bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900">
												{friendResults.map((r) => (
													<li key={r.address}>
														<BeamioSearchResultRow
															item={r}
															query={friendQuery}
															onSelect={(item) => selectRecentFriend(item)}
														/>
													</li>
												))}
											</ul>
										) : null}
									</div>
								)}
								{!selectedFriend && recentFriends.length > 0 ? (
									<div className="space-y-1.5 pt-1">
										<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5d5e63]">
											Recent friends
										</span>
										<div className="flex items-center gap-2 overflow-x-auto pb-1">
											{recentFriends.map((friend) => {
												const tag = (friend.username ?? '').trim()
												const pillLabel = tag || beamioSearchShortAddress(friend.address)
												const initial = (tag || friend.first_name || pillLabel).charAt(0).toUpperCase()
												return (
													<button
														key={friend.address}
														type="button"
														onClick={() => selectRecentFriend(friend)}
														className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 transition active:scale-95"
														style={{ backgroundColor: brandTint, color: brandControl }}
													>
														<span
															className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
															style={{ backgroundColor: brandControl, color: onBrandText }}
														>
															{initial}
														</span>
														<span className="text-[15px] font-medium">
															{tag ? `@${tag}` : pillLabel}
														</span>
													</button>
												)
											})}
										</div>
									</div>
								) : null}
								<p className="text-[13px] leading-relaxed text-[#424655] dark:text-slate-400">
									The claim link still works for anyone you send it to.
								</p>
							</div>
						) : null}
					</div>

					{/* Shareable link */}
					<div
						role="radio"
						aria-checked={deliveryMode === 'link'}
						tabIndex={0}
						onClick={() => {
							setDeliveryMode('link')
							setPanelError(null)
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault()
								setDeliveryMode('link')
								setPanelError(null)
							}
						}}
						className="cursor-pointer rounded-xl bg-white p-6 text-left shadow-sm transition dark:bg-slate-900"
						style={
							deliveryMode === 'link'
								? { boxShadow: brandSelectedRing }
								: { boxShadow: '0 0 0 1px #e8ecf0' }
						}
					>
						<div className="flex items-start justify-between gap-3">
							<div className="flex items-center gap-3">
								<div
									className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
									style={
										deliveryMode === 'link'
											? { backgroundColor: brandTint, color: brandControl }
											: { backgroundColor: '#eeedf3', color: '#424655' }
									}
								>
									<Link2 className="h-6 w-6" strokeWidth={2} aria-hidden />
								</div>
								<div>
									<h3 className="text-[17px] font-semibold leading-snug text-[#1a1b1f] dark:text-slate-100">
										Create a Shareable Link
									</h3>
									<p className="mt-0.5 text-[15px] text-[#5d5e63] dark:text-slate-400">
										Share via WhatsApp, iMessage, or any messenger.
									</p>
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
						{deliveryMode === 'link' ? (
							<div
								className="mt-4 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-700"
								onClick={(e) => e.stopPropagation()}
							>
								<div className="flex items-start gap-2.5 rounded-lg bg-[#f4f3f8] p-3 dark:bg-slate-800">
									<MessageSquare className="mt-0.5 h-5 w-5 shrink-0" style={{ color: brandControl }} aria-hidden />
									<p className="text-[13px] leading-relaxed text-[#5d5e63] dark:text-slate-400">
										A private claim link is created after payment. Your friend can claim in Beamio Discover
										with the link or code.
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-2 pt-1">
									<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5d5e63]">
										Channels:
									</span>
									{['WhatsApp', 'iMessage', 'Direct Link'].map((channel) => (
										<span
											key={channel}
											className="rounded bg-[#eeedf3] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#5d5e63] dark:bg-slate-800 dark:text-slate-300"
										>
											{channel}
										</span>
									))}
								</div>
							</div>
						) : null}
					</div>
				</div>

				<div className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-[#f4f3f8] px-3 py-2 text-center dark:bg-slate-800">
					<CheckCircle2 className="h-[18px] w-[18px] shrink-0" style={{ color: brandControl }} aria-hidden />
					<span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5d5e63]">
						Unclaimed gifts return automatically in 24h
					</span>
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

				<div className="space-y-3 pt-1">
					<button
						type="button"
						onClick={goStep3}
						className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl px-6 text-[17px] font-semibold shadow-lg transition active:scale-[0.98]"
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
					<div className="flex items-center justify-center gap-1.5 text-center">
						<Lock className="h-3.5 w-3.5 shrink-0 text-[#5d5e63]" aria-hidden />
						<span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5d5e63]">
							Protected by Beamio · Unclaimed gifts return automatically in 24h
						</span>
					</div>
				</div>
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
					<GiftFriendCapsule
						item={selectedFriend}
						onClear={() => setSelectedFriend(null)}
						accentColor={brandControl}
					/>
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
							? 'bg-white dark:bg-slate-900'
							: 'bg-[#f4f3f8] hover:bg-white dark:bg-slate-800'
					}`}
					style={payWith === 'usdc' ? { boxShadow: brandSelectedRing } : undefined}
				>
					<div className="flex items-start justify-between gap-3">
						<div className="flex items-start gap-3">
							<div
								className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
								style={{ backgroundColor: brandTint, color: brandControl }}
							>
								<Wallet className="h-5 w-5" strokeWidth={2} aria-hidden />
							</div>
							<div>
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-base font-semibold text-[#1a1b1f] dark:text-slate-100">
										USDC
									</span>
									<span
										className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
										style={{ backgroundColor: brandTint, color: brandControl }}
									>
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
							<span
								className="flex items-center gap-0.5 text-[11px] font-semibold"
								style={{ color: brandControl }}
							>
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
								? 'bg-white dark:bg-slate-900'
								: 'bg-[#f4f3f8] hover:bg-white dark:bg-slate-800'
						}`}
						style={payWith === 'credit' ? { boxShadow: brandSelectedRing } : undefined}
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
