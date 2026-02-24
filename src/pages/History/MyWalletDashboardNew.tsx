//		`https://beamio.app/app/?beamiocard=${cardaddress}&redeemcode=${redeemcode}`


import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { ethers } from 'ethers'
import { baseEndpoint, USDCContract_BASE } from '@/utils/constants'
import usdc_abi from '@/services/ABI/usdc_abi.json'
import {
	Sparkles,
	Zap,
	Copy,
	Check,
	ScanLine,
	Plus,
	CreditCard,
	Gift,
	Ticket,
	Globe,
	ArrowUpRight,
	ArrowDownLeft,
	ArrowLeftRight,
	Landmark,
	Loader,
	Banknote,
	QrCode,
	Calculator,
	CalendarCheck,
	HelpCircle,
	RefreshCw,
	Link2,
	Scan,
	ChevronDown,
	Settings,
	History,
	Star,
	Info,
	ShieldCheck,
	ChevronUp,
	Search,
	MinusCircle,
	PlusCircle,
	GripVertical,
	Edit2,
	Save,
} from 'lucide-react'
import PayScreen from '@/pages/Pay/send/index'
import PaymentLink from '@/pages/Pay/PaymentLink/index'
import BankingBridge from './components/BankingBridge'
import TenKeyInputV2 from '@/pages/Pay/components/TenKeyInputV2'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import BeamioPayMe from '@/pages/Pay/BeamioPayMe'
import ShowPayQR from '@/pages/Vouchers/showPayQR'
import { signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen, type OpenContainerRelayPayload } from '@/services/AAaccount'
import { getBalanceProcess, getUsdcBalanceFromApi, formatWithThousands, aesGcmDecrypt } from '@/services/beamio'
import { getMyAssets, getCardsOfOwnerWithDetailsForProfile, postCardRedeem, removeNotFoundRedeems, getRedeemDetailsForDisplay, type UserCardInfo, type RedeemDetailsForDisplay } from '@/services/BeamioCard'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import { storeSystemData } from '@/services/beamio'
import type { RedeemStatusChain } from '@/services/BeamioCard'
import { fiatPrefix, parseNodeEX, calcFeeFromReceived, formatTimev2, formatAmount, type ParsedNote } from '@/services/currency'
import { CCSA_Card_Address } from '@/utils/constants'
import { isRpcDegraded, reportRpcFailure, isRpcQuotaOrNetworkError } from '@/utils/rpcStatus'
import { getRedeemStatusBatchFromChain } from '@/services/BeamioCard'
import base_icon from '@/components/assets/base-logo.png'
import ccsabackphoto from '../Vouchers/assets/ccsacard.avif'
import ActivePannel from './components/activePannel'
import ActiveHistoryPannelNew from './components/activeHistoryPannelNew'
import AccountBeo from './AccountBea'
import { TransactionsItemDetail } from '@/pages/History/TransactionsItemDetail'
import CardManager from '@/pages/cardManager'
import TopUpRedeemForm from '@/pages/Vouchers/TopUpRedeemForm'
import AddAdminBottomSheet from './AddAdminBottomSheet'
import RedeemListScreen from '@/pages/Vouchers/RedeemListScreen'
import BeamioAddUSDCFlow from '@/components/addUSDC/BeamioAddUSDCFlow'

/** Redeem Active List：显示 owner 已创建的 redeem  batches 一览 */
const RedeemActiveList = ({
	batches,
	onManageClick,
	onRemoveNotFound,
}: {
	batches: CardRedeemBatch[]
	onManageClick: () => void
	onRemoveNotFound?: () => void
}) => {
	const [itemStatuses, setItemStatuses] = useState<Record<string, RedeemStatusChain>>({})

	const refreshStatuses = useCallback(async () => {
		const items = batches.flatMap((b) => b.items.map((item) => ({ cardAddress: b.cardAddress, hash: item.hash, code: item.code })))
		if (items.length === 0) return
		const next = await getRedeemStatusBatchFromChain(items)
		setItemStatuses((prev) => ({ ...prev, ...next }))
		const toRemove = new Set<string>(items.filter((it) => next[it.hash] === 'not_found').map((it) => it.hash))
		if (toRemove.size > 0) {
			removeNotFoundRedeems(toRemove)
			onRemoveNotFound?.()
		}
	}, [batches, onRemoveNotFound])

	const batchIds = useMemo(() => batches.map((b) => b.batchId).join(','), [batches])
	useEffect(() => {
		if (batches.length > 0) refreshStatuses()
	}, [batchIds, refreshStatuses])

	return (
		<div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
			<div className="flex items-center justify-between px-2 mb-3">
				<div className="flex items-center gap-2">
					<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
					<span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
						Redeem Active List
					</span>
				</div>
				<button
					type="button"
					onClick={onManageClick}
					className="text-[12px] font-semibold text-[#1D5BFF] active:opacity-70 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30"
				>
					Manage
				</button>
			</div>
			{/* 合约仅存储 active，active=false 时统一为 not_found 并移除；列表中仅剩 pending（有效码） */}
			<div className="space-y-3">
				{[...batches].reverse().slice(0, 10).map((batch) => {
					const pending = batch.items.filter((i) => (itemStatuses[i.hash] ?? 'pending') === 'pending').length
					return (
						<div
							key={batch.batchId}
							onClick={onManageClick}
							className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/85 dark:bg-slate-900/65 ring-1 ring-black/5 dark:ring-white/10 cursor-pointer active:opacity-80"
						>
							<div className="flex-1 min-w-0">
								<p className="text-[13px] font-medium text-slate-800 dark:text-slate-200 truncate">
									{batch.cardName ?? batch.cardAddress.slice(0, 8) + '…'}
								</p>
								<p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
									<span className="text-[22px] font-semibold text-slate-700 dark:text-slate-300">{fiatPrefix(batch.currency as any)}{formatAmount((batch.ptsPer1Currency ? Number(batch.pointsHuman) / Number(batch.ptsPer1Currency) : Number(batch.pointsHuman)), batch.currency as any)}</span> × {batch.items.length}
									{pending > 0 && (
										<span className="ml-2 text-amber-600 dark:text-amber-400">{pending} pending</span>
									)}
								</p>
							</div>
							<span className="text-[10px] text-slate-400 shrink-0">
								{new Date(batch.createdAt).toLocaleDateString()}
							</span>
						</div>
					)
				})}
				{batches.length > 10 && (
					<p className="text-[11px] text-slate-400 px-2">+ {batches.length - 10} more · tap Manage for full list</p>
				)}
			</div>
		</div>
	)
}

const MiniAction = ({
	icon,
	label,
	onClick,
}: {
	icon: React.ReactNode
	label: string
	onClick?: () => void
}) => (
	<button
		type="button"
		onClick={onClick}
		className="flex flex-col items-center gap-2 active:scale-[0.98] transition select-none"
	>
		<div className="h-14 w-14 rounded-2xl bg-white/90 dark:bg-slate-900/70 shadow-[0_10px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center">
			{icon}
		</div>
		<div className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{label}</div>
	</button>
)

