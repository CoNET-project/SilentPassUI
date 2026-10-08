import { ethers } from 'ethers'
import { USDC_BASE } from '../config/chainAddresses'

const BEAMIO_API = 'https://beamio.app'

export const RECEIVE_USDC_AUTH_QUERY = 'receiveUsdcAuth'
export const RECEIVE_USDC_AUTH_EVENT = 'beamioReceiveUsdcAuth'
/** Smart Wallet / contract account: external wallet already sent USDC via transfer. */
export const RECEIVE_USDC_TX_QUERY = 'receiveUsdcTx'
export const RECEIVE_USDC_TX_EVENT = 'beamioReceiveUsdcTx'

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
	| { ok: true; txHash?: string; alreadyUsed?: boolean }
	| { ok: false; error: string }

const AUTH_ALREADY_USED_RE = /already used|authorization is used|duplicate/i

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

/** secp256k1 — Coinbase often returns high-s / compact / EIP-155 v / unprefixed. */
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n
const SECP256K1_HALF_N = SECP256K1_N / 2n

function padHex64(hexNo0x: string): string | null {
	let h = hexNo0x.replace(/^0x/i, '').toLowerCase()
	if (!/^[0-9a-f]+$/.test(h) || h.length > 64) return null
	while (h.length < 64) h = '0' + h
	return h
}

function bytesToHex(bytes: ArrayLike<number>): string {
	let out = '0x'
	for (let i = 0; i < bytes.length; i++) {
		out += (bytes[i]! & 0xff).toString(16).padStart(2, '0')
	}
	return out
}

/** Map wallet v (0/1, 27/28, or EIP-155) → 27 | 28. */
function recoverV27(vNum: number): number | null {
	if (!Number.isFinite(vNum) || vNum < 0) return null
	const n = Math.trunc(vNum)
	if (n === 0 || n === 1) return 27 + n
	if (n === 27 || n === 28) return n
	if (n >= 35) return 27 + ((n - 35) % 2)
	return null
}

/** ERC-6492 magic suffix — Coinbase Smart Wallet wraps (≈1218 hex chars). */
const ERC6492_MAGIC_SUFFIX =
	'6492649264926492649264926492649264926492649264926492649264926492'

export function isErc6492SignatureHex(hex: string): boolean {
	const body = hex.replace(/^0x/i, '').toLowerCase()
	return body.length >= 192 + 64 && body.endsWith(ERC6492_MAGIC_SUFFIX)
}

/** Unwrap `abi.encode(factory, factoryCalldata, signature) || magic` → inner sig. */
export function unwrapErc6492Signature(hex: string): string | null {
	const body = hex.replace(/^0x/i, '').toLowerCase()
	if (!isErc6492SignatureHex(`0x${body}`)) return null
	const encoded = body.slice(0, -64)
	if (encoded.length < 192 || encoded.length % 2 !== 0) return null
	const sigOffset = Number.parseInt(encoded.slice(128, 192), 16)
	if (!Number.isFinite(sigOffset) || sigOffset < 96) return null
	const sigOffsetHex = sigOffset * 2
	if (sigOffsetHex + 64 > encoded.length) return null
	const sigLen = Number.parseInt(encoded.slice(sigOffsetHex, sigOffsetHex + 64), 16)
	if (!Number.isFinite(sigLen) || sigLen <= 0 || sigLen > 2048) return null
	const sigStart = sigOffsetHex + 64
	const sigEnd = sigStart + sigLen * 2
	if (sigEnd > encoded.length) return null
	const inner = encoded.slice(sigStart, sigEnd)
	if (inner.length !== sigLen * 2 || !/^[0-9a-f]+$/.test(inner)) return null
	return `0x${inner}`
}

