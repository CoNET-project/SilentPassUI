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
	type MobileWalletId,
	isLikelyWalletInAppBrowser,
	isMobileDeviceForWalletApps,
	listInstalledInjectedWallets,
	probeMobileWalletInstallations,
	subscribeInstalledInjectedWallets,
} from './mobileWalletApps'

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
]

const RECEIVE_WALLET_CATALOG_IDS = new Set(RECEIVE_WALLET_NATIVE_QUERIES.map((q) => q.id))

const RECEIVE_WALLET_BRAND_ORDER: InjectedWalletChoiceId[] = [
	'metamask',
	'base',
	'okx',
	'tp',
	'phantom',
]

/** Browser scheme probe only — omit Phantom (Safari can false-positive all-on). */
const MOBILE_PROBE_ORDER: MobileWalletId[] = ['metamask', 'base', 'okx', 'tp']

const LABEL_FOR_BRAND: Record<InjectedWalletChoiceId, string> = {
	metamask: 'MetaMask',
	okx: 'OKX Wallet',
	base: 'Coinbase Wallet',
	tp: 'TokenPocket',
	phantom: 'Phantom',
	other: 'Wallet',
}

function brandChrome(id: InjectedWalletChoiceId) {
	return BRAND_CHROME[id] ?? BRAND_CHROME.other
}

function rowFromBrand(
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

function installedIdsFromProbe(probed: Record<MobileWalletId, boolean>): MobileWalletId[] {
	return MOBILE_PROBE_ORDER.filter((id) => probed[id])
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
		byId.set(brandId, rowFromBrand(brandId))
	}

	const rows = [...byId.values()]
	const rank = (id: InjectedWalletChoiceId) => {
		const i = RECEIVE_WALLET_BRAND_ORDER.indexOf(id)
		return i === -1 ? 99 : i
	}
	rows.sort((a, b) => rank(a.brandId) - rank(b.brandId) || a.label.localeCompare(b.label))
	return rows
}

export function defaultInstalledMobileWalletIds(): MobileWalletId[] {
	return [...MOBILE_PROBE_ORDER]
}

/**
 * Shell vs browser — pick one path, never mix.
 * 1. Native WebView (`isCashTreesNativeWebView`) → queryInstalledApps / listInstalledWalletApps only.
 * 2. Ordinary browser → EIP-6963 + safe extension namespaces. Desktop never runs custom-scheme probes.
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

	if (isCashTreesNativeWebView()) {
		void (async () => {
			const nativeIds = await listInstalledWalletAppsFromNative(RECEIVE_WALLET_NATIVE_QUERIES)
			if (cancelled) return
			lastMobile = (nativeIds ?? []).filter(
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

	if (isMobileDeviceForWalletApps() && !isLikelyWalletInAppBrowser()) {
		void (async () => {
			try {
				const probed = await probeMobileWalletInstallations()
				if (cancelled) return
				const ids = installedIdsFromProbe(probed)
				lastMobile = ids.length > 0 ? ids : defaultInstalledMobileWalletIds()
				publish()
			} catch {
				if (cancelled) return
				lastMobile = defaultInstalledMobileWalletIds()
				publish()
			}
		})()
	} else {
		publish()
	}

	return () => {
		cancelled = true
		unsubInjected?.()
	}
}

const USDC_TRANSFER_IFACE = new ethers.Interface([
	'function transfer(address to, uint256 amount)',
])

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

function eip681Uint256Suffix(amount6?: bigint): string {
	return amount6 != null && amount6 > 0n ? `&uint256=${amount6.toString()}` : ''
}

function receiveEip681UsdcTransfer(eoa: string, amount6?: bigint): string {
	return `ethereum:${USDC_BASE}@${BASE_MAINNET_CHAIN_ID}/transfer?address=${eoa}${eip681Uint256Suffix(amount6)}`
}

function metamaskSendUsdcUrl(eoa: string, amount6?: bigint): string {
	return `https://metamask.app.link/send/${USDC_BASE}@${BASE_MAINNET_CHAIN_ID}/transfer?address=${eoa}${eip681Uint256Suffix(amount6)}`
}

/**
 * Coinbase Wallet send URI.
 *
 * Do **not** wrap EIP-681 in `https://go.cb-w.com/dapp?cb_url=` or `cbwallet://dapp?url=` —
 * those endpoints only load **https** dapp pages. Passing `ethereum:…/transfer?…` makes the
 * in-app browser spin forever on a non-web URL (MetaMask uses a dedicated `metamask://send/…`
 * path and does not hit this bug).
 *
 * Opening the raw EIP-681 URI lets iOS/Android hand off to Coinbase Wallet (or the system
 * wallet picker). Native shells must allow the `ethereum` scheme in `openURL`.
 */
