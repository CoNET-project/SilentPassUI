import {PayMeCoverPage, ReusableCoverPage, InvoicesCoverPage} from './CoverPage'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { useMemo, useState, useEffect, useCallback } from "react"
import { beamioConet } from "@/utils/constants"
import { ethers } from "ethers"
import AccountBeo from '../AccountBea'
import { QrCode, Link as LinkIcon, ZapOff, CalendarCheck, Banknote, HelpCircle, Loader, ArrowUpRight, ChevronLeft, X } from "lucide-react"
import {fiatPrefix, formatAmount, formatTimev2, getBadgeClass, statusStyleMap, calcFeeFromReceived} from '@/services/currency'
import {TransactionsItemDetail} from '../TransactionsItemDetail'

type Props = {
  	setpProcessing: (val: boolean) => void
}

const PayMeGroup = ({ setpProcessing }: Props) =>  {
	const { profiles, usdcbalance, myAddress, setMyAddress, setNavigateLeftButtonArray } = useDaemonContext()
	const [payMeArray, setPayMeArray] = useState<TransferHistork[]>([])
	const [itemTx, setItemtx] = useState<TransferHistork|null>(null)
	const [query, setQuery] = useState('')
	const [showDetail, setShowDetail] = useState(false)

	const addrKey = profiles?.[0]?.keyID

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
			let mapped: TransferHistork[], mappedLing: TransferHistork[], mappedCheck: TransferHistork[]
			try {
				
				const [_links, ] = await Promise.all([
					
					beamioConet.getLinksHistory(address, 0, 100),
					
				])
				
			
				
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
						fee: requestDetail?.feeUSDC||0,
						type1: type === 'sent' ? 'paid' : type ==='pending' ? '' :'received',
						preAmount: payAmount,
						requestCurrency,
						requestDetail,
						group
					}
					
					return ret
				})


					
				
					// if (next === 'payme') {
					// 	mappedLing = mappedLing.filter(n => n?.group === 'payme')
					// } else if (next === 'active') {
					// 	mappedLing = mappedLing.filter(n => n?.group === 'fixed')
					// } else {
					// 	mappedLing = mappedLing.filter(n => !n?.group )
					// }
					
					
					
				
				

				//	过滤PayME
				mappedLing = mappedLing.filter(n => n.group ==='payme' && n.type === 'received' )

				// 1️⃣ 先合并，再按 date 做倒序排序（新 -> 旧）
				const alldatas: TransferHistork[] = [ ...mappedLing].sort(
					(a, b) => b.date - a.date
				)

				setPayMeArray(alldatas)

				// 2️⃣ 基于已经排序好的 alldatas 做 mode 筛选
				// let filtered = alldatas.filter(tx => {
				// 	if (localMode !== 'pay') {
				// 		return tx.mode === localMode && ((localMode === 'request' && tx.type !== 'paid') || (localMode === 'cashcode' && tx.type !== 'deposited'))
				// 	}
				// 	return tx.mode === localMode || (tx.type1 !== '')
					
				// })


				
				

				// setItems([]) // 清掉旧的



			} catch (ex: any) {
				console.log(ex.message)
			} finally {
				setpProcessing(false)
			}
			
		},[]
	)

	const style = statusStyleMap['payme']


	useEffect(() => {
		if (!addrKey) return
		process(addrKey)
	}, [addrKey, process])

	return (
		<div className="flex-1 min-h-0 overflow-y-auto pb-28">
			{
				itemTx ? (
				<>
				
				{
					
					<TransactionsItemDetail tx={itemTx} localMode="request" />
					
				}
					
				</>
			) : (<>
				<PayMeCoverPage
					query={query}
					setQuery={(v) => setQuery(v)}
					payMeArray={payMeArray}
				/>
				<div className="px-2 py-3 flex flex-col gap-1.5 mb-4 rounded-2xl bg-white/80 dark:bg-slate-900/70">
					{payMeArray.map(tx => {
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
								<AccountBeo
									address={tx.address}
									note=""
									dateData={formatTimev2(tx.date)}
									tx={tx}
									localMode={"request"}
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
								"w-[150px]",
								"font-medium tabular-nums",
								style.text,
								"text-emerald-600 dark:text-emerald-400",
								].join(" ")}
							>
								<div className="flex justify-end items-start gap-1.5">
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
								</div>
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
										() => setShowDetail(false)
									]
								}])
								setItemtx(tx)
								setShowDetail(true)

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

export default PayMeGroup