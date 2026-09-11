import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, CreditCard, ExternalLink, Info, Loader2, Lock, Share, Share2, Star, Tag, Ticket, Wallet } from 'lucide-react'
import usdcIcon from '@/components/assets/usdc.png'
import { ethers } from 'ethers'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { IpfsImg } from '@/components/IpfsImg'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useMerchantCardDatabase } from '@/providers/MerchantCardDatabaseProvider'
import {
	getCardMetadataFromApi,
	getCardOwner,
	getMyAssets,
	peekGetMyAssetsCache,
	postBuyCardPoints,
} from '@/services/BeamioCard'
import { isGenericMerchantCardDisplayName } from '@/utils/isGenericMerchantCardDisplayName'
import { pickNonFactoryMerchantAssetUrl } from '@/utils/isFactoryDefaultMerchantAssetUrl'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { displayFiatPrefixFromCode } from '@/services/currency'
import {
	CoverLeg,
	estimateCoverUsdc6,
	estimateSameStoreCoverFiat,
	formatPtsHuman,
	hydrateSameStoreRowFromAssets,
	isTrustedSameStoreZero,
	loadReward13RowsForAa,
	mergeReward13Rows,
	parseFiatHumanTo6,
	peekReward13RowsCache,
	pickRichestReward13Seed,
	resolveAaHoldingReward13,
	sameStoreEscrowSized,
	sameStoreHasPositiveCover,
	seedAssetsFromPoints13Human,
	planAutoCoverUsdc,
	planManualCoverUsdc,
	postTopupWithReward13Container,
	quoteFiat6ToUsdc6,
	readEoaConetUsdc6,
	Reward13Row,
	sumUsdc6,
} from '@/utils/topupReward13Plan'
import {
	buildDiscoverUsdcTreasuryBridgeQrUrl,
	fetchDiscoverClientTopupQuotedUsdc6,
	payDiscoverTreasuryBridgeWithLocalWallet,
} from '@/utils/discoverUsdcTopupSession'
import {
	eoaCanSelfFundDiscoverTopup,
	readEoaUsdcBalance6,
} from '@/utils/discoverEoaUsdcTopup'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { loadMyBrandsFeedLocalCache } from '@/utils/myBrandsFeedLocalCache'
import {
	buildDiscoverMerchantShareUrl,
	shareDiscoverMerchantUrl,
} from '@/utils/discoverMerchantShare'
import {
	quoteDiscoverStoreCreditTopupBonus,
	resolveDiscoverStoreCreditMultiplierCards,
	discoverContrastTextOnBrand,
	discoverMixCssColorWithBlack,
	discoverMixCssColorWithWhite,
	parseDiscoverMerchantBrandColor,
	resolveDiscoverMerchantPageBrandColor,
} from '@/utils/discoverMerchantPromotions'

const SPINNER_CLASS =
	'[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]'

/** Absolute API host — required in iOS Embedded OTA (`cashtrees-local://`); relative `/api` fails there. */
const BEAMIO_API_BASE = 'https://beamio.app'

const QUICK = ['10', '20', '50', '100'] as const

type Step = 'amount' | 'pay' | 'select' | 'confirm' | 'stripeWaiting' | 'success'
type PaymentMethod = 'card' | 'usdc'

type SeedReward13Assets = {
	chargeRewardPoints?: string
	chargeRewardPoints6?: string
}

function collectSmartPaySeedAssets(opts: {
	cardAddress: string
	profile: profile
	seedAssets?: SeedReward13Assets | null
	seedPoints13?: number | null
	daemonAssets?: SeedReward13Assets | null
}): SeedReward13Assets | null {
	const eoa = opts.profile?.keyID?.trim().toLowerCase()
	const cardLower = opts.cardAddress.toLowerCase()
	const fromLocal = eoa
		? loadMyBrandsFeedLocalCache(eoa)?.details?.[cardLower]?.assets ?? null
		: null
	return pickRichestReward13Seed(
		opts.seedAssets,
		seedAssetsFromPoints13Human(opts.seedPoints13),
		peekGetMyAssetsCache(opts.profile, opts.cardAddress),
		opts.daemonAssets,
		fromLocal,
	)
}

type Props = {
	open: boolean
	onClose: () => void
	cardAddress: string
	storeCreditsPoints: string
	cardCurrency: string
	profile: profile
	initialAmount?: string
	stripeKind?: 'topup' | 'membership'
	membershipTierIndex?: number
	membershipFeeFiat6?: string
	/** Discover / My Brands already-loaded #13. First-paint Smart Pay cover — do not wait for planner RPC. */
	seedAssets?: SeedReward13Assets | null
	/** Discover My Points #13 (human). Used when `seedAssets` still lacks chargeRewardPoints. */
	seedPoints13?: number | null
	onSuccess?: (assets?: MyCardAssets) => void
}

function preventStepKeys(e: React.KeyboardEvent<HTMLInputElement>) {
	if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
		e.preventDefault()
		e.stopPropagation()
	}
}

function formatUsdc(usdc6: bigint): string {
	return Number(ethers.formatUnits(usdc6, 6)).toFixed(2)
}

/** Cross-store #13→USDC vs CAD quote can leave sub-cent dust that still prints as $0.00. */
function isDisplayZeroUsdc(usdc6: bigint): boolean {
	return usdc6 <= 0n || formatUsdc(usdc6) === '0.00'
}

function payableCashUsdc6(quotedUsdc6: bigint, coveredUsdc6: bigint): bigint {
	const raw = quotedUsdc6 > coveredUsdc6 ? quotedUsdc6 - coveredUsdc6 : 0n
	return isDisplayZeroUsdc(raw) ? 0n : raw
}

/** Chain refresh after a confirmed top-up must not keep Confirm on “Applying points…”. */
const ASSET_REFRESH_AFTER_TOPUP_MS = 6_000

async function refreshMyAssetsAfterSuccessfulTopup(
	profile: profile,
	cardAddress: string,
): Promise<MyCardAssets | undefined> {
	try {
		const refreshed = await Promise.race([
			getMyAssets(profile, cardAddress, { bypassCache: true }),
			new Promise<null>((resolve) => {
				setTimeout(() => resolve(null), ASSET_REFRESH_AFTER_TOPUP_MS)
			}),
		])
		return refreshed ?? undefined
	} catch {
		return undefined
	}
}

function merchantInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean)
	if (parts.length >= 2) {
		return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
	}
	const alnum = name.replace(/[^a-zA-Z0-9]/g, '')
	return (alnum.slice(0, 2) || 'M').toUpperCase()
}

