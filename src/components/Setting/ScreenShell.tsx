const ScreenShell: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="flex flex-col h-full px-6 py-5">
	{/* Back + title */}
	<div className="flex items-center gap-3 mb-4">
	  <div>
		<div className="text-[16px] font-semibold text-slate-900">{title}</div>
		{subtitle && (
		  <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
			{subtitle}
		  </div>
		)}
	  </div>
	</div>

	<div className="flex-1 flex flex-col gap-4 text-[13px] text-slate-900 overflow-y-auto pb-4">
	  {children}
	</div>
  </div>
)

export default ScreenShell