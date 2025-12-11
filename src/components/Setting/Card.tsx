const Card: React.FC<{
	title: string;
	description?: string;
	/** Optional leading icon, e.g. QR / key / shield */
	icon?: React.ReactNode;
	/** Small label on the right, e.g. “Set up”, “Advanced” */
	badge?: string;
	/** Visual tone of the card */
	tone?: "default" | "info" | "warning" | "danger";
	children?: React.ReactNode;
}> = ({ title, description, icon, badge, tone = "default", children }) => {
	const toneClasses = {
		default: "border-slate-200 bg-slate-50/60",
		info: "border-sky-100 bg-sky-50/80",
		warning: "border-amber-200 bg-amber-50/80",
		danger: "border-rose-200 bg-rose-50/80",
	}[tone];

	const titleClasses = {
		default: "text-slate-800",
		info: "text-sky-900",
		warning: "text-amber-900",
		danger: "text-rose-900",
	}[tone];

	const descriptionClasses = {
		default: "text-slate-500",
		info: "text-sky-800",
		warning: "text-amber-800",
		danger: "text-rose-800",
	}[tone];

	return (
		<div
		className={`rounded-2xl border px-4 py-3 flex flex-col gap-2 ${toneClasses}`}
		>
		<div className="flex items-start justify-between gap-3">
			<div className="flex items-start gap-2">
			{icon && (
				<div className="mt-0.5 w-6 h-6 rounded-lg bg-white/70 flex items-center justify-center text-[11px]">
				{icon}
				</div>
			)}
			<div>
				<div className={`text-[12px] font-semibold ${titleClasses}`}>
				{title}
				</div>
				{description && (
				<div
					className={`text-[11px] mt-0.5 leading-snug ${descriptionClasses}`}
				>
					{description}
				</div>
				)}
			</div>
			</div>

			{badge && (
			<span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/70 text-slate-600 border border-white/80">
				{badge}
			</span>
			)}
		</div>

		{children && <div className="mt-1">{children}</div>}
		</div>
	);
}

export default Card;