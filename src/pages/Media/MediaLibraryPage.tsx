import { AnimatePresence, motion } from 'framer-motion'
import { Check, FileVideo, ImagePlus, Images, Loader2, Trash2, UploadCloud, Video, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { updateBeamioCardShareMetadata } from '@/services/BeamioCard'
import { ProductionVideoIconFramePicker } from '@/pages/Vouchers/example/ProductionVideoIconFramePicker'
import { uploadDataUrlToIpfsChunked, uploadMediaFileToIpfsChunked } from '@/utils/ipfsFragmentChunkUpload'
import { standardizeProductionBackgroundVideo } from '@/utils/productionBackgroundVideo'
import {
	loadMedia,
	resolveMerchantMediaItems,
	saveMedia,
	type MediaInput,
	type MediaRecord,
} from '@/pages/Media/merchantMediaStorage'

type MediaLibraryPageProps = {
	cardAddress: string
	initialMedia?: MediaInput[]
}

export function MediaLibraryPage({ cardAddress, initialMedia = [] }: MediaLibraryPageProps) {
	const { profiles, setShowFooter } = useDaemonContext()
	const profile = profiles?.[0]
	const address = profile?.keyID?.trim() || ''
	const normalizedCardAddress = cardAddress.trim()
	const [items, setItems] = useState<MediaRecord[]>(() =>
		resolveMerchantMediaItems(initialMedia, address),
	)
	const [uploading, setUploading] = useState(false)
	const [uploadMessage, setUploadMessage] = useState('')
	const [error, setError] = useState('')
	const [addMediaOpen, setAddMediaOpen] = useState(false)
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [selectedPreviewUrl, setSelectedPreviewUrl] = useState('')
	const [selectedThumbnailDataUrl, setSelectedThumbnailDataUrl] = useState('')
	const [selectedThumbnailTimeSec, setSelectedThumbnailTimeSec] = useState<number | null>(null)
	const [dragOver, setDragOver] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	useEffect(() => {
		if (!normalizedCardAddress || initialMedia.length > 0) return
		let cancelled = false
		void fetch(
			`https://beamio.app/api/cardMetadata?cardAddress=${encodeURIComponent(normalizedCardAddress)}`,
			{ credentials: 'omit' },
		)
			.then(async (response) => {
				if (!response.ok) throw new Error(`metadata_http_${response.status}`)
				const payload = (await response.json()) as {
					metadata?: { shareTokenMetadata?: { merchantMedia?: unknown } } | null
				}
				const raw = payload.metadata?.shareTokenMetadata?.merchantMedia
				if (!Array.isArray(raw)) throw new Error('invalid_merchant_media')
				const remoteMedia = raw.filter(
					(item): item is MediaInput =>
						Boolean(item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string'),
				)
				if (cancelled) return
				const resolved = resolveMerchantMediaItems(remoteMedia, address)
				setItems(resolved)
				if (address) saveMedia(address, resolved)
			})
			.catch(() => {
				// Keep local trusted media when the remote read is unavailable.
			})
		return () => {
			cancelled = true
		}
	}, [address, initialMedia.length, normalizedCardAddress])

	useEffect(() => {
		if (!selectedFile) {
			setSelectedPreviewUrl('')
			return
		}
		const url = URL.createObjectURL(selectedFile)
		setSelectedPreviewUrl(url)
		return () => URL.revokeObjectURL(url)
	}, [selectedFile])

	const selectFile = (file: File | undefined) => {
		if (!file) return
		if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
			setError('Choose an image or video file.')
			return
		}
		setError('')
		setSelectedFile(file)
		setSelectedThumbnailDataUrl('')
		setSelectedThumbnailTimeSec(null)
	}

	const persistCardMedia = async (rows: MediaRecord[]) => {
		if (!normalizedCardAddress) {
			throw new Error('Open a merchant program card before adding media.')
		}
		const result = await updateBeamioCardShareMetadata({
			cardAddress: normalizedCardAddress,
			shareTokenMetadata: { merchantMedia: rows },
		})
		if (!result.success) {
			throw new Error(result.error || 'Failed to update merchant card media.')
		}
	}

	const onUpload = async () => {
		const file = selectedFile
		if (!file || !address || !normalizedCardAddress || !profile?.privateKeyArmor) return
		setError('')
		setUploading(true)
		setUploadMessage('Preparing media…')
		try {
			let uploadFile = file
			if (file.type.startsWith('video/')) {
				const standardized = await standardizeProductionBackgroundVideo({
					file,
					startSec: 0,
					onStatus: (message) => setUploadMessage(message),
					onConvertProgress: (ratio) => setUploadMessage(`Optimizing video… ${Math.round(ratio * 100)}%`),
				})
				uploadFile = standardized.file
			}
			const hash = await uploadMediaFileToIpfsChunked(
				{ privateKeyArmor: profile.privateKeyArmor },
				uploadFile,
				(progress) => setUploadMessage(progress.message),
			)
			const next: MediaRecord = {
				id: `${hash}-${Date.now()}`,
				url: `https://ipfs.conet.network/api/getFragment?hash=${hash}`,
				name: file.name,
				kind: file.type.startsWith('video/') ? 'video' : 'image',
				createdAt: Date.now(),
			}
			if (file.type.startsWith('video/') && selectedThumbnailDataUrl) {
				setUploadMessage('Uploading selected video thumbnail…')
				const thumbnailHash = await uploadDataUrlToIpfsChunked(
					{ privateKeyArmor: profile.privateKeyArmor },
					selectedThumbnailDataUrl,
				)
				next.thumbnailUrl = `https://ipfs.conet.network/api/getFragment?hash=${thumbnailHash}`
			}
			const rows = [next, ...items]
			await persistCardMedia(rows)
			setItems(rows)
			saveMedia(address, rows)
			setUploadMessage('Upload complete.')
			setSelectedFile(null)
			setAddMediaOpen(false)
		} catch (uploadError) {
			setError(uploadError instanceof Error ? uploadError.message : 'Media upload failed.')
			setUploadMessage('')
		} finally {
			setUploading(false)
		}
	}

	const remove = async (id: string) => {
		const rows = items.filter((item) => item.id !== id)
		setError('')
		try {
			await persistCardMedia(rows)
			setItems(rows)
			if (address) saveMedia(address, rows)
		} catch (removeError) {
			setError(removeError instanceof Error ? removeError.message : 'Failed to update merchant card media.')
		}
	}

	return (
		<>
			<div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5 overflow-y-auto p-4 sm:p-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<p className="text-xs font-black uppercase tracking-[0.2em] text-[#0051d1]">Assets</p>
					<h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Media</h1>
					<p className="mt-2 text-sm text-slate-500">
						Upload and manage images and videos displayed across your merchant card.
					</p>
				</div>
				<button
					type="button"
					disabled={uploading || !address || !normalizedCardAddress}
					onClick={() => {
						setError('')
						setUploadMessage('')
						setSelectedFile(null)
						setAddMediaOpen(true)
					}}
					className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#0051d1] px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
					aria-busy={uploading}
				>
					{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
					Add media
				</button>
			</div>

			{uploadMessage ? <p className="text-sm text-slate-500">{uploadMessage}</p> : null}
			{error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

			{!normalizedCardAddress ? (
				<div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-amber-200 bg-amber-50 text-center">
					<Images className="h-10 w-10 text-amber-400" />
					<p className="mt-3 font-semibold text-amber-900">Select a merchant card first</p>
					<p className="mt-1 px-6 text-sm text-amber-800">
						Open an existing merchant program card before managing its media.
					</p>
				</div>
			) : items.length === 0 ? (
				<div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white text-center">
					<Images className="h-10 w-10 text-slate-300" />
					<p className="mt-3 font-semibold text-slate-700">No media yet</p>
					<p className="mt-1 text-sm text-slate-500">Add an image or video to start your media library.</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{items.map((item) => (
						<article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
							<div className="aspect-[4/3] bg-slate-100">
								{item.kind === 'video' ? (
								item.thumbnailUrl ? (
									<img src={item.thumbnailUrl} alt={item.name} className="h-full w-full object-contain" />
								) : (
									<video src={item.url} controls className="h-full w-full object-contain" />
								)
								) : (
									<img src={item.url} alt={item.name} className="h-full w-full object-contain" />
								)}
							</div>
							<div className="flex items-center gap-3 p-3">
								{item.kind === 'video' ? <Video className="h-4 w-4 text-slate-500" /> : <Images className="h-4 w-4 text-slate-500" />}
								<p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{item.name}</p>
								<button type="button" onClick={() => void remove(item.id)} disabled={uploading} aria-label={`Remove ${item.name}`} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
									<Trash2 className="h-4 w-4" />
								</button>
							</div>
						</article>
					))}
				</div>
			)}
			</div>
			<AnimatePresence>
			{addMediaOpen ? (
				<>
					<motion.button
						type="button"
						aria-label="Cancel"
						className="fixed inset-0 z-[90] bg-[#2c2f31]/35 backdrop-blur-[2px]"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => {
							if (!uploading) {
								setSelectedFile(null)
								setAddMediaOpen(false)
							}
						}}
					/>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby="add-media-title"
						className="fixed inset-x-0 bottom-0 z-[91] mx-auto max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-t-[1.75rem] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-4 shadow-[0_-24px_64px_rgba(0,0,0,0.12)]"
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						exit={{ y: '100%' }}
						transition={{ type: 'spring', stiffness: 320, damping: 30 }}
					>
						<div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#d9dde0]" aria-hidden />
						<div className="relative mb-4 flex items-center justify-between gap-3">
							<button
								type="button"
								disabled={uploading}
								tabIndex={-1}
								aria-label="Cancel"
								onClick={() => {
									setSelectedFile(null)
									setAddMediaOpen(false)
								}}
								className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef1f3] text-[#595c5e] transition-colors hover:bg-[#dfe3e6] disabled:cursor-not-allowed disabled:opacity-60"
							>
								<X className="h-4 w-4" strokeWidth={2} aria-hidden />
							</button>
							<h2
								id="add-media-title"
								className="pointer-events-none absolute inset-x-12 truncate text-center text-base font-extrabold tracking-tight text-[#2c2f31] sm:text-lg"
							>
								Add media
							</h2>
							<button
								type="button"
								disabled={
									!selectedFile ||
									uploading ||
									!address ||
									(selectedFile.type.startsWith('video/') && !selectedThumbnailDataUrl)
								}
								onClick={() => void onUpload()}
								aria-busy={uploading}
								aria-label={uploading ? 'Uploading' : 'Upload'}
								className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0051d1] text-white shadow-sm shadow-[#0051d1]/25 transition active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-[#abadaf] disabled:shadow-none disabled:opacity-70"
							>
								{uploading ? (
									<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
								) : selectedFile ? (
									<Check className="h-4 w-4" strokeWidth={2.25} aria-hidden />
								) : (
									<UploadCloud className="h-4 w-4" aria-hidden />
								)}
							</button>
						</div>

						<input
							ref={inputRef}
							type="file"
							accept="image/*,video/*"
							className="hidden"
							onChange={(event) => {
								selectFile(event.target.files?.[0])
								event.currentTarget.value = ''
							}}
						/>
						<div className="mb-3 rounded-2xl bg-[#eef1f3] px-3.5 pb-2.5 pt-1.5">
							<p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#747779]">Media type</p>
							<p className="mt-1 text-sm font-medium text-[#2c2f31]">Catalog background image or video</p>
						</div>
						<button
							type="button"
							disabled={uploading}
							onClick={() => inputRef.current?.click()}
							onDragEnter={(event) => {
								event.preventDefault()
								setDragOver(true)
							}}
							onDragOver={(event) => {
								event.preventDefault()
								event.dataTransfer.dropEffect = 'copy'
							}}
							onDragLeave={() => setDragOver(false)}
							onDrop={(event) => {
								event.preventDefault()
								setDragOver(false)
								selectFile(event.dataTransfer.files?.[0])
							}}
							className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-8 text-[#595c5e] transition ${
								dragOver
									? 'border-[#1562f0] bg-[#eaf1ff]/70 text-[#0051d1]'
									: 'border-[#dfe3e6] bg-[#f7f8f9] hover:border-[#1562f0]/40 hover:bg-[#eaf1ff]/40'
							} disabled:cursor-not-allowed disabled:opacity-60`}
						>
							{uploading ? (
								<Loader2 className="h-7 w-7 animate-spin text-[#1562f0]" aria-hidden />
							) : selectedFile && selectedPreviewUrl ? (
								<span className="mb-2 block aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#0f172a]" aria-hidden>
									{selectedFile.type.startsWith('video/') ? (
										<video
											src={selectedPreviewUrl}
											className="h-full w-full object-contain"
											muted
											autoPlay
											loop
											playsInline
										/>
									) : (
										<img
											src={selectedPreviewUrl}
											alt=""
											className="h-full w-full object-contain"
										/>
									)}
								</span>
							) : selectedFile ? (
								selectedFile.type.startsWith('video/') ? (
									<FileVideo className="h-7 w-7 text-[#0051d1]" aria-hidden />
								) : (
									<ImagePlus className="h-7 w-7 text-[#0051d1]" aria-hidden />
								)
							) : (
								<UploadCloud className="h-7 w-7 text-[#747779]" aria-hidden />
							)}
							<span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#747779]">
								Background media
							</span>
							<span className="text-sm font-bold text-[#2c2f31]">
								{uploading
									? uploadMessage || 'Uploading…'
									: selectedFile
										? selectedFile.name
										: dragOver
											? 'Drop file to upload'
											: 'Upload background image or video'}
							</span>
							{!selectedFile && !uploading ? (
								<span className="text-xs text-[#747779]">Drag and drop, or click to browse</span>
							) : null}
						</button>
						{selectedFile?.type.startsWith('video/') && selectedPreviewUrl ? (
							<div className="mt-3 overflow-hidden rounded-2xl border border-[#e8ecf0] bg-[#f8fafb]">
								<ProductionVideoIconFramePicker
									videoSrc={selectedPreviewUrl}
									sourceFile={selectedFile}
									disabled={uploading}
									onSelectFrame={(frame) => {
										setSelectedThumbnailDataUrl(frame.dataUrl)
										setSelectedThumbnailTimeSec(frame.timeSec)
									}}
								/>
								{selectedThumbnailTimeSec != null ? (
									<p className="px-3 pb-3 text-xs font-medium text-[#595c5e]">
										Selected thumbnail at {selectedThumbnailTimeSec.toFixed(1)}s.
									</p>
								) : (
									<p className="px-3 pb-3 text-xs font-medium text-amber-800">
										Select a thumbnail before uploading.
									</p>
								)}
							</div>
						) : null}
						{selectedFile && !uploading ? (
							<p className="mt-3 text-center text-xs text-[#747779]">
								Click the check button above to upload this file.
							</p>
						) : null}
						{error ? (
							<p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
								{error}
							</p>
						) : null}
					</motion.div>
				</>
			) : null}
			</AnimatePresence>
		</>
	)
}
