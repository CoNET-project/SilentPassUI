import React, { useEffect, useState } from 'react'
import { ChevronRight, ExternalLink, Gift, Store, Ticket } from 'lucide-react'
import { IpfsImg } from '@/components/IpfsImg'
import {
	classifyBeamioShareUrl,
	fetchChatShareLinkMeta,
	shareKindLabel,
	type ChatShareLinkKind,
	type ChatShareLinkMeta,
} from '@/utils/chatShareLinkPreview'

type Props = {
	shareUrl: string
	timeLabel: string
	isMe: boolean
	onOpen: () => void
}

function previewImageUrl(meta: ChatShareLinkMeta | null): string {
	if (!meta) return ''
	const og = meta.ogImageUrl?.trim() ?? ''
	if (og) return og
	const bg = meta.backgroundImage?.trim() ?? ''
	if (bg) return bg
	const icon = meta.iconUrl?.trim() ?? ''
	return icon
}

function KindIcon({ kind, meta }: { kind: ChatShareLinkKind | null; meta: ChatShareLinkMeta | null }) {
	const label = shareKindLabel(meta, kind)
	if (label === 'Merchant') return <Store className="h-5 w-5" strokeWidth={2.25} aria-hidden />
	if (label === 'Catalog') return <Gift className="h-5 w-5" strokeWidth={2.25} aria-hidden />
	return <Ticket className="h-5 w-5" strokeWidth={2.25} aria-hidden />
}

/** WhatsApp-style link preview for Beamio app-download / open-claim share URLs. */
export function ChatShareLinkPreviewCard({ shareUrl, timeLabel, isMe, onOpen }: Props) {
	const kind = classifyBeamioShareUrl(shareUrl)
	const [meta, setMeta] = useState<ChatShareLinkMeta | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		let cancelled = false
		setLoading(true)
		void (async () => {
			const next = await fetchChatShareLinkMeta(shareUrl)
			if (cancelled) return
			if (next) setMeta(next)
			setLoading(false)
		})()
		return () => {
			cancelled = true
		}
	}, [shareUrl])

	const imageUrl = previewImageUrl(meta)
	const title =
		meta?.shareHeadline?.trim() ||
		meta?.title?.trim() ||
		(kind === 'discover_merchant' ? 'Merchant on Beamio' : 'Open in Beamio')
	const subtitle =
		meta?.subtitle?.trim() ||
		meta?.merchantName?.trim() ||
		(kind === 'open_claim' ? 'Claim this coupon' : 'Beamio share link')
	const kindLabel = shareKindLabel(meta, kind)
	const isHttpImage = /^https?:\/\//i.test(imageUrl)

	return (
		<button
			type="button"
			onClick={onOpen}
			className={`w-[280px] max-w-full rounded-[22px] bg-white text-left text-slate-900 shadow-[0_6px_18px_rgba(2,6,23,0.10)] ring-1 ring-black/5 overflow-hidden transition active:scale-[0.99] ${isMe ? 'ml-auto' : 'mr-auto'}`}
			aria-label={`Open ${title}`}
		>
			<div className="relative aspect-[1200/630] w-full bg-slate-100 overflow-hidden">
				{loading && !imageUrl ? (
					<div className="absolute inset-0 animate-pulse bg-slate-200/80" aria-hidden />
				) : imageUrl && isHttpImage ? (
					imageUrl.includes('ipfs.conet.network') || imageUrl.includes('/api/fragment') ? (
						<IpfsImg src={imageUrl} alt="" className="h-full w-full object-cover" />
					) : (
						<img src={imageUrl} alt="" className="h-full w-full object-cover" />
					)
				) : (
					<div
						className="absolute inset-0 flex items-center justify-center"
						style={{
							background:
								meta?.backgroundColorHex?.trim() ||
								'linear-gradient(135deg, #e9edff 0%, #f5ecff 100%)',
						}}
					>
						<div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80 text-[#0051d1] shadow-sm">
							<KindIcon kind={kind} meta={meta} />
						</div>
					</div>
				)}
			</div>

			<div className="p-3.5">
				<div className="flex items-start justify-between gap-2 mb-1.5">
					<span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
						{kindLabel}
					</span>
					<span className="text-[11px] text-slate-400 shrink-0">{timeLabel}</span>
				</div>

				<div className="text-[15px] font-semibold text-slate-900 leading-snug line-clamp-2">
					{loading && !meta ? 'Loading…' : title}
				</div>
				{subtitle ? (
					<p className="mt-1 text-[12px] text-slate-500 leading-snug line-clamp-2">{subtitle}</p>
				) : null}

				<div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-[#0051d1] py-2.5 text-sm font-semibold text-white">
					Open
					<ChevronRight className="h-4 w-4 opacity-90" aria-hidden />
				</div>

				<div className="mt-2.5 flex items-center gap-1 pt-2 border-t border-slate-100">
					<ExternalLink className="h-3 w-3 text-slate-400" aria-hidden />
					<span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase truncate">
						beamio.app
					</span>
				</div>
			</div>
		</button>
	)
}