/** ECDSA candidates from ERC-6492 (unwrap + trailing r||s||v; Coinbase nested blobs). */
export function ecdsaCandidatesFromErc6492(hex: string): string[] {
	const body = hex.replace(/^0x/i, '').toLowerCase()
	if (!body.endsWith(ERC6492_MAGIC_SUFFIX) || body.length < 192 + 64) return []
	const out: string[] = []
	const seen = new Set<string>()
	const push = (c: string | null) => {
		if (!c) return
		const n = c.toLowerCase()
		if (seen.has(n)) return
		seen.add(n)
		out.push(c.startsWith('0x') ? c : `0x${c}`)
	}
	push(unwrapErc6492Signature(hex))
	const encoded = body.slice(0, -64)
	if (encoded.length >= 130) {
		push(`0x${encoded.slice(-130)}`)
		push(`0x${encoded.slice(-128)}`)
	}
	const inner = unwrapErc6492Signature(hex)
	if (inner) {
		const ib = inner.replace(/^0x/i, '')
		if (ib.length > 130) {
			push(`0x${ib.slice(-130)}`)
			push(`0x${ib.slice(-128)}`)
		}
	}
	return out
}

function normalizePlainEcdsaHexBody(hexIn: string): string | null {
	let hex = hexIn.trim()
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
	} else if (body.length >= 132 && body.length <= 194 && body.length % 2 === 0) {
		/* Coinbase EIP-155 v (Base → 132+ hex). Leading-zero r is valid. */
		rHex = body.slice(0, 64)
		sBig = BigInt(`0x${body.slice(64, 128)}`)
		vNum = parseInt(body.slice(128), 16)
	} else {
		return null
	}
	const v27 = recoverV27(vNum)
	if (v27 == null) return null
	vNum = v27
	if (sBig <= 0n || sBig >= SECP256K1_N) return null
	if (BigInt(`0x${rHex}`) === 0n) return null
	if (sBig > SECP256K1_HALF_N) {
		sBig = SECP256K1_N - sBig
		vNum = vNum === 27 ? 28 : 27
	}
	const sHex = padHex64(sBig.toString(16))
	if (!sHex) return null
	return `0x${rHex.toLowerCase()}${sHex}${vNum === 28 ? '1c' : '1b'}`
}

function normalizeEcdsaHexBody(hexIn: string): string | null {
	let hex = hexIn.trim()
	if (!hex) return null
	if (!hex.startsWith('0x') && !hex.startsWith('0X')) hex = `0x${hex}`
	if (!/^0x[0-9a-fA-F]+$/.test(hex)) return null
	if (isErc6492SignatureHex(hex)) {
		for (const c of ecdsaCandidatesFromErc6492(hex)) {
			const n = normalizePlainEcdsaHexBody(c)
			if (n) return n
		}
		return null
	}
	return normalizePlainEcdsaHexBody(hex)
}

