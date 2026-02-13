import { ReusableCoverPage, InvoicesCoverPage} from './CoverPage'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { useMemo, useState, useEffect, useCallback } from "react"
import { ethers } from "ethers"
import AccountBeo from '../AccountBea'
import { QrCode, Link as LinkIcon, ZapOff, CalendarCheck, Banknote, HelpCircle, Loader, ArrowUpRight, ChevronLeft } from "lucide-react"
import {fiatPrefix, formatAmount, formatTimev2, getBadgeClass} from '@/services/currency'
import {TransactionsItemDetail} from '../TransactionsItemDetail'

type Props = {
  	setpProcessing: (val: boolean) => void
	setShowDetail: (val: boolean) => void
	showDetail: boolean
}

const Reusable = ({ setpProcessing, showDetail, setShowDetail }: Props) =>  {
	const { profiles, usdcbalance, myAddress, setMyAddress, setNavigateLeftButtonArray } = useDaemonContext()
	const [reusablePayments, setReusablePayments] = useState<TransferHistork[]>([])
	const [itemTx, setItemtx] = useState<TransferHistork|null>()
	
	const [query, setQuery] = useState('')
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

			try {
				// 旧合约 getLinksHistory 已停用
				const _links: [string[], LinksHistory[]] = [[], []]
				const links: LinksHistory[] = _links[1] || []

				const mappedLing = links.map(n => {
					const isRequest = n.from.toLowerCase() === myAddrLocal
					
					const isPending = isRequest ? n.to === ethers.ZeroAddress : n.from === ethers.ZeroAddress
					
					const isReject = isRequest ?  n.to === '0x1000000000000000000000000000000000000000' : n.from === '0x1000000000000000000000000000000000000000'
					const account = (isPending||isReject) ? '' : isRequest ? n.to : n.from
					
					const preAmount = Number(ethers.formatUnits(n.amount, 6))
					
					const _requestCurrencyData = n?.node?.split('\r\n')
					const ooo = _requestCurrencyData[_requestCurrencyData.length -1]
					let requestCurrency: ICurrency = 'USDC'
					let kkk: payMe|null
					let group: paymentType = 'onetime'
					let requestDetail: IRequestCurrencyDetail|undefined = undefined
					let type: HistoryFilter = isPending ? 'pending' : isRequest ? 'paid' : 'completed'

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
						
					
						let totalPayUSDC = Number(ethers.formatUnits(n.payAmount, 6))
						
						
							//		totalPayUSDC: totalPayCurrency = 1:x
						
							//		isRequest : calcFeeFromNumber(totalPayUSDC)
							//		!isRequest :  totalPayUSDC + fee = realRequestAmount, fee = calcFeeFromNumber(realRequestAmount); realRequestAmount = 
						
						

						if (preAmount && totalPayUSDC) {
							
							const currencyRate = Number(kkk?.currencyAmount)/totalPayUSDC || preAmount / totalPayUSDC
							
							
							const receivedCurrency = totalPayUSDC * currencyRate
							const currencyTip = Number(kkk?.currencyTip)||0
							const USDCTip = currencyTip/currencyRate
							
							requestDetail = {
								totalPayUSDC,
								totalPayCurrency: receivedCurrency,
								requestCurrency,
								feeUSDC:0,
								feeCurrency:0,
								receivedUSDC: totalPayUSDC,
								receivedCurrency,
								currencyTip,
								USDCTip,
								rate: currencyRate
							}
							
						}
						
					} catch (ex) {
						requestCurrency = ooo as ICurrency
					}
					
					
					const ret: TransferHistork = {
						date: Number(n.issueTimestamp * BigInt(1000)),
						amount: preAmount,
						address: account,
						hash: (n.successAuthorizationHash.startsWith('0x00') ? n.payHash : n.successAuthorizationHash),
						note: n.node,
						type,
						mode: 'request',
						fee:0,
						type1: type === 'paid' ? 'sent' :  type === 'completed' ? 'received' : '',
						preAmount: preAmount,
						requestCurrency,
						requestDetail,
						group
					}
					
					return ret
				})

				setReusablePayments(mappedLing.filter(n => n?.group === 'reusable'))
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
				showDetail ? (<>
				{
					itemTx && <TransactionsItemDetail tx={itemTx} />
				}
					
				</>) : (<>
				<ReusableCoverPage
					query={query}
					setQuery={(v) => setQuery(v)}
					reusablePayments={reusablePayments}
				/>
				<div className="px-2 py-3 flex flex-col gap-1.5 mb-4 rounded-2xl bg-white/80 dark:bg-slate-900/70">
					{reusablePayments.map(tx => {
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

							<div className="shrink-0 flex items-center gap-1">
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
							</div>

							<div
								className={[
								"shrink-0 whitespace-nowrap text-right",
								"w-[150px]",
								"font-medium tabular-nums",
								getBadgeClass(tx.type as HistoryFilter),
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

export default Reusable