import React from 'react'
import { useNfcRead } from '@/hooks/useNfcRead'
import { fetchNfcCardStatus } from '@/services/beamio'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import { SmartphoneNfc, CheckCircle, XCircle, Loader2 } from 'lucide-react'

type Props = {
	onClose: () => void
}

export default function PaymentWithNfc({ onClose }: Props) {
	const { readUid, uid, status, error, reset } = useNfcRead()
	const [apiResult, setApiResult] = React.useState<{ registered: boolean } | null>(null)
	const [apiError, setApiError] = React.useState<string | null>(null)
	const [querying, setQuerying] = React.useState(false)

	const handleScan = async () => {
		reset()
		setApiResult(null)
		setApiError(null)
		const readUidResult = await readUid()
		if (readUidResult) {
			setQuerying(true)
			try {
				const result = await fetchNfcCardStatus(readUidResult)
				setApiResult(result)
			} catch (e) {
				setApiError((e as Error)?.message ?? 'Query failed')
			} finally {
				setQuerying(false)
			}
		}
	}

	return (
		<div className="flex flex-col min-h-full bg-white dark:bg-slate-900">
			<BeamioNavBack title="Payment with NFC" onClose={onClose} onMore={() => {}} />
			<div className="flex-1 px-6 py-8 overflow-auto">
				<div className="flex flex-col items-center gap-6">
					<div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
						<SmartphoneNfc className="w-10 h-10 text-blue-600 dark:text-blue-400" strokeWidth={2} />
					</div>
					<p className="text-center text-slate-600 dark:text-slate-400 text-sm">
						Place NTAG 424 DNA card near the back of your phone
					</p>
					<button
						type="button"
						onClick={handleScan}
						disabled={status === 'reading' || querying}
						className="w-full py-3.5 rounded-xl border-2 border-blue-500 bg-blue-500 text-white font-semibold text-base hover:bg-blue-600 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
					>
						{(status === 'reading' || querying) ? (
							<>
								<Loader2 className="w-5 h-5 animate-spin" />
								{querying ? 'Querying...' : 'Hold NFC card near phone...'}
							</>
						) : (
							'Read NFC Card'
						)}
					</button>
					{uid && (
						<div className="w-full rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-3">
							<p className="text-xs text-slate-500 dark:text-slate-400 mb-1">UID</p>
							<p className="font-mono text-sm break-all text-slate-800 dark:text-slate-200">{uid}</p>
						</div>
					)}
					{error && (
						<div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
							<XCircle className="w-5 h-5 flex-shrink-0" />
							<span>{error}</span>
						</div>
					)}
					{apiError && (
						<div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
							<XCircle className="w-5 h-5 flex-shrink-0" />
							<span>{apiError}</span>
						</div>
					)}
					{apiResult && (
						<div className={`flex items-center gap-2 text-sm ${apiResult.registered ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
							{apiResult.registered ? (
								<>
									<CheckCircle className="w-5 h-5 flex-shrink-0" />
									<span>Card registered</span>
								</>
							) : (
								<>
									<XCircle className="w-5 h-5 flex-shrink-0" />
									<span>Card not registered</span>
								</>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
