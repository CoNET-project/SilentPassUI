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
import send_icon from "@/components/assets/send-icon.svg"
import receive_icon from "@/components/assets/receive-icon.svg"
import {HistoryFilterTabs, HistoryFilter} from './HistoryFilterTabs'
import {RedeemOrLinkCard} from '../Pay/RedeemOrLinkCard'
import { X } from 'lucide-react'

import {formatAmountReadable, formatWithThousands, generateCODE, getBalance} from '@/services/beamio'

type Payed = {
  payTimestamp: number
  fromAddress: string
  fromBeamioName: string
  payAmount: number
  hash: string
}

type TransferHistork = {
  date: number
  amount: number
  to: string
  hash: string
  from: string
  note: string
  status: 'Completed'|'Pending'|'Reject'
  type: 'Receive'|'Send'
  pendingKind: 'Request'|'Check'|'Transfer'
}

type LinksHistory = {
	to: string
    successAuthorizationHash: string
    chianID: bigint
    erc3009Address: string
    node: string
    amount: bigint
    decimals: bigint
    issueTimestamp: bigint
    payHash: string
    payTimestamp: string
    from: string
    payAmount: string
}



type HistoryTableProps = {
}

const showPaylinkSite = 'https://beamio.app'

const fmtAddr = (a = "") => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—")

type Transfer = {
	to: string
	timestamp: bigint
	from: string
	amount: string
	finisedHash: string
	note: string
}

const formatTime = (ts: number) => {
  if (!ts) return "—"
  const d = new Date(ts)
  return d.toLocaleString()
}


