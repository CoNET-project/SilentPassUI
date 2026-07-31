import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { tu } from '@/locale/beamioLocale'
import {
	ActiveCouponTicketItem,
	buildFallbackActiveCouponListItem,
	mapActiveCouponRow,
	type ActiveCouponListItem,
} from '@/pages/Home/ActiveCouponsScreen'
import {
	fetchCardActiveIssuedCouponSeriesTrusted,
	resolveCouponOpenClaimEligibility,
	type CardActiveIssuedCouponSeriesItem,
	type CouponOpenClaimEligibility,
} from '@/services/BeamioCard'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { ethers } from 'ethers'

type Props = {
	cardAddress: string
	couponId: string
	submitting?: boolean
	onResolved?: (row: ActiveCouponListItem | null) => void
	/** Fired when eligibility is known (incl. already claimed / redeemed). */
	onEligibilityChange?: (eligibility: CouponOpenClaimEligibility | null) => void
	/** Ticket-right Gift / bottom Claim — same handler. Only used when claimable. */
	onClaim?: () => void
	/** Deep-link `ref=` for like #13 / share attribution. */
	referrerEoa?: string | null
	/** Current wallet EOA (preferred over deriving from private key). */
	userEoa?: string | null
	getPrivateKeyArmor?: () => string | undefined
	onWalletUnlock?: () => void
}

function formatSeriesSupplySummary(row: {
	issuedNftMaxSupply?: string
	issuedNftRemainingSupply?: string
}): string | null {
	const total = row.issuedNftMaxSupply?.replace(/,/g, '').trim()
	const remaining = row.issuedNftRemainingSupply?.replace(/,/g, '').trim()
	if (total && remaining) return `TOTAL ${total} · LEFT ${remaining}`
	if (total) return `TOTAL ${total} · LEFT --`
	if (remaining) return `LEFT ${remaining}`
	return null
}

function resolveUserEoa(getPrivateKeyArmor?: () => string | undefined): string | null {
	const pk = getPrivateKeyArmor?.()?.trim() ?? ''
	if (!pk) return null
	try {
		return ethers.getAddress(new ethers.Wallet(pk).address)
	} catch {
		return null
	}
}

