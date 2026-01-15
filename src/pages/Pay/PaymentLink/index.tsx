import React, {useRef, useState, useEffect, useMemo} from "react"

import {AuthorizationSign, getBalanceProcess, generateCODE} from '@/services/beamio'
import AmountCurrency from '@/components/input/AmountCurrency'
import { AppButton } from "@/components/button/AppButton"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {ethers} from 'ethers'
import LockModeSegmented from './LockModeSegmented'
import FeeInline from './FeeInline'
import SuccessShow from './successShow'
import {Onetime_reuse_Drag} from '../../Pay/components/onetimeReuseSwitch'

function fiatPrefix(ccy: ICurrency) {
	if (ccy === "CAD") return "CA$"
	if (ccy === "USD") return "$"
	if (ccy === "EUR") return "€"
	if (ccy === "JPY") return "JP¥"
	if (ccy==='TWD') return "NT$"
	if (ccy==='CNY') return 'CN¥'
	if (ccy==='HKD') return 'HK$'
	if (ccy==='SGD') return 'SG$'
	
  return '$';
}

const getImg = (avatarSeed: string) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`
const aptEndpoint = 'https://api.settleonbase.xyz'
const showPaylinkSite = 'https://beamio.app'

const defaultTextTemp = `Sent with Beamio - no gas fees.`

// 0.8% fee, min 0.02, max 2 USDC
function calcFeeFromNumber(base: number) {
	if (!isFinite(base) || base <= 0) return 0;
	const raw = base * 0.008;
	const clamped = Math.min(Math.max(raw, 0.02), 2);
	return Number(clamped.toFixed(2));
}


function formatUserDate(timestamp?: string | number): string {
	if (!timestamp) return ""  // 无日期 → 空

	const num = Number(timestamp)
	if (!num) return ""        // 防止 NaN

	// 判断是秒还是毫秒（简易方式）
	const ms = num < 10_000_000_000 ? num * 1000 : num

	const d = new Date(ms)
	if (isNaN(d.getTime())) return ""  // 避免 Invalid Date

	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric"
	})
}

const formatCurrencyAmount = (n: number, c: ICurrency) => {
	const decimals = (c === "JPY" || c==='TWD') ? 0 : 2
	if (!Number.isFinite(n)) return "0"
	return n.toFixed(decimals)
}

const shortAddress = (addr: string) =>
	addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''

type Props = {
	close: (path: string) => void
	beamioer?: searchResult
}

export default function PaymentLink ({close, beamioer}: Props) {
	
	const [sendAmount, setSendAmount] = useState("")
	const [processing, setProcessing] = useState(false)
	const [amountError, setAmountError]  = useState(false)
	const [note, setNote] = useState("");
	const [defaultNodeText, setDefaultNodeText] = useState(defaultTextTemp)
	const [item, setItem] = useState<searchResult|null>(beamioer||null)
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<''|'ConformView'>('')
	const [focusAmount, setFocusAmount] = useState(false)
	const {usdcbalance, beamio, setCurrencyData, currencyData, myAddress, profiles } = useDaemonContext()
	const [sendError, setSendError] = useState("")
	const [message, senMessage] = useState<any>(null)
	const [successUrl, setSuccessUrl] = useState("")
	const [lockMode, setLockMode] = useState<PaymentLinkLockMode>("FIAT_LOCKED")
	const [currency, setCurrency] = useState<ICurrency>('USD')
	const [payAmount, setPayAmount] = useState("")
	const [requestNet, setRequestNet] = useState("")
	const [processError, setProcessError] = useState("")
	const [oneTimeMode, setOneTimeMode] = useState(false)
	const [linkTitle, setLinkTitle] = useState("")
	const [titleTouched, setTitleTouched] = useState(false)
	const titleError = titleTouched && linkTitle.trim().length === 0



	useEffect(() => {
		if (sendError) {
			setTimeout(() => {
				setSendError('')
			}, 2000)
		}
	}, [sendError])

	useEffect(() => {
		if (!beamio) return
		setCurrency(beamio.currency)
		
	}, [beamio])

	useEffect(() => {
		if (item) {
			setFocusAmount(true)
		} else {
			
		}
	}, [item])


	const usdcUsd = useMemo(() => Number((currencyData as any)?.USDC ?? 1), [currencyData])
	const usdToCur = (c: ICurrency) => (c === "USD" ? 1 : Number((currencyData as any)?.[c] ?? 1))

	const currencyToUsdcAmount = (cur: number, c: ICurrency) => {
		const u2u = usdcUsd || 1
		const u2c = usdToCur(c) || 1
		if (!u2u || !u2c) return 0
		return cur / u2c / u2u
	}

	function fxRateUSDCToCurrency(currency: ICurrency): number {
		// 1 USDC = ? USD
		const usdcToUSD = currencyData.USDC ?? 1

		if (currency === 'USD') return usdcToUSD

		const usdToCurrency = currencyData[currency]
		if (typeof usdToCurrency !== 'number') return usdcToUSD

		return usdcToUSD * usdToCurrency
	}


	const issueRequestLink = async () => {

		if (!profiles?.length||!beamio) {
			return
		}
		setTitleTouched(true)

		if (linkTitle.trim().length === 0) {
			return // ❌ 阻止提交
		}
		const currency = beamio.currency
		const numberAmount = Number(sendAmount)
		if (isNaN(numberAmount) || numberAmount <= 0) {
			return 
		}

		
		

		const showCurrencyNumber = lockMode === 'USDC_LOCKED' ? numberAmount.toFixed(4) : formatCurrencyAmount(numberAmount * fxRateUSDCToCurrency(currency), currency)
		
		
		setProcessing(true)
			/**
			 * 
			 * 		UI test
			 * 
			 */
	
		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setProcessError('RPC ERROR!')
		// }, 3000)

		const currencyData = lockMode === 'USDC_LOCKED' ? 'USDC': currency

		const paymeObj: payMe = {
			currency: currencyData,
			currencyAmount: showCurrencyNumber,
			oneTimeMode: !oneTimeMode,			// true= reusable, false= one-time	
			title: linkTitle.trim(),
		}
		

		const showNote = note + `\r\n` + JSON.stringify(paymeObj)
		
		
		const profile: profile = profiles[0]
		const code = generateCODE ('')


		const fixedAmount = ethers.parseUnits(showCurrencyNumber, 6).toString()
		const params = new URLSearchParams({amount: fixedAmount, code: code.hash, note:showNote, address: profile.keyID}).toString()
		const net = numberAmount - calcFeeFromNumber(numberAmount)
		const showNetCurrency = lockMode === 'USDC_LOCKED' ? net.toFixed(4) : formatCurrencyAmount(net * fxRateUSDCToCurrency(currency), currency)
		const showparams = new URLSearchParams({code: code.code}).toString()
		const requestUrl = `${aptEndpoint}/api/BeamioPaymentLink?${params}`
		const showUrl = `${showPaylinkSite}?${showparams}`

		setPayAmount(`${fiatPrefix(currency)} ${showCurrencyNumber}`)
		setRequestNet(`${fiatPrefix(currency)} ${showNetCurrency}`)

		/**
			 * 
			 * 		UI test
			 * 
			 */
		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setSuccessUrl(showUrl)
		// }, 1000)


		try {
			const res = await fetch(requestUrl, {method: 'GET'})

			setProcessing(false)
			if (res.status !== 200) {
				return setProcessError(`Beamio RPC Error!`)
			}
			console.log(note)
			setSuccessUrl(showUrl)

			

		} catch (ex) {
			setProcessing(false)
			return setProcessError(`Beamio RPC Error!`)
		}
		
	}

	return (
		<div className="mt-6 rounded-[22px] bg-white shadow-[0_12px_35px_rgba(15,23,42,0.08)] ring-1 ring-black/10 overflow-hidden">
			<div className="px-6 pt-4 pb-6 text-slate-800 leading-snug">
				<div className="text-slate-800 leading-snug">
					{
						successUrl ? 
							<SuccessShow note={note} successUrl={successUrl}
								currency={currency}
								lockMode={lockMode}
								payAmount = {payAmount}
								requestNet={requestNet}
								onReset={() => {
									close('')
								}}
								creatorEstUsdcFromFiat={sendAmount}
							/>
						
						 : (
							<div className="space-y-4">
								<div>
									<div className="text-lg font-semibold">Create Payment Link</div>
									
								</div>

								<div className="mt-5 flex items-center gap-3">
									

									<LockModeSegmented
										value={lockMode}
										onChange={val => {
										setLockMode(val)
										}}
									/>
								</div>
								
								<section className="input">
									<AmountCurrency 
										amount={sendAmount} 
										setAmount={setSendAmount} 
										autoEntry={!!!item} 
										readOnly={processing} 
										showLimit={0}
										setSendError={setSendError}
										sendError={sendError}
										showMax={false}
										needBalance={false}
										focusSignal={focusAmount}
										currencyUSDC={lockMode === 'USDC_LOCKED'}
									/>
								</section>
									
								{/* Payment Link Title */}
								<div className="space-y-1">
									<div className="text-[13px] font-semibold text-slate-500">
										Title <span className="text-red-500">*</span>
									</div>

									<input
										type="text"
										value={linkTitle}
										onChange={e => setLinkTitle(e.target.value)}
										onBlur={() => setTitleTouched(true)}
										placeholder="e.g. Coffee, Dinner, Invoice #1024"
										className={[
											"w-full rounded-[18px] px-4 py-3 text-[15px]",
											"bg-slate-50 placeholder-slate-400",
											"shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
											"focus:outline-none transition",
											titleError
												? "ring-2 ring-red-400 bg-red-50/40"
												: "ring-1 ring-black/10 focus:ring-2 focus:ring-[rgba(0,0,255,0.25)]"
										].join(" ")}
									/>
									
									{/* 错误提示 */}
									{titleError && (
										<div className="text-[12px] text-red-500 pl-1">
											Title is required
										</div>
									)}
								</div>

									{/* Note */}
									<div className="space-y-1">
									<div className="text-[13px] font-semibold text-slate-500">
										Note (optional)
									</div>

									<textarea
										value={note}
										onFocus={() => {
											if (note === defaultNodeText) setNote("")
										}}
										readOnly={!!message}
										placeholder="What's this for?"
										onChange={e => setNote(e.target.value)}
										rows={2}
										className="
											w-full
											rounded-[18px]
											bg-slate-50
											ring-1 ring-black/10
											px-4 py-3
											text-[14px] text-slate-900
											placeholder-slate-400
											shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]
											focus:outline-none
											focus:ring-2 focus:ring-[rgba(0,0,255,0.25)]
											resize-none
											transition
										"
									/>
								</div>

								{/* <div className="mt-5">

									<FeeInline
										payUsdc={Number(sendAmount)}
										currentCurrency={lockMode === 'USDC_LOCKED' ? 'USDC' :beamio?.currency||'USDC'}
									/>
								
								</div> */}
									<Onetime_reuse_Drag
										value={oneTimeMode}
										onChange={setOneTimeMode}
									/>
									
						
								
								<div className="mt-3 flex gap-3 w-full">
									
									<AppButton
										fullWidth
										onClick={issueRequestLink}
										loading={processing}
										errorText={processError}
									>

										Generate
									</AppButton>
								</div>
								
							</div>
						)
					}
					
				</div>
			</div>
			
		</div>
	)
}
