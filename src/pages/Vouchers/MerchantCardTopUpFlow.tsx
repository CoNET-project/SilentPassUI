import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Info, Loader2, Lock, Share, Share2, SlidersHorizontal, Sparkles, Tag } from 'lucide-react'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import { ethers } from 'ethers'
import {
	BeamioCircularBackButton,
	BEAMIO_CIRCULAR_BACK_ROW_CLASS,
} from '@/components/BeamioCircularBackButton'
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

const SPINNER_CLASS =
	'[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]'

const QUICK = ['10', '20', '50', '100'] as const

type Step = 'amount' | 'pay' | 'select' | 'confirm' | 'success'

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

function UsdcBaseMark({ size = 16 }: { size?: number }) {
	const badge = Math.max(10, Math.round(size * 0.625))
	return (
		<span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
			<img src={usdcIcon} alt="USDC" className="block h-full w-full rounded-full object-contain" />
			<img
				src={baseIcon}
				alt="Base"
				className="absolute -bottom-0.5 -right-0.5 rounded-full border border-white bg-white object-contain dark:border-slate-900"
				style={{ width: badge, height: badge }}
			/>
		</span>
	)
}

function CashUsdcMark({ needsBase, size = 16 }: { needsBase: boolean; size?: number }) {
	return needsBase ? <UsdcBaseMark size={size} /> : <UsdcMark size={size} />
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

function formatInsufficientBaseUsdcAlert(have6: bigint, need6: bigint): string {
	return `This remainder is paid with USDC on Base. You have $${formatUsdc(have6)} Base USDC; this cash portion needs $${formatUsdc(need6)}. Add Base USDC, or turn off Use Points to pay the full amount after funding.`
}

function formatInsufficientConetUsdcAlert(have6: bigint, need6: bigint): string {
	return `This payment uses CONET-USDC on CoNET, not Base USDC. You have $${formatUsdc(have6)} CONET-USDC; this top-up needs $${formatUsdc(need6)}.`
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
		return `Both payments failed. Points: ${pointsErr} Base USDC: ${cashErr}`
	}
	if (pointsOk && !cashOk) {
		return `Reward PT was applied. Base USDC payment failed: ${cashErr}`
	}
	if (!pointsOk && cashOk) {
		return `Base USDC payment succeeded. Points top-up failed: ${pointsErr}`
	}
	return 'Top-up failed'
}

function friendlyTopupContainerError(raw: string): string {
	const m = raw.match(/Insufficient CONET-USDC \(have=(\d+), need=(\d+)\)/)
	if (m) return formatInsufficientConetUsdcAlert(BigInt(m[1]), BigInt(m[2]))
	return raw
}

function isInsufficientConetUsdcError(raw: string): boolean {
	return /Insufficient CONET-USDC/i.test(raw) || /CONET-USDC on CoNET/i.test(raw)
}

function formatUnfundableDualCashAlert(conetHave6: bigint, baseHave6: bigint, need6: bigint): string {
	return `You have $${formatUsdc(conetHave6)} CONET-USDC and $${formatUsdc(baseHave6)} Base USDC; the remaining cash needs $${formatUsdc(need6)}. Add CONET-USDC for one CoNET payment, or add Base USDC to pay the remainder after points.`
}

