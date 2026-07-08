import React from 'react'
import { Heart, Loader2 } from 'lucide-react'
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
	const liked = Boolean(userLiked)
	return (
		<button
			type="button"
			onClick={onHeartClick}
			disabled={likeLoading || liked}
			className={[
				'inline-flex h-9 w-9 items-center justify-center rounded-full shadow-md ring-1 transition active:scale-95 disabled:opacity-70',
				liked
					? 'bg-rose-500 text-white ring-rose-600/30 disabled:cursor-default'
					: 'bg-black/45 text-white ring-white/20 backdrop-blur-sm',
				className,
			].join(' ')}
			aria-label={liked ? 'Liked' : 'Like this coupon'}
			aria-pressed={liked}
		>
			{likeLoading ? (
				<Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
			) : (
				<Heart className="h-4 w-4" strokeWidth={2} fill={liked ? 'currentColor' : 'none'} />
			)}
		</button>
	)
}

export function CouponUserLikeCountPill({
	count,
	variant = 'light',
	onClick,
	disabled = false,
	loading = false,
	liked = false,
}: {
	count: number | null
	variant?: 'light' | 'onDark'
	onClick?: (e: React.MouseEvent) => void
	disabled?: boolean
	loading?: boolean
	liked?: boolean
}) {
	if (count == null && !onClick) return null
	const style =
		variant === 'onDark'
			? 'bg-white/15 text-white ring-white/25'
			: liked
				? 'bg-rose-500 text-white ring-rose-400/40'
				: 'bg-rose-50 text-rose-500 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/50'
	const label =
		count != null
			? `${formatDiscoverLikeCount(count)} likes`
			: loading
				? 'Loading likes'
				: 'Like this coupon'
	const inner = (
		<>
			{loading ? (
				<Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.25} aria-hidden />
			) : (
				<Heart className="h-3 w-3" strokeWidth={2.25} fill={liked ? 'currentColor' : 'none'} aria-hidden />
			)}
			{count != null ? formatDiscoverLikeCount(count) : '—'}
		</>
	)
	if (onClick) {
		return (
			<button
				type="button"
				onClick={onClick}
				disabled={disabled || loading || liked}
				className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition active:scale-95 disabled:cursor-default disabled:opacity-80 ${style}`}
				aria-label={liked ? 'Liked' : 'Like this coupon'}
				aria-pressed={liked}
			>
				{inner}
			</button>
		)
	}
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${style}`}
			aria-label={label}
		>
			{inner}
		</span>
	)
}

/** Heart overlay + optional count pill for issued coupon tickets. Likes cannot be removed from UI. */
export default function CouponUserLikeChrome({ showCountPill = true, ...options }: Props) {
	const { userLiked, likeLoading, likeCount, onHeartClick } = useCouponUserLike(options)

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
		</>
	)
}
