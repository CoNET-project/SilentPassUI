import { ethers } from 'ethers'
import { CCSA_Card_Address } from '@/utils/constants'

/** 将礼品券链接/码解析为 History 兑换页路径 */
export function buildRedeemVoucherHistoryPath(input: string): string | null {
	const raw = input.trim()
	if (!raw) return null

	let redeemCode = ''
	let cardAddress = ''

	try {
		const u = new URL(raw)
		redeemCode = u.searchParams.get('redeemcode') || u.searchParams.get('Redeemcode') || ''
		cardAddress = (u.searchParams.get('beamiocard') || u.searchParams.get('Beamiocard') || '').trim()
	} catch {
		const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : raw
		const sp = new URLSearchParams(query)
		redeemCode = sp.get('redeemcode') || sp.get('Redeemcode') || ''
		cardAddress = (sp.get('beamiocard') || sp.get('Beamiocard') || '').trim()
	}

	const normalizedCode = decodeURIComponent((redeemCode || raw).trim())
	const normalizedCard = cardAddress && ethers.isAddress(cardAddress) ? cardAddress : CCSA_Card_Address
	return `/History?beamiocard=${encodeURIComponent(normalizedCard)}&redeemcode=${encodeURIComponent(normalizedCode)}`
}