// 用 forwardRef 包装
export const SendHistoryTable = (
  () => {
    const [items, setItems] = useState<TransferHistork[]>([])
    const [myAddress, setMyAddress] = useState("")
    const {profiles, setUsdcbalance, usdcbalance } = useDaemonContext()

	const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all')
	const [loading, setLoading] = useState(false)
	const [loadingFilter, setLoadingFilter] = useState<HistoryFilter | null>(null)
	const [showDetail, setShowDEtail] = useState(false)

	const [isPay, setIsPay] = useState(false)
	const [amt, setAmt] = useState(0)
	const [successUrl, setSuccessUrl] = useState("")
	const [tip, setTip] = useState(0)
	const [note, setNote] = useState("")
	const [createdDate, setCreatedDate] = useState(0)
	const [isCompleted, setIsCompleted] = useState(false)


    const isSend = (item: TransferHistork) => {
		if (!myAddress) return false
		return item.from.toLowerCase() === myAddress
    }

	useEffect(() => {
		getTransferNewitems(null)
	}, [])
	
	const [filter, setFilter] = useState<HistoryFilter>('all')
	const getTransferNewitems = async (next: HistoryFilter | null) => {
		if (!profiles?.length) return
		const profile: any = profiles[0]   // 这里用你实际的 profile 类型替换 any
		const address = profile.keyID
		console.log(`getAllHistory called, balance = ${usdcbalance}`)

		const myAddr = address.toLowerCase()
		setMyAddress(myAddr)

		try {
			const [_transfer, _links] = await Promise.all([
			beamioConet.getTransferHistory(address, 0, 100),
			beamioConet.getLinksHistory(address, 0, 100),
			])

			const transfer: Transfer[] = _transfer[1]
			const links: LinksHistory[] = _links[1]

			const mappedTransfer: TransferHistork[] = transfer.map(n => ({
			date: Number(n.timestamp * BigInt(1000)),
			amount: Number(ethers.formatUnits(n.amount, 6)),
			to: n.to,
			hash: n.finisedHash,
			from: n.from,
			note: n.note,
			status: 'Completed',
			type: myAddr === n.to.toLowerCase() ? 'Receive' : 'Send',
			pendingKind: 'Transfer',
			}))

			const mappedLinkss: TransferHistork[] = links.map(n => ({
			date: Number(n.issueTimestamp * BigInt(1000)),
			amount: Number(ethers.formatUnits(n.amount, 6)),
			to: n.to,
			hash: (n.successAuthorizationHash.startsWith('0x00') ? n.payHash : n.successAuthorizationHash),
			from: n.from,
			note: n.node,
			status:
				n.from === '0x1000000000000000000000000000000000000000'
				? 'Reject'
				: n.successAuthorizationHash.startsWith('0x00')
				? 'Pending'
				: 'Completed',
			type: 'Receive',
			pendingKind: 'Request',
			}))

			// 1️⃣ 先合并，再按 date 做倒序排序（新 -> 旧）
			const alldatas: TransferHistork[] = [...mappedTransfer, ...mappedLinkss].sort(
			(a, b) => b.date - a.date
			)

			// 2️⃣ 基于已经排序好的 alldatas 做筛选
			let filtered = alldatas

			if (next === 'send') {
			filtered = alldatas.filter(tx => tx.type === 'Send')
			} else if (next === 'receive') {
			filtered = alldatas.filter(
				tx => tx.type === 'Receive' && tx.status !== 'Reject' && tx.status !== 'Pending'
			)
			} else if (next === 'pending') {
			filtered = alldatas.filter(tx => tx.status === 'Pending')
			} else if (next === 'reject') {
			filtered = alldatas.filter(tx => tx.status === 'Reject')
			}

			// 3️⃣ filter === null / 'all' 时，filtered 就是已经按时间倒序的 alldatas

			setItems([]) // 清掉旧的

			setTimeout(() => {
			// 这里不需要再 reverse 了，因为 alldatas 已经是倒序
			setItems(filtered)
			}, 0)
		} catch (ex: any) {
			console.log(ex.message)
		}
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



    return (
      	<div className="
				w-full h-full
				bg-transparent
				text-sm
				flex flex-col
				min-h-0
				overflow-visible
		">
        
          	{/* Header */}
			<div className="flex items-center justify-between mb-3">
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
			{
				!showDetail && (
					<>
							{/* FilterTabs */}
							<HistoryFilterTabs active={filter} onChange={handleFilterChange} loading={loading} loadingFilter={loadingFilter}/>

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
									<div
										className="
										flex items-center px-2 pb-1 text-[10px]
        text-slate-500 dark:text-slate-400
        border-b border-slate-100/80 dark:border-white/10
        mb-1
										"
									>
										<div className="w-20">Type</div>
										<div className="flex-1">Account</div>
										<div className="w-16 text-right">Value</div>
									</div>

									{
										items.map((tx) => {
											const hasHash = !!tx.hash

											const baseRowClass =
												"block flex items-center px-2 py-2 text-[11px] border-b border-slate-200 dark:border-slate-800 transition"

											const clickableClass = hasHash
												? " cursor-pointer hover:bg-slate-100/70 dark:hover:bg-white/5"
												: " cursor-default opacity-70" // 没有 hash 时，不能点，略微灰掉

											const rowContent = (
											<>
												{/* Type pill */}
												<div className="w-20">
													<span
													className={[
														"inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
														" border border-white/20",
														tx.status === "Reject"
														? "bg-rose-300/40 text-rose-700 dark:bg-rose-700/40 dark:text-rose-200"
														: tx.status === "Pending"
														? "bg-amber-200/60 text-amber-800 dark:bg-amber-700/40 dark:text-amber-200"
														: tx.type === "Send"
														? "bg-slate-300/40 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200"
														: "bg-emerald-300/35 text-emerald-700 dark:bg-emerald-700/40 dark:text-emerald-200",
													].join(" ")}
													>
													{
														tx.status === "Reject"
														? "Reject"
														: tx.status === "Pending"
														? "Pending"
														: tx.type === "Send"
														? "Send"
														: "Receive"
													}
													</span>
												</div>

												{/* Account + note + status */}
												<div className="flex-1 flex flex-col">
													<span className="font-mono text-slate-800 dark:text-slate-100">
														{fmtAddr((tx.type === "Receive")
																	? (tx.pendingKind ==='Request' 
																			? (tx.status === 'Completed' ? tx.from : '')
																			: tx.from)
																	: tx.to)}
													</span>

													{tx.note && (
														<span className="text-[10px] text-slate-500 dark:text-slate-400">
														{tx.note}
														</span>
													)}

													{tx.status === "Pending" && (
														<span className="text-[10px] text-amber-600 dark:text-amber-300 flex items-center gap-1">
															<span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-300" />
															{tx.pendingKind === "Request" && "Pending · Request link"}
															{tx.pendingKind === "Check" && "Pending · Check code"}
															{!tx.pendingKind && "Pending"}
														</span>
													)}

													<span className="text-[10px] text-slate-400 dark:text-slate-500">
														{formatTime(tx.date)}
													</span>
												</div>

												{/* Amount */}
												<div className="w-16 text-right text-[11px] font-medium">
												<span
													className={
													tx.status === "Pending"
														? "text-slate-500 dark:text-slate-400"
														: tx.type === "Send"
														? "text-slate-900 dark:text-slate-100"
														: "text-emerald-700 dark:text-emerald-300"
													}
												>
													{tx.amount}
												</span>
												</div>
											</>
											)

											// 有 hash：<a>，打开 BaseScan
											if (hasHash) {
												//				show request link
												if (tx.pendingKind === 'Request') {
													return (
														<a
															onClick={() => {

																setIsPay (false)
																setTip(0)
																setAmt(tx.amount)
																setNote(tx.note)
																const params = new URLSearchParams({amount: tx.amount.toFixed(2), code: tx.hash, note: tx.note, address:myAddress }).toString()
																const showUrl = `${showPaylinkSite}?${params}`
																setCreatedDate(tx.date)
																setIsCompleted(tx.status === 'Completed')
																setSuccessUrl(showUrl)
																setShowDEtail(true)

															}}
															key={tx.hash}
															rel="noreferrer"
															className={baseRowClass + clickableClass}
														>
															{rowContent}
														</a>
													)
												}

												return (
													<a
														key={tx.hash}
														href={`https://basescan.org/tx/${tx.hash}`}
														target="_blank"
														rel="noreferrer"
														className={baseRowClass + clickableClass}
													>
														{rowContent}
													</a>
												)
											}

											// 没有 hash：<div>，只能看，不能点
											return (
												<div
													key={`${tx.date}-${tx.from}-${tx.to}`}
													className={baseRowClass + clickableClass}
												>
													{rowContent}
												</div>
											)
										})
									}
								</div>
							</div>
					
					</>
				)
			}
			{
				showDetail && (
					<div className="relative overflow-visible">
						<RedeemOrLinkCard
							createdAt={createdDate}
							isCompleted = {isCompleted}
							isPay={isPay} 
							amt={amt} 
							successUrl={successUrl} 
							tip={tip} 
							note={note} 
							onReset={() => {
								setShowDEtail(false)
						}} />
					</div>

				)
			}
		</div>
    )
  }
)
