import React, { useState } from 'react'
import { ChevronRight, ExternalLink, Link2 } from 'lucide-react'
import {
	genericLinkFaviconUrl,
	genericLinkHostLabel,
	genericLinkTitleFromUrl,
} from '@/utils/chatGenericLinkPreview'

type Props = {
	url: string
	timeLabel: string
	isMe: boolean
	onOpen: () => void
}

/** Generic WhatsApp-style link preview for non-Beamio-special http(s) URLs. */
export function ChatGenericLinkPreviewCard({ url, timeLabel, isMe, onOpen }: Props) {
	const host = genericLinkHostLabel(url)
	const title = genericLinkTitleFromUrl(url)
	const favicon = genericLinkFaviconUrl(url)
	const [faviconFailed, setFaviconFailed] = useState(false)

	return (
		<button
			type="button"
			onClick={onOpen}
			className={`w-[280px] max-w-full rounded-[22px] bg-white text-left text-slate-900 shadow-[0_6px_18px_rgba(2,6,23,0.10)] ring-1 ring-black/5 overflow-hidden transition active:scale-[0.99] ${isMe ? 'ml-auto' : 'mr-auto'}`}
			aria-label={`Open ${host}`}
		>
			<div className="relative flex h-[88px] w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200/80 overflow-hidden">
				{favicon && !faviconFailed ? (
					<img
						src={favicon}
						alt=""
						className="h-12 w-12 rounded-xl bg-white object-contain shadow-sm ring-1 ring-black/5"
						onError={() => setFaviconFailed(true)}
					/>
				) : (
					<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-black/5">
						<Link2 className="h-6 w-6" strokeWidth={2.25} aria-hidden />
					</div>
				)}
			</div>

			<div className="p-3.5">
				<div className="flex items-start justify-between gap-2 mb-1.5">
					<span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Link</span>
					<span className="text-[11px] text-slate-400 shrink-0">{timeLabel}</span>
				</div>

				<div className="text-[15px] font-semibold text-slate-900 leading-snug line-clamp-2">{title}</div>
				<p className="mt-1 text-[12px] text-slate-500 leading-snug truncate">{host}</p>

				<div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white">
					Open
					<ChevronRight className="h-4 w-4 opacity-90" aria-hidden />
				</div>

				<div className="mt-2.5 flex items-center gap-1 pt-2 border-t border-slate-100">
					<ExternalLink className="h-3 w-3 text-slate-400" aria-hidden />
					<span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase truncate">
						{host}
					</span>
				</div>
			</div>
		</button>
	)
}
