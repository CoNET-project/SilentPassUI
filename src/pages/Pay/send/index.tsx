import React, {useRef, useState, useEffect} from "react"
import SearchInputWithDropdown from '@/components/Home/SearchBarWithResults'
import { Card, CardContent } from "@/components/ui/card"
import {AuthorizationSign, getBalanceProcess, postToIPFS} from '@/services/beamio'
import AmountCurrency from '@/components/input/AmountCurrency'
import { AppButton } from "@/components/button/AppButton"
import { useDaemonContext } from "@/providers/DaemonProvider"
import ConformView from './ConformView'
import base_ex from '@/components/assets/base-ex.svg'
import DiceBearCard, {ClosePayload} from '@/components/card/CreateCard'
import giftEnvelope from '@/components/card/assets/giftEnvelope.svg'
import { X, Check, Plus } from "lucide-react"

const getImg = (avatarSeed: string) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`
const aptEndpoint = 'https://api.settleonbase.xyz'
const ipfsEndpoint = `https://ipfs.conet.network/api/getFragment?hash=`

const defaultTextTemp = `Sent with Beamio - no gas fees.`

const displayName = (item: searchResult) => {
	const lastname = item.last_name.split('\r\n')
	const fullName = `${item.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
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

const shortAddress = (addr: string) =>
	addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''

type Props = {
	close: (path: string) => void
	beamioer?: searchResult
}

const CURRENCY_META: Record<
  ICurrency,
  { flag: string; symbol: string; label: string }
> = {
  USD: { flag: "🇺🇸", symbol: "$", label: "USD" },
  CAD: { flag: "🇨🇦", symbol: "$", label: "CAD" },
  EUR: { flag: "🇪🇺", symbol: "€", label: "EUR" },
  JPY: { flag: "🇯🇵", symbol: "¥", label: "JPY" },
  CNY: { flag: "🇨🇳", symbol: "¥", label: "CNY" },
  HKD: { flag: "🇭🇰", symbol: "$", label: "HKD" },
  TWD: { flag: "🇹🇼", symbol: "$", label: "TWD" },
  SGD: { flag: "🇸🇬", symbol: "$", label: "SGD" },
  USDC: {flag:"", symbol: "", label: ""}
};

function fiatPrefix(ccy: ICurrency) {
	if (ccy === "CAD") return "CA$"
	if (ccy === "USD") return "$"
	if (ccy === "EUR") return "€"
	if (ccy === "JPY") return "JP¥"
	if (ccy==='TWD') return "NT$"
	if (ccy==='CNY') return 'CN¥'
	if (ccy==='HKD') return 'HK$'
	if (ccy==='SGD') return 'SG$'

  return CURRENCY_META[ccy].symbol;
}

function formatAmount(v: number, c: ICurrency) {
	if (!isFinite(v)) return "0"

	const decimals =
		c === "TWD" || c === "JPY"
			? 0
			: c === "USDC"
			? 4
			: 2

	return v.toLocaleString("en-US", {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	})
}



export default function PayScreen ({close, beamioer}: Props) {
	
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
	const [successHash, setSuccessHash] = useState("")
	const [cardCreate, setCardCreate] = useState(false)
	const [usdcAmount, setUsdcAmount] = useState("")
	const [currencyAmount, setCurrencyAmount] = useState("")
	const [currentCurrency, setCurrentCurrency] = useState<ICurrency>('USDC')
	const [showGiftEnvelope, setShowGiftEnvelope] = useState(false)
	const [showGiftImageError, setShowGiftImageError] = useState(false)
	const [uploadingIPFS, setUploadingIPFS] = useState(false)
	const [addedNote, setAddedNote] = useState("")

	const selectItem = (item: searchResult) => {
		setItem(item)
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


	useEffect(() => {
		if (sendError) {
			setTimeout(() => {
				setSendError('')
			}, 2000)
		}
	}, [sendError])

	useEffect(() => {
		if (item) {
			setFocusAmount(true)
		}
	}, [item])

	useEffect(() => {
		if (showGiftImageError) {
			setTimeout(() => {
				setShowGiftImageError(false)
			}, 3000)
		}
	}, [showGiftImageError])



	useEffect(() => {
		const usdc = formatAmount(Number(sendAmount), 'USDC')
		setUsdcAmount(usdc)
		const curr = formatAmount(usdcToCurrencyAmount(Number(sendAmount), currentCurrency), currentCurrency)
		const fiatText = `${fiatPrefix(currentCurrency)} ${curr}`
		setCurrencyAmount(fiatText)

	}, [sendAmount, currentCurrency])



	const Success = ({messageData}: {messageData: any}) => {
			const data: IMessageData =messageData.data
			return (
				<div className="flex-1 px-5 pt-6 pb-8 flex flex-col items-center justify-center
								bg-transparent text-inherit">

					{/* 蓝色圆圈 ✔ */}
					<div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl">
						✓
					</div>

					{/* 成功文字 */}
					<div className="font-semibold text-slate-600 dark:text-slate-300 mb-2 mt-4">
						{/cashcode/i.test(messageData?.sginTatle) ? 'Cashcode Created' : 'Successfully sent' } 
					</div>

					{/* 金额 */}
					<div className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mb-2">
						{data.amount} USDC
					</div>

					{/* 提示 */}
					<div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
						{/cashcode/i.test(messageData?.sginTatle) ? 'Share this Beamio Cashcode as a link, QR, or redeem code.' : 'This may take a few seconds to appear for the receiver.' } 
					</div>

				
					

					{/* 按钮组 */}
					<div className="w-full space-y-3">

						{/* 完成按钮 */}
						<button
							className="w-full h-11 rounded-full
									bg-blue-600 text-white
									text-sm font-medium"
							onClick={() => {
								close('/')
							}}
						>
							Done
						</button>

						{/* 查看交易按钮 */}
						<button
							className="
								w-full h-11 rounded-full
								bg-black/5 text-slate-700
								dark:bg-white/10 dark:text-slate-100
								text-sm
								flex items-center justify-center gap-2
							"
							onClick={() => {
								window.open(`https://basescan.org/tx/${successHash}`, '_blank', 'noopener,noreferrer')
							}}
							>
							<img
								src={base_ex}
								alt="Base Explorer"
								className="w-4 h-4 object-contain"
							/>
							<span>
								View transaction
							</span>
						</button>
					</div>
				</div>
			)
	}


	const signRequest = async () => {
			
		setProcessing(true)

		const paymentHeader = await AuthorizationSign(message.maxAmountRequired, message.payTo)
		const newInit = {
			method: 'GET',
			headers: {
				
				"X-PAYMENT": paymentHeader,
				"Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE"
			},
			__is402Retry: true
		}

		const reqUrl = message.data.reqUrl
		try {
			const secondResponse = await fetch(reqUrl, newInit)
			const body = await secondResponse.json()
			
			setProcessing(false)
			if (!secondResponse.ok) {
				return setSendError('RPC Error!')
			}

			return setSuccessHash(body.USDC_tx)

		} catch (ex) {
			setProcessing(false)
			return setSendError('RPC Error!')
			
		}

	}

	const onPay = async () => {
		const amount = Number(sendAmount)
		if ( amount <= 0 || amount > usdcbalance || !item ||!beamio ||!myAddress) {
			return
		}
		const bo = beamio
		const toAddress = item.address

		let sendNote = note||defaultNodeText
		if (addedNote) {
			sendNote += `\r\n${addedNote}`
		}
		const params = new URLSearchParams({amount: sendAmount, toAddress: toAddress, note: sendNote }).toString()
		const path = `/api/BeamioTransfer?${params}`
		const requestEndpoint = aptEndpoint + path
		setProcessing(true)
		try {
					
			const response = await fetch(requestEndpoint, {
				method: 'GET'
			})
			setProcessing(false)

			if (response.status !== 402) {
				
				return setSendError('RPC Error!')
			}

			const { x402Version, accepts } = await response.json()
			const MessageData = accepts[0]
			const data: IMessageData = {
				receive: {
					accountName: item.username,
					firstName: item.first_name,
					lastName: item.last_name,
					address: item.address,
					image: item.image
				},
				sender: {
					accountName: bo.accountName||'',
					firstName: bo.firstName||'',
					lastName: bo.language,
					address: myAddress,
					image: bo.image
				},
				node: sendNote,
				sginTatle: 'send',
				reqUrl: requestEndpoint,
				amount: sendAmount
			}
			MessageData.data = data
			senMessage(MessageData)
			setShowAlphaHowItWorks('ConformView')
		} catch (ex) {
			setProcessing(false)
			setSendError('RPC Error!')
		}

	}

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
				currency: currentCurrency,
				currencyAmount: currencyAmount
			}
		}
		setAddedNote(JSON.stringify(addnote))

	}

	return (
		<div className="mt-0 flex flex-col items-center px-6 pt-4 pb-3 border-slate-100">
			<div className="mt-6 mb-4 w-full flex justify-center gap-2">
				<Card className="rounded-3xl border-zinc-200">
					{
						successHash ? (
							<>
								<CardContent className="p-4 space-y-4">
									<Success messageData={message} />
								</CardContent>
							</>
						) : (
							<CardContent className="p-4 space-y-4">
								{
									cardCreate ? (<>
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
									</>) : (<>
										{
											!item && (
												<section className="mb-4">
													<SearchInputWithDropdown 
														readonly={false}
														showHistory={false}
														close={item => {
															if (typeof item !== 'string') {
																selectItem(item)
															}
														
														}}
														showBackIcon={false}
														select={true}
													/>
												</section>
											)
										}

										{
											item && (
												<div
													className="
														w-full flex items-center
														px-3 py-2.5
														text-left
														rounded-2xl
														bg-sky-50
														hover:bg-sky-100
														active:scale-[0.99]
														transition
														relative
													"
													onClick={() => {}}
												>
													{/* 右上角：X 关闭按钮 */}
													{
														!message && (
																<button
																	type="button"
																	aria-label="Close"
																	onClick={(e) => {
																		e.stopPropagation()
																		setItem(null)
																	}}
																	className="
																		absolute top-1.5 right-1.5
																		h-7 w-7
																		rounded-full
																		bg-white/70
																		backdrop-blur
																		border border-sky-200/60
																		text-slate-500
																		flex items-center justify-center
																		shadow-sm
																		transition
																		hover:bg-white
																		hover:text-slate-700
																		active:scale-90
																		active:ring-4 active:ring-sky-200/50
																	"
																>
																	<span className="text-[16px] leading-none">×</span>
																</button>
														)
													}
													

													{/* 头像 */}
													{item.image ? (
														<img
															src={item.image}
															alt={item.username}
															className="w-7 h-7 rounded-full object-cover mr-2 flex-shrink-0"
														/>
													) : (
														<img
															src={getImg(item.username)}
															alt={item.username}
															className="w-7 h-7 rounded-full object-cover mr-2 flex-shrink-0 bg-sky-200"
														/>
													)}

													{/* 中间 + 右侧整体 */}
													<div className="flex-1 flex items-start justify-between gap-3 min-w-0 pr-7">
														{/* 左侧文本 */}
														<div className="flex flex-col min-w-0">
															<span className="text-[13px] font-medium text-slate-900 truncate">
																{displayName(item)}
															</span>

															<span className="text-[11px] text-slate-600 truncate">
																@{item.username} · {shortAddress(item.address)}
															</span>

															<span className="text-[11px] text-slate-500 mt-0.5 truncate">
																{Number(item.follow_count || '0').toLocaleString()} following ·{' '}
																{Number(item.follower_count || '0').toLocaleString()} followers
															</span>
														</div>

														{/* 右侧日期 */}
														<span className="text-[10px] text-slate-400 whitespace-nowrap">
															{formatUserDate(item.created_at)}
														</span>
													</div>
												</div>
											)
										}
										<section className="input">
											<AmountCurrency 
												amount={sendAmount} 
												setAmount={setSendAmount} 
												autoEntry={!!!item} 
												readOnly={processing} 
												showLimit={0}
												setError={setAmountError}
												showMax={true}
												needBalance={true}
												focusSignal={focusAmount}
												currencyChange={val => setCurrentCurrency(val)}
											/>
										</section>
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

										
										{/* Note */}
										{
											!message &&(
												<textarea
													value={note.split('\r\n')[0]}
													onFocus={(e) => {
														if (note === defaultNodeText) {
															setNote('') // 清空默认文本
														}
													}}

													readOnly={!!message}
													
													placeholder="What's this for?"
													onChange={(e) => {
														setNote(e.target.value)
													}}
													rows={2}
													className="w-full rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
												/>
											)
										}

										
										
										{
											message && (
												<>
													{
														note && <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-[12px] text-yellow-900 space-y-1">
															{note}
														</div>
													}
													
													<div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 space-y-1">
														<ConformView messageData={message}  />
													</div>
												</>
											)
										}
										<div className="mt-3 flex gap-3 w-full">
											{
												message && !processing && (
													<AppButton
														variant='secondary'
														fullWidth
														onClick={() => {
															senMessage(null)
														}}
													>

														Cancel
													</AppButton>
												)
											}
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
												onClick={message ? signRequest : onPay}
												loading={processing}
												errorText={sendError}
											>

												{message ? 'Conform': 'Send'}
											</AppButton>
										</div>
										
									</>)
								}
								
								
							</CardContent>
						)
					}
					
				</Card>
			</div>
		</div>
	)
}