function coinbaseWalletSendUrl(eoa: string, amount6?: bigint): string {
	return receiveEip681UsdcTransfer(eoa, amount6)
}

function okxWalletDownloadUrl(eoa: string, amount6?: bigint): string {
	return `https://web3.okx.com/download?deeplink=${encodeURIComponent(receiveWalletNativeSchemeUrlByBrand('okx', eoa, amount6))}`
}

function tokenPocketHttpsFallback(): string {
	return 'https://www.tokenpocket.pro/'
}

function phantomBrowseUrl(eoa: string, amount6?: bigint): string {
	return `https://phantom.app/ul/browse/${encodeURIComponent(receiveEip681UsdcTransfer(eoa, amount6))}`
}

/** PWA-owned deep link. Native must open this URL as-is (do not invent package/scheme URLs). */
function receiveWalletNativeSchemeUrlByBrand(
	brandId: InjectedWalletChoiceId,
	eoa: string,
	amount6?: bigint,
): string {
	const eip681 = receiveEip681UsdcTransfer(eoa, amount6)
	switch (brandId) {
		case 'metamask':
			return `metamask://send/${USDC_BASE}@${BASE_MAINNET_CHAIN_ID}/transfer?address=${eoa}${eip681Uint256Suffix(amount6)}`
		case 'base':
			// Raw EIP-681 — never `cbwallet://dapp?url=` (that only loads https pages).
			return eip681
		case 'okx':
			return `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(eip681)}`
		case 'tp':
			return `tpdapp://open?params=${encodeURIComponent(JSON.stringify({
				url: eip681,
				chain: 'ETH',
				source: 'beamio',
			}))}`
		case 'phantom':
			return `phantom://ul/browse/${encodeURIComponent(eip681)}`
		default:
			return ''
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
		case 'metamask':
			return metamaskSendUsdcUrl(eoa, amount6)
		case 'base':
			return coinbaseWalletSendUrl(eoa, amount6)
		case 'okx':
			return okxWalletDownloadUrl(eoa, amount6)
		case 'tp':
			return tokenPocketHttpsFallback()
		case 'phantom':
			return phantomBrowseUrl(eoa, amount6)
		default:
			return metamaskSendUsdcUrl(eoa, amount6)
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

function firstAccountFromRequest(accounts: unknown): string {
	if (!Array.isArray(accounts) || typeof accounts[0] !== 'string' || !ethers.isAddress(accounts[0])) {
		return ''
	}
	return ethers.getAddress(accounts[0])
}

async function connectAndSwitchBaseOnInjected(
	provider: InjectedWalletChoice['provider'],
): Promise<string> {
	const accounts = await provider.request({ method: 'eth_requestAccounts' })
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

async function sendUsdcFromInjected(
	provider: InjectedWalletChoice['provider'],
	from: string,
	to: string,
	amount6: bigint,
): Promise<void> {
	const data = USDC_TRANSFER_IFACE.encodeFunctionData('transfer', [ethers.getAddress(to), amount6])
	await provider.request({
		method: 'eth_sendTransaction',
		params: [
			{
				from,
				to: USDC_BASE,
				data,
				value: '0x0',
			},
		],
	})
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

export async function openReceiveWalletApp(
	row: ReceiveWalletAppRow,
	eoa: string,
	opts?: { amount6?: bigint },
): Promise<{ ok: true } | { ok: false; error: string }> {
	const address = eoa?.trim()
	if (!address) {
		return { ok: false, error: 'Wallet address unavailable' }
	}

	const amount6 = opts?.amount6
	const desktopInjected =
		Boolean(row.provider && typeof row.provider.request === 'function') &&
		!isMobileDeviceForWalletApps() &&
		!isCashTreesNativeWebView()

	if (desktopInjected && row.provider) {
		if (amount6 == null || amount6 <= 0n) {
			return { ok: false, error: 'Enter a USDC amount' }
		}
		try {
			const from = await connectAndSwitchBaseOnInjected(row.provider)
			await sendUsdcFromInjected(row.provider, from, address, amount6)
			return { ok: true }
		} catch (err) {
			return { ok: false, error: injectedWalletErrorMessage(err) }
		}
	}

	if (isCashTreesNativeWebView() && hasNativeWalletListApi()) {
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
