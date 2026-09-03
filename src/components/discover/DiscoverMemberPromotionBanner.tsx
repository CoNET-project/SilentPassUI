/**
 * Discover merchant detail — member promotion pill under the membership wallet card.
 * Top-up bonus (bold blue) | charge earn (grey).
 */
export function DiscoverMemberPromotionBanner({
	primary,
	secondary,
	onActivate,
}: {
	primary: string | null
	secondary: string | null
	/** Opens top-up when primary (top-up bonus) is present. */
	onActivate?: () => void
}) {
	if (!primary && !secondary) return null
	const interactive = Boolean(onActivate && primary)
	const className = [
		'flex w-full items-center gap-2.5 rounded-full bg-[#eef2ff] px-3.5 py-2.5 text-left',
		'ring-1 ring-[#dce4ff] dark:bg-[#1a2438] dark:ring-[#2a3a5c]',
		interactive ? 'transition active:scale-[0.99] hover:bg-[#e8eeff] dark:hover:bg-[#1e2a4a]' : '',
	]
		.filter(Boolean)
		.join(' ')

	const body = (
		<>
			<span
				className="h-7 w-7 shrink-0 rounded-full bg-[#c5d4ff] dark:bg-[#3a4f7a]"
				aria-hidden
			/>
			<span className="min-w-0 flex-1 text-[13px] leading-snug sm:text-[14px]">
				{primary ? (
					<span className="font-bold text-[#1562f0] dark:text-[#8eb4ff]">{primary}</span>
				) : null}
				{primary && secondary ? (
					<span className="mx-1.5 font-normal text-slate-300 dark:text-slate-600" aria-hidden>
						|
					</span>
				) : null}
				{secondary ? (
					<span className="font-medium text-slate-500 dark:text-slate-400">{secondary}</span>
				) : null}
			</span>
		</>
	)

	if (interactive) {
		return (
			<button
				type="button"
				onClick={onActivate}
				className={className}
				aria-label={primary ?? 'Promotion'}
			>
				{body}
			</button>
		)
	}

	return (
		<div className={className} role="status" aria-label="Promotion">
			{body}
		</div>
	)
}
