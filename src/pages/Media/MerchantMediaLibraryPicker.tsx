import { ChevronLeft, Film, Images, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	merchantMediaHeroUrlFromRecord,
	resolveMerchantMediaItems,
	type MediaInput,
	type MediaRecord,
} from '@/pages/Media/merchantMediaStorage'

type MerchantMediaLibraryPickerProps = {
	open: boolean
	onClose: () => void
	cardAddress: string
	eoaAddress: string
	initialMedia?: MediaInput[]
	onSelect: (item: MediaRecord, heroUrl: string) => void | Promise<void>
	onGoToMedia?: () => void
	selecting?: boolean
}

export function MerchantMediaLibraryPicker(props: MerchantMediaLibraryPickerProps) {
	const {
		open,
		onClose,
		cardAddress,
		eoaAddress,
		initialMedia = [],
		onSelect,
		onGoToMedia,
		selecting = false,
	} = props
	const [isEntered, setIsEntered] = useState(false)
	const [isClosing, setIsClosing] = useState(false)
	const panelRef = useRef<HTMLDivElement>(null)

	const items = useMemo(
		() => resolveMerchantMediaItems(initialMedia, eoaAddress),
		[initialMedia, eoaAddress, open],
	)

	useEffect(() => {
		if (!open) {
			setIsEntered(false)
			setIsClosing(false)
			return
		}
		setIsClosing(false)
		const frame = requestAnimationFrame(() => setIsEntered(true))
		return () => cancelAnimationFrame(frame)
	}, [open])

	const close = useCallback(() => {
		if (isClosing || selecting) return
		setIsClosing(true)
		window.setTimeout(onClose, 300)
	}, [isClosing, onClose, selecting])

	const goToMedia = useCallback(() => {
		if (!onGoToMedia || selecting || isClosing) return
		setIsClosing(true)
		window.setTimeout(() => {
			onClose()
			onGoToMedia()
		}, 300)
	}, [onGoToMedia, onClose, selecting, isClosing])

	useEffect(() => {
		if (!open) return
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target
			if (!(target instanceof Node) || panelRef.current?.contains(target)) return
			close()
		}
		document.addEventListener('pointerdown', onPointerDown, true)
		return () => document.removeEventListener('pointerdown', onPointerDown, true)
	}, [open, close])

	if (!open) return null

	const normalizedCard = cardAddress.trim()

	return (
		<div className="fixed inset-0 z-[92] font-sans">
			<button
				type="button"
				aria-label="Close"
				tabIndex={-1}
				className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
					isClosing || !isEntered ? 'opacity-0' : 'opacity-100'
				}`}
				onClick={close}
			/>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="merchant-media-picker-title"
				className="absolute inset-y-0 right-0 flex h-full w-full max-w-2xl flex-col bg-[#f5f7f9] shadow-2xl transition-transform duration-300 ease-out"
				style={{
					transform: isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)',
				}}
			>
				<div
					className="relative flex shrink-0 items-center justify-between px-4 py-3"
					style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
				>
					<button
						type="button"
						tabIndex={-1}
						aria-label="Back"
						disabled={selecting}
						onClick={close}
						className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-white/90 text-[#2c2f31] shadow-[0_2px_10px_rgba(0,0,0,0.16),0_1px_3px_rgba(0,0,0,0.12)] backdrop-blur-md transition hover:bg-white active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
					>
						<ChevronLeft className="h-[17px] w-[17px] stroke-[2.5]" aria-hidden />
					</button>
					<p
						id="merchant-media-picker-title"
						className="pointer-events-none absolute inset-x-12 truncate text-center text-sm font-semibold text-[#2c2f31]"
					>
						Choose background
					</p>
					{onGoToMedia ? (
						<button
							type="button"
							tabIndex={-1}
							disabled={selecting}
							onClick={goToMedia}
							className="shrink-0 rounded-full bg-[#0051d1] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#0046b8] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
						>
							Add new
						</button>
					) : (
						<span className="h-9 w-9 shrink-0" aria-hidden />
					)}
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
					{selecting ? (
						<div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-600">
							<Loader2 className="h-5 w-5 animate-spin text-[#0051d1]" aria-hidden />
							Applying background…
						</div>
					) : !normalizedCard ? (
						<div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-6 text-center">
							<Images className="h-10 w-10 text-amber-400" aria-hidden />
							<p className="mt-3 font-semibold text-amber-900">Select a merchant card first</p>
						</div>
					) : items.length === 0 ? (
						<div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
							<Images className="h-10 w-10 text-slate-300" aria-hidden />
							<p className="mt-3 font-semibold text-slate-700">No media yet</p>
							<p className="mt-1 text-sm text-slate-500">
								Upload images or videos in Media, then pick one here.
							</p>
							{onGoToMedia ? (
								<button
									type="button"
									onClick={goToMedia}
									className="mt-4 rounded-xl bg-[#0051d1] px-4 py-2.5 text-sm font-bold text-white shadow-sm"
								>
									Add new
								</button>
							) : null}
						</div>
					) : (
						<div
							className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-1 pb-2 pt-1 [scrollbar-width:thin]"
							aria-label="Uploaded media"
						>
							{items.map((item) => {
								const previewSrc =
									item.kind === 'video'
										? item.thumbnailUrl || item.url
										: item.url
								return (
									<button
										key={item.id}
										type="button"
										disabled={selecting}
										onClick={() => void onSelect(item, merchantMediaHeroUrlFromRecord(item))}
										className="group w-[min(78vw,320px)] shrink-0 snap-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-[#0051d1]/40 hover:shadow-md disabled:opacity-60"
									>
										<div className="relative aspect-[16/9] bg-slate-100">
											{item.kind === 'video' && !item.thumbnailUrl ? (
												<video
													src={item.url}
													className="h-full w-full object-cover"
													muted
													playsInline
													preload="metadata"
												/>
											) : (
												<img
													src={previewSrc}
													alt=""
													className="h-full w-full object-cover"
													draggable={false}
												/>
											)}
											{item.kind === 'video' ? (
												<span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
													<Film className="h-3 w-3" aria-hidden />
													Video
												</span>
											) : null}
										</div>
										<p className="truncate px-3 py-2.5 text-sm font-semibold text-slate-700">
											{item.name}
										</p>
									</button>
								)
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
