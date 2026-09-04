import { Gift, ArrowRight } from 'lucide-react'
import { DiscoverDescriptionTextWithUrlCapsules } from '@/components/discover/DiscoverDescriptionTextWithUrlCapsules'

/**
 * Discover merchant detail — New Customer Bonus panel when Top-up Promotion is active.
 * Blue promo card + WELCOME OFFER badge + Claim & Top Up CTA (design comp).
 */
export function DiscoverTopupPromotionCapsule({
	title,
	description,
	ctaLabel = 'Claim & Top Up',
	onClaimTopUp,
}: {
	title: string
	description: string
	ctaLabel?: string
	/** Opens Discover USDC / card top-up amount flow. */
	onClaimTopUp?: () => void
}) {
	return (
		<section
			className="overflow-hidden rounded-[22px] bg-[#1562f0] p-5 text-white shadow-[0_10px_28px_rgba(21,98,240,0.28)] sm:p-6"
			aria-label={title}
		>
			<span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-white backdrop-blur-[2px]">
				<Gift className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
				Welcome Offer
			</span>
			<h3 className="mt-3.5 text-[22px] font-bold leading-snug tracking-tight text-white sm:text-[24px]">
				{title}
			</h3>
			<p className="mt-2 text-[14px] leading-relaxed text-white/90 sm:text-[15px]">
				<DiscoverDescriptionTextWithUrlCapsules text={description} tone="onDark" />
			</p>
			{onClaimTopUp ? (
				<button
					type="button"
					onClick={onClaimTopUp}
					className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-bold text-[#1562f0] shadow-sm transition active:scale-[0.98] hover:bg-white/95"
				>
					{ctaLabel}
					<ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
				</button>
			) : null}
		</section>
	)
}