export default function MerchantCardTopUpFlow({
	open,
	onClose,
	cardAddress,
	storeCreditsPoints,
	cardCurrency,
	profile,
	initialAmount,
	seedAssets,
	seedPoints13,
	onSuccess,
}: Props) {
	const { setShowFooter, myBrandCardDetails } = useDaemonContext()
	const { resolveName, resolveImage, registerCardAddresses } = useMerchantCardDatabase()
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
	const [quotedUsdc6, setQuotedUsdc6] = useState(0n)
	const [quotedForFiat, setQuotedForFiat] = useState('')
	const [eoaUsdc6, setEoaUsdc6] = useState<bigint | null>(null)
	const [baseUsdc6, setBaseUsdc6] = useState<bigint | null>(null)
	const [merchantName, setMerchantName] = useState('Store')
	const [merchantIcon, setMerchantIcon] = useState<string | undefined>()
	const [payBusy, setPayBusy] = useState(false)
	const [payError, setPayError] = useState('')
	const [mintedLabel, setMintedLabel] = useState('0.00')
	const [successNote, setSuccessNote] = useState('')
	const [usedManual, setUsedManual] = useState(false)
	const [legs, setLegs] = useState<CoverLeg[]>([])
	const [sharing, setSharing] = useState(false)
	const [shareCopied, setShareCopied] = useState(false)
	const [shareAlert, setShareAlert] = useState('')
	const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const shareResetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const legsPlanGen = useRef(0)
	const rowsReadyRef = useRef(false)
	const shareUrl = useMemo(
		() => buildDiscoverMerchantShareUrl(cardAddress, profile.keyID),
		[cardAddress, profile.keyID],
	)

	const prefix = displayFiatPrefixFromCode(cardCurrency, 'USD')
	const fiatHuman = amountInput.replace(/,/g, '').trim() || '0'
	const profileAa =
		profile.aaAccount && ethers.isAddress(profile.aaAccount)
			? ethers.getAddress(profile.aaAccount)
			: ''
	/** Chain-resolved Consumer AA that holds #13 (may differ from profile.aaAccount). */
	const [resolvedAa, setResolvedAa] = useState('')

	const close = useCallback(() => {
		if (isClosing || payBusy) return
		setIsClosing(true)
		closeTimer.current = setTimeout(() => {
			onClose()
		}, 300)
	}, [isClosing, onClose, payBusy])

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
		setShowFooter(false)
		setIsEntered(false)
		setIsClosing(false)
		setStep('amount')
		setAmountInput(initialAmount?.trim() || '50.00')
		setSmartPay(true)
		setUsedManual(false)
		setSelected(new Set())
		setPayError('')
		setPayBusy(false)
		setSuccessNote('')
		setSharing(false)
		setShareCopied(false)
		setShareAlert('')
		const frame = requestAnimationFrame(() => setIsEntered(true))
		return () => {
			cancelAnimationFrame(frame)
			setShowFooter(true)
			if (closeTimer.current) clearTimeout(closeTimer.current)
			if (shareResetTimer.current) clearTimeout(shareResetTimer.current)
		}
	}, [open, initialAmount, setShowFooter])

	useEffect(() => {
		if (!open || !cardAddress) return
		registerCardAddresses([cardAddress])
		void getCardMetadataFromApi(cardAddress)
			.then((meta) => {
				if (meta?.name && !isGenericMerchantCardDisplayName(meta.name)) {
					setMerchantName(meta.name)
				}
				setMerchantIcon(pickNonFactoryMerchantAssetUrl(meta?.icon, meta?.image))
			})
			.catch(() => undefined)
	}, [open, cardAddress, registerCardAddresses])

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
			// Preview seed has redeemable=0 until escrow sizing; do not settle cover yet.
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
	const cashUsdc6 = quotedUsdc6 > coveredUsdc6 ? quotedUsdc6 - coveredUsdc6 : 0n
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
		? cashNeedsBaseUsdc
			? 'Paying with Points and Base USDC…'
			: 'Paying with Points and CONET-USDC…'
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
	const canOpenConfirm =
		!payBusy && quoteReady && pointsPlanReady && Number.isFinite(fiatN) && fiatN > 0
	// Usable PT = escrow + liquidity capped redeemable (not full wallet #13 balance).
	const availablePts6 = usableRows.reduce((sum, row) => sum + row.redeemablePoints6, 0n)
	const merchantCount = usableRows.length

	const goPay = () => {
		if (Number(fiatHuman) <= 0) return
		setStep('pay')
	}

	const goConfirm = () => {
		if (!canOpenConfirm) return
		setPayError('')
		setStep('confirm')
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
										'Smart Wallet (AA) is required for Base USDC top-up. Open Wallet and finish setup, then retry.',
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
									error: formatInsufficientBaseUsdcAlert(baseBal, settleQuotedUsdc6),
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
								return { ok: false, error: localPay.error || 'Base USDC top-up failed' }
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
						throw new Error(`Base USDC payment failed: ${cashRes.error}`)
					}
				}
				try {
					const refreshed = await getMyAssets(profile, cardAddress, { bypassCache: true })
					assets = refreshed ?? undefined
				} catch {
					/* payments already succeeded — untrusted asset refresh must not hide success */
				}
				setSuccessNote(
					oneShotDone
						? 'Points and CONET-USDC completed in one CoNET payment.'
						: 'Points and Base USDC both completed.',
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
				const refreshed = await getMyAssets(profile, cardAddress, { bypassCache: true })
				assets = refreshed ?? undefined
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
							'Smart Wallet (AA) is required for Base USDC top-up. Open Wallet and finish setup, then retry.',
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
						const refreshed = await getMyAssets(profile, cardAddress, { bypassCache: true })
						assets = refreshed ?? undefined
						setMintedLabel(Number(fiatHuman).toFixed(2))
						setStep('success')
						onSuccess?.(assets)
						return
					}
					if (!localPay.insufficientBalance) {
						throw new Error(localPay.error || 'Base USDC top-up failed')
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
								'Store credit purchase failed. Check CoNET-USDC balance and try again.',
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

			setMintedLabel(Number(fiatHuman).toFixed(2))
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
			? cashNeedsBaseUsdc
				? `Pay ${formatUsdcDue(cashUsdc6)} Base USDC`
				: `Pay ${formatUsdcDue(cashUsdc6)} CONET-USDC`
			: coveredFiat > 0
				? 'Apply Points'
				: `Pay ${formatUsdcDue(quotedUsdc6)} USDC`

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
						: 'Top-Up Successful'

	return (
		<div
			className={`fixed inset-0 z-[130] dark:bg-slate-950 ${
				step === 'success'
					? 'bg-[radial-gradient(120%_90%_at_50%_8%,#d9f5e4_0%,#f3eef8_38%,#eef4fb_68%,#F9F9FB_100%)]'
					: 'bg-[#F9F9FB]'
			}`}
			style={{
				transform: isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)',
				transition: 'transform 300ms ease-out',
			}}
		>
			<div
				className="flex h-full flex-col overflow-y-auto"
				style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
			>
				{step !== 'success' ? (
					<div className={`${BEAMIO_CIRCULAR_BACK_ROW_CLASS} px-4`}>
						<BeamioCircularBackButton variant="onLight" onClick={back} className="absolute left-4 top-0" />
					</div>
				) : null}
				{step === 'confirm' ? (
					<header className="px-5 pb-6 pt-2">
						<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Review</p>
						<h1 className="mt-1 text-3xl font-semibold text-[#0F172A] dark:text-slate-100">{title}</h1>
					</header>
				) : step === 'select' ? (
					<header className="px-5 pb-6 pt-2">
						<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Store credits</p>
						<h1 className="mt-1 text-3xl font-semibold text-[#0F172A] dark:text-slate-100">{title}</h1>
					</header>
				) : null}

				<div className="flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
					{step === 'amount' && (
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="flex flex-1 flex-col items-center pt-8">
								{displayMerchantIcon ? (
									<IpfsImg
										src={displayMerchantIcon}
										alt=""
										className="h-20 w-20 rounded-full object-cover"
									/>
								) : (
									<div
										className="flex h-20 w-20 items-center justify-center rounded-full bg-[#eceef2] text-2xl font-bold text-slate-500"
										aria-hidden
									>
										{(displayMerchantName || 'M').trim().slice(0, 1).toUpperCase()}
									</div>
								)}
								<p className="mt-4 text-[22px] font-bold leading-tight text-[#111827] dark:text-slate-100">
									{displayMerchantName}
								</p>
								<p className="mt-1.5 text-[15px] font-medium text-[#8b919c]">
									Store Credits: {storeCreditsLabel}
								</p>
								<label htmlFor="merchant-topup-amount" className="sr-only">
									Amount
								</label>
								<div className="mt-12 inline-flex items-baseline justify-center border-b-2 border-[#9ec0ff] pb-1.5">
									<span className="shrink-0 text-[34px] font-bold text-[#9aa3b2]">{prefix}</span>
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
										onKeyDown={preventStepKeys}
										onWheel={(e) => {
											e.preventDefault()
											e.stopPropagation()
										}}
										className={`ml-1.5 bg-transparent p-0 text-[40px] font-bold leading-none tracking-tight text-[#111827] outline-none dark:text-slate-100 ${SPINNER_CLASS}`}
										style={{ width: `${heroDigitsWidth}ch` }}
									/>
								</div>
								<div className="mt-12 w-full max-w-md">
									<p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9aa3b2]">
										Quick amount
									</p>
									<div className="mt-3 grid grid-cols-2 gap-3">
										{QUICK.map((q) => {
											const selected = amountMatchesQuick(q)
											return (
												<button
													key={q}
													type="button"
													onClick={() => setAmountInput(Number(q).toFixed(2))}
													className={`rounded-2xl py-3.5 text-[16px] font-semibold transition ${
														selected
															? 'border border-[#3B66F5] bg-[#e8eeff] text-[#3B66F5]'
															: 'border border-transparent bg-[#f0f1f3] text-[#111827]'
													}`}
												>
													${q}
												</button>
											)
										})}
									</div>
								</div>
							</div>
							<button
								type="button"
								disabled={Number(fiatHuman) <= 0}
								onClick={goPay}
								className="mt-auto w-full rounded-2xl bg-[#3B66F5] py-4 text-[17px] font-bold text-white disabled:opacity-40"
							>
								Next
							</button>
						</div>
					)}

					{step === 'pay' && (
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="flex flex-col items-center pt-2">
								{displayMerchantIcon ? (
									<IpfsImg
										src={displayMerchantIcon}
										alt=""
										className="h-16 w-16 rounded-full object-cover"
									/>
								) : (
									<div
										className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eceef2] text-[20px] font-bold text-[#3B66F5]"
										aria-hidden
									>
										{merchantInitials(displayMerchantName)}
									</div>
								)}
								<p className="mt-3 text-[17px] font-semibold text-[#4b5563]">{displayMerchantName}</p>
								<p className="mt-1 text-[34px] font-bold tracking-tight text-[#111827]">
									{formatPrefixedFiat(prefix, formatFiatHero(fiatN))}
								</p>
							</div>

							<p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9aa3b2]">
								Payment Method
							</p>

							<div className="mt-3 overflow-hidden rounded-[22px] bg-gradient-to-b from-[#3B82F6] to-[#1D4ED8] p-4 text-white shadow-[0_12px_28px_rgba(29,78,216,0.28)]">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Sparkles className="h-4 w-4 text-[#86efac]" strokeWidth={2.25} aria-hidden />
										<p className="text-[16px] font-bold">Smart Pay</p>
									</div>
									<span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold">
										<Check className="h-3 w-3" strokeWidth={2.75} aria-hidden />
										Active
									</span>
								</div>

								<div className="mt-4 flex items-center justify-between rounded-2xl border border-white/20 bg-black/15 px-3.5 py-3">
									<div>
										<p className="text-[15px] font-bold">Use Points</p>
										<p className="mt-0.5 text-[12px] text-white/75">
											{smartPay ? 'Toggle off for pure USDC' : 'Toggle on to use Reward PT'}
										</p>
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
										className={`relative h-8 w-14 shrink-0 rounded-full transition ${
											smartPay ? 'bg-[#34C759]' : 'bg-white/30'
										}`}
									>
										<span
											className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
												smartPay ? 'left-7' : 'left-1'
											}`}
										/>
									</button>
								</div>

								<p className="mt-3 text-[13px] leading-relaxed text-white/90">
									{smartPay
										? cashUsdc6 > 0n
											? cashNeedsBaseUsdc
												? 'Points + Base USDC. Use available points, then cover the rest with USDC on Base.'
												: 'Points + CONET-USDC. Use available points and pay the rest in one CoNET payment.'
											: 'Use available points to cover this top-up.'
										: 'Pay the full amount with USDC.'}
								</p>

								<div
									className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-black/20 px-4 py-3"
									aria-busy={coverEstimatePending}
								>
									<div>
										<p className="text-[12px] text-white/70">Points Covered</p>
										<p className="mt-1 text-[18px] font-bold">
											{coverEstimatePending ? (
												<Loader2
													className="h-5 w-5 animate-spin text-white/80"
													aria-hidden
												/>
											) : (
												formatPrefixedFiat(prefix, coveredFiat.toFixed(2))
											)}
										</p>
									</div>
									<div className="border-l border-white/15 pl-3">
										<p className="text-[12px] text-white/70">Cash Required</p>
										<p className="mt-1 text-[18px] font-bold">
											{coverEstimatePending ? (
												<Loader2
													className="h-5 w-5 animate-spin text-white/80"
													aria-hidden
												/>
											) : (
												formatPrefixedFiat(prefix, cashFiat.toFixed(2))
											)}
										</p>
									</div>
								</div>
								{cashNeedsBaseUsdc && baseUsdc6 !== null ? (
									<p className="mt-2 text-[12px] text-white/75">
										CONET-USDC is short. Remaining cash uses USDC on Base after Reward PT.
										{' '}
										Base USDC ${formatUsdc(baseUsdc6)} · need ${formatUsdc(cashUsdc6)}
									</p>
								) : dualSmartPay && eoaUsdc6 !== null ? (
									<p className="mt-2 text-[12px] text-white/75">
										CONET-USDC ${formatUsdc(eoaUsdc6)} · need ${formatUsdc(cashUsdc6)}
									</p>
								) : null}
							</div>

							{smartPay ? (
								<button
									type="button"
									onClick={() => {
										setUsedManual(true)
										// Manual selection starts with every currently usable
										// merchant selected; the user can opt out explicitly.
										setSelected(new Set(usableRows.map((row) => row.cardAddress.toLowerCase())))
										setStep('select')
									}}
									disabled={payBusy || rowsLoading || usableRows.length === 0}
									className="mt-3 flex w-full items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-3.5 py-3.5 text-left disabled:opacity-40"
								>
									<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8eeff] text-[#3B66F5]">
										<SlidersHorizontal className="h-5 w-5" strokeWidth={2.2} aria-hidden />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block text-[15px] font-bold text-[#111827]">
											Choose Points Manually
										</span>
										<span className="mt-0.5 block text-[13px] text-[#8b919c]">
											{rowsLoading
												? 'Loading available points…'
												: `Available: ${formatPtsShort(availablePts6)} Pts (from ${merchantCount} merchant${
														merchantCount === 1 ? '' : 's'
													})`}
										</span>
									</span>
									<ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
								</button>
							) : null}

							<button
								type="button"
								disabled={!canOpenConfirm}
								onClick={goConfirm}
								className="mt-auto w-full rounded-2xl bg-[#3B66F5] py-4 text-[17px] font-bold text-white disabled:opacity-40"
							>
								Confirm Top Up
							</button>
						</div>
					)}

					{step === 'select' && (
						<>
							<p className="mb-3 text-sm text-slate-500">
								Reward PT from this store converts to store credit (#0). Points from other stores can
								cover cash only if that program can pay CONET-USDC.
							</p>
							<div className="space-y-2">
								{usableRows.map((row) => {
									const key = row.cardAddress.toLowerCase()
									const on = selected.has(key)
									return (
										<label
											key={row.cardAddress}
											className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
										>
											<input
												type="checkbox"
												checked={on}
												onChange={() => toggleSelect(row.cardAddress)}
												className="h-4 w-4"
											/>
											{row.icon ? (
												<IpfsImg src={row.icon} alt="" className="h-10 w-10 rounded-full object-cover" />
											) : (
												<div className="h-10 w-10 rounded-full bg-slate-200" />
											)}
											<div className="min-w-0 flex-1">
												<p className="truncate font-semibold">{row.name}</p>
												<p className="text-xs text-slate-500">
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
									<p className="text-sm text-slate-500">
										No Reward PT is available to cover this top-up yet.
									</p>
								)}
							</div>
							<button
								type="button"
								onClick={() => {
									setUsedManual(true)
									setStep('pay')
								}}
								className="mt-6 w-full rounded-full bg-[#0051d1] py-3.5 text-base font-semibold text-white"
							>
								Next
							</button>
						</>
					)}

					{step === 'confirm' && (
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="pt-2 text-center">
								<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9aa3b2]">
									Amount due
								</p>
								<p className="mt-2 flex items-center justify-center gap-2 text-[34px] font-bold tracking-tight text-[#111827] dark:text-slate-100">
									{cashUsdc6 > 0n || coveredFiat <= 0 ? (
										<CashUsdcMark needsBase={cashNeedsBaseUsdc} size={28} />
									) : null}
									{amountDueLabel}
								</p>
							</div>

							<div className="mt-8 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_4px_24px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900">
								<p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9aa3b2]">
									Transaction Summary
								</p>
								<div className="mt-4 flex items-center justify-between gap-3 text-[15px]">
									<span className="text-[#6b7280]">Top-Up Value</span>
									<span className="font-semibold text-[#111827] dark:text-slate-100">
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
														className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
														aria-hidden
													/>
													<div className="min-w-0">
														<p className="truncate text-[15px] font-medium text-[#111827] dark:text-slate-100">
															{line.title}
														</p>
														{usedManual ? (
															<p className="text-[12px] text-[#9aa3b2]">(Manual)</p>
														) : null}
													</div>
												</div>
												<span className="shrink-0 font-semibold text-emerald-600">
													− {formatPrefixedFiat(prefix, line.fiat.toFixed(2))}
												</span>
											</div>
										))
									: null}
								<div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[15px] font-bold text-[#111827] dark:border-slate-700 dark:text-slate-100">
									<span>USDC Required</span>
									<span className="inline-flex items-center gap-1.5">
										<CashUsdcMark needsBase={cashNeedsBaseUsdc} size={16} />
										{formatUsdcDue(cashUsdc6)} {cashNeedsBaseUsdc ? 'Base USDC' : 'CONET-USDC'}
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
								<div className="mt-4 flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-[13px] text-sky-800">
									<Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" aria-hidden />
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
								className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3B66F5] py-4 text-[17px] font-bold text-white disabled:opacity-40"
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

					{step === 'success' && (
						<div className="flex flex-1 flex-col items-center px-1 pt-10 text-center">
							<div className="relative flex h-28 w-28 items-center justify-center">
								<div
									className="absolute inset-0 rounded-full bg-emerald-400/25 blur-md"
									aria-hidden
								/>
								<div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[#22c55e] shadow-[0_0_0_14px_rgba(34,197,94,0.16)]">
									<Check className="h-10 w-10 text-white" strokeWidth={2.75} aria-hidden />
								</div>
							</div>
							<h1 className="mt-7 text-[1.75rem] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
								Top-Up Successful!
							</h1>
							<p className="mt-2 text-base font-semibold text-[#16a34a]">
								+{formatPrefixedFiat(prefix, mintedLabel)} Store Credits Minted
							</p>
							{successNote ? (
								<p className="mt-2 max-w-sm text-sm text-slate-500">{successNote}</p>
							) : null}

							<div className="mt-10 w-full max-w-sm rounded-[28px] bg-white px-5 py-7 text-center shadow-[0_12px_40px_rgba(15,23,42,0.08)] dark:bg-slate-900 dark:shadow-none">
								<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f0ff]">
									<Share2 className="h-5 w-5 text-[#0051d1]" strokeWidth={2.25} aria-hidden />
								</div>
								<h2 className="mt-4 text-lg font-bold text-[#0F172A] dark:text-slate-100">
									Share &amp; Earn Points
								</h2>
								<p className="mt-2 text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
									Share this with friends to earn bonus points for both of you!
								</p>
								{shareAlert ? (
									<p
										role="alert"
										className={`mt-3 text-[13px] ${
											shareCopied ? 'text-emerald-600' : 'text-amber-700'
										}`}
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
									className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3B66F5] py-4 text-[17px] font-bold text-white disabled:opacity-40"
								>
									{sharing ? (
										<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
									) : shareCopied ? (
										<Check className="h-5 w-5 text-emerald-300" strokeWidth={2.5} aria-hidden />
									) : (
										<Share className="h-5 w-5" strokeWidth={2.25} aria-hidden />
									)}
									Share &amp; Earn
								</button>
								<button
									type="button"
									disabled={sharing}
									onClick={close}
									className="mt-3 w-full rounded-2xl bg-[#eef1f6] py-4 text-[17px] font-semibold text-[#3B66F5] disabled:opacity-40 dark:bg-slate-800 dark:text-[#8eb0ff]"
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
