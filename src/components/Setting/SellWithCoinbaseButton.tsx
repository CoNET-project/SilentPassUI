
import { AppButton } from '../button/AppButton'
import { useEffect, useRef, useState } from 'react'

type Prof = {
  myAddress: string
}

const remote = 'https://api.settleonbase.xyz'

export const SellWithCoinbaseButton = ({ myAddress }: Prof) => {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (!myAddress) return
    setLoading(true)
    const params = new URLSearchParams({ address: myAddress }).toString()

    try {
      const res = await fetch(`${remote}/api/coinbase-offramp?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        console.error('Failed to create offramp url', await res.text())
        return
      }

      const { offrampUrl } = (await res.json()) as { offrampUrl: string }

      if (!offrampUrl) {
        console.error('No offrampUrl in response')
        return
      }

      // ⭐ 打开 Coinbase 提现 / 卖币 UI
      window.open(offrampUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      console.error('open coinbase offramp error', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppButton
      fullWidth
	  variant='secondary'
      disabled={loading || !myAddress}
      loading={loading}
      onClick={handleClick}
    >
      Cash out USDC via Coinbase
    </AppButton>
  )
}
