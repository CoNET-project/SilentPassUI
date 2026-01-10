import { ChevronRight } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { beamioConet } from "@/utils/constants"
import { ethers } from "ethers"
import { useMemo, useState, useEffect, useCallback } from "react"
import AccountBeo from '../AccountBea'
import {fiatPrefix, formatAmount, formatTimev2} from '@/services/currency'
import { QrCode, Link as LinkIcon, ZapOff, CalendarCheck, Banknote, HelpCircle, Loader, ArrowUpRight, ChevronLeft } from "lucide-react"
import {TransactionsItemDetail} from '../TransactionsItemDetail'
import PayMeGroup from './payme'
import Reusable from './Reusable'
import Invoices from "./Invoices"

function formatUsdc4(n: number) {
	const v = Number.isFinite(n) ? n : 0
	return v.toFixed(4)
}



function sumUsdc(list: TransferHistork[]) {
	return list.reduce((acc, tx) => {
		const v =
		Number.isFinite(tx.amount) && tx.amount > 0
			? tx.amount
			: Number.isFinite(tx.preAmount) && tx.preAmount > 0
			? tx.preAmount
			: 0
		return acc + v
	}, 0)
}

function uniqCount(list: TransferHistork[], keyFn: (t: TransferHistork) => string) {
	const set = new Set<string>()
	for (const t of list) {
		const k = (keyFn(t) || "").trim()
		if (k) set.add(k)
	}
	return set.size
}

type Props = {
  	setpProcessing: (val: boolean) => void
}