/** Normalize wallet sig → 0x + 130 hex low-s (independent of x402sdk). */
export function normalizeReceiveUsdcWalletSignature(raw: unknown): string | null {
	let candidate: unknown = raw
	if (candidate instanceof Uint8Array) {
		candidate = bytesToHex(candidate)
	} else if (ArrayBuffer.isView(candidate) && (candidate as ArrayBufferView).byteLength > 0) {
		const view = candidate as ArrayBufferView
		candidate = bytesToHex(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
	} else if (candidate instanceof ArrayBuffer) {
		candidate = bytesToHex(new Uint8Array(candidate))
	}
	if (candidate && typeof candidate === 'object') {
		const obj = candidate as Record<string, unknown>
		if (typeof obj.result === 'string') candidate = obj.result
		else if (typeof obj.signature === 'string') candidate = obj.signature
		else if (typeof obj.data === 'string') candidate = obj.data
		else if (
			obj.type === 'Buffer' &&
			Array.isArray(obj.data) &&
			obj.data.every((x) => typeof x === 'number')
		) {
			candidate = bytesToHex(obj.data as number[])
		} else if (Array.isArray(candidate) && typeof candidate[0] === 'string') {
			candidate = candidate[0]
		} else if (
			Array.isArray(candidate) &&
			candidate.length >= 65 &&
			candidate.every((x) => typeof x === 'number')
		) {
			candidate = bytesToHex(candidate as number[])
		} else if (
			typeof obj.r === 'string' &&
			typeof obj.s === 'string' &&
			(obj.v !== undefined || obj.yParity !== undefined)
		) {
			const vr = padHex64(obj.r)
			const vs = padHex64(obj.s)
			if (!vr || !vs) return null
			const recovered = recoverV27(Number(obj.v !== undefined ? obj.v : Number(obj.yParity) + 27))
			if (recovered == null) return null
			candidate = `0x${vr}${vs}${recovered === 28 ? '1c' : '1b'}`
		} else {
			return null
		}
	}
	if (typeof candidate !== 'string') return null
	return normalizeEcdsaHexBody(candidate)
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

function normalizeReceiveUsdcTxHash(raw: unknown): string | null {
	if (typeof raw !== 'string') return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	try {
		const decoded = decodeURIComponent(trimmed)
		const hex = decoded.startsWith('0x') || decoded.startsWith('0X') ? decoded : `0x${decoded}`
		return /^0x[0-9a-fA-F]{64}$/.test(hex) ? hex.toLowerCase() : null
	} catch {
		return /^0x[0-9a-fA-F]{64}$/.test(trimmed) ? trimmed.toLowerCase() : null
	}
}

export function readReceiveUsdcTxFromSearch(
	search: string = typeof window !== 'undefined' ? window.location.search : '',
): string | null {
	try {
		const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
		return normalizeReceiveUsdcTxHash(params.get(RECEIVE_USDC_TX_QUERY))
	} catch {
		return null
	}
}

export function stripReceiveUsdcTxFromUrl(): void {
	if (typeof window === 'undefined') return
	try {
		const url = new URL(window.location.href)
		if (!url.searchParams.has(RECEIVE_USDC_TX_QUERY)) return
		url.searchParams.delete(RECEIVE_USDC_TX_QUERY)
		window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
	} catch {
		/* ignore */
	}
}

const seenTxHashes = new Set<string>()

export function claimReceiveUsdcTxOnce(txHash: string): boolean {
	const key = txHash.toLowerCase()
	if (seenTxHashes.has(key)) return false
	seenTxHashes.add(key)
	return true
}

function readReceiveUsdcTxFromSessionStorage(): string | null {
	try {
		const raw = sessionStorage.getItem('beamio:receiveUsdcTx')
		if (!raw) return null
		sessionStorage.removeItem('beamio:receiveUsdcTx')
		return normalizeReceiveUsdcTxHash(raw)
	} catch {
		return null
	}
}

/** Smart Wallet handoff: `beamio://open?receiveUsdcTx=0x…` after eth_sendTransaction. */
export function subscribeReceiveUsdcTx(onTx: (txHash: string) => void): () => void {
	const deliver = (txHash: string | null) => {
		if (!txHash) return
		if (!claimReceiveUsdcTxOnce(txHash)) return
		onTx(txHash)
	}

	const fromUrl = readReceiveUsdcTxFromSearch()
	if (fromUrl) {
		stripReceiveUsdcTxFromUrl()
		queueMicrotask(() => deliver(fromUrl))
	} else {
		const fromSession = readReceiveUsdcTxFromSessionStorage()
		if (fromSession) queueMicrotask(() => deliver(fromSession))
	}

	const onEvent = (ev: Event) => {
		const detail = (ev as CustomEvent<unknown>).detail
		deliver(normalizeReceiveUsdcTxHash(detail))
	}
	window.addEventListener(RECEIVE_USDC_TX_EVENT, onEvent as EventListener)

	const onHashOrPop = () => {
		const txHash = readReceiveUsdcTxFromSearch()
		if (!txHash) return
		stripReceiveUsdcTxFromUrl()
		deliver(txHash)
	}
	window.addEventListener('popstate', onHashOrPop)
	window.addEventListener('beamio:deeplink', onHashOrPop as EventListener)

	return () => {
		window.removeEventListener(RECEIVE_USDC_TX_EVENT, onEvent as EventListener)
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
			alreadyUsed?: boolean
			error?: string
			message?: string
		} | null
		if (!res.ok || !body?.success) {
			const err =
				(typeof body?.error === 'string' && body.error) ||
				(typeof body?.message === 'string' && body.message) ||
				`Request failed (${res.status})`
			if (AUTH_ALREADY_USED_RE.test(err)) return { ok: true, alreadyUsed: true }
			return { ok: false, error: err }
		}
		if (body.alreadyUsed) return { ok: true, alreadyUsed: true }
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
