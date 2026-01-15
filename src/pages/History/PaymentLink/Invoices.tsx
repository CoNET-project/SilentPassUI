import { InvoicesCoverPage} from './CoverPage'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { useMemo, useState, useEffect, useCallback } from "react"
import { beamioConet } from "@/utils/constants"
import { ethers } from "ethers"
import AccountBeo from '../AccountBea'
import { QrCode, Link as LinkIcon, ZapOff, CalendarCheck, Banknote, HelpCircle, Loader, ArrowUpRight, ChevronLeft } from "lucide-react"
import {fiatPrefix, formatAmount, formatTimev2, calcFeeFromReceived} from '@/services/currency'
import {TransactionsItemDetail} from '../TransactionsItemDetail'
import ListHeader from './listHeader'

type Props = {
  	setpProcessing: (val: boolean) => void
}

const Invoices = ({ setpProcessing}: Props) =>  {
	const { profiles, usdcbalance, myAddress, setMyAddress, setNavigateLeftButtonArray, currencyData} = useDaemonContext()
	const [itemTx, setItemtx] = useState<TransferHistork|null>()
	const [query, setQuery] = useState('')
	const [onetimePayments, setOnetimePayments] = useState<TransferHistork[]>([])
	const addrKey = profiles?.[0]?.keyID
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

	


	const process = useCallback(
		async (address: string) => {
			if (!address) return

			// ✅ profile 切换时同步更新 myAddress
			if ((myAddress || "").toLowerCase() !== address.toLowerCase()) {
				setMyAddress(address)
			}

			setpProcessing(true)
			console.log(`getAllHistory called, balance = ${usdcbalance}`)

			const myAddrLocal = address.toLowerCase()

			try {
				const [_links] = await Promise.all([beamioConet.getLinksHistory(address, 0, 100)])
				const links: LinksHistory[] = _links[1] || []

				const mappedLing = links.map(n => {
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
								
							} else {
								const requestCurrencyAmount = Number(kkk?.currencyAmount||_amount)
								const requestUSDAmount = currencyToUsdcAmount(requestCurrencyAmount, requestCurrency)
								const feeUSDC = calcFeeFromReceived(requestUSDAmount)
								const feeCurrency = usdcToCurrencyAmount(feeUSDC, requestCurrency)
								const title = kkk?.title
								const textNote = _requestCurrencyData.length - 2 > -1 ? _requestCurrencyData[_requestCurrencyData.length - 2] : ''

								requestDetail = {
									requestCurrency,
									totalPayUSDC: 0,
									totalPayCurrency: 0,

									requestCurrencyAmount,
									requestUSDAmount,

									feeUSDC,
									feeCurrency,

									currencyTip: 0,
									USDCTip: 0,

									taxUSDC: 0,
									taxCurrency: 0,

									receivedUSDC: 0,
									receivedCurrency: 0,

									rate: currencyData[requestCurrency],

									code: n.payHash,
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
						fee: requestDetail?.feeUSDC||0,
						type1: type === 'sent' ? 'paid' : type ==='pending' ? '' :'received',
						preAmount: payAmount,
						requestCurrency,
						requestDetail,
						group
					}
					
					return ret
				})
				const filtered = mappedLing.filter(n => n.group ==='onetime')
				setOnetimePayments(filtered)
			} catch (ex: any) {
				console.log(ex?.message || ex)
			} finally {
				setpProcessing(false)
			}
		}, [])

	useEffect(() => {
		if (!addrKey) return
		process(addrKey)
	}, [addrKey, process])

	return (
		<div className="flex-1 min-h-0 overflow-y-auto pb-28">
			{
				itemTx ? (<>
				
					<TransactionsItemDetail tx={itemTx}
						localMode="request"
					/>
				
					
				</>) : (<>
				<InvoicesCoverPage
					query={query}
					setQuery={(v) => setQuery(v)}
					onetimePayments ={onetimePayments}
				/>
				<div className="px-2 py-3 flex flex-col gap-1.5 mb-4 rounded-2xl bg-white/80 dark:bg-slate-900/70">
					{
						onetimePayments.map(tx => {
							const hasHash = !!tx.hash
							const plus = tx.type1 === "received"

							const baseRowClass =
								"block flex items-center px-2 py-2 text-[11px] border-b border-slate-200 dark:border-slate-800 transition"
							const clickableClass = hasHash
								? " cursor-pointer hover:bg-slate-100/70 dark:hover:bg-white/5"
								: " cursor-default opacity-70"

							const rowContent = (
								<div className="w-full flex items-center gap-2">
									<div className="flex-1 min-w-0">
										<ListHeader
											address={tx.address}
											tx={tx}
										/>
									</div>

									{/* <div className="shrink-0 flex items-center gap-1">
										<span
										className={[
											"inline-flex items-center justify-center",
											"w-6 h-6 rounded-full",
											getBadgeClass(tx.type as HistoryFilter),
										].join(" ")}
										title={tx.type}
										>
										{tx.type === "pending" ? (
											<Loader className="w-3.5 h-3.5" strokeWidth={2} />
										) : tx.type === "completed" ? (
											<CalendarCheck className="w-3.5 h-3.5" strokeWidth={2} />
										) : tx.type === "paid" || tx.type === "deposited" ? (
											<Banknote className="w-3.5 h-3.5" strokeWidth={2} />
										) : (
											<HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
										)}
										</span>
									</div> */}

									<div
										className={[
											"shrink-0 whitespace-nowrap text-right",
											"w-[100px]",
											"font-medium tabular-nums",
											!plus ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
										].join(" ")}
									>
										{/* <div className="flex justify-end items-start gap-1.5">
										<div className="flex flex-col gap-0.5 text-right">
											<span className="text-[14px] font-medium tabular-nums leading-[20px]">
												{formatAmount(tx.amount, "USDC")} USDC
											</span>

											{tx?.requestDetail && (
											<span className="text-[12px] tabular-nums text-slate-400 leading-[16px]">
												{fiatPrefix(tx.requestDetail.requestCurrency)}{" "}
												{formatAmount(tx.requestDetail.totalPayCurrency, tx.requestDetail.requestCurrency)}
											</span>
											)}
										</div>
										</div> */}
										{tx.type === 'paid' ? (
												<>
													{/* Paid */}
													<span
													className="
														inline-flex items-center
														h-7 px-3
														rounded-full
														bg-fuchsia-300/80
														text-fuchsia-900
														text-[13px] font-semibold
														dark:bg-fuchsia-500/70
														dark:text-fuchsia-50
														shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]
													"
													>
														Paid
													</span>
												</>
												) : (
												<>
													{/* Active */}
													<span
													className="
														inline-flex items-center
														h-7 px-3
														rounded-full
														bg-amber-200/80
														text-amber-600/70
														text-[13px] font-semibold
														dark:bg-amber-500/10
														dark:text-amber-50
														shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]
													"
													>
														Active
													</span>
												</>
												)}

									</div>
								</div>
							)

							return (
								<div
									key={tx.hash || `${tx.date}-${tx.amount}`}
									className={baseRowClass + clickableClass}
									onClick={() => {
										setNavigateLeftButtonArray(prof => [...prof, {
											title: '',
											action: [
												() => setItemtx(null),
											]
										}])
										setItemtx(tx)
									
									}}
								>
									{rowContent}
								</div>
							)
						})}
				</div>
				</>)
			}
			
			
		</div>
	)
}

export default Invoices