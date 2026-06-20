import { IpfsImg } from '@/components/IpfsImg';
import { tu } from '@/locale/beamioLocale'

import {AppButton} from '@/components/button/AppButton'
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import {
	getStoredBeamioUiLocale,
	setBeamioUiLocale,
	type BeamioUiLocale,
} from '@/locale/i18n'
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Home as HomeIcon,
  Send,
  Settings,
  Wallet, X, Globe2, ChevronDown, Info,
  RefreshCw, // ✅ add
} from "lucide-react"
import baseIcon from '@/components/assets/base-logo.png'

import {postBeamio, storeSystemData} from '@/services/beamio'
import { useDaemonContext} from '@/providers/DaemonProvider'
type prof = {
	colse: () => void
}


function DropdownRow({
	label,
	value,
	onChange,
	options,
	helper,
	disabled,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	options: { value: string; label: string }[];
	helper?: string;
	disabled?: boolean;
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-zinc-900">{label}</div>
      <div className="mt-2 relative">
        <select
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-12 rounded-2xl border border-zinc-200 bg-white px-4 pr-10 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-200 ${
            disabled ? "opacity-70" : ""
          } appearance-none`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="h-4 w-4 text-zinc-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      {helper ? (
        <div className="mt-2 text-sm text-zinc-500 leading-relaxed">{helper}</div>
      ) : null}
    </div>
  );
}


export default function BeamioRegionCurrencyScreen({colse}:prof) {
	const { t } = useTranslation()
	const { currencyData, setBeamio, beamio, refreshOracle} = useDaemonContext()
	const [exchangeSource, setExchangeSource] = useState<"coinbase">("coinbase")
	const [stablecoin, setStablecoin] = useState<"usdc_base">("usdc_base")
	const [language, setLanguage] = useState<BeamioUiLocale>(() => getStoredBeamioUiLocale())
	const [refreshing, setRefreshing] = useState(false);
	const [currency, setCurrency] = useState<ICurrency>('USD')
	const [fx, setFx] = useState<number>(fxRateUSDCToCurrency("USD"))
	const [fxUpdatedAt, setFxUpdatedAt] = useState<Date | null>(null)
	const [loading, setLoading] = useState(false)
	const [tax, setTax] = useState('0')

	const handleSaveAvatar = async () => {
		if (!CoNET_Data||!beamio ) return
		setLoading(true)
		const tmpData = CoNET_Data
		
		const profile: profile = tmpData.profiles[0]
		const bo = beamio
		bo.currency = currency
		bo.language = language
		bo.tax = tax
		await postBeamio(bo, profile.privateKeyArmor)

		tmpData.beamio = bo
		setCoNET_Data(tmpData)
		
		await storeSystemData()
		await setBeamioUiLocale(language)
		setBeamio({...bo})
		setLoading(false)
		colse()
	}

	const getAccountData = () => {
		if (!beamio) return
		setCurrency(beamio.currency)
		const stored = getStoredBeamioUiLocale()
		const profileLang =
			beamio.language === 'zh-CN' || beamio.language === 'en'
				? beamio.language
				: stored
		setLanguage(profileLang)
		setTax(beamio.tax||'0')
	}

	useEffect(() => {
		getAccountData()
		setFxUpdatedAt(new Date())
	}, [beamio])

	/**
	 * @returns 1 USDC ≈ X {currency}
	 */
	function fxRateUSDCToCurrency(currency: ICurrency): number {
		// 1 USDC = ? USD
		const usdcToUSD = currencyData.USDC ?? 1

		switch (currency) {
			case 'USDC':
				// 1 USDC = 1 USDC
				return 1

			case 'USD':
				// 1 USDC = ? USD
				return usdcToUSD

			case 'CAD':
				// 1 USDC = (USDC→USD) * (USD→CAD)
				return usdcToUSD * currencyData.CAD

			case 'CNY':
				return usdcToUSD * currencyData.CNY

			case 'JPY':
				return usdcToUSD * currencyData.JPY

			default:
				return usdcToUSD
		}
	}

	function usdcToCurrency(usdc: number, currency: ICurrency) {
		return usdc * fxRateUSDCToCurrency(currency)
	}

	function formatFiat(usdcAmount = 1, currency: ICurrency) {
		// 1 USDC ≈ X {currency}
		const rate = fxRateUSDCToCurrency(currency)

		// 目标币种金额
		const v = currency === 'USDC' ? usdcAmount : usdcAmount * rate

		switch (currency) {
			case 'JPY':
			// 日元无小数
			return `JPY¥${Math.round(v).toLocaleString()}`

			case 'CNY':
			return `CNY¥${v.toFixed(2)}`

			case 'CAD':
			return `CA$${v.toFixed(2)}`

			case 'USDC':
			return `${usdcAmount.toFixed(2)} USDC`

			case 'USD':
			default:
			return `US$${v.toFixed(2)}`
		}
	}


	const manualRefreshFx = async () => {
		setLoading(true)
		await new Promise(executor => setTimeout(() => executor(true), 500))
		refreshOracle?.()
		setFxUpdatedAt(new Date())
		setLoading(false)
	}
  return (
    <div className="flex flex-col min-h-[760px] bg-white mt-6 mb-12">


      {/* header */}
      <div className="px-4 pb-3">
       
      </div>

		{/* minimal info box */}
		<div className="px-4">
		<div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
			<div className="flex items-center gap-3">
			<div className="w-6 h-6 rounded-full bg-white border border-blue-100 flex items-center justify-center">
				<IpfsImg
				src={baseIcon}
				alt="Base"
				className="w-6 h-6"
				/>
			</div>

			<div className="text-sm text-blue-900">
				付款在 Base 上以 <span className="font-semibold">USDC</span> 结算。
			</div>
			</div>
		</div>
		</div>

      {/* form */}
      <div className="px-4 mt-5 space-y-6">
        {/* Region removed */}

        <DropdownRow
			label={t('ui.language', { defaultValue: tu('language') })}
			value={language}
			onChange={(v) => setLanguage(v as BeamioUiLocale)}
			options={[
				{ value: 'en', label: 'English' },
				{ value: 'zh-CN', label: '简体中文' },
			]}
        />

        <DropdownRow
			label="货币"
			value={currency}
			onChange={(v) => setCurrency(v as ICurrency)}
			options={[
				 { value: 'USD', label: 'USD · 美元' },
				{ value: 'CAD', label: 'CAD · 加元' },
				{ value: 'EUR', label: 'EUR · 欧元' },
				{ value: 'JPY', label: 'JPY · 日元' },
				{ value: 'CNY', label: 'CNY · 人民币' },
				{ value: 'HKD', label: 'HKD · 港币' },
				{ value: 'SGD', label: 'SGD · 新加坡元' },
				{ value: 'TWD', label: 'TWD · 新台币' }
				

			]}
		/>

        {/* Exchange rate with icon button */}
        <div>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-900">{tu('exchange_rate')}</div>

            <AppButton
              variant='secondary'
              onClick={manualRefreshFx}
			  loading={loading}
              aria-label="刷新汇率"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </AppButton>
          </div>

          <div className="mt-2 relative">
            <select
              value={exchangeSource}
              onChange={(e) => setExchangeSource(e.target.value as any)}
              className="w-full h-12 rounded-2xl border border-zinc-200 bg-white px-4 pr-10 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-200 appearance-none"
            >
              <option value="coinbase">Coinbase 预言机</option>
            </select>
            <ChevronDown className="h-4 w-4 text-zinc-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="mt-2 text-sm text-zinc-500">
				1 USDC ≈ {formatFiat(1, currency)}
				{fxUpdatedAt ? ` · ${fxUpdatedAt.toLocaleTimeString()}` : ""}
          </div>
        </div>

        <DropdownRow
          label={tu('default_stablecoin')}
          value={stablecoin}
          onChange={(v) => setStablecoin(v as any)}
          options={[{ value: "usdc_base", label: "Base 上的 USDC" }]}
        />

		{/* Tax % input */}
			<div className="space-y-2">
			<label className="block text-sm font-medium text-slate-800">
				税率 %
			</label>

			<input
				value={tax}
				onChange={e => {
				// 只允许数字和一个小数点
				const v = e.target.value
				if (/^\d*\.?\d*$/.test(v)) {
					setTax(v)
				}
				}}
				type="text"
				inputMode="decimal"        // ✅ iOS / Android 数字键盘（含 .）
				pattern="[0-9]*\.?[0-9]*"  // ✅ Web / PWA 兼容
				placeholder="例如 8.25"
				className="
				w-full
				rounded-2xl
				bg-slate-50
				border border-slate-200
				px-4 py-3
				text-sm
				outline-none
				placeholder:text-slate-400
				focus:border-sky-500
				focus:ring-2 focus:ring-sky-100
				"
			/>
			</div>
      </div>

      <div className="mt-4	 px-4 pb-6">
        <AppButton
          className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700"
          onClick={handleSaveAvatar}
        >{tu('done')}</AppButton>
      </div>
	  <div className="h-20" />
    </div>
  );
}
