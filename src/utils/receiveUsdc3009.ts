import { ethers } from 'ethers'
import { USDC_BASE } from '../config/chainAddresses'

const BEAMIO_API = 'https://beamio.app'

export const RECEIVE_USDC_AUTH_QUERY = 'receiveUsdcAuth'
export const RECEIVE_USDC_AUTH_EVENT = 'beamioReceiveUsdcAuth'

export type ReceiveUsdc3009Auth = {
	from: string
	to: string
	value: string
	validAfter: string
	validBefore: string
	nonce: string
	signature: string
}

export type ReceiveUsdc3009SubmitResult =
	| { ok: true; txHash: string }
	| { ok: false; error: string }

function base64UrlToUtf8(raw: string): string {
	const padded = raw.replace(/-/g, '+').replace(/_/g, '/')
	const padLen = (4 - (padded.length % 4)) % 4
	const b64 = padded + '='.repeat(padLen)
	const bin = atob(b64)
	const bytes = new Uint8Array(bin.length)
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
	return new TextDecoder().decode(bytes)
}

export function encodeReceiveUsdcAuthPayload(auth: ReceiveUsdc3009Auth): string {
	const json = JSON.stringify(auth)
	const bytes = new TextEncoder().encode(json)
	let bin = ''
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/** secp256k1 — Coinbase often returns high-s / compact / unprefixed. */
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n
const SECP256K1_HALF_N = SECP256K1_N / 2n

function padHex64(hexNo0x: string): string | null {
	let h = hexNo0x.replace(/^0x/i, '').toLowerCase()
	if (!/^[0-9a-f]+$/.test(h) || h.length > 64) return null
	while (h.length < 64) h = '0' + h
	return h
}

/** Normalize wallet sig → 0x + 130 hex low-s (independent of x402sdk). */
export function normalizeReceiveUsdcWalletSignature(raw: unknown): string | null {
	let candidate: unknown = raw
	if (candidate && typeof candidate === 'object') {
		const obj = candidate as Record<string, unknown>
		if (typeof obj.result === 'string') candidate = obj.result
		else if (typeof obj.signature === 'string') candidate = obj.signature
		else if (typeof obj.data === 'string') candidate = obj.data
		else if (Array.isArray(candidate) && typeof candidate[0] === 'string') candidate = candidate[0]
		else if (
			typeof obj.r === 'string' &&
			typeof obj.s === 'string' &&
			(obj.v !== undefined || obj.yParity !== undefined)
		) {
			const vr = padHex64(obj.r)
			const vs = padHex64(obj.s)
			if (!vr || !vs) return null
			let vv = Number(obj.v !== undefined ? obj.v : Number(obj.yParity) + 27)
			if (vv === 0 || vv === 1) vv += 27
			candidate = `0x${vr}${vs}${vv === 28 ? '1c' : '1b'}`
		} else {
			return null
		}
	}
	if (typeof candidate !== 'string') return null
	let hex = candidate.trim()
	if (!hex) return null
	if (!hex.startsWith('0x') && !hex.startsWith('0X')) hex = `0x${hex}`
	if (!/^0x[0-9a-fA-F]+$/.test(hex)) return null
	const body = hex.slice(2)
	let rHex: string
	let sBig: bigint
	let vNum: number
	if (body.length === 128) {
		rHex = body.slice(0, 64)
		const yParityAndS = BigInt(`0x${body.slice(64, 128)}`)
		const yParity = Number((yParityAndS >> 255n) & 1n)
		sBig = yParityAndS & ((1n << 255n) - 1n)
		vNum = 27 + yParity
	} else if (body.length === 130) {
		rHex = body.slice(0, 64)
		sBig = BigInt(`0x${body.slice(64, 128)}`)
		vNum = parseInt(body.slice(128, 130), 16)
		if (vNum === 0 || vNum === 1) vNum += 27
	} else {
		return null
	}
	if (vNum !== 27 && vNum !== 28) return null
	if (sBig <= 0n || sBig >= SECP256K1_N) return null
	if (sBig > SECP256K1_HALF_N) {
		sBig = SECP256K1_N - sBig
		vNum = vNum === 27 ? 28 : 27
	}
	const sHex = padHex64(sBig.toString(16))
	if (!sHex) return null
	return `0x${rHex.toLowerCase()}${sHex}${vNum === 28 ? '1c' : '1b'}`
}

export function parseReceiveUsdcAuthPayload(raw: string): ReceiveUsdc3009Auth | null {
	const trimmed = raw?.trim()
	if (!trimmed) return null
	try {
		let jsonText = trimmed
		if (!trimmed.startsWith('{')) {
			jsonText = base64UrlToUtf8(decodeURIComponent(trimmed))
		}
		const obj = JSON.parse(jsonText) as Record<string, unknown>
		const from = typeof obj.from === 'string' ? obj.from.trim() : ''
		const to = typeof obj.to === 'string' ? obj.to.trim() : ''
		const value = typeof obj.value === 'string' ? obj.value.trim() : String(obj.value ?? '')
		const validAfter =
			typeof obj.validAfter === 'string' ? obj.validAfter.trim() : String(obj.validAfter ?? '0')
		const validBefore =
			typeof obj.validBefore === 'string' ? obj.validBefore.trim() : String(obj.validBefore ?? '')
		const nonce = typeof obj.nonce === 'string' ? obj.nonce.trim() : ''
		const signature = normalizeReceiveUsdcWalletSignature(obj.signature)
		if (!ethers.isAddress(from) || !ethers.isAddress(to)) return null
		if (!/^\d+$/.test(value) || value === '0') return null
		if (!/^\d+$/.test(validAfter) || !/^\d+$/.test(validBefore)) return null
		if (!/^0x[0-9a-fA-F]{64}$/.test(nonce)) return null
		if (!signature) return null
		return {
			from: ethers.getAddress(from),
			to: ethers.getAddress(to),
			value,
			validAfter,
			validBefore,
			nonce: nonce.toLowerCase(),
			signature,
		}
	} catch {
		return null
	}
}

export function readReceiveUsdcAuthFromSearch(
	search: string = typeof window !== 'undefined' ? window.location.search : '',
): ReceiveUsdc3009Auth | null {
	try {
		const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
		const raw = params.get(RECEIVE_USDC_AUTH_QUERY)
		return raw ? parseReceiveUsdcAuthPayload(raw) : null
	} catch {
		return null
	}
}

export function stripReceiveUsdcAuthFromUrl(): void {
	if (typeof window === 'undefined') return
	try {
		const url = new URL(window.location.href)
		if (!url.searchParams.has(RECEIVE_USDC_AUTH_QUERY)) return
		url.searchParams.delete(RECEIVE_USDC_AUTH_QUERY)
		const next = `${url.pathname}${url.search}${url.hash}`
		window.history.replaceState({}, '', next)
	} catch {
		/* ignore */
	}
}

const seenNonces = new Set<string>()

export function claimReceiveUsdcAuthOnce(auth: ReceiveUsdc3009Auth): boolean {
	const key = `${auth.nonce.toLowerCase()}:${auth.signature.toLowerCase()}`
	if (seenNonces.has(key)) return false
	seenNonces.add(key)
	return true
}

function readReceiveUsdcAuthFromSessionStorage(): ReceiveUsdc3009Auth | null {
	try {
		const raw = sessionStorage.getItem('beamio:receiveUsdcAuth')
		if (!raw) return null
		sessionStorage.removeItem('beamio:receiveUsdcAuth')
		return parseReceiveUsdcAuthPayload(raw)
	} catch {
		return null
	}
}

export function subscribeReceiveUsdcAuth(
	onAuth: (auth: ReceiveUsdc3009Auth) => void,
): () => void {
	const deliver = (auth: ReceiveUsdc3009Auth | null) => {
		if (!auth) return
		if (!claimReceiveUsdcAuthOnce(auth)) return
		onAuth(auth)
	}

	const fromUrl = readReceiveUsdcAuthFromSearch()
	if (fromUrl) {
		stripReceiveUsdcAuthFromUrl()
		queueMicrotask(() => deliver(fromUrl))
	} else {
		const fromSession = readReceiveUsdcAuthFromSessionStorage()
		if (fromSession) {
			queueMicrotask(() => deliver(fromSession))
		}
	}

	const onEvent = (ev: Event) => {
		const detail = (ev as CustomEvent<unknown>).detail
		if (typeof detail === 'string') {
			deliver(parseReceiveUsdcAuthPayload(detail))
			return
		}
		if (detail && typeof detail === 'object') {
			deliver(parseReceiveUsdcAuthPayload(JSON.stringify(detail)))
		}
	}
	window.addEventListener(RECEIVE_USDC_AUTH_EVENT, onEvent as EventListener)

	const onHashOrPop = () => {
		const auth = readReceiveUsdcAuthFromSearch()
		if (!auth) return
		stripReceiveUsdcAuthFromUrl()
		deliver(auth)
	}
	window.addEventListener('popstate', onHashOrPop)
	window.addEventListener('beamio:deeplink', onHashOrPop as EventListener)

	return () => {
		window.removeEventListener(RECEIVE_USDC_AUTH_EVENT, onEvent as EventListener)
		window.removeEventListener('popstate', onHashOrPop)
		window.removeEventListener('beamio:deeplink', onHashOrPop as EventListener)
	}
}

export async function submitReceiveUsdc3009(
	auth: ReceiveUsdc3009Auth,
): Promise<ReceiveUsdc3009SubmitResult> {
	try {
		const res = await fetch(`${BEAMIO_API}/api/receiveUsdc3009`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: auth.from,
				to: auth.to,
				value: auth.value,
				validAfter: auth.validAfter,
				validBefore: auth.validBefore,
				nonce: auth.nonce,
				signature: auth.signature,
				token: USDC_BASE,
			}),
		})
		const body = (await res.json().catch(() => null)) as {
			success?: boolean
			txHash?: string
			hash?: string
			error?: string
			message?: string
		} | null
		if (!res.ok || !body?.success) {
			const err =
				(typeof body?.error === 'string' && body.error) ||
				(typeof body?.message === 'string' && body.message) ||
				`Request failed (${res.status})`
			return { ok: false, error: err }
		}
		const txHash =
			(typeof body.txHash === 'string' && body.txHash) ||
			(typeof body.hash === 'string' && body.hash) ||
			''
		if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
			return { ok: false, error: 'Missing transaction hash' }
		}
		return { ok: true, txHash }
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Network error'
		return { ok: false, error: msg }
	}
}

/** EIP-712 typed data for Base USDC TransferWithAuthorization (browser inject path). */
export function buildReceiveUsdc3009TypedData(params: {
	from: string
	to: string
	value: string
	validAfter: string
	validBefore: string
	nonce: string
	tokenName?: string
	tokenVersion?: string
}) {
	return {
		types: {
			TransferWithAuthorization: [
				{ name: 'from', type: 'address' },
				{ name: 'to', type: 'address' },
				{ name: 'value', type: 'uint256' },
				{ name: 'validAfter', type: 'uint256' },
				{ name: 'validBefore', type: 'uint256' },
				{ name: 'nonce', type: 'bytes32' },
			],
		},
		domain: {
			name: params.tokenName || 'USD Coin',
			version: params.tokenVersion || '2',
			chainId: 8453,
			verifyingContract: USDC_BASE,
		},
		primaryType: 'TransferWithAuthorization' as const,
		message: {
			from: ethers.getAddress(params.from),
			to: ethers.getAddress(params.to),
			value: params.value,
			validAfter: params.validAfter,
			validBefore: params.validBefore,
			nonce: params.nonce,
		},
	}
}
