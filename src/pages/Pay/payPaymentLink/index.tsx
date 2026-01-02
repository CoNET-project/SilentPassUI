import React, {useRef, useState, useEffect, useMemo} from "react"
import {AuthorizationSign, aesGcmEncrypt, generateCODE, searchUsername} from '@/services/beamio'
import AmountCurrency from '@/components/input/AmountCurrency'
import { AppButton } from "@/components/button/AppButton"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {ethers} from 'ethers'
import LockModeSegmented from '@/pages/Pay/PaymentLink/LockModeSegmented'
import beamioConetCoreABI from '@/services/ABI/beamioConetCoreABI.json'
import SuccessShow from '../Cashcode/successShow'
import Securitycode from '@/components/input/Securitycode'
import ConformView from '@/pages/Pay/send/ConformView'
import BeamioDetail from '../components/beamioer'
import base_ex from '@/components/assets/base-ex.svg'

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
const beamioConetContract = {
	address: '0xCE8e2Cda88FfE2c99bc88D9471A3CBD08F519FEd',
	network: 'CONET DePIN',
	abi: beamioConetCoreABI,
	provider: new ethers.JsonRpcProvider('https://mainnet-rpc.conet.network'),
	
}
const CoreContract = new ethers.Contract(beamioConetContract.address, beamioConetContract.abi, beamioConetContract.provider)
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
	code: string
	address: string
}

const displayName = (item: searchResult) => {
	const lastname = item.last_name.split('\r\n')
	const fullName = `${item.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}

	const Success = ({messageData, close, successHash}: {messageData: any, close: () => void, successHash: string}) => {
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
								close()
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


export default function PayMeLink ({close, code, address}: Props) {
	
	const [sendAmount, setSendAmount] = useState("")
	const [processing, setProcessing] = useState(false)
	const [amountError, setAmountError]  = useState(false)
	const [note, setNote] = useState("");
	const [defaultNodeText, setDefaultNodeText] = useState(defaultTextTemp)
	
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<''|'ConformView'>('')
	const [focusAmount, setFocusAmount] = useState(false)
	const {usdcbalance, beamio, setCurrencyData, currencyData, myAddress, profiles, } = useDaemonContext()
	const [sendError, setSendError] = useState("")
	const [message, senMessage] = useState<any>(null)
	const [successUrl, setSuccessUrl] = useState("")
	const [lockMode, setLockMode] = useState<PaymentLinkLockMode>("FIAT_LOCKED")
	const [currency, setCurrency] = useState<ICurrency>('USD')
	const [successHash, setSuccessHash] = useState("")
	const [item, setItem] = useState<searchResult>()
	const [messageData, setMessageData] = useState<any>()

	
	const getitem = async () => {
		
		try {

			const [fx, item] = await Promise.all([
				CoreContract.getLinkMemo(code),
				searchUsername(address)
			])
			
			setItem(item?.results[0])
			const _nodeArray: string = fx?.node||''

			setNote(_nodeArray.split('\r\n')[0])
			
		} catch (ex: any) {
			console.log(`getInfo ex: ${ex.message}`)
		}
	}

	useEffect(() => {
		getitem()
	}, [])


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
				return setSendError('RPC Error!')
			}
			setSuccessUrl(data.showUrl)
			return setSuccessHash(body.USDC_tx)

		} catch (ex) {
			setProcessing (false)
			return setSendError('RPC Error!')
			
		}

	}

	const payLinkClick = async () => {
		if (amountError) {
			return
		}
		

		setProcessing(true)

		/**
		 * 			test uint
		 */

		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setShowPayButton(true)
		// 	setError("An error occurred, please try again later")
		// }, 2000)

		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setSuccessPayLink('0xb0be7e96fa60ca055c777884453270cecb82bc7ab237c6b831d98fb77b84ef0d')
			
		// }, 2000)

		
		const fixedAmount = ethers.parseUnits(sendAmount, 6)
		const params = new URLSearchParams({ amount: fixedAmount.toString(), code }).toString()
		const path = `/api/BeamioPaymentLinkFinish?${params}`
		const requestEndpoint = 'https://api.settleonbase.xyz' + path

		
		
		try {
			
			const response = await fetch(requestEndpoint, {
				method: 'GET'
			})
			
			

			if (response.status !== 402) {
				setProcessing(false)
				setSendError('RPC Error!')
				return
			}


			const { x402Version, accepts } = await response.json()
			setProcessing(false)
			const MessageData = accepts[0]
			const data = {
				node: note,
				sginTatle: 'Payment',
				reqUrl: requestEndpoint,
				amount: fixedAmount

			}
			MessageData.data = data
			senMessage(MessageData)
		

			
		} catch (ex) {
			setProcessing(false)
			setSendError('RPC Error!')
		}
		
		
	}



	return (
		<div className="mt-0 flex flex-col px-3 pt-3 pb-2 border-slate-100 bg-transparent">
  			<div className="mt-1 w-full bg-transparent">
				<div className="rounded-2xl shadow-sm p-3 text-slate-800 leading-snug bg-gray-100">
					{
						successHash ? 
							<Success 
								successHash={successHash}
								close={() => {
									close('/')
								}}
								messageData={message}
							/>
						
						 : (
							<div className="p-2 space-y-3 bg-transparent">
								<div>
									<div className="text-lg font-semibold">
										{
											message ? 'Confirm' : 'PayMe'
										}
								
									</div>
								</div>
								<BeamioDetail item={item}  />
								
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
											autoEntry={true}
											readOnly={processing} 
											showLimit={0.02}
											setError={setAmountError}
											showMax={true}
											needBalance={true}
											focusSignal={focusAmount}
											currencyUSDC={lockMode === 'USDC_LOCKED'}
										/>
									</section>
									<section className="mt-6">
										<span className="block text-[11px] font-medium text-slate-600 mb-1">
											Notes
										</span>
										<div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-slate-900">
											{note}
										</div>
									</section>
										{/* Note */}
										
										{
											message && (
												
													
													<div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 space-y-1">
														<div className="mt-2 w-full">
															<div className="flex items-center justify-between">
																<span>Network fee</span>
																<span className="font-medium text-emerald-700">
																	Paid by Beamio (0 gas)
																</span>
															</div>
															
															
															<div className="pt-1 border-t border-dashed border-slate-200 text-[10px] text-slate-500">
																This is a direct wallet-to-wallet send on Base. Beamio sponsors the
																gas, so you only pay exactly {Number(sendAmount).toFixed(4)} USDC.
															</div>
															
														</div>
													</div>
												
											)
										}
										<div className="mt-3 flex gap-3 w-full">
											{
												message && 
												<AppButton
													variant='secondary'
													fullWidth
													onClick={() => {
														senMessage(null)
													}}
												>
													Cancel
												</AppButton>
											}
											<AppButton
												fullWidth
												onClick={() => {
													if (!message) {
														return payLinkClick()
													}
													signRequest(message)
													
												}}
												loading={processing}
												errorText={sendError}
											>

												Continue
											</AppButton>
										</div>
								</section>
									

							</div>
						)
					}
					
				</div>
			</div>
			
		</div>
	)
}
