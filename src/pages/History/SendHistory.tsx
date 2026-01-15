import {
  useMemo,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react"
import { beamioConet } from "@/utils/constants"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { ethers } from "ethers"
import {HistoryFilterTabs} from './HistoryFilterTabs'
import {RedeemOrLinkCard} from './showHistoryDetail'
import giftEnvelope from '@/components/card/assets/giftEnvelope.svg'
import base_ex from '@/components/assets/base-ex.svg'
import {getBalanceProcess, formatWithThousands, aesGcmDecrypt, searchUsername, } from '@/services/beamio'
import BallSequence from '@/components/loading/BallSequence'
import { QrCode, Link as LinkIcon, ZapOff, CalendarCheck, Banknote, HelpCircle, Loader, ArrowUpRight, ChevronLeft } from "lucide-react"
import AccountBeo from './AccountBea'
import ShowCard from '@/components/card/ShowCard'
import {TransactionsItemDetail} from './TransactionsItemDetail'
import {fiatPrefix, formatAmount, formatTimev2, calcFeeFromReceived} from '@/services/currency'
import ShowPaymentLink from './PaymentLink/index'
import NavigateLeftButton from '@/components/navigate'
import { useNavigate, useLocation } from 'react-router-dom'




type CheckHistory = {
	from: string
    successAuthorizationHash: string
    chianID: bigint
    erc3009Address: string
    node: string
    amount: bigint
    decimals: bigint
    createTimestamp: bigint 
    depositHash: string
    depositTimestamp: bigint 
    to: string
    payHash: string
}

// 0.8% fee, min 0.02, max 2 USDC
function calcFeeFromNumber(base: number) {
	if (!isFinite(base) || base <= 0) return 0;
	const raw = base * 0.008;
	const clamped = Math.min(Math.max(raw, 0.02), 2);
	return Number(clamped.toFixed(4));
}






const showPaylinkSite = 'https://beamio.app'


const getBadgeClass = (type: HistoryFilter) => {
	switch (type) {
		case 'sent':
		return "bg-slate-300/35 text-slate-700 dark:bg-slate-700/35 dark:text-slate-200"

		case 'received':
		return "bg-emerald-300/35 text-emerald-700 dark:bg-emerald-700/35 dark:text-emerald-200"

		case 'pending':
		return "bg-amber-200/40 text-amber-700 dark:bg-amber-700/35 dark:text-amber-200"

		case 'completed':
		// 淡蓝色，对应 Completed tab 的默认态
		return "bg-sky-300/35 text-sky-800 dark:bg-sky-700/35 dark:text-sky-200"

		case 'reject':
		return "bg-rose-300/35 text-rose-700 dark:bg-rose-700/35 dark:text-rose-200"

		// request 专用：Withdraw（紫色）
		case 'paid':
		return "bg-fuchsia-300/35 text-fuchsia-800 dark:bg-fuchsia-700/35 dark:text-fuchsia-200"

		// cashcode 专用：Deposited（靛蓝）
		case 'deposited':
		return "bg-indigo-300/35 text-indigo-800 dark:bg-indigo-700/35 dark:text-indigo-200"

		// 一般不会有 'all' 出现在单条记录里，兜底给个中性灰
		case 'all':
		default:
		return "bg-slate-700/20 text-slate-800 dark:bg-white/10 dark:text-slate-200"
	}
}

// 用 forwardRef 包装
export const SendHistoryTable = (
  () => {
    const [items, setItems] = useState<TransferHistork[]>([])
    const navigate = useNavigate()
    const {profiles, setUsdcbalance, usdcbalance, myAddress, setUsdcToUSD, usdcToUSD, setMyAddress, setShowFooter, currencyData, setNavigateLeftButtonArray} = useDaemonContext()
	const [processing, setpProcessing] = useState(false)
	const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all')
	const [loading, setLoading] = useState(false)
	const [loadingFilter, setLoadingFilter] = useState<HistoryFilter | null>(null)
	const [showDetail, setShowDEtail] = useState(false)
	const [isPay, setIsPay] = useState(false)
	const [amt, setAmt] = useState(0)
	const [successUrl, setSuccessUrl] = useState("")
	const [tip, setTip] = useState(0)
	const [note, setNote] = useState("")
	const [fee, setFee] = useState(0)
	const [createdDate, setCreatedDate] = useState(0)
	const [type, setType] = useState<HistoryFilter>('paid')
	const [account, setAccount] = useState("")
	const [preAmount, setPreAmount] = useState(0)

	const [securityCode, setSecurityCode] = useState("")
	const [redeemCode, setRedeemCode] = useState("")
	const [hash, setHash] = useState("")

	const [localMode, setLocalMode] = useState<Mode>('pay')
	const [showGiftCard, setShowGiftCard] = useState<IImageCard|null>(null)
	const [itemTx, setItemtx] = useState<TransferHistork>()

	useEffect(() => {
		getBalanceProcess(myAddress,setUsdcbalance, setUsdcToUSD )
		if (!localMode) {
			setLocalMode ('pay')
			return
		}
		getTransferNewitems(null)
		
	}, [localMode])
	
	const [filter, setFilter] = useState<HistoryFilter>('all')
	
	const runWithMinProcessing = async (fn: () => Promise<any>) => {
		setpProcessing(true)

		const start = Date.now()

		await fn()

		const elapsed = Date.now() - start
		const MIN = 500

		if (elapsed < MIN) {
			setTimeout(() => setpProcessing(false), MIN - elapsed)
		} else {
			setpProcessing(false)
		}
	}

	const usdcUsd = useMemo(() => Number((currencyData as any)?.USDC ?? 1), [currencyData])
	const usdToCur = (c: ICurrency) => (c === "USD" ? 1 : Number((currencyData as any)?.[c] ?? 1))

	const currencyToUsdcAmount = (cur: number, c: ICurrency) => {
		const u2u = usdcUsd || 1
		const u2c = usdToCur(c) || 1
		if (!u2u || !u2c) return 0
		return cur / u2c / u2u
	}

	const process = async (next: HistoryFilter | null) => {
		if (!profiles?.length || !localMode) return
		const profile: profile = profiles[0]
		let address = profile.keyID
		if (!myAddress) {
			setMyAddress(address)
		}
		setpProcessing(true)
		console.log(`getAllHistory called, balance = ${usdcbalance}`)

		const myAddrLocal = address.toLowerCase()

		let mapped: TransferHistork[], mappedLing: TransferHistork[], mappedCheck: TransferHistork[]
		try {
			
			const [_transfer, _links, _checks] = await Promise.all([
				beamioConet.getTransferHistory(address, 0, 100),
				beamioConet.getLinksHistory(address, 0, 100),
				beamioConet.getCheckHistory(address, 0, 100)
			])
			
			const transfer: Transfer[] = _transfer[1]
			
			mapped = transfer.map(n => {
				let requestDetail: IRequestCurrencyDetail|undefined = undefined
				const amount = Number(ethers.formatUnits(n.amount, 6))
				let card: IImageCard|null = null
				let payme: payMe|null = null
				const nodeEX = n?.note?.split('\r\n')

				//		try get currency data
				let paymeData = nodeEX.length -1

				try {
					if (paymeData > -1) {
						payme = JSON.parse(nodeEX[paymeData--])
					}
					
					
				} catch (ex) {
					paymeData ++
				}

				//		try get card data
				try {
					if (paymeData > -1) {
						const cardData = JSON.parse(nodeEX[paymeData --])
						card = cardData?.card || cardData
					}
					
				} catch (ex) {
					paymeData ++
				}

				
				const _amount = Number(payme?.currencyAmount)

				if( payme?.currency && fiatPrefix(payme.currency) && !isNaN(_amount) && _amount > 0) {
					const currencyRate = Number(payme.currencyAmount)/amount 
					requestDetail = {
						requestCurrency: payme.currency,
						totalPayCurrency: Number(payme.currencyAmount),
						totalPayUSDC: amount,
						feeCurrency: 0,
						feeUSDC: 0,
						receivedCurrency: Number(payme.currencyAmount),
						receivedUSDC: amount,
						currencyTip: 0,
						USDCTip: 0,
						rate: currencyRate,
						title: payme?.title,
						textNote: paymeData > -1 ? nodeEX[paymeData] : ''
					}
				}

				const ret: TransferHistork = {
					date: Number(n.timestamp * BigInt(1000)),
					amount: Number(ethers.formatUnits(n.amount, 6)),
					address: n.from.toLowerCase() === myAddrLocal ? n.to.toLowerCase() : n.from.toLowerCase(),
					hash: n.finisedHash,
					requestCurrency: payme?.currency||'USDC',
					note: n.note,
					type: myAddrLocal === n.to.toLowerCase() ? 'received' : 'sent',
					mode: 'pay',
					fee: 0,
					type1: myAddrLocal === n.to.toLowerCase() ? 'received' : 'sent',
					preAmount: Number(ethers.formatUnits(n.amount, 6)),
					requestDetail
				}
				if (card?.image) {
					ret.card = card
				}

				return ret
			})
			
			const links: LinksHistory[] = _links[1]
			mappedLing = links.map(n => {
				const isRequest = n.from.toLowerCase() === myAddrLocal
				
				const isPending = isRequest ? n.to === ethers.ZeroAddress : n.from === ethers.ZeroAddress
				
				const isReject = isRequest ?  n.to === '0x1000000000000000000000000000000000000000' : n.from === '0x1000000000000000000000000000000000000000'
				const account = (isPending||isReject) ? '' : isRequest ? n.to : n.from
				
				const payAmount = Number(ethers.formatUnits(n.payAmount, 6))
				const _amount =  Number(ethers.formatUnits(n.amount, 6))

				const _requestCurrencyData = n?.node?.split('\r\n')

				const ooo = _requestCurrencyData[_requestCurrencyData.length - 1]
				let requestCurrency: ICurrency = 'USDC'
				let kkk: payMe|null
				let group: paymentType = 'onetime'
				let requestDetail: IRequestCurrencyDetail|undefined = undefined
				let type: HistoryFilter = isPending ? 'pending' : isRequest ? 'sent' : 'received'
				
				
				try {
					kkk = JSON.parse(ooo)
						if (kkk) {
							requestCurrency = kkk.currency
							if (typeof kkk?.oneTimeMode === 'undefined') {
								group = 'payme'
							} else {
								group = kkk.oneTimeMode ? 'onetime' : 'reusable'
							}
							
						}
						
					
						let totalPayUSDC = payAmount
						
						
							//		totalPayUSDC: totalPayCurrency = 1:x
						
							//		isRequest : calcFeeFromNumber(totalPayUSDC)
							//		!isRequest :  totalPayUSDC + fee = realRequestAmount, fee = calcFeeFromNumber(realRequestAmount); realRequestAmount = 
						
						
						//		n.amount 在request 时是 currency request，n.payAmount 是实际支付的USDC （没有扣除手续费）
						//		payMe时 n.payAmount === n.amount

						if (totalPayUSDC) {
							const feeUSDC = calcFeeFromReceived(totalPayUSDC)
							const requestCurrencyAmount = Number(kkk?.currencyAmount||0)
							const currencyTip = Number(kkk?.currencyTip||0)
							const taxCurrency = Number(kkk?.currencyTax||0)
							const currencyRate = (requestCurrencyAmount + currencyTip + taxCurrency )/totalPayUSDC
							const requestUSDAmount = currencyRate > 0 ? requestCurrencyAmount / currencyRate : 0

							const totalPayCurrency = totalPayUSDC * currencyRate
							
							const feeCurrency = feeUSDC * currencyRate
							
							const USDCTip = currencyRate ? currencyTip/currencyRate : 0
							const receivedUSDC = totalPayUSDC - feeUSDC
							const receivedCurrency = receivedUSDC * currencyRate
							const code = kkk?.code
							const taxUSDC = currencyRate ? taxCurrency/currencyRate : 0
							const title = kkk?.title
							const textNote = _requestCurrencyData.length - 2 > -1 ? _requestCurrencyData[_requestCurrencyData.length - 2] : ''

							requestDetail = {
								
								requestCurrency,
								totalPayUSDC,
								totalPayCurrency,

								requestCurrencyAmount,
								requestUSDAmount,

								

								feeUSDC,
								feeCurrency,

								currencyTip,
								USDCTip,

								taxUSDC,
								taxCurrency,

								receivedUSDC,
								receivedCurrency,
								
								rate: currencyRate,
								code,
								title,
								textNote
								
							}
							
						}
					
				} catch (ex) {
					requestCurrency = ooo as ICurrency
				}
				
				
				const ret: TransferHistork = {
					date: Number(n.issueTimestamp * BigInt(1000)),
					amount: payAmount - (requestDetail?.feeUSDC||0),
					address: account,
					hash: (n.successAuthorizationHash.startsWith('0x00') ? n.payHash : n.successAuthorizationHash),
					note: n.node,
					type,
					mode: 'request',
					fee,
					type1: type === 'sent' ? 'paid' : type ==='pending' ? '' :'received',
					preAmount: payAmount,
					requestCurrency,
					requestDetail,
					group
				}
				
				return ret
			})

			if (localMode === 'request') {
				if (next === 'payme') {
					mappedLing = mappedLing.filter(n => n?.group === 'payme')
				} else if (next === 'active') {
					mappedLing = mappedLing.filter(n => n?.group === 'onetime')
				} else {
					mappedLing = mappedLing.filter(n => !n?.group )
				}
				
				
				
				console.log(mappedLing.length)
			}

			//	过滤PayME
			mappedLing = mappedLing.filter (n => !!n?.requestDetail)
			const memoSelfDeposited: Map<string, boolean> = new Map()
			const checks: CheckHistory[] = _checks[1]
			mappedCheck = await Promise.all(
				checks.map(async (n): Promise<TransferHistork> => {
					const text = n.node.split('\r\n');
					const encryptedText = text[1];
					let cleanText = ''
					try {
						cleanText =
						encryptedText && (await aesGcmDecrypt(encryptedText, profile.privateKeyArmor));
					} catch (ex) {
						console.log (`${encryptedText} aesGcmDecrypt Error!`)
					}
					
					let ce: { secureCode: string; passcode: string } | undefined;
					if (cleanText) {
						ce = JSON.parse(cleanText);
					}
					const isSend = n.from.toLowerCase() === myAddrLocal
					const account = isSend ? n.to === ethers.ZeroAddress ? '' : n.to : n.from === ethers.ZeroAddress ? '' : n.from
					const type: HistoryFilter = !account ? 'pending' : isSend ? 'completed' : 'deposited'
					const preAmount = Number(ethers.formatUnits(n.amount, 6))
					const fee = calcFeeFromNumber(preAmount)
					let amount = preAmount
					//		self cashcode
					let hash = n.successAuthorizationHash
					
					let type1: HistoryFilter|'' = type === 'deposited' ? 'received' : 'sent'

					if (account.toLowerCase() === myAddrLocal) {
						const isMemo = memoSelfDeposited.get(n.depositHash)
						//		first ?
						if (!isMemo) {
							memoSelfDeposited.set(n.depositHash, true)
							type1 = 'sent'
							
						} else {
							type1 = 'received'
							hash = n.depositHash
							amount = preAmount - fee
						}
					} else {
						if (type1 === 'received') {
							amount = amount - fee
							hash = n.depositHash
						}
					}


					let card: IImageCard|null = null
					const nodeEX = n?.node?.split('\r\n')
					try {
						if (nodeEX[nodeEX.length - 1]) {
							const _card = JSON.parse(nodeEX[nodeEX.length - 1])
							if (_card?.card) {
								card = _card.card
							}
						}
					} catch (ex) {

					}
					const ret: TransferHistork = {
						date: Number(n.createTimestamp * BigInt(1000)),
						amount,
						address: account.toLowerCase(),
						hash,
						note: n.node,
						type,
						security: ce?.secureCode,
						passcode: ce?.passcode,
						redeemHash: n.payHash,
						mode: 'cashcode',
						fee,
						type1,
						preAmount
					}

					if (card?.currency) {
						ret.card = card
					}
					
					return ret
				})
			)
			


			// 1️⃣ 先合并，再按 date 做倒序排序（新 -> 旧）
			const alldatas: TransferHistork[] = [...mapped, ...mappedLing, ...mappedCheck].sort(
				(a, b) => b.date - a.date
			)

			// 2️⃣ 基于已经排序好的 alldatas 做 mode 筛选
			let filtered = alldatas.filter(tx => {
				if (localMode !== 'pay') {
					return tx.mode === localMode && ((localMode === 'request' && tx.type !== 'paid') || (localMode === 'cashcode' && tx.type !== 'deposited'))
				}
				return tx.mode === localMode || (tx.type1 !== '')
				
			})



			if (next && next !== 'all') {
				filtered = filtered.filter(tx => localMode === 'pay' ? tx.type1 === next : tx.type === next)
			}

			
			

			setItems([]) // 清掉旧的

			setTimeout(() => {
				// 这里不需要再 reverse 了，因为 alldatas 已经是倒序
				setItems(filtered)
			}, 0)


		} catch (ex: any) {
			console.log(ex.message)
		}
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

	
	
	const getTransferNewitems = async (next: HistoryFilter | null) => {
		
		await runWithMinProcessing(async () => {
			await process(next)
		})
	}

    // ⭐ 用 useCallback，这样 refresh 一直是同一个函数

	const handleFilterChange = async (next: HistoryFilter) => {
		
		setActiveFilter(next)
		setLoading(true)
		setLoadingFilter(next)
		setFilter(next)
		try {
			await getTransferNewitems(next)
			
		} finally {
			setLoading(false)
			setLoadingFilter(null)
		}
	}

	const SwitchBar = () => {
		return (
			<div className="flex items-center justify-between mb-3">
				{
					processing ? (
						<BallSequence />
					) : (
						<div className="inline-flex w-full rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
							{/* SEND */}
							<button
								type="button"
								className={`flex-1 h-8 rounded-full text-[13px] transition-all
									${ localMode === 'pay'
									? "bg-white dark:bg-slate-100 text-slate-900 dark:text-slate-900 shadow-sm"
									: "bg-transparent text-slate-500 dark:text-slate-300"
									}`}
								onClick={() => { setLocalMode("pay")}}
							>
								Completed
							</button>

							{/* REQUEST */}

							
							<button
							type="button"
								className={`flex-1 h-8 rounded-full text-[13px] transition-all
									${localMode === 'request'
									? "bg-white dark:bg-slate-100 text-slate-900 dark:text-slate-900 shadow-sm"
									: "bg-transparent text-slate-500 dark:text-slate-300"
									}`}
								onClick={() => {
									setNavigateLeftButtonArray([{
										title: '',
										action: [
											// () => navigate('/History'),
											() => setLocalMode('pay')
										]

									}])
									setLocalMode("request")

								}}
							>
								Payment Link
							</button>

							{/* cashcode */}
							<button
								type="button"
								className={`flex-1 h-8 rounded-full text-[13px] transition-all
									${localMode === 'cashcode'
									? "bg-white dark:bg-slate-100 text-slate-900 dark:text-slate-900 shadow-sm"
									: "bg-transparent text-slate-500 dark:text-slate-300"
									}`}
								onClick={() => { setLocalMode('cashcode')}}
							>
									Cashcode
							</button>
						</div>
					)
				}
				

			</div>
		)
	}

    return (
      	<div className="
			w-full h-full
			bg-transparent
			text-sm
			flex flex-col
			min-h-0
			overflow-visible
			flex justify-center
			pt-[calc(env(safe-area-inset-top)+0.5rem)]
		">
			{
				localMode === 'request' ? (
					<div
						className={[
							"fixed inset-0 z-40",
							"pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
							"pb-[env(safe-area-inset-bottom)]",
							"pt-[calc(env(safe-area-inset-top)+56px)]",
							"overflow-y-auto",
							"transition-transform duration-300 ease-out",
							"translate-x-0",
						].join(" ")}
						>
						{/* Header */}
						<div className="fixed top-0 left-0 right-0 z-50">
							<div className="px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-2">
								<NavigateLeftButton />
							</div>
						</div>

						<ShowPaymentLink setpProcessing={setpProcessing} />
						</div>

				) : (
					<>
					{/* Header */}
					{
						(!showDetail) && 
							<div className="flex items-center justify-between mb-3 mt-4">
								<div className="flex flex-col">
									<span className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
										Beamio
									</span>
									<h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
										Payments
									</h1>
								</div>

								<div className="text-right">
									<p className="text-[12px] font-medium text-slate-900 dark:text-slate-100">
										USDC {formatWithThousands(usdcbalance)}
									</p>
									<p className="text-[11px] text-slate-500 dark:text-slate-400">
										Available on Base
									</p>
								</div>
							</div>
					}
					{
						(!showDetail && !showGiftCard) && (
							<>
								<SwitchBar />
									{/* FilterTabs */}
									<HistoryFilterTabs active={filter} onChange={handleFilterChange} loading={loading} loadingFilter={loadingFilter} mode={localMode} />
									
											{/* List */}
									<div className="flex-1 min-h-0 overflow-y-auto pb-28">
										<div
											className="
												px-2 py-3 flex flex-col gap-1.5
												mb-4
												rounded-2xl
												bg-white/80 dark:bg-slate-900/70
			
											"
										>
											{/* Header row inside card */}
											

											{
												items.map((tx) => {
													const hasHash = !!tx.hash
													const currency: ICurrency = tx.note?.split('\r\n')[1] as ICurrency||'USDC'
													const baseRowClass =
														"block flex items-center px-2 py-2 text-[11px] border-b border-slate-200 dark:border-slate-800 transition"
													const plus = (tx.type1 === 'received')
													const clickableClass = hasHash
														? " cursor-pointer hover:bg-slate-100/70 dark:hover:bg-white/5"
														: " cursor-default opacity-70" // 没有 hash 时，不能点，略微灰掉

													const rowContent = (
														<div className="w-full flex items-center gap-2">
															{/* 左侧：最大化占宽（从左开始吃满） */}
															<div className="flex-1 min-w-0">
																<AccountBeo
																	address={tx.address}
																	note=""
																	dateData={formatTimev2(tx.date)}
																	tx={tx}
																	localMode={localMode}
																/>
															</div>

															{/* 中间：全部都是 icon / badge，紧凑排列，占用最小空间 */}
															<div className="shrink-0 flex items-center gap-1">
																{/* tx.type icon badge（固定小尺寸，避免每行高宽抖动） */}
																{localMode !== "pay" && (
																	<span
																		className={[
																		"inline-flex items-center justify-center",
																		"w-6 h-6 rounded-full",
																		
																		getBadgeClass(tx.type as HistoryFilter)
																		].join(" ")}
																		title={tx.type}
																	>
																		{tx.type === "pending" ? (
																		<Loader className="w-3.5 h-3.5" strokeWidth={2} />
																		) : tx.type === "completed" ? (
																		<CalendarCheck className="w-3.5 h-3.5" strokeWidth={2} />
																		) : tx.type === "paid" || tx.type === "deposited" ? (
																		<Banknote className="w-3.5 h-3.5" strokeWidth={2}/>
																		) : (
																		<HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
																		)}
																	</span>
																)}

															</div>

															{/* 右侧：金额 —— 不固定宽度，按内容最小占用，但永远贴右、不换行 */}
															<div
																className={[
																	"shrink-0 whitespace-nowrap text-right",
																	"w-[150px]",
																	"font-medium tabular-nums",
																	(!plus)
																	? "text-rose-600 dark:text-rose-400"
																	: "text-emerald-600 dark:text-emerald-400"
																].join(" ")}
															>
															{/* 关键：items-start -> 符号和主金额顶部对齐 */}
															<div className="flex justify-end items-start gap-1.5">
																{/* + / - 符号：对齐主金额行 */}
																{localMode === "pay" && (
																	<span className="text-[14px] leading-[20px]">
																		{plus ? "+" : "−"}
																	</span>
																)}

																<div className="flex flex-col gap-0.5 text-right">
																{/* 主金额：继承父级红/绿，不要写 text-slate-900 */}
																<span className="text-[14px] font-medium tabular-nums leading-[20px]">
																	{formatAmount(tx.type === 'sent' ? tx.preAmount : tx.amount, "USDC")}{" "}
																	USDC
																</span>

																{/* 辅助金额：淡灰 */}
																{tx?.requestDetail && (
																	<span className="text-[12px] tabular-nums text-slate-400 leading-[16px]">
																	{fiatPrefix(tx.requestDetail.requestCurrency)}{" "}
																	{formatAmount(
																		tx.type === 'sent' ? tx.requestDetail.totalPayCurrency :tx.requestDetail.receivedCurrency ,
																		tx.requestDetail.requestCurrency
																	)}
																	</span>
																)}
																</div>
															</div>
															</div>
														</div>
													)

													// 有 hash：<a>，打开 BaseScan
													
													

														return (
															<a
																onClick={() => {

																	setIsPay (tx.mode === 'cashcode' ? true : false)
																	setTip(0)
																	setAmt(tx.amount)
																	setNote(tx.note)
																	const params = new URLSearchParams(tx.mode === 'request' ? {code: tx.hash}: {secureCode: tx.hash, cashcode: tx.security||''}).toString()
																	const showUrl = `${showPaylinkSite}?${params}`
																	setCreatedDate(tx.date)
																	setType(tx.type)
																	setSuccessUrl(showUrl)
																	setShowDEtail(true)
																	setAccount(tx.address)
																	setSecurityCode(tx.passcode||'')
																	setRedeemCode(tx.security||'')
																	setFee(tx.fee)
																	setHash(tx.hash)
																	setPreAmount(tx.preAmount)
																	setItemtx(tx)
																	setShowFooter(false)
																	setNavigateLeftButtonArray(prof => [...prof, {
																		title: '',
																		action:([
																			() => setShowDEtail(false),
																			() => setShowFooter(true)
																		])
																	}])
																}}
																key={tx.hash}
																rel="noreferrer"
																className={baseRowClass + clickableClass}
															>
																{rowContent}
															</a>
														)
													
												})
											}
										</div>
									</div>
											
							
							</>
						)
					}
					<div
						className={[
							"pt-[env(safe-area-inset-top)]",
							'pb-[env(safe-area-inset-bottom)]',
							'pl-[env(safe-area-inset-left)]',
							'pr-[env(safe-area-inset-right)]',
							"fixed inset-0 z-40 flex-1 overflow-y-auto",
							"transition-transform duration-300 ease-out",
							(showDetail) ? "translate-x-0" : "translate-x-full",
						].join(" ")}
					>

						{/* Header：返回 + 居中标题 */}
						<div
							className="
								absolute
								top-[env(safe-area-inset-top)]
								left-0 right-0
								h-14
								flex items-center
								px-4
								z-50
							"
						>
							<div className="fixed top-0 left-0 right-0 z-50">
								<div className="px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-2">
									<NavigateLeftButton />
								</div>
							</div>

							
						</div>
						<div className="flex-1 mt-10">
							
							{
								showDetail && 
								<div className="relative overflow-visible">
									{
										itemTx && <TransactionsItemDetail localMode={localMode} tx={itemTx} />
									}
								</div>
							}
						</div>
						
					</div>
					</>
				)
			}
			
		</div>
    )
  }
)
