import { Images, Loader2, Trash2, UploadCloud, Video } from 'lucide-react'
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
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	const onUpload = async (file: File | undefined) => {
		if (!file || !address || !profile?.privateKeyArmor) return
		if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
			setError('Choose an image or video file.')
			return
		}
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
					onClick={() => inputRef.current?.click()}
					className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#0051d1] px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
					aria-busy={uploading}
				>
					{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
					Add media
				</button>
				<input
					ref={inputRef}
					type="file"
					accept="image/*,video/*"
					className="hidden"
					onChange={(event) => {
						void onUpload(event.target.files?.[0])
						event.currentTarget.value = ''
					}}
				/>
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
	)
}
