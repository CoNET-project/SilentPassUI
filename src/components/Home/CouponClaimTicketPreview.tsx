import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
	ActiveCouponTicketItem,
	buildFallbackActiveCouponListItem,
	resolveActiveCouponListItemByCouponId,
	type ActiveCouponListItem,
} from '@/pages/Home/ActiveCouponsScreen'

type Props = {
	cardAddress: string
	couponId: string
	submitting?: boolean
	onResolved?: (row: ActiveCouponListItem | null) => void
	getPrivateKeyArmor?: () => string | undefined
	onWalletUnlock?: () => void
}

/** Coupon Claim panel ticket — same renderer as Home / My Brands (`ActiveCouponTicketItem`). */
export default function CouponClaimTicketPreview({
	cardAddress,
	couponId,
	submitting = false,
	onResolved,
	getPrivateKeyArmor,
	onWalletUnlock,
}: Props) {
	const [row, setRow] = useState<ActiveCouponListItem | undefined>(undefined)
	const onResolvedRef = useRef(onResolved)
	onResolvedRef.current = onResolved

	useEffect(() => {
		let cancelled = false
		setRow(undefined)
		void resolveActiveCouponListItemByCouponId(cardAddress, couponId).then((resolved) => {
			if (cancelled) return
			if (resolved === undefined) return
			const display = resolved ?? buildFallbackActiveCouponListItem(cardAddress, couponId)
			setRow(display)
			onResolvedRef.current?.(resolved)
		})
		return () => {
			cancelled = true
		}
	}, [cardAddress, couponId])

	if (row === undefined) {
		return (
			<div className="flex min-h-[7.5rem] items-center justify-center py-6">
				<Loader2 className="h-8 w-8 animate-spin text-[#1562f0]" strokeWidth={2} aria-hidden />
			</div>
		)
	}

	return (
		<ActiveCouponTicketItem
			row={row}
			actionLabel="Open claim"
			disabled
			actionStatus={submitting ? 'loading' : 'idle'}
			aria-label={`Open claim coupon ${row.title}`}
			punchBgClassName="bg-white dark:bg-slate-900"
			metadataBelowBackgroundImage
			showActionButton={false}
			showUserLike={Boolean(row.tokenId?.trim())}
			getPrivateKeyArmor={getPrivateKeyArmor}
			onWalletUnlock={onWalletUnlock}
		/>
	)
}
