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

function receiveEip681UsdcTransfer(eoa: string): string {
	return `ethereum:${USDC_BASE}@${BASE_MAINNET_CHAIN_ID}/transfer?address=${eoa}`
}

function metamaskSendUsdcUrl(eoa: string): string {
	return `https://metamask.app.link/send/${USDC_BASE}@${BASE_MAINNET_CHAIN_ID}/transfer?address=${eoa}`
}

function coinbaseWalletDappUrl(eoa: string): string {
	return `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(receiveEip681UsdcTransfer(eoa))}`
}

function okxWalletDownloadUrl(eoa: string): string {
	return `https://web3.okx.com/download?deeplink=${encodeURIComponent(receiveWalletNativeSchemeUrlByBrand('okx', eoa))}`
}

function tokenPocketHttpsFallback(): string {
	return 'https://www.tokenpocket.pro/'
}

function phantomBrowseUrl(eoa: string): string {
	return `https://phantom.app/ul/browse/${encodeURIComponent(receiveEip681UsdcTransfer(eoa))}`
}

/** PWA-owned deep link. Native must open this URL as-is (do not invent package/scheme URLs). */
function receiveWalletNativeSchemeUrlByBrand(brandId: InjectedWalletChoiceId, eoa: string): string {
	const eip681 = receiveEip681UsdcTransfer(eoa)
	switch (brandId) {
		case 'metamask':
			return `metamask://send/${USDC_BASE}@${BASE_MAINNET_CHAIN_ID}/transfer?address=${eoa}`
		case 'base':
			return `cbwallet://dapp?url=${encodeURIComponent(eip681)}`
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

function receiveWalletNativeSchemeUrl(row: ReceiveWalletAppRow, eoa: string): string {
	return receiveWalletNativeSchemeUrlByBrand(row.brandId, eoa)
}

export function receiveWalletHttpsOpenUrl(row: ReceiveWalletAppRow, eoa: string): string {
	switch (row.brandId) {
		case 'metamask':
			return metamaskSendUsdcUrl(eoa)
		case 'base':
			return coinbaseWalletDappUrl(eoa)
		case 'okx':
			return okxWalletDownloadUrl(eoa)
		case 'tp':
			return tokenPocketHttpsFallback()
		case 'phantom':
			return phantomBrowseUrl(eoa)
		default:
			return metamaskSendUsdcUrl(eoa)
	}
}

async function requestBaseChainOnInjected(
	provider: InjectedWalletChoice['provider'],
): Promise<void> {
	const chainHex = '0x2105'
	try {
		await provider.request({ method: 'eth_requestAccounts' })
	} catch {
		/* user rejected — still try switch */
	}
	try {
		await provider.request({
			method: 'wallet_switchEthereumChain',
			params: [{ chainId: chainHex }],
		})
	} catch {
		/* wallet may already be on Base or user rejected */
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

export async function openReceiveWalletApp(
	row: ReceiveWalletAppRow,
	eoa: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const address = eoa?.trim()
	if (!address) {
		return { ok: false, error: 'Wallet address unavailable' }
	}

	if (row.provider && typeof row.provider.request === 'function' && !isMobileDeviceForWalletApps()) {
		try {
			await requestBaseChainOnInjected(row.provider)
			return { ok: true }
		} catch {
			/* fall through to https */
		}
	}

	if (isCashTreesNativeWebView() && hasNativeWalletListApi()) {
		const scheme = receiveWalletNativeSchemeUrl(row, address)
		if (scheme && openExternalUrl(scheme)) {
			return { ok: true }
		}
	}

	const opened = openExternalUrl(receiveWalletHttpsOpenUrl(row, address))
	if (!opened) {
		return { ok: false, error: 'Could not open this wallet' }
	}
	return { ok: true }
}
