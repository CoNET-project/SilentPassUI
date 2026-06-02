import { IpfsImg } from '@/components/IpfsImg';
// @/components/CryptoAssetsCard.tsx
import React, { useEffect, useState } from 'react'
import './CryptoAssetsCard.scss'
import { CoNET_Data } from '../../../utils/globals'
import { Toast } from 'antd-mobile'
import { Copy } from 'lucide-react'   // ← 新增
import usdcIcon from '../../assets/usdc.png'
import baseIcon from '../../assets/base-logo.png'

type CryptoAssetsCardProps = {

  onKeyClick?: () => void
}

const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')
const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const CryptoAssetsCard: React.FC<CryptoAssetsCardProps> = ({
  onKeyClick,
}) => {
  const [address, setAddress] = useState('')
  const [fiatAmount, setFiatAmount] = useState(0)
	const [usdcToUSDAmount, setUsdcToUSDAmount] = useState(0)

	const subtitle = 'Free to send'

	const tokenSymbol = 'USDC'


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
        $ {formatMoney(fiatAmount)}
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
				<IpfsImg src={usdcIcon} alt="USDC" className="usdcIcon" />

				{/* Base 徽章：叠加在右下角 */}
				<IpfsImg src={baseIcon} alt="Base" className="baseBadge" />
			</div>

          <div className="cryptoAssetText">
            <div className="cryptoAssetName">{tokenSymbol}</div>
            <div className="cryptoAssetSub">{subtitle}</div>
          </div>
        </div>

        <div className="cryptoAssetRight">
          <div className="cryptoAssetFiat"> $ {formatMoney(fiatAmount)}</div>
          <div className="cryptoAssetToken"> {formatMoney(usdcToUSDAmount)} USDC</div>
        </div>
      </div>
    </div>
  )
}

export default CryptoAssetsCard
