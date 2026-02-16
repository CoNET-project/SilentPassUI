import React, { useState } from 'react'
import { Check, Smartphone, Copy } from 'lucide-react'
import base_icon from '@/components/assets/base-logo.png'
import { fiatPrefix } from '@/services/currency'

type WalletReadyScreenProps = {
  usdcBalance: string
  onGoToHome: () => void
  /** EOA 地址（可选），用于卡片底部展示 */
  address?: string
  /** 法币等价显示（可选），如 "0.00" */
  balanceFiat?: string
}

/**
 * Wallet Ready 页：Master Key 之后、进入 home 之前的成功确认页
 * 图示：绿色对勾 + Wallet Ready! + EOA 风格钱包卡片 + Save Wallet to Home Screen
 */
export default function WalletReadyScreen({
  usdcBalance,
  onGoToHome,
  address,
  balanceFiat = "0",
}: WalletReadyScreenProps) {
  const [addressCopied, setAddressCopied] = useState(false)

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address).then(() => {
      setAddressCopied(true)
      setTimeout(() => setAddressCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-slate-900 px-6 pt-6 pb-10">
      {/* 顶部成功区域 */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 mb-6">
          <Check size={32} className="text-white" strokeWidth={4} />
        </div>
        <h1 className="text-[32px] font-bold text-slate-900 dark:text-slate-100 tracking-tight text-center">
          Wallet Ready!
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium mt-2 text-center">
          Your session is active in this browser.
        </p>
      </div>

      {/* Beamio 钱包卡片 - EOA 风格 */}
      <div className="w-full mb-10">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">
          Main Vault (EOA)
        </h2>
        <div className="relative w-full h-52 rounded-[24px] bg-gradient-to-br from-[#1b6dff] via-[#6d3dff] to-[#f54b8b] text-white shadow-lg overflow-hidden transition-all duration-[600ms] cubic-bezier(0.19, 1, 0.22, 1)">
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-500 opacity-20 rounded-full blur-3xl pointer-events-none" />
          <div className="p-5 h-full flex flex-col justify-between relative z-10">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/60 bg-white/20 backdrop-blur-sm">
                  <img src={base_icon} alt="Base" className="w-5 h-5 object-contain" />
                </div>
                <span className="font-medium">USDC on Base</span>
              </div>
              <div className="px-2.5 py-1 bg-green-500/90 rounded-full flex items-center">
                <span className="text-[10px] font-bold text-white">ACTIVE</span>
              </div>
            </div>

            <div className="text-center mt-4">
              <div className="text-5xl font-bold tracking-tight tabular-nums">
                {usdcBalance}{' '}
                <span className="text-2xl font-normal opacity-80">USDC</span>
              </div>
              <div className="text-white/70 mt-1 text-sm tabular-nums">
                ≈ {fiatPrefix('CAD')} {balanceFiat}
              </div>
            </div>

            {address && (
              <div className="flex justify-start mt-auto">
                <button
                  type="button"
                  onClick={copyAddress}
                  className="flex items-center gap-1.5 px-3 py-1 bg-black/20 backdrop-blur-sm rounded-full text-xs font-mono text-white/90 cursor-pointer hover:bg-black/30 transition-colors"
                >
                  {`${address.slice(0, 6)}...${address.slice(-4)}`}
                  {addressCopied ? (
                    <Check size={10} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Copy size={10} />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Go To Home 按钮 */}
      <div className="mt-auto">
        <button
          onClick={() => {
			window.location.reload()
		  }}
          className="w-full h-16 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-bold text-[17px] shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          <Smartphone size={22} strokeWidth={2.5} />
          Go To Home
        </button>
      </div>
    </div>
  )
}