/** express 风格操作按钮：白色圆角卡 + 彩色圆形图标 */
const ExpressAction = ({
	icon,
	label,
	iconBgClass,
	onClick,
}: {
	icon: React.ReactNode
	label: string
	iconBgClass: string
	onClick?: () => void
}) => (
	<button
		type="button"
		onClick={onClick}
		className="bg-white rounded-[24px] py-4 flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
	>
		<div className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg ${iconBgClass}`}>
			{icon}
		</div>
		<span className="text-xs font-bold text-gray-700">{label}</span>
	</button>
)

const getBadgeClass = (type: HistoryFilter) => {
	switch (type) {
		case 'sent': return 'bg-slate-300/35 text-slate-700 dark:text-slate-700/35 dark:text-slate-200'
		case 'received': return 'bg-emerald-300/35 text-emerald-700 dark:text-emerald-700/35 dark:text-emerald-200'
		case 'pending': return 'bg-amber-200/40 text-amber-700 dark:text-amber-700/35 dark:text-amber-200'
		case 'completed': return 'bg-sky-300/35 text-sky-800 dark:text-sky-700/35 dark:text-sky-200'
		case 'reject': return 'bg-rose-300/35 text-rose-700 dark:text-rose-700/35 dark:text-rose-200'
		case 'paid': return 'bg-fuchsia-300/35 text-fuchsia-800 dark:text-fuchsia-700/35 dark:text-fuchsia-200'
		case 'deposited': return 'bg-indigo-300/35 text-indigo-800 dark:text-indigo-700/35 dark:text-indigo-200'
		default: return 'bg-slate-700/20 text-slate-800 dark:text-white/10 dark:text-slate-200'
	}
}

const Row = ({
	tx,
	mode,
	onOpen,
}: {
	tx: TransferHistork
	mode: Mode
	onOpen?: (tx: TransferHistork) => void
}) => {
	const hasHash = !!tx.hash
	const clickableClass = hasHash ? 'cursor-pointer hover:bg-slate-100/70 dark:hover:bg-white/5' : 'cursor-default opacity-70'
	const plus = tx.type1 === 'received'
	return (
		<div
			onClick={() => hasHash && onOpen?.(tx)}
			className={['flex items-center gap-2 px-3 py-3', 'border-b border-slate-200/70 dark:border-slate-800/70', 'transition', clickableClass].join(' ')}
		>
			<div className="flex-1 min-w-0">
				<AccountBeo address={tx.address} note="" dateData={formatTimev2(tx.date)} tx={tx} localMode={mode} />
			</div>
			<div className="shrink-0 flex items-center gap-1">
				{mode !== 'pay' && (
					<span className={['inline-flex justify-center items-center', 'w-7 h-7 rounded-full', getBadgeClass(tx.type as HistoryFilter)].join(' ')} title={tx.type}>
						{tx.type === 'pending' ? <Loader className="w-4 h-4" strokeWidth={2} /> : tx.type === 'completed' ? <CalendarCheck className="w-4 h-4" strokeWidth={2} /> : tx.type === 'paid' || tx.type === 'deposited' ? <Banknote className="w-4 h-4" strokeWidth={2} /> : <HelpCircle className="w-4 h-4" strokeWidth={2} />}
					</span>
				)}
			</div>
			<div className={['shrink-0 whitespace-nowrap text-right w-[150px] font-medium tabular-nums', plus ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'].join(' ')}>
				<div className="flex justify-end items-start gap-1.5">
					<span className="text-[14px] leading-[20px]">{plus ? '+' : '−'}</span>
					<div className="flex flex-col gap-0.5 text-right">
						<span className="text-[14px] font-semibold tabular-nums leading-[20px]">
							{formatAmount(tx.type === 'sent' ? tx.preAmount : tx.amount, 'USDC')} USDC
						</span>
						{tx?.requestDetail && (
							<span className="text-[12px] tabular-nums text-slate-400 leading-[16px]">
								{fiatPrefix(tx.requestDetail.requestCurrency)}{' '}
								{formatAmount(tx.type1 === 'sent' ? tx.requestDetail.totalPayCurrency : tx.requestDetail.requestCurrencyAmount || 0, tx.requestDetail.requestCurrency)}
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

interface Card {
	id: string
	name: string
	balance: string
	balanceFiat: number
	address: string
	gradient: string
	badge: string
	badgeIcon: React.ReactNode
	isAA?: boolean
	isCCSA?: boolean
}

/** Manage Passes Overlay - 参照 exampleExpress ManageCardsOverlay，支持隐藏/恢复、重命名 */
const ManageCardsOverlay = ({
	isOpen,
	onClose,
	allPasses,
	onUpdateStatus,
	onRename,
}: {
	isOpen: boolean
	onClose: () => void
	allPasses: { id: string; name: string; nickname?: string; balance: string; currency: string; type: string; memberNo: string; bg: string; status: 'active' | 'archived'; icon?: React.ElementType }[]
	onUpdateStatus: (id: string, status: 'active' | 'archived') => void
	onRename: (id: string, newName: string) => void
}) => {
	const [editingId, setEditingId] = useState<string | null>(null)
	const [tempName, setTempName] = useState('')

	if (!isOpen) return null

	const activePasses = allPasses.filter((p) => p.status === 'active')
	const hiddenPasses = allPasses.filter((p) => p.status === 'archived')

	const startEditing = (pass: (typeof allPasses)[0]) => {
		setEditingId(pass.id)
		setTempName(pass.nickname || pass.name)
	}

	const saveEditing = (id: string) => {
		onRename(id, tempName)
		setEditingId(null)
	}

	return (
		<div className="fixed inset-0 z-[100] bg-[#F2F2F7] flex flex-col animate-slide-up">
			<div className="bg-white/80 backdrop-blur-md px-5 pt-14 pb-4 flex justify-between items-center border-b border-gray-200 sticky top-0 z-10">
				<h1 className="text-lg font-bold">Manage Passes</h1>
				<button type="button" onClick={onClose} className="text-[#1562f0] font-bold text-base">
					Done
				</button>
			</div>
			<div className="flex-1 overflow-y-auto p-5">
				<p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3 ml-2">
					Active Passes ({activePasses.length})
				</p>
				<div className="bg-white rounded-[20px] overflow-hidden shadow-sm mb-6">
					{activePasses.map((pass) => {
						const Icon = pass.id === 'ccsa' ? Globe : CreditCard
						const isEditing = editingId === pass.id
						const displayTitle = pass.nickname || pass.name
						return (
							<div
								key={pass.id}
								className="flex items-center p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors group"
							>
								<button
									type="button"
									onClick={() => onUpdateStatus(pass.id, 'archived')}
									className="text-red-500 mr-4 active:scale-90 transition-transform"
								>
									<MinusCircle className="w-6 h-6 fill-red-100" />
								</button>
								<div
									className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
									style={{ background: pass.bg }}
								>
									<Icon className="w-5 h-5 text-white" />
								</div>
								<div className="flex-1">
									<div className="flex items-center gap-2">
										{isEditing ? (
											<div className="flex items-center gap-2 w-full">
												<input
													type="text"
													value={tempName}
													onChange={(e) => setTempName(e.target.value)}
													className="font-bold text-gray-900 text-sm border-b-2 border-[#1562f0] outline-none bg-transparent w-full"
													autoFocus
													onKeyDown={(e) => {
														if (e.key === 'Enter') saveEditing(pass.id)
													}}
												/>
												<button
													type="button"
													onClick={() => saveEditing(pass.id)}
													className="text-[#1562f0]"
												>
													<Save className="w-4 h-4" />
												</button>
											</div>
										) : (
											<>
												<h3 className="font-bold text-gray-900 text-sm">{displayTitle}</h3>
												{pass.nickname && (
													<span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
														Nickname
													</span>
												)}
												<button
													type="button"
													onClick={() => startEditing(pass)}
													className="opacity-0 group-hover:opacity-100 transition-opacity"
												>
													<Edit2 className="w-3 h-3 text-gray-400 hover:text-[#1562f0]" />
												</button>
											</>
										)}
									</div>
									<p className="text-xs text-gray-500">
										{pass.type} • {pass.balance} {pass.currency}
									</p>
								</div>
								<div className="text-gray-300 cursor-grab active:cursor-grabbing">
									<GripVertical className="w-5 h-5" />
								</div>
							</div>
						)
					})}
					{activePasses.length === 0 && (
						<div className="p-6 text-center text-gray-400 text-sm">No active passes</div>
					)}
				</div>
				{hiddenPasses.length > 0 && (
					<>
						<p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3 ml-2">Hidden</p>
						<div className="bg-white rounded-[20px] overflow-hidden shadow-sm mb-8">
							{hiddenPasses.map((pass) => {
								const Icon = pass.id === 'ccsa' ? Globe : CreditCard
								return (
									<div
										key={pass.id}
										className="flex items-center p-4 border-b border-gray-100 last:border-0 opacity-70"
									>
										<button
											type="button"
											onClick={() => onUpdateStatus(pass.id, 'active')}
											className="text-green-500 mr-4 active:scale-90 transition-transform"
										>
											<PlusCircle className="w-6 h-6 fill-green-100" />
										</button>
										<div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 bg-gray-200">
											<Icon className="w-5 h-5 text-gray-500" />
										</div>
										<div className="flex-1">
											<h3 className="font-bold text-gray-900 text-sm">{pass.nickname || pass.name}</h3>
											<p className="text-xs text-gray-500">Archived by you</p>
										</div>
									</div>
								)
							})}
						</div>
					</>
				)}
			</div>
		</div>
	)
}

export default function MyWalletDashboardNew() {
	const navigate = useNavigate()
	const location = useLocation()
	const {
		profiles,
		setProfiles,
		myAddress,
		setMyAddress,
		usdcbalance,
		setUsdcbalance,
		setUsdcToUSD,
		currencyData,
		setShowFooter,
		setScanData,
		setVoucherPayAmount,
		setVoucherPayToAA,
		setVoucherPayError,
		setScanIntent,
		beamio,
		historyPayData,
		setHistoryPayData,
		redeemFromUrl,
		setRedeemFromUrl,
		voucherPayFromScan,
		setVoucherPayFromScan,
	} = useDaemonContext()

	const [activeView, setActiveView] = useState<string | null>(null) // 'eoa' | 'aa' | 'ccsa' | null
	const [isExpressExpanded, setIsExpressExpanded] = useState(false) // exampleExpress 风格：展开显示 passes
	const [passSearchTerm, setPassSearchTerm] = useState('')
	const [allItems, setAllItems] = useState<TransferHistork[]>([])
	const [loading, setLoading] = useState(false)
	const [itemTx, setItemTx] = useState<TransferHistork>()
	const [showTxDetail, setShowTxDetail] = useState(false)
	const [aaAccountUsdcBalance, setAaAccountUsdcBalance] = useState<string>('0')
	const [ccsaBalance, setCcsaBalance] = useState<string>('0')
	const [ccsaAssets, setCcsaAssets] = useState<{ points: string; nfts: { tokenId: string }[] } | null>(null)
	const [eoaReflash, setEoaReflash] = useState(false)
	const [aaReflash, setAaReflash] = useState(false)
	const [ccsaReflash, setCcsaReflash] = useState(false)
	const [addressCopied, setAddressCopied] = useState<'eoa' | 'aa' | 'ccsa' | null>(null)
	const [copiedCardAddress, setCopiedCardAddress] = useState<string | null>(null)
	const [eoaPanelOpen, setEoaPanelOpen] = useState<'' | 'Pay' | 'BankingBridge' | 'ShowPayQR' | 'PaymentLink'>('')
	/** Add Cash 后：父容器内显示 BeamioAddUSDCFlow 的 Coinbase 确认画面（204-221） */
	const [eoaAddUsdcOpen, setEoaAddUsdcOpen] = useState(false)
	const [aaPanelOpen, setAaPanelOpen] = useState<'' | 'Pay' | 'BeamioPayMeQR'>('')
	const [ccsaCreateCardOpen, setCcsaCreateCardOpen] = useState(false)
	const [topUpRedeemOpen, setTopUpRedeemOpen] = useState(false)
	const [topUpRedeemKey, setTopUpRedeemKey] = useState(0)
	const [addAdminOpen, setAddAdminOpen] = useState(false)
	const [addAdminKey, setAddAdminKey] = useState(0)
	const [showRedeemListOpen, setShowRedeemListOpen] = useState(false)
	const [cardRedeemsVersion, setCardRedeemsVersion] = useState(0)
	const [ccsaRedeemOpen, setCcsaRedeemOpen] = useState(false)
	const [redeemCodeInput, setRedeemCodeInput] = useState('')
	const [redeemCardNumberInput, setRedeemCardNumberInput] = useState('')
	const [redeemLoading, setRedeemLoading] = useState(false)
	const [redeemError, setRedeemError] = useState<string | null>(null)
	const [redeemSuccessTx, setRedeemSuccessTx] = useState<string | null>(null)
	const [redeemDetails, setRedeemDetails] = useState<RedeemDetailsForDisplay | null>(null)
	const [redeemDetailsLoading, setRedeemDetailsLoading] = useState(false)
	const [userCards, setUserCards] = useState<UserCardInfo[]>([])
	const [payScreenMode, setPayScreenMode] = useState<'eoa-pay' | 'aa-eoa-transfer'>('eoa-pay')
	const [isManagingCards, setIsManagingCards] = useState(false)
	/** 已隐藏（archived）的 pass id 列表，用于 ManageCardsOverlay */
	const [archivedPassIds, setArchivedPassIds] = useState<Set<string>>(new Set())
	/** pass 昵称，id -> nickname */
	const [passNicknames, setPassNicknames] = useState<Record<string, string>>({})
	/** 从 historyPayData 进入时暂存，传入 PayScreen 后清除 historyPayData */
	const [pendingPayTarget, setPendingPayTarget] = useState<searchResult | null>(null)
	const [openRelayPayload, setOpenRelayPayload] = useState<OpenContainerRelayPayload | null>(null)
	const [showTenKeySlide, setShowTenKeySlide] = useState(false)
	/** PayScreen 重定向时传入的 payload，确保 TenKeyInput 能拿到金额（避免 context 时序问题） */
	const [pendingSmartRoutingPayload, setPendingSmartRoutingPayload] = useState<{ paymentUrl: string; amount: string; currency: string; toAddress: string } | null>(null)
	const [payMeSigning, setPayMeSigning] = useState(false)
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(!activeView)
	const copyAddressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const copiedCardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const refreshAAAssetsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// 计算汇率
	const fxRateUSDCToCurrency = useCallback(
		(currency: string) => {
			const u2u = Number((currencyData as any)?.USDC ?? 1)
			if (currency === 'USD') return u2u
			const usdToCurrency = Number((currencyData as any)?.[currency] ?? 1)
			return u2u * usdToCurrency
		},
		[currencyData]
	)

	const balanceFiat = useMemo(() => {
		const rate = fxRateUSDCToCurrency('CAD')
		const n = Number(usdcbalance || 0)
		if (!isFinite(rate) || !isFinite(n)) return 0
		return n * rate
	}, [usdcbalance, fxRateUSDCToCurrency])

	const aaBalanceFiat = useMemo(() => {
		const rate = fxRateUSDCToCurrency('CAD')
		const n = Number(aaAccountUsdcBalance || 0)
		if (!isFinite(rate) || !isFinite(n)) return 0
		return n * rate
	}, [aaAccountUsdcBalance, fxRateUSDCToCurrency])

	const ccsaBalanceFiat = useMemo(() => {
		const rate = fxRateUSDCToCurrency('CAD')
		const n = Number(ccsaBalance || 0)
		if (!isFinite(rate) || !isFinite(n)) return 0
		return n * rate
	}, [ccsaBalance, fxRateUSDCToCurrency])

	// 进入时检查 historyPayData：若有 searchResult 则打开 PayScreen 并传入
	useEffect(() => {
		if (historyPayData) {
			setPendingPayTarget(historyPayData)
			setHistoryPayData(null)
			setEoaPanelOpen('Pay')
			setPayScreenMode('eoa-pay')
			setShowFooter(false)
		}
	}, [historyPayData, setHistoryPayData, setShowFooter])

	// 扫码/链接解析得到的 BeamioUserCard redeem URL → 从下往上打开 redeem 面板并预填
	useEffect(() => {
		if (redeemFromUrl?.redeemCode) {
			setRedeemCardNumberInput(redeemFromUrl.cardAddress ?? '')
			setRedeemCodeInput(redeemFromUrl.redeemCode)
			setCcsaRedeemOpen(true)
			setShowFooter(false)
			setRedeemFromUrl(null)
		}
	}, [redeemFromUrl, setRedeemFromUrl, setShowFooter])

	// 扫码 paymentUrl 或 PayScreen 重定向（带 smartRoutingPayload）→ 打开 TenKeyInput 执行 Smart Routing
	useEffect(() => {
		const payload = (location.state as { smartRoutingPayload?: { paymentUrl: string; amount: string; currency: string; toAddress: string } })?.smartRoutingPayload
		if (payload) {
			setPendingSmartRoutingPayload(payload)
			setScanData(payload.paymentUrl)
			setScanIntent('payBill')
			setVoucherPayAmount(payload.amount)
			setVoucherPayToAA(payload.toAddress)
			setShowFooter(false)
			navigate(location.pathname, { replace: true, state: {} })
			queueMicrotask(() => setShowTenKeySlide(true))
			return
		}
		if (voucherPayFromScan) {
			setShowTenKeySlide(true)
			setShowFooter(false)
			setVoucherPayFromScan(false)
		}
	}, [voucherPayFromScan, setVoucherPayFromScan, setShowFooter, location.state, location.pathname, navigate, setScanData, setScanIntent, setVoucherPayAmount, setVoucherPayToAA])

	// 拉取 redeem 详情：当面板打开且有 code 时
	useEffect(() => {
		if (!ccsaRedeemOpen || !redeemCodeInput.trim()) {
			setRedeemDetails(null)
			return
		}
		const cardAddr = redeemCardNumberInput.trim() || CCSA_Card_Address
		if (!ethers.isAddress(cardAddr)) {
			setRedeemDetails(null)
			return
		}
		let cancelled = false
		setRedeemDetailsLoading(true)
		setRedeemDetails(null)
		getRedeemDetailsForDisplay(cardAddr, redeemCodeInput.trim()).then((d) => {
			if (!cancelled) {
				setRedeemDetails(d ?? null)
			}
		}).finally(() => {
			if (!cancelled) setRedeemDetailsLoading(false)
		})
		return () => { cancelled = true }
	}, [ccsaRedeemOpen, redeemCodeInput, redeemCardNumberInput])

	// 从 detail 内操作返回时恢复全局 footer（所有 detail 按钮操作的共同规则）
	const closeEoaPanel = useCallback(() => {
		setShowFooter(true)
		setEoaPanelOpen('')
		setEoaAddUsdcOpen(false)
		setPendingPayTarget(null)
	}, [setShowFooter])

	const closeAaPanel = useCallback(() => {
		setShowFooter(true)
		setAaPanelOpen('')
		setOpenRelayPayload(null)
	}, [setShowFooter])

	// profiles ref 避免 setProfiles 触发 refetchUserCards 重建，进而导致 effect 循环
	const profilesRef = useRef(profiles)
	profilesRef.current = profiles

	// 拉取用户拥有的 BeamioUserCard 列表。RPC/API 成功时更新 profile.issuedCards；失败时使用 profile.issuedCards 缓存，不信任空 []
	const refetchUserCards = useCallback(() => {
		const profile = profilesRef.current?.[0]
		if (!profile || (!profile.aaAccount && !profile.keyID && !profile.privateKeyArmor)) return
		getCardsOfOwnerWithDetailsForProfile(profile)
			.then(({ cards, trusted }) => {
				setUserCards(cards)
				if (trusted) {
					setProfiles((prev: profile[]) => {
						if (!prev?.length) return prev
						const next = [...prev]
						next[0] = { ...next[0], issuedCards: cards }
						return next
					})
					const temp = CoNET_Data
					if (temp?.profiles?.[0]) {
						temp.profiles[0] = { ...temp.profiles[0], issuedCards: cards }
						setCoNET_Data(temp)
						storeSystemData()
					}
				}
			})
			.catch(() => {
				// 异常时使用 profile 缓存
				const cached = profile?.issuedCards ?? []
				setUserCards(cached)
			})
	}, [setProfiles])

	const closeCcsaCreateCard = useCallback(() => {
		setShowFooter(true)
		setCcsaCreateCardOpen(false)
		refetchUserCards()
	}, [setShowFooter, refetchUserCards])

	// 获取 AA 账号的 USDC 余额。返回 string 表示可信，null 表示 RPC/API 失败不可信（调用方应保留原值）
	const loadAaAccountBalanceInFlightRef = useRef<Promise<string | null> | null>(null)
	const loadAaAccountBalance = useCallback(async (): Promise<string | null> => {
		const aa = profilesRef.current?.[0]?.aaAccount
		if (!aa) {
			setAaAccountUsdcBalance('0')
			return '0'
		}
		// 单飞：相同请求不重复发出
		if (loadAaAccountBalanceInFlightRef.current) {
			return loadAaAccountBalanceInFlightRef.current
		}
		const run = async (): Promise<string | null> => {
			try {
				// 限流时仅用 CoNET 节点，baseEndpoint 内部会走 CoNET-only
				const usdcContract = new ethers.Contract(USDCContract_BASE, usdc_abi as ethers.InterfaceAbi, baseEndpoint)
				const balanceRaw = await usdcContract.balanceOf(aa)
				const bal = ethers.formatUnits(balanceRaw, 6)
				setAaAccountUsdcBalance(bal)
				return bal
			} catch (e) {
				if (isRpcQuotaOrNetworkError(e)) reportRpcFailure()
				if (!isRpcDegraded()) {
					const bal = await getUsdcBalanceFromApi(aa)
					if (bal != null) {
						setAaAccountUsdcBalance(bal)
						return bal
					}
				}
				// RPC 错误且无可信兜底：不更新余额，返回 null 让调用方保留原值
				return null
			} finally {
				loadAaAccountBalanceInFlightRef.current = null
			}
		}
		loadAaAccountBalanceInFlightRef.current = run()
		return loadAaAccountBalanceInFlightRef.current
	}, [])

	// 拉取 EOA 交易历史（与 MyWalletDashboard 一致，供 Active & Pending / History 展示）
	const loadEoaHistory = useCallback(async () => {
		if (!profiles?.length) return
		const profile: profile = profiles[0]
		const address = profile.keyID
		if (!address || !ethers.isAddress(address)) {
			setAllItems([])
			setLoading(false)
			return
		}
		if (!myAddress) setMyAddress(address)
		setLoading(true)
		try {
			const myAddrLocal = address.toLowerCase()
			// 旧合约 getTransferHistory/getLinksHistory/getCheckHistory 已停用，直接使用空数据
			const _transfer: [string[], Transfer[]] = [[], []]
			const _links: [string[], LinksHistory[]] = [[], []]
			const _checks: [string[], any[]] = [[], []]
			const transfer: Transfer[] = _transfer[1]
			const mappedPay: TransferHistork[] = transfer.map((n) => {
				let requestDetail: IRequestCurrencyDetail | undefined
				const { noteText, card, payme }: ParsedNote = parseNodeEX(n.note)
				const amount = Number(ethers.formatUnits(n.amount, 6))
				const _amount = Number((payme as any)?.currencyAmount)
				if ((payme as any)?.currency && fiatPrefix((payme as any).currency) && !isNaN(_amount) && _amount > 0) {
					const currencyRate = Number((payme as any).currencyAmount) / amount
					requestDetail = {
						requestCurrency: (payme as any).currency,
						totalPayCurrency: Number((payme as any).currencyAmount),
						totalPayUSDC: amount,
						feeCurrency: 0,
						feeUSDC: 0,
						receivedCurrency: Number((payme as any).currencyAmount),
						receivedUSDC: amount,
						currencyTip: 0,
						USDCTip: 0,
						rate: currencyRate,
						title: (payme as any)?.title,
						textNote: noteText,
						requestCurrencyAmount: Number((payme as any).currencyAmount),
					}
				}
				const ret: TransferHistork = {
					date: Number(n.timestamp * BigInt(1000)),
					amount,
					address: n.from.toLowerCase() === myAddrLocal ? n.to.toLowerCase() : n.from.toLowerCase(),
					hash: n.finisedHash,
					requestCurrency: (payme as any)?.currency || 'USDC',
					note: n.note,
					type: myAddrLocal === n.to.toLowerCase() ? 'received' : 'sent',
					mode: 'pay',
					fee: 0,
					type1: myAddrLocal === n.to.toLowerCase() ? 'received' : 'sent',
					preAmount: amount,
					requestDetail,
				}
				if (card?.image) ret.card = card
				return ret
			})
			const links: LinksHistory[] = _links[1]
			let mappedLinks: TransferHistork[] = links.map((n) => {
				const isRequest = n.from.toLowerCase() === myAddrLocal
				const isPending = isRequest ? n.to === ethers.ZeroAddress : n.from === ethers.ZeroAddress
				const isReject = isRequest ? n.to === '0x1000000000000000000000000000000000000000' : n.from === '0x1000000000000000000000000000000000000000'
				const account = isPending || isReject ? '' : isRequest ? n.to : n.from
				const payAmount = Number(ethers.formatUnits(n.payAmount, 6))
				const _requestCurrencyData = (n?.node || '').split('\r\n')
				const tail = _requestCurrencyData[_requestCurrencyData.length - 1]
				let requestCurrency: ICurrency = 'USDC'
				let group: paymentType = 'onetime'
				let requestDetail: IRequestCurrencyDetail | undefined
				let type: HistoryFilter = isPending ? 'pending' : isRequest ? 'sent' : 'received'
				try {
					const kkk = JSON.parse(tail)
					if (kkk) {
						requestCurrency = kkk.currency
						if (typeof kkk?.oneTimeMode === 'undefined') group = 'payme'
						else group = kkk.oneTimeMode ? 'onetime' : 'reusable'
					}
					if (payAmount) {
						const feeUSDC = calcFeeFromReceived(payAmount)
						const requestCurrencyAmount = Number(kkk?.currencyAmount || 0)
						const currencyTip = Number(kkk?.currencyTip || 0)
						const taxCurrency = Number(kkk?.currencyTax || 0)
						const currencyRate = (requestCurrencyAmount + currencyTip + taxCurrency) / payAmount
						const requestUSDAmount = currencyRate > 0 ? requestCurrencyAmount / currencyRate : 0
						requestDetail = {
							requestCurrency,
							totalPayUSDC: payAmount,
							totalPayCurrency: payAmount * currencyRate,
							requestCurrencyAmount,
							requestUSDAmount,
							feeUSDC,
							feeCurrency: feeUSDC * currencyRate,
							currencyTip,
							USDCTip: currencyRate ? currencyTip / currencyRate : 0,
							taxUSDC: currencyRate ? taxCurrency / currencyRate : 0,
							taxCurrency,
							receivedUSDC: payAmount - feeUSDC,
							receivedCurrency: (payAmount - feeUSDC) * currencyRate,
							rate: currencyRate,
							code: kkk?.code,
							title: kkk?.title,
							textNote: _requestCurrencyData.length - 2 > -1 ? _requestCurrencyData[_requestCurrencyData.length - 2] : '',
						}
					}
				} catch {
					requestCurrency = tail as ICurrency
				}
				return {
					date: Number(n.issueTimestamp * BigInt(1000)),
					amount: payAmount - (requestDetail?.feeUSDC || 0),
					address: account,
					hash: n.successAuthorizationHash.startsWith('0x00') ? n.payHash : n.successAuthorizationHash,
					note: n.node,
					type,
					mode: 'request',
					fee: 0,
					type1: type === 'sent' ? 'paid' : type === 'pending' ? '' : 'received',
					preAmount: payAmount,
					requestCurrency,
					requestDetail,
					group,
				}
			})
			mappedLinks = mappedLinks.filter((n) => !!n?.requestDetail)
			const checks: CheckHistory[] = _checks[1]
			const mappedChecks: TransferHistork[] = await Promise.all(
				checks.map(async (n) => {
					const text = (n.node || '').split('\r\n')
					const encryptedText = text[1]
					let requestDetail: IRequestCurrencyDetail | undefined
					let ce: { secureCode: string; passcode: string } | undefined
					try {
						const cleanText = encryptedText ? await aesGcmDecrypt(encryptedText, profile.privateKeyArmor) : undefined
						if (cleanText) ce = JSON.parse(cleanText)
					} catch {}
					const isCreator = n.from.toLowerCase() === myAddrLocal
					const account = n.to.toLowerCase() !== ethers.ZeroAddress ? n.to.toLowerCase() : ''
					const type: HistoryFilter = !account ? 'pending' : isCreator ? 'completed' : 'deposited'
					const totalPayUSDC = Number(ethers.formatUnits(n.amount, 6))
					const costUSDC = calcFeeFromReceived(totalPayUSDC)
					let amount = type === 'deposited' ? totalPayUSDC - costUSDC : totalPayUSDC
					let hash = type === 'pending' ? n.successAuthorizationHash : n.depositHash
					let type1: HistoryFilter = type === 'deposited' ? 'received' : 'sent'
					const { noteText, card, payme }: ParsedNote = parseNodeEX(n.node)
					const requestCurrencyAmount = Number(payme?.currencyAmount || 0)
					const requestUSDAmount = totalPayUSDC - costUSDC
					const currencyRate = requestCurrencyAmount / requestUSDAmount
					requestDetail = {
						requestCurrency: (payme?.currency || 'USDC') as ICurrency,
						totalPayUSDC,
						totalPayCurrency: totalPayUSDC * currencyRate,
						requestCurrencyAmount,
						requestUSDAmount,
						feeUSDC: type === 'deposited' ? 0 : costUSDC,
						feeCurrency: type === 'deposited' ? 0 : costUSDC * currencyRate,
						currencyTip: 0,
						USDCTip: 0,
						taxUSDC: 0,
						taxCurrency: 0,
						receivedUSDC: type === 'deposited' ? 0 : requestUSDAmount,
						receivedCurrency: type === 'deposited' ? 0 : requestCurrencyAmount,
						rate: currencyRate,
						title: payme?.title,
						textNote: noteText,
					}
					return {
						date: Number(n.createTimestamp * BigInt(1000)),
						amount,
						address: account,
						hash,
						note: n.node,
						type,
						security: ce?.secureCode,
						passcode: ce?.passcode,
						redeemHash: n.payHash,
						mode: 'cashcode',
						fee: costUSDC,
						type1,
						preAmount: totalPayUSDC,
						card,
						payme,
						requestDetail,
					}
				})
			)
			const merged = [...mappedPay, ...mappedLinks, ...mappedChecks].sort((a, b) => b.date - a.date)
			setAllItems(merged)
		} finally {
			setLoading(false)
		}
	}, [profiles, myAddress, setMyAddress])

	// 延迟一帧再拉取历史，让首屏先可交互（避免与 balance/refetchUserCards 等同时阻塞主线程）
	useEffect(() => {
		const id = requestAnimationFrame(() => {
			loadEoaHistory()
		})
		return () => cancelAnimationFrame(id)
	}, [loadEoaHistory])

	const activePending = useMemo(() => {
		return allItems
			.filter((tx) => {
				const isPending = tx.type === 'pending'
				const isRequestActive = tx.mode === 'request' && tx.type === 'sent'
				const isCashcodeReady = tx.mode === 'cashcode' && tx.type === 'pending'
				return isPending || isRequestActive || isCashcodeReady
			})
			.slice(0, 3)
	}, [allItems])

	const history = useMemo(() => {
		return allItems
			.filter((tx) => tx.type1 === 'received' || tx.type1 === 'sent')
			.slice(0, 6)
	}, [allItems])

	// ref 稳定 loadAaAccountBalance，避免 profiles 更新触发 effect 重复执行导致 RPC 循环
	const loadAaAccountBalanceRef = useRef(loadAaAccountBalance)
	loadAaAccountBalanceRef.current = loadAaAccountBalance
	// 初始化：EOA 余额、AA 余额、myAddress（延迟一帧，让首屏先可交互）。仅依赖 keyID 避免 profiles 引用变化触发循环
	useEffect(() => {
		if (!profiles?.length) return
		const profile = profiles[0]
		const keyID = profile?.keyID ?? ''
		if (!keyID) return
		if (!myAddress) setMyAddress(keyID)
		const id = requestAnimationFrame(() => {
			getBalanceProcess(keyID, setUsdcbalance, setUsdcToUSD)
			loadAaAccountBalanceRef.current()
		})
		return () => cancelAnimationFrame(id)
	}, [profiles?.[0]?.keyID, myAddress, setMyAddress, setUsdcbalance, setUsdcToUSD])

	// 拉取 CCSA 卡资产（延迟执行，避免首屏加载阻塞 Footer 等交互）
	useEffect(() => {
		if (!profiles?.[0] || !CCSA_Card_Address) return
		const id = setTimeout(() => {
			getMyAssets(profiles[0], CCSA_Card_Address)
				.then((assets) => {
					if (assets?.points != null) setCcsaBalance(assets.points)
					setCcsaAssets(assets ? { points: assets.points, nfts: assets.nfts ?? [] } : null)
				})
				.catch(() => { setCcsaBalance('0'); setCcsaAssets(null) })
		}, 150)
		return () => clearTimeout(id)
	}, [profiles])

	// ref 稳定 identity，避免 refetchUserCards 触发 effect 重跑导致 RPC 循环
	const refetchUserCardsRef = useRef(refetchUserCards)
	refetchUserCardsRef.current = refetchUserCards
	// 仅在进入 CCSA 视图时拉取 userCards，避免首屏 5+ 个 RPC 并发阻塞主线程和 Footer 交互
	useEffect(() => {
		if (activeView !== 'ccsa') return
		refetchUserCardsRef.current()
	}, [activeView])

	const copyAddress = useCallback(
		(address: string, which: 'eoa' | 'aa' | 'ccsa') => {
			navigator.clipboard?.writeText(address).then(() => {
				if (copyAddressTimeoutRef.current) clearTimeout(copyAddressTimeoutRef.current)
				setAddressCopied(which)
				copyAddressTimeoutRef.current = setTimeout(() => {
					setAddressCopied(null)
					copyAddressTimeoutRef.current = null
				}, 3000)
			})
		},
		[]
	)

	const copyCardAddress = useCallback((address: string) => {
		navigator.clipboard?.writeText(address).then(() => {
			if (copiedCardTimeoutRef.current) clearTimeout(copiedCardTimeoutRef.current)
			setCopiedCardAddress(address)
			copiedCardTimeoutRef.current = setTimeout(() => {
				setCopiedCardAddress(null)
				copiedCardTimeoutRef.current = null
			}, 3000)
		})
	}, [])

	useEffect(
		() => () => {
			if (copyAddressTimeoutRef.current) clearTimeout(copyAddressTimeoutRef.current)
			if (copiedCardTimeoutRef.current) clearTimeout(copiedCardTimeoutRef.current)
		},
		[]
	)

	// 刷新资产：EOA USDC、AA USDC、EOA 交易历史（与 CCSA 分开处理）
	// source: 哪个按钮触发，用于控制对应动画
	const reflashProcess = useCallback(async (source: 'eoa' | 'aa') => {
		const profile = profiles?.[0]
		if (!profile) return
		if (source === 'eoa' && eoaReflash) return
		if (source === 'aa' && aaReflash) return
		if (source === 'eoa') setEoaReflash(true)
		else setAaReflash(true)
		try {
			await getBalanceProcess(profile.keyID, setUsdcbalance, setUsdcToUSD)
			await loadAaAccountBalance()
			await loadEoaHistory()
			refetchUserCards()
		} finally {
			if (source === 'eoa') setEoaReflash(false)
			else setAaReflash(false)
		}
	}, [eoaReflash, aaReflash, profiles, setUsdcbalance, setUsdcToUSD, loadAaAccountBalance, loadEoaHistory, refetchUserCards])

	// 单独刷新 CCSA 资产（与 EOA 刷新分开，动画独立）
	const refreshCcsaAssets = useCallback(async () => {
		if (ccsaReflash) return
		const profile = profiles?.[0]
		if (!profile || !CCSA_Card_Address) return
		setCcsaReflash(true)
		try {
			const assets = await getMyAssets(profile, CCSA_Card_Address)
			if (assets?.points != null) setCcsaBalance(assets.points)
			setCcsaAssets(assets ? { points: assets.points, nfts: assets.nfts ?? [] } : null)
		} catch (e) {
			console.error('Failed to refresh CCSA assets:', e)
			setCcsaBalance('0')
			setCcsaAssets(null)
		} finally {
			setCcsaReflash(false)
		}
	}, [ccsaReflash, profiles])

	/** 延迟 5 秒后刷新 AA 资产（与 MyWalletDashboard 一致） */
	const scheduleRefreshAAAssets = useCallback(() => {
		if (refreshAAAssetsTimeoutRef.current) clearTimeout(refreshAAAssetsTimeoutRef.current)
		refreshAAAssetsTimeoutRef.current = setTimeout(() => {
			refreshAAAssetsTimeoutRef.current = null
			reflashProcess('aa')
		}, 5000)
	}, [reflashProcess])

	useEffect(
		() => () => {
			if (refreshAAAssetsTimeoutRef.current) clearTimeout(refreshAAAssetsTimeoutRef.current)
		},
		[]
	)

	// 卡片数据
	const cards: Card[] = [
		{
			id: 'eoa',
			name: 'USDC on Base',
			balance: String(usdcbalance ?? 0),
			balanceFiat: balanceFiat,
			address: myAddress || '',
			gradient: 'bg-gradient-to-br from-[#1b6dff] via-[#6d3dff] to-[#f54b8b]',
			badge: '',
			badgeIcon: null,
		},
		{
			id: 'aa',
			name: 'Express Pay',
			balance: aaAccountUsdcBalance,
			balanceFiat: aaBalanceFiat,
			address: profiles?.[0]?.aaAccount || '',
			gradient: '', // 使用 express 风格内联渐变
			badge: '',
			badgeIcon: null,
			isAA: true,
		},
		{
			id: 'ccsa',
			name: 'CCSA Card',
			balance: ccsaBalance,
			balanceFiat: ccsaBalanceFiat,
			address: profiles?.[0]?.aaAccount || '',
			gradient: 'bg-gradient-to-br from-amber-600 via-yellow-500 to-orange-500',
			badge: 'Membership',
			badgeIcon: <Globe size={10} className="text-white" />,
			isCCSA: true,
		},
	]

	const handleCardClick = (cardId: string) => {
		setActiveView(activeView === cardId ? null : cardId)
	}

	// 打开 DETAILS PANEL 时隐藏 footer，关闭时恢复（避免 panel z-80 盖住 footer）
	useEffect(() => {
		setShowFooter(!activeView)
	}, [activeView, setShowFooter])

	const selectedCard = cards.find((c) => c.id === activeView)

	// exampleExpress passes：CCSA + userCards，用于展开时的叠卡列表
	const passes = useMemo(() => {
		const list: { id: string; name: string; balance: string; currency: string; type: string; memberNo: string; bg: string; textColor?: string }[] = []
		if (profiles?.[0]?.aaAccount) {
			const nft = ccsaAssets?.nfts?.find((n) => Number(n.tokenId) > 0)
			list.push({
				id: 'ccsa',
				name: 'CCSA CARD',
				balance: formatWithThousands(ccsaBalance),
				currency: 'CAD',
				type: 'Membership',
				memberNo: nft ? `M-${String(nft.tokenId).padStart(6, '0')}` : '',
				bg: 'linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4)',
				textColor: 'white',
			})
		}
		userCards.forEach((uc) => {
			list.push({
				id: uc.cardAddress,
				name: uc.name,
				balance: '—',
				currency: uc.currency,
				type: 'Stored Value',
				memberNo: uc.cardAddress.slice(0, 10) + '...',
				bg: 'linear-gradient(135deg, #7c3aed, #a855f7, #3b82f6)',
			})
		})
		return list
	}, [profiles?.[0]?.aaAccount, ccsaAssets?.nfts, ccsaBalance, userCards])

	const updatePassStatus = useCallback((id: string, status: 'active' | 'archived') => {
		setArchivedPassIds((prev) => {
			const next = new Set(prev)
			if (status === 'archived') next.add(id)
			else next.delete(id)
			return next
		})
	}, [])

	const renamePass = useCallback((id: string, newName: string) => {
		setPassNicknames((prev) => ({ ...prev, [id]: newName.trim() || '' }))
	}, [])

	/** 供 ManageCardsOverlay 使用的完整 pass 列表（含 status、nickname） */
	const allPassesForManage = useMemo(() => {
		return passes.map((p) => ({
			...p,
			nickname: passNicknames[p.id] || undefined,
			status: (archivedPassIds.has(p.id) ? 'archived' : 'active') as 'active' | 'archived',
		}))
	}, [passes, passNicknames, archivedPassIds])

	/** 显示的 passes：排除已隐藏，应用 nickname 作为 displayName */
	const visiblePasses = useMemo(
		() => passes.filter((p) => !archivedPassIds.has(p.id)).map((p) => ({ ...p, displayName: passNicknames[p.id] || p.name })),
		[passes, archivedPassIds, passNicknames]
	)

	const filteredPasses = useMemo(
		() => visiblePasses.filter((p) => p.displayName.toLowerCase().includes(passSearchTerm.toLowerCase())),
		[visiblePasses, passSearchTerm]
	)

	return (
		<>
		<div className="w-full min-h-screen bg-[#F2F2F7] font-sans antialiased overflow-hidden relative flex flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
				{/* 固定独立胶囊：Title + 按钮组，悬浮于顶部，随滚动渐隐 */}
				{!activeView && (
					<div
						className="fixed left-0 right-0 z-30 flex items-center justify-between px-5 transition-opacity duration-300"
						style={{ top: 'max(1rem, env(safe-area-inset-top))', opacity: capsuleOpacity, pointerEvents: capsuleOpacity < 0.05 ? 'none' : 'auto' }}
					>
						{/* Title 胶囊 */}
						<div className="px-4 py-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full shadow-sm border border-gray-200/80 dark:border-slate-600/50">
							<h1 className="text-lg font-bold text-black dark:text-slate-100 tracking-tight">Wallet</h1>
						</div>
						{/* 按钮组胶囊 */}
						<div className="flex items-center gap-2 px-2 py-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full shadow-sm border border-gray-200/80 dark:border-slate-600/50">
							<button
								type="button"
								onClick={() => {
									setPayScreenMode('aa-eoa-transfer')
									setAaPanelOpen('Pay')
									setShowFooter(false)
								}}
								className="w-9 h-9 rounded-full flex items-center justify-center text-[#1562f0] dark:text-blue-400 active:scale-95 transition-transform"
								title="Transfer between Main Vault and Express Pay"
							>
								<ArrowLeftRight className="w-5 h-5" strokeWidth={2.4} />
							</button>
							<button
								type="button"
								onClick={() => setIsManagingCards(true)}
								className="w-9 h-9 rounded-full flex items-center justify-center text-[#1562f0] dark:text-blue-400 active:scale-95 transition-transform"
								title="Edit cards"
							>
								<Edit2 className="w-5 h-5" strokeWidth={2.4} />
							</button>
							<button
								type="button"
								onClick={() => navigate('/settings')}
								className="w-9 h-9 rounded-full flex items-center justify-center text-[#1562f0] dark:text-blue-400 active:scale-95 transition-transform"
								title="Add card"
							>
								<Plus className="w-5 h-5" />
							</button>
						</div>
					</div>
				)}

				{/* Cards and Details Container - exampleExpress WalletStackView 风格 */}
				<div className={`relative flex-1 min-h-0 flex flex-col transition-all duration-[600ms] cubic-bezier(0.19, 1, 0.22, 1) ${activeView ? 'pt-8' : ''}`}>
					{/* Scrollable Main Content - exampleExpress 叠卡布局 */}
					<div
						ref={setScrollRef}
						onScroll={onCapsuleScroll}
						className={`flex-1 min-h-0 pb-32 px-5 scroll-smooth relative no-scrollbar ${
							activeView ? 'overflow-hidden' : 'overflow-y-auto'
						}`}
					>
						{/* 顶部留白：刘海 + 5rem，统一各页首内容距顶距离 */}
						<div className="shrink-0" style={{ minHeight: 'calc(env(safe-area-inset-top) + 5rem)' }} />
						<div className={`relative h-[650px] perspective-1000 transition-transform duration-500 ${activeView === 'eoa' ? 'translate-y-[100px] opacity-50 blur-sm pointer-events-none' : ''}`}>
							{/* LAYER 1: MAIN VAULT (EOA) - 点击折叠 express 或打开详情 */}
							<div
								onClick={() => (isExpressExpanded ? setIsExpressExpanded(false) : {})}
								className={`absolute top-0 w-full rounded-[32px] p-6 text-white shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer ${isExpressExpanded ? 'scale-90 opacity-100 translate-y-4 brightness-50' : 'scale-95 translate-y-16'}`}
								style={{ background: 'linear-gradient(135deg, #2563eb, #9333ea, #db2777)', zIndex: 10 }}
							>
								<div className="flex justify-between items-start mb-8">
									<div className="flex items-center space-x-2">
										<button
											type="button"
											className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-white/30 bg-white/20 backdrop-blur-sm transition hover:bg-white/30 active:scale-[0.95]"
											onClick={(e) => { e.stopPropagation(); reflashProcess('eoa') }}
											disabled={eoaReflash}
										>
											<img src={base_icon} alt="Base" className={`w-5 h-5 object-contain ${eoaReflash ? 'animate-spin opacity-80' : ''}`} />
										</button>
										<span className="font-medium text-lg tracking-wide">USDC on Base</span>
									</div>
									<div className="text-right">
										<h2 className="text-2xl font-bold tracking-tight leading-none text-white drop-shadow-sm">
											{formatWithThousands(usdcbalance || '0')}
											<span className="text-xs font-medium ml-1 opacity-80">USDC</span>
										</h2>
									</div>
								</div>
								<div className="text-center mb-10">
									<div className="flex items-baseline justify-center">
										<span className="text-6xl font-bold tracking-tighter">{formatWithThousands(usdcbalance || '0')}</span>
										<span className="text-xl font-medium ml-2 opacity-80">USDC</span>
									</div>
									<div className="text-white/70 font-medium">≈ CA$ {formatWithThousands(balanceFiat)}</div>
								</div>
								{myAddress && (
									<button
										type="button"
										onClick={(e) => { e.stopPropagation(); copyAddress(myAddress, 'eoa') }}
										className="bg-black/20 backdrop-blur-md px-4 py-2 rounded-full inline-flex items-center space-x-2 border border-white/10 font-mono text-sm mx-auto block w-fit"
									>
										<span>{myAddress.slice(0, 6)}...{myAddress.slice(-4)}</span>
										{addressCopied === 'eoa' ? <Check className="w-3 h-3 opacity-70" /> : <Copy className="w-3 h-3 opacity-70" />}
									</button>
								)}
							</div>

							{/* LAYER 2: EXPRESS PAY (AA) - 点击展开/折叠 passes，或创建入口 */}
							{!profiles?.[0]?.aaAccount ? (
								<div
									className="absolute top-0 w-full rounded-[32px] p-6 text-white shadow-lg transition-all duration-500"
									style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7, #3b82f6)', transform: 'translateY(150px)', zIndex: 20 }}
								>
									<button
										type="button"
										onClick={() => navigate('/settings')}
										className="relative w-full h-full p-6 flex flex-col justify-center items-center cursor-pointer overflow-hidden border-2 border-dashed border-white/30"
									>
										<div className="z-10 bg-white/10 p-4 rounded-full mb-3 backdrop-blur-sm">
											<Plus size={32} className="text-white" />
										</div>
										<h3 className="text-xl font-bold z-10">Create Express Pay</h3>
										<p className="text-white/70 text-sm mt-2 z-10 text-center px-8">Unlock gas-free payments & exclusive vouchers</p>
									</button>
								</div>
							) : (
								<div
									onClick={() => setIsExpressExpanded(!isExpressExpanded)}
									className={`absolute top-0 w-full rounded-[32px] p-6 text-white shadow-[0_20px_50px_-12px_rgba(79,70,229,0.5)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer ${isExpressExpanded ? 'translate-y-[240px]' : 'translate-y-[150px]'}`}
									style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7, #3b82f6)', zIndex: 20 }}
								>
									<div className="flex justify-between items-center mb-8">
										<div className="flex items-center space-x-2">
											<div className="w-8 h-8 rounded-full border-2 border-white/30 flex items-center justify-center">
												<Zap className="w-4 h-4 fill-current" />
											</div>
											<span className="font-medium text-lg tracking-wide">Express Pay</span>
										</div>
										<div className="text-right">
											<h2 className="text-2xl font-bold tracking-tight leading-none text-white drop-shadow-sm">
												{formatWithThousands(aaAccountUsdcBalance || '0')}
												<span className="text-xs font-medium ml-1 opacity-80">USDC</span>
											</h2>
										</div>
									</div>
									<div className="text-center mb-10">
										<div className="flex items-baseline justify-center">
											<span className="text-6xl font-bold tracking-tighter text-[#4ade80]">{formatWithThousands(aaAccountUsdcBalance)}</span>
											<span className="text-xl font-medium ml-2 opacity-80 text-[#4ade80]">USDC</span>
										</div>
										<div className="text-[#4ade80]/70 font-medium">≈ CA$ {formatWithThousands(aaBalanceFiat)}</div>
									</div>
									{profiles?.[0]?.aaAccount && (
										<button
											type="button"
											onClick={(e) => { e.stopPropagation(); copyAddress(profiles[0].aaAccount, 'aa') }}
											className="bg-black/20 backdrop-blur-md px-4 py-2 rounded-full inline-flex items-center space-x-2 border border-white/10 font-mono text-sm mx-auto block w-fit"
										>
											<span>{profiles[0].aaAccount.slice(0, 6)}...{profiles[0].aaAccount.slice(-4)}</span>
											{addressCopied === 'aa' ? <Check className="w-3 h-3 opacity-70" /> : <Copy className="w-3 h-3 opacity-70" />}
										</button>
									)}
									<div className="absolute bottom-4 right-6 opacity-50 animate-bounce">
										{isExpressExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
									</div>
								</div>
							)}

							{/* LAYER 3: PASSES (CCSA + userCards) - 展开时显示，exampleExpress 风格叠卡 */}
							{profiles?.[0]?.aaAccount && (
								<div
									className={`absolute top-[480px] w-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isExpressExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20 pointer-events-none'}`}
									style={{ zIndex: 15 }}
								>
									<div className="mb-4">
										<div className="bg-white rounded-xl px-4 py-2 flex items-center shadow-sm border border-gray-100">
											<Search className="w-4 h-4 text-gray-400 mr-2" />
											<input
												type="text"
												placeholder="Search passes..."
												className="bg-transparent text-sm w-full outline-none text-gray-700 placeholder-gray-400"
												value={passSearchTerm}
												onChange={(e) => setPassSearchTerm(e.target.value)}
											/>
										</div>
									</div>
									<div className="flex items-center justify-between px-2 mb-2">
										<span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{filteredPasses.length} Passes</span>
									</div>
									<div className="relative pb-32">
										{filteredPasses.length > 0 ? (
											filteredPasses.map((pass, index) => {
												const overlap = 135
												return (
													<div
														key={pass.id}
														onClick={() => handleCardClick('ccsa')}
														className="w-full h-48 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform origin-top hover:translate-y-[-8px] border border-white/10"
														style={{
															background: pass.bg,
															zIndex: index,
															marginTop: index === 0 ? 0 : `-${overlap}px`,
															color: pass.textColor || 'white',
															boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
															transform: `scale(${Math.max(0.95, 1 - index * 0.01)})`,
														}}
													>
														<div className="flex justify-between items-center mb-3">
															<div className="flex items-center gap-3">
																<div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-sm">
																	{pass.id === 'ccsa' ? <Globe className="w-4 h-4 text-white" /> : <CreditCard className="w-4 h-4 text-white" />}
																</div>
																<div className="flex flex-col">
																	<h3 className="font-bold text-sm leading-tight text-white/90 drop-shadow-sm">{pass.displayName}</h3>
																	<span className="text-[10px] opacity-70 uppercase tracking-wider">{pass.type}</span>
																</div>
															</div>
															<div className="text-right">
																<h2 className="text-2xl font-bold tracking-tight leading-none text-white drop-shadow-sm">
																	{pass.balance}
																	<span className="text-xs font-medium ml-1 opacity-80">{pass.currency}</span>
																</h2>
															</div>
														</div>
														<div className="mt-auto pt-8 flex justify-end items-end opacity-40">
															<p className="text-[10px] font-mono tracking-widest">{pass.memberNo}</p>
														</div>
													</div>
												)
											})
										) : (
											<div className="text-center py-10 text-gray-400 text-sm">No passes found</div>
										)}
									</div>
								</div>
							)}
						</div>

					</div>

					{/* 40% 黑色遮罩：盖住背后被压住的卡片，点击关闭 */}
					{activeView && (
						<div
							className="absolute inset-0 z-[65] bg-black/40 transition-opacity duration-300 cursor-pointer"
							onClick={() => setActiveView(null)}
						/>
					)}

					{/* DETAILS PANEL - 盖住卡片，距离顶部 刘海+1rem，z 高于卡片；隐藏时 pointer-events-none 避免遮挡 footer */}
					<div
						className={`absolute inset-x-0 bottom-0 bg-[#F2F2F7] rounded-t-[4px] transition-transform duration-[600ms] cubic-bezier(0.19, 1, 0.22, 1) z-[80] flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.1)] ${
							activeView ? 'translate-y-0' : 'translate-y-[1000px] pointer-events-none'
						}`}
						style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
					>
						{/* 顶部渐变条（按卡片类型） */}
						{selectedCard && (
							<>
								<div
									className="absolute top-0 left-0 w-full h-64 z-0"
									style={{
										background:
											selectedCard.id === 'eoa'
												? 'linear-gradient(135deg, #2563eb, #9333ea, #db2777)'
												: selectedCard.id === 'aa'
													? 'linear-gradient(135deg, #7c3aed, #a855f7, #3b82f6)'
													: 'linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4)',
									}}
								/>
								<div className="absolute top-0 left-0 w-full h-64 z-0 bg-gradient-to-b from-transparent to-[#F2F2F7]" />
							</>
						)}

						{/* Header：关闭、设置 - VoucherDetailModal 风格，白色按钮在渐变上 */}
						<div className="px-6 pt-6 pb-2 flex justify-between items-center z-10">
							<button
								type="button"
								onClick={() => setActiveView(null)}
								className="p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 text-white transition-colors"
								aria-label="Close"
							>
								<ChevronDown className="w-6 h-6" />
							</button>
							<button
								type="button"
								onClick={() => navigate('/settings')}
								className="p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 text-white transition-colors"
								aria-label="Settings"
							>
								<Settings className="w-6 h-6" />
							</button>
						</div>

						{/* 可滚动内容 */}
						{selectedCard && (
							<div className="flex-1 overflow-y-auto px-6 pt-2 pb-24 z-10 no-scrollbar">
								{/* 卡片预览块 - VoucherDetailModal 风格 */}
								<div
									className="w-full min-h-[14rem] rounded-[24px] p-6 text-white shadow-2xl relative overflow-hidden mb-8"
									style={{
										background:
											selectedCard.id === 'eoa'
												? 'linear-gradient(135deg, #2563eb, #9333ea, #db2777)'
												: selectedCard.id === 'aa'
													? 'linear-gradient(135deg, #7c3aed, #a855f7, #3b82f6)'
													: selectedCard.id === 'ccsa'
														? 'linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4)'
														: 'linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4)',
									}}
								>
									<div className="flex justify-between items-start mb-2">
										<div className="flex flex-col">
											<h2 className="text-4xl font-bold tracking-tight leading-none text-white drop-shadow-sm">
												{formatWithThousands(selectedCard.balance)}{' '}
												<span className="text-xl font-medium ml-2 opacity-90">
													{selectedCard.id === 'ccsa' ? 'CAD' : 'USDC'}
												</span>
											</h2>
											<p className="text-[10px] font-bold opacity-70 tracking-widest uppercase mt-1">Balance</p>
										</div>
										{selectedCard.id === 'ccsa' && ccsaAssets?.nfts?.find((n) => Number(n.tokenId) > 0) && (
											<div className="text-xs font-mono opacity-80 tracking-widest pt-2 text-right">
												M-{String(ccsaAssets.nfts.find((n) => Number(n.tokenId) > 0)?.tokenId ?? '').padStart(6, '0')}
											</div>
										)}
										{selectedCard.id !== 'ccsa' && selectedCard.address && (
											<div className="text-xs font-mono opacity-80 tracking-widest pt-2 text-right">
												{selectedCard.address.slice(0, 6)}...{selectedCard.address.slice(-4)}
											</div>
										)}
									</div>
									<div className="mt-12 flex justify-between items-end">
										<div className="flex items-center gap-3">
											<div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
												{selectedCard.id === 'eoa' ? (
													<Landmark className="w-7 h-7 text-white" />
												) : selectedCard.id === 'aa' ? (
													<Zap className="w-7 h-7 text-white fill-white" />
												) : (
													<Globe className="w-7 h-7 text-white" />
												)}
											</div>
											<div>
												<h3 className="font-bold text-xl leading-none">{selectedCard.name}</h3>
												<span className="text-[10px] opacity-80 uppercase tracking-wider">
													{selectedCard.id === 'eoa' ? 'Main Wallet' : selectedCard.id === 'aa' ? 'Express Pay' : 'Membership'}
												</span>
											</div>
										</div>
										<QrCode className="w-8 h-8 opacity-60" />
									</div>
								</div>

								{/* Actions - express 风格 */}
								<div className="mb-8">
									{selectedCard.id === 'eoa' ? (
										<div className="flex items-start justify-between flex-wrap gap-4">
											
										</div>
									) : selectedCard.id === 'aa' ? (
										/* Express Pay：Transfer / Pay / Pay bill / Vouchers（与 MyWalletDashboard Tab 2 一致） */
										<div className="flex items-start justify-between flex-wrap gap-4">
											<MiniAction
												label="Transfer"
												icon={<ArrowLeftRight className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
												onClick={() => {
													setPayScreenMode('aa-eoa-transfer')
													setShowFooter(false)
													setAaPanelOpen('Pay')
												}}
											/>
											
											<MiniAction
												label="Pay bill"
												icon={<ScanLine className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
												onClick={() => {
													setScanData('')
													setVoucherPayAmount('')
													setVoucherPayToAA('')
													setVoucherPayError('')
													setScanIntent('payBill')
													setShowFooter(false)
													setShowTenKeySlide(true)
												}}
											/>
											
											<MiniAction
												label="Charge"
												icon={<Calculator className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
												onClick={() => {
													setScanData('')
													setVoucherPayAmount('')
													setVoucherPayToAA('')
													setVoucherPayError('')
													setScanIntent('')
													setShowFooter(false)
													setShowTenKeySlide(true)
												}}
											/>
											<MiniAction
												label="Vouchers"
												icon={<Banknote className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
												onClick={async () => {
													navigate('/settings')
												}}
											/>

										</div>
									) : (
										/* CCSA Card：express 风格 Pay / Top Up / Details 三键网格 */
										<div className="grid grid-cols-3 gap-3">
											<ExpressAction
												label="Pay"
												iconBgClass="bg-[#1562f0] shadow-blue-600/30"
												icon={<Scan className="w-5 h-5" />}
												onClick={() => {
													setScanData('')
													setVoucherPayAmount('')
													setVoucherPayToAA('')
													setVoucherPayError('')
													// setScanIntent('payBill')
													setShowFooter(false)
													setActiveView(null)
													setShowTenKeySlide(true)
												}}
											/>
											<ExpressAction
												label="Top Up"
												iconBgClass="bg-green-500 shadow-green-500/30"
												icon={<Plus className="w-5 h-5" />}
												onClick={() => {
													setTopUpRedeemKey((k) => k + 1)
													setShowFooter(false)
													setTopUpRedeemOpen(true)
												}}
											/>
											<ExpressAction
												label={userCards.length === 0 ? 'Create Card' : 'Add Admin'}
												iconBgClass="bg-orange-500 shadow-orange-500/30"
												icon={<CreditCard className="w-5 h-5" />}
												onClick={() => {
													if (userCards.length === 0) {
														setCcsaCreateCardOpen(true)
														setShowFooter(false)
													} else {
														setAddAdminKey((k) => k + 1)
														setShowFooter(false)
														setAddAdminOpen(true)
													}
												}}
											/>
										</div>
									)}
								</div>

								{/* Recent Activity - VoucherDetailModal 风格 */}
								{selectedCard.id === 'eoa' ? (
									<>
										{/* Active & Pending */}
										<div className="bg-white rounded-[24px] p-5 shadow-sm mb-4">
											<div className="flex items-center gap-2 mb-4">
												<span className="h-1.5 w-1.5 rounded-full bg-[#2F78FF]" />
												<div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-500">
													Active & Pending
												</div>
												{loading && <Loader className="w-3.5 h-3.5 text-slate-400 animate-spin" strokeWidth={2.2} />}
											</div>
											{activePending.length ? (
												<ActivePannel
													items={activePending}
													onOpen={(tx) => {
														setItemTx(tx)
														setShowTxDetail(true)
														setShowFooter(false)
													}}
												/>
											) : (
												<div className="py-6 text-center text-gray-400 text-sm">No active items</div>
											)}
										</div>

										{/* Indexer History（BeamioIndexerDiamond 本月前20条） */}
										<ActiveHistoryPannelNew />

										{/* Recent Activity */}
										<div className="bg-white rounded-[24px] p-5 shadow-sm mb-4">
											<div className="flex justify-between items-center mb-4">
												<h3 className="font-bold text-gray-900">Recent Activity</h3>
												<button
													type="button"
													onClick={() => navigate('/HistoryAll')}
													className="text-xs font-bold text-[#1562f0]"
												>
													View All
												</button>
											</div>
											{history.length ? (
												<div className="space-y-4">
													{history.slice(0, 10).map((tx) => (
														<div
															key={`${tx.mode}-${tx.hash}-${tx.date}`}
															onClick={() => {
																setItemTx(tx)
																setShowTxDetail(true)
																setShowFooter(false)
															}}
															className="flex justify-between items-center cursor-pointer hover:bg-gray-50 rounded-xl p-2 -mx-2"
														>
															<div className="flex items-center space-x-3">
																<div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
																	<History className="w-4 h-4" />
																</div>
																<div>
																	<div className="text-sm font-bold text-gray-900">{tx.type}</div>
																	<div className="text-xs text-gray-500">{formatTimev2(tx.date)}</div>
																</div>
															</div>
															<span className={`text-sm font-bold ${tx.type1 === 'received' ? 'text-green-600' : 'text-gray-900'}`}>
																{tx.type1 === 'received' ? '+' : '−'} {formatAmount(tx.type1 === 'received' ? tx.amount : tx.preAmount, 'USDC')} USDC
															</span>
														</div>
													))}
												</div>
											) : (
												<div className="text-center py-8 text-gray-400 text-sm">No recent transactions</div>
											)}
										</div>
									</>
									) : selectedCard.id === 'ccsa' ? (
										/* CCSA：Member Benefits + Recent Activity + Card Information + My BeamioUserCards */
										<>
											{/* Member Benefits - VoucherDetailModal 风格 */}
											<div className="bg-white rounded-[24px] p-5 shadow-sm mb-4">
												<div className="flex items-center gap-2 mb-4">
													<Star className="w-4 h-4 text-orange-500 fill-orange-500" />
													<h3 className="font-bold text-gray-900">Member Benefits</h3>
												</div>
												<div className="space-y-4">
													<div className="flex items-start gap-3">
														<div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
															<Star className="w-4 h-4 text-[#1562f0]" />
														</div>
														<div>
															<h4 className="text-sm font-bold text-gray-900">Alliance Discount</h4>
															<p className="text-xs text-gray-500 leading-relaxed">10% off at participating restaurants.</p>
														</div>
													</div>
													<div className="flex items-start gap-3">
														<div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
															<Zap className="w-4 h-4 text-[#1562f0]" />
														</div>
														<div>
															<h4 className="text-sm font-bold text-gray-900">Gas-Free</h4>
															<p className="text-xs text-gray-500 leading-relaxed">Zero transaction fees on Beamio network.</p>
														</div>
													</div>
												</div>
											</div>

											{/* Recent Activity */}
											<div className="bg-white rounded-[24px] p-5 shadow-sm mb-4">
												<div className="flex justify-between items-center mb-4">
													<h3 className="font-bold text-gray-900">Recent Activity</h3>
													<span className="text-xs font-bold text-[#1562f0]">View All</span>
												</div>
												<div className="text-center py-8 text-gray-400 text-sm">No recent transactions</div>
											</div>

											{/* Card Information - VoucherDetailModal 风格 */}
											<div className="bg-white rounded-[24px] p-5 shadow-sm mb-4">
												<div className="flex items-center gap-2 mb-4">
													<Info className="w-4 h-4 text-gray-400" />
													<h3 className="font-bold text-gray-900">Card Information</h3>
												</div>
												<div className="space-y-3">
													<div className="flex justify-between text-xs">
														<span className="text-gray-500">Issuer</span>
														<span className="font-medium text-gray-900">Canada Chinese Restaurant Alliance</span>
													</div>
													<div className="flex justify-between text-xs">
														<span className="text-gray-500">Network</span>
														<span className="font-medium text-gray-900">Base Mainnet</span>
													</div>
													<div className="flex justify-between text-xs">
														<span className="text-gray-500">Standard</span>
														<span className="font-medium text-gray-900">ERC-1155</span>
													</div>
													<div className="flex justify-between text-xs">
														<span className="text-gray-500">Contract</span>
														<span className="font-mono text-gray-500">
															{CCSA_Card_Address ? `${CCSA_Card_Address.slice(0, 6)}...${CCSA_Card_Address.slice(-4)}` : '—'}
														</span>
													</div>
													<div className="flex justify-between text-xs items-center pt-2 border-t border-gray-100 mt-2">
														<span className="text-gray-500 flex items-center gap-1">
															<ShieldCheck className="w-3 h-3 text-green-500" /> Audit Status
														</span>
														<span className="font-bold text-green-600">Verified</span>
													</div>
												</div>
											</div>

											{/* My BeamioUserCards */}
											<div className="bg-white rounded-[24px] p-5 shadow-sm mb-4">
												{userCards.length > 0 && (
													<div className="flex justify-end mb-4">
														<button
															type="button"
															onClick={() => {
																setTopUpRedeemKey((k) => k + 1)
																setShowFooter(false)
																setTopUpRedeemOpen(true)
															}}
															className="flex items-center gap-1.5 text-[#1562f0] text-xs font-bold"
														>
															<Gift className="w-4 h-4" /> Airdrop
														</button>
													</div>
												)}
												<div className="flex items-center justify-between mb-4">
													<div className="flex items-center gap-2">
														<span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
														<div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-500">
															My BeamioUserCards
														</div>
													</div>
													{userCards.length > 0 && (
														<button
															type="button"
															onClick={() => {
																setTopUpRedeemKey((k) => k + 1)
																setShowFooter(false)
																setTopUpRedeemOpen(true)
															}}
															className="text-[12px] font-semibold text-[#1D5BFF] active:opacity-70 px-3 py-1.5 rounded-lg bg-blue-50"
														>
															Top Up
														</button>
													)}
												</div>
												{userCards.length > 0 ? (
												<div className="space-y-3">
													{userCards.map((card) => (
														<div
															key={card.cardAddress}
															className="flex items-start justify-between gap-3 p-4 rounded-2xl bg-white/85 dark:bg-slate-900/65 ring-1 ring-black/5 dark:ring-white/10"
														>
															<div className="flex-1 min-w-0">
																<p className="font-semibold text-slate-900 dark:text-slate-100 text-[15px]">
																	{card.name}
																</p>
																<div className="flex items-center gap-1.5 mt-0.5">
																	<p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate" title={card.cardAddress}>
																		{card.cardAddress.slice(0, 10)}...{card.cardAddress.slice(-8)}
																	</p>
																	<button
																		type="button"
																		onClick={(e) => {
																			e.stopPropagation()
																			copyCardAddress(card.cardAddress)
																		}}
																		className="shrink-0 p-1 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-700/50 transition-colors active:scale-95"
																		aria-label="Copy address"
																	>
																		<AnimatePresence mode="wait">
																			{copiedCardAddress === card.cardAddress ? (
																				<motion.span
																					key="check"
																					initial={{ scale: 0, opacity: 0 }}
																					animate={{ scale: 1, opacity: 1 }}
																					transition={{ type: 'spring', stiffness: 400, damping: 20 }}
																				>
																					<Check size={14} className="text-emerald-500 dark:text-emerald-400" strokeWidth={2.5} />
																				</motion.span>
																			) : (
																				<motion.span
																					key="copy"
																					initial={{ opacity: 1 }}
																					exit={{ opacity: 0 }}
																				>
																					<Copy size={14} className="text-slate-500 dark:text-slate-400" strokeWidth={2} />
																				</motion.span>
																			)}
																		</AnimatePresence>
																	</button>
																</div>
																<div className="flex items-center gap-2 mt-1.5 text-sm text-slate-600 dark:text-slate-300">
																	<span>{card.currency}</span>
																	<span>·</span>
																	<span>
																		1 {fiatPrefix(card.currency as any)} = {formatAmount(Number(card.ptsPer1Currency), card.currency as any)} pts
																	</span>
																</div>
															</div>
														</div>
													))}
												</div>
											) : (
												<div className="px-4 py-5 text-[12px] text-slate-500 dark:text-slate-400 rounded-2xl bg-white/85 dark:bg-slate-900/65 ring-1 ring-black/5 dark:ring-white/10">
													No BeamioUserCards yet. Create one with the button above.
												</div>
											)}

											{/* Redeem Active List：owner 已创建的 redeem 一览 */}
											{(CoNET_Data?.cardRedeems?.length ?? 0) > 0 && (
												<RedeemActiveList
													batches={CoNET_Data?.cardRedeems ?? []}
													onManageClick={() => {
														setShowFooter(false)
														setShowRedeemListOpen(true)
													}}
													onRemoveNotFound={() => setCardRedeemsVersion((v) => v + 1)}
												/>
											)}
										</div>
										</>
									) : (
										/* AA (Express Pay)：Recent Activity */
										<div className="bg-white rounded-[24px] p-5 shadow-sm mb-4">
											<div className="flex justify-between items-center mb-4">
												<h3 className="font-bold text-gray-900">Recent Activity</h3>
												<span className="text-xs font-bold text-[#1562f0]">View All</span>
											</div>
											<div className="text-center py-8 text-gray-400 text-sm">No recent transactions</div>
										</div>
									)}
								</div>
						)}
					</div>
				</div>

				{/* EOA Send / Bank 底部浮层 */}
				<div
					className={`fixed inset-0 z-[100] ${eoaPanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
					aria-hidden={!eoaPanelOpen}
				>
					<div
						className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${eoaPanelOpen ? 'opacity-100' : 'opacity-0'}`}
						onClick={closeEoaPanel}
					/>
					<div
						className={`absolute inset-x-0 bottom-0 bg-white dark:bg-slate-900 rounded-t-[22px] max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-hidden pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out ${eoaPanelOpen ? 'translate-y-0' : 'translate-y-full'}`}
					>
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
						</div>
						<div className="px-4 pb-4 overflow-y-auto">
							{eoaPanelOpen === 'Pay' && (
								<PayScreen
									mode="eoa-pay"
									beamioer={pendingPayTarget ?? undefined}
									close={closeEoaPanel}
								/>
							)}
							{eoaPanelOpen === 'BankingBridge' && !eoaAddUsdcOpen && (
								<BankingBridge
									onAddCash={() => setEoaAddUsdcOpen(true)}
									onCashOut={() => setEoaAddUsdcOpen(true)}
								/>
							)}
							{eoaPanelOpen === 'BankingBridge' && eoaAddUsdcOpen && (
								<>
									<BeamioNavBack
										title=""
										onClose={() => setEoaAddUsdcOpen(false)}
										onMore={() => {}}
									/>
									<BeamioAddUSDCFlow
										embedInSheet
										onCancel={() => setEoaAddUsdcOpen(false)}
									/>
								</>
							)}
							{eoaPanelOpen === 'PaymentLink' && (
								<PaymentLink
									close={() => closeEoaPanel()}
								/>
							)}
							{eoaPanelOpen === 'ShowPayQR' && (
								<>
									<BeamioNavBack
										title=""
										onClose={closeEoaPanel}
										onMore={() => {}}
									/>
									<ShowPayQR
										successUrl={'https://beamio.app?beamio=' + (beamio?.accountName ?? '')}
										beamio={beamio ?? null}
										qrValue={undefined}
									/>
								</>
							)}
						</div>
					</div>
				</div>

				{/* Express Pay：Transfer / Pay / Pay Me 底部浮层（z-[100] 高于卡片 z-60，确保盖住 card） */}
				<div
					className={`fixed inset-0 z-[100] ${aaPanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
					aria-hidden={!aaPanelOpen}
				>
					<div
						className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${aaPanelOpen ? 'opacity-100' : 'opacity-0'}`}
						onClick={closeAaPanel}
					/>
					<div
						className={`absolute inset-x-0 bottom-0 bg-white dark:bg-slate-900 rounded-t-[22px] max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-hidden pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out ${aaPanelOpen ? 'translate-y-0' : 'translate-y-full'}`}
					>
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
						</div>
						<div className="px-4 pb-4 overflow-y-auto">
							{aaPanelOpen === 'Pay' && (
								<PayScreen
									mode={payScreenMode}
									close={() => closeAaPanel()}
									aaAccountUsdcBalance={aaAccountUsdcBalance}
								/>
							)}
							{aaPanelOpen === 'BeamioPayMeQR' && openRelayPayload != null && (
								<BeamioPayMe
									showActiveTab={false}
									relayPayload={openRelayPayload}
									onClose={() => closeAaPanel()}
								/>
							)}
						</div>
					</div>
				</div>

				{/* CCSA Create Card：底部滑出窗口 */}
				<div
					className={`fixed inset-0 z-[100] ${ccsaCreateCardOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
					aria-hidden={!ccsaCreateCardOpen}
				>
					<div
						className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${ccsaCreateCardOpen ? 'opacity-100' : 'opacity-0'}`}
						onClick={closeCcsaCreateCard}
					/>
					<div
						className={`absolute inset-x-0 bottom-0 bg-[#0f0f12] rounded-t-[22px] max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-hidden pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out ${ccsaCreateCardOpen ? 'translate-y-0' : 'translate-y-full'}`}
					>
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-500/70" />
						</div>
						<div className="overflow-y-auto max-h-[calc(100dvh-60px)]">
							<CardManager
								embedded
								onClose={closeCcsaCreateCard}
								onCreated={() => {
									refetchUserCards()
									setTimeout(() => refetchUserCards(), 4000)
								}}
							/>
						</div>
					</div>
				</div>

				{/* CCSA Redeem：Redeem Asset 面板 - 按图示设计 */}
				<div
					className={`fixed inset-0 z-[100] ${ccsaRedeemOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
					aria-hidden={!ccsaRedeemOpen}
				>
					<div
						className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${ccsaRedeemOpen ? 'opacity-100' : 'opacity-0'}`}
						onClick={() => {
							setCcsaRedeemOpen(false)
							setShowFooter(true)
							setRedeemError(null)
							setRedeemSuccessTx(null)
							setRedeemDetails(null)
						}}
					/>
					<div
						className={`absolute inset-x-0 bottom-0 bg-white dark:bg-slate-900 rounded-t-[22px] max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-hidden pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out ${ccsaRedeemOpen ? 'translate-y-0' : 'translate-y-full'}`}
					>
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-500/70" />
						</div>
						<div className="px-6 py-6 overflow-y-auto">
							{/* Loading: Minting to AA... */}
							{redeemLoading ? (
								<div className="flex flex-col items-center justify-center py-16">
									<div className="w-16 h-16 rounded-full bg-[#1652f0] flex items-center justify-center mb-6">
										<Loader className="w-8 h-8 text-white animate-spin" strokeWidth={2.5} />
									</div>
									<p className="text-lg font-bold text-slate-900 dark:text-slate-100">Minting to AA...</p>
									<p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Executing Logic Hook</p>
								</div>
							) : redeemSuccessTx ? (
								/* Success: Redeemed Successfully */
								<div className="space-y-6">
									<div className="flex items-center justify-center gap-2">
										<div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
											<Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
										</div>
										<p className="text-lg font-bold text-slate-900 dark:text-slate-100">Redeemed Successfully</p>
									</div>

									{/* CCSA Card - 显示最新余额 */}
									{redeemDetails && (
										<div className="w-full max-w-[340px] mx-auto">
											<div className="relative w-full aspect-[1.58/1] rounded-[24px] overflow-hidden shadow-2xl">
												<img src={ccsabackphoto} alt="CCSA Card" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
												<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.02)_38%,rgba(0,0,0,0.18)_100%)]" />
												<div className="relative z-10 p-5 h-full flex flex-col justify-between">
													<div className="flex justify-between items-start">
														<div className="flex items-center gap-3">
															<div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: 'linear-gradient(135deg, #ffd65a 0%, #d19a00 100%)' }}><Globe className="h-5 w-5 text-white" /></div>
															<div><div className="text-[18px] font-black tracking-wide text-[#fff2c6] drop-shadow-sm font-serif">CCSA</div><div className="text-[18px] font-black tracking-wide text-[#fff2c6] -mt-0.5 font-serif">CARD</div></div>
														</div>
														<div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold flex items-center gap-1 text-white"><Globe size={10} className="text-white" /> Membership</div>
													</div>
													<div>
														<p className="text-[10px] font-bold opacity-80 uppercase mb-0.5 text-[#fff2c6]">Balance</p>
														<div className="flex items-baseline gap-1">
															<span className="text-3xl font-medium tracking-tighter text-[#fff2c6]">{(() => {
																const pts = Number(redeemDetails.pointsHuman)
																const ptsPer1 = Number(redeemDetails.ptsPer1Currency)
																if (!ptsPer1) return formatAmount(pts, 'USDC', 4)
																const amt = pts / ptsPer1
																return formatAmount(amt, redeemDetails.currency as any, amt > 0 && amt < 0.01 ? 4 : undefined)
															})()}</span>
															<span className="text-sm font-semibold opacity-90 text-[#fff2c6]">{redeemDetails.currency as string}</span>
														</div>
													</div>
												</div>
											</div>
										</div>
									)}

									{/* NEW TRANSACTION */}
									<div className="rounded-2xl bg-slate-100 dark:bg-slate-800/50 p-4 space-y-3">
										<div className="flex items-center justify-between">
											<span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">New Transaction</span>
											<span className="px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-xs font-semibold">Confirmed</span>
										</div>
										<div className="rounded-xl bg-white dark:bg-slate-800 p-4 flex items-center gap-4">
											<div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
												<ArrowDownLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
											</div>
											<div className="flex-1 min-w-0">
												<p className="font-semibold text-slate-900 dark:text-slate-100">Stored Value Added</p>
												<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Just now</p>
											</div>
											<div className="text-right shrink-0">
												<p className="text-base font-bold text-emerald-600 dark:text-emerald-400">+ {redeemDetails ? (() => {
													const pts = Number(redeemDetails.pointsHuman)
													const ptsPer1 = Number(redeemDetails.ptsPer1Currency)
													if (!ptsPer1) return formatAmount(pts, 'USDC', 4)
													const amt = pts / ptsPer1
													return formatAmount(amt, redeemDetails.currency as any, amt > 0 && amt < 0.01 ? 4 : undefined)
												})() : '0'}</p>
												<p className="text-xs text-slate-500 dark:text-slate-400">{redeemDetails?.currency as string ?? 'CAD'}</p>
											</div>
										</div>
										<div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
											<span className="text-xs text-slate-500 dark:text-slate-400"># REF</span>
											<a
												href={`https://basescan.org/tx/${redeemSuccessTx}`}
												target="_blank"
												rel="noopener noreferrer"
												className="text-xs font-mono text-slate-900 dark:text-slate-100 hover:underline"
											>
												{`${redeemSuccessTx.slice(0, 6)}...${redeemSuccessTx.slice(-4)}`}
											</a>
										</div>
									</div>

									<button
										type="button"
										onClick={() => {
											setCcsaRedeemOpen(false)
											setShowFooter(true)
											setRedeemSuccessTx(null)
											setRedeemDetails(null)
											refetchUserCards()
											if (profiles?.[0]) getMyAssets(profiles[0], CCSA_Card_Address).then(setCcsaAssets)
										}}
										className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-base uppercase tracking-wide"
									>
										Done
									</button>
								</div>
							) : (
								<>
							{/* Header */}
							<h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-0.5 text-center">Redeem Asset</h3>
							<p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center">Mint to Express Pay (Smart Account)</p>

							{/* Asset Card - CCSA CARD 风格 */}
							{(redeemDetailsLoading || redeemDetails) && (
								<div className="w-full max-w-[340px] mx-auto mb-6">
									{redeemDetailsLoading ? (
										<div className="relative w-full aspect-[1.58/1] rounded-[24px] overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
											<Loader className="w-10 h-10 animate-spin text-slate-400" strokeWidth={2} />
										</div>
									) : redeemDetails ? (
										<div className="relative w-full aspect-[1.58/1] rounded-[24px] overflow-hidden shadow-2xl">
											<img src={ccsabackphoto} alt="CCSA Card" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
											<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.02)_38%,rgba(0,0,0,0.18)_100%)]" />
											<div className="relative z-10 p-5 h-full flex flex-col justify-between">
												<div className="flex justify-between items-start">
													<div className="flex items-center gap-3">
														<div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: 'linear-gradient(135deg, #ffd65a 0%, #d19a00 100%)' }}><Globe className="h-5 w-5 text-white" /></div>
														<div><div className="text-[18px] font-black tracking-wide text-[#fff2c6] drop-shadow-sm font-serif">CCSA</div><div className="text-[18px] font-black tracking-wide text-[#fff2c6] -mt-0.5 font-serif">CARD</div></div>
													</div>
													<div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold flex items-center gap-1 text-white"><Globe size={10} className="text-white" /> Membership</div>
												</div>
												<div>
													<p className="text-[10px] font-bold opacity-80 uppercase mb-0.5 text-[#fff2c6]">Balance</p>
													<div className="flex items-baseline gap-1">
														<span className="text-3xl font-medium tracking-tighter text-[#fff2c6]">{(() => {
															const pts = Number(redeemDetails.pointsHuman)
															const ptsPer1 = Number(redeemDetails.ptsPer1Currency)
															if (!ptsPer1) return formatAmount(pts, 'USDC', 4)
															const amt = pts / ptsPer1
															return formatAmount(amt, redeemDetails.currency as any, amt > 0 && amt < 0.01 ? 4 : undefined)
														})()}</span>
														<span className="text-sm font-semibold opacity-90 text-[#fff2c6]">{redeemDetails.currency as string}</span>
													</div>
												</div>
											</div>
										</div>
									) : null}
								</div>
							)}

							{/* Redemption Code */}
							<div className="mb-4">
								<label htmlFor="redeem-code" className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
									Redemption Code
								</label>
								<div className="relative">
									<div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 flex items-center gap-3">
										<Link2 className="w-5 h-5 text-slate-400 shrink-0" strokeWidth={2} />
										<input
											id="redeem-code"
											type="text"
											value={redeemCodeInput}
											onChange={(e) => setRedeemCodeInput(e.target.value)}
											placeholder="00Efik2Ev8a51QPTCdRoNf"
											className="flex-1 min-w-0 bg-transparent text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
											disabled={redeemLoading}
											autoComplete="off"
										/>
										{redeemDetails?.status === 'pending' && (
											<Check className="w-5 h-5 text-emerald-500 shrink-0" strokeWidth={2.5} />
										)}
									</div>
									{redeemDetails?.status === 'pending' && (
										<p className="mt-2 flex items-center gap-1.5 text-[13px] text-slate-600 dark:text-slate-400">
											<Globe size={14} className="text-slate-400 shrink-0" />
											Verified. Ready to mint via Smart Contract.
										</p>
									)}
								</div>
							</div>

							{/* Card address (optional) - 折叠或小字 */}
							<details className="mb-4">
								<summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Card address (optional)</summary>
								<input
									id="redeem-card-number"
									type="text"
									value={redeemCardNumberInput}
									onChange={(e) => setRedeemCardNumberInput(e.target.value)}
									placeholder="Leave empty for CCSA card"
									className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400"
									disabled={redeemLoading}
									autoComplete="off"
								/>
							</details>

								<form
									onSubmit={async (e) => {
										e.preventDefault()
										const code = redeemCodeInput.trim()
										if (!code) return
										const profile = profiles?.[0]
										let toUserEOA = ''
										if (profile?.keyID && ethers.isAddress(profile.keyID)) {
											toUserEOA = profile.keyID
										} else if (profile?.privateKeyArmor) {
											try {
												toUserEOA = new ethers.Wallet(profile.privateKeyArmor).address
											} catch {
												setRedeemError('Could not resolve your address')
												return
											}
										}
										if (!toUserEOA || !ethers.isAddress(toUserEOA)) {
											setRedeemError('Please connect your wallet first')
											return
										}
										setRedeemLoading(true)
										setRedeemError(null)
										const cardAddr = redeemCardNumberInput.trim() || CCSA_Card_Address
										if (!ethers.isAddress(cardAddr)) {
											setRedeemError('Invalid card address')
											return
										}
										const result = await postCardRedeem(cardAddr, code, toUserEOA)
										setRedeemLoading(false)
										if (result.success && result.tx) {
											setRedeemSuccessTx(result.tx)
										} else {
											let err = result.error ?? 'Redeem failed'
											if (result.status === 404) err = 'API endpoint not found (404). The cardRedeem API may not be deployed yet.'
											else if (result.status && result.status >= 400) err = `Redeem failed: ${err}${result.status ? ` [HTTP ${result.status}]` : ''}`
											setRedeemError(err)
										}
									}}
									className="space-y-4"
								>
									{redeemError && (
										<p className="text-sm text-rose-600 dark:text-rose-400">{redeemError}</p>
									)}
									<div className="flex gap-3">
										<button
											type="button"
											onClick={() => {
												setCcsaRedeemOpen(false)
												setShowFooter(true)
												setRedeemDetails(null)
											}}
											className="flex-1 py-3.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={redeemLoading || !redeemCodeInput.trim()}
											className="flex-1 py-3.5 rounded-xl bg-[#1652f0] text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#1345ca] transition-colors"
										>
											{redeemLoading ? <Loader className="w-5 h-5 animate-spin" strokeWidth={2} /> : null}
											Redeem
										</button>
									</div>
								</form>
							</>
							)}
						</div>
					</div>
				</div>

				{/* Top Up Redeem：Owner 免 gas 空投 pts */}
				<div
					className={`fixed inset-0 z-[100] ${topUpRedeemOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
					aria-hidden={!topUpRedeemOpen}
				>
					<div
						className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${topUpRedeemOpen ? 'opacity-100' : 'opacity-0'}`}
						onClick={() => { setTopUpRedeemOpen(false); setShowFooter(true) }}
					/>
					<div
						className={`absolute inset-x-0 bottom-0 bg-white dark:bg-slate-900 rounded-t-[22px] max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-hidden pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out ${topUpRedeemOpen ? 'translate-y-0' : 'translate-y-full'}`}
					>
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-500/70" />
						</div>
						<div className="overflow-y-auto max-h-[calc(100dvh-60px)] flex flex-col">
							<TopUpRedeemForm
								key={topUpRedeemKey}
								userCards={userCards}
								onClose={() => { setTopUpRedeemOpen(false); setShowFooter(true) }}
								onSuccess={() => refetchUserCards()}
							/>
						</div>
					</div>
				</div>

				{/* Add Admin：Owner 添加 admin（EOA 地址） */}
				<div
					className={`fixed inset-0 z-[100] ${addAdminOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
					aria-hidden={!addAdminOpen}
				>
					<div
						className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${addAdminOpen ? 'opacity-100' : 'opacity-0'}`}
						onClick={() => { setAddAdminOpen(false); setShowFooter(true) }}
					/>
					<div
						className={`absolute inset-x-0 bottom-0 bg-white dark:bg-slate-900 rounded-t-[22px] max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-hidden pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out ${addAdminOpen ? 'translate-y-0' : 'translate-y-full'}`}
					>
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-500/70" />
						</div>
						<div className="overflow-y-auto max-h-[calc(100dvh-60px)] flex flex-col">
							<AddAdminBottomSheet
								key={addAdminKey}
								userCards={userCards}
								onClose={() => { setAddAdminOpen(false); setShowFooter(true) }}
								onSuccess={() => refetchUserCards()}
							/>
						</div>
					</div>
				</div>

				{/* Pay bill / Vouchers：TenKeyInput 全屏滑入 */}
				{showTenKeySlide && createPortal(
					<AnimatePresence>
						<motion.div
							key="tenkey-slide"
							className="fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col"
							initial={{ x: '100%' }}
							animate={{ x: 0 }}
							exit={{ x: '100%' }}
							transition={{ duration: 0.28, ease: 'easeOut' }}
							onTouchMove={(e) => e.stopPropagation()}
						>
							<BeamioNavBack
								title=""
								onClose={() => {
									setShowTenKeySlide(false)
									setShowFooter(true)
									setPendingSmartRoutingPayload(null)
								}}
								onMore={() => {}}
							/>
							<div className="flex-1 min-h-0 flex flex-col overflow-hidden pt-[calc(env(safe-area-inset-top)+3rem)]">
								<TenKeyInputV2
								
									initialSmartRoutingPayload={pendingSmartRoutingPayload}
									onPayloadConsumed={() => setPendingSmartRoutingPayload(null)}
									onPaymentSuccess={() => {
										setShowTenKeySlide(false)
										setShowFooter(true)
										setPendingSmartRoutingPayload(null)
										scheduleRefreshAAAssets()
									}}
								/>
							</div>
						</motion.div>
					</AnimatePresence>,
					document.body
				)}

				{/* EOA 交易详情：Active & Pending / History 项点击后滑入 */}
				{showTxDetail && itemTx && createPortal(
					<AnimatePresence>
						<motion.div
							key="tx-detail"
							className="fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col"
							initial={{ x: '100%' }}
							animate={{ x: 0 }}
							exit={{ x: '100%' }}
							transition={{ duration: 0.28, ease: 'easeOut' }}
							onTouchMove={(e) => e.stopPropagation()}
						>
							<BeamioNavBack
								title=""
								onClose={() => {
									setShowTxDetail(false)
									setItemTx(undefined)
									setShowFooter(true)
								}}
								onMore={() => {}}
							/>
							<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain pt-[calc(env(safe-area-inset-top)+3rem)]">
								<TransactionsItemDetail localMode={itemTx.mode} tx={itemTx} />
							</div>
						</motion.div>
					</AnimatePresence>,
					document.body
				)}

				{/* Redeem Active List：从右滑入的独立窗口，查看完整 redeem 并执行 Cancel */}
				{showRedeemListOpen && createPortal(
					<AnimatePresence>
						<motion.div
							key="redeem-list"
							className="fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col"
							initial={{ x: '100%' }}
							animate={{ x: 0 }}
							exit={{ x: '100%' }}
							transition={{ duration: 0.28, ease: 'easeOut' }}
							onTouchMove={(e) => e.stopPropagation()}
						>
							<BeamioNavBack
								title=""
								onClose={() => {
									setShowRedeemListOpen(false)
									setShowFooter(true)
								}}
								onMore={() => {}}
							/>
							<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain pt-[calc(env(safe-area-inset-top)+3rem)]">
								<RedeemListScreen
									onClose={() => {
										setShowRedeemListOpen(false)
										setShowFooter(true)
									}}
									onRemoveNotFound={() => setCardRedeemsVersion((v) => v + 1)}
								/>
							</div>
						</motion.div>
					</AnimatePresence>,
					document.body
				)}

				{/* Manage Passes Overlay - Edit 按钮打开 */}
				<ManageCardsOverlay
					isOpen={isManagingCards}
					onClose={() => setIsManagingCards(false)}
					allPasses={allPassesForManage}
					onUpdateStatus={updatePassStatus}
					onRename={renamePass}
				/>
		</div>
		<style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } } .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1); }`}</style>
		</>
	)
}
