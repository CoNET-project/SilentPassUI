import React, { useEffect, useMemo } from 'react'
import { Phone, PhoneCall, PhoneMissed, PhoneIncoming, PhoneOutgoing } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'

const formatDuration = (ms?: number) => {
	if (!ms || ms < 1000) return ''
	const total = Math.floor(ms / 1000)
	const minutes = Math.floor(total / 60)
	const seconds = total % 60
	return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const statusLabel = (record: PhoneCallRecord) => {
	if (record.status === 'missed') return 'Missed'
	if (record.status === 'declined') return 'Declined'
	if (record.status === 'cancelled') return 'Cancelled'
	if (record.status === 'failed') return 'Failed'
	if (record.status === 'ringing') return 'Calling'
	return record.direction === 'incoming' ? 'Incoming call' : 'Outgoing call'
}

export default function PhoneHistoryPage() {
	const navigate = useNavigate()
	const { profiles, setShowFooter } = useDaemonContext()

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	const records = useMemo(() => {
		const rows = profiles?.[0]?.phoneCalls || []
		return [...rows].sort((a, b) => b.createdAt - a.createdAt)
	}, [profiles])

	return (
		<div className="min-h-[100dvh] bg-[#f4f6f8] px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top,0px))] text-slate-900">
			<div className="mb-8 flex items-center">
				<BeamioCircularBackButton onClick={() => navigate(-1)} variant="onLight" />
			</div>
			<header className="mb-6">
				<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Communication</p>
				<h1 className="mt-2 text-3xl font-semibold tracking-tight">Phone</h1>
				<p className="mt-2 text-sm text-slate-500">Your encrypted Beamio call history.</p>
			</header>
			<section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/[0.05]">
				{records.length === 0 ? (
					<div className="px-5 py-12 text-center text-sm text-slate-500">No calls yet.</div>
				) : records.map(record => (
					<button
						key={record.callId}
						type="button"
						className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-4 text-left last:border-b-0"
						onClick={() => navigate('/chat')}
					>
						<span className={[
							'grid h-10 w-10 shrink-0 place-items-center rounded-full',
							record.status === 'missed' ? 'bg-rose-50 text-rose-600' : 'bg-[#e9edff] text-[#0051d1]',
						].join(' ')}>
							{record.status === 'missed' ? <PhoneMissed className="h-5 w-5" /> : record.direction === 'incoming' ? <PhoneIncoming className="h-5 w-5" /> : <PhoneOutgoing className="h-5 w-5" />}
						</span>
						<span className="min-w-0 flex-1">
							<span className="block truncate text-sm font-semibold">{record.peerAddress}</span>
							<span className="mt-1 block text-xs text-slate-500">
								{statusLabel(record)} · {new Date(record.createdAt).toLocaleString()} {formatDuration(record.durationMs) ? `· ${formatDuration(record.durationMs)}` : ''}
							</span>
						</span>
						<PhoneCall className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
					</button>
				))}
			</section>
		</div>
	)
}
