import { ethers } from 'ethers'
import {
	BASE_MAINNET_CHAIN_ID,
	USDC_BASE,
} from '../config/chainAddresses'
import {
	type NativeInstalledAppQuery,
	hasNativeWalletListApi,
	isCashTreesNativeWebView,
	listInstalledWalletAppsFromNative,
	openExternalUrl,
} from './cashTreesNativeNfc'
import {
	type InjectedWalletChoice,
	type InjectedWalletChoiceId,
	findInjectedWalletByBrand,
	listInstalledInjectedWallets,
	readBrandNamespaceProviderOnGesture,
	requestEip6963ProvidersNow,
	subscribeInstalledInjectedWallets,
} from './mobileWalletApps'
import {
	type ReceiveUsdc3009Auth,
	RECEIVE_USDC_SMART_WALLET_SIG_HINT,
	buildReceiveUsdc3009TypedData,
	isErc6492SignatureHex,
	normalizeReceiveUsdcWalletSignature,
} from './receiveUsdc3009'

export type ReceiveWalletAppRow = {
	id: string
	brandId: InjectedWalletChoiceId
	label: string
	iconUrl?: string
	brandLetter: string
	brandBg: string
	brandFg: string
	provider?: InjectedWalletChoice['provider']
}

const BRAND_CHROME: Record<
	InjectedWalletChoiceId,
	{ letter: string; bg: string; fg: string }
> = {
	metamask: { letter: 'M', bg: '#E17726', fg: '#ffffff' },
	okx: { letter: 'O', bg: '#111111', fg: '#ffffff' },
	base: { letter: 'C', bg: '#0052FF', fg: '#ffffff' },
	tp: { letter: 'T', bg: '#2980FE', fg: '#ffffff' },
	phantom: { letter: 'P', bg: '#AB9FF2', fg: '#111111' },
	trust: { letter: 'T', bg: '#3375BB', fg: '#ffffff' },
	other: { letter: 'W', bg: '#334155', fg: '#ffffff' },
}

/** PWA catalog for native install probe. Native returns only installed `id`s. */
export const RECEIVE_WALLET_NATIVE_QUERIES: NativeInstalledAppQuery[] = [
	{ id: 'metamask', schemes: ['metamask'], packages: ['io.metamask'] },
	{
		id: 'base',
		schemes: ['cbwallet', 'coinbase', 'base'],
		packages: ['org.toshi', 'com.coinbase.wallet'],
	},
	{
		id: 'okx',
		schemes: ['okx', 'okex'],
		packages: ['com.okinc.okex.gp', 'com.okinc.okex', 'com.okex.okex', 'com.okx.wallet'],
	},
	{ id: 'tp', schemes: ['tpdapp', 'tpoutside'], packages: ['vip.mytokenpocket'] },
	{ id: 'phantom', schemes: ['phantom'], packages: ['app.phantom'] },
	{ id: 'trust', schemes: ['trust'], packages: ['com.wallet.crypto.trustapp'] },
]

const RECEIVE_WALLET_CATALOG_IDS = new Set(RECEIVE_WALLET_NATIVE_QUERIES.map((q) => q.id))

const RECEIVE_WALLET_BRAND_ORDER: InjectedWalletChoiceId[] = [
	'phantom',
	'metamask',
	'okx',
	'trust',
	'base',
	'tp',
]

const LABEL_FOR_BRAND: Record<InjectedWalletChoiceId, string> = {
	metamask: 'MetaMask',
	okx: 'OKX Wallet',
	base: 'Coinbase Wallet',
	tp: 'TokenPocket',
	phantom: 'Phantom',
	trust: 'Trust Wallet',
	other: 'Wallet',
}

export type ReceiveWalletPickerId = InjectedWalletChoiceId

/** True when Receive-from-wallet must use native install probe, not browser extensions. */
export function isReceiveFromWalletNativeShell(): boolean {
	return isCashTreesNativeWebView() || hasNativeWalletListApi()
}

function brandChrome(id: InjectedWalletChoiceId) {
	return BRAND_CHROME[id] ?? BRAND_CHROME.other
}

export function receiveWalletRowFromBrand(
	brandId: InjectedWalletChoiceId,
	overrides?: Partial<ReceiveWalletAppRow>,
): ReceiveWalletAppRow {
	const chrome = brandChrome(brandId)
	return {
		id: brandId,
		brandId,
		label: LABEL_FOR_BRAND[brandId] ?? 'Wallet',
		brandLetter: chrome.letter,
		brandBg: chrome.bg,
		brandFg: chrome.fg,
		...overrides,
	}
}

