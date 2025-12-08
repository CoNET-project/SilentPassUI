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
import {HistoryFilterTabs, HistoryFilter} from './HistoryFilterTabs'
import {RedeemOrLinkCard} from './showHistoryDetail'
import { X } from 'lucide-react'
import base_ex from '@/components/assets/base-ex.svg'
import {getBalanceProcess, formatWithThousands, aesGcmDecrypt} from '@/services/beamio'
import BallSequence from '@/components/loading/BallSequence'
import { QrCode, Link as LinkIcon } from "lucide-react"


type Mode = "pay" | "request" | 'cashcode'

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
	account: string
	hash: string
	note: string
	type: HistoryFilter
	security?: string
	passcode?: string
	redeemHash?: string
	mode: Mode
	type1:HistoryFilter|''
	fee: number
	preAmount: number

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
	return Number(clamped.toFixed(2));
}
const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
type HistoryTableProps = {
}



const showPaylinkSite = 'https://beamio.app'

const fmtAddr = (a = "") => ((a && a !== ethers.ZeroAddress) ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—")

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

const badgeBase = "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/20"


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
    
    const {profiles, setUsdcbalance, usdcbalance, myAddress, setUsdcToUSD, usdcToUSD, setMyAddress} = useDaemonContext()
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

	const [securityCode, setSecurityCode] = useState("")
	const [redeemCode, setRedeemCode] = useState("")
	const [hash, setHash] = useState("")

	const [localMode, setLocalMode] = useState<Mode>('pay')

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

	const process = async (next: HistoryFilter | null) => {
		if (!profiles?.length || !localMode) return
		const profile: any = profiles[0]   // 这里用你实际的 profile 类型替换 any
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
			
			mapped = transfer.map(n => ({
				date: Number(n.timestamp * BigInt(1000)),
				amount: Number(ethers.formatUnits(n.amount, 6)),
				account: n.from.toLowerCase() === myAddrLocal ? n.to : n.from,
				hash: n.finisedHash,
				from: n.from,
				note: n.note,
				type: myAddrLocal === n.to.toLowerCase() ? 'received' : 'sent',
				mode: 'pay',
				fee: 0,
				type1: myAddrLocal === n.to.toLowerCase() ? 'received' : 'sent',
				preAmount: Number(ethers.formatUnits(n.amount, 6))
			}))
			
			const links: LinksHistory[] = _links[1]
			mappedLing = links.map(n => {
				const isRequest = n.from.toLowerCase() === myAddrLocal
				
				const isPending = isRequest ? n.to === ethers.ZeroAddress : n.from === ethers.ZeroAddress
				const isReject = isRequest ?  n.to === '0x1000000000000000000000000000000000000000' : n.from === '0x1000000000000000000000000000000000000000'
				const account = (isPending||isReject) ? '' : isRequest ? n.to : n.from
				const type: HistoryFilter = isReject ? 'reject' : isPending ? 'pending' : isRequest ? 'paid' : 'completed'
				const preAmount =  Number(ethers.formatUnits(n.amount, 6))
				const fee = isRequest ?  0 : calcFeeFromNumber(preAmount)
				const amount = preAmount - fee
				
				const ret: TransferHistork = {
					date: Number(n.issueTimestamp * BigInt(1000)),
					amount,
					account,
					hash: (n.successAuthorizationHash.startsWith('0x00') ? n.payHash : n.successAuthorizationHash),
					note: n.node,
					type,
					mode: 'request',
					fee,
					type1: type === 'paid' ? 'sent' :  type === 'completed' ? 'received' : '',
					preAmount: preAmount
				}
				return ret
			})
		
			const checks: CheckHistory[] = _checks[1]
			mappedCheck = await Promise.all(
				checks.map(async (n): Promise<TransferHistork> => {
					const text = n.node.split('\r\n');
					const encryptedText = text[1];

					const cleanText =
						encryptedText && (await aesGcmDecrypt(encryptedText, profile.privateKey));

					let ce: { secureCode: string; passcode: string } | undefined;
					if (cleanText) {
						ce = JSON.parse(cleanText);
					}
					const isSend = n.from.toLowerCase() === myAddrLocal
					const account = isSend ? n.to === ethers.ZeroAddress ? '' : n.to : n.from === ethers.ZeroAddress ? '' : n.from
					const type: HistoryFilter = !account ? 'pending' : isSend ? 'completed' : 'deposited'
					const preAmount = Number(ethers.formatUnits(n.amount, 6))
					const fee = isSend ?  0 : calcFeeFromNumber(preAmount)
					const amount = preAmount - fee
					
					const ret: TransferHistork = {
						date: Number(n.createTimestamp * BigInt(1000)),
						amount,
						account,
						hash: type === 'pending'
							? n.payHash
							: n.depositHash,
						note: text[0],
						type,
						security: ce?.secureCode,
						passcode: ce?.passcode,
						redeemHash: n.payHash,
						mode: 'cashcode',
						fee,
						type1: type === 'deposited' ? 'received' : type === 'completed' ? 'sent' : '',
						preAmount: isSend ? preAmount : amount
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
					return tx.mode === localMode 
				}
				return tx.mode === localMode || ((tx.type === 'paid' || tx.type === 'completed' || tx.type === 'deposited') )
				
			})

			if (next && next !== 'all') {
				filtered = filtered.filter(tx => tx.type === next)
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
								Send / Receive
							</button>

							{/* REQUEST */}

							
							<button
							type="button"
								className={`flex-1 h-8 rounded-full text-[13px] transition-all
									${localMode === 'request'
									? "bg-white dark:bg-slate-100 text-slate-900 dark:text-slate-900 shadow-sm"
									: "bg-transparent text-slate-500 dark:text-slate-300"
									}`}
								onClick={() => { setLocalMode("request")}}
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
									<div
										className="
											flex items-center px-6 pb-1 text-[10px]
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
												
												{/* 整个 rowContent */}
												<div className="flex items-center gap-3 w-full">
												
													{/* 1. 左侧固定宽度 */}
													<div className="w-20 shrink-0 flex items-center gap-1">
													
													{/* 类型 Badge */}
													<span
														className={[
														"inline-flex",   // 只包文字
														badgeBase,
														getBadgeClass(
															(localMode === 'pay'
															? tx.mode !== 'pay'
																? tx.type1
																: tx.type
															: tx.type) as HistoryFilter
														)
														].join(" ")}
													>
														{localMode === 'pay'
														? tx.mode !== 'pay'
															? tx.type1
															: tx.type
														: tx.type}
													</span>

													{/* C / P 图标 Badge */}
													{(localMode === 'pay' && tx.mode !== 'pay') && (
														<span
														className={[
															"w-[15px] h-[15px] rounded-full flex items-center justify-center",
															tx.mode === 'cashcode'
															? "bg-sky-300/40 text-sky-800 dark:bg-sky-700/40 dark:text-sky-200"
															: "bg-fuchsia-300/40 text-fuchsia-800 dark:bg-fuchsia-700/40 dark:text-fuchsia-200"
														].join(" ")}
														>
														{tx.mode === 'cashcode' ? (
															<QrCode className="w-2.5 h-2.5" strokeWidth={2} />
														) : (
															<LinkIcon className="w-2.5 h-2.5" strokeWidth={2} />
														)}
														</span>
													)}

													</div>

													{/* 2. 中间自适应 */}
													<div className="flex-1 flex items-center min-w-0">
														{/* 左侧文字内容 */}
														<div className="flex-1 flex flex-col min-w-0">
															<span className="font-mono text-slate-800 dark:text-slate-100 truncate">
																{fmtAddr(tx.account)}
															</span>

															{tx.note && (
																<span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
																	{tx.note}
																</span>
															)}

															<span className="text-[10px] text-slate-400 dark:text-slate-500">
																{formatTime(tx.date)}
															</span>
														</div>

														{/* 中间区右侧按钮 */}
														{
															localMode === 'pay' && (
																<button
																	className="
																		ml-3 shrink-0
																		w-8 h-8 rounded-lg
																		flex items-center justify-center
																		bg-slate-100 dark:bg-slate-800
																		border border-slate-200 dark:border-slate-700
																		hover:bg-slate-200 dark:hover:bg-slate-700
																		transition
																	"
																	onClick={() => {
																		window.open(`https://basescan.org/tx/${tx.hash}`, '_blank', 'noopener,noreferrer')
																	}}
																>
																	<img src={base_ex} alt="" className="w-4 h-4" />
																</button>
															)
														}
														
													</div>

													{/* 3. 右侧固定宽度金额 —— 一定在右边 */}
													<div
														className={[
															"w-16 shrink-0 text-right text-[11px] font-medium",

															// 如果是 sent → 红色；否则 → 灰色（正数）
															(tx.mode === "pay"
																? tx.type === "sent"
																: tx.type1 === "sent")
																? "text-rose-600 dark:text-rose-400"     // 负数
																: "text-slate-500 dark:text-slate-400"   // 正数用灰色 50
														].join(" ")}
													>
														{`${tx.mode === 'pay'
															? tx.type === 'sent'
																? '-'    // 支出
																: '+'
															: tx.type1 === 'sent'
																? '-'    // 支出
																: '+'
														} ${
															formatMoney( localMode === 'pay' ? tx.amount : tx.preAmount)
														}`}
													</div>
												</div>
											</>
											)

											// 有 hash：<a>，打开 BaseScan
											if (hasHash) {
												//				show request link
												if (tx.mode !== 'pay') {
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
																setAccount(tx.account)
																setSecurityCode(tx.passcode||'')
																setRedeemCode(tx.security||'')
																setFee(tx.fee)
																setHash(tx.hash)

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
													<div
														key={`${tx.date}-${tx.account}`}
														className={baseRowClass + clickableClass}
													>
														{rowContent}
													</div>
												)
											}

											// 没有 hash：<div>，只能看，不能点
											return (
												<div
													key={`${tx.date}-${tx.account}`}
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
							type={type}
							isPay={isPay}
							amt={amt} 
							successUrl={successUrl} 
							tip={tip} 
							note={note} 
							onReset={() => {
								setShowDEtail(false)
							}}
							hash = {hash}
							account={account}
							fee={fee}
							mode = {localMode}
							securityCode={securityCode}
							redeemCode={redeemCode}

						/>

					</div>

				)
			}
		</div>
    )
  }
)
