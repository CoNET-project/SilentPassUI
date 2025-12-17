import React, {useRef, useState, useEffect} from "react"
import SearchInputWithDropdown from '@/components/Home/SearchBarWithResults'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowLeft,
  Camera,
  Check,
  Search,
  ChevronRight,
  X,
  Copy,
  ExternalLink,
} from "lucide-react"
import {AuthorizationSign, getBalanceProcess} from '@/services/beamio'
import AmountCurrency from '@/components/input/AmountCurrency'
import { AppButton } from "@/components/button/AppButton";
import {motion, AnimatePresence } from "framer-motion"
import { createPortal } from 'react-dom';
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import { useDaemonContext } from "@/providers/DaemonProvider"
import ConformView from './ConformView'
import {ethers} from 'ethers'
import base_ex from '@/components/assets/base-ex.svg'


const getImg = (avatarSeed: string) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`
const aptEndpoint = 'https://api.settleonbase.xyz'

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

export default function PayScreen ({close, beamioer}: Props) {
	
	const [sendAmount, setSendAmount] = useState("")
	const [processing, setProcessing] = useState(false)
	const [amountError, setAmountError]  = useState(false)
	const [note, setNote] = useState("");
	const [defaultNodeText, setDefaultNodeText] = useState(defaultTextTemp)
	const [item, setItem] = useState<searchResult|null>(beamioer||null)
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<''|'ConformView'>('')
	const [focusAmount, setFocusAmount] = useState(false)
	const {usdcbalance, beamio, setCurrencyData, currencyData, myAddress } = useDaemonContext()
	const [sendError, setSendError] = useState("")
	const [message, senMessage] = useState<any>(null)
	const [successHash, setSuccessHash] = useState("")

	const selectItem = (item: searchResult) => {
		setItem(item)
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
		} else {
			
		}
	}, [item])

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
		const sendNote = note||defaultNodeText
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

	return (
		<div className="mt-0 flex items-center justify-between px-6 pt-4 pb-3 border-slate-100 flex-col">
			<div className="mt-2 w-full">
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
									/>
								</section>


								
								{/* Note */}
								{
									!message && (
										<textarea
											value={note}
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
											<div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-[12px] text-yellow-900 space-y-1">
												{note}
											</div>
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
									<AppButton
										fullWidth
										onClick={message ? signRequest : onPay}
										loading={processing}
										errorText={sendError}
									>

										{message ? 'Conform': 'Send'}
									</AppButton>
								</div>
								
							</CardContent>
						)
					}
					
				</Card>
			</div>
		</div>
	)
}
