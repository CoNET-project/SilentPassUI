/**
 * 提交扫码得到的 Open Relay 支付信息到 API 服务器。
 * 服务端需接受 signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen 生成的 payload，
 * 以及金额(amount)和收款方 AA 地址(to)。
 */
import type { OpenContainerRelayPayload } from '@/services/AAaccount'
import { voucherRelayApi } from '@/utils/constants'
import { tu } from '@/locale/beamioLocale'

export type VoucherRelaySubmitBody = {
	relayPayload: OpenContainerRelayPayload
	/** 数字键输入的金额字符串（如 "10.50"） */
	amount: string
	/** 收款方 AA 钱包地址 */
	to: string
}

export async function submitVoucherPayRelay(
	relayPayload: OpenContainerRelayPayload,
	amount: string,
	toAA: string
): Promise<{ ok: boolean; error?: string }> {
	try {
		const res = await fetch(voucherRelayApi, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				relayPayload,
				amount,
				to: toAA,
			} as VoucherRelaySubmitBody),
		})
		if (!res.ok) {
			const text = await res.text()
			return { ok: false, error: text || `HTTP ${res.status}` }
		}
		return { ok: true }
	} catch (e: any) {
		return { ok: false, error: e?.message ?? tu('network_error') }
	}
}
