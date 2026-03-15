import { ethers } from 'ethers'

/** 从 search 或 hash 中解析 query（HashRouter 下 query 在 #/?... 中） */
function getSearchParams(): URLSearchParams | null {
	if (typeof window === 'undefined') return null
	const search = window.location.search
	if (search && search.startsWith('?')) {
		return new URLSearchParams(search)
	}
	const hash = window.location.hash || ''
	const qIdx = hash.indexOf('?')
	if (qIdx >= 0 && hash.length > qIdx + 1) {
		return new URLSearchParams(hash.slice(qIdx + 1))
	}
	return null
}

/** Parse URL for redeemAdmin flow: redeemCode + redeemAdmin=1 + card (required). Admin redeem 登记 EOA 为指定卡的 admin，必须带入 card 参数。 */
export function parseRedeemAdminFromUrl(): { cardAddress: string; redeemCode: string } | null {
	if (typeof window === 'undefined') return null
	try {
		const sp = getSearchParams()
		if (!sp) return null
		const redeemCode = sp.get('redeemCode') ?? sp.get('redeemcode') ?? ''
		const redeemAdmin = sp.get('redeemAdmin') ?? sp.get('redeemadmin') ?? ''
		if (!redeemCode?.trim() || !redeemAdmin || redeemAdmin === '0') return null
		const cardRaw = (sp.get('card') ?? sp.get('beamiocard') ?? sp.get('Beamiocard') ?? sp.get('cardAddress') ?? '').trim()
		if (!cardRaw || !ethers.isAddress(cardRaw)) return null
		return {
			cardAddress: ethers.getAddress(cardRaw),
			redeemCode: decodeURIComponent(redeemCode.trim()),
		}
	} catch {
		return null
	}
}
