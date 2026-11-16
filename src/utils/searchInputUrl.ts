import { resolveBeamioUrl } from './legacyBeamioLinks'

const CANONICAL_ORIGIN = 'https://beamio.ca'

/**
 * 商家 bill paymentUrl 判断：Amount、currency、acceptTokens 必选；与扫码 QR workflow 一致。
 * 输入先经旧域映射，所以旧印刷的账单链接同样被识别。
 */
export function isBillPaymentUrlText(raw: string): boolean {
	try {
		if (!raw || typeof raw !== 'string') return false
		const u = resolveBeamioUrl(raw, CANONICAL_ORIGIN)
		const amount = u.searchParams.get('Amount') ?? u.searchParams.get('amount')
		const currency = u.searchParams.get('currency') ?? u.searchParams.get('币种') ?? ''
		const acceptTokens = u.searchParams.get('acceptTokens') ?? u.searchParams.get('accepttokens') ?? ''
		if (!amount || Number(amount) <= 0) return false
		if (!currency || !acceptTokens) return false
		if (u.pathname === '/Vouchers' || /beamio\.ca/i.test(u.origin)) return true
		return /\/Vouchers/i.test(u.pathname)
	} catch {
		return false
	}
}

/**
 * 搜索框输入 → URL。与 SearchBarWithResults 原内联逻辑一致，唯一差别是每一步解析都经过旧域映射，
 * 返回的 URL 主机永不是旧域，其 href 才会进入 requestUrl 与扫码状态。
 * 返回 null 表示输入不是 URL，应继续按用户名或地址搜索。
 */
export function searchInputToUrl(qq: string): URL | null {
	try {
		return resolveBeamioUrl(qq)
	} catch {
		// 无协议时，以 beamio.ca 为 base 解析
	}
	if (/redeemcode=|beamiocard=/i.test(qq)) {
		try {
			const candidate = qq.startsWith('/') || qq.startsWith('?') ? qq : qq.includes('?') ? qq : '/app/?' + qq
			return resolveBeamioUrl(candidate, CANONICAL_ORIGIN)
		} catch {
			return null
		}
	}
	if ((/Amount=/i.test(qq) && /Vouchers|beamio\.ca/i.test(qq)) && !/^https?:\/\//i.test(qq)) {
		// Vouchers 支付 URL 无协议时补全
		const withProto = qq.startsWith('/') ? CANONICAL_ORIGIN + qq : 'https://' + qq
		if (isBillPaymentUrlText(withProto)) {
			try {
				return resolveBeamioUrl(withProto)
			} catch {
				return null
			}
		}
	}
	return null
}