export function mergeReceiveWalletAppRows(
	injected: InjectedWalletChoice[],
	installedMobileIds: InjectedWalletChoiceId[],
): ReceiveWalletAppRow[] {
	const byId = new Map<string, ReceiveWalletAppRow>()

	for (const choice of injected) {
		const chrome = brandChrome(choice.id)
		byId.set(choice.rdns || choice.id, {
			id: choice.rdns || choice.id,
			brandId: choice.id,
			label: choice.label,
			iconUrl: choice.iconUrl,
			brandLetter: chrome.letter,
			brandBg: chrome.bg,
			brandFg: chrome.fg,
			provider: choice.provider,
		})
	}

	for (const brandId of installedMobileIds) {
		if (brandId === 'other') continue
		if ([...byId.values()].some((row) => row.brandId === brandId)) continue
		byId.set(brandId, receiveWalletRowFromBrand(brandId))
	}

	const rows = [...byId.values()]
	const rank = (id: InjectedWalletChoiceId) => {
		const i = RECEIVE_WALLET_BRAND_ORDER.indexOf(id)
		return i === -1 ? 99 : i
	}
	rows.sort((a, b) => rank(a.brandId) - rank(b.brandId) || a.label.localeCompare(b.label))
	return rows
}

/** Native shell: only wallets the host confirmed as installed. Never invent missing brands. */
export function nativeReceiveWalletPickerRows(
	installed: ReceiveWalletAppRow[],
): ReceiveWalletAppRow[] {
	return installed.filter((row) => row.brandId !== 'other')
}

/**
 * Shell vs browser — pick one path, never mix.
 * 1. Native WebView → queryInstalledApps / listInstalledWalletApps only.
 * 2. Ordinary browser → only EIP-6963 / injected extensions that are actually present.
 */
export function subscribeReceiveWalletApps(
	onRows: (rows: ReceiveWalletAppRow[]) => void,
): () => void {
	let cancelled = false
	let lastInjected: InjectedWalletChoice[] = []
	let lastMobile: InjectedWalletChoiceId[] = []
	let unsubInjected: (() => void) | undefined

	const publish = () => {
		if (cancelled) return
		onRows(mergeReceiveWalletAppRows(lastInjected, lastMobile))
	}

	if (isReceiveFromWalletNativeShell()) {
		void (async () => {
			const nativeIds = await listInstalledWalletAppsFromNative(RECEIVE_WALLET_NATIVE_QUERIES)
			if (cancelled) return
			if (nativeIds == null) return
			lastMobile = nativeIds.filter(
				(id): id is InjectedWalletChoiceId => RECEIVE_WALLET_CATALOG_IDS.has(id),
			)
			publish()
		})()
		return () => {
			cancelled = true
		}
	}

	lastInjected = listInstalledInjectedWallets()
	unsubInjected = subscribeInstalledInjectedWallets((choices) => {
		lastInjected = choices
		publish()
	})
	publish()

	return () => {
		cancelled = true
		unsubInjected?.()
	}
}

const BASE_CHAIN_HEX = '0x2105'

export function parseReceiveUsdcAmount6(
	raw: string,
): { ok: true; amount6: bigint } | { ok: false; error: string } {
	const trimmed = raw.trim().replace(/,/g, '')
	if (!trimmed) return { ok: false, error: 'Enter a USDC amount' }
	if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
		return { ok: false, error: 'Enter a valid USDC amount' }
	}
	try {
		const amount6 = ethers.parseUnits(trimmed, 6)
		if (amount6 <= 0n) return { ok: false, error: 'Enter a USDC amount' }
		return { ok: true, amount6 }
	} catch {
		return { ok: false, error: 'Enter a valid USDC amount' }
	}
}

/**
 * Live HTTPS handoff: third-party wallet signs EIP-3009 TransferWithAuthorization
 * (to = Beamio EOA), then redirects `beamio://open?receiveUsdcAuth=…`.
 * Always use the production `/app/` host — embedded OTA origins are not public HTTPS.
 */
const RECEIVE_WALLET_SEND_PAGE = 'https://beamio.app/app/receive-wallet-send.html'

