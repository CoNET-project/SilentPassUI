import { AnimatePresence, motion } from 'framer-motion'
import { Check, FileVideo, ImagePlus, Images, Loader2, Trash2, UploadCloud, Video, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { uploadMediaFileToIpfsChunked } from '@/utils/ipfsFragmentChunkUpload'

type MediaRecord = {
	id: string
	url: string
	name: string
	kind: 'image' | 'video'
	createdAt: number
}

const MEDIA_STORAGE_PREFIX = 'beamio:merchant-media:v1:'

function storageKey(address: string): string {
	return `${MEDIA_STORAGE_PREFIX}${address.trim().toLowerCase()}`
}

function loadMedia(address: string): MediaRecord[] {
	try {
		const parsed = JSON.parse(localStorage.getItem(storageKey(address)) || '[]')
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

function saveMedia(address: string, rows: MediaRecord[]): void {
	localStorage.setItem(storageKey(address), JSON.stringify(rows))
}

export function MediaLibraryPage() {
	const { profiles, setShowFooter } = useDaemonContext()
	const profile = profiles?.[0]
	const address = profile?.keyID?.trim() || ''
	const [items, setItems] = useState<MediaRecord[]>(() => (address ? loadMedia(address) : []))
	const [uploading, setUploading] = useState(false)
	const [uploadMessage, setUploadMessage] = useState('')
	const [error, setError] = useState('')
	const [addMediaOpen, setAddMediaOpen] = useState(false)
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [dragOver, setDragOver] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	const selectFile = (file: File | undefined) => {
		if (!file) return
		if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
			setError('Choose an image or video file.')
			return
		}
		setError('')
		setSelectedFile(file)
	}

	const onUpload = async () => {
		const file = selectedFile
		if (!file || !address || !profile?.privateKeyArmor) return
		setError('')
		setUploading(true)
		setUploadMessage('Preparing media…')
		try {
			const hash = await uploadMediaFileToIpfsChunked(
				{ privateKeyArmor: profile.privateKeyArmor },
				file,
				(progress) => setUploadMessage(progress.message),
			)
			const next: MediaRecord = {
				id: `${hash}-${Date.now()}`,
				url: `https://ipfs.conet.network/api/getFragment?hash=${hash}`,
				name: file.name,
				kind: file.type.startsWith('video/') ? 'video' : 'image',
				createdAt: Date.now(),
			}
			const rows = [next, ...items]
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

	const remove = (id: string) => {
		const rows = items.filter((item) => item.id !== id)
		setItems(rows)
		if (address) saveMedia(address, rows)
	}

	return (
		<>
			<div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5 overflow-y-auto p-4 sm:p-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<p className="text-xs font-black uppercase tracking-[0.2em] text-[#0051d1]">Assets</p>
					<h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Media</h1>
					<p className="mt-2 text-sm text-slate-500">
						Upload and manage images and videos for your Business Catalog items.
					</p>
				</div>
				<button
					type="button"
					disabled={uploading || !address}
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

			{items.length === 0 ? (
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
									<video src={item.url} controls className="h-full w-full object-contain" />
								) : (
									<img src={item.url} alt={item.name} className="h-full w-full object-contain" />
								)}
							</div>
							<div className="flex items-center gap-3 p-3">
								{item.kind === 'video' ? <Video className="h-4 w-4 text-slate-500" /> : <Images className="h-4 w-4 text-slate-500" />}
								<p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{item.name}</p>
								<button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.name}`} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
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
								disabled={!selectedFile || uploading || !address}
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
