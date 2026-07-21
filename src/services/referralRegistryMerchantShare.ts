import { ethers } from 'ethers'
import { CONET_REFERRAL_MERCHANT_SHARE_MODULE } from '@/config/chainAddresses'
import { beamioApi, conetDepinProvider } from '@/utils/constants'

const DOMAIN = {
	name: 'ReferralMerchantShareModuleV1',
	version: '1',
	chainId: 224422,
	verifyingContract: CONET_REFERRAL_MERCHANT_SHARE_MODULE,
} as const

const TYPES = {
	SetMerchantL1Share: [
		{ name: 'l0', type: 'address' },
		{ name: 'merchant', type: 'address' },
		{ name: 'l1', type: 'address' },
		{ name: 'shareBps', type: 'uint256' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
} as const

const SHARE_READ_ABI = [
	'function getMerchantL1Shares(address l0,address merchant) view returns (address[] l1s,uint256[] shareBpsList)',
	'function getL1MerchantShares(address l0,address l1) view returns (address[] merchants,uint256[] shareBpsList)',
	'function shareActionNonces(address account) view returns (uint256)',
] as const

export type MerchantL1ShareRow = {
	l1: string
	merchant: string
	shareBps: string
	sharePercent: string
}

function requireShareModule(): string {
	if (!CONET_REFERRAL_MERCHANT_SHARE_MODULE || CONET_REFERRAL_MERCHANT_SHARE_MODULE === ethers.ZeroAddress) {
		throw new Error('Merchant share module is not deployed yet.')
	}
	return CONET_REFERRAL_MERCHANT_SHARE_MODULE
}

function bpsToPercent(bps: string | bigint): string {
	const n = Number(bps)
	if (!Number.isFinite(n)) return '0'
	return (n / 100).toFixed(n % 100 === 0 ? 0 : 2)
}

function percentToBps(raw: string): bigint {
	const trimmed = raw.trim()
	if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) throw new Error('Share percent must be a number with up to 2 decimals.')
	const [whole, frac = ''] = trimmed.split('.')
	const fracPad = (frac + '00').slice(0, 2)
	const bps = BigInt(whole) * 100n + BigInt(fracPad)
	if (bps > 10_000n) throw new Error('Share percent cannot exceed 100%.')
	return bps
}

export async function fetchMerchantL1Shares(l0: string, merchant: string): Promise<MerchantL1ShareRow[]> {
	const moduleAddr = requireShareModule()
	const shareModule = new ethers.Contract(moduleAddr, SHARE_READ_ABI, conetDepinProvider)
	const [l1s, bpsList] = await shareModule.getMerchantL1Shares(ethers.getAddress(l0), ethers.getAddress(merchant))
	const merchantAddr = ethers.getAddress(merchant)
	return (l1s as string[]).map((l1, index) => {
		const shareBps = (bpsList[index] ?? 0n).toString()
		return {
			l1: ethers.getAddress(l1),
			merchant: merchantAddr,
			shareBps,
			sharePercent: bpsToPercent(shareBps),
		}
	}).filter((row) => row.shareBps !== '0')
}

export async function fetchL1MerchantShares(l0: string, l1: string): Promise<MerchantL1ShareRow[]> {
	const moduleAddr = requireShareModule()
	const shareModule = new ethers.Contract(moduleAddr, SHARE_READ_ABI, conetDepinProvider)
	const [merchants, bpsList] = await shareModule.getL1MerchantShares(ethers.getAddress(l0), ethers.getAddress(l1))
	const l1Addr = ethers.getAddress(l1)
	return (merchants as string[]).map((merchant, index) => {
		const shareBps = (bpsList[index] ?? 0n).toString()
		return {
			l1: l1Addr,
			merchant: ethers.getAddress(merchant),
			shareBps,
			sharePercent: bpsToPercent(shareBps),
		}
	}).filter((row) => row.shareBps !== '0')
}

async function readShareNonce(account: string): Promise<bigint> {
	const moduleAddr = requireShareModule()
	const shareModule = new ethers.Contract(moduleAddr, SHARE_READ_ABI, conetDepinProvider)
	return BigInt((await shareModule.shareActionNonces(ethers.getAddress(account))).toString())
}

export async function setMerchantL1Share(params: {
	l0PrivateKeyArmor: string
	merchant: string
	l1: string
	/** Percent string e.g. "12.5"; use "0" to remove. */
	sharePercent: string
}): Promise<string> {
	requireShareModule()
	const wallet = new ethers.Wallet(params.l0PrivateKeyArmor)
	const shareBps = percentToBps(params.sharePercent)
	const nonce = await readShareNonce(wallet.address)
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
	const message = {
		l0: wallet.address,
		merchant: ethers.getAddress(params.merchant),
		l1: ethers.getAddress(params.l1),
		shareBps,
		nonce,
		deadline,
	}
	const signature = await wallet.signTypedData(DOMAIN, TYPES as any, message)
	const response = await fetch(`${beamioApi}/api/referralRegistryMerchantShare`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			l0: wallet.address,
			merchant: message.merchant,
			l1: message.l1,
			shareBps: shareBps.toString(),
			nonce: nonce.toString(),
			deadline: deadline.toString(),
			signature,
		}),
	})
	const json = await response.json() as { success?: boolean; txHash?: string; error?: string }
	if (!response.ok || !json.success || !json.txHash) {
		throw new Error(json.error ?? 'Merchant share relay failed.')
	}
	return json.txHash
}