/** Cache-bust Coinbase in-app WebView (stale handoff showed old Invalid-sig UX). */
function receiveWalletHandoffPageUrl(eoa: string, amount6?: bigint): string {
	const params = new URLSearchParams({ to: eoa })
	if (amount6 != null && amount6 > 0n) {
		params.set('amount6', amount6.toString())
	}
	/* Keep in sync with package.json version after each OTA bump. */
	params.set('v', '0.52.811')
	return `${RECEIVE_WALLET_SEND_PAGE}?${params.toString()}`
}

/**
 * Coinbase Wallet / Base app open URI.
 *
 * Never open raw EIP-681 (`ethereum:…`) for this brand: on iOS several apps (e.g. Tangem)
 * register the `ethereum` scheme, so `UIApplication.open` can prompt
 * “Beamio wants to open Tangem” even when the user tapped Coinbase Wallet.
 *
 * Never wrap EIP-681 in `go.cb-w.com/dapp?cb_url=` — that endpoint only loads **https**
 * pages and spins forever on `ethereum:`.
 *
 * Open Coinbase’s dapp browser on our HTTPS handoff page for EIP-3009 offline sign.
 */
function coinbaseWalletSendUrl(eoa: string, amount6?: bigint): string {
	const pageUrl = receiveWalletHandoffPageUrl(eoa, amount6)
	return `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(pageUrl)}`
}

/**
 * Native deep link / HTTPS open URL for Receive-from-wallet.
 * All brands use the EIP-3009 HTTPS handoff (Coinbase via go.cb-w.com).
 * Never raw `ethereum:` EIP-681 (Tangem steals that scheme).
 */
function receiveWalletNativeSchemeUrlByBrand(
	brandId: InjectedWalletChoiceId,
	eoa: string,
	amount6?: bigint,
): string {
	const handoff = receiveWalletHandoffPageUrl(eoa, amount6)
	switch (brandId) {
		case 'base':
			return coinbaseWalletSendUrl(eoa, amount6)
		case 'metamask':
			return `https://metamask.app.link/dapp/${handoff.replace(/^https:\/\//i, '')}`
		case 'okx':
			return `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(handoff)}`
		case 'tp':
			return `tpdapp://open?params=${encodeURIComponent(JSON.stringify({
				url: handoff,
				chain: 'ETH',
				source: 'beamio',
			}))}`
		case 'phantom':
			return `https://phantom.app/ul/browse/${encodeURIComponent(handoff)}`
		case 'trust':
			return `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(handoff)}`
		default:
			return handoff
	}
}

function receiveWalletNativeSchemeUrl(
	row: ReceiveWalletAppRow,
	eoa: string,
	amount6?: bigint,
): string {
	return receiveWalletNativeSchemeUrlByBrand(row.brandId, eoa, amount6)
}

export function receiveWalletHttpsOpenUrl(
	row: ReceiveWalletAppRow,
	eoa: string,
	amount6?: bigint,
): string {
	switch (row.brandId) {
		case 'base':
			return coinbaseWalletSendUrl(eoa, amount6)
		default:
			return receiveWalletHandoffPageUrl(eoa, amount6)
	}
}

function injectedWalletErrorMessage(err: unknown): string {
	const rec = err as { code?: number | string; message?: string } | null
	const code = rec?.code
	const msg = typeof rec?.message === 'string' ? rec.message : ''
	if (code === 4001 || /user rejected|user denied|rejected the request/i.test(msg)) {
		return 'Request rejected in wallet'
	}
	if (code === -32002 || /already pending/i.test(msg)) {
		return 'Check your wallet extension — a request is already pending'
	}
	return 'Could not open this wallet'
}

function isUserRejectedRequest(err: unknown): boolean {
	const rec = err as { code?: number | string; message?: string } | null
	const code = rec?.code
	const msg = typeof rec?.message === 'string' ? rec.message : ''
	return code === 4001 || /user rejected|user denied|rejected the request/i.test(msg)
}

function isOkxInjectedProvider(provider: InjectedWalletChoice['provider']): boolean {
	return Boolean(provider.isOkxWallet || provider.isOKExWallet)
}

