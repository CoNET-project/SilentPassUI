import React, {useRef, useState, useEffect, useMemo} from "react"

import {AuthorizationSign, aesGcmEncrypt, generateCODE} from '@/services/beamio'
import AmountCurrency from '@/components/input/AmountCurrency'
import { AppButton } from "@/components/button/AppButton"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {ethers} from 'ethers'
import LockModeSegmented from '@/pages/Pay/PaymentLink/LockModeSegmented'
import FeeInline from './FeeInline'
import SuccessShow from './successShow'
import Securitycode from '@/components/input/Securitycode'
import ConformView from '@/pages/Pay/send/ConformView'
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


function formatAmount(v: number, c: ICurrency) {
	if (!isFinite(v)) return `0 ${c}`
	return `${c ==='TWD'||c==='JPY' ? v.toFixed(0) : c ==='USDC' ? v.toFixed(4) : v.toFixed(2)}`
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
	const [valueUSDCAmount, setValueUSDCAmount] = useState("")
	const [payedUSDC, setPayedUSDC] = useState(0)
	const [successHash, setSuccessHash] = useState("")

	const [valuecurrencyAmount, setValuecurrencyAmount] = useState("")
	const [processError, setProcessError] = useState("")
	const [securityCodeDigits, setSecurityCodeDigits] = useState("")


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

	function usdcToCurrencyAmount(usdc: number, c: ICurrency) {
		const rate = fxRateUSDCToCurrency(c)
		return usdc * rate
	}


	const signRequest = async (messageDataRe: any) => {
		
		setProcessing (true)

		const paymentHeader = await AuthorizationSign(messageDataRe.maxAmountRequired, messageDataRe.payTo)
		const newInit = {
			method: 'GET',
			headers: {
				
				"X-PAYMENT": paymentHeader,
				"Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE"
			},
			__is402Retry: true
		}

		const data = messageDataRe.data

		const reqUrl = data.reqUrl
		try {
			const secondResponse = await fetch(reqUrl, newInit)
			const body = await secondResponse.json()
			console.log(secondResponse.ok)
			setProcessing (false)
			if (!secondResponse.ok) {
				return setProcessError('RPC Error!')
			}
			setSuccessUrl(data.showUrl)
			return setSuccessHash(body.USDC_tx)

		} catch (ex) {
			setProcessing (false)
			return setProcessError('RPC Error!')
			
		}

	}

	const issueRequestLink = async () => {

		if ( !profiles?.length || !beamio) {
			return
		}

		if (securityCodeDigits.length > 0 &&  securityCodeDigits.length < 6) {
			return
		}

		const currency = beamio.currency
		const numberUSDCAmount = Number(sendAmount)
		if (isNaN(numberUSDCAmount) || numberUSDCAmount < 0.1) {
			return 
		}

		if (usdcbalance - numberUSDCAmount < 0) {
			return
		}

		const feeUsdc = calcFeeFromNumber(numberUSDCAmount)
		
		const display = {
			pay: numberUSDCAmount,
			fee: feeUsdc,
			receive: numberUSDCAmount - feeUsdc,
		}

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

		const secureCode = generateCODE(securityCodeDigits)
		
		
		const profile: profile = profiles[0]

		const data = {secureCode: secureCode.code, securityCodeDigits}
		const encryText = await aesGcmEncrypt(JSON.stringify(data), profile.privateKeyArmor)


		if (!encryText?.length) {
			setProcessing(false)
			return setProcessError('Generate Check error, try again!')
		}


		const postNode = (note) + '\r\n' + encryText
		const params = new URLSearchParams({amount: display.pay.toFixed(4), note: postNode, secureCode: secureCode.hash}).toString()
		const showpParams = new URLSearchParams({cashcode: secureCode.code}).toString()
		const path = `/api/generateCheck?${params}`


		const fixedAmount = ethers.parseUnits(display.pay.toString(), 6).toString()
		
		const showNetCurrency = formatCurrencyAmount(display.receive * fxRateUSDCToCurrency(currency), currency)
		const showUrl = `${showPaylinkSite}?${showpParams}`


		const url = aptEndpoint + path
		const requestEndpoint = `${showPaylinkSite}?${showpParams}`
		
		setValueUSDCAmount(`${display.receive}`)
		setValuecurrencyAmount(`${fiatPrefix(currency)} ${showNetCurrency}`)
		setPayedUSDC(display.pay)

		/**
			 * 
			 * 		UI test
			 * 
			 */
		// setTimeout(() => {
		// 	setSuccessHash('0xffff')
		// 	setProcessing(false)
		// 	setSuccessUrl(showUrl)
		// }, 1000)


		try {
			const response = await fetch(url, {
				method: 'GET'
			})
			if (response.status !== 402) {
				setProcessing(false)
				return setProcessError('RPC Error!')
			}

			const { x402Version, accepts } = await response.json()
			const MessageData = accepts[0]
			const data = {
				showUrl,
				node: note,
				sginTatle: 'Cashcode',
				reqUrl: url,
				amount: sendAmount

			}
			MessageData.data = data
			senMessage(MessageData)
			setShowAlphaHowItWorks('ConformView')
			setProcessing(false)

		} catch (ex: any) {
			setProcessing(false)
			setProcessError('RPC Error!')
		}
		

		
	}

	return (
		<div className="mt-0 flex flex-col px-3 pt-3 pb-2 border-slate-100 bg-transparent">
  			<div className="mt-1 w-full bg-transparent">
				<div className="rounded-2xl shadow-sm p-3 text-slate-800 leading-snug bg-gray-100">
					{
						successUrl ? 
							<SuccessShow note={note} successUrl={successUrl}
								security={!!securityCodeDigits}
								lockMode={lockMode}
								valueUSDCAmount = {valueUSDCAmount}
								successHash={successHash}
								onReset={() => {
									close('')
								}}
								valueCurrencyAmount={valuecurrencyAmount}
							/>
						
						 : (
							<div className="p-2 space-y-3 bg-transparent">
								<div>
									<div className="text-lg font-semibold">
										{
											message ? 'Confirm' : 'Create Cashcode'
										}
								
									</div>
								</div>

								{
									message ? (
										<>
											{/* Note */}
												{
													note && <textarea
														value={note}
														onFocus={(e) => {
															if (note === defaultNodeText) {
																setNote('') // 清空默认文本
															}
														}}
														readOnly={true}
														rows={2}
														className="w-full rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
													/>
												}

												<div className="mt-5">

													<FeeInline
														payUsdc={Number(sendAmount)}
														isUSDC={lockMode === 'USDC_LOCKED'}
													/>
												
												</div>
												
											<ConformView
												messageData={message}
											 />

											<div className="grid grid-cols-2 gap-3">
												{!processing && (
													<AppButton
														fullWidth
														variant="secondary"
														onClick={() => {
															senMessage('')
														}}
													>
													Cancel
													</AppButton>
												)}

												<div className={processing ? "col-span-2" : ""}>
													<AppButton
														fullWidth
														loading={processing}
														onClick={() => {
															signRequest(message)
														}}
													>
														Confirm
													</AppButton>
												</div>
											</div>
										</>
									) : (
										<>
										<section className="input form">
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
													showLimit={0.1}
													setError={setAmountError}
													showMax={true}
													needBalance={true}
													focusSignal={focusAmount}
													currencyUSDC={lockMode === 'USDC_LOCKED'}
													feePlus={true}
												/>
											</section>

												<Securitycode securityCodeDigits={securityCodeDigits} setSecurityCodeDigits={setSecurityCodeDigits} />
													
												{/* Note */}
												
												<textarea
													value={note}
													onFocus={(e) => {
														if (note === defaultNodeText) {
															setNote('') // 清空默认文本
														}
													}}
													
													placeholder="What's this for?"
													onChange={(e) => {
														setNote(e.target.value)
													}}
													rows={2}
													className="w-full rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
												/>

												<div className="mt-5">

													<FeeInline
														payUsdc={Number(sendAmount)}
														isUSDC={lockMode === 'USDC_LOCKED'}
													/>
												
												</div>
												
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
										</section>
										</>
									)
								}

								

								
								
							</div>
						)
					}
					
				</div>
			</div>
			
		</div>
	)
}
