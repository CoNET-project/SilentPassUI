import { useDaemonContext } from "@/providers/DaemonProvider"

const LinkPayPopup = ({ open, onClose }: {open: boolean, onClose: () => void}) => {
	

	const { paymentLink } = useDaemonContext()
	const {code, note, amount, address} = paymentLink
	if (!open) return null
	return (
		<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[999]">
			<div className="bg-white dark:bg-slate-900 w-[85%] rounded-2xl p-5 shadow-xl border border-slate-200 dark:border-slate-700">
				
				<h2 className="text-base font-semibold mb-3 text-slate-900 dark:text-slate-100">
					Payment Link Details
				</h2>

				<div className="space-y-2 text-[13px] text-slate-700 dark:text-slate-200">
					
					<div className="flex justify-between">
						<span className="text-slate-500 dark:text-slate-400">Code:</span>
						<span className="font-mono">{code}</span>
					</div>

					<div className="flex justify-between">
						<span className="text-slate-500 dark:text-slate-400">Note:</span>
						<span className="font-mono">{note || '—'}</span>
					</div>

					<div className="flex justify-between">
						<span className="text-slate-500 dark:text-slate-400">Amount:</span>
						<span className="font-mono">{amount}</span>
					</div>

					<div className="flex justify-between">
						<span className="text-slate-500 dark:text-slate-400">Recipient:</span>
						<span className="font-mono">{address}</span>
					</div>
				</div>

				<button
					onClick={onClose}
					className="mt-4 w-full py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium"
				>
					Close
				</button>
			</div>
		</div>
	)
}

export default LinkPayPopup