function resolveBrowserInjectedProvider(
	row: ReceiveWalletAppRow,
): InjectedWalletChoice['provider'] | null {
	requestEip6963ProvidersNow()
	// Click-time namespace first: EIP-6963 cache can hold a stale/other extension
	// provider that overwrites the wallet the user actually unlocked (MetaMask /
	// OKX / Trust / …). Gesture-time `window.ethereum` / brand namespace is the
	// unlockable surface for ordinary browser extensions.
	const fromNamespace = readBrandNamespaceProviderOnGesture(row.brandId)
	if (fromNamespace && typeof fromNamespace.request === 'function') {
		return fromNamespace
	}
	if (row.provider && typeof row.provider.request === 'function') {
		return row.provider
	}
	const live = findInjectedWalletByBrand(row.brandId)
	if (live?.provider && typeof live.provider.request === 'function') {
		return live.provider
	}
	return null
}

async function requestAccountsUnlockingExtension(
	provider: InjectedWalletChoice['provider'],
	brandId?: InjectedWalletChoiceId,
): Promise<unknown> {
	const isOkx = brandId === 'okx' || isOkxInjectedProvider(provider)
	if (!isOkx) {
		try {
			await provider.request({
				method: 'wallet_requestPermissions',
				params: [{ eth_accounts: {} }],
			})
		} catch (err) {
			if (isUserRejectedRequest(err)) throw err
		}
		return provider.request({ method: 'eth_requestAccounts', params: [] })
	}
	return provider.request({ method: 'eth_requestAccounts' })
}

function firstAccountFromRequest(accounts: unknown): string {
	if (!Array.isArray(accounts) || typeof accounts[0] !== 'string' || !ethers.isAddress(accounts[0])) {
		return ''
	}
	return ethers.getAddress(accounts[0])
}

async function connectAndSwitchBaseOnInjected(
	provider: InjectedWalletChoice['provider'],
	brandId?: InjectedWalletChoiceId,
): Promise<string> {
	const accounts = await requestAccountsUnlockingExtension(provider, brandId)
	const from = firstAccountFromRequest(accounts)
	if (!from) {
		throw new Error('Could not open this wallet')
	}

	let chainId = ''
	try {
		const raw = await provider.request({ method: 'eth_chainId' })
		chainId = typeof raw === 'string' ? raw.toLowerCase() : ''
	} catch {
		chainId = ''
	}

	if (chainId !== BASE_CHAIN_HEX) {
		try {
			await provider.request({
				method: 'wallet_switchEthereumChain',
				params: [{ chainId: BASE_CHAIN_HEX }],
			})
		} catch (err) {
			const code = (err as { code?: number })?.code
			if (code === 4902) {
				await provider.request({
					method: 'wallet_addEthereumChain',
					params: [
						{
							chainId: BASE_CHAIN_HEX,
							chainName: 'Base',
							nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
							rpcUrls: ['https://base-rpc.conet.network'],
							blockExplorerUrls: ['https://basescan.org'],
						},
					],
				})
			} else {
				throw err
			}
		}
	}

	return from
}

async function readUsdcEip712NameVersion(
	provider: InjectedWalletChoice['provider'],
): Promise<{ name: string; version: string }> {
	let name = 'USD Coin'
	let version = '2'
	try {
		const nameHex = await provider.request({
			method: 'eth_call',
			params: [{ to: USDC_BASE, data: '0x06fdde03' }, 'latest'],
		})
		if (typeof nameHex === 'string' && nameHex.length > 2) {
			name = String(ethers.AbiCoder.defaultAbiCoder().decode(['string'], nameHex)[0] || name)
		}
	} catch {
		/* keep default */
	}
	try {
		const versionHex = await provider.request({
			method: 'eth_call',
			params: [{ to: USDC_BASE, data: '0x54fd4d50' }, 'latest'],
		})
		if (typeof versionHex === 'string' && versionHex.length > 2) {
			version = String(ethers.AbiCoder.defaultAbiCoder().decode(['string'], versionHex)[0] || version)
		}
	} catch {
		/* keep default */
	}
	return { name, version }
}

