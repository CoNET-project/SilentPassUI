import React from 'react'
import { Heart, Loader2 } from 'lucide-react'
import { Popup } from 'antd-mobile'
import { formatDiscoverLikeCount } from '@/utils/discoverMerchantLikeCount'
import { useCouponUserLike, type UseCouponUserLikeOptions } from '@/hooks/useCouponUserLike'

type Props = UseCouponUserLikeOptions & {
	/** Show aggregate like count under banner metadata row. */
	showCountPill?: boolean
}

export function CouponUserLikeHeartButton({
	userLiked,
	likeLoading,
	onHeartClick,
	className = '',
}: {
	userLiked: boolean | null
	likeLoading: boolean
	onHeartClick: (e: React.MouseEvent) => void
	className?: string
}) {
	return (
		<button
			type="button"
			onClick={onHeartClick}
			disabled={likeLoading}
			className={[
				'inline-flex h-9 w-9 items-center justify-center rounded-full shadow-md ring-1 transition active:scale-95 disabled:opacity-70',
				userLiked
					? 'bg-rose-500 text-white ring-rose-600/30'
					: 'bg-black/45 text-white ring-white/20 backdrop-blur-sm',
				className,
			].join(' ')}
			aria-label={userLiked ? 'Remove like' : 'Like this coupon'}
			aria-pressed={Boolean(userLiked)}
		>
			{likeLoading ? (
				<Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
			) : (
				<Heart className="h-4 w-4" strokeWidth={2} fill={userLiked ? 'currentColor' : 'none'} />
			)}
		</button>
	)
}

export function CouponUserLikeCountPill({
	count,
	variant = 'light',
}: {
	count: number | null
	variant?: 'light' | 'onDark'
}) {
	if (count == null) return null
	const style =
		variant === 'onDark'
			? 'bg-white/15 text-white ring-white/25'
			: 'bg-rose-50 text-rose-500 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/50'
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${style}`}
			aria-label={`${formatDiscoverLikeCount(count)} likes`}
		>
			<Heart className="h-3 w-3" strokeWidth={2.25} fill="currentColor" aria-hidden />
			{formatDiscoverLikeCount(count)}
		</span>
	)
}

export function CouponUnlikeSheet({
	visible,
	likeLoading,
	onClose,
	onConfirm,
}: {
	visible: boolean
	likeLoading: boolean
	onClose: () => void
	onConfirm: () => void
}) {
	return (
		<Popup
			visible={visible}
			onMaskClick={onClose}
			position="bottom"
			bodyStyle={{
				borderTopLeftRadius: 20,
				borderTopRightRadius: 20,
				paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
			}}
		>
			<div className="px-5 pb-2 pt-5">
				<h2 className="text-[18px] font-bold text-[#1f2328] dark:text-slate-100">Remove like?</h2>
				<p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
					Your like badge for this coupon will be removed. The public like count may decrease after
					confirmation.
				</p>
				<div className="mt-5 flex flex-col gap-2.5">
					<button
						type="button"
						disabled={likeLoading}
						onClick={onConfirm}
						className="inline-flex w-full items-center justify-center rounded-full bg-rose-500 px-4 py-3 text-[15px] font-bold text-white shadow-md shadow-rose-500/25 transition active:scale-[0.98] disabled:opacity-70"
					>
						{likeLoading ? 'Removing…' : 'Remove Like'}
					</button>
					<button
						type="button"
						disabled={likeLoading}
						onClick={onClose}
						className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-4 py-3 text-[15px] font-semibold text-slate-700 transition active:scale-[0.98] dark:border-slate-600 dark:text-slate-200"
					>
						Cancel
					</button>
				</div>
			</div>
		</Popup>
	)
}

/** Heart overlay + optional count pill + unlike bottom sheet for issued coupon tickets. */
export default function CouponUserLikeChrome({
	showCountPill = true,
	...options
}: Props) {
	const {
		userLiked,
		likeLoading,
		unlikeSheetOpen,
		setUnlikeSheetOpen,
		likeCount,
		onHeartClick,
		submitCouponLike,
	} = useCouponUserLike(options)

	if (!options.enabled) return null

	return (
		<>
			<CouponUserLikeHeartButton
				userLiked={userLiked}
				likeLoading={likeLoading}
				onHeartClick={onHeartClick}
			/>
			{showCountPill && likeCount != null ? (
				<CouponUserLikeCountPill count={likeCount} />
			) : null}
			<CouponUnlikeSheet
				visible={unlikeSheetOpen}
				likeLoading={likeLoading}
				onClose={() => setUnlikeSheetOpen(false)}
				onConfirm={() => void submitCouponLike(false)}
			/>
		</>
	)
}