/** Coupon Claim panel ticket — same renderer as Discover Available Offers (`ActiveCouponTicketItem`). */
export default function CouponClaimTicketPreview({
	cardAddress,
	couponId,
	submitting = false,
	onResolved,
	onEligibilityChange,
	onClaim,
	referrerEoa = null,
	userEoa: userEoaProp = null,
	getPrivateKeyArmor,
	onWalletUnlock,
}: Props) {
	const { getCouponOpenClaimStatus, registerCouponOpenClaimFeedTargets } = useDaemonContext()
	const [row, setRow] = useState<ActiveCouponListItem | undefined>(undefined)
	const [seriesRaw, setSeriesRaw] = useState<CardActiveIssuedCouponSeriesItem | null>(null)
	const [supplySummary, setSupplySummary] = useState<string | null>(null)
	const [eligibility, setEligibility] = useState<CouponOpenClaimEligibility | null>(null)
	const onResolvedRef = useRef(onResolved)
	onResolvedRef.current = onResolved
	const onEligibilityChangeRef = useRef(onEligibilityChange)
	onEligibilityChangeRef.current = onEligibilityChange

	const userEoa = useMemo(() => {
		const fromProp = String(userEoaProp ?? '').trim()
		if (fromProp && ethers.isAddress(fromProp)) {
			try {
				return ethers.getAddress(fromProp)
			} catch {
				/* fall through */
			}
		}
		return resolveUserEoa(getPrivateKeyArmor)
	}, [userEoaProp, getPrivateKeyArmor])

	useEffect(() => {
		let cancelled = false
		setRow(undefined)
		setSeriesRaw(null)
		setSupplySummary(null)
		setEligibility(null)
		onEligibilityChangeRef.current?.(null)

		void (async () => {
			const cardNorm = cardAddress?.trim() ?? ''
			const wanted = couponId?.trim() ?? ''
			if (!cardNorm || !wanted || !ethers.isAddress(cardNorm)) {
				if (cancelled) return
				const fallback = buildFallbackActiveCouponListItem(cardAddress, couponId)
				setRow(fallback)
				onResolvedRef.current?.(null)
				return
			}
			const checksum = ethers.getAddress(cardNorm)
			const rows = await fetchCardActiveIssuedCouponSeriesTrusted(checksum, 50)
			if (cancelled) return
			if (rows === null) return

			let matched: ActiveCouponListItem | null = null
			let matchedRaw: CardActiveIssuedCouponSeriesItem | null = null
			for (const seriesRow of rows) {
				const mapped = mapActiveCouponRow(checksum, seriesRow)
				if (mapped && mapped.couponId === wanted) {
					matched = mapped
					matchedRaw = { ...seriesRow, cardAddress: checksum }
					break
				}
			}

			const display = matched ?? buildFallbackActiveCouponListItem(cardAddress, couponId)
			setRow(display)
			setSeriesRaw(matchedRaw)
			onResolvedRef.current?.(matched)

			if (matchedRaw) {
				setSupplySummary(
					formatSeriesSupplySummary(
						matchedRaw as {
							issuedNftMaxSupply?: string
							issuedNftRemainingSupply?: string
						},
					),
				)
			}
		})()

		return () => {
			cancelled = true
		}
	}, [cardAddress, couponId])

	// Local-first claimed/redeemed from daemon map, then trusted chain eligibility.
	useEffect(() => {
		if (!row?.tokenId?.trim() || !seriesRaw) return
		let cancelled = false

		const local = getCouponOpenClaimStatus(row.cardAddress, row.tokenId)
		if (local?.status === 'claimed') {
			setEligibility('already_claimed')
			onEligibilityChangeRef.current?.('already_claimed')
		} else if (local?.status === 'redeemed') {
			setEligibility('already_redeemed')
			onEligibilityChangeRef.current?.('already_redeemed')
		}

		registerCouponOpenClaimFeedTargets([
			{
				cardAddress: row.cardAddress,
				tokenId: row.tokenId,
				couponId: row.couponId,
			},
		])

		void resolveCouponOpenClaimEligibility(seriesRaw, userEoa).then((next) => {
			if (cancelled) return
			setEligibility(next)
			onEligibilityChangeRef.current?.(next)
		})

		return () => {
			cancelled = true
		}
	}, [
		row?.cardAddress,
		row?.tokenId,
		row?.couponId,
		seriesRaw,
		userEoa,
		getCouponOpenClaimStatus,
		registerCouponOpenClaimFeedTargets,
	])

	if (row === undefined) {
		return (
			<div className="flex min-h-[7.5rem] items-center justify-center py-6">
				<Loader2 className="h-8 w-8 animate-spin text-[#1562f0]" strokeWidth={2} aria-hidden />
			</div>
		)
	}

	const isAlreadyClaimed = eligibility === 'already_claimed'
	const isAlreadyRedeemed = eligibility === 'already_redeemed'
	const isExpired = eligibility === 'expired'
	const isSoldOut = eligibility === 'sold_out'
	const insufficientSocialPoints = eligibility === 'insufficient_social_points'
	const canClaim =
		Boolean(onClaim) &&
		(eligibility == null || eligibility === 'claimable' || eligibility === 'unknown')
	const showActionButton =
		eligibility == null ||
		eligibility === 'claimable' ||
		eligibility === 'unknown' ||
		isAlreadyClaimed ||
		isAlreadyRedeemed ||
		insufficientSocialPoints ||
		isExpired ||
		isSoldOut

	const ticketActionLabel = isAlreadyRedeemed
		? tu('redeemed')
		: isAlreadyClaimed
			? tu('claimed')
			: isExpired
				? tu('expired')
				: isSoldOut
					? 'Sold out'
					: insufficientSocialPoints
						? tu('claim')
						: tu('claim')

	const ticketActionStatus: 'idle' | 'loading' | 'success' | 'error' = submitting
		? 'loading'
		: isAlreadyClaimed || isAlreadyRedeemed
			? 'success'
			: 'idle'

	return (
		<div className="space-y-2">
			<ActiveCouponTicketItem
				row={row}
				actionLabel={ticketActionLabel}
				disabled={submitting || !canClaim}
				actionStatus={ticketActionStatus}
				onAction={canClaim ? onClaim : undefined}
				aria-label={
					isAlreadyRedeemed
						? `Coupon ${row.title} already redeemed`
						: isAlreadyClaimed
							? `Coupon ${row.title} already claimed`
							: `Claim coupon ${row.title}`
				}
				punchBgClassName="bg-white dark:bg-slate-900"
				metadataBelowBackgroundImage
				showActionButton={showActionButton}
				showOpenClaimShareButton
				showUserLike={Boolean(row.tokenId?.trim())}
				supplySummary={supplySummary}
				referrerEoa={referrerEoa}
				getPrivateKeyArmor={getPrivateKeyArmor}
				onWalletUnlock={onWalletUnlock}
			/>
			{insufficientSocialPoints ? (
				<p className="px-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
					Not enough social points for this exchange.
				</p>
			) : null}
			{isAlreadyClaimed ? (
				<p className="px-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
					You already claimed this coupon. It is in your wallet.
				</p>
			) : null}
			{isAlreadyRedeemed ? (
				<p className="px-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
					You already used this coupon.
				</p>
			) : null}
		</div>
	)
}
