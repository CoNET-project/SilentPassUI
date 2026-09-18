import { zipSync, unzipSync } from 'fflate'
import { ethers } from 'ethers'

export const FILE_MESSAGE_TYPE = 'file_message_v1' as const
export const FILE_CHUNK_BYTES = 512 * 1024
export const FILE_MAX_DATA_URL_CHARS = 240 * 1024 * 1024
const IPFS_API = 'https://ipfs.conet.network/api'
const FILE_DIRECT_UPLOAD_MAX_DATA_URL_CHARS = 48 * 1024 * 1024

export type ChatFileEntry = {
	name: string
	sizeBytes: number
}

export type ChatFileMessageManifest = {
	type: typeof FILE_MESSAGE_TYPE
	fragmentHash: string
	key: string
	iv: string
	name: string
	count: number
	sizeBytes: number
	files: ChatFileEntry[]
	/** Media attachments keep their preview inside the encrypted fragment. */
	mediaKind?: 'video' | 'image' | 'pdf'
	previewName?: string
	mime?: string
}

const bytesToBase64 = (bytes: Uint8Array): string => {
	let binary = ''
	for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
	return btoa(binary)
}

const base64ToBytes = (value: string): Uint8Array => {
	const binary = atob(value)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
	return bytes
}

const dataUrlToBytes = (dataUrl: string): Uint8Array => {
	const comma = dataUrl.indexOf(',')
	if (comma < 0) throw new Error('Invalid encrypted file payload')
	return base64ToBytes(dataUrl.slice(comma + 1))
}

export async function encryptChatFiles(files: File[], displayName?: string, preview?: Blob): Promise<{
	dataUrl: string
	manifest: Omit<ChatFileMessageManifest, 'fragmentHash'>
}> {
	if (!files.length) throw new Error('Choose at least one file.')
	const entries: Record<string, Uint8Array> = {}
	const metadata: ChatFileEntry[] = []
	let totalBytes = 0
	for (const file of files) {
		const name = (file.webkitRelativePath || file.name || 'file').replace(/^\/+/, '')
		if (!name || name.includes('..')) throw new Error('A file name is not safe to send.')
		const bytes = new Uint8Array(await file.arrayBuffer())
		entries[name] = bytes
		metadata.push({ name, sizeBytes: bytes.byteLength })
		totalBytes += bytes.byteLength
	}
	const previewName = preview ? `.${metadata[0]?.name || 'video'}.preview.jpg` : undefined
	if (preview && previewName) entries[previewName] = new Uint8Array(await preview.arrayBuffer())
	const zipped = zipSync(entries, { level: 6 })
	const keyBytes = crypto.getRandomValues(new Uint8Array(32))
	const ivBytes = crypto.getRandomValues(new Uint8Array(12))
	const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt'])
	const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, key, zipped))
	const dataUrl = `data:application/octet-stream;base64,${bytesToBase64(encrypted)}`
	if (dataUrl.length > FILE_MAX_DATA_URL_CHARS) {
		throw new Error('These files are too large to upload safely. Please choose fewer or smaller files.')
	}
	return {
		dataUrl,
		manifest: {
			type: FILE_MESSAGE_TYPE,
			key: bytesToBase64(keyBytes),
			iv: bytesToBase64(ivBytes),
			name: displayName || metadata[0]?.name || 'Files',
			count: metadata.length,
			sizeBytes: totalBytes,
			files: metadata,
			...(files.length === 1 && files[0]?.type.startsWith('image/')
				? { mediaKind: 'image' as const, mime: files[0].type }
				: files.length === 1 && (
					files[0]?.type === 'application/pdf'
					|| files[0]?.name.toLowerCase().endsWith('.pdf')
				)
					? { mediaKind: 'pdf' as const, mime: files[0].type || 'application/pdf' }
					: files.length === 1 && files[0]?.type.startsWith('video/')
						? { mediaKind: 'video' as const, mime: files[0].type }
						: {}),
			...(previewName ? { previewName } : {}),
		},
	}
}

