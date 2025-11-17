// @/components/CryptoAssetsCard.tsx
import React, { useEffect, useState } from 'react'
import './CryptoAssetsCard.scss'
import { CoNET_Data } from '../../../utils/globals'
import { Toast } from 'antd-mobile'
import { Copy } from 'lucide-react'   // ← 新增
import usdcIcon from '../../assets/usdc.png'
import baseIcon from '../../assets/base-logo.png'
import {getBalance} from '@/services/beamio'

type CryptoAssetsCardProps = {
  fiatAmount: string
  tokenAmount: string
  tokenSymbol?: string
  subtitle?: string
  onKeyClick?: () => void
}

const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

const CryptoAssetsCard: React.FC<CryptoAssetsCardProps> = ({
  tokenAmount,
  
  subtitle = 'Free to send',
  onKeyClick,
}) => {
  const [address, setAddress] = useState('')
  const [usdcAmount, setUsdcAmount] = useState(0)
  const [fiatAmount, setFiatAmount] = useState(0)
	const tokenSymbol = 'USDC'
  useEffect(() => {
    const tempData = CoNET_Data
    if (tempData?.profiles?.length) {
      setAddress(tempData.profiles[0].keyID)
	  getBa()
    }
  }, [])

  	const getBa = async () => {
		if (!address) return
		const _ba = await getBalance(address)
		if (!_ba) return
		const ba = _ba
		const eth = Number(ba.eth)
		const ethUsd = eth * Number(ba.oracle.eth)

		const usdc = Number(ba.usdc)
		setUsdcAmount(usdc)
		const usdcUsd = usdc * Number(ba.oracle.usdc)
		setFiatAmount(usdcUsd)
		const total = ethUsd + usdcUsd

	}

  // ⛳ 点击复制地址
  const copyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      Toast.show({
        content: 'Address copied',
        duration: 1200,
      })
    } catch (err) {
      Toast.show({
        content: 'Copy failed',
        duration: 1200,
      })
    }
  }

  return (
    <div className="cryptoAssetsCard">
      <div className="walletRow">
		        {/* 🔑 key 独立按钮 */}
        <p style={{fontSize: '16px'}}>
			<b>In Beamio</b>
		</p>
        {/* 地址 + copy 一体化 pill */}
        <button
          type="button"
          className="walletTag"
          onClick={copyAddress}
        >
          <span className="walletAddr">{fmtAddr(address)}</span>

          {/* ⚡ 这里用 lucide-react 的 Copy icon */}
          <Copy className="walletCopyIcon" strokeWidth={2.2} />
        </button>


      </div>

      {/* 金额 */}
      <div className="cryptoAssetsTotal">
        {fiatAmount}
      </div>

      {/* 标题 */}
      <div className="cryptoAssetsSectionTitle">
        Crypto Assets
      </div>

      {/* USDC 行 */}
      <div className="cryptoAssetRow">
        <div className="cryptoAssetLeft">
          {/* 组合 USDC + Base icon */}
			<div className="cryptoAssetIcon">
				<img src={usdcIcon} alt="USDC" className="usdcIcon" />

				{/* Base 徽章：叠加在右下角 */}
				<img src={baseIcon} alt="Base" className="baseBadge" />
			</div>

          <div className="cryptoAssetText">
            <div className="cryptoAssetName">{tokenSymbol}</div>
            <div className="cryptoAssetSub">{subtitle}</div>
          </div>
        </div>

        <div className="cryptoAssetRight">
          <div className="cryptoAssetFiat">{fiatAmount}</div>
          <div className="cryptoAssetToken">{tokenAmount}</div>
        </div>
      </div>
    </div>
  )
}

export default CryptoAssetsCard