/** Browser-injected wallet: EIP-3009 eth_signTypedData_v4 (no eth_sendTransaction). */
async function signUsdc3009FromInjected(
	provider: InjectedWalletChoice['provider'],
	from: string,
	to: string,
	amount6: bigint,
): Promise<ReceiveUsdc3009Auth> {
	const { name, version } = await readUsdcEip712NameVersion(provider)
	const validAfter = '0'
	const validBefore = String(Math.floor(Date.now() / 1000) + 3600)
	const nonce = ethers.hexlify(ethers.randomBytes(32))
	const value = amount6.toString()
	const toChecksum = ethers.getAddress(to)
	const typed = buildReceiveUsdc3009TypedData({
		from,
		to: toChecksum,
		value,
		validAfter,
		validBefore,
		nonce,
		tokenName: name,
		tokenVersion: version,
	})
	const typedWithDomain = {
		...typed,
		types: {
			EIP712Domain: [
				{ name: 'name', type: 'string' },
				{ name: 'version', type: 'string' },
				{ name: 'chainId', type: 'uint256' },
				{ name: 'verifyingContract', type: 'address' },
			],
			TransferWithAuthorization: typed.types.TransferWithAuthorization,
		},
	}
	/*
	 * One primary eth_signTypedData_v4 prompt. Extra strategies reopen Coinbase's
	 * sign sheet after the user already approved. Fallback only when the first
	 * request throws before a signature is returned (never after a raw response).
	 */
	let raw: unknown
	try {
		raw = await provider.request({
			method: 'eth_signTypedData_v4',
			params: [from, JSON.stringify(typed)],
		})
	} catch (firstErr) {
		if (isUserRejectedRequest(firstErr)) throw firstErr
		try {
			raw = await provider.request({
				method: 'eth_signTypedData_v4',
				params: [from, JSON.stringify(typedWithDomain)],
			})
		} catch (secondErr) {
			throw secondErr
		}
	}
	const signature = normalizeReceiveUsdcWalletSignature(raw)
	if (!signature) {
		const hex =
			typeof raw === 'string'
				? raw
				: raw && typeof raw === 'object' && typeof (raw as { signature?: string }).signature === 'string'
					? (raw as { signature: string }).signature
					: ''
		if (hex && (isErc6492SignatureHex(hex) || hex.replace(/^0x/i, '').length > 194)) {
			throw new Error(RECEIVE_USDC_SMART_WALLET_SIG_HINT)
		}
		throw new Error('Wallet did not return a valid signature')
	}
	return {
		from: ethers.getAddress(from),
		to: toChecksum,
		value,
		validAfter,
		validBefore,
		nonce: nonce.toLowerCase(),
		signature,
	}
}

/** EIP-681 receive URI for MetaMask / Coinbase Wallet scanners (checksum EOA on Base). */
export function buildReceiveEoaQrUri(eoa: string): string {
	const raw = eoa?.trim() ?? ''
	if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) return ''
	try {
		return `ethereum:${ethers.getAddress(raw)}@${BASE_MAINNET_CHAIN_ID}`
	} catch {
		return ''
	}
}

export type OpenReceiveWalletAppResult =
	| { ok: true; auth?: ReceiveUsdc3009Auth }
	| { ok: false; error: string; canceled?: boolean }

export async function openReceiveWalletApp(
	row: ReceiveWalletAppRow,
	eoa: string,
	opts?: { amount6?: bigint },
): Promise<OpenReceiveWalletAppResult> {
	const address = eoa?.trim()
	if (!address) {
		return { ok: false, error: 'Wallet address unavailable' }
	}

	const amount6 = opts?.amount6

	if (!isReceiveFromWalletNativeShell()) {
		const provider = resolveBrowserInjectedProvider(row)
		if (!provider) {
			return { ok: false, error: 'Could not open this wallet' }
		}
		try {
			const from = await connectAndSwitchBaseOnInjected(provider, row.brandId)
			if (amount6 == null || amount6 <= 0n) {
				return { ok: false, error: 'Enter a USDC amount' }
			}
			const auth = await signUsdc3009FromInjected(provider, from, address, amount6)
			return { ok: true, auth }
		} catch (err) {
			const error = injectedWalletErrorMessage(err)
			return {
				ok: false,
				error,
				canceled: isUserRejectedRequest(err) || /rejected in wallet/i.test(error),
			}
		}
	}

	if (hasNativeWalletListApi()) {
		const scheme = receiveWalletNativeSchemeUrl(row, address, amount6)
		if (scheme && openExternalUrl(scheme)) {
			return { ok: true }
		}
	}

	const opened = openExternalUrl(receiveWalletHttpsOpenUrl(row, address, amount6))
	if (!opened) {
		return { ok: false, error: 'Could not open this wallet' }
	}
	return { ok: true }
}
