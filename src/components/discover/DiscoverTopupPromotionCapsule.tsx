import { Star } from 'lucide-react'

/** Merchant detail top-up promotion banner — cream capsule with orange star (design comp). */
export function DiscoverTopupPromotionCapsule({
	title,
	description,
}: {
	title: string
	description: string
}) {
	return (
		<div className="flex items-start gap-3.5 rounded-[20px] bg-[#fff9f2] p-4 dark:bg-orange-950/25 sm:gap-4 sm:p-5">
			<span
				className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffe8d6] text-orange-500 dark:bg-orange-950/60 dark:text-orange-400"
				aria-hidden
			>
				<Star className="h-5 w-5" strokeWidth={2.25} fill="currentColor" />
			</span>
			<div className="min-w-0 flex-1">
				<h3 className="text-[17px] font-bold leading-snug text-[#1f2328] dark:text-slate-100">{title}</h3>
				<p className="mt-1.5 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
			</div>
		</div>
	)
}
