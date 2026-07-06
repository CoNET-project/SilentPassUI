import React from 'react'
import { Hexagon, ChevronRight } from 'lucide-react'
import type { AaMultisigChatPreview } from '@/utils/aaMultisigChatPreview'
import { beamioWalletAccent } from '@/utils/beamioWalletAccent'

type Props = {
	preview: AaMultisigChatPreview
	timeLabel: string
	isMe: boolean
	onOpen: () => void
}

export function AaMultisigChatRequestCard({ preview, timeLabel, isMe, onOpen }: Props) {
	const aaAccent = beamioWalletAccent('aa')
	const showProgress = Boolean(
		preview.progressLabel || (preview.action === 'propose' && preview.threshold > 0)
	)

	return (
		<button
			type="button"
			onClick={onOpen}
			className={`w-[280px] max-w-full rounded-[22px] bg-white text-left text-slate-900 shadow-[0_6px_18px_rgba(2,6,23,0.10)] ring-1 ring-black/5 overflow-hidden transition active:scale-[0.99] ${isMe ? 'ml-auto' : 'mr-auto'}`}
		>
			<div className="p-4">
				<div className="flex items-start justify-between gap-2 mb-3">
					<div className="flex items-center gap-2 min-w-0">
						<div
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
							style={{ backgroundColor: aaAccent.accent }}
						>
							<Hexagon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
						</div>
						<div className="min-w-0">
							<div className="font-bold text-[15px] text-slate-900 leading-tight">Signing request</div>
							<div className="text-[11px] text-slate-500 truncate">{preview.kindLabel}</div>
						</div>
					</div>
					<span className="text-[11px] text-slate-400 shrink-0">{timeLabel}</span>
				</div>

				<div className="text-[15px] font-semibold text-slate-900 leading-snug">{preview.title}</div>

				{showProgress ? (
					<p className="mt-2 text-[13px] text-slate-500">
						{preview.progressLabel ?? (
							<>
								Signatures{' '}
								<span className="font-semibold text-slate-800">
									{preview.signatureCount}/{preview.threshold}
								</span>
							</>
						)}
					</p>
				) : null}
				{preview.statusLine ? (
					<p className="mt-1 text-[12px] font-medium text-slate-600">{preview.statusLine}</p>
				) : null}

				<div
					className="mt-4 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white"
					style={{ backgroundColor: aaAccent.accent }}
				>
					{preview.ctaLabel}
					<ChevronRight className="h-4 w-4 opacity-90" aria-hidden />
				</div>

				<div className="mt-3 pt-3 border-t border-slate-100">
					<span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
						Smart Wallet Multisig
					</span>
				</div>
			</div>
		</button>
	)
}
