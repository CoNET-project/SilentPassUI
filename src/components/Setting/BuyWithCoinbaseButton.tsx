import { useState } from 'react'
import { AppButton } from '../button/AppButton'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
const remote = 'https://api.settleonbase.xyz'
type Prof = {
  myAddress: string
}

/**
 * Coinbase Onramp via external URL only — do NOT use WalletLink / @coinbase/wallet-sdk
 * (those write `-walletlink:…session:secret` into Local Storage; forbidden for APP signing).
 * See `.cursor/rules/beamio-app-wallet-secret-storage.mdc`.
 */
export const BuyWithCoinbaseButton = ({ myAddress }: Prof) => {
	const [loading, setLoading] = useState(false)

	const handleClick = async () => {
		if (!myAddress) return
		setLoading(true)
		const params = new URLSearchParams({address: myAddress}).toString()

		try {
			const res = await fetch(`${remote}/api/coinbase-token?${params}`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			})

			if (!res.ok) {
				console.error('Failed to create onramp session', await res.text())
				return
			}

			const { onrampUrl } = await res.json() as { onrampUrl: string }

			if (!onrampUrl) {
				console.error('No onrampUrl in response')
				return
			}

			// ⭐ 直接打开 Coinbase 返回的安全 URL（已包含 sessionToken）
			openExternalUrl(onrampUrl)
		} catch (e) {
			console.error('open coinbase onramp error', e)
		} finally {
			setLoading(false)
		}
	}

	return (
		<AppButton
			fullWidth
			disabled={loading || !myAddress}
			loading={loading}
			onClick={handleClick}
		>
			Buy USDC with Coinbase
		</AppButton>
	)
}

