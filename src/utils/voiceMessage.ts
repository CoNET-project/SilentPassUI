import { ethers } from 'ethers'

export const VOICE_MESSAGE_TYPE = 'voice_message_v1' as const
export const VOICE_CHUNK_BYTES = 512 * 1024
export const VOICE_MAX_DATA_URL_CHARS = 240 * 1024 * 1024
const IPFS_API = 'https://ipfs.conet.network/api'

export type VoiceMessageManifest = {
	type: typeof VOICE_MESSAGE_TYPE
	fragmentHash: string
	key: string
	iv: string
	mime: string
	durationMs: number
	sizeBytes: number
}

const bytesToBase64 = (bytes: Uint8Array): string => {
	let binary = ''
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
	}
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
	if (comma < 0) throw new Error('Invalid encrypted voice payload')
	return base64ToBytes(dataUrl.slice(comma + 1))
}

export async function encryptVoiceBlob(blob: Blob, durationMs: number): Promise<{
	dataUrl: string
	manifest: Omit<VoiceMessageManifest, 'fragmentHash'>
}> {
	const plaintext = new Uint8Array(await blob.arrayBuffer())
	const keyBytes = crypto.getRandomValues(new Uint8Array(32))
	const iv = crypto.getRandomValues(new Uint8Array(12))
	const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt'])
	const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext))
	const dataUrl = `data:application/octet-stream;base64,${bytesToBase64(encrypted)}`
	if (dataUrl.length > VOICE_MAX_DATA_URL_CHARS) {
		throw new Error('This voice message is too large to upload safely. Please record a shorter message.')
	}
	return {
		dataUrl,
		manifest: {
			type: VOICE_MESSAGE_TYPE,
			key: bytesToBase64(keyBytes),
			iv: bytesToBase64(iv),
			mime: blob.type || 'audio/webm',
			durationMs: Math.max(0, Math.round(durationMs)),
			sizeBytes: plaintext.byteLength,
		},
	}
}

/** Upload encrypted data in 512 KiB chunks; the server assembles the original Data URL. */
export async function uploadEncryptedVoiceDataUrl(
	privateKey: string,
	dataUrl: string,
	onProgress?: (fraction: number) => void,
): Promise<string> {
	const wallet = new ethers.Wallet(privateKey)
	const fragmentHash = ethers.keccak256(ethers.toUtf8Bytes(dataUrl))
	const signMessage = await wallet.signMessage(wallet.address)
	const payloadBytes = new TextEncoder().encode(dataUrl)
	const totalSize = payloadBytes.length
	const statusParams = new URLSearchParams({
		hash: fragmentHash,
		wallet: wallet.address,
		signMessage,
	})
	const statusResponse = await fetch(
		`${IPFS_API}/storageFragmentChunkStatus?${statusParams.toString()}`,
	)
	const status = (await statusResponse.json().catch(() => null)) as {
		ok?: boolean
		complete?: boolean
		received?: number
		totalSize?: number | null
		error?: string
	} | null
	if (!statusResponse.ok || !status?.ok) {
		throw new Error(status?.error || `Voice upload status failed (${statusResponse.status})`)
	}
	if (status.complete) {
		onProgress?.(1)
		return fragmentHash
	}
	if (status.totalSize != null && status.totalSize !== totalSize) {
		throw new Error('Voice upload resume conflict. Please record again.')
	}

	let offset = Math.min(Math.max(0, status.received ?? 0), totalSize)
	while (offset < totalSize) {
		const chunk = payloadBytes.subarray(offset, Math.min(offset + VOICE_CHUNK_BYTES, totalSize))
		const form = new FormData()
		form.append('wallet', wallet.address)
		form.append('signMessage', signMessage)
		form.append('hash', fragmentHash)
		form.append('totalSize', String(totalSize))
		form.append('offset', String(offset))
		form.append('chunk', new Blob([chunk]), 'voice-fragment.chunk')
		const response = await fetch(`${IPFS_API}/storageFragmentChunk`, {
			method: 'POST',
			body: form,
		})
		const result = (await response.json().catch(() => null)) as {
			ok?: boolean
			received?: number
			error?: string
		} | null
		if (!response.ok || !result?.ok) {
			throw new Error(result?.error || `Voice upload failed (${response.status})`)
		}
		offset = Math.min(Number(result.received ?? offset + chunk.length), totalSize)
		onProgress?.(totalSize > 0 ? offset / totalSize : 1)
	}
	return fragmentHash
}

export async function decryptVoiceFragment(
	manifest: VoiceMessageManifest,
): Promise<Blob> {
	const response = await fetch(`${IPFS_API}/getFragment?hash=${encodeURIComponent(manifest.fragmentHash)}`, {
		method: 'GET',
		cache: 'no-store',
	})
	if (!response.ok) throw new Error('Voice message is unavailable')
	const contentType = response.headers.get('content-type') || ''
	const encryptedDataUrl = contentType.includes('text') ? (await response.text()).trim() : ''
	const encrypted = encryptedDataUrl.startsWith('data:')
		? dataUrlToBytes(encryptedDataUrl)
		: new Uint8Array(await response.arrayBuffer())
	const key = await crypto.subtle.importKey('raw', base64ToBytes(manifest.key), 'AES-GCM', false, ['decrypt'])
	const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(manifest.iv) }, key, encrypted)
	return new Blob([plaintext], { type: manifest.mime || 'audio/webm' })
}