export default function ShowPaymentLink({ setpProcessing }: Props) {
	const { profiles, usdcbalance, myAddress, setMyAddress, setNavigateLeftButtonArray } = useDaemonContext()

	const [payMeArray, setPayMeArray] = useState<TransferHistork[]>([])
	const [reusablePayments, setReusablePayments] = useState<TransferHistork[]>([])
	const [onetimePayments, setOnetimePayments] = useState<TransferHistork[]>([])
	const [mode, setMode] = useState<"payme" | "reusable" | "invoices"|''>("")
	const [showDetail, setShowDetail] = useState(false)
	const [itemTx, setItemtx] = useState<TransferHistork>()

	// ✅ 使用 keyID 做依赖，避免 length 不变但账号变了不刷新
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
				const [_links] = await Promise.all([beamioConet.getLinksHistory(address, 0, 100)])
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

				setPayMeArray(mappedLing.filter(n => n?.group === "payme" && n.type !== 'paid' ))
				setReusablePayments(mappedLing.filter(n => n?.group === 'reusable'))
				setOnetimePayments(mappedLing.filter(n => n.group === 'onetime'))
			} catch (ex: any) {
				console.log(ex?.message || ex)
			} finally {
				setpProcessing(false)
			}
		},
		[myAddress, setMyAddress, setpProcessing, usdcbalance]
	)

	useEffect(() => {
		if (!addrKey) return
		process(addrKey)
	}, [addrKey, process])

	// ✅ stats 从数组实时计算，永远与 UI 一致
	const stats = useMemo(() => {
		const paymePayments = payMeArray.length
		const paymeTotalUsdc = sumUsdc(payMeArray)

		const reusablePayCount = reusablePayments.length
		const reusableTotalUsdc = sumUsdc(reusablePayments)

		const onetimePayCount = onetimePayments.length
		const onetimeTotalUsdc = sumUsdc(onetimePayments)

		// ✅ Reusable links：优先 parentHash 去重（同一 link 不会因为 payer 地址不同被拆成多个）
		const reusableLinks = uniqCount(reusablePayments, t => (t as any)?.parentHash || "")

		// ✅ One-time links：若有 redeemHash 用它，否则退化到 hash（会更像 payments 数）
		const onetimeLinks = uniqCount(
		onetimePayments,
		t => (t as any)?.redeemHash || t.hash || ""
		)

		return {
			paymePayments,
			paymeTotalUsdc,
			reusablePayments: reusablePayCount,
			reusableTotalUsdc,
			reusableLinks,
			onetimePayments: onetimePayCount,
			onetimeTotalUsdc,
			onetimeLinks,
		}
	}, [payMeArray, reusablePayments, onetimePayments])

	const Wrap = ({ children }: { children: React.ReactNode }) => (
		<div
		className="
			rounded-[20px]
			bg-white
			ring-1 ring-slate-200/70
			shadow-[0_8px_24px_rgba(15,23,42,0.06)]
			overflow-hidden
		"
		>
		<div className="p-4 sm:p-5">{children}</div>
		</div>
	)

	const SectionTitle = ({ title }: { title: string }) => (
		<div className="text-[16px] font-extrabold tracking-tight text-slate-900">{title}</div>
	)

	const SectionSub = ({ children }: { children: React.ReactNode }) => (
		<div className="mt-0.5 text-[14px] font-medium text-slate-500">{children}</div>
	)

	const CountPill = ({ children }: { children: React.ReactNode }) => (
		<div
		className="
			shrink-0
			px-3 py-1
			rounded-full
			bg-white
			ring-1 ring-slate-200
			text-[16px]
			font-extrabold
			text-slate-700
			shadow-[0_1px_0_rgba(255,255,255,0.9)]
		"
		>
		{children}
		</div>
	)

	const CardRow = (p: { title: string; sub1: string; sub2?: string; onClick: () => void }) => (
		<button
		type="button"
		onClick={p.onClick}
		className="
			w-full
			text-left
			rounded-[14px]
			bg-white
			ring-1 ring-slate-200
			px-3 py-3
			shadow-[0_8px_20px_rgba(15,23,42,0.05)]
			active:scale-[0.995]
			transition
		"
		>
		<div className="flex items-center gap-3">
			<div className="min-w-0 flex-1">
			<div className="text-[14px] font-extrabold tracking-tight text-slate-900">{p.title}</div>
			<div className="mt-0.5 text-[12px] leading-tight text-slate-500">{p.sub1}</div>
			{p.sub2 ? (
				<div className="mt-1 text-[12px] leading-tight text-slate-400">{p.sub2}</div>
			) : null}
			</div>
			<ChevronRight className="h-7 w-7 text-slate-300" />
		</div>
		</button>
	)

	return (
		<div className="px-4 pb-6">
			{
				!mode && (
					<>
						<Wrap>
							{/* Pinned */}
							<div className="mb-6">
							<div className="text-[16px] font-extrabold tracking-tight text-slate-500">Pinned</div>

							<div className="mt-4">
								<CardRow
									title="PayMe"
									sub1="Always on · Any amount"
									sub2={`${stats.paymePayments} payments · Total ${formatUsdc4(stats.paymeTotalUsdc)} USDC`}
									onClick={() => {
										
										setNavigateLeftButtonArray(pref => [...pref, {
											title: 'PayMe',
											action: [() => setMode('')]
										}])
										setMode("payme")
									}}
								/>
							</div>
							</div>

							{/* Reusable */}
							<div className="flex items-start justify-between gap-3">
							<div>
								<SectionTitle title="Reusable" />
								<SectionSub>
									{stats.reusablePayments} payments · Total {formatUsdc4(stats.reusableTotalUsdc)} USDC
								</SectionSub>
							</div>
							<CountPill>{stats.reusableLinks} links</CountPill>
							</div>

							<div className="mt-4">
							<CardRow
								title="Reusable links"
								sub1="View and manage all reusable payment links"
								onClick={() => {
									setNavigateLeftButtonArray(pref => [...pref, {
											title: 'Reusable',
											action: [() => setMode('')]
										}])
										
									setMode("reusable")
								}}
							/>
							</div>

							{/* One-time */}
							<div className="mt-8 flex items-start justify-between gap-3">
							<div>
								<SectionTitle title="One-time" />
								<SectionSub>
								{stats.onetimePayments} payments · Total {formatUsdc4(stats.onetimeTotalUsdc)} USDC
								</SectionSub>
							</div>
							<CountPill>{stats.onetimeLinks} links</CountPill>
							</div>

							<div className="mt-4">
								<CardRow title="Invoices" sub1="View all one-time payment links" onClick={() => {
									setNavigateLeftButtonArray(pref => [...pref, {
										title: 'Invoices',
										action: [() => setMode('')]
									}])
									setMode("invoices")
								}} />
							</div>
						</Wrap>

					</>
				)
			}
			
			{
				mode && (
					<div className="relative flex flex-col min-h-0 flex-1">


						{/* ✅ 内容区：给 header 留出空间（safe-area + 56px） */}
						<div className="flex-1 min-h-0 overflow-y-auto pb-28">
							{
								showDetail ? (
									<div className="relative overflow-visible">
										{
											itemTx && <TransactionsItemDetail localMode={'request'} tx={itemTx} />
										}
										
									</div>
								) : (
									<div >
										{mode === "payme" && (
											<PayMeGroup setpProcessing={setpProcessing} />
										)}
										{mode === 'reusable' && (
											
											<Reusable setpProcessing={setpProcessing}
											setShowDetail={setShowDetail}
												showDetail={showDetail}
											 />
											
										)}
										{mode === 'invoices' && (
											
											<Invoices setpProcessing={setpProcessing}
											setShowDetail={setShowDetail}
												showDetail={showDetail}
											 />
											
										)}
									</div>
								)
							}
							
						</div>
					</div>
				)
			}
			
		</div>
	)
}
