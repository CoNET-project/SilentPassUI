import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { tu } from '@/locale/beamioLocale'
import {
	ActiveCouponTicketItem,
	buildFallbackActiveCouponListItemForRedeem,
	resolveActiveCouponListItemByRedeemCode,
	type ActiveCouponListItem,
} from '@/pages/Home/ActiveCouponsScreen'

type Props = {
	cardAddress: string
	redeemCode: string
	submitting?: boolean
	onResolved?: (row: ActiveCouponListItem | null) => void
	getPrivateKeyArmor?: () => string | undefined
	onWalletUnlock?: () => void
}

/** Redeem Code panel ticket — same renderer as Home / My Brands (`ActiveCouponTicketItem`). */
export default function RedeemClaimTicketPreview({
	cardAddress,
	redeemCode,
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
		void resolveActiveCouponListItemByRedeemCode(cardAddress, redeemCode).then((resolved) => {
			if (cancelled) return
			if (resolved === undefined) return
			const display = resolved ?? buildFallbackActiveCouponListItemForRedeem(cardAddress, redeemCode)
			setRow(display)
			onResolvedRef.current?.(resolved)
		})
		return () => {
			cancelled = true
		}
	}, [cardAddress, redeemCode])

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
			actionLabel={tu('redeem')}
			disabled
			actionStatus={submitting ? 'loading' : 'idle'}
			aria-label={`Redeem coupon ${row.title}`}
			punchBgClassName="bg-[#f3f4f5] dark:bg-slate-800"
			metadataBelowBackgroundImage
			showActionButton={false}
			showUserLike={Boolean(row.tokenId?.trim())}
			getPrivateKeyArmor={getPrivateKeyArmor}
			onWalletUnlock={onWalletUnlock}
		/>
	)
}
