import { IpfsImg } from '@/components/IpfsImg';

import {AppButton} from '@/components/button/AppButton'
import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CoNET_Data } from '../../utils/globals'
import {
  ChevronDown,
  RefreshCw,
} from "lucide-react"
import baseIcon from '@/components/assets/base-logo.png'

import { persistBeamioProfileLocaleCurrency } from '@/services/beamio'
import { useDaemonContext} from '@/providers/DaemonProvider'
import { getSessionPrivateKeyArmor } from '@/utils/beamioSessionSecrets'
import {
	normalizeBeamioUiLocale,
	type BeamioUiLocale,
} from '@/utils/beamioProfileLocaleCurrency'
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
	const { t, i18n } = useTranslation()
	const { currencyData, setBeamio, beamio, refreshOracle} = useDaemonContext()
	const [exchangeSource, setExchangeSource] = useState<"coinbase">("coinbase")
	const [stablecoin, setStablecoin] = useState<"usdc_base">("usdc_base")
	const [language, setLanguage] = useState<BeamioUiLocale>(() =>
		normalizeBeamioUiLocale(beamio?.language ?? i18n.language),
	)
	const [refreshing, setRefreshing] = useState(false);
	const [currency, setCurrency] = useState<ICurrency>('USD')
	const [fxUpdatedAt, setFxUpdatedAt] = useState<Date | null>(null)
	const [loading, setLoading] = useState(false)
	const [tax, setTax] = useState('0')
	const savedLocaleRef = useRef(false)
	const localeOnOpenRef = useRef(normalizeBeamioUiLocale(i18n.language))

	const handleLanguageChange = (v: string) => {
		const next = normalizeBeamioUiLocale(v)
		setLanguage(next)
		if (i18n.language !== next) {
			void i18n.changeLanguage(next)
		}
	}

	const handleSaveAvatar = async () => {
		if (!CoNET_Data||!beamio ) return
		setLoading(true)
		const profile: profile = CoNET_Data.profiles[0]
		const pk = getSessionPrivateKeyArmor()?.trim() ?? profile.privateKeyArmor?.trim()
		if (!pk) {
			setLoading(false)
			return
		}
		const next = await persistBeamioProfileLocaleCurrency(beamio, pk, {
			language,
			currency,
			tax,
		})
		if (next) {
			savedLocaleRef.current = true
			setBeamio({ ...next })
		}
		setLoading(false)
		if (next) colse()
	}

	const getAccountData = () => {
		if (!beamio) return
		setCurrency(beamio.currency)
		setLanguage(normalizeBeamioUiLocale(beamio.language))
		setTax(beamio.tax||'0')
	}

	useEffect(() => {
		localeOnOpenRef.current = normalizeBeamioUiLocale(i18n.language)
		getAccountData()
		setFxUpdatedAt(new Date())
		return () => {
			if (!savedLocaleRef.current) {
				void i18n.changeLanguage(localeOnOpenRef.current)
			}
		}
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
				{t('ui.payments_settle_in')} <span className="font-semibold">USDC</span> {t('ui.on_base')}
			</div>
			</div>
		</div>
		</div>

      {/* form */}
      <div className="px-4 mt-5 space-y-6">
        {/* Region removed */}

        <DropdownRow
			label={t('ui.language')}
			value={language}
			onChange={handleLanguageChange}
			options={[
				{ value: 'en', label: t('ui.english') },
				{ value: 'zh-CN', label: t('ui.simplified_chinese') },
			]}
        />

        <DropdownRow
			label={t('ui.currency')}
			value={currency}
			onChange={(v) => setCurrency(v as ICurrency)}
			options={[
				 { value: 'USD', label: t('ui.usd_us_dollar') },
				{ value: 'CAD', label: t('ui.cad_canadian_dollar') },
				{ value: 'EUR', label: t('ui.eur_euro') },
				{ value: 'JPY', label: t('ui.jpy_japanese_yen') },
				{ value: 'CNY', label: t('ui.cny_chinese_yuan') },
				{ value: 'HKD', label: t('ui.hkd_hong_kong_dollar') },
				{ value: 'SGD', label: t('ui.sgd_singapore_dollar') },
				{ value: 'TWD', label: t('ui.twd_new_taiwan_dollar') }
			]}
		/>

        {/* Exchange rate with icon button */}
        <div>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-900">{t('ui.exchange_rate')}</div>

            <AppButton
              variant='secondary'
              onClick={manualRefreshFx}
			  loading={loading}
              aria-label={t('ui.refresh_exchange_rate')}
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
              <option value="coinbase">{t('ui.coinbase_oracle')}</option>
            </select>
            <ChevronDown className="h-4 w-4 text-zinc-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="mt-2 text-sm text-zinc-500">
				1 USDC ≈ {formatFiat(1, currency)}
				{fxUpdatedAt ? ` · ${fxUpdatedAt.toLocaleTimeString()}` : ""}
          </div>
        </div>

        <DropdownRow
          label={t('ui.default_stablecoin')}
          value={stablecoin}
          onChange={(v) => setStablecoin(v as any)}
          options={[{ value: "usdc_base", label: t('ui.usdc_on_base') }]}
        />

		{/* Tax % input */}
			<div className="space-y-2">
			<label className="block text-sm font-medium text-slate-800">{t('ui.tax')}</label>

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
				placeholder="e.g. 8.25"
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
          loading={loading}
        >{t('ui.done')}</AppButton>
      </div>
	  <div className="h-20" />
    </div>
  );
}
