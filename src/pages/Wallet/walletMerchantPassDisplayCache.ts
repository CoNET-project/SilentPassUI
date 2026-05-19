import type { UserCardInfo } from '@/services/BeamioCard'
import type { MyBrandCardFeedDetailsMap } from '@/utils/myBrandsFeedState'
import {
	buildWalletMerchantPassStackDisplay,
	type WalletMerchantPassStackDisplay,
} from '@/pages/Wallet/walletMerchantPassDisplay'

const cache = new Map<string, WalletMerchantPassStackDisplay>()

/** 同卡同 sig 复用展示对象，避免 Edge 因新引用触发整卡重绘 */
export function getStableWalletMerchantPassStackDisplay(
	uc: UserCardInfo,
	detail: MyBrandCardFeedDetailsMap[string] | undefined
): WalletMerchantPassStackDisplay {
	const key = uc.cardAddress.toLowerCase()
	const built = buildWalletMerchantPassStackDisplay(uc, detail)
	const hit = cache.get(key)
	if (hit && hit.sig === built.sig) return hit
	cache.set(key, built)
	return built
}

export function clearWalletMerchantPassStackDisplayCache(): void {
	cache.clear()
}
