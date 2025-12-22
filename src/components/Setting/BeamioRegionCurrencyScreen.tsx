
import {AppButton} from '@/components/button/AppButton'
import React, { useState, useEffect } from 'react'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
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

import {getOracle, postBeamio, storeSystemData} from '@/services/beamio'
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
	const { currencyData, setCurrencyData, setBeamio, beamio} = useDaemonContext()
	const [exchangeSource, setExchangeSource] = useState<"coinbase">("coinbase")
	const [stablecoin, setStablecoin] = useState<"usdc_base">("usdc_base")
	const [language, setLanguage] = useState<"en">("en")
	const [refreshing, setRefreshing] = useState(false);
	const [currency, setCurrency] = useState<ICurrency>('USD')
	const [fx, setFx] = useState<number>(fxRateUSDCToCurrency("USD"))
	const [fxUpdatedAt, setFxUpdatedAt] = useState<Date | null>(null)
	const [loading, setLoading] = useState(false)

	const oracle = async () => {
		getAccountData()
		const data = await getOracle ()
		setCurrencyData({
			CAD: Number(data.usdcad),
			JPY: Number(data.usdjpy),
			USD: 1,
			CNY: Number(data.usdcny),
			USDC: Number(data.usdc),
			HKD: Number(data.usdhkd),
			TWD: Number(data.usdtwd),
			EUR: Number(data.usdeur),
			SGD: Number(data.usdsgd)
		})
		setFxUpdatedAt(new Date())
	}
	let oracleProcess = false

	const handleSaveAvatar = async () => {
		if (!CoNET_Data||!beamio ) return
		setLoading(true)
		const tmpData = CoNET_Data
		
		const profile: profile = tmpData.profiles[0]
		const bo = beamio
		bo.currency = currency
		bo.language = language
		await postBeamio(bo, profile.privateKeyArmor)

		tmpData.beamio = bo
		setCoNET_Data(tmpData)
		
		await storeSystemData()
		setBeamio({...bo})
		setLoading(false)
		colse()
	}

	const getAccountData = () => {
		if (!beamio) return
		setCurrency(beamio.currency)
		setLanguage(beamio.language)
	}

	useEffect(() => {

		if (oracleProcess) return
		oracleProcess = true
		oracle()
	},[])

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
		await getOracle ()
		setLoading(false)
	}
  return (
    <div className="flex flex-col min-h-[760px] bg-white mt-6 mb-12">


      {/* header */}
      <div className="px-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center">
            <Globe className="h-5 w-5 text-zinc-600" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-900">
              Language & Currency
            </div>
          </div>
        </div>
      </div>

      {/* minimal info box */}
      <div className="px-4">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-6 h-6 rounded-full bg-white border border-blue-100 flex items-center justify-center">
              <Info className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-sm text-blue-900">
              Payments settle in <span className="font-semibold">USDC</span> on Base.
            </div>
          </div>
        </div>
      </div>

      {/* form */}
      <div className="px-4 mt-5 space-y-6">
        {/* Region removed */}

        <DropdownRow
			label="Language"
			value={language}
			onChange={(v) => setLanguage(v as any)}
			options={[{ value: "en", label: "English" }]}
        />

        <DropdownRow
			label="Currency"
			value={currency}
			onChange={(v) => setCurrency(v as ICurrency)}
			options={[
				 { value: 'USD', label: 'USD · US Dollar' },
				{ value: 'CAD', label: 'CAD · Canadian Dollar' },
				{ value: 'EUR', label: 'EUR · Euro' },
				{ value: 'JPY', label: 'JPY · Japanese Yen' },
				{ value: 'CNY', label: 'CNY · Chinese Yuan' },
				{ value: 'HKD', label: 'HKD · Hong Kong Dollar' },
				{ value: 'SGD', label: 'SGD · Singapore Dollar' },
				{ value: 'TWD', label: 'TWD · New Taiwan Dollar' }
				

			]}
		/>

        {/* Exchange rate with icon button */}
        <div>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-900">Exchange rate</div>

            <AppButton
              variant='secondary'
              onClick={manualRefreshFx}
			  loading={loading}
              aria-label="Refresh exchange rate"
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
              <option value="coinbase">Coinbase oracle</option>
            </select>
            <ChevronDown className="h-4 w-4 text-zinc-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="mt-2 text-sm text-zinc-500">
				1 USDC ≈ {formatFiat(1, currency)}
				{fxUpdatedAt ? ` · ${fxUpdatedAt.toLocaleTimeString()}` : ""}
          </div>
        </div>

        <DropdownRow
          label="Default stablecoin"
          value={stablecoin}
          onChange={(v) => setStablecoin(v as any)}
          options={[{ value: "usdc_base", label: "USDC on Base" }]}
        />
      </div>

      <div className="mt-auto px-4 pb-6">
        <AppButton
          className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700"
          onClick={handleSaveAvatar}
        >
          Done
        </AppButton>
      </div>
	  <div className="h-20" />
    </div>
  );
}
