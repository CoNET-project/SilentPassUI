import React, {useRef, useState, useEffect, useMemo} from "react"
import {AuthorizationSign, aesGcmEncrypt, generateCODE, postToIPFS} from '@/services/beamio'
import AmountCurrency from '@/components/input/AmountCurrency'
import { AppButton } from "@/components/button/AppButton"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {ethers} from 'ethers'
import { X, Check, Plus } from "lucide-react"
import LockModeSegmented from '@/pages/Pay/PaymentLink/LockModeSegmented'
import DiceBearCard, {ClosePayload} from '@/components/card/CreateCard'
import FeeInline from './FeeInline'
import SuccessShow from './successShow'
import Securitycode from '@/components/input/Securitycode'
import ConformView from '@/pages/Pay/send/ConformView'
import giftEnvelope from '@/components/card/assets/giftEnvelope.svg'
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
const ipfsEndpoint = `https://ipfs.conet.network/api/getFragment?hash=`
const getImg = (avatarSeed: string) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`
const aptEndpoint = 'https://api.settleonbase.xyz'
const showPaylinkSite = 'https://beamio.app'

const defaultTextTemp = `Sent with Beamio - no gas fees.`

// 0.8% fee, min 0.02, max 2 USDC

function calcFeeFromNumber(base: number) {
	if (!isFinite(base) || base <= 0) return 0;
	const raw = base * 0.008;
	const clamped = Math.min(Math.max(raw, 0.02), 2);
	return Number(clamped.toFixed(4));
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
	const [showGiftEnvelope, setShowGiftEnvelope] = useState(false)
	const [valuecurrencyAmount, setValuecurrencyAmount] = useState("")
	const [processError, setProcessError] = useState("")
	const [securityCodeDigits, setSecurityCodeDigits] = useState("")
	const [cardCreate, setCardCreate] = useState(false)
	const [uploadingIPFS, setUploadingIPFS] = useState(false)
	const [showGiftImageError, setShowGiftImageError] = useState(false)
	const [currentCurrency, setCurrentCurrency] = useState<ICurrency>('USDC')
	const [addedNote, setAddedNote] = useState("")
	const [currencyAmount, setCurrencyAmount] = useState("")
	const [usdcAmount, setUsdcAmount] = useState("")


	useEffect(() => {
		if (showGiftImageError) {
			setTimeout(() => {
				setShowGiftImageError(false)
			}, 3000)
		}
	}, [showGiftImageError])

	const tryPostToIPFS = async (val: ClosePayload) => {
		if (!profiles) return
		setUploadingIPFS(true)
		const profile = profiles[0]
		const result = await postToIPFS(profile, val.bgBase64)
		setUploadingIPFS(false)
		if (!result) {
			setShowGiftImageError(true)
			return console.log (`tryPostToIPFS Error!`)
		}
		
			
		setShowGiftEnvelope(true)
		const addnote = {
			card: {
				title: val.title,
				detail: val.detail,
				image: `${ipfsEndpoint}${result}`,
				currency: lockMode=== 'USDC_LOCKED' ? 'USDC' : currentCurrency,
				currencyAmount: currencyAmount
			}
		}
		setAddedNote(JSON.stringify(addnote))

	}

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

	// useEffect(() => {
	// 	const usdc = Number(sendAmount)
	// 	const fee = calcFeeFromNumber(usdc)
	// 	const receiveUSDC = usdc - fee
	// 	setUsdcAmount(receiveUSDC.toFixed(4))
	// 	const curr = formatAmount(usdcToCurrencyAmount(Number(receiveUSDC), currentCurrency), currentCurrency)
	// 	const fiatText = `${fiatPrefix(currentCurrency)} ${curr}`
	// 	setCurrencyAmount(fiatText)

	// }, [sendAmount, currentCurrency, lockMode, beamio])


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

	const issueCashcode = async () => {

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
		let sendNote = note||defaultNodeText
		

		if (!encryText?.length) {
			setProcessing(false)
			return setProcessError('Generate Check error, try again!')
		}

		let _addnote = addedNote
		if (addedNote) {
			const tryAdd = JSON.parse(addedNote)
			const card = tryAdd.card
			const _data = {
				card: {
					title: card.title,
					detail: card.detail,
					image: card.image,
					currency: lockMode=== 'USDC_LOCKED' ? 'USDC' : currentCurrency,
					currencyAmount: currencyAmount
				}
			}
			_addnote = JSON.stringify(_data)
		}
		let postNode = `${note} \r\n${encryText}`
		postNode += _addnote ? `\r\n${_addnote}`: ''

		const params = new URLSearchParams({amount: display.pay.toFixed(4), note: postNode, secureCode: secureCode.hash}).toString()
		const showpParams = new URLSearchParams({cashcode: secureCode.code, secureCode: secureCode.hash}).toString()
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
				amount: sendAmount,
				fee: display.fee

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
						
						 : cardCreate ? (<>
						 	<DiceBearCard
								onClose={val => {
									setCardCreate(false)
									if (val) {
										tryPostToIPFS(val)
									}
								}}
								usdcAmount={usdcAmount}
								currencyText={currencyAmount}
							/>
						 </>):(
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
													currencyChange={val => setCurrentCurrency(val)}
												/>
											</section>

												<Securitycode securityCodeDigits={securityCodeDigits} setSecurityCodeDigits={setSecurityCodeDigits} />
													
												{/* Note */}
												{showGiftEnvelope && (
													<div className="flex justify-center">
														<div className="relative w-fit">
															<img
																src={giftEnvelope}
																className="w-24 block"
																alt="Gift Envelope"
															/>

															<button
																type="button"
																onClick={() => setShowGiftEnvelope(false)}
																className="
																absolute top-0 right-0 z-30
																translate-x-1/2 -translate-y-1/8
																w-7 h-7 rounded-full
																bg-white/10
																backdrop-blur-md
																border border-white/20
																shadow-[0_4px_10px_rgba(0,0,0,0.12)]
																hover:bg-white/20
																active:scale-95
																transition
																flex items-center justify-center
																"
																aria-label="Remove gift envelope"
															>
																<X className="w-4 h-4 text-black/30" />
															</button>
														</div>
													</div>
												)}
												{showGiftImageError && (
													<div className="flex justify-center">
														<p className="text-sm text-rose-600">
															An error occurred while uploading the image to IPFS. Please try again later.
														</p>
													</div>
												)}

												{uploadingIPFS && (
													<div className="flex justify-center">
														<p className="text-sm text-slate-600 flex items-center gap-1">
															Uploading image to IPFS, please wait
															<span className="inline-flex w-4">
																<span className="animate-dot">.</span>
																<span className="animate-dot delay-200">.</span>
																<span className="animate-dot delay-400">.</span>
															</span>
														</p>

														<style>{`
															.animate-dot { animation: blink 1.4s infinite both; }
															.delay-200 { animation-delay: 0.2s; }
															.delay-400 { animation-delay: 0.4s; }
															@keyframes blink {
																0% { opacity: 0.2; }
																20% { opacity: 1; }
																100% { opacity: 0.2; }
															}
														`}</style>
													</div>
												)}
												
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
													{
														!showGiftEnvelope && !message && <AppButton
															fullWidth
															variant="secondary"
															onClick={() => {
																setCardCreate(true)
															}}
														>
															Add Card image
														</AppButton>
													}
													<AppButton
														fullWidth
														onClick={issueCashcode}
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