function formatFiatHero(n: number): string {
	if (!Number.isFinite(n)) return '0'
	return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function formatPrefixedFiat(prefix: string, amount: string): string {
	return `${prefix} ${amount}`
}

function formatUsdcDue(usdc6: bigint): string {
	return `$${formatUsdc(usdc6)}`
}

function UsdcMark({ size = 16 }: { size?: number }) {
	return (
		<img
			src={usdcIcon}
			alt="USDC"
			className="inline-block shrink-0 rounded-full object-contain"
			style={{ width: size, height: size }}
		/>
	)
}

function CashUsdcMark({ size = 16 }: { size?: number }) {
	return <UsdcMark size={size} />
}

function formatPtsShort(points6: bigint): string {
	const s = formatPtsHuman(points6)
	return s.endsWith('.00') ? s.slice(0, -3) : s
}

function stripPointsSuffix(name: string): string {
	const raw = (name || 'Merchant').trim()
	return /points$/i.test(raw) ? raw.replace(/\s+points$/i, '').trim() || raw : raw
}

type ConfirmCoverLine = {
	key: string
	title: string
	fiat: number
	kind: CoverLeg['kind']
}

function coverLegFiat(leg: CoverLeg, quotedUsdc6: bigint, fiatN: number): number {
	if (leg.kind === 'toProgramPoints') {
		const n = Number(ethers.formatUnits(leg.pointsCost, 6))
		return Number.isFinite(n) && n > 0 ? n : 0
	}
	if (quotedUsdc6 <= 0n || !Number.isFinite(fiatN) || fiatN <= 0) return 0
	const n = (fiatN * Number(leg.usdcReward6)) / Number(quotedUsdc6)
	return Number.isFinite(n) && n > 0 ? n : 0
}

function reconcileCoverLineFiat(lines: ConfirmCoverLine[], coveredFiat: number): ConfirmCoverLine[] {
	if (lines.length === 0 || !Number.isFinite(coveredFiat) || coveredFiat <= 0) return lines
	const sum = lines.reduce((acc, line) => acc + line.fiat, 0)
	const delta = coveredFiat - sum
	if (!Number.isFinite(delta) || Math.abs(delta) < 0.0005 || Math.abs(delta) > 0.05) return lines
	const last = lines[lines.length - 1]
	const next = last.fiat + delta
	if (!(next > 0)) return lines
	return [...lines.slice(0, -1), { ...last, fiat: next }]
}

function estimateConfirmCoverLinesFromRows(
	rows: Reward13Row[],
	fiatN: number,
	quotedUsdc6: bigint,
): ConfirmCoverLine[] {
	if (!Number.isFinite(fiatN) || fiatN <= 0) return []
	const same = rows.filter((r) => r.coverKind === 'toProgramPoints' && r.redeemablePoints6 > 0n)
	const peers = rows.filter(
		(r) => r.coverKind === 'toUsdc' && r.redeemableUsdc6 > 0n && r.redeemablePoints6 > 0n,
	)
	const lines: ConfirmCoverLine[] = []
	let remainingFiat = fiatN
	const fiat6 = parseFiatHumanTo6(fiatN.toFixed(6))
	let remainingUsdc = quotedUsdc6

	for (const row of same) {
		if (remainingFiat <= 0) break
		const pts = Number(ethers.formatUnits(row.redeemablePoints6, 6))
		if (!Number.isFinite(pts) || pts <= 0) continue
		const take = Math.min(remainingFiat, pts)
		if (take <= 0) continue
		const takeUsdc = fiat6 > 0n ? (quotedUsdc6 * parseFiatHumanTo6(take.toFixed(6))) / fiat6 : 0n
		lines.push({
			key: `${row.cardAddress.toLowerCase()}:toProgramPoints`,
			title: `${stripPointsSuffix(row.name)} Points`,
			fiat: take,
			kind: 'toProgramPoints',
		})
		remainingFiat -= take
		remainingUsdc = remainingUsdc > takeUsdc ? remainingUsdc - takeUsdc : 0n
	}

	for (const row of peers) {
		if (remainingFiat <= 0 || remainingUsdc <= 0n) break
		const takeUsdc = row.redeemableUsdc6 < remainingUsdc ? row.redeemableUsdc6 : remainingUsdc
		if (takeUsdc <= 0n) continue
		const takeFiat = (remainingFiat * Number(takeUsdc)) / Number(remainingUsdc)
		if (!(takeFiat > 0)) continue
		lines.push({
			key: `${row.cardAddress.toLowerCase()}:toUsdc`,
			title: `${stripPointsSuffix(row.name)} Points`,
			fiat: takeFiat,
			kind: 'toUsdc',
		})
		remainingFiat -= takeFiat
		remainingUsdc -= takeUsdc
	}
	return lines
}

function buildConfirmCoverLines(opts: {
	legs: CoverLeg[]
	coverageRows: Reward13Row[]
	coveredFiat: number
	quotedUsdc6: bigint
	fiatN: number
	fallbackName: string
}): ConfirmCoverLine[] {
	if (!opts.coveredFiat || opts.coveredFiat <= 0) return []
	if (opts.legs.length > 0) {
		const fromLegs = opts.legs
			.map((leg) => ({
				key: `${leg.cardAddress.toLowerCase()}:${leg.kind}`,
				title: `${stripPointsSuffix(leg.name || opts.fallbackName)} Points`,
				fiat: coverLegFiat(leg, opts.quotedUsdc6, opts.fiatN),
				kind: leg.kind,
			}))
			.filter((line) => line.fiat > 0)
		return reconcileCoverLineFiat(fromLegs, opts.coveredFiat)
	}
	return reconcileCoverLineFiat(
		estimateConfirmCoverLinesFromRows(opts.coverageRows, opts.fiatN, opts.quotedUsdc6),
		opts.coveredFiat,
	)
}

type DualLegResult = { ok: true } | { ok: false; error: string }

function formatCashFiatApiAmount(cashFiat: number, currency: string): string {
	const code = (currency || 'USD').toUpperCase()
	const decimals = code === 'JPY' || code === 'TWD' ? 0 : 2
	const min = decimals === 0 ? 1 : 0.01
	const n = Math.max(Number.isFinite(cashFiat) ? cashFiat : 0, min)
	return n.toFixed(decimals)
}

function formatInsufficientUsdcAlert(have6: bigint, need6: bigint, opts?: { afterPoints?: boolean }): string {
	if (opts?.afterPoints) {
		return `You have $${formatUsdc(have6)} USDC; this cash portion needs $${formatUsdc(need6)}. Add USDC, or turn off Use Points to pay the full amount after funding.`
	}
	return `You have $${formatUsdc(have6)} USDC; this top-up needs $${formatUsdc(need6)}. Add USDC to continue.`
}

function resolveSmartPayCoveredFiat(opts: {
	smartPay: boolean
	fiatN: number
	fiatHuman: string
	quotedUsdc6: bigint
	quotedForFiat: string
	coveredUsdc6: bigint
	rows: Reward13Row[]
	rowsReady: boolean
}): number {
	if (!opts.smartPay || !Number.isFinite(opts.fiatN) || opts.fiatN <= 0) return 0
	// Same-store #13 is 1:1 with card fiat. Never fold PT into coveredUsdc6 /
	// quotedUsdc6 (10 PT vs a CAD→USDC quote ≈ 36 would paint 13.87).
	const sameStore = estimateSameStoreCoverFiat(opts.rows, opts.fiatN)
	const quoteMatches = opts.quotedUsdc6 > 0n && opts.quotedForFiat === opts.fiatHuman
	if (!quoteMatches) {
		if (sameStore > 0) return sameStore
		if (!opts.rowsReady) return sameStore
		return 0
	}

	const fiat6 = parseFiatHumanTo6(opts.fiatHuman)
	const sameStore6 = parseFiatHumanTo6(sameStore.toFixed(6))
	const sameStoreUsdc = fiat6 > 0n ? (opts.quotedUsdc6 * sameStore6) / fiat6 : 0n
	const remainingFiat = Math.max(0, opts.fiatN - sameStore)
	const remainingUsdc = opts.quotedUsdc6 > sameStoreUsdc ? opts.quotedUsdc6 - sameStoreUsdc : 0n

	// Points Covered is the aggregate usable capacity: same-store #13 first,
	// then every other card's redeemable USDC. Do not depend solely on `legs`;
	// the async planner can still be empty while the rows already contain
	// trusted redeemable capacity.
	const peerRows = opts.rows.filter((r) => r.coverKind === 'toUsdc')
	const rowPeerUsdc =
		peerRows.length > 0 && remainingUsdc > 0n
			? estimateCoverUsdc6(peerRows, remainingUsdc, 0n)
			: 0n
	const plannedPeerUsdc = opts.coveredUsdc6 > sameStoreUsdc ? opts.coveredUsdc6 - sameStoreUsdc : 0n
	const peerUsdc = plannedPeerUsdc > rowPeerUsdc ? plannedPeerUsdc : rowPeerUsdc

	if (peerUsdc <= 0n || remainingFiat <= 0 || remainingUsdc <= 0n) {
		if (sameStore > 0) return sameStore
		if (!opts.rowsReady) return sameStore
		return 0
	}
	const peerFiat = (remainingFiat * Number(peerUsdc)) / Number(remainingUsdc)
	return Math.min(opts.fiatN, sameStore + peerFiat)
}

function composeDualPayFailure(
	pointsOk: boolean,
	cashOk: boolean,
	pointsErr: string,
	cashErr: string,
): string {
	if (!pointsOk && !cashOk) {
		return `Both payments failed. Points: ${pointsErr}. USDC: ${cashErr}`
	}
	if (pointsOk && !cashOk) {
		return `Reward PT was applied. USDC payment failed: ${cashErr}`
	}
	if (!pointsOk && cashOk) {
		return `USDC payment succeeded. Points top-up failed: ${pointsErr}`
	}
	return 'Top-up failed'
}

function friendlyTopupContainerError(raw: string): string {
	const m = raw.match(/Insufficient CONET-USDC \(have=(\d+), need=(\d+)\)/)
	if (m) return formatInsufficientUsdcAlert(BigInt(m[1]), BigInt(m[2]))
	return raw
}

function isInsufficientConetUsdcError(raw: string): boolean {
	return /Insufficient CONET-USDC/i.test(raw) || /CONET-USDC on CoNET/i.test(raw)
}

function formatUnfundableDualCashAlert(conetHave6: bigint, baseHave6: bigint, need6: bigint): string {
	const totalHave6 = conetHave6 + baseHave6
	return `You have $${formatUsdc(totalHave6)} USDC; the remaining cash needs $${formatUsdc(need6)}. Add USDC to continue, or turn off Use Points to pay the full amount after funding.`
}

export default function MerchantCardTopUpFlow({
	open,
	onClose,
	cardAddress,
	storeCreditsPoints,
	cardCurrency,
	profile,
	initialAmount,
	stripeKind,
	membershipTierIndex,
	membershipFeeFiat6,
	seedAssets,
	seedPoints13,
	onSuccess,
}: Props) {
	const { myBrandCardDetails } = useDaemonContext()
	const {
		resolveName,
		resolveImage,
		registerCardAddresses,
		lookupByAddress,
		ensureCardsForAddresses,
	} = useMerchantCardDatabase()
	const [isEntered, setIsEntered] = useState(false)
	const [isClosing, setIsClosing] = useState(false)
	const [step, setStep] = useState<Step>('amount')
	const [amountInput, setAmountInput] = useState('50.00')
	const [smartPay, setSmartPay] = useState(true)
	const [rows, setRows] = useState<Reward13Row[]>([])
	const [rowsLoading, setRowsLoading] = useState(false)
	const [rowsReady, setRowsReady] = useState(false)
	const [sameStoreReady, setSameStoreReady] = useState(false)
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [committedSelected, setCommittedSelected] = useState<Set<string> | null>(null)
	const [quotedUsdc6, setQuotedUsdc6] = useState(0n)
	const [quotedForFiat, setQuotedForFiat] = useState('')
	const [eoaUsdc6, setEoaUsdc6] = useState<bigint | null>(null)
	const [baseUsdc6, setBaseUsdc6] = useState<bigint | null>(null)
	const [merchantName, setMerchantName] = useState('Store')
	const [merchantIcon, setMerchantIcon] = useState<string | undefined>()
	const [payBusy, setPayBusy] = useState(false)
	const [payError, setPayError] = useState('')
	const [stripeReady, setStripeReady] = useState(false)
	const [stripeBusy, setStripeBusy] = useState(false)
	const [stripeSessionId, setStripeSessionId] = useState<string | null>(null)
	const [stripePaymentMessage, setStripePaymentMessage] = useState('')
	const [stripePaymentOutcome, setStripePaymentOutcome] = useState<'pending' | 'success' | 'cancelled' | 'failed'>('pending')
	const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('usdc')
	const stripeBusinessKeyRef = useRef<string | null>(null)
	const [mintedLabel, setMintedLabel] = useState('0.00')
	const [successNote, setSuccessNote] = useState('')
	const [usedManual, setUsedManual] = useState(false)
	const [legs, setLegs] = useState<CoverLeg[]>([])
	const [sharing, setSharing] = useState(false)
	const [shareCopied, setShareCopied] = useState(false)
	const [shareAlert, setShareAlert] = useState('')
	const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const closeStartedRef = useRef(false)
	const shareResetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const legsPlanGen = useRef(0)
	const rowsReadyRef = useRef(false)
	const shareUrl = useMemo(
		() => buildDiscoverMerchantShareUrl(cardAddress, profile.keyID),
		[cardAddress, profile.keyID],
	)

	const prefix = displayFiatPrefixFromCode(cardCurrency, 'USD')
	const fiatHuman = amountInput.replace(/,/g, '').trim() || '0'
	const amountFiat6 = useMemo(() => {
		const normalized = fiatHuman.trim()
		if (!/^(?:\d+)(?:\.\d{1,6})?$/.test(normalized)) return null
		const [whole, fraction = ''] = normalized.split('.')
		const value = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'))
		return value > 0n ? value.toString() : null
	}, [fiatHuman])
	const metadataRoot = lookupByAddress(cardAddress)?.metadataRoot ?? null
	const pageSurface = useMemo(
		() => resolveDiscoverMerchantPageBrandColor(metadataRoot),
		[metadataRoot],
	)
	const merchantBrandColor = useMemo(
		() => parseDiscoverMerchantBrandColor(metadataRoot) ?? '#1562f0',
		[metadataRoot],
	)
	const merchantBrandActionColor = useMemo(
		() => {
			const brandTextColor = discoverContrastTextOnBrand(merchantBrandColor)
			return brandTextColor === '#111827'
				? discoverMixCssColorWithBlack(merchantBrandColor, 0.55) ?? '#334155'
				: merchantBrandColor
		},
		[merchantBrandColor],
	)
	const merchantBrandTextColor = useMemo(
		() => discoverContrastTextOnBrand(merchantBrandActionColor),
		[merchantBrandActionColor],
	)
	const merchantBrandTint = useMemo(
		() => discoverMixCssColorWithWhite(merchantBrandColor, 0.86) ?? '#e8eeff',
		[merchantBrandColor],
	)
	const merchantBrandBorder = useMemo(
		() => discoverMixCssColorWithWhite(merchantBrandColor, 0.55) ?? '#9ec0ff',
		[merchantBrandColor],
	)
	const merchantBrandPointsTrack = useMemo(
		() => discoverMixCssColorWithBlack(merchantBrandActionColor, 0.28) ?? merchantBrandActionColor,
		[merchantBrandActionColor],
	)
	const merchantBrandSavedColor = useMemo(
		() => discoverMixCssColorWithBlack(merchantBrandActionColor, 0.18) ?? merchantBrandActionColor,
		[merchantBrandActionColor],
	)
	const merchantBrandSoftTint = useMemo(
		() => discoverMixCssColorWithWhite(merchantBrandColor, 0.93) ?? merchantBrandTint,
		[merchantBrandColor, merchantBrandTint],
	)
	const merchantBrandMutedColor = useMemo(
		() => discoverMixCssColorWithWhite(merchantBrandActionColor, 0.42) ?? '#9aa3b2',
		[merchantBrandActionColor],
	)
	const merchantBrandIdleSurface = useMemo(
		() => discoverMixCssColorWithWhite(merchantBrandColor, 0.9) ?? '#f0f1f3',
		[merchantBrandColor],
	)
	const merchantBrandSwitchOff = useMemo(
		() => discoverMixCssColorWithWhite(merchantBrandActionColor, 0.55) ?? '#cbd5e1',
		[merchantBrandActionColor],
	)
	const creditQuote = useMemo(() => {
		const amount = Number(fiatHuman)
		return quoteDiscoverStoreCreditTopupBonus({
			metadataRoot,
			currency: String(cardCurrency || 'USD'),
			amount,
		})
	}, [metadataRoot, cardCurrency, fiatHuman])
	const multiplierCards = useMemo(
		() =>
			resolveDiscoverStoreCreditMultiplierCards({
				metadataRoot,
				currency: String(cardCurrency || 'USD'),
			}),
		[metadataRoot, cardCurrency],
	)
	const quickAmounts = useMemo(
		() =>
			multiplierCards.length >= 2
				? multiplierCards.map((card) => String(card.topupAmount))
				: [...QUICK],
		[multiplierCards],
	)
	const profileAa =
		profile.aaAccount && ethers.isAddress(profile.aaAccount)
			? ethers.getAddress(profile.aaAccount)
			: ''
	/** Chain-resolved Consumer AA that holds #13 (may differ from profile.aaAccount). */
	const [resolvedAa, setResolvedAa] = useState('')

	useEffect(() => {
		if (!open || !cardAddress || !ethers.isAddress(cardAddress)) return
		let cancelled = false
		stripeBusinessKeyRef.current = null
		setStripeReady(false)
		setStripeSessionId(null)
		setStripePaymentMessage('')
		setStripePaymentOutcome('pending')
		void fetch(`${BEAMIO_API_BASE}/api/merchantCardStripe/status`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cardAddress: ethers.getAddress(cardAddress) }),
		})
			.then(async (response) => {
				const body = (await response.json().catch(() => ({}))) as { linked?: boolean }
				if (!cancelled && response.ok && body.linked === true) setStripeReady(true)
			})
			.catch(() => {
				// Optional payment method: preserve the last trusted state on failure.
			})
		return () => {
			cancelled = true
		}
	}, [open, cardAddress])

	useEffect(() => {
		if (stripeReady) setPaymentMethod('card')
		else setPaymentMethod('usdc')
	}, [stripeReady])

	const payWithStripe = useCallback(async () => {
		if (stripeBusy || !stripeReady || !amountFiat6 || !profile.keyID) return
		setStripeBusy(true)
		setPayError('')
		setStripePaymentMessage('Opening secure Stripe payment…')
		try {
			const response = await fetch(`${BEAMIO_API_BASE}/api/merchantCardStripe/createCheckout`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cardAddress: ethers.getAddress(cardAddress),
					buyerEoa: ethers.getAddress(profile.keyID),
					amountFiat6,
					currency: String(cardCurrency || 'USD').toUpperCase(),
					kind: stripeKind ?? 'topup',
					businessIdempotencyKey: (() => {
						if (!stripeBusinessKeyRef.current) {
							const randomPart =
								typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
									? crypto.randomUUID()
									: `${Date.now()}-${Math.random().toString(16).slice(2)}`
							stripeBusinessKeyRef.current = `merchant-card-stripe:${randomPart}`
						}
						return stripeBusinessKeyRef.current
					})(),
					...(stripeKind === 'membership' && membershipTierIndex != null
						? { membershipTierIndex }
						: {}),
					...(stripeKind === 'membership' && membershipFeeFiat6
						? { membershipFeeFiat6 }
						: {}),
				}),
			})
			const body = (await response.json().catch(() => ({}))) as { sessionId?: string; url?: string; error?: string }
			if (!response.ok || !body.sessionId || !body.url) {
				throw new Error(body.error ?? 'Unable to start Stripe payment.')
			}
			setStripeSessionId(body.sessionId)
			setStripePaymentOutcome('pending')
			setStep('stripeWaiting')
			openExternalUrl(body.url)
		} catch (error) {
			setPayError(error instanceof Error ? error.message : 'Unable to start Stripe payment.')
			setStripeBusy(false)
		}
	}, [
		amountFiat6,
		cardAddress,
		cardCurrency,
		membershipFeeFiat6,
		membershipTierIndex,
		profile.keyID,
		stripeBusy,
		stripeKind,
		stripeReady,
	])

	useEffect(() => {
		if (!stripeSessionId) return
		let disposed = false
		let timer: ReturnType<typeof setTimeout> | undefined
		let attempts = 0
		const poll = async () => {
			try {
				const response = await fetch(`${BEAMIO_API_BASE}/api/merchantCardStripe/poll`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ sessionId: stripeSessionId }),
				})
				const body = (await response.json().catch(() => ({}))) as {
					status?: string
					fulfillmentStatus?: string
					error?: string | null
				}
				if (!response.ok) throw new Error(body.error || 'Unable to read Stripe payment status.')
				if (disposed) return
				if (body.fulfillmentStatus === 'fulfillment_succeeded') {
					setStripeBusy(false)
					setStripePaymentMessage('Payment completed. Your store credits are now available.')
					setStripeSessionId(null)
					setStripePaymentOutcome('success')
					setMintedLabel(creditQuote ? creditQuote.total.toFixed(2) : Number(fiatHuman).toFixed(2))
					setStep('success')
					onSuccess?.()
					return
				}
				if (body.fulfillmentStatus === 'fulfillment_failed' || body.status === 'failed') {
					setStripeBusy(false)
					setStripePaymentMessage(body.error || 'Stripe payment could not be completed.')
					setStripeSessionId(null)
					setStripePaymentOutcome('failed')
					setPayError(body.error || 'Stripe payment was canceled or could not be completed.')
					setStep('stripeWaiting')
					return
				}
				setStripePaymentMessage(
					body.status === 'succeeded'
						? 'Payment received. Waiting for the merchant card update…'
						: 'Complete payment in the Stripe tab. This page will update automatically.',
				)
				if (attempts < 120 && !disposed) {
					attempts += 1
					timer = setTimeout(() => void poll(), 3000)
				} else {
					setStripeBusy(false)
					setStripePaymentMessage('Payment is still pending. You can close this panel and check again later.')
					setStripePaymentOutcome('pending')
				}
			} catch (error) {
				if (disposed) return
				setStripePaymentMessage('Waiting for Stripe payment status…')
				if (attempts < 120) {
					attempts += 1
					timer = setTimeout(() => void poll(), 5000)
				} else {
					setStripeBusy(false)
					setStripePaymentMessage(error instanceof Error ? error.message : 'Unable to read Stripe payment status.')
					setStripePaymentOutcome('failed')
				}
			}
		}
		void poll()
		return () => {
			disposed = true
			if (timer) clearTimeout(timer)
		}
	}, [onSuccess, stripeSessionId])

	const finishClose = useCallback(() => {
		if (!closeStartedRef.current) return
		if (closeTimer.current) {
			clearTimeout(closeTimer.current)
			closeTimer.current = undefined
		}
		onClose()
	}, [onClose])

	const close = useCallback(() => {
		if (closeStartedRef.current || isClosing || payBusy) return
		closeStartedRef.current = true
		setIsClosing(true)
		// Fallback only; the normal path waits for the actual CSS transition.
		closeTimer.current = setTimeout(finishClose, 360)
	}, [finishClose, isClosing, payBusy])

	const handleShareEarn = useCallback(async () => {
		if (sharing) return
		setShareAlert('')
		if (!shareUrl) {
			setShareAlert('Share link is unavailable.')
			return
		}
		setSharing(true)
		try {
			const dbName = resolveName(cardAddress)
			const titleName =
				dbName && !isGenericMerchantCardDisplayName(dbName) ? dbName : merchantName
			const outcome = await shareDiscoverMerchantUrl(shareUrl, {
				title: titleName?.trim()
					? `Discover ${titleName.trim()} on Beamio`
					: 'Discover this brand on Beamio',
			})
			if (outcome === 'copied') {
				setShareCopied(true)
				setShareAlert('Link copied. Paste it to invite friends.')
				if (shareResetTimer.current) clearTimeout(shareResetTimer.current)
				shareResetTimer.current = setTimeout(() => {
					setShareCopied(false)
					setShareAlert('')
				}, 3000)
			} else if (outcome === 'shared') {
				setShareCopied(true)
				if (shareResetTimer.current) clearTimeout(shareResetTimer.current)
				shareResetTimer.current = setTimeout(() => setShareCopied(false), 2000)
			} else if (outcome === 'failed') {
				setShareAlert('Could not share this store. Try again.')
			}
		} finally {
			setSharing(false)
		}
	}, [sharing, shareUrl, cardAddress, merchantName, resolveName])

	useEffect(() => {
		if (!open) return
		setIsEntered(false)
		setIsClosing(false)
		closeStartedRef.current = false
		setStep('amount')
		setAmountInput(initialAmount?.trim() || '50.00')
		setSmartPay(true)
		setUsedManual(false)
		setSelected(new Set())
		setPayError('')
		setPayBusy(false)
		setSuccessNote('')
		setStripePaymentOutcome('pending')
		setSharing(false)
		setShareCopied(false)
		setShareAlert('')
		const frame = requestAnimationFrame(() => setIsEntered(true))
		return () => {
			cancelAnimationFrame(frame)
			if (closeTimer.current) clearTimeout(closeTimer.current)
			closeTimer.current = undefined
			if (shareResetTimer.current) clearTimeout(shareResetTimer.current)
		}
	}, [open, initialAmount])

	useEffect(() => {
		if (!open || !cardAddress) return
		registerCardAddresses([cardAddress])
		void ensureCardsForAddresses([cardAddress])
		void getCardMetadataFromApi(cardAddress)
			.then((meta) => {
				if (meta?.name && !isGenericMerchantCardDisplayName(meta.name)) {
					setMerchantName(meta.name)
				}
				setMerchantIcon(pickNonFactoryMerchantAssetUrl(meta?.icon, meta?.image))
			})
			.catch(() => undefined)
	}, [open, cardAddress, registerCardAddresses, ensureCardsForAddresses])

	const loadQuoteAndBalances = useCallback(async () => {
		if (!cardAddress || Number(fiatHuman) <= 0) return
		try {
			const q = await quoteFiat6ToUsdc6(cardAddress, String(cardCurrency || 'USD'), fiatHuman)
			if (q.usdc6 > 0n) {
				setQuotedUsdc6(q.usdc6)
				setQuotedForFiat(fiatHuman)
			}
		} catch {
			/* keep last trusted quote */
		}
		const eoa = profile.keyID
		if (eoa) {
			const bal = await readEoaConetUsdc6(eoa)
			if (bal !== null) setEoaUsdc6(bal)
		}
		try {
			const baseBal = await readEoaUsdcBalance6(profile)
			setBaseUsdc6(baseBal)
		} catch {
			/* untrusted — leave previous Base balance */
		}
	}, [cardAddress, cardCurrency, fiatHuman, profile?.keyID, profile?.aaAccount])

	const daemonSeedAssets = myBrandCardDetails[cardAddress.toLowerCase()]?.assets ?? null

	const applyHydratedSameStore = useCallback(
		(assets: SeedReward13Assets | null | undefined) => {
			const hydrated = hydrateSameStoreRowFromAssets(cardAddress, assets, merchantName)
			if (!hydrated) return false
			setRows((prev) => {
				const existing = prev.find(
					(r) =>
						r.coverKind === 'toProgramPoints' &&
						r.cardAddress.toLowerCase() === hydrated.cardAddress.toLowerCase(),
				)
				if (existing && existing.pointsBalance6 >= hydrated.pointsBalance6) return prev
				return mergeReward13Rows(prev, [hydrated])
			})
			// Preview seed has redeemable=0 until allow-gate refine; do not settle cover yet.
			return true
		},
		[cardAddress, merchantName],
	)

	const loadRewardRows = useCallback(async () => {
		if (!cardAddress || !profile) return
		setRowsLoading(true)
		// Safety: never leave Points Covered / Cash Required spinning if RPC hangs.
		const settleWatchdog = window.setTimeout(() => {
			setSameStoreReady(true)
			rowsReadyRef.current = true
			setRowsReady(true)
		}, 12_000)
		try {
			// #13 is on deployed Consumer AA — resolve on-chain when profile.aaAccount is
			// missing or points at a CREATE2 prediction with no code.
			const aa = await resolveAaHoldingReward13(profile, profileAa || profile.aaAccount)
			if (!aa) {
				// Fail-closed: cannot size #13 — unlock cover as cash-only (0 points).
				setSameStoreReady(true)
				rowsReadyRef.current = true
				setRowsReady(true)
				return
			}
			setResolvedAa(aa)
			// Prefetch / prior ticks write under resolved AA; open-time peek often used
			// profile.aaAccount and missed the positive cache.
			const peeked = peekReward13RowsCache(aa, cardAddress)
			if (sameStoreHasPositiveCover(peeked ?? [])) {
				setRows((prev) => mergeReward13Rows(prev, peeked!))
				setSameStoreReady(true)
			}
			const list = await loadReward13RowsForAa(profile, aa, cardAddress, {
				onPartial: (partial) => {
					setRows((prev) => mergeReward13Rows(prev, partial))
					// Settle only on positive usable cover, trusted empty AA, or a real
					// escrow-sized row (never on unsized preview redeemable=0 alone).
					if (
						sameStoreHasPositiveCover(partial) ||
						sameStoreEscrowSized(partial) ||
						isTrustedSameStoreZero(aa, cardAddress)
					) {
						setSameStoreReady(true)
					}
				},
			})
			setRows((prev) => mergeReward13Rows(prev, list))
			if (
				sameStoreHasPositiveCover(list) ||
				sameStoreEscrowSized(list) ||
				isTrustedSameStoreZero(aa, cardAddress)
			) {
				setSameStoreReady(true)
			}
			rowsReadyRef.current = true
			setRowsReady(true)
		} catch {
			/* keep last trusted rows; still unlock cover so UI is not stuck loading */
			setSameStoreReady(true)
			rowsReadyRef.current = true
			setRowsReady(true)
		} finally {
			window.clearTimeout(settleWatchdog)
			setRowsLoading(false)
		}
	}, [cardAddress, profile, profileAa])

	useEffect(() => {
		if (!open || !cardAddress) return
		rowsReadyRef.current = false
		setQuotedUsdc6(0n)
		setQuotedForFiat('')
		setLegs([])
		setRowsReady(false)
		setSameStoreReady(false)
		setResolvedAa('')
		const cached = peekReward13RowsCache(profileAa || profile.aaAccount, cardAddress)
		const seed = collectSmartPaySeedAssets({
			cardAddress,
			profile,
			seedAssets,
			seedPoints13,
			daemonAssets: daemonSeedAssets,
		})
		const hydrated = hydrateSameStoreRowFromAssets(cardAddress, seed, merchantName)
		const merged = mergeReward13Rows(cached ?? [], hydrated ? [hydrated] : [])
		if (merged.length > 0) {
			setRows(merged)
			// Open-time: only unlock on positive usable cover. escrowSized+redeemable=0
			// may be poison from fail-closed RPC — keep spinner until loadRewardRows
			// re-sizes (or trustedSameStoreZero).
			const settled = sameStoreHasPositiveCover(merged)
			setSameStoreReady(settled)
			setRowsLoading(!settled)
		} else {
			// Keep loading until chain AA resolve + #13 preview — do not cash-only
			// settle just because profile.aaAccount is briefly empty.
			setRowsLoading(true)
		}
		// Do not fire getMyAssets / extra #13 reads here. CoNET RPC is serial
		// (batchMaxCount:1); those storms starve the same-store preview and
		// leave Points Covered at 0.00. Seed + planner preview-first is enough.
		void loadRewardRows()
		// eslint-disable-next-line react-hooks/exhaustive-deps -- open / card change only; amount quote reloads below
	}, [open, cardAddress])

	useEffect(() => {
		if (!open || !cardAddress || rowsReadyRef.current) return
		if (!profileAa && !profile?.keyID) return
		void loadRewardRows()
	}, [open, cardAddress, profileAa, profile?.keyID, loadRewardRows])

	useEffect(() => {
		if (!open || !cardAddress) return
		const seed = collectSmartPaySeedAssets({
			cardAddress,
			profile,
			seedAssets,
			seedPoints13,
			daemonAssets: daemonSeedAssets,
		})
		applyHydratedSameStore(seed)
	}, [
		applyHydratedSameStore,
		cardAddress,
		daemonSeedAssets,
		open,
		profile,
		seedAssets,
		seedPoints13,
	])

	useEffect(() => {
		if (!open || !cardAddress) return
		// Estimate same-store cover without a quote. Wait until the #13 row
		// exists so quote cannot paint Points Covered as 0.00 first.
		if (smartPay && !sameStoreReady) return
		void loadQuoteAndBalances()
	}, [open, cardAddress, fiatHuman, loadQuoteAndBalances, smartPay, sameStoreReady])

	useEffect(() => {
		if (!smartPay) {
			setLegs([])
			return
		}
		if (quotedUsdc6 <= 0n || quotedForFiat !== fiatHuman) return
		if (rows.length === 0 && !sameStoreReady) return
		const gen = ++legsPlanGen.current
		void (async () => {
			try {
				const fiat6 = parseFiatHumanTo6(fiatHuman)
				const planned = usedManual
					? await planManualCoverUsdc(rows, selected, quotedUsdc6, fiat6)
					: await planAutoCoverUsdc(rows, quotedUsdc6, fiat6)
				if (gen === legsPlanGen.current) setLegs(planned)
			} catch {
				/* keep last trusted legs */
			}
		})()
	}, [smartPay, rows, selected, quotedUsdc6, quotedForFiat, fiatHuman, usedManual, sameStoreReady])

	const coveredUsdc6 = sumUsdc6(legs)
	const cashUsdc6 = payableCashUsdc6(quotedUsdc6, coveredUsdc6)
	const dualSmartPay = smartPay && legs.length > 0 && cashUsdc6 > 0n
	const conetCoversCash = dualSmartPay && eoaUsdc6 !== null && eoaUsdc6 >= cashUsdc6
	const cashNeedsBaseUsdc = dualSmartPay && !conetCoversCash
	const cashUnfundable =
		dualSmartPay &&
		eoaUsdc6 !== null &&
		!conetCoversCash &&
		baseUsdc6 !== null &&
		!eoaCanSelfFundDiscoverTopup(baseUsdc6, cashUsdc6)
	const cashUnfundableAlert =
		cashUnfundable && eoaUsdc6 !== null && baseUsdc6 !== null
			? formatUnfundableDualCashAlert(eoaUsdc6, baseUsdc6, cashUsdc6)
			: ''
	const payPanelAlert = payError || cashUnfundableAlert
	const payBusyLabel = dualSmartPay
		? 'Paying with Points and USDC…'
		: legs.length > 0
			? 'Applying points…'
			: 'Paying with USDC…'
	const displayRows = useMemo(() => {
		const seed = collectSmartPaySeedAssets({
			cardAddress,
			profile,
			seedAssets,
			seedPoints13,
			daemonAssets: daemonSeedAssets,
		})
		const hydrated = hydrateSameStoreRowFromAssets(cardAddress, seed, merchantName)
		return mergeReward13Rows(hydrated ? [hydrated] : [], rows)
	}, [
		cardAddress,
		daemonSeedAssets,
		merchantName,
		profile,
		rows,
		rowsReady,
		seedAssets,
		seedPoints13,
	])
	const usableRows = displayRows.filter((r) =>
		r.coverKind === 'toProgramPoints'
			? r.redeemablePoints6 > 0n
			: r.redeemableUsdc6 > 0n && r.redeemablePoints6 > 0n,
	)
	// In manual mode, a deselected merchant must be excluded from every
	// downstream cover calculation, not only from the generated burn legs.
	// Otherwise Review/Confirm can re-estimate against all displayRows and
	// silently re-add the deselected merchant's PT.
	const coverageRows = usedManual
		? displayRows.filter((row) => selected.has(row.cardAddress.toLowerCase()))
		: displayRows
	const fiatN = Number(fiatHuman)
	const coveredFiat = resolveSmartPayCoveredFiat({
		smartPay,
		fiatN,
		fiatHuman,
		quotedUsdc6,
		quotedForFiat,
		coveredUsdc6,
		rows: coverageRows,
		rowsReady,
	})
	const cashFiat = Math.max(0, fiatN - coveredFiat)
	const appliedPts6 = smartPay
		? legs.reduce((sum, leg) => sum + leg.pointsCost, 0n)
		: 0n
	const savedPercent =
		smartPay && Number.isFinite(fiatN) && fiatN > 0 && coveredFiat > 0
			? Math.min(100, Math.round((coveredFiat / fiatN) * 100))
			: 0
	const pointsBarPct =
		smartPay && Number.isFinite(fiatN) && fiatN > 0
			? Math.min(100, Math.max(0, (coveredFiat / fiatN) * 100))
			: 0
	const cashBarPct = 100 - pointsBarPct
	const appliedPtsLabel =
		appliedPts6 > 0n
			? formatPtsShort(appliedPts6)
			: coveredFiat > 0
				? coveredFiat.toLocaleString('en-US', {
						minimumFractionDigits: Number.isInteger(coveredFiat) ? 0 : 2,
						maximumFractionDigits: 2,
					})
				: '0'
	const confirmCoverLines = useMemo(
		() =>
			buildConfirmCoverLines({
				legs,
				coverageRows,
				coveredFiat,
				quotedUsdc6,
				fiatN,
				fallbackName: merchantName,
			}),
		[legs, coverageRows, coveredFiat, quotedUsdc6, fiatN, merchantName],
	)
	const coverAa = resolvedAa || profileAa
	// Spinner until same-store cover is ready. Do not treat a 0-PT same-store row
	// (or rowsReady alone) as settled — that painted CA$ 0.00 while #13 still loading.
	const coverEstimatePending =
		smartPay &&
		Number.isFinite(fiatN) &&
		fiatN > 0 &&
		coveredFiat <= 0 &&
		!sameStoreReady
	const quoteReady = quotedUsdc6 > 0n && quotedForFiat === fiatHuman
	// Require same-store settle (or planned legs). Do not treat empty rowsReady as
	// cash-only ready — that unlocked Confirm while Points Covered still spun / showed 0.
	const pointsPlanReady = !smartPay || sameStoreReady || legs.length > 0
	const confirmDisabled = payBusy || !quoteReady || cashUnfundable || !pointsPlanReady
	const paymentSubmitDisabled =
		paymentMethod === 'card'
			? payBusy || stripeBusy || !stripeReady || !amountFiat6
			: confirmDisabled
	// Usable PT = same-store full #13 when allow PT→#0; peer = escrow+liquidity sized.
	const availablePts6 = usableRows.reduce((sum, row) => sum + row.redeemablePoints6, 0n)
	const merchantCount = usableRows.length

	const goPay = () => {
		if (Number(fiatHuman) <= 0) return
		setStep('pay')
	}

	const toggleSelect = (addr: string) => {
		const key = addr.toLowerCase()
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	const redeemLegsThenBuy = async () => {
		if (confirmDisabled) return

		setPayBusy(true)
		setPayError('')
		try {
			const armor = resolveSigningPrivateKeyArmor(profile)
			if (!armor) throw new Error('Wallet key is required')
			const wallet = new ethers.Wallet(armor)
			const userEOA = wallet.address
			let assets: MyCardAssets | undefined

			if (legs.length > 0 && cashUsdc6 > 0n) {
				const cashAmount = formatCashFiatApiAmount(cashFiat, String(cardCurrency || 'USD'))
				let conetBal = eoaUsdc6
				try {
					conetBal = await readEoaConetUsdc6(userEOA)
					setEoaUsdc6(conetBal)
				} catch {
					/* untrusted — leave previous CONET-USDC */
				}
				const conetCovers = conetBal !== null && conetBal >= cashUsdc6
				const tryOneShot = conetCovers || conetBal === null
				let oneShotDone = false
				if (tryOneShot) {
					const container = await postTopupWithReward13Container({
						targetCard: cardAddress,
						userEOA,
						legs,
						cashUsdc6,
						privateKeyArmor: armor,
						wallet,
					})
					if (container.success) {
						oneShotDone = true
					} else {
						const raw = container.error || 'Points top-up failed'
						if (!conetCovers && isInsufficientConetUsdcError(raw)) {
							/* fall through to Reward PT then Base USDC remainder */
						} else {
							throw new Error(friendlyTopupContainerError(raw))
						}
					}
				}
				if (!oneShotDone) {
					const runPoints = async (): Promise<DualLegResult> => {
						try {
							const container = await postTopupWithReward13Container({
								targetCard: cardAddress,
								userEOA,
								legs,
								cashUsdc6: 0n,
								privateKeyArmor: armor,
								wallet,
							})
							if (!container.success) {
								return {
									ok: false,
									error: friendlyTopupContainerError(container.error || 'Points top-up failed'),
								}
							}
							return { ok: true }
						} catch (e: unknown) {
							return {
								ok: false,
								error: friendlyTopupContainerError(e instanceof Error ? e.message : String(e)),
							}
						}
					}
					const runCashBase = async (): Promise<DualLegResult> => {
						try {
							const userAa = profile.aaAccount?.trim()
							if (!userAa || !ethers.isAddress(userAa)) {
								return {
									ok: false,
									error:
										'Smart Wallet (AA) is required for USDC top-up. Open Wallet and finish setup, then retry.',
								}
							}
							let cardOwnerForCash: string | null = null
							let settleQuotedUsdc6 = cashUsdc6
							try {
								cardOwnerForCash = await getCardOwner(cardAddress)
								if (cardOwnerForCash && cardOwnerForCash !== ethers.ZeroAddress) {
									settleQuotedUsdc6 = await fetchDiscoverClientTopupQuotedUsdc6({
										cardAddress,
										cardOwner: cardOwnerForCash,
										amount: cashAmount,
										currency: String(cardCurrency || 'USD'),
									})
								}
							} catch {
								/* keep plan quote; payDiscoverTreasuryBridgeWithLocalWallet also re-quotes */
							}
							if (!cardOwnerForCash || cardOwnerForCash === ethers.ZeroAddress) {
								return { ok: false, error: 'Cannot resolve merchant card owner. Please retry.' }
							}
							let baseBal = baseUsdc6
							try {
								baseBal = await readEoaUsdcBalance6(profile)
								setBaseUsdc6(baseBal)
							} catch {
								/* untrusted — leave previous Base balance */
							}
							if (baseBal !== null && !eoaCanSelfFundDiscoverTopup(baseBal, settleQuotedUsdc6)) {
								return {
									ok: false,
									error: formatInsufficientUsdcAlert(baseBal, settleQuotedUsdc6, {
										afterPoints: true,
									}),
								}
							}
							const localPay = await payDiscoverTreasuryBridgeWithLocalWallet({
								profile,
								privateKeyArmor: armor,
								cardAddress,
								cardOwner: cardOwnerForCash,
								recipientAa: userAa,
								amount: cashAmount,
								currency: String(cardCurrency || 'USD'),
								quotedUsdc6: settleQuotedUsdc6,
							})
							if (!localPay.ok) {
								return { ok: false, error: localPay.error || 'USDC top-up failed' }
							}
							return { ok: true }
						} catch (e: unknown) {
							return { ok: false, error: e instanceof Error ? e.message : String(e) }
						}
					}
					const pointsRes = await runPoints()
					if (!pointsRes.ok) {
						throw new Error(`Reward PT payment failed: ${pointsRes.error}`)
					}
					const cashRes = await runCashBase()
					if (!cashRes.ok) {
						throw new Error(`USDC payment failed: ${cashRes.error}`)
					}
				}
				assets = await refreshMyAssetsAfterSuccessfulTopup(profile, cardAddress)
				setSuccessNote(
					oneShotDone
						? 'Points and USDC completed in one payment.'
						: 'Points and USDC both completed.',
				)
			} else if (legs.length > 0) {
				const container = await postTopupWithReward13Container({
					targetCard: cardAddress,
					userEOA,
					legs,
					cashUsdc6: 0n,
					privateKeyArmor: armor,
					wallet,
				})
				if (!container.success) {
					throw new Error(friendlyTopupContainerError(container.error || 'Points top-up failed'))
				}
				assets = await refreshMyAssetsAfterSuccessfulTopup(profile, cardAddress)
				setSuccessNote('')
			} else if (cashUsdc6 > 0n) {
				/**
				 * Cash-only — same priority as Discover Market top-up:
				 * 1) Base USDC → treasuryBridge (in-app, local wallet)
				 * 2) CoNET-USDC → purchasingCard
				 * 3) Third-party `/usdc-topup` only when both local balances are short
				 */
				const userAa = profile.aaAccount?.trim()
				let baseBal = baseUsdc6
				try {
					baseBal = await readEoaUsdcBalance6(profile)
					setBaseUsdc6(baseBal)
				} catch {
					/* keep previous */
				}
				let settleQuotedUsdc6 = cashUsdc6
				let cardOwnerForCash: string | null = null
				try {
					cardOwnerForCash = await getCardOwner(cardAddress)
					if (cardOwnerForCash && cardOwnerForCash !== ethers.ZeroAddress) {
						settleQuotedUsdc6 = await fetchDiscoverClientTopupQuotedUsdc6({
							cardAddress,
							cardOwner: cardOwnerForCash,
							amount: fiatHuman,
							currency: String(cardCurrency || 'USD'),
						})
					}
				} catch {
					/* keep chain quote; payDiscoverTreasuryBridgeWithLocalWallet also re-quotes */
				}
				if (baseBal !== null && eoaCanSelfFundDiscoverTopup(baseBal, settleQuotedUsdc6)) {
					if (!userAa || !ethers.isAddress(userAa)) {
						throw new Error(
							'Smart Wallet (AA) is required for USDC top-up. Open Wallet and finish setup, then retry.',
						)
					}
					if (!cardOwnerForCash || cardOwnerForCash === ethers.ZeroAddress) {
						throw new Error('Cannot resolve merchant card owner. Please retry.')
					}
					const localPay = await payDiscoverTreasuryBridgeWithLocalWallet({
						profile,
						privateKeyArmor: armor,
						cardAddress,
						cardOwner: cardOwnerForCash,
						recipientAa: userAa,
						amount: fiatHuman,
						currency: String(cardCurrency || 'USD'),
						quotedUsdc6: settleQuotedUsdc6,
					})
					if (localPay.ok) {
						assets = await refreshMyAssetsAfterSuccessfulTopup(profile, cardAddress)
						setMintedLabel(creditQuote ? creditQuote.total.toFixed(2) : Number(fiatHuman).toFixed(2))
						setStep('success')
						onSuccess?.(assets)
						return
					}
					if (!localPay.insufficientBalance) {
						throw new Error(localPay.error || 'USDC top-up failed')
					}
					/* Balance raced down — fall through to CoNET-USDC / third-party. */
				}

				let conetBal = eoaUsdc6
				if (profile.keyID) {
					const refreshedConet = await readEoaConetUsdc6(profile.keyID)
					if (refreshedConet !== null) {
						conetBal = refreshedConet
						setEoaUsdc6(refreshedConet)
					}
				}
				if (conetBal !== null && conetBal >= cashUsdc6) {
					const buy = await postBuyCardPoints(
						ethers.formatUnits(cashUsdc6, 6),
						{ ...profile, privateKeyArmor: armor },
						cardAddress,
					)
					if (!buy?.success) {
						throw new Error(
							buy?.error ||
								'Store credit purchase failed. Check USDC balance and try again.',
						)
					}
					assets = buy.assets ?? undefined
				} else {
					/** Neither Base nor CoNET-USDC covers cash — third-party treasuryBridge. */
					if (!userAa || !ethers.isAddress(userAa)) {
						throw new Error(
							'Smart Wallet (AA) is required for third-party top-up. Open Wallet and finish setup, then retry.',
						)
					}
					const cardOwner =
						cardOwnerForCash && cardOwnerForCash !== ethers.ZeroAddress
							? cardOwnerForCash
							: await getCardOwner(cardAddress)
					if (!cardOwner || cardOwner === ethers.ZeroAddress) {
						throw new Error('Cannot resolve merchant card owner. Please retry.')
					}
					const payUrl = buildDiscoverUsdcTreasuryBridgeQrUrl({
						cardAddress,
						cardOwner,
						amount: fiatHuman,
						currency: String(cardCurrency || 'USD'),
						recipientAa: userAa,
					})
					openExternalUrl(payUrl)
					return
				}
			} else {
				throw new Error('Nothing to top up')
			}

			setMintedLabel(creditQuote ? creditQuote.total.toFixed(2) : Number(fiatHuman).toFixed(2))
			setStep('success')
			onSuccess?.(assets)
		} catch (e: unknown) {
			setPayError(friendlyTopupContainerError(e instanceof Error ? e.message : String(e)))
		} finally {
			setPayBusy(false)
		}
	}

	if (!open) return null

	const dbName = resolveName(cardAddress)
	const displayMerchantName =
		dbName && !isGenericMerchantCardDisplayName(dbName) ? dbName : merchantName
	const displayMerchantIcon =
		resolveImage(cardAddress) || pickNonFactoryMerchantAssetUrl(merchantIcon) || ''
	const amountMatchesQuick = (q: string) => {
		const n = Number(amountInput.replace(/,/g, '').trim())
		return Number.isFinite(n) && n === Number(q)
	}
	const storeCreditsLabel = `${prefix}${Number(storeCreditsPoints || 0).toFixed(2)}`
	const heroDigitsWidth = Math.max(amountInput.replace(/,/g, '').trim().length, 4)
	const amountDueLabel =
		cashUsdc6 > 0n
			? `${formatUsdcDue(cashUsdc6)} USDC`
			: coveredFiat > 0
				? 'Covered'
				: `${formatUsdcDue(quotedUsdc6)} USDC`
	const confirmPayLabel =
		cashUsdc6 > 0n
			? `Pay ${formatUsdcDue(cashUsdc6)} USDC`
			: coveredFiat > 0
				? 'Apply Points'
				: `Pay ${formatUsdcDue(quotedUsdc6)} USDC`
	const cashRequiredLabel =
		paymentMethod === 'card'
			? formatPrefixedFiat(prefix, cashFiat.toFixed(2))
			: formatUsdcDue(cashUsdc6)

	const back = () => {
		if (payBusy) return
		if (step === 'amount') close()
		else if (step === 'pay') {
			setUsedManual(false)
			setStep('amount')
		}
		else if (step === 'select') setStep('pay')
		else if (step === 'confirm') setStep('pay')
		else close()
	}

	const title =
		step === 'amount'
			? 'Top Up'
			: step === 'pay'
				? 'Payment'
				: step === 'select'
					? 'Select Points'
					: step === 'confirm'
						? 'Confirm Top-Up'
						: step === 'stripeWaiting'
							? 'Stripe Payment'
						: 'Top-Up Successful'

	return (
		<div
			className="fixed inset-0 z-[130] dark:bg-slate-950"
			style={{
				backgroundColor: pageSurface,
				backgroundImage:
					step === 'success'
						? `radial-gradient(120% 90% at 50% 8%, ${merchantBrandTint} 0%, ${merchantBrandSoftTint} 42%, ${pageSurface} 78%)`
						: undefined,
				transform: isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)',
				transition: 'transform 300ms ease-out',
			}}
			onTransitionEnd={(event) => {
				if (event.target === event.currentTarget && event.propertyName === 'transform') {
					finishClose()
				}
			}}
		>
			<div
				className="flex h-full flex-col overflow-y-auto"
				style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
			>
				{step !== 'success' ? (
					<div className="pointer-events-none fixed inset-x-0 top-0 z-[160] px-4 pt-[max(1rem,env(safe-area-inset-top,0px))]">
						<BeamioCircularBackButton
							variant="onLight"
							onClick={back}
							className="pointer-events-auto absolute left-4 top-0"
						/>
						{step === 'select' ? (
							<button
								type="button"
								onClick={() => {
									setCommittedSelected(new Set(selected))
									setUsedManual(true)
									setStep('pay')
								}}
								className="pointer-events-auto absolute right-4 top-0 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-1 text-[#2c2f31] transition active:scale-[0.96] dark:text-slate-100"
								aria-label="Confirm"
								title="Confirm"
								tabIndex={-1}
							>
								<span
									className="pointer-events-none absolute inset-1 rounded-full border border-black/[0.08] bg-white/90 shadow-[0_2px_10px_rgba(0,0,0,0.16),0_1px_3px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-white/25 dark:bg-slate-800/90"
									aria-hidden
								/>
								<Check className="relative z-[1] h-[17px] w-[17px]" strokeWidth={2.5} aria-hidden />
							</button>
						) : null}
						{step === 'amount' ? (
							<h1
								className="pointer-events-none absolute inset-x-12 top-1/2 -translate-y-1/2 text-center text-[22px] font-semibold tracking-tight dark:text-slate-100"
								style={{ color: merchantBrandActionColor }}
							>
								Top Up
							</h1>
						) : null}
					</div>
				) : null}
				{step === 'confirm' ? (
					<header className="px-5 pb-6 pt-2">
						<p
							className="text-[11px] font-semibold uppercase tracking-[0.16em]"
							style={{ color: merchantBrandMutedColor }}
						>
							Review
						</p>
						<h1
							className="mt-1 text-3xl font-semibold dark:text-slate-100"
							style={{ color: merchantBrandActionColor }}
						>
							{title}
						</h1>
					</header>
				) : step === 'select' ? (
					<header className="px-5 pb-6 pt-2">
						<p
							className="text-[11px] font-semibold uppercase tracking-[0.16em]"
							style={{ color: merchantBrandMutedColor }}
						>
							Store credits
						</p>
						<h1
							className="mt-1 text-3xl font-semibold dark:text-slate-100"
							style={{ color: merchantBrandActionColor }}
						>
							{title}
						</h1>
					</header>
				) : null}

				<div
					className={`flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] ${
						step === 'pay' || step === 'confirm' ? 'pt-12' : ''
					}`}
				>
					{step === 'amount' && (
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="flex flex-1 flex-col items-center pt-5">
								{displayMerchantIcon ? (
									<div
										className="mt-6 flex h-20 w-20 items-center justify-center rounded-full border p-1 shadow-sm"
										style={{
											backgroundColor: merchantBrandActionColor,
											borderColor: merchantBrandBorder,
										}}
									>
										<IpfsImg
											src={displayMerchantIcon}
											alt=""
											className="h-full w-full rounded-full object-cover"
										/>
									</div>
								) : (
									<div
										className="mt-6 flex h-20 w-20 items-center justify-center rounded-full border text-2xl font-bold shadow-sm"
										style={{
											backgroundColor: merchantBrandTint,
											borderColor: merchantBrandBorder,
											color: merchantBrandActionColor,
										}}
										aria-hidden
									>
										{(displayMerchantName || 'M').trim().slice(0, 1).toUpperCase()}
									</div>
								)}
								<p
									className="mt-3 text-[22px] font-bold leading-tight dark:text-slate-100"
									style={{ color: merchantBrandActionColor }}
								>
									{displayMerchantName}
								</p>
								<p
									className="mt-1 text-[15px] font-medium dark:text-slate-400"
									style={{ color: merchantBrandMutedColor }}
								>
									Store Credits: {storeCreditsLabel}
								</p>
								<label htmlFor="merchant-topup-amount" className="sr-only">
									Amount
								</label>
								<div
									className="mt-12 inline-flex items-baseline justify-center border-b-2 pb-1.5"
									style={{ borderColor: merchantBrandBorder }}
								>
									<span
										className="shrink-0 text-[34px] font-bold dark:text-slate-400"
										style={{ color: merchantBrandMutedColor }}
									>
										{prefix}
									</span>
									<input
										id="merchant-topup-amount"
										type="number"
										inputMode="decimal"
										autoComplete="off"
										enterKeyHint="done"
										min={0}
										step="0.01"
										value={amountInput}
										onChange={(e) => setAmountInput(e.target.value)}
										onFocus={(e) => e.currentTarget.select()}
										onKeyDown={preventStepKeys}
										onWheel={(e) => {
											e.preventDefault()
											e.stopPropagation()
										}}
										className={`ml-1.5 bg-transparent p-0 text-[40px] font-bold leading-none tracking-tight outline-none dark:text-slate-100 ${SPINNER_CLASS}`}
										style={{ width: `${heroDigitsWidth}ch`, color: merchantBrandActionColor }}
									/>
								</div>
								{creditQuote && creditQuote.bonus > 0 ? (
									<div
										className="relative mt-5 w-full max-w-md overflow-hidden rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900"
										style={{ borderColor: merchantBrandBorder }}
									>
										<div
											className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-xl"
											style={{ backgroundColor: merchantBrandTint }}
										/>
										<div className="relative flex items-center justify-between gap-2">
											<span
												className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
												style={{
													borderColor: merchantBrandBorder,
													backgroundColor: merchantBrandTint,
													color: merchantBrandActionColor,
												}}
											>
												+ {prefix} {creditQuote.bonus.toFixed(2)} Bonus!
											</span>
											<span
												className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
												style={{
													backgroundColor: merchantBrandTint,
													color: merchantBrandActionColor,
												}}
											>
												Best Value
											</span>
										</div>
										<div
											className="mt-3 flex items-center justify-between border-b py-1 text-sm"
											style={{ borderColor: merchantBrandBorder }}
										>
											<span
												className="font-medium dark:text-slate-400"
												style={{ color: merchantBrandMutedColor }}
											>
												Base Top-Up
											</span>
											<span
												className="font-semibold dark:text-slate-100"
												style={{ color: merchantBrandActionColor }}
											>
												{prefix} {creditQuote.principal.toFixed(2)}
											</span>
										</div>
										<div
											className="flex items-center justify-between border-b py-1 text-sm"
											style={{ borderColor: merchantBrandBorder }}
										>
											<span
												className="font-medium"
												style={{ color: merchantBrandSavedColor }}
											>
												Merchant Bonus
											</span>
											<span
												className="font-bold"
												style={{ color: merchantBrandSavedColor }}
											>
												+ {prefix} {creditQuote.bonus.toFixed(2)}
											</span>
										</div>
										<div className="flex items-center justify-between pt-2.5">
											<span
												className="font-semibold dark:text-slate-100"
												style={{ color: merchantBrandActionColor }}
											>
												Total purchasing power
											</span>
											<span
												className="text-xl font-bold tracking-tight"
												style={{ color: merchantBrandActionColor }}
											>
												{prefix} {creditQuote.total.toFixed(2)}
											</span>
										</div>
									</div>
								) : null}
								<div className="mt-7 w-full max-w-md">
									<p
										className="pl-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
										style={{ color: merchantBrandMutedColor }}
									>
										Quick amount
									</p>
									<div className="mt-3 grid grid-cols-2 gap-3">
										{quickAmounts.map((q, index) => {
											const selected = amountMatchesQuick(q)
											const multiplierCard =
												multiplierCards.length >= 2 ? multiplierCards[index] : null
											const quickQuote = quoteDiscoverStoreCreditTopupBonus({
												metadataRoot,
												currency: String(cardCurrency || 'USD'),
												amount: Number(q),
											})
											const bonusAmount = multiplierCard?.bonusAmount ?? quickQuote?.bonus ?? 0
											const bonusPercent = multiplierCard?.bonusPercent ?? (Number(q) > 0
												? (bonusAmount / Number(q)) * 100
												: 0)
											const bonusPercentLabel = Number.isInteger(bonusPercent)
												? String(bonusPercent)
												: bonusPercent.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
											const hasBonus = bonusAmount > 0
											const isBestValue = multiplierCard?.isBestValue === true
											return (
												<button
													key={q}
													type="button"
													onClick={() => setAmountInput(Number(q).toFixed(2))}
													className={`relative rounded-2xl py-3.5 text-[16px] font-semibold shadow-[0_4px_12px_rgba(15,23,42,0.10)] transition ${
														selected
															? 'border dark:text-slate-100'
															: 'border border-transparent'
													}`}
													style={
														selected
															? {
																	borderColor: merchantBrandBorder,
																	backgroundColor: merchantBrandTint,
																	color: merchantBrandActionColor,
																}
															: {
																	backgroundColor: merchantBrandIdleSurface,
																	color: merchantBrandActionColor,
																}
													}
												>
													{isBestValue ? (
														<span
															className="absolute -top-2.5 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm"
															style={{
																backgroundColor: merchantBrandActionColor,
																color: merchantBrandTextColor,
															}}
														>
															Best Value • +{bonusPercentLabel}% Extra
														</span>
													) : hasBonus ? (
														<span
															className="absolute -top-2.5 right-2 rounded-full border px-1.5 py-0.5 text-[10px] font-bold"
															style={{
																backgroundColor: merchantBrandTint,
																borderColor: merchantBrandBorder,
																color: merchantBrandActionColor,
															}}
														>
															+{bonusPercentLabel}% Bonus
														</span>
													) : null}
													<span className="block">{prefix} {formatFiatHero(Number(q))}</span>
													{hasBonus ? (
														<span
															className="mt-0.5 block text-[10px] font-bold"
															style={{ color: merchantBrandActionColor }}
														>
															+{prefix} {bonusAmount.toFixed(2)} Free
														</span>
													) : (
														<span
															className="mt-0.5 block text-[10px] font-medium dark:text-slate-400"
															style={{ color: merchantBrandMutedColor }}
														>
															Standard
														</span>
													)}
												</button>
											)
										})}
									</div>
								</div>
							</div>
							<div className="mt-6 bg-gradient-to-t from-white via-white/95 to-transparent pb-1 pt-4 dark:from-slate-950 dark:via-slate-950/95">
								<button
									type="button"
									disabled={Number(fiatHuman) <= 0}
									onClick={goPay}
									className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-[17px] font-bold shadow-[0_10px_20px_rgba(15,23,42,0.18)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
									style={{
										backgroundColor: merchantBrandActionColor,
										color: merchantBrandTextColor,
									}}
								>
									<span>
										Continue with {prefix} {(creditQuote?.total ?? Number(fiatHuman)).toFixed(2)} Credit
									</span>
									<ChevronRight className="h-5 w-5" aria-hidden />
								</button>
							</div>
						</div>
					)}

					{step === 'pay' && (
						<div className="flex min-h-0 flex-1 flex-col">
							<div
								className="rounded-[22px] border p-4 shadow-[0_4px_24px_rgba(15,23,42,0.06)]"
								style={{
									borderColor: merchantBrandBorder,
									backgroundColor: pageSurface,
								}}
							>
								<div className="flex items-center justify-between gap-3">
									<div className="flex min-w-0 items-center gap-3">
										{displayMerchantIcon ? (
											<div
												className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-0.5"
												style={{ backgroundColor: merchantBrandActionColor }}
											>
												<IpfsImg
													src={displayMerchantIcon}
													alt=""
													className="h-full w-full rounded-lg object-cover"
												/>
											</div>
										) : (
											<div
												className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
												style={{
													backgroundColor: merchantBrandTint,
													color: merchantBrandActionColor,
												}}
												aria-hidden
											>
												{merchantInitials(displayMerchantName)}
											</div>
										)}
										<div className="min-w-0">
											<p
												className="truncate text-[15px] font-semibold dark:text-slate-100"
												style={{ color: merchantBrandActionColor }}
											>
												{displayMerchantName}
											</p>
											<p
												className="mt-0.5 truncate text-[12px]"
												style={{ color: merchantBrandMutedColor }}
											>
												Store Credits
											</p>
										</div>
									</div>
									<div className="shrink-0 text-right">
										<p
											className="text-[10px] font-semibold uppercase tracking-[0.12em]"
											style={{ color: merchantBrandMutedColor }}
										>
											Top-up value
										</p>
										<p
											className="mt-1 text-[20px] font-bold"
											style={{ color: merchantBrandActionColor }}
										>
											{formatPrefixedFiat(prefix, Number(fiatHuman).toFixed(2))}
										</p>
									</div>
								</div>
							</div>

							<p
								className="mt-7 text-[11px] font-semibold uppercase tracking-[0.14em]"
								style={{ color: merchantBrandMutedColor }}
							>
								Smart Checkout · Payment Method
							</p>

							<div
								className="mt-3 overflow-hidden rounded-[24px] border bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.08)] dark:bg-slate-900"
								style={{ borderColor: merchantBrandBorder }}
							>
								<div className="flex items-start justify-between gap-3">
									<div className="flex min-w-0 items-start gap-2.5">
										<span
											className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
											style={{
												backgroundColor: merchantBrandTint,
												color: merchantBrandActionColor,
											}}
										>
											<Star className="h-4 w-4" strokeWidth={2.25} aria-hidden />
										</span>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<p
													className="text-[16px] font-semibold dark:text-slate-100"
													style={{ color: merchantBrandActionColor }}
												>
													{coverEstimatePending ? (
														<Loader2
															className="inline h-4 w-4 animate-spin"
															style={{ color: merchantBrandActionColor }}
															aria-hidden
														/>
													) : (
														`${appliedPtsLabel} Points Applied`
													)}
												</p>
												<span
													className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
													style={{
														backgroundColor: merchantBrandTint,
														color: merchantBrandActionColor,
													}}
												>
													{coverEstimatePending ? '…' : `${savedPercent}%`} SAVED
												</span>
											</div>
											<p
												className="mt-1 text-[13px] dark:text-slate-400"
												style={{ color: merchantBrandMutedColor }}
											>
												{coverEstimatePending
													? 'Estimating points cover…'
													: `${formatPrefixedFiat(prefix, coveredFiat.toFixed(2))} saved on this order`}
											</p>
										</div>
									</div>
									<button
										type="button"
										role="switch"
										aria-checked={smartPay}
										aria-label="Use Points"
										disabled={payBusy}
										onClick={() => {
											setPayError('')
											setSmartPay((v) => !v)
											setUsedManual(false)
										}}
										className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50"
										style={{
											backgroundColor: smartPay ? merchantBrandActionColor : merchantBrandSwitchOff,
										}}
									>
										<span
											className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
												smartPay ? 'left-[22px]' : 'left-0.5'
											}`}
										/>
									</button>
								</div>

								<button
									type="button"
									disabled={payBusy}
									aria-label="Choose points manually"
									onClick={() => {
										setPayError('')
										setSmartPay(true)
										setUsedManual(true)
										// Reopen with the last confirmed selection. The first
										// visit defaults to every currently usable merchant.
										const usableKeys = usableRows.map((row) => row.cardAddress.toLowerCase())
										setSelected(
											committedSelected
												? new Set(usableKeys.filter((key) => committedSelected.has(key)))
												: new Set(usableKeys),
										)
										setStep('select')
									}}
									className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
									style={{ backgroundColor: merchantBrandSoftTint }}
								>
									<div className="flex min-w-0 items-center gap-2.5">
										<span
											className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
											style={{
												backgroundColor: merchantBrandTint,
												color: merchantBrandActionColor,
											}}
										>
											<Ticket className="h-4 w-4" strokeWidth={2.1} aria-hidden />
										</span>
										<p
											className="truncate text-[15px] font-medium dark:text-slate-200"
											style={{ color: merchantBrandActionColor }}
										>
											{appliedPtsLabel} Points Discount
										</p>
									</div>
									<p
										className="shrink-0 text-[15px] font-semibold"
										style={{ color: merchantBrandSavedColor }}
										aria-busy={coverEstimatePending}
									>
										{coverEstimatePending ? (
												<Loader2
													className="h-4 w-4 animate-spin"
													style={{ color: merchantBrandActionColor }}
													aria-hidden
												/>
										) : (
											`-${formatPrefixedFiat(prefix, coveredFiat.toFixed(2))}`
										)}
									</p>
								</button>

								<div className="mt-4" aria-busy={coverEstimatePending}>
									<div
										className="flex h-2 overflow-hidden rounded-full"
										aria-label={`${pointsBarPct.toFixed(2)}% Points, ${cashBarPct.toFixed(2)}% cash`}
									>
										<div
											className="h-full"
											style={{
												width: `${pointsBarPct}%`,
												backgroundColor: merchantBrandPointsTrack,
											}}
										/>
										<div
											className="h-full"
											style={{
												width: `${cashBarPct}%`,
												backgroundColor: merchantBrandActionColor,
											}}
										/>
									</div>
									<div
										className="mt-2 flex items-center justify-between gap-3 text-[12px] dark:text-slate-400"
										style={{ color: merchantBrandMutedColor }}
									>
										<p>
											Points:{' '}
											{coverEstimatePending
												? '…'
												: formatPrefixedFiat(prefix, coveredFiat.toFixed(2))}
										</p>
										<p>
											Amount Due:{' '}
											{coverEstimatePending
												? '…'
												: formatPrefixedFiat(prefix, cashFiat.toFixed(2))}
										</p>
									</div>
								</div>
								{dualSmartPay && cashUsdc6 > 0n && eoaUsdc6 !== null ? (
									<p
										className="mt-2 text-[12px]"
										style={{ color: merchantBrandMutedColor }}
									>
										USDC ${formatUsdc(eoaUsdc6 + (baseUsdc6 ?? 0n))} · need $
										{formatUsdc(cashUsdc6)}
									</p>
								) : null}
							</div>

							<div
								className="mt-4 rounded-[22px] border bg-white p-4 shadow-[0_4px_24px_rgba(15,23,42,0.06)] dark:bg-slate-900"
								style={{ borderColor: merchantBrandBorder }}
							>
								<div className="flex items-center justify-between gap-3">
									<div>
										<p
											className="text-[11px] font-semibold uppercase tracking-[0.12em]"
											style={{ color: merchantBrandMutedColor }}
										>
											Pending balance
										</p>
										<p
											className="mt-1 text-[18px] font-bold"
											style={{ color: merchantBrandActionColor }}
										>
											Amount Due: {formatPrefixedFiat(prefix, Number(fiatHuman).toFixed(2))}
										</p>
									</div>
									<Wallet
										className="h-5 w-5 shrink-0"
										style={{ color: merchantBrandActionColor }}
										aria-hidden
									/>
								</div>
								<p
									className="mt-2 text-[13px]"
									style={{ color: merchantBrandMutedColor }}
								>
									Choose a payment method.
								</p>

								<div className="mt-3 space-y-2.5" role="radiogroup" aria-label="Payment method">
									{stripeReady ? (
										<button
											type="button"
											role="radio"
											aria-checked={paymentMethod === 'card'}
											disabled={stripeBusy || payBusy || !amountFiat6}
											onClick={() => setPaymentMethod('card')}
											className="flex w-full items-center gap-3 rounded-[18px] border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45"
											style={{
												borderColor:
													paymentMethod === 'card' ? merchantBrandActionColor : merchantBrandBorder,
												backgroundColor:
													paymentMethod === 'card' ? merchantBrandSoftTint : 'transparent',
											}}
										>
											<span
												className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
												style={{
													backgroundColor:
														paymentMethod === 'card' ? merchantBrandActionColor : merchantBrandTint,
													color:
														paymentMethod === 'card'
															? merchantBrandTextColor
															: merchantBrandActionColor,
												}}
											>
												{stripeBusy ? (
													<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
												) : (
													<CreditCard className="h-5 w-5" aria-hidden />
												)}
											</span>
											<span className="min-w-0 flex-1">
												<span
													className="block text-[15px] font-semibold"
													style={{ color: merchantBrandActionColor }}
												>
													Credit / Debit Card
												</span>
												<span
													className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px]"
													style={{ color: merchantBrandMutedColor }}
												>
													<span
														className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
														style={{
															backgroundColor: merchantBrandTint,
															color: merchantBrandActionColor,
														}}
													>
														Secure Gateway <ExternalLink className="h-3 w-3" aria-hidden />
													</span>
													<span>Instant payment via secure gateway · Zero data stored</span>
												</span>
											</span>
											<span
												className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
												style={{
													borderColor: merchantBrandActionColor,
													backgroundColor:
														paymentMethod === 'card' ? merchantBrandActionColor : 'transparent',
												}}
												aria-hidden
											>
												{paymentMethod === 'card' ? (
													<span className="h-2 w-2 rounded-full bg-white" />
												) : null}
											</span>
										</button>
									) : null}

									<button
										type="button"
										role="radio"
										aria-checked={paymentMethod === 'usdc'}
										disabled={payBusy || !amountFiat6}
										onClick={() => setPaymentMethod('usdc')}
										className="flex w-full items-center gap-3 rounded-[18px] border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45"
										style={{
											borderColor:
												paymentMethod === 'usdc' ? merchantBrandActionColor : merchantBrandBorder,
											backgroundColor:
												paymentMethod === 'usdc' ? merchantBrandSoftTint : 'transparent',
										}}
									>
										<span
											className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
											style={{
												backgroundColor:
													paymentMethod === 'usdc' ? merchantBrandActionColor : merchantBrandTint,
												color:
													paymentMethod === 'usdc'
														? merchantBrandTextColor
														: merchantBrandActionColor,
											}}
										>
											<Wallet className="h-5 w-5" aria-hidden />
										</span>
										<span className="min-w-0 flex-1">
											<span
												className="block text-[15px] font-semibold"
												style={{ color: merchantBrandActionColor }}
											>
												USDC Balance
											</span>
											<span
												className="mt-0.5 block text-[12px]"
												style={{ color: merchantBrandMutedColor }}
											>
												Pay directly from your digital wallet · Direct merchant transfer
											</span>
										</span>
										<span
											className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
											style={{
												borderColor:
													paymentMethod === 'usdc'
														? merchantBrandActionColor
														: merchantBrandMutedColor,
												backgroundColor:
													paymentMethod === 'usdc' ? merchantBrandActionColor : 'transparent',
											}}
											aria-hidden
										>
											{paymentMethod === 'usdc' ? (
												<span className="h-2 w-2 rounded-full bg-white" />
											) : null}
										</span>
									</button>
								</div>
							</div>
							{stripePaymentMessage ? (
								<div
									role="status"
									className="mt-3 flex items-start gap-2 rounded-2xl border px-3.5 py-3 text-[13px]"
									style={{
										borderColor: merchantBrandBorder,
										backgroundColor: merchantBrandTint,
										color: merchantBrandActionColor,
									}}
								>
									{stripeBusy ? (
										<Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
									) : null}
									<p>{stripePaymentMessage}</p>
								</div>
							) : null}

							<div
								className="mt-4 rounded-[22px] border bg-white p-4 shadow-[0_4px_24px_rgba(15,23,42,0.06)] dark:bg-slate-900"
								style={{ borderColor: merchantBrandBorder }}
							>
								<div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-700">
									<span
										className="text-[11px] font-semibold uppercase tracking-[0.12em]"
										style={{ color: merchantBrandMutedColor }}
									>
										Order Breakdown
									</span>
									<span
										className="text-[12px] font-medium"
										style={{ color: merchantBrandMutedColor }}
									>
										{usedManual ? 'Manual points' : smartPay ? 'Smart Pay' : 'USDC only'}
									</span>
								</div>
								<div className="space-y-2 pt-3 text-[14px]">
									<div className="flex items-center justify-between gap-3">
										<span style={{ color: merchantBrandMutedColor }}>Order Total</span>
										<span
											className="font-medium dark:text-slate-100"
											style={{ color: merchantBrandActionColor }}
										>
											{formatPrefixedFiat(prefix, Number(fiatHuman).toFixed(2))}
										</span>
									</div>
									{smartPay && coveredFiat > 0 ? (
										<div
											className="flex items-center justify-between gap-3"
											style={{ color: merchantBrandSavedColor }}
										>
											<span className="flex items-center gap-1.5">
												<Tag className="h-4 w-4" aria-hidden />
												Points Covered
											</span>
											<span className="font-semibold">
												− {formatPrefixedFiat(prefix, coveredFiat.toFixed(2))}
											</span>
										</div>
									) : null}
									<div
										className="flex items-center justify-between gap-3 border-t pt-3 font-bold"
										style={{ borderColor: merchantBrandBorder }}
									>
										<div>
											<p
												className="dark:text-slate-100"
												style={{ color: merchantBrandActionColor }}
											>
												Cash Required
											</p>
											<p
												className="mt-0.5 text-[11px] font-normal dark:text-slate-400"
												style={{ color: merchantBrandMutedColor }}
											>
												Final amount to pay
											</p>
										</div>
										<span
											className="text-[20px]"
											style={{ color: merchantBrandActionColor }}
										>
											{cashRequiredLabel}
										</span>
									</div>
								</div>
							</div>

							{payPanelAlert ? (
								<div
									role="alert"
									className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800"
								>
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
									<p>{payPanelAlert}</p>
								</div>
							) : usedManual ? (
								<div
									className="mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px]"
									style={{
										borderColor: merchantBrandBorder,
										backgroundColor: merchantBrandTint,
										color: merchantBrandActionColor,
									}}
								>
									<Info
										className="mt-0.5 h-4 w-4 shrink-0"
										style={{ color: merchantBrandActionColor }}
										aria-hidden
									/>
									<p>This final amount reflects your selected points.</p>
								</div>
							) : null}

							<button
								type="button"
								disabled={paymentSubmitDisabled}
								aria-busy={payBusy || stripeBusy}
								aria-label={
									payBusy || stripeBusy
										? payBusyLabel
										: paymentMethod === 'card'
											? 'Pay with card'
											: confirmPayLabel
								}
								onClick={() =>
									void (paymentMethod === 'card' ? payWithStripe() : redeemLegsThenBuy())
								}
								className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[17px] font-bold shadow-[0_10px_20px_rgba(15,23,42,0.16)] disabled:cursor-not-allowed disabled:opacity-40"
								style={{
									backgroundColor: merchantBrandActionColor,
									color: merchantBrandTextColor,
								}}
							>
								{payBusy || stripeBusy ? (
									<>
										<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
										{stripeBusy ? 'Opening secure payment…' : payBusyLabel}
									</>
								) : (
									<>
										<Lock className="h-4 w-4" aria-hidden />
										{paymentMethod === 'card' ? 'Pay with card' : confirmPayLabel}
									</>
								)}
							</button>
						</div>
					)}

					{step === 'select' && (
						<>
							<p
								className="mb-3 text-sm"
								style={{ color: merchantBrandMutedColor }}
							>
								Reward PT from this store converts to store credit (#0). Points from other stores can
								cover cash only if that program can pay USDC.
							</p>
							<div className="space-y-2">
								{usableRows.map((row) => {
									const key = row.cardAddress.toLowerCase()
									const on = selected.has(key)
									return (
										<label
											key={row.cardAddress}
											className="flex items-center gap-3 rounded-2xl border p-3"
											style={{
												borderColor: merchantBrandBorder,
												backgroundColor: on ? merchantBrandSoftTint : '#ffffff',
											}}
										>
											<input
												type="checkbox"
												checked={on}
												onChange={() => toggleSelect(row.cardAddress)}
												className="h-4 w-4"
												style={{ accentColor: merchantBrandActionColor }}
											/>
											{row.icon ? (
												<IpfsImg src={row.icon} alt="" className="h-10 w-10 rounded-full object-cover" />
											) : (
												<div
													className="h-10 w-10 rounded-full"
													style={{ backgroundColor: merchantBrandTint }}
												/>
											)}
											<div className="min-w-0 flex-1">
												<p
													className="truncate font-semibold"
													style={{ color: merchantBrandActionColor }}
												>
													{row.name}
												</p>
												<p
													className="text-xs"
													style={{ color: merchantBrandMutedColor }}
												>
													{row.coverKind === 'toProgramPoints'
														? row.redeemablePoints6 < row.pointsBalance6
															? `${formatPtsHuman(row.redeemablePoints6)} of ${formatPtsHuman(row.pointsBalance6)} PT usable · store credit`
															: `${formatPtsHuman(row.redeemablePoints6)} PT · converts to this store's credit`
														: `${formatPtsHuman(row.redeemablePoints6)} of ${formatPtsHuman(row.pointsBalance6)} PT · up to $${formatUsdc(row.redeemableUsdc6)}`}
												</p>
											</div>
										</label>
									)
								})}
								{usableRows.length === 0 && (
									<p
										className="text-sm"
										style={{ color: merchantBrandMutedColor }}
									>
										No Reward PT is available to cover this top-up yet.
									</p>
								)}
							</div>
						</>
					)}

					{step === 'confirm' && (
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="pt-2 text-center">
								<p
									className="text-[11px] font-semibold uppercase tracking-[0.16em]"
									style={{ color: merchantBrandMutedColor }}
								>
									Amount due
								</p>
								<p
									className="mt-2 flex items-center justify-center gap-2 text-[34px] font-bold tracking-tight dark:text-slate-100"
									style={{ color: merchantBrandActionColor }}
								>
									{cashUsdc6 > 0n || coveredFiat <= 0 ? (
										<CashUsdcMark size={28} />
									) : null}
									{amountDueLabel}
								</p>
							</div>

							<div
								className="mt-8 rounded-[22px] border bg-white p-4 shadow-[0_4px_24px_rgba(15,23,42,0.06)] dark:bg-slate-900"
								style={{ borderColor: merchantBrandBorder }}
							>
								<p
									className="text-[11px] font-semibold uppercase tracking-[0.12em]"
									style={{ color: merchantBrandMutedColor }}
								>
									Transaction Summary
								</p>
								<div className="mt-4 flex items-center justify-between gap-3 text-[15px]">
									<span style={{ color: merchantBrandMutedColor }}>Top-Up Value</span>
									<span
										className="font-semibold dark:text-slate-100"
										style={{ color: merchantBrandActionColor }}
									>
										{formatPrefixedFiat(prefix, Number(fiatHuman).toFixed(2))}
									</span>
								</div>
								{smartPay && confirmCoverLines.length > 0
									? confirmCoverLines.map((line) => (
											<div
												key={line.key}
												className="mt-3 flex items-start justify-between gap-3"
											>
												<div className="flex min-w-0 items-start gap-2">
													<Tag
														className="mt-0.5 h-4 w-4 shrink-0"
														style={{ color: merchantBrandSavedColor }}
														aria-hidden
													/>
													<div className="min-w-0">
														<p
															className="truncate text-[15px] font-medium dark:text-slate-100"
															style={{ color: merchantBrandActionColor }}
														>
															{line.title}
														</p>
														{usedManual ? (
															<p
																className="text-[12px]"
																style={{ color: merchantBrandMutedColor }}
															>
																(Manual)
															</p>
														) : null}
													</div>
												</div>
												<span
													className="shrink-0 font-semibold"
													style={{ color: merchantBrandSavedColor }}
												>
													− {formatPrefixedFiat(prefix, line.fiat.toFixed(2))}
												</span>
											</div>
										))
									: null}
								<div
									className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-[15px] font-bold dark:text-slate-100"
									style={{
										borderColor: merchantBrandBorder,
										color: merchantBrandActionColor,
									}}
								>
									<span>USDC Required</span>
									<span className="inline-flex items-center gap-1.5">
										<CashUsdcMark size={16} />
										{formatUsdcDue(cashUsdc6)}
									</span>
								</div>
							</div>

							{payPanelAlert ? (
								<div
									role="alert"
									className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800"
								>
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
									<p>{payPanelAlert}</p>
								</div>
							) : usedManual ? (
								<div
									className="mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px]"
									style={{
										borderColor: merchantBrandBorder,
										backgroundColor: merchantBrandTint,
										color: merchantBrandActionColor,
									}}
								>
									<Info
										className="mt-0.5 h-4 w-4 shrink-0"
										style={{ color: merchantBrandActionColor }}
										aria-hidden
									/>
									<p>
										This final amount reflects your specific choices made in the manual points
										selection flow.
									</p>
								</div>
							) : null}

							<button
								type="button"
								disabled={confirmDisabled}
								aria-busy={payBusy}
								aria-label={payBusy ? payBusyLabel : confirmPayLabel}
								onClick={() => void redeemLegsThenBuy()}
								className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[17px] font-bold disabled:opacity-40"
								style={{
									backgroundColor: merchantBrandActionColor,
									color: merchantBrandTextColor,
								}}
							>
								{payBusy ? (
									<>
										<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
										{payBusyLabel}
									</>
								) : (
									<>
										<Lock className="h-4 w-4" aria-hidden />
										{confirmPayLabel}
									</>
								)}
							</button>
						</div>
					)}

					{step === 'stripeWaiting' && (
						<div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
							{stripePaymentOutcome === 'failed' ? (
								<AlertTriangle className="h-14 w-14 text-amber-500" aria-hidden />
							) : (
								<Loader2
									className="h-14 w-14 animate-spin"
									style={{ color: merchantBrandActionColor }}
									aria-hidden
								/>
							)}
							<h1
								className="mt-7 text-[1.75rem] font-bold tracking-tight dark:text-slate-100"
								style={{ color: merchantBrandActionColor }}
							>
								{stripePaymentOutcome === 'failed'
									? 'Payment needs attention'
									: stripePaymentOutcome === 'cancelled'
										? 'Payment cancelled'
										: 'Waiting for Stripe payment'}
							</h1>
							<p
								className="mt-3 max-w-sm text-[15px] leading-relaxed dark:text-slate-400"
								style={{ color: merchantBrandMutedColor }}
							>
								{stripePaymentMessage ||
									'Complete payment in the Stripe window. We are checking the payment and card credit status automatically.'}
							</p>
							{stripePaymentOutcome === 'failed' ? (
								<div
									role="alert"
									className="mt-6 w-full max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800"
								>
									{payError || 'The Stripe payment was not completed.'}
								</div>
							) : null}
							<button
								type="button"
								disabled={stripeBusy}
								onClick={close}
								className="mt-auto w-full max-w-sm rounded-2xl py-4 text-[17px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
								style={{
									backgroundColor: merchantBrandIdleSurface,
									color: merchantBrandActionColor,
								}}
							>
								{stripeBusy ? 'Checking payment…' : 'Done'}
							</button>
						</div>
					)}

					{step === 'success' && (
						<div className="flex flex-1 flex-col items-center px-1 pt-10 text-center">
							<div className="relative flex h-28 w-28 items-center justify-center">
								<div
									className="absolute inset-0 rounded-full blur-md"
									style={{ backgroundColor: merchantBrandTint }}
									aria-hidden
								/>
								<div
									className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full"
									style={{
										backgroundColor: merchantBrandActionColor,
										boxShadow: `0 0 0 14px ${merchantBrandTint}`,
										color: merchantBrandTextColor,
									}}
								>
									<Check className="h-10 w-10" strokeWidth={2.75} aria-hidden />
								</div>
							</div>
							<h1
								className="mt-7 text-[1.75rem] font-bold tracking-tight dark:text-slate-100"
								style={{ color: merchantBrandActionColor }}
							>
								Top-Up Successful!
							</h1>
							<p
								className="mt-2 text-base font-semibold"
								style={{ color: merchantBrandSavedColor }}
							>
								+{formatPrefixedFiat(prefix, mintedLabel)} Store Credits Minted
							</p>
							{successNote ? (
								<p
									className="mt-2 max-w-sm text-sm"
									style={{ color: merchantBrandMutedColor }}
								>
									{successNote}
								</p>
							) : null}

							<div className="mt-10 w-full max-w-sm rounded-[28px] bg-white px-5 py-7 text-center shadow-[0_12px_40px_rgba(15,23,42,0.08)] dark:bg-slate-900 dark:shadow-none">
								<div
									className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
									style={{
										backgroundColor: merchantBrandTint,
										color: merchantBrandActionColor,
									}}
								>
									<Share2 className="h-5 w-5" strokeWidth={2.25} aria-hidden />
								</div>
								<h2
									className="mt-4 text-lg font-bold dark:text-slate-100"
									style={{ color: merchantBrandActionColor }}
								>
									Share &amp; Earn Points
								</h2>
								<p
									className="mt-2 text-[14px] leading-relaxed dark:text-slate-400"
									style={{ color: merchantBrandMutedColor }}
								>
									Share this with friends to earn bonus points for both of you!
								</p>
								{shareAlert ? (
									<p
										role="alert"
										className={`mt-3 text-[13px] ${shareCopied ? '' : 'text-amber-700'}`}
										style={shareCopied ? { color: merchantBrandSavedColor } : undefined}
									>
										{shareAlert}
									</p>
								) : null}
								<button
									type="button"
									disabled={sharing || !shareUrl}
									aria-busy={sharing}
									aria-label="Share & Earn"
									onClick={() => void handleShareEarn()}
									className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[17px] font-bold disabled:opacity-40"
									style={{
										backgroundColor: merchantBrandActionColor,
										color: merchantBrandTextColor,
									}}
								>
									{sharing ? (
										<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
									) : shareCopied ? (
										<Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
									) : (
										<Share className="h-5 w-5" strokeWidth={2.25} aria-hidden />
									)}
									Share &amp; Earn
								</button>
								<button
									type="button"
									disabled={sharing}
									onClick={close}
									className="mt-3 w-full rounded-2xl bg-slate-100 py-4 text-[17px] font-semibold disabled:opacity-40 dark:bg-slate-800"
									style={{ color: merchantBrandActionColor }}
								>
									Done
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