export async function uploadEncryptedChatFileDataUrl(
	privateKey: string,
	dataUrl: string,
	onProgress?: (fraction: number) => void,
	signal?: AbortSignal,
): Promise<string> {
	const wallet = new ethers.Wallet(privateKey)
	const fragmentHash = ethers.keccak256(ethers.toUtf8Bytes(dataUrl))
	const signMessage = await wallet.signMessage(wallet.address)
	const payloadBytes = new TextEncoder().encode(dataUrl)
	const totalSize = payloadBytes.length
	const statusParams = new URLSearchParams({ hash: fragmentHash, wallet: wallet.address, signMessage })
	const statusResponse = await fetch(`${IPFS_API}/storageFragmentChunkStatus?${statusParams}`, { signal })
	const status = await statusResponse.json().catch(() => null) as { ok?: boolean; complete?: boolean; received?: number; totalSize?: number | null; error?: string } | null
	const directUpload = async (): Promise<string> => {
		if (dataUrl.length > FILE_DIRECT_UPLOAD_MAX_DATA_URL_CHARS) {
			throw new Error(status?.error || `File upload status failed (${statusResponse.status})`)
		}
		const directResponse = await fetch(`${IPFS_API}/storageFragment`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ wallet: wallet.address, signMessage, image: dataUrl }),
			signal,
		})
		const directBody = await directResponse.json().catch(() => null) as { error?: string } | null
		if (!directResponse.ok || directBody?.error) {
			throw new Error(directBody?.error || `File direct upload failed (${directResponse.status})`)
		}
		onProgress?.(1)
		return fragmentHash
	}
	if (!statusResponse.ok || !status?.ok) {
		if (statusResponse.status >= 500) return directUpload()
		throw new Error(status?.error || `File upload status failed (${statusResponse.status})`)
	}
	if (status.complete) { onProgress?.(1); return fragmentHash }
	if (status.totalSize != null && status.totalSize !== totalSize) throw new Error('File upload resume conflict. Please choose the files again.')
	let offset = Math.min(Math.max(0, status.received ?? 0), totalSize)
	while (offset < totalSize) {
		if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError')
		const chunk = payloadBytes.subarray(offset, Math.min(offset + FILE_CHUNK_BYTES, totalSize))
		const form = new FormData()
		form.append('wallet', wallet.address)
		form.append('signMessage', signMessage)
		form.append('hash', fragmentHash)
		form.append('totalSize', String(totalSize))
		form.append('offset', String(offset))
		form.append('chunk', new Blob([chunk]), 'file-fragment.chunk')
		const response = await fetch(`${IPFS_API}/storageFragmentChunk`, { method: 'POST', body: form, signal })
		const result = await response.json().catch(() => null) as { ok?: boolean; received?: number; error?: string } | null
		if (!response.ok || !result?.ok) {
			if (response.status >= 500 && dataUrl.length <= FILE_DIRECT_UPLOAD_MAX_DATA_URL_CHARS) {
				return directUpload()
			}
			throw new Error(result?.error || `File upload failed (${response.status})`)
		}
		offset = Math.min(Number(result.received ?? offset + chunk.length), totalSize)
		onProgress?.(totalSize ? offset / totalSize : 1)
	}
	return fragmentHash
}

async function fetchEncryptedFragment(hash: string, signal?: AbortSignal): Promise<Uint8Array> {
	const response = await fetch(`${IPFS_API}/getFragment?hash=${encodeURIComponent(hash)}`, { signal })
	if (!response.ok) throw new Error('File attachment is unavailable.')
	const type = response.headers.get('content-type') || ''
	const text = type.includes('text') ? (await response.text()).trim() : ''
	return text.startsWith('data:') ? dataUrlToBytes(text) : new Uint8Array(await response.arrayBuffer())
}

export async function decryptChatFileManifest(manifest: ChatFileMessageManifest, signal?: AbortSignal): Promise<Map<string, Blob>> {
	const encrypted = await fetchEncryptedFragment(manifest.fragmentHash, signal)
	const key = await crypto.subtle.importKey('raw', base64ToBytes(manifest.key), 'AES-GCM', false, ['decrypt'])
	const zipped = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(manifest.iv) }, key, encrypted))
	const files = unzipSync(zipped)
	const result = new Map<string, Blob>()
	for (const entry of manifest.files) {
		const bytes = files[entry.name]
		if (bytes) {
			const mime = manifest.mediaKind === 'video'
				? (manifest.mime || 'video/mp4')
				: manifest.mediaKind === 'pdf'
					? (manifest.mime || 'application/pdf')
					: 'application/octet-stream'
			result.set(entry.name, new Blob([bytes], { type: mime }))
		}
	}
	if (manifest.previewName) {
		const previewBytes = files[manifest.previewName]
		if (previewBytes) {
			const previewMime = manifest.mediaKind === 'image'
				? (manifest.mime || 'image/jpeg')
				: 'image/jpeg'
			result.set(manifest.previewName, new Blob([previewBytes], { type: previewMime }))
		}
	}
	return result
}
