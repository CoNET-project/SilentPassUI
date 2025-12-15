import { initOnRamp } from '@coinbase/cbpay-js'
import { useEffect, useRef, useState } from 'react'
import { AppButton } from '../button/AppButton'
const remote = 'https://api.settleonbase.xyz'
type Prof = {
  myAddress: string
}

// 自己定义一个 Coinbase 实例类型，包含 open / destroy
type CBPayInstance = {
	open: () => void
	destroy: () => void
}

export const BuyWithCoinbaseButton = ({ myAddress }: Prof) => {
	const [onrampInstance, setOnrampInstance] = useState<CBPayInstance | null>(null)
	const [loading, setLoading] = useState(false)

	// 用 ref 保存实际的 instance，用于 cleanup
	const instanceRef = useRef<CBPayInstance | null>(null)
  

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
			window.open(onrampUrl, '_blank', 'noopener,noreferrer')
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

