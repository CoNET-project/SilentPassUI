import { IpfsImg } from '@/components/IpfsImg';
//		`https://beamio.app/app/?beamiocard=${cardaddress}&redeemcode=${redeemcode}`


import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { ethers } from 'ethers'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
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
	MinusCircle,
	PlusCircle,
	GripVertical,
	Edit2,
	Save,
	SmartphoneNfc,
	Loader2,
	X,
	Layers,
	ImagePlus,
	Trash2,
	TreePine,
	ArrowDownToLine,
	Radio,
	Wallet,
	ChevronRight,
	Store,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import PayScreen from '@/pages/Pay/send/index'
import PaymentLink from '@/pages/Pay/PaymentLink/index'
import BankingBridge from './components/BankingBridge'
import TenKeyInputV2 from '@/pages/Pay/components/TenKeyInputV2'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import BeamioPayMe from '@/pages/Pay/BeamioPayMe'
import ShowPayQR from '@/pages/Vouchers/showPayQR'
import { encodeOpenContainerRelayQrPayload, signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen, type OpenContainerRelayPayload } from '@/services/AAaccount'
import { formatWithThousands, aesGcmDecrypt, fetchUIDAssets, type UIDAssetsResponse } from '@/services/beamio'
import { getMyAssets, getCardOwner, getCardMetadataFromUri, getCardMetadataFromApi, getCardMetadataFrom1155Json, getNftMetadataFromApi, getCardsOfOwnerWithDetailsForProfile, postCardRedeem, removeNotFoundRedeems, getRedeemDetailsForDisplay, signExecuteForOwner, encodeCreateIssuedNft, postCardCreateIssuedNft, getTierIndexForRedeemAmount, isCardExcludedFromDisplay, filterDisplayUserCards, loadApiExcludedUserCards, type UserCardInfo, type RedeemDetailsForDisplay, type CardRedeemBatch, type CardTierMetadata, type NftTierMetadata, type CardMetadataFromUri } from '@/services/BeamioCard'
import { filterExcludedCardDetailKeys } from '@/utils/apiExcludedUserCards'
import { postToIPFS } from '@/services/beamio'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import { storeSystemData } from '@/services/beamio'
import type { RedeemStatusChain } from '@/services/BeamioCard'
import { fiatPrefix, parseNodeEX, calcFeeFromReceived, formatTimev2, formatAmount, type ParsedNote } from '@/services/currency'
import { CCSA_Card_Address, BEAMIO_USER_CARD_ASSET_ADDRESS, CASH_TREES_CARD_ADDRESS, beamioApi } from '@/utils/constants'
import { BASE_MAINNET_FACTORIES } from '@/config/chainAddresses'
import { getRedeemStatusBatchFromChain } from '@/services/BeamioCard'
import ccsabackphoto from '../Vouchers/assets/ccsacard.avif'
import greenCard from '../Vouchers/assets/greenCard.png'
import blackCard from '../Vouchers/assets/BlackCard.png'
import ActivePannel from './components/activePannel'
import ActiveHistoryPannelNew from './components/activeHistoryPannelNew'
import AccountBeo from './AccountBea'
import { TransactionsItemDetail } from '@/pages/History/TransactionsItemDetail'
import CardManager from '@/pages/cardManager'
import TopUpRedeemForm from '@/pages/Vouchers/TopUpRedeemForm'
import USDCUserCardTopupControl from '@/pages/Vouchers/USDCUserCardTopupControl'
import AddAdminBottomSheet from './AddAdminBottomSheet'
import RedeemListScreen from '@/pages/Vouchers/RedeemListScreen'
import BeamioAddUSDCFlow from '@/components/addUSDC/BeamioAddUSDCFlow'
import { useNfcRead } from '@/hooks/useNfcRead'
import { tu } from '@/locale/beamioLocale'

const HISTORY_BALANCE_CACHE_KEY_PREFIX = 'beamio:history:balance:v1:'
const getHistoryBalanceCacheKey = (keyID: string) => `${HISTORY_BALANCE_CACHE_KEY_PREFIX}${keyID.toLowerCase()}`

type HistoryBalanceCache = {
	usdcbalance: number
	usdcToUSD?: number
	updatedAt: number
}

const readHistoryBalanceCache = (keyID: string): HistoryBalanceCache | null => {
	if (!keyID || typeof window === 'undefined' || !window.localStorage) return null
	try {
		const raw = window.localStorage.getItem(getHistoryBalanceCacheKey(keyID))
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<HistoryBalanceCache>
		if (!Number.isFinite(Number(parsed?.usdcbalance))) return null
		return {
			usdcbalance: Number(parsed.usdcbalance),
			usdcToUSD: Number.isFinite(Number(parsed?.usdcToUSD)) ? Number(parsed?.usdcToUSD) : undefined,
			updatedAt: Number.isFinite(Number(parsed?.updatedAt)) ? Number(parsed?.updatedAt) : Date.now(),
		}
	} catch {
		return null
	}
}

const getHistoryUserCardsCacheKey = (profile: profile): string => {
	const eoa = String(profile?.keyID ?? '').trim().toLowerCase()
	const aa = String(profile?.aaAccount ?? '').trim().toLowerCase()
	return `${eoa}|${aa}`
}

const readHistoryUserCardsCache = (profile: profile): UserCardInfo[] => {
	const key = getHistoryUserCardsCacheKey(profile)
	if (!key || key === '|') return []
	const root = CoNET_Data as any
	const fromStore = root?.historyUserCards?.[key]
	const raw = Array.isArray(fromStore)
		? (fromStore as UserCardInfo[])
		: Array.isArray(profile?.issuedCards)
			? (profile.issuedCards as UserCardInfo[])
			: []
	return filterDisplayUserCards(raw)
}

const writeHistoryUserCardsCache = (profile: profile, cards: UserCardInfo[]) => {
	const key = getHistoryUserCardsCacheKey(profile)
	if (!key || key === '|') return
	const temp = CoNET_Data as any
	if (!temp) return
	if (!temp.historyUserCards || typeof temp.historyUserCards !== 'object') {
		temp.historyUserCards = {}
	}
	temp.historyUserCards[key] = filterDisplayUserCards(cards)
	if (temp?.profiles?.[0]) {
		temp.profiles[0] = { ...temp.profiles[0], issuedCards: filterDisplayUserCards(cards) }
	}
	setCoNET_Data(temp)
	storeSystemData()
}

/** NFC 读取余额底部滑出页：仅当用户按下「读取 NFC 卡」时走 NFC 流程，其余时刻忽略 */
function NfcCheckBalanceBottomSheet({
	open,
	onClose,
	readUid,
}: {
	open: boolean
	onClose: () => void
	readUid: () => Promise<string | null>
}) {
	const [uid, setUid] = useState<string | null>(null)
	const [manualUid, setManualUid] = useState('')
	const [status, setStatus] = useState<'idle' | 'reading' | 'loading' | 'success' | 'error'>('idle')
	const [error, setError] = useState<string | null>(null)
	const [assets, setAssets] = useState<UIDAssetsResponse | null>(null)

	useEffect(() => {
		if (!error) return
		const t = setTimeout(() => setError(null), 5000)
		return () => clearTimeout(t)
	}, [error])

	const handleQuery = useCallback(async (uidToUse: string) => {
		setStatus('loading')
		setError(null)
		setAssets(null)
		try {
			const res = await fetchUIDAssets(uidToUse)
			if (res.ok && res.points != null) {
				setAssets(res)
				setStatus('success')
			} else {
				setError(res.error ?? '查询失败')
				setStatus('error')
			}
		} catch (e) {
			setError((e as Error)?.message ?? tu('request_failed'))
			setStatus('error')
		}
	}, [])

	const handleRead = async () => {
		const trimmed = manualUid.trim()
		if (trimmed) {
			setUid(trimmed)
			setStatus('idle')
			await handleQuery(trimmed)
			return
		}
		setStatus('reading')
		setError(null)
		setUid(null)
		setAssets(null)
		const result = await readUid()
		if (result) {
			setUid(result)
			setStatus('idle')
			await handleQuery(result)
		} else {
			setError('NFC 读取失败，请重试')
			setStatus('error')
		}
	}

	const handleClose = () => {
		setUid(null)
		setManualUid('')
		setStatus('idle')
		setError(null)
		setAssets(null)
		onClose()
	}

	return (
		<div className={['fixed inset-0 z-[100]', open ? 'pointer-events-auto' : 'pointer-events-none'].join(' ')}>
			<div className={['absolute inset-0 bg-black/50 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0'].join(' ')} onClick={handleClose} />
			<div className={['absolute inset-x-0 bottom-0 bg-white dark:bg-slate-900 rounded-t-[22px] max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-hidden pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out', open ? 'translate-y-0' : 'translate-y-full'].join(' ')}>
				<div className="pt-2 pb-1 flex justify-center">
					<div className="h-1 w-10 rounded-full bg-slate-500/70" />
				</div>
				<div className="px-6 py-6 overflow-y-auto">
					<div className="flex flex-col items-center gap-6">
						<div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
							<SmartphoneNfc className="w-10 h-10 text-amber-600 dark:text-amber-400" strokeWidth={2} />
						</div>
						<h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">读取 NFC 卡余额</h2>
						<p className="text-sm text-slate-500 dark:text-slate-400">将 NTAG 424 DNA 卡靠近手机背面，或手工输入 UID</p>
						{status === 'loading' ? (
							<div className="flex flex-col items-center py-8">
								<Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
								<p className="text-slate-500 dark:text-slate-400">查询中...</p>
							</div>
						) : status === 'success' && assets ? (
							<div className="w-full space-y-4">
								<div className="relative w-full max-w-[340px] mx-auto rounded-2xl overflow-hidden shadow-lg aspect-[1.58/1]">
									<IpfsImg src={ccsabackphoto} alt={tu('ccsa_card')} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
									<div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
									<div className="absolute inset-0 p-5 flex flex-col justify-end text-white">
										<div className="flex justify-between items-start mb-1">
											<div className="flex flex-col">
												<h2 className="text-2xl font-bold tracking-tight leading-none text-[#fff2c6] drop-shadow-sm">
													{formatWithThousands(String(assets.points ?? 0))}{' '}
													<span className="text-lg font-medium ml-1 opacity-90">
														{(assets.cardCurrency as any) ?? 'CAD'}
													</span>
												</h2>
												<p className="text-[10px] font-bold opacity-70 tracking-widest uppercase mt-0.5">{tu('balance')}</p>
											</div>
											{assets.nfts?.find((n) => Number(n.tokenId) > 0) && (
												<div className="text-xs font-mono opacity-80 tracking-widest pt-1 text-right shrink-0">
													M-{String(assets.nfts.find((n) => Number(n.tokenId) > 0)!.tokenId).padStart(6, '0')}
												</div>
											)}
										</div>
										<p className="text-xs opacity-90 mt-1">USDC: {formatAmount(Number(assets.usdcBalance ?? 0), 'USDC', 4)}</p>
										{assets.address && <p className="text-[10px] font-mono opacity-70 mt-2 truncate">{assets.address}</p>}
									</div>
								</div>
								<div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-4">
									<p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{tu('uid')}</p>
									<p className="font-mono text-sm break-all text-slate-800 dark:text-slate-200">{uid}</p>
								</div>
								<button type="button" onClick={handleClose} className="w-full py-3.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold">
									完成
								</button>
							</div>
						) : (
							<>
								<div className="w-full">
									<label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">手工输入 UID（可选）</label>
									<input
										type="text"
										value={manualUid}
										onChange={(e) => setManualUid(e.target.value)}
										placeholder="例如：04A1B2C3D4E5F6"
										className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 font-mono text-sm border-0 focus:ring-2 focus:ring-amber-500"
									/>
								</div>
								<button
									type="button"
									onClick={handleRead}
									disabled={status === 'reading'}
									className="w-full py-3.5 rounded-xl bg-amber-500 text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
								>
									{status === 'reading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <SmartphoneNfc className="w-5 h-5" />}
									{status === 'reading' ? '请靠近 NFC 卡...' : manualUid.trim() ? '查询余额（手工 UID）' : '读取 NFC 卡'}
								</button>
							</>
						)}
						{error && (
							<div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
								<X className="w-5 h-5 flex-shrink-0" />
								<span>{error}</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

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
					<span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">{tu('redeem_active_list')}</span>
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
	/** 来自 pass 时用于预览背景 */
	bg?: string
	/** 来自 pass 时用于显示货币（CAD/USDC 等） */
	currency?: string
	/** 来自 pass 时用于显示会员号 M-xxxxxx */
	memberNo?: string
	/** 来自 pass 时用于显示卡面图片 */
	image?: string
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
	allPasses: { id: string; name: string; nickname?: string; balance: string; currency: string; type: string; memberNo: string; bg: string; status: 'active' | 'archived'; icon?: React.ElementType; image?: string }[]
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
				<h1 className="text-lg font-bold">{tu('manage_passes')}</h1>
				<button type="button" onClick={onClose} className="text-[#1562f0] font-bold text-base">{tu('done')}</button>
			</div>
			<div className="flex-1 overflow-y-auto p-5">
				<p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3 ml-2">
					Active Passes ({activePasses.length})
				</p>
				<div className="bg-white rounded-[20px] overflow-hidden shadow-sm mb-6">
					{activePasses.map((pass) => {
						const Icon = pass.id === 'ccsa' ? Globe : pass.id === CASH_TREES_CARD_ADDRESS ? TreePine : CreditCard
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
									className="w-10 h-10 rounded-full flex items-center justify-center mr-3 overflow-hidden shrink-0"
									style={{ background: pass.bg }}
								>
									{pass.image ? <IpfsImg src={pass.image} alt="" className="w-full h-full object-cover" /> : <Icon className="w-5 h-5 text-white" />}
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
						<div className="p-6 text-center text-gray-400 text-sm">{tu('no_active_passes')}</div>
					)}
				</div>
				{hiddenPasses.length > 0 && (
					<>
						<p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3 ml-2">{tu('hidden')}</p>
						<div className="bg-white rounded-[20px] overflow-hidden shadow-sm mb-8">
							{hiddenPasses.map((pass) => {
								const Icon = pass.id === 'ccsa' ? Globe : pass.id === CASH_TREES_CARD_ADDRESS ? TreePine : CreditCard
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
										<div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 overflow-hidden shrink-0 bg-gray-200">
											{pass.image ? <IpfsImg src={pass.image} alt="" className="w-full h-full object-cover" /> : <Icon className="w-5 h-5 text-gray-500" />}
										</div>
										<div className="flex-1">
											<h3 className="font-bold text-gray-900 text-sm">{pass.nickname || pass.name}</h3>
											<p className="text-xs text-gray-500">{tu('archived_by_you')}</p>
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
		aaAccountUsdcBalance,
		refreshRecentActivityNoAa,
	} = useDaemonContext()

	const [activeView, setActiveView] = useState<string | null>(null) // 'eoa' | 'aa' | 'ccsa' | null
	const [allItems, setAllItems] = useState<TransferHistork[]>([])
	const [loading, setLoading] = useState(false)
	const [itemTx, setItemTx] = useState<TransferHistork>()
	const [showTxDetail, setShowTxDetail] = useState(false)
	/** 从 api/latestCards 拉取的卡一览，用于 passes 展示（替代固定 CCSA/infra/CashTrees 列表） */
	const [latestCardsItems, setLatestCardsItems] = useState<Array<{ cardAddress: string }>>([])
	/** 每张资产卡的 assets + metadata，key = cardAddress 小写。含 latestCards 及 CCSA（主卡展示用） */
	const [assetCardDetails, setAssetCardDetails] = useState<Record<string, { assets: { points: string; nfts: Array<{ tokenId: string; tier?: string }> } | null; metadata: { name?: string; image?: string; tiers?: CardTierMetadata[]; cardOwner?: string } | null; cardOwner?: string | null; nftMetadata?: NftTierMetadata | null; cardCurrency?: ICurrency }>>({})
	/** 以下由 assetCardDetails 派生，供 cards/passes/isCardCreator 等兼容 */
	const ccsaBalance = assetCardDetails[CCSA_Card_Address]?.assets?.points ?? '0'
	const ccsaAssets = useMemo(() => assetCardDetails[CCSA_Card_Address]?.assets ? { points: assetCardDetails[CCSA_Card_Address]!.assets!.points, nfts: assetCardDetails[CCSA_Card_Address]!.assets!.nfts ?? [] } : null, [assetCardDetails])
	const ccsaCardOwner = assetCardDetails[CCSA_Card_Address]?.cardOwner ?? null
	const cashTreesBalance = assetCardDetails[CASH_TREES_CARD_ADDRESS]?.assets?.points ?? '0'
	const cashTreesAssets = useMemo(() => assetCardDetails[CASH_TREES_CARD_ADDRESS]?.assets ? { points: assetCardDetails[CASH_TREES_CARD_ADDRESS]!.assets!.points, nfts: assetCardDetails[CASH_TREES_CARD_ADDRESS]!.assets!.nfts ?? [] } : null, [assetCardDetails])
	const cashTreesMetadata = useMemo(() => assetCardDetails[CASH_TREES_CARD_ADDRESS]?.metadata ? { ...assetCardDetails[CASH_TREES_CARD_ADDRESS]!.metadata!, nftMetadata: assetCardDetails[CASH_TREES_CARD_ADDRESS]?.nftMetadata } : null, [assetCardDetails])
	/** 基础设施卡 BEAMIO_USER_CARD：ERC-1155 tokenId 0（POINTS）余额与链上 currency()，供 Universal Pass Total Balance */
	const universalPassInfraDetail = assetCardDetails[BEAMIO_USER_CARD_ASSET_ADDRESS.toLowerCase()]
	const universalPassPointsBalance = universalPassInfraDetail?.assets?.points ?? '0'
	const universalPassCardCurrency: ICurrency = universalPassInfraDetail?.cardCurrency ?? 'USDC'
	const [eoaReflash, setEoaReflash] = useState(false)
	const [aaReflash, setAaReflash] = useState(false)
	const [ccsaReflash, setCcsaReflash] = useState(false)
	const [addressCopied, setAddressCopied] = useState<'eoa' | 'aa' | 'ccsa' | null>(null)
	const [copiedCardAddress, setCopiedCardAddress] = useState<string | null>(null)
	const [eoaPanelOpen, setEoaPanelOpen] = useState<'' | '支付' | 'BankingBridge' | 'ShowPayQR' | 'PaymentLink'>('')
	/** Add Cash 后：父容器内显示 BeamioAddUSDCFlow 的 Coinbase 确认画面（204-221） */
	const [eoaAddUsdcOpen, setEoaAddUsdcOpen] = useState(false)
	/** CashTrees Add Cash 全屏底栏（对齐 renderAction Wallet Add Cash） */
	type AddCashSheetMode = 'methods' | 'store_qr' | 'coinbase' | 'convert'
	const [showAddCashModal, setShowAddCashModal] = useState(false)
	const [addCashMode, setAddCashMode] = useState<AddCashSheetMode>('methods')
	const [addAmount, setAddAmount] = useState('')
	const [aaPanelOpen, setAaPanelOpen] = useState<'' | '支付' | 'BeamioPayMeQR'>('')
	const [ccsaCreateCardOpen, setCcsaCreateCardOpen] = useState(false)
	const [topUpRedeemOpen, setTopUpRedeemOpen] = useState(false)
	const [topUpRedeemKey, setTopUpRedeemKey] = useState(0)
	const [addAdminOpen, setAddAdminOpen] = useState(false)
	const [addAdminKey, setAddAdminKey] = useState(0)
	/** Holder topup: when user is holder (not issuer), Reload opens this sheet with selected card */
	const [holderTopupOpen, setHolderTopupOpen] = useState(false)
	const [holderTopupCardAddress, setHolderTopupCardAddress] = useState<string | null>(null)
	/** Holder 卡在列表中展开的 pass id（非发行方点击后原地展开，不滑出面板） */
	const [expandedPassId, setExpandedPassId] = useState<string | null>(null)
	const [showRedeemListOpen, setShowRedeemListOpen] = useState(false)
	const [showNewNftForm, setShowNewNftForm] = useState(false)
	const [newNftTitle, setNewNftTitle] = useState('')
	const [newNftValidAfter, setNewNftValidAfter] = useState('') // datetime-local string or empty
	const [newNftValidBefore, setNewNftValidBefore] = useState('') // datetime-local or empty = no limit
	const [newNftMaxSupply, setNewNftMaxSupply] = useState('')
	const [newNftPriceE6, setNewNftPriceE6] = useState('') // e.g. 10 = 10 USDC
	const [newNftDescription, setNewNftDescription] = useState('')
	const [newNftImageUrl, setNewNftImageUrl] = useState('') // IPFS/fragment link after upload
	const [newNftBackgroundColor, setNewNftBackgroundColor] = useState('') // e.g. #6366f1
	const [newNftImageUploading, setNewNftImageUploading] = useState(false)
	const [newNftSubmitting, setNewNftSubmitting] = useState(false)
	const [newNftError, setNewNftError] = useState('')
	const newNftImageInputRef = useRef<HTMLInputElement>(null)
	const [cardRedeemsVersion, setCardRedeemsVersion] = useState(0)
	/** Redeem 列表用 state 同步，创建成功后由 TopUpRedeemForm 回传，避免依赖 CoNET_Data 的渲染时序 */
	const [cardRedeemsBatches, setCardRedeemsBatches] = useState<CardRedeemBatch[]>([])
	/** onSuccess 回传的列表优先于 effect 从 CoNET_Data 读取，避免新建 redeem 被旧数据覆盖 */
	const pendingRedeemsFromSuccessRef = useRef<CardRedeemBatch[] | null>(null)
	const [nfcCheckBalanceOpen, setNfcCheckBalanceOpen] = useState(false)
	const [ccsaRedeemOpen, setCcsaRedeemOpen] = useState(false)
	const [redeemCodeInput, setRedeemCodeInput] = useState('')
	const [redeemCardNumberInput, setRedeemCardNumberInput] = useState('')
	const [redeemLoading, setRedeemLoading] = useState(false)
	const [redeemError, setRedeemError] = useState<string | null>(null)
	const [redeemSuccessTx, setRedeemSuccessTx] = useState<string | null>(null)
	const [redeemDetails, setRedeemDetails] = useState<RedeemDetailsForDisplay | null>(null)
	const [redeemDetailsLoading, setRedeemDetailsLoading] = useState(false)
	const [redeemDetailsRetryKey, setRedeemDetailsRetryKey] = useState(0)
	/** Redeem Asset 卡面：从 card metadata 拉取的 image、background 等 */
	const [redeemCardMetadata, setRedeemCardMetadata] = useState<CardMetadataFromUri | null>(null)
	/** Redeem Asset 卡面：根据 redeem 金额解析出的 tier metadata（有 tiers 时用该 tier 的 image/backgroundColor/name 渲染） */
	const [redeemCardTierMeta, setRedeemCardTierMeta] = useState<CardTierMetadata | null>(null)
	const [userCards, setUserCards] = useState<UserCardInfo[]>([])
	/** 每张 userCard 的资产 + metadata（redeem/topup 获得的 NFT 及该卡自己的 tier metadata），key = cardAddress 小写 */
	const [userCardDetails, setUserCardDetails] = useState<Record<string, { assets: { points: string; nfts: Array<{ tokenId: string; tier?: string }> } | null; metadata: { name?: string; image?: string; tiers?: CardTierMetadata[]; cardOwner?: string } | null; nftMetadata?: NftTierMetadata | null }>>({})
	const [payScreenMode, setPayScreenMode] = useState<'eoa-pay' | 'aa-eoa-transfer'>('eoa-pay')
	const [isManagingCards, setIsManagingCards] = useState(false)
	/** 已隐藏（archived）的 pass id 列表，用于 ManageCardsOverlay */
	const [archivedPassIds, setArchivedPassIds] = useState<Set<string>>(new Set())
	/** pass 昵称，id -> nickname */
	const [passNicknames, setPassNicknames] = useState<Record<string, string>>({})
	/** 从 historyPayData 进入时暂存，传入 PayScreen 后清除 historyPayData */
	const [pendingPayTarget, setPendingPayTarget] = useState<searchResult | null>(null)
	const [openRelayPayload, setOpenRelayPayload] = useState<OpenContainerRelayPayload | null>(null)
	const [aaRelayQROpen, setAaRelayQROpen] = useState(false)
	const [aaRelayQRPayload, setAaRelayQRPayload] = useState<OpenContainerRelayPayload | null>(null)
	const [aaRelaySigning, setAaRelaySigning] = useState(false)
	const [showTenKeySlide, setShowTenKeySlide] = useState(false)
	/** PayScreen 重定向时传入的 payload，确保 TenKeyInput 能拿到金额（避免 context 时序问题） */
	const [pendingSmartRoutingPayload, setPendingSmartRoutingPayload] = useState<{ paymentUrl: string; amount: string; currency: string; toAddress: string } | null>(null)
	const [payMeSigning, setPayMeSigning] = useState(false)
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(!activeView)
	const { readUid: readNfcUid } = useNfcRead()
	const copyAddressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const copiedCardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const refreshAAAssetsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const eoaHistoryFetchSeqRef = useRef(0)

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

	/** Universal Pass 副行：USDC→CAD 或已为 CAD 时同值；其他币种不显示 */
	const universalPassApproxCad = useMemo(() => {
		const n = Number(universalPassPointsBalance || 0)
		if (!isFinite(n)) return 0
		if (universalPassCardCurrency === 'USDC') {
			const rate = fxRateUSDCToCurrency('CAD')
			return isFinite(rate) ? n * rate : 0
		}
		if (universalPassCardCurrency === 'CAD') return n
		return 0
	}, [universalPassPointsBalance, universalPassCardCurrency, fxRateUSDCToCurrency])

	// 进入时检查 historyPayData：若有 searchResult 则打开 PayScreen 并传入
	useEffect(() => {
		if (historyPayData) {
			setPendingPayTarget(historyPayData)
			setHistoryPayData(null)
			setEoaPanelOpen('支付')
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

	// 拉取 redeem 详情：当面板打开且有 code 时。
	const NEW_CCSA = BASE_MAINNET_FACTORIES.BeamioCardCCSA_ADDRESS
	/** 是否为 CCSA 卡（仅 CCSA，不含基础设施 BeamioUserCard；用于 Redeem Asset 面板展示 CCSA 风格 vs 通用 BeamioUserCard 风格） */
	const isCcsaCard = (addr: string) => {
		const a = (addr || '').trim().toLowerCase()
		if (!a) return true // 空时默认用 CCSA
		return a === NEW_CCSA.toLowerCase() || a === CCSA_Card_Address.toLowerCase()
	}
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
		const code = redeemCodeInput.trim()
		;(async () => {
			const d = await getRedeemDetailsForDisplay(cardAddr, code)
			if (!cancelled) {
				setRedeemDetails(d ?? null)
			}
		})().finally(() => {
			if (!cancelled) setRedeemDetailsLoading(false)
		})
		return () => { cancelled = true }
	}, [ccsaRedeemOpen, redeemCodeInput, redeemCardNumberInput, redeemDetailsRetryKey])

	// Redeem Asset：拉取卡级 1155 JSON，用 JSON 的 tiers metadata 根据 redeem 金额确定 tier，用该 tier 的 metadata（含 background_color）渲染卡面
	useEffect(() => {
		if (!redeemDetails || isCcsaCard(redeemCardNumberInput)) {
			setRedeemCardMetadata(null)
			setRedeemCardTierMeta(null)
			return
		}
		const addr = redeemCardNumberInput.trim()
		if (!addr || !ethers.isAddress(addr)) {
			setRedeemCardMetadata(null)
			setRedeemCardTierMeta(null)
			return
		}
		let cancelled = false
		getCardMetadataFrom1155Json(addr)
			.then((m) => m ?? getCardMetadataFromApi(addr))
			.then((m) => m ?? getCardMetadataFromUri(addr))
			.then((meta) => {
				if (cancelled) return
				setRedeemCardMetadata(meta)
				if (meta?.tiers && meta.tiers.length > 0) {
					const tiersWithMin = meta.tiers.filter((t) => t.minUsdc6 != null && String(t.minUsdc6).trim() !== '')
					const tierIdx = tiersWithMin.length > 0
						? getTierIndexForRedeemAmount(tiersWithMin as { minUsdc6: string }[], redeemDetails.points6)
						: 0
					const tierMeta = tiersWithMin.length > 0 ? (tiersWithMin[tierIdx] ?? tiersWithMin[0]) : meta.tiers[0]
					setRedeemCardTierMeta(tierMeta ?? null)
				} else {
					setRedeemCardTierMeta(null)
				}
			})
			.catch(() => {
				if (!cancelled) {
					setRedeemCardMetadata(null)
					setRedeemCardTierMeta(null)
				}
			})
		return () => { cancelled = true }
	}, [redeemDetails, redeemCardNumberInput])

	// 从 detail 内操作返回时恢复全局 footer（所有 detail 按钮操作的共同规则）
	const closeEoaPanel = useCallback(() => {
		setShowFooter(true)
		setEoaPanelOpen('')
		setEoaAddUsdcOpen(false)
		setPendingPayTarget(null)
	}, [setShowFooter])

	const closeAddCashModal = useCallback(() => {
		setShowAddCashModal(false)
		setAddCashMode('methods')
		setAddAmount('')
		setShowFooter(true)
	}, [setShowFooter])

	const openAddCashModal = useCallback(() => {
		setAddAmount('')
		setAddCashMode('methods')
		setShowAddCashModal(true)
		setShowFooter(false)
	}, [setShowFooter])

	const storeDepositQrValue = useMemo(() => {
		const tag = beamio?.accountName?.trim()
		if (tag) return `https://beamio.app?beamio=${encodeURIComponent(tag)}`
		if (myAddress && ethers.isAddress(myAddress)) return ethers.getAddress(myAddress)
		return 'https://beamio.app'
	}, [beamio?.accountName, myAddress])

	const addCashCadRate = useMemo(() => fxRateUSDCToCurrency('CAD'), [fxRateUSDCToCurrency])
	const addCashCadPreview = useMemo(() => {
		const v = parseFloat(addAmount)
		if (!Number.isFinite(v) || !Number.isFinite(addCashCadRate)) return '0.00'
		return (v * addCashCadRate).toFixed(2)
	}, [addAmount, addCashCadRate])

	const handleAddCashContinueCoinbase = useCallback(() => {
		setShowAddCashModal(false)
		setAddCashMode('methods')
		setAddAmount('')
		setEoaPanelOpen('BankingBridge')
		setEoaAddUsdcOpen(true)
		setShowFooter(false)
	}, [setShowFooter])

	const handleAddCashConfirmConvert = useCallback(() => {
		setShowAddCashModal(false)
		setAddCashMode('methods')
		setAddAmount('')
		setEoaPanelOpen('BankingBridge')
		setShowFooter(false)
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
					// trusted=true 视为有效链上/后端数据，回写本地缓存（historyUserCards + issuedCards）
					writeHistoryUserCardsCache(profile as profile, cards)
				}
			})
			.catch(() => {
				// 异常时使用 profile 缓存
				const cached = readHistoryUserCardsCache(profile as profile)
				setUserCards(cached)
			})
	}, [setProfiles])

	const closeCcsaCreateCard = useCallback(() => {
		setShowFooter(true)
		setCcsaCreateCardOpen(false)
		refetchUserCards()
	}, [setShowFooter, refetchUserCards])

	// 拉取 EOA 交易历史（与 MyWalletDashboard 一致，供 Active & Pending / History 展示）
	const loadEoaHistory = useCallback(async () => {
		const fetchSeq = ++eoaHistoryFetchSeqRef.current
		if (!profiles?.length) return
		const profile: profile = profiles[0]
		const address = profile.keyID
		if (!address || !ethers.isAddress(address)) {
			if (fetchSeq !== eoaHistoryFetchSeqRef.current) return
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
			if (fetchSeq !== eoaHistoryFetchSeqRef.current) return
			const merged = [...mappedPay, ...mappedLinks, ...mappedChecks].sort((a, b) => b.date - a.date)
			setAllItems((prev) => {
				if (prev.length === 0) return merged
				const buildKey = (tx: TransferHistork) => `${tx.mode}:${tx.hash || tx.redeemHash || ''}:${tx.type}:${tx.address || ''}`
				const prevKeys = new Set(prev.map(buildKey))
				const newOnchainRecords = merged.filter((tx) => !prevKeys.has(buildKey(tx)))
				// 链上历史默认不可变：没有新记录时保持旧引用，避免列表抖动
				if (newOnchainRecords.length === 0) return prev
				const mergedMap = new Map<string, TransferHistork>()
				for (const tx of prev) mergedMap.set(buildKey(tx), tx)
				for (const tx of newOnchainRecords) mergedMap.set(buildKey(tx), tx)
				return Array.from(mergedMap.values()).sort((a, b) => b.date - a.date)
			})
		} finally {
			if (fetchSeq === eoaHistoryFetchSeqRef.current) {
				setLoading(false)
			}
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

	// 初始化：只恢复本地 EOA 快照；余额 RPC 统一由 DaemonProvider 喂料。
	useEffect(() => {
		if (!profiles?.length) return
		const profile = profiles[0]
		const keyID = profile?.keyID ?? ''
		if (!keyID) return
		if (!myAddress) setMyAddress(keyID)
		const cachedBalance = readHistoryBalanceCache(keyID)
		if (cachedBalance) {
			setUsdcbalance(cachedBalance.usdcbalance)
			if (typeof cachedBalance.usdcToUSD === 'number') setUsdcToUSD(cachedBalance.usdcToUSD)
		}
	}, [profiles?.[0]?.keyID, myAddress, setMyAddress, setUsdcbalance, setUsdcToUSD])

	// 1. 拉取 api/latestCards 作为需展示的卡一览（替代固定 CCSA/infra/CashTrees 列表）
	useEffect(() => {
		void loadApiExcludedUserCards()
		fetch(`${beamioApi}/api/latestCards?limit=100`)
			.then((r) => (r.ok ? r.json() : { items: [] }))
			.then((data: { items?: Array<{ cardAddress?: string }> }) => {
				const items = (Array.isArray(data?.items) ? data.items : [])
					.map((it) => {
						const raw = String(it?.cardAddress ?? '').trim()
						return raw && ethers.isAddress(raw) ? { cardAddress: ethers.getAddress(raw) } : null
					})
					.filter((x): x is { cardAddress: string } => x != null)
					.filter((x) => !isCardExcludedFromDisplay(x.cardAddress))
				setLatestCardsItems(items)
			})
			.catch(() => setLatestCardsItems([]))
	}, [])

	// 2. 对 latestCards + CCSA（主卡展示）拉取 getMyAssets、metadata、getCardOwner，写入 assetCardDetails
	useEffect(() => {
		if (!profiles?.[0]) return
		const profile = profiles[0]
		const addrs = new Set<string>([
			...latestCardsItems.map((i) => i.cardAddress.toLowerCase()),
		])
		if (!isCardExcludedFromDisplay(CCSA_Card_Address)) {
			addrs.add(CCSA_Card_Address.toLowerCase())
		}
		if (!isCardExcludedFromDisplay(CASH_TREES_CARD_ADDRESS)) {
			addrs.add(CASH_TREES_CARD_ADDRESS.toLowerCase())
		}
		if (!isCardExcludedFromDisplay(BEAMIO_USER_CARD_ASSET_ADDRESS)) {
			addrs.add(BEAMIO_USER_CARD_ASSET_ADDRESS.toLowerCase())
		}
		const toFetch = Array.from(addrs).filter((a) => a && ethers.isAddress(a) && !isCardExcludedFromDisplay(a))
		if (toFetch.length === 0) return
		const id = setTimeout(() => {
			Promise.all(
				toFetch.map(async (cardAddr) => {
					try {
						const [assets, meta, cardOwner] = await Promise.all([
							getMyAssets(profile, cardAddr),
							getCardMetadataFromApi(cardAddr).then((m) => m ?? getCardMetadataFromUri(cardAddr)),
							getCardOwner(cardAddr),
						])
						const nfts = (assets?.nfts ?? []).filter((n) => Number(n.tokenId) > 0) as { tokenId: string; tier?: string }[]
						const bestNft = nfts.length > 0 ? nfts.reduce((a, b) => (Number(b.tokenId) > Number(a.tokenId) ? b : a)) : undefined
						let nftMetadata: NftTierMetadata | null = null
						if (meta?.cardOwner && bestNft) {
							nftMetadata = await getNftMetadataFromApi(cardAddr, bestNft.tokenId)
						}
						return {
							addr: cardAddr.toLowerCase(),
							detail: {
								assets: assets ? { points: assets.points, nfts: assets.nfts ?? [] } : null,
								metadata: meta ?? null,
								cardOwner: cardOwner ?? null,
								nftMetadata: nftMetadata ?? undefined,
								cardCurrency: assets?.cardCurrency,
							},
						}
					} catch {
						return { addr: cardAddr.toLowerCase(), detail: { assets: null, metadata: null, cardOwner: null } }
					}
				})
			).then((results) => {
				const next: Record<string, { assets: { points: string; nfts: Array<{ tokenId: string; tier?: string }> } | null; metadata: { name?: string; image?: string; tiers?: CardTierMetadata[]; cardOwner?: string } | null; cardOwner?: string | null; nftMetadata?: NftTierMetadata | null; cardCurrency?: ICurrency }> = {}
				results.forEach(({ addr, detail }) => {
					if (isCardExcludedFromDisplay(addr)) return
					next[addr] = detail
				})
				setAssetCardDetails((prev) => filterExcludedCardDetailKeys({ ...prev, ...next }))
			})
			.catch(() => setAssetCardDetails({}))
		}, 150)
		return () => clearTimeout(id)
	}, [profiles, latestCardsItems])

	// ref 稳定 identity，避免 refetchUserCards 触发 effect 重跑导致 RPC 循环
	const refetchUserCardsRef = useRef(refetchUserCards)
	refetchUserCardsRef.current = refetchUserCards
	// 进入 /history 先读本地卡片缓存，避免首屏空白；随后后台刷新有效数据
	useEffect(() => {
		const p = profilesRef.current?.[0]
		if (!p) return
		const cached = readHistoryUserCardsCache(p as profile)
		if (cached.length > 0) {
			setUserCards(cached)
		}
		const id = requestAnimationFrame(() => {
			refetchUserCardsRef.current()
		})
		return () => cancelAnimationFrame(id)
	}, [profiles?.[0]?.keyID, profiles?.[0]?.aaAccount])
	// 进入任意「卡」视图（CCSA、基础设施卡、用户卡）时拉取 userCards，以便 isCardViewWithRedeemList 能匹配用户卡并显示 Redeem 列表
	useEffect(() => {
		if (!activeView || activeView === 'eoa' || activeView === 'aa') return
		refetchUserCardsRef.current()
	}, [activeView])
	// 有 Express Pay（AA）时拉取 userCards，供 Passes 与 Redeem 列表使用
	useEffect(() => {
		const p = profilesRef.current?.[0]
		if (!p?.aaAccount) return
		refetchUserCardsRef.current()
	}, [profiles?.[0]?.aaAccount])

	// 从 CoNET_Data 同步 redeem 列表：version 变化时（创建/关闭表单后）；有 AA 时生效
	useEffect(() => {
		if (!profilesRef.current?.[0]?.aaAccount) return
		const fromSuccess = pendingRedeemsFromSuccessRef.current
		if (fromSuccess && fromSuccess.length > 0) {
			setCardRedeemsBatches(fromSuccess)
		} else {
			setCardRedeemsBatches(((CoNET_Data as any)?.cardRedeems ?? []) as CardRedeemBatch[])
		}
	}, [cardRedeemsVersion, profiles?.[0]?.aaAccount])

	// 挂载时清空 pending ref，确保首次加载从 CoNET_Data 读取
	useEffect(() => {
		pendingRedeemsFromSuccessRef.current = null
	}, [])

	// 每张 userCard 拉取该卡的 assets（NFT）+ metadata（tiers），用于 Passes 显示该卡自己的 NFT 与 tier
	useEffect(() => {
		if (!profiles?.[0]) return
		if (userCards.length === 0) {
			setUserCardDetails({})
			return
		}
		const profile = profiles[0]
		const run = async () => {
			const next: Record<string, { assets: { points: string; nfts: Array<{ tokenId: string; tier?: string }> } | null; metadata: { name?: string; image?: string; tiers?: CardTierMetadata[]; cardOwner?: string } | null; nftMetadata?: NftTierMetadata | null }> = {}
			await Promise.all(
				userCards.map(async (uc) => {
					const addr = uc.cardAddress.toLowerCase()
					try {
						const [assets, meta] = await Promise.all([
							getMyAssets(profile, uc.cardAddress),
							getCardMetadataFromApi(uc.cardAddress).then((m) => m ?? getCardMetadataFromUri(uc.cardAddress)),
						])
						const nfts = assets?.nfts?.filter((n) => Number(n.tokenId) > 0) ?? []
						const bestNft = nfts.length > 0 ? nfts.reduce((a, b) => (Number(b.tokenId) > Number(a.tokenId) ? b : a)) : undefined
						let nftMetadata: NftTierMetadata | null = null
						if (uc.cardAddress && bestNft) {
							nftMetadata = await getNftMetadataFromApi(uc.cardAddress, bestNft.tokenId)
						}
						next[addr] = {
							assets: assets ? { points: assets.points, nfts: assets.nfts ?? [] } : null,
							metadata: meta ?? null,
							nftMetadata: nftMetadata ?? null,
						}
					} catch {
						next[addr] = { assets: null, metadata: null, nftMetadata: null }
					}
				})
			)
			setUserCardDetails(next)
		}
		run()
	}, [profiles?.[0], userCards])

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
			await refreshRecentActivityNoAa()
			await loadEoaHistory()
			refetchUserCards()
		} finally {
			if (source === 'eoa') setEoaReflash(false)
			else setAaReflash(false)
		}
	}, [eoaReflash, aaReflash, profiles, refreshRecentActivityNoAa, loadEoaHistory, refetchUserCards])

	// 刷新资产卡：先拉取 latestCards，再刷新 assetCardDetails（含 CCSA）
	const refreshCcsaAssets = useCallback(async () => {
		if (ccsaReflash) return
		const profile = profiles?.[0]
		if (!profile) return
		setCcsaReflash(true)
		try {
			const res = await fetch(`${beamioApi}/api/latestCards?limit=100`)
			const data = (res.ok ? await res.json() : { items: [] }) as { items?: Array<{ cardAddress?: string }> }
			const items = (Array.isArray(data?.items) ? data.items : [])
				.map((it) => {
					const raw = String(it?.cardAddress ?? '').trim()
					return raw && ethers.isAddress(raw) ? { cardAddress: ethers.getAddress(raw) } : null
				})
				.filter((x): x is { cardAddress: string } => x != null)
			setLatestCardsItems(items)
			const addrs = new Set<string>([
				CCSA_Card_Address.toLowerCase(),
				CASH_TREES_CARD_ADDRESS.toLowerCase(),
				BEAMIO_USER_CARD_ASSET_ADDRESS.toLowerCase(),
				...items.map((i) => i.cardAddress.toLowerCase()),
			])
			const toFetch = Array.from(addrs).filter((a) => a && ethers.isAddress(a))
			const results = await Promise.all(
				toFetch.map(async (cardAddr) => {
					try {
						const [assets, meta, cardOwner] = await Promise.all([
							getMyAssets(profile, cardAddr),
							getCardMetadataFromApi(cardAddr).then((m) => m ?? getCardMetadataFromUri(cardAddr)),
							getCardOwner(cardAddr),
						])
						const nfts = (assets?.nfts ?? []).filter((n) => Number(n.tokenId) > 0) as { tokenId: string; tier?: string }[]
						const bestNft = nfts.length > 0 ? nfts.reduce((a, b) => (Number(b.tokenId) > Number(a.tokenId) ? b : a)) : undefined
						let nftMetadata: NftTierMetadata | null = null
						if (meta?.cardOwner && bestNft) nftMetadata = await getNftMetadataFromApi(cardAddr, bestNft.tokenId)
						return {
							addr: cardAddr.toLowerCase(),
							detail: {
								assets: assets ? { points: assets.points, nfts: assets.nfts ?? [] } : null,
								metadata: meta ?? null,
								cardOwner: cardOwner ?? null,
								nftMetadata: nftMetadata ?? undefined,
								cardCurrency: assets?.cardCurrency,
							},
						}
					} catch {
						return { addr: cardAddr.toLowerCase(), detail: { assets: null, metadata: null, cardOwner: null } }
					}
				})
			)
			const next: Record<string, { assets: { points: string; nfts: Array<{ tokenId: string; tier?: string }> } | null; metadata: { name?: string; image?: string; tiers?: CardTierMetadata[]; cardOwner?: string } | null; cardOwner?: string | null; nftMetadata?: NftTierMetadata | null; cardCurrency?: ICurrency }> = {}
			results.forEach(({ addr, detail }) => { next[addr] = detail })
			setAssetCardDetails(next)
		} catch (e) {
			console.error('Failed to refresh asset cards:', e)
			setAssetCardDetails({})
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

	/** AA 卡片：生成 Open Relay 签名并显示 QR，供商家 3 分钟内扣款 */
	const handleAaRelayQR = useCallback(async () => {
		const profile = profiles?.[0]
		if (!profile?.privateKeyArmor || !profile?.aaAccount || aaRelaySigning) return
		setAaRelaySigning(true)
		setAaRelayQRPayload(null)
		try {
			
			const payload = await signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen(
				{ privateKeyArmor: profile.privateKeyArmor, aaAccount: profile.aaAccount },
				'0',
				{ deadlineSeconds: 300 }
			)
			setAaRelayQRPayload(payload)
			setShowFooter(false)
			setAaRelayQROpen(true)
		} catch (e) {
			console.error('signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen failed:', e)
		} finally {
			setAaRelaySigning(false)
		}
	}, [profiles, aaAccountUsdcBalance, aaRelaySigning])

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
			name: 'Base 上的 USDC',
			balance: String(usdcbalance ?? 0),
			balanceFiat: balanceFiat,
			address: myAddress || '',
			gradient: 'bg-gradient-to-br from-[#1b6dff] via-[#6d3dff] to-[#f54b8b]',
			badge: '',
			badgeIcon: null,
		},
		{
			id: 'aa',
			name: tu('express_pay'),
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
			name: 'CCSA 卡',
			balance: ccsaBalance,
			balanceFiat: ccsaBalanceFiat,
			address: profiles?.[0]?.aaAccount || '',
			gradient: 'bg-gradient-to-br from-amber-600 via-yellow-500 to-orange-500',
			badge: 'Membership',
			badgeIcon: <Globe size={10} className="text-white" />,
			isCCSA: true,
		},
	]

	/** 判断当前用户是否为某卡的创建者/owner（链上 card.owner()），仅创建者可打开 DETAILS；eoa/aa 无「卡」概念，按原逻辑 */
	const isCardCreator = useCallback(
		(cardId: string) => {
			if (!cardId) return false
			if (cardId === 'eoa') return true
			if (cardId === 'aa') return !!profiles?.[0]?.aaAccount
			const eoa = profiles?.[0]?.keyID
			const aa = profiles?.[0]?.aaAccount
			const userAddrs = [eoa, aa].filter(Boolean).map((a) => ethers.getAddress(a).toLowerCase())
			if (cardId === 'ccsa') {
				if (!ccsaCardOwner) return false
				return userAddrs.includes(ethers.getAddress(ccsaCardOwner).toLowerCase())
			}
			// latestCards 资产卡或固定卡：从 assetCardDetails 取 cardOwner
			const assetOwner = assetCardDetails[cardId.toLowerCase()]?.cardOwner
			if (assetOwner) return userAddrs.includes(ethers.getAddress(assetOwner).toLowerCase())
			// 用户创建的卡：优先用 metadata.cardOwner，无则用「在 userCards 中」
			const owner = userCardDetails[cardId.toLowerCase()]?.metadata?.cardOwner
			if (owner) return userAddrs.includes(ethers.getAddress(owner).toLowerCase())
			return userCards.some((c) => c.cardAddress.toLowerCase() === cardId.toLowerCase())
		},
		[profiles, ccsaCardOwner, assetCardDetails, userCardDetails, userCards]
	)

	/** 判断某 cardId 是否为当前用户所拥有（用于点击时是否允许打开 DETAILS）：CCSA 仅创建者；其余卡若持有 NFT/points 或为创建者则可点击 */
	const isOwnerOfCard = useCallback(
		(cardId: string) => {
			if (cardId === 'ccsa') return isCardCreator('ccsa')
			const details = assetCardDetails[cardId.toLowerCase()]
			if (details) {
				const nfts = (details.assets?.nfts ?? []).filter((n) => Number(n.tokenId) > 0)
				const hasPoints = Number(details.assets?.points ?? 0) > 0
				return nfts.length > 0 || hasPoints || isCardCreator(cardId)
			}
			return userCards.some((c) => c.cardAddress.toLowerCase() === cardId.toLowerCase())
		},
		[isCardCreator, assetCardDetails, userCards]
	)

	/** CCSA 专属：当前用户是否为 CCSA 卡的创建者/owner（链上 card.owner()）。用于面板显示与清除 */
	const isCcsaOwnerStrict = useMemo(
		() => {
			if (!ccsaCardOwner) return false
			const eoa = profiles?.[0]?.keyID
			const aa = profiles?.[0]?.aaAccount
			const userAddrs = [eoa, aa].filter(Boolean).map((a) => ethers.getAddress(a).toLowerCase())
			return userAddrs.includes(ethers.getAddress(ccsaCardOwner).toLowerCase())
		},
		[ccsaCardOwner, profiles?.[0]?.keyID, profiles?.[0]?.aaAccount]
	)

	const handleCardClick = (cardId: string) => {
		if (!isOwnerOfCard(cardId)) return
		// CCSA 二次校验：仅创建者才允许打开
		if (cardId === 'ccsa' && !isCcsaOwnerStrict) return
		// 持有者（非发行方）：原地展开卡片，不滑出面板；CashTrees 与 infra 持有者同样走展开逻辑
		if (cardId !== 'eoa' && cardId !== 'aa' && cardId !== 'ccsa' && !isCardCreator(cardId)) {
			setExpandedPassId((prev) => (prev === cardId ? null : cardId))
			setActiveView(null)
			return
		}
		setActiveView(activeView === cardId ? null : cardId)
		setExpandedPassId(null)
	}

	// 打开 DETAILS PANEL 时隐藏 footer，关闭时恢复（避免 panel z-80 盖住 footer）
	useEffect(() => {
		setShowFooter(!activeView)
	}, [activeView, setShowFooter])

	/** 仅当用户是该卡的创建者/owner 时才允许显示 DETAILS 面板（按 card.owner() 判断，非持有 NFT） */
	const isOwnerOfSelectedCard = useMemo(() => isCardCreator(activeView ?? ''), [activeView, isCardCreator])

	/** 是否允许显示 DETAILS 面板：eoa/aa 或发行方卡显示；持有者卡不显示（改为原地展开） */
	const showDetailsPanel = !!activeView && (activeView === 'eoa' || activeView === 'aa' || isCardCreator(activeView))

	// 若当前选中的卡用户既非创建者也非持有者，则关闭 DETAILS
	useEffect(() => {
		if (!activeView) return
		if (!showDetailsPanel) setActiveView(null)
	}, [activeView, showDetailsPanel])

	/** 根据背景色（#hex）返回合适文字颜色：深色背景用白字，浅色用黑字 */
	const textColorForBackground = (hexOrCss: string | undefined): 'white' | 'black' => {
		if (!hexOrCss || typeof hexOrCss !== 'string') return 'white'
		const s = hexOrCss.trim()
		let r = 0, g = 0, b = 0
		if (/^#[0-9A-Fa-f]{6}$/.test(s)) {
			r = parseInt(s.slice(1, 3), 16)
			g = parseInt(s.slice(3, 5), 16)
			b = parseInt(s.slice(5, 7), 16)
		} else if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
			r = parseInt(s[1] + s[1], 16)
			g = parseInt(s[2] + s[2], 16)
			b = parseInt(s[3] + s[3], 16)
		} else return 'white'
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
		return luminance < 0.5 ? 'white' : 'black'
	}

	const normalizeMetadataBackground = (raw?: string): string | undefined => {
		if (!raw || typeof raw !== 'string') return undefined
		const s = raw.trim()
		if (!s) return undefined
		return s.startsWith('#') ? s : `#${s.replace(/^#/, '')}`
	}

	const historyUserCardTiles = useMemo(() => {
		// 持有者卡（非发行方）且在 filter list 中则不显示（本地缓存可能含旧数据）
		const filtered = userCards.filter(
			(card) => isCardCreator(card.cardAddress) || !isCardExcludedFromDisplay(card.cardAddress)
		)
		return filtered.map((card) => {
			const addr = card.cardAddress.toLowerCase()
			const details = userCardDetails[addr]
			const nfts = (details?.assets?.nfts ?? []).filter((n) => Number(n.tokenId) > 0) as { tokenId: string; tier?: string }[]
			const bestNft = nfts.length > 0 ? nfts.reduce((a, b) => (Number(b.tokenId) > Number(a.tokenId) ? b : a)) : undefined
			const rawTier = bestNft?.tier
			const tierIdx = rawTier != null && rawTier !== 'Default/Max' ? Number(rawTier) : null
			const tiers = details?.metadata?.tiers
			const tierMeta =
				tierIdx != null && Number.isInteger(tierIdx) && tiers?.length
					? tiers.find((t) => t.index === tierIdx) ?? tiers[tierIdx]
					: undefined
			const nftMeta = details?.nftMetadata
			const tierFallback = tierIdx != null ? `Tier ${tierIdx + 1}` : rawTier === 'Default/Max' ? 'Default' : 'No Tier NFT'
			const tierName = nftMeta?.name ?? tierMeta?.name ?? tierFallback
			const tierDescription = nftMeta?.description ?? tierMeta?.description ?? ''
			const image = nftMeta?.image ?? tierMeta?.image ?? details?.metadata?.image
			const nftBg = normalizeMetadataBackground((nftMeta as any)?.backgroundColor ?? (nftMeta as any)?.background_color)
			const tierBg = normalizeMetadataBackground((tierMeta as any)?.backgroundColor ?? (tierMeta as any)?.background_color)
			const bg = nftBg ?? tierBg ?? '#2C5535'
			const pointsTopRight = details?.assets?.points != null ? formatWithThousands(details.assets.points) : '0.00'
			return {
				cardAddress: card.cardAddress,
				name: details?.metadata?.name ?? card.name,
				tierName,
				tierDescription,
				image,
				bg,
				pointsTopRight,
				currency: card.currency,
			}
		})
	}, [userCards, userCardDetails, isCardCreator])

	/** 当前 DETAILS 对应卡地址（仅当 activeView 为卡时有效） */
	const cardAddressForDetails = activeView && activeView !== 'eoa' && activeView !== 'aa'
		? (activeView === 'ccsa' ? CCSA_Card_Address : activeView)
		: ''

	const IPFS_GET_FRAGMENT = 'https://ipfs.conet.network/api/getFragment?hash='
	const handleNewNftImagePick = useCallback<React.ChangeEventHandler<HTMLInputElement>>(async (e) => {
		const input = e.currentTarget
		const file = input.files?.[0]
		input.value = ''
		if (!file || !file.type.startsWith('image/')) return
		const profile = profiles?.[0]
		if (!profile?.privateKeyArmor) {
			setNewNftError('Please log in to upload image')
			return
		}
		setNewNftError('')
		setNewNftImageUploading(true)
		try {
			const dataUrl = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader()
				reader.onload = () => resolve(String(reader.result))
				reader.onerror = () => reject(reader.error)
				reader.readAsDataURL(file)
			})
			const hash = await postToIPFS(profile, dataUrl)
			if (hash) {
				setNewNftImageUrl(`${IPFS_GET_FRAGMENT}${hash}&t=${Date.now()}`)
			} else {
				setNewNftError('Image upload failed')
			}
		} catch (err: any) {
			setNewNftError(err?.message ?? 'Image upload failed')
		} finally {
			setNewNftImageUploading(false)
		}
	}, [profiles])

	const handleNewNftSubmit = useCallback(async () => {
		if (!cardAddressForDetails || !newNftTitle.trim()) {
			setNewNftError(tu('please_enter_a_title'))
			return
		}
		const maxSupply = parseInt(newNftMaxSupply, 10)
		if (!Number.isFinite(maxSupply) || maxSupply < 1) {
			setNewNftError('Max supply must be ≥ 1')
			return
		}
		const now = Math.floor(Date.now() / 1000)
		const validAfter = newNftValidAfter ? Math.floor(new Date(newNftValidAfter).getTime() / 1000) : 0
		const validBefore = newNftValidBefore ? Math.floor(new Date(newNftValidBefore).getTime() / 1000) : 0
		if (validBefore !== 0 && validBefore < validAfter) {
			setNewNftError('Valid until must be after valid from')
			return
		}
		const priceE6 = newNftPriceE6.trim() === '' ? 0 : Math.round(parseFloat(newNftPriceE6) * 1e6)
		if (newNftPriceE6.trim() !== '' && (!Number.isFinite(parseFloat(newNftPriceE6)) || priceE6 < 0)) {
			setNewNftError('Price must be a non-negative number')
			return
		}
		const profile = profiles?.[0]
		if (!profile?.privateKeyArmor) {
			setNewNftError('Please log in first')
			return
		}
		setNewNftSubmitting(true)
		setNewNftError('')
		try {
			const wallet = new ethers.Wallet(profile.privateKeyArmor)
			const cardOwner = await getCardOwner(cardAddressForDetails)
			if (ethers.getAddress(cardOwner) !== ethers.getAddress(wallet.address)) {
				setNewNftError('This card is owned by your AA account. New NFT requires the card owner (EOA) to sign.')
				setNewNftSubmitting(false)
				return
			}
			const deadline = now + 3600
			const nonce = ethers.hexlify(ethers.randomBytes(32))
			const data = encodeCreateIssuedNft(
				newNftTitle.trim(),
				validAfter,
				validBefore,
				maxSupply,
				priceE6,
				'0'
			)
			const ownerSignature = await signExecuteForOwner(
				profile.privateKeyArmor,
				cardAddressForDetails,
				data,
				deadline,
				nonce
			)
			const result = await postCardCreateIssuedNft({
				cardAddress: cardAddressForDetails,
				data,
				deadline,
				nonce,
				ownerSignature,
				description: newNftDescription.trim() || undefined,
				image: newNftImageUrl.trim() || undefined,
				background_color: newNftBackgroundColor.trim() || undefined,
			})
			if (result.success) {
				setShowNewNftForm(false)
				setNewNftTitle('')
				setNewNftValidAfter('')
				setNewNftValidBefore('')
				setNewNftMaxSupply('')
				setNewNftPriceE6('')
				setNewNftDescription('')
				setNewNftImageUrl('')
				setNewNftBackgroundColor('')
			} else {
				setNewNftError(result.error ?? 'Create NFT failed')
			}
		} catch (e: any) {
			setNewNftError(e?.message ?? String(e))
		} finally {
			setNewNftSubmitting(false)
		}
	}, [cardAddressForDetails, newNftTitle, newNftValidAfter, newNftValidBefore, newNftMaxSupply, newNftPriceE6, newNftDescription, newNftImageUrl, newNftBackgroundColor, profiles])

	// exampleExpress passes：从 api/latestCards 拉取的卡一览 + userCards；持有 NFT 或 points 时显示；按 id 去重
	const passes = useMemo(() => {
		const list: { id: string; name: string; balance: string; currency: string; type: string; memberNo: string; bg: string; textColor?: string; image?: string; tier?: string; tierName?: string; tierDescription?: string }[] = []
		const seenIds = new Set<string>()
		const addIfNew = (id: string, item: (typeof list)[0]) => {
			const key = id.toLowerCase()
			if (seenIds.has(key)) return
			seenIds.add(key)
			list.push(item)
		}
		if (profiles?.[0]?.aaAccount) {
			// CCSA 主卡：id 为 'ccsa' 以兼容 cards 与 isCardViewWithRedeemList
			const ccsaNfts = (ccsaAssets?.nfts ?? []).filter((n) => { const id = Number(n.tokenId); return Number.isInteger(id) && id > 0 })
			const showCcsa = ccsaNfts.length > 0 || isCardCreator('ccsa')
			if (showCcsa) {
				const nft = ccsaNfts.length > 0 ? ccsaNfts.reduce((a, b) => (Number(b.tokenId) > Number(a.tokenId) ? b : a)) : undefined
				addIfNew('ccsa', {
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
			// CashTrees (0x82ce)：API 过滤，单独拉取；持有 NFT 或 points 时显示
			const cashTreesNfts = (cashTreesAssets?.nfts ?? []).filter((n) => Number(n.tokenId) > 0) as { tokenId: string; tier?: string }[]
			const showCashTrees = cashTreesNfts.length > 0 || Number(cashTreesBalance) > 0 || isCardCreator(CASH_TREES_CARD_ADDRESS)
			if (showCashTrees) {
				const ctNft = cashTreesNfts.length > 0 ? cashTreesNfts.reduce((a, b) => (Number(b.tokenId) > Number(a.tokenId) ? b : a)) : undefined
				const rawTier = ctNft?.tier
				const tierIndex = rawTier != null && rawTier !== 'Default/Max' ? Number(rawTier) : null
				const tierMeta = tierIndex != null && Number.isInteger(tierIndex) && cashTreesMetadata?.tiers?.length
					? cashTreesMetadata.tiers.find((t) => t.index === tierIndex) ?? cashTreesMetadata.tiers[tierIndex]
					: undefined
				const ctNftMeta = cashTreesMetadata?.nftMetadata
				const ctTierName = ctNftMeta?.name ?? tierMeta?.name ?? (tierIndex != null ? `Tier ${tierIndex + 1}` : rawTier === 'Default/Max' ? 'Default' : undefined)
				const ctTierDesc = ctNftMeta?.description ?? tierMeta?.description
				const ctBgRaw = normalizeMetadataBackground((ctNftMeta as any)?.backgroundColor ?? (ctNftMeta as any)?.background_color)
					?? normalizeMetadataBackground((tierMeta as any)?.backgroundColor ?? (tierMeta as any)?.background_color)
				const ctBg = ctBgRaw ?? '#2C5535'
				const ctTextColor = ctBgRaw ? textColorForBackground(ctBgRaw) : 'white'
				addIfNew(CASH_TREES_CARD_ADDRESS, {
					id: CASH_TREES_CARD_ADDRESS,
					name: cashTreesMetadata?.name ?? 'CashTrees',
					balance: formatWithThousands(cashTreesBalance),
					currency: 'CAD',
					type: 'Stored Value',
					memberNo: ctNft ? `M-${String(ctNft.tokenId).padStart(6, '0')}` : CASH_TREES_CARD_ADDRESS.slice(0, 10) + '...',
					bg: ctBg,
					textColor: ctTextColor,
					image: ctNftMeta?.image ?? cashTreesMetadata?.image,
					tier: ctTierName,
					tierName: ctTierName,
					tierDescription: ctTierDesc,
				})
			}
			// 从 latestCards 拉取的资产卡：持有 NFT 或 points 时显示
			latestCardsItems.forEach((item) => {
				const addr = item.cardAddress.toLowerCase()
				if (isCardExcludedFromDisplay(addr)) return
				if (addr === CCSA_Card_Address.toLowerCase() || addr === CASH_TREES_CARD_ADDRESS.toLowerCase()) return // CCSA、CashTrees 已单独处理
				if (addr === BEAMIO_USER_CARD_ASSET_ADDRESS.toLowerCase()) return // 不在钱包展示基础设施合约卡
				const details = assetCardDetails[addr]
				const nfts = (details?.assets?.nfts ?? []).filter((n) => Number(n.tokenId) > 0) as { tokenId: string; tier?: string }[]
				const hasPoints = Number(details?.assets?.points ?? 0) > 0
				const show = nfts.length > 0 || hasPoints || isCardCreator(addr)
				if (!show) return
				const bestNft = nfts.length > 0 ? nfts.reduce((a, b) => (Number(b.tokenId) > Number(a.tokenId) ? b : a)) : undefined
				const meta = details?.metadata
				const rawTier = bestNft?.tier
				const tierIndex = rawTier != null && rawTier !== 'Default/Max' ? Number(rawTier) : null
				const tierMeta = tierIndex != null && Number.isInteger(tierIndex) && meta?.tiers?.length
					? meta.tiers.find((t) => t.index === tierIndex) ?? meta.tiers[tierIndex]
					: undefined
				const nftMeta = details?.nftMetadata
				const tierName = nftMeta?.name ?? tierMeta?.name ?? (tierIndex != null ? `Tier ${tierIndex + 1}` : rawTier === 'Default/Max' ? 'Default' : undefined)
				const tierDesc = nftMeta?.description ?? tierMeta?.description
				const bgRaw = normalizeMetadataBackground((nftMeta as any)?.backgroundColor ?? (nftMeta as any)?.background_color)
					?? normalizeMetadataBackground((tierMeta as any)?.backgroundColor ?? (tierMeta as any)?.background_color)
				const bg = bgRaw ?? '#2C5535'
				const textColor = bgRaw ? textColorForBackground(bgRaw) : 'white'
				addIfNew(addr, {
					id: addr,
					name: meta?.name ?? addr.slice(0, 10) + '...',
					balance: formatWithThousands(details?.assets?.points ?? '0'),
					currency: 'CAD',
					type: 'Stored Value',
					memberNo: bestNft ? `M-${String(bestNft.tokenId).padStart(6, '0')}` : addr.slice(0, 10) + '...',
					bg: bg,
					textColor: textColor,
					image: nftMeta?.image ?? meta?.image,
					tier: tierName,
					tierName: tierName,
					tierDescription: tierDesc,
				})
			})
		}
		userCards.forEach((uc) => {
			// 持有者卡（非发行方）且在 filter list 中则不显示（本地缓存可能含旧数据）
			if (!isCardCreator(uc.cardAddress) && isCardExcludedFromDisplay(uc.cardAddress)) return
			const addr = uc.cardAddress.toLowerCase()
			const details = userCardDetails[addr]
			const nfts = details?.assets?.nfts?.filter((n) => Number(n.tokenId) > 0) as { tokenId: string; tier?: string }[] | undefined
			const bestNft = nfts?.length ? nfts.reduce((a, b) => (Number(b.tokenId) > Number(a.tokenId) ? b : a)) : undefined
			const rawTier = bestNft?.tier
			const tierIdx = rawTier != null && rawTier !== 'Default/Max' ? Number(rawTier) : null
			const tiers = details?.metadata?.tiers
			const tierMeta =
				tierIdx != null && Number.isInteger(tierIdx) && tiers?.length
					? tiers.find((t) => t.index === tierIdx) ?? tiers[tierIdx]
					: undefined
			const tierFallback = tierIdx != null ? `Tier ${tierIdx + 1}` : rawTier === 'Default/Max' ? 'Default' : undefined
			// 优先使用 per-NFT metadata（/metadata/0x{owner}{NFT#}.json），无则用卡级 tiers[tierIdx]
			const nftMeta = details?.nftMetadata
			const tierName = nftMeta?.name ?? tierMeta?.name ?? tierFallback
			const tierDescription = nftMeta?.description ?? tierMeta?.description
			const cardImage = nftMeta?.image ?? details?.metadata?.image
			const cardBgRaw = normalizeMetadataBackground((nftMeta as any)?.backgroundColor ?? (nftMeta as any)?.background_color)
				?? normalizeMetadataBackground((tierMeta as any)?.backgroundColor ?? (tierMeta as any)?.background_color)
			addIfNew(uc.cardAddress, {
				id: uc.cardAddress,
				name: details?.metadata?.name ?? uc.name,
				balance: details?.assets?.points != null ? formatWithThousands(details.assets.points) : '—',
				currency: uc.currency,
				type: 'Stored Value',
				memberNo: bestNft ? `M-${String(bestNft.tokenId).padStart(6, '0')}` : uc.cardAddress.slice(0, 10) + '...',
				bg: cardBgRaw ?? '#2C5535',
				image: cardImage,
				tier: tierName,
				tierName,
				tierDescription,
			})
		})
		return list
	}, [profiles?.[0]?.aaAccount, isCardCreator, ccsaAssets?.nfts, ccsaBalance, cashTreesAssets?.nfts, cashTreesBalance, cashTreesMetadata, latestCardsItems, assetCardDetails, userCards, userCardDetails])

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
		return (passes ?? []).map((p) => ({
			...p,
			nickname: passNicknames[p.id] || undefined,
			status: (archivedPassIds.has(p.id) ? 'archived' : 'active') as 'active' | 'archived',
		}))
	}, [passes, passNicknames, archivedPassIds])

	/** 显示的 passes：排除已隐藏，应用 nickname 作为 displayName */
	const visiblePasses = useMemo(
		() => (passes ?? []).filter((p) => !archivedPassIds.has(p.id)).map((p) => ({ ...p, displayName: passNicknames[p.id] || p.name })),
		[passes, archivedPassIds, passNicknames]
	)

	const filteredPasses = visiblePasses

	/** 当前选中的卡：优先从 cards（eoa/aa/ccsa）取，否则从 visiblePasses（基础设施卡、user card）合成 */
	const selectedCard = useMemo((): Card | undefined => {
		if (!activeView) return undefined
		const fromCards = cards.find((c) => c.id === activeView)
		if (fromCards) return fromCards
		const p = visiblePasses.find((x) => x.id === activeView)
		if (!p) return undefined
		const displayName = (p as { displayName?: string }).displayName ?? p.name ?? p.id
		return {
			id: p.id,
			name: displayName,
			balance: p.balance ?? '0',
			balanceFiat: 0,
			address: '',
			gradient: p.bg ?? '',
			badge: p.type ?? 'Card',
			badgeIcon: null,
			bg: p.bg ?? '',
			currency: p.currency,
			memberNo: p.memberNo,
			image: (p as { image?: string }).image,
		}
	}, [activeView, cards, visiblePasses])

	/** 当前选中的是否为「展示 My BeamioUserCards + Redeem Active List」的卡（CCSA、CashTrees、latestCards 资产卡、或自己创建的 user card） */
	const latestCardsAddrs = useMemo(() => new Set([...latestCardsItems.map((i) => i.cardAddress.toLowerCase()), CASH_TREES_CARD_ADDRESS]), [latestCardsItems])
	const isCardViewWithRedeemList =
		selectedCard?.id === 'ccsa' ||
		(!!selectedCard?.id && latestCardsAddrs.has(selectedCard.id.toLowerCase())) ||
		(!!selectedCard?.id && userCards.some((c) => c.cardAddress.toLowerCase() === selectedCard.id?.toLowerCase()))

	return (
		<>
		{/* h-full min-h-0 修复 Android WebView 中 flex+overflow 导致主内容不可见；min-h-screen 保证内容不足时仍占满视口 */}
		<div className="w-full h-[100dvh] min-h-0 box-border bg-[#F2F2F7] font-sans antialiased overflow-hidden relative flex flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
				{/* 固定独立胶囊：Title + 按钮组，悬浮于顶部，随滚动渐隐 */}
				{!activeView && (
					<div
						className="fixed left-0 right-0 z-30 flex items-center justify-between px-5 transition-opacity duration-300"
						style={{ top: 'max(1rem, env(safe-area-inset-top))', opacity: capsuleOpacity, pointerEvents: capsuleOpacity < 0.05 ? 'none' : 'auto' }}
					>
						{/* Title 胶囊 */}
						<div className="px-4 py-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full shadow-sm border border-gray-200/80 dark:border-slate-600/50">
							<h1 className="text-lg font-bold text-black dark:text-slate-100 tracking-tight">{tu('wallet')}</h1>
						</div>
						{/* 按钮组胶囊 */}
						<div className="flex items-center gap-2 px-2 py-1 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full shadow-sm border border-gray-200/80 dark:border-slate-600/50">
							{profiles?.[0]?.aaAccount ? (
								<button
									type="button"
									onClick={() => {
										setPayScreenMode('aa-eoa-transfer')
										setAaPanelOpen('支付')
										setShowFooter(false)
									}}
									className="w-9 h-9 rounded-full flex items-center justify-center text-[#65A30D] active:scale-95 transition-transform hover:bg-gray-50 dark:hover:bg-slate-700/50"
									title={tu('transfer_between_main_vault_and_express_pay')}
								>
									<ArrowLeftRight className="w-5 h-5" strokeWidth={2.4} />
								</button>
							) : null}
							<button
								type="button"
								onClick={() => setIsManagingCards(true)}
								className="w-9 h-9 rounded-full flex items-center justify-center text-[#65A30D] active:scale-95 transition-transform hover:bg-gray-50 dark:hover:bg-slate-700/50"
								title="Edit cards"
							>
								<Edit2 className="w-5 h-5" strokeWidth={2.4} />
							</button>
							<button
								type="button"
								onClick={() => {
									if (profiles?.[0]?.aaAccount) {
										setCcsaCreateCardOpen(true)
										setShowFooter(false)
									} else {
										openAddCashModal()
									}
								}}
								className="w-9 h-9 rounded-full flex items-center justify-center bg-[#96EB3C] text-gray-900 shadow-sm hover:bg-[#8ad936] active:scale-95 transition-transform"
								title={profiles?.[0]?.aaAccount ? 'Create BeamioUserCard' : 'Add cash'}
							>
								<Plus className="w-5 h-5" strokeWidth={2.4} />
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
						<div className="relative w-full pb-8">
							{/* 无 AA — CashTrees 引导；有 AA — Universal Pass + 基础设施卡 + Bind + Passes 纵向排列（非叠卡） */}
							{!profiles?.[0]?.aaAccount ? (
								<div className="w-full transition-all duration-500">
									<div className="bg-gradient-to-b from-gray-100 to-white border-2 border-dashed border-gray-300 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[360px] shadow-sm">
										<div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-gray-400 mb-6 shadow-sm border border-gray-100">
											<Wallet size={36} strokeWidth={1.5} />
										</div>
										<h2 className="text-xl font-bold text-gray-900 mb-2">{tu('get_started_with_cashtrees')}</h2>
										<p className="text-sm text-gray-500 mb-8 leading-relaxed px-2">
											Deploy a new smart wallet or sync your existing physical card.
										</p>
										<button
											type="button"
											onClick={openAddCashModal}
											className="w-full bg-[#96EB3C] hover:bg-[#8ad936] active:scale-95 text-gray-900 py-4 rounded-2xl font-bold transition-all shadow-[0_4px_14px_rgba(150,235,60,0.4)] flex items-center justify-center gap-2"
										>
											<ArrowDownToLine size={18} className="text-gray-900" />
											Add Cash to Activate
										</button>
										<div className="flex items-center w-full my-5 opacity-70">
											<div className="flex-1 border-t border-gray-200" />
											<span className="px-3 text-[10px] text-gray-400 font-bold uppercase tracking-widest">{tu('or')}</span>
											<div className="flex-1 border-t border-gray-200" />
										</div>
										<button
											type="button"
											onClick={() => {
												setShowFooter(false)
												navigate('/settings')
											}}
											className="w-full bg-white border border-gray-200 hover:bg-gray-50 active:scale-95 text-gray-700 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
										>
											<Radio size={18} className="text-[#65A30D]" />
											Sync Existing Card
										</button>
									</div>
								</div>
							) : (
								<div className="w-full flex flex-col gap-4">
									{/* Universal Pass — 白卡 + 淡绿光晕（对齐 renderAction index） */}
									<div
										className="relative w-full bg-gradient-to-br from-white to-[#F8F9FA] dark:from-slate-900 dark:to-slate-800 rounded-[2.5rem] p-7 text-gray-900 dark:text-slate-100 shadow-xl shadow-gray-200/50 dark:shadow-black/20 overflow-hidden border border-gray-100 dark:border-slate-700"
									>
										<div className="absolute -top-20 -right-20 w-64 h-64 bg-[#96EB3C] rounded-full blur-[80px] opacity-20 pointer-events-none" />
										<div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#96EB3C] rounded-full blur-[80px] opacity-10 pointer-events-none" />
										<div className="flex justify-between items-start mb-6 relative z-10">
											<div className="flex items-center min-w-0">
												<div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center mr-3 border border-gray-100 dark:border-slate-600 shadow-sm shrink-0">
													<Zap size={22} className="text-[#65A30D] fill-[#65A30D]" />
												</div>
												<div className="min-w-0">
													<span className="font-extrabold text-xl block tracking-tight text-gray-900 dark:text-slate-100">{tu('universal_pass')}</span>
													{profiles?.[0]?.aaAccount ? (
														<button
															type="button"
															onClick={(e) => { e.stopPropagation(); copyAddress(profiles[0].aaAccount, 'aa') }}
															className="flex items-center gap-1.5 mt-1.5 bg-gray-100/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-600 px-2 py-0.5 rounded-md w-max shadow-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors max-w-full"
														>
															<span className="text-[10px] text-gray-500 dark:text-slate-400 font-mono tracking-widest font-semibold truncate">
																{profiles[0].aaAccount.slice(0, 6)}…{profiles[0].aaAccount.slice(-4)}
															</span>
															{addressCopied === 'aa' ? <Check size={10} className="text-emerald-500 shrink-0" /> : <Copy size={10} className="text-gray-400 shrink-0" />}
														</button>
													) : null}
												</div>
											</div>
											<div className="flex items-center gap-2 shrink-0">
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation()
														handleAaRelayQR()
													}}
													className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 inline-flex items-center gap-2 transition-colors"
													title="Pay QR (valid 5 min)"
													aria-label={tu('pay_qr')}
												>
													{aaRelaySigning ? (
														<Loader className="w-4 h-4 animate-spin text-gray-700 dark:text-slate-200 shrink-0" />
													) : (
														<QrCode className="w-4 h-4 text-gray-800 dark:text-slate-200 shrink-0" />
													)}
													<span className="text-xs font-semibold text-gray-900 dark:text-slate-100">{tu('pay_qr')}</span>
												</button>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation()
														setActiveView('aa')
														setShowFooter(false)
													}}
													className="w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-gray-400 border border-gray-100 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
													title="Details"
													aria-label="Details"
												>
													<Info size={16} strokeWidth={2.5} />
												</button>
											</div>
										</div>
										<div className="relative z-10 mt-8">
											<p className="text-sm text-gray-500 dark:text-slate-400 font-semibold mb-1">{tu('total_balance')}</p>
											<div className="flex items-baseline flex-wrap gap-x-1">
												{universalPassCardCurrency === 'USDC' ? (
													<span className="text-3xl font-semibold mr-1 text-gray-400 dark:text-slate-500">$</span>
												) : fiatPrefix(universalPassCardCurrency) ? (
													<span className="text-3xl font-semibold mr-1 text-gray-400 dark:text-slate-500">{fiatPrefix(universalPassCardCurrency)}</span>
												) : null}
												<p className="text-5xl font-extrabold tracking-tighter text-gray-900 dark:text-slate-100 tabular-nums">
													{formatAmount(Number(universalPassPointsBalance || 0), universalPassCardCurrency)}
												</p>
												{universalPassCardCurrency !== 'CAD' ? (
													<span className="text-lg font-medium ml-2 text-gray-500 dark:text-slate-400">{universalPassCardCurrency}</span>
												) : null}
											</div>
											{universalPassCardCurrency === 'USDC' ? (
												<p className="text-gray-500 dark:text-slate-400 font-medium text-sm mt-2">≈ CA$ {formatWithThousands(universalPassApproxCad)}</p>
											) : null}
										</div>
									</div>

									{/* Bind Physical Card（对齐 renderAction，位于 Passes 列表之上） */}
									<div className="pt-1">
										<button
											type="button"
											onClick={() => {
												setShowFooter(false)
												navigate('/settings')
											}}
											className="w-full h-20 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-[1.5rem] flex items-center justify-center text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:border-[#96EB3C] transition-all cursor-pointer shadow-sm group"
										>
											<div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mr-3 group-hover:bg-[#96EB3C]/20 transition-colors">
												<Plus size={18} className="text-gray-500 group-hover:text-[#65A30D] transition-colors" />
											</div>
											<span className="font-bold tracking-tight text-[15px]">{tu('bind_physical_card')}</span>
										</button>
									</div>
								</div>
							)}
						</div>

					</div>

					{/* 40% 黑色遮罩：盖住背后被压住的卡片，点击关闭；仅当用户是该卡 owner 时显示 */}
					{showDetailsPanel && (
						<div
							className="absolute inset-0 z-[65] bg-black/40 transition-opacity duration-300 cursor-pointer"
							onClick={() => setActiveView(null)}
						/>
					)}

					{/* DETAILS PANEL - 统一面板；整块从顶到底一条渐变，与顶部同一色系、一气呵成；CCSA/其他增加背景模糊 */}
					<div
						className={`absolute inset-x-0 bottom-0 rounded-t-[4px] transition-transform duration-[600ms] cubic-bezier(0.19, 1, 0.22, 1) z-[80] flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.1)] ${
							showDetailsPanel ? 'translate-y-0' : 'translate-y-[1000px] pointer-events-none'
						}`}
						style={{
							top: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
							background: 'linear-gradient(180deg, #f7f7fa 0%, #F2F2F7 42%, #F2F2F7 100%)',
						}}
					>
						{/* Header：关闭、New NFT（仅卡详情）、设置 - VoucherDetailModal 风格，白色按钮在渐变上 */}
						<div className="px-6 pt-6 pb-2 flex justify-between items-center z-10">
							<button
								type="button"
								onClick={() => setActiveView(null)}
								className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white/90 border border-slate-200 hover:bg-white text-slate-700 transition-colors"
								aria-label={tu('close')}
							>
								<ChevronDown className="w-6 h-6" />
							</button>
							<div className="flex items-center gap-2">
								{selectedCard && selectedCard.id !== 'eoa' && selectedCard.id !== 'aa' && isOwnerOfSelectedCard && (
									<button
										type="button"
										onClick={() => setShowNewNftForm(true)}
										className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white/90 border border-slate-200 hover:bg-white text-slate-700 transition-colors"
										aria-label={tu('new_nft')}
										title={tu('new_nft')}
									>
										<Layers className="w-6 h-6" />
									</button>
								)}
							<button
								type="button"
								onClick={() => navigate('/settings')}
								className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white/90 border border-slate-200 hover:bg-white text-slate-700 transition-colors"
								aria-label={tu('settings')}
							>
								<Settings className="w-6 h-6" />
							</button>
							</div>
						</div>

						{/* 可滚动内容；背景透明，由面板容器的一条渐变统一呈现 */}
						{selectedCard && (
							<div className="flex-1 overflow-y-auto px-6 pt-2 pb-24 z-10 no-scrollbar">
								{/* 顶部预览：CCSA 用 greenCard；其余用 image / blackCard */}
								<div className="w-full min-h-[14rem] rounded-[24px] bg-[#ECECF1] border border-white/70 shadow-sm relative overflow-hidden mb-8 flex items-center justify-center px-4">
									<IpfsImg
										src={selectedCard.id === 'ccsa' ? greenCard : (selectedCard.image || blackCard)}
										alt="Market card preview"
										className="w-full max-w-[420px] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.18)]"
										draggable={false}
									/>
								</div>

								{/* Actions - express 风格 */}
								<div className="mb-8">
									{selectedCard.id === 'eoa' ? (
										<div className="flex items-start justify-between flex-wrap gap-4">
											<MiniAction
												label={tu('send')}
												icon={<ArrowUpRight className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
												onClick={() => {
													setPayScreenMode('eoa-pay')
													setEoaPanelOpen('支付')
													setShowFooter(false)
												}}
											/>
											<MiniAction
												label={tu('request')}
												icon={<ArrowDownLeft className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
												onClick={() => {
													setEoaPanelOpen('ShowPayQR')
													setShowFooter(false)
												}}
											/>
											<MiniAction
												label="Cashcode"
												icon={<ScanLine className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
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
												label="Bank"
												icon={<Landmark className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
												onClick={() => {
													setEoaPanelOpen('BankingBridge')
													setShowFooter(false)
												}}
											/>
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
													setAaPanelOpen('支付')
												}}
											/>
											
											<MiniAction
												label={tu('pay_bill')}
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
									) : isOwnerOfSelectedCard ? (
										/* 发行方：Pay / Top Up / New NFT / Add Admin 四键网格 */
										<div className="grid grid-cols-4 gap-3">
											<ExpressAction
												label={tu('pay')}
												iconBgClass="bg-[#1562f0] shadow-blue-600/30"
												icon={<Scan className="w-5 h-5" />}
												onClick={() => {
													setScanData('')
													setVoucherPayAmount('')
													setVoucherPayToAA('')
													setVoucherPayError('')
													setShowFooter(false)
													setActiveView(null)
													setShowTenKeySlide(true)
												}}
											/>
											<ExpressAction
												label={userCards.length === 0 ? 'Check NFC Balance' : 'Create Redeem'}
												iconBgClass="bg-green-500 shadow-green-500/30"
												icon={userCards.length === 0 ? <SmartphoneNfc className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
												onClick={() => {
													if (userCards.length === 0) {
														setShowFooter(false)
														setNfcCheckBalanceOpen(true)
													} else {
														setTopUpRedeemKey((k) => k + 1)
														setShowFooter(false)
														setTopUpRedeemOpen(true)
													}
												}}
											/>
											<ExpressAction
												label={tu('new_nft')}
												iconBgClass="bg-indigo-500 shadow-indigo-500/30"
												icon={<Layers className="w-5 h-5" />}
												onClick={() => {
													setShowFooter(false)
													setShowNewNftForm(true)
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
									) : (
										/* 持有者（非发行方）：Reload 打开充值流程，Gift 跳转 Market */
										<div className="grid grid-cols-2 gap-3">
											<ExpressAction
												label="Reload"
												iconBgClass="bg-[#1562f0] shadow-blue-600/30"
												icon={<Plus className="w-5 h-5" />}
												onClick={() => {
													if (selectedCard?.id && ethers.isAddress(selectedCard.id)) {
														setHolderTopupCardAddress(selectedCard.id)
														setShowFooter(false)
														setHolderTopupOpen(true)
													}
												}}
											/>
											<ExpressAction
												label={tu('gift')}
												iconBgClass="bg-green-500 shadow-green-500/30"
												icon={<Gift className="w-5 h-5" />}
												onClick={() => {
													navigate('/settings')
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
												<div className="py-6 text-center text-gray-400 text-sm">{tu('no_active_items')}</div>
											)}
										</div>

										{/* Indexer History（BeamioIndexerDiamond 本月前20条） */}
										<ActiveHistoryPannelNew />

										{/* Recent Activity */}
										<div className="bg-white rounded-[24px] p-5 shadow-sm mb-4">
											<div className="flex justify-between items-center mb-4">
												<h3 className="font-bold text-gray-900">{tu('recent_activity')}</h3>
												<button
													type="button"
													onClick={() => navigate('/HistoryAll')}
													className="text-xs font-bold text-[#1562f0]"
												>{tu('view_all')}</button>
											</div>
											{history.length ? (
												<div className="space-y-4">
													{history.slice(0, 10).map((tx, idx) => (
														<div
															key={`${tx.mode}-${tx.hash || tx.redeemHash || idx}`}
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
												<div className="text-center py-8 text-gray-400 text-sm">{tu('no_recent_transactions')}</div>
											)}
										</div>
									</>
									) : isCardViewWithRedeemList ? (
										/* CCSA / 基础设施卡 / 用户卡：Member Benefits + Card Information（仅 CCSA/基础设施）+ My BeamioUserCards + Redeem Active List */
										<>
											{selectedCard.id === 'ccsa' && (
										<>
											{/* Member Benefits - VoucherDetailModal 风格 */}
											<div className="bg-white rounded-[24px] p-5 shadow-sm mb-4">
												<div className="flex items-center gap-2 mb-4">
													<Star className="w-4 h-4 text-orange-500 fill-orange-500" />
													<h3 className="font-bold text-gray-900">{tu('member_benefits')}</h3>
												</div>
												<div className="space-y-4">
													<div className="flex items-start gap-3">
														<div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
															<Star className="w-4 h-4 text-[#1562f0]" />
														</div>
														<div>
															<h4 className="text-sm font-bold text-gray-900">{tu('alliance_discount')}</h4>
															<p className="text-xs text-gray-500 leading-relaxed">10% off at participating restaurants.</p>
														</div>
													</div>
													<div className="flex items-start gap-3">
														<div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
															<Zap className="w-4 h-4 text-[#1562f0]" />
														</div>
														<div>
															<h4 className="text-sm font-bold text-gray-900">{tu('gas_free')}</h4>
															<p className="text-xs text-gray-500 leading-relaxed">{tu('zero_transaction_fees_on_beamio_network')}</p>
														</div>
													</div>
												</div>
											</div>

											{/* Recent Activity */}
											<div className="bg-white rounded-[24px] p-5 shadow-sm mb-4">
												<div className="flex justify-between items-center mb-4">
													<h3 className="font-bold text-gray-900">{tu('recent_activity')}</h3>
													<span className="text-xs font-bold text-[#1562f0]">{tu('view_all')}</span>
												</div>
												<div className="text-center py-8 text-gray-400 text-sm">{tu('no_recent_transactions')}</div>
											</div>

													{/* Card Information - VoucherDetailModal 风格（仅 CCSA） */}
											<div className="bg-white rounded-[24px] p-5 shadow-sm mb-4">
												<div className="flex items-center gap-2 mb-4">
													<Info className="w-4 h-4 text-gray-400" />
													<h3 className="font-bold text-gray-900">{tu('card_information')}</h3>
												</div>
												<div className="space-y-3">
													<div className="flex justify-between text-xs">
														<span className="text-gray-500">{tu('issuer')}</span>
														<span className="font-medium text-gray-900">Canada Chinese Restaurant Alliance</span>
													</div>
													<div className="flex justify-between text-xs">
														<span className="text-gray-500">{tu('network')}</span>
														<span className="font-medium text-gray-900">{tu('base_mainnet')}</span>
													</div>
													<div className="flex justify-between text-xs">
														<span className="text-gray-500">{tu('standard')}</span>
														<span className="font-medium text-gray-900">ERC-1155</span>
													</div>
													<div className="flex justify-between text-xs">
														<span className="text-gray-500">{tu('contract')}</span>
														<span className="font-mono text-gray-500">
															{CCSA_Card_Address ? `${CCSA_Card_Address.slice(0, 6)}...${CCSA_Card_Address.slice(-4)}` : '—'}
														</span>
													</div>
													<div className="flex justify-between text-xs items-center pt-2 border-t border-gray-100 mt-2">
														<span className="text-gray-500 flex items-center gap-1">
															<ShieldCheck className="w-3 h-3 text-green-500" /> Audit Status
														</span>
														<span className="font-bold text-green-600">{tu('verified')}</span>
													</div>
												</div>
											</div>
												</>
											)}
											{/* Card Information：latestCards 资产卡（如 CashTrees） */}
											{selectedCard.id !== 'ccsa' &&
												selectedCard.id &&
												latestCardsAddrs.has(selectedCard.id.toLowerCase()) && (
												<div className="bg-white rounded-[24px] p-5 shadow-sm mb-4">
													<div className="flex items-center gap-2 mb-4">
														<Info className="w-4 h-4 text-gray-400" />
														<h3 className="font-bold text-gray-900">{tu('card_information')}</h3>
													</div>
													<div className="space-y-3">
														<div className="flex justify-between text-xs">
															<span className="text-gray-500">{tu('network')}</span>
															<span className="font-medium text-gray-900">{tu('base_mainnet')}</span>
														</div>
														<div className="flex justify-between text-xs">
															<span className="text-gray-500">{tu('contract')}</span>
															<span className="font-mono text-gray-500" title={selectedCard.id}>
																{selectedCard.id.slice(0, 10)}...{selectedCard.id.slice(-8)}
															</span>
														</div>
													</div>
												</div>
											)}

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
														>{tu('top_up')}</button>
													)}
												</div>
												{historyUserCardTiles.length > 0 ? (
												<div className="space-y-3">
													{historyUserCardTiles.map((card) => (
														<div
															key={card.cardAddress}
															className="relative overflow-hidden rounded-2xl border border-slate-200 p-4"
															style={{ background: card.bg }}
														>
															{card.image ? (
																<IpfsImg
																	src={card.image}
																	alt={card.name}
																	className="pointer-events-none absolute left-4 top-4 h-[calc(100%-2rem)] w-52 rounded-xl object-contain object-left opacity-95"
																/>
															) : null}
															<div className="relative z-10 flex-1 min-w-0">
																<div className="flex items-start justify-end mb-1">
																	<div className="rounded-md bg-black/25 px-2 py-1 text-xs font-semibold text-white">
																		{card.pointsTopRight} pts
																	</div>
																</div>
																<p className="text-right text-sm font-bold text-white">
																	{card.name}
																</p>
																{card.tierName ? (
																	<p className="mt-1 text-right text-xs text-white/85">
																		{card.tierName}
																	</p>
																) : null}
																{card.tierDescription ? (
																	<p className="mt-1 text-right text-xs text-white/85">
																		{card.tierDescription}
																	</p>
																) : null}
																<div className="mt-2 flex items-center justify-end gap-1.5">
																	<p className="truncate text-xs font-mono text-white/85" title={card.cardAddress}>
																		{card.cardAddress.slice(0, 10)}...{card.cardAddress.slice(-8)}
																	</p>
																	<button
																		type="button"
																		onClick={(e) => {
																			e.stopPropagation()
																			copyCardAddress(card.cardAddress)
																		}}
																		className="shrink-0 rounded-md p-1 transition-colors active:scale-95 hover:bg-white/15"
																		aria-label={tu('copy_address')}
																	>
																		<AnimatePresence mode="wait">
																			{copiedCardAddress === card.cardAddress ? (
																				<motion.span
																					key="check"
																					initial={{ scale: 0, opacity: 0 }}
																					animate={{ scale: 1, opacity: 1 }}
																					transition={{ type: 'spring', stiffness: 400, damping: 20 }}
																				>
																					<Check size={14} className="text-emerald-300" strokeWidth={2.5} />
																				</motion.span>
																			) : (
																				<motion.span
																					key="copy"
																					initial={{ opacity: 1 }}
																					exit={{ opacity: 0 }}
																				>
																					<Copy size={14} className="text-white/80" strokeWidth={2} />
																				</motion.span>
																			)}
																		</AnimatePresence>
																	</button>
																</div>
																<div className="mt-1.5 text-right text-sm font-semibold text-emerald-200">
																	{card.currency}
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
											{cardRedeemsBatches.length > 0 && (
												<RedeemActiveList
													batches={cardRedeemsBatches}
													onManageClick={() => {
														setShowFooter(false)
														setShowRedeemListOpen(true)
													}}
													onRemoveNotFound={() => {
														setCardRedeemsVersion((v) => v + 1)
													}}
												/>
											)}
										</div>
										</>
									) : (
										/* AA (Express Pay)：与 EOA 共用 Indexer History，收款人可在此看到转入记录 */
										<ActiveHistoryPannelNew />
									)}
								</div>
						)}
					</div>
				</div>

				{/* New NFT 底部滑出表单：对应 createIssuedNft，离线签字送 API 代付 gas */}
				{showNewNftForm && cardAddressForDetails && (
					<div className="fixed inset-0 z-[85] flex flex-col justify-end">
						<div
							className="absolute inset-0 bg-black/50 transition-opacity"
							onClick={() => !newNftSubmitting && setShowNewNftForm(false)}
							aria-hidden
						/>
						<div className="relative bg-white dark:bg-slate-900 rounded-t-[22px] max-h-[85dvh] overflow-hidden pb-[env(safe-area-inset-bottom)] shadow-2xl flex flex-col animate-slide-up">
							<div className="pt-2 pb-1 flex justify-center shrink-0">
								<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
							</div>
							<div className="px-4 pb-6 overflow-y-auto flex-1 min-h-0">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tu('new_nft')}</h2>
									<button
										type="button"
										onClick={() => !newNftSubmitting && setShowNewNftForm(false)}
										className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
										aria-label={tu('close')}
									>
										<X className="w-5 h-5" />
									</button>
								</div>
								<p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
									Define a new issued NFT type (e.g. event tickets). Title is stored as keccak256. Valid range and price are optional.
								</p>
								{newNftError && (
									<div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
										<Info className="w-4 h-4 shrink-0" />
										{newNftError}
									</div>
								)}
								<div className="space-y-4">
									<div>
										<label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{tu('title_event_name')}</label>
										<input
											type="text"
											value={newNftTitle}
											onChange={(e) => setNewNftTitle(e.target.value)}
											placeholder="e.g. Concert 2025"
											className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
										/>
									</div>
									<div>
										<label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{tu('description_eip_1155')}</label>
										<textarea
											value={newNftDescription}
											onChange={(e) => setNewNftDescription(e.target.value)}
											placeholder="Short description for Base Explorer"
											rows={2}
											className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none"
										/>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{tu('valid_from_optional')}</label>
											<input
												type="datetime-local"
												value={newNftValidAfter}
												onChange={(e) => setNewNftValidAfter(e.target.value)}
												className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
											/>
										</div>
										<div>
											<label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{tu('valid_until_optional')}</label>
											<input
												type="datetime-local"
												value={newNftValidBefore}
												onChange={(e) => setNewNftValidBefore(e.target.value)}
												className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
											/>
										</div>
									</div>
									<div>
										<label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{tu('max_supply')}</label>
										<input
											type="number"
											min={1}
											value={newNftMaxSupply}
											onChange={(e) => setNewNftMaxSupply(e.target.value)}
											placeholder="e.g. 100"
											className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
										/>
									</div>
									<div>
										<label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{tu('price_card_currency_0_free')}</label>
										<input
											type="number"
											min={0}
											step="0.000001"
											value={newNftPriceE6}
											onChange={(e) => setNewNftPriceE6(e.target.value)}
											placeholder="0"
											className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
										/>
									</div>
									<div>
										<label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{tu('image_eip_1155')}</label>
										<div className="flex items-center gap-2 flex-wrap">
											<input
												ref={newNftImageInputRef}
												type="file"
												accept="image/*"
												className="hidden"
												onChange={handleNewNftImagePick}
											/>
											<button
												type="button"
												onClick={() => newNftImageInputRef.current?.click()}
												disabled={newNftImageUploading || newNftSubmitting}
												className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
											>
												{newNftImageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
												{newNftImageUploading ? 'Uploading…' : 'Add image'}
											</button>
											{newNftImageUrl ? (
												<>
													<a href={newNftImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#1562f0] truncate max-w-[140px]" title={newNftImageUrl}>{tu('link')}</a>
													<button type="button" onClick={() => setNewNftImageUrl('')} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400" aria-label="Remove image">
														<Trash2 className="w-4 h-4" />
													</button>
												</>
											) : null}
										</div>
										{newNftImageUrl && (
											<div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 aspect-video max-h-24">
												<IpfsImg src={newNftImageUrl} alt="NFT" className="w-full h-full object-contain" />
											</div>
										)}
									</div>
									<div>
										<label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{tu('background_color_optional_e_g_6366f1')}</label>
										<div className="flex items-center gap-2">
											<input
												type="color"
												value={newNftBackgroundColor.startsWith('#') ? newNftBackgroundColor : '#6366f1'}
												onChange={(e) => setNewNftBackgroundColor(e.target.value)}
												className="h-10 w-14 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer bg-white"
											/>
											<input
												type="text"
												value={newNftBackgroundColor}
												onChange={(e) => setNewNftBackgroundColor(e.target.value)}
												placeholder="#6366f1"
												className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm placeholder:text-slate-400"
											/>
										</div>
									</div>
									<button
										type="button"
										onClick={handleNewNftSubmit}
										disabled={newNftSubmitting || !newNftTitle.trim() || !newNftMaxSupply.trim()}
										className="w-full py-3.5 rounded-xl bg-[#1562f0] text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
									>
										{newNftSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Layers className="w-5 h-5" />}
										{newNftSubmitting ? 'Submitting…' : 'Create NFT'}
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Add Cash：CashTrees 多步底栏（对齐 renderAction index Add Cash） */}
				{showAddCashModal && (
					<div className="fixed inset-0 z-[110] flex flex-col pointer-events-auto">
						<button
							type="button"
							className="absolute inset-0 bg-gray-900/40 backdrop-blur-md border-0 cursor-default"
							onClick={closeAddCashModal}
							aria-label={tu('close')}
						/>
						<div className="mt-auto bg-white dark:bg-slate-900 rounded-t-[2.5rem] p-6 relative z-10 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] h-[85dvh] max-h-[85dvh] pb-[env(safe-area-inset-bottom)] animate-slide-up overflow-hidden">
							<div className="mx-auto w-12 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full mb-6 shrink-0" />
							<div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
								{addCashMode === 'methods' ? (
									<>
										<h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2 tracking-tight text-center">{tu('add_cash')}</h3>
										<p className="text-sm text-gray-500 dark:text-slate-400 mb-8 text-center">{tu('select_how_you_want_to_fund_your_balance')}</p>
										<div className="space-y-3 mb-6">
											<h4 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-3 px-1">{tu('funding_source')}</h4>
											<button
												type="button"
												onClick={() => setAddCashMode('store_qr')}
												className="w-full text-left bg-white dark:bg-slate-800 border border-[#96EB3C]/50 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-[#96EB3C]/10 active:scale-[0.98] transition-all relative overflow-hidden group"
											>
												<div className="absolute top-0 right-0 w-24 h-24 bg-[#96EB3C]/20 rounded-full -mr-10 -mt-10 blur-xl group-hover:bg-[#96EB3C]/30 transition-colors pointer-events-none" />
												<div className="flex items-center relative z-10 min-w-0">
													<div className="w-10 h-10 bg-[#96EB3C] rounded-xl flex items-center justify-center mr-3 shadow-sm shrink-0">
														<Store className="text-gray-900" size={20} />
													</div>
													<div className="min-w-0">
														<p className="font-bold text-gray-900 dark:text-slate-100">{tu('deposit_cash_at_store')}</p>
														<p className="text-xs text-gray-600 dark:text-slate-400">{tu('give_cash_to_an_alliance_cashier')}</p>
													</div>
												</div>
												<QrCode className="text-gray-900 dark:text-slate-100 relative z-10 shrink-0" size={20} />
											</button>
											<button
												type="button"
												onClick={() => setAddCashMode('coinbase')}
												className="w-full text-left bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-[0.98] transition-all mt-4"
											>
												<div className="flex items-center min-w-0">
													<div className="w-10 h-10 bg-[#0052FF] rounded-xl flex items-center justify-center mr-3 shadow-sm shrink-0">
														<span className="text-white font-bold text-xl">C</span>
													</div>
													<div className="min-w-0">
														<p className="font-bold text-gray-900 dark:text-slate-100">Coinbase Pay</p>
														<p className="text-xs text-gray-500 dark:text-slate-400">{tu('buy_usdc_securely_with_debit_credit')}</p>
													</div>
												</div>
												<ChevronRight className="text-gray-400 shrink-0" size={20} />
											</button>
											<button
												type="button"
												onClick={() => setAddCashMode('convert')}
												className="w-full text-left bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-[0.98] transition-all mt-4"
											>
												<div className="flex items-center min-w-0">
													<div className="w-10 h-10 bg-blue-50 dark:bg-slate-700 border border-blue-100 dark:border-slate-600 rounded-xl flex items-center justify-center mr-3 shrink-0">
														<ArrowLeftRight className="text-blue-600 dark:text-blue-400" size={20} />
													</div>
													<div className="min-w-0">
														<p className="font-bold text-gray-900 dark:text-slate-100">使用 USDC 充值</p>
														<p className="text-xs text-gray-500 dark:text-slate-400">{tu('convert_crypto_to_network_ca')}</p>
													</div>
												</div>
												<ChevronRight className="text-gray-400 shrink-0" size={20} />
											</button>
										</div>
									</>
								) : addCashMode === 'store_qr' ? (
									<>
										<div className="flex items-center mb-6 w-full relative">
											<button type="button" onClick={() => setAddCashMode('methods')} className="text-[#65A30D] font-bold flex items-center text-sm absolute left-0">
												<ChevronRight className="rotate-180 mr-1" size={16} /> Back
											</button>
											<h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight mx-auto">{tu('store_deposit')}</h3>
										</div>
										<div className="flex flex-col items-center justify-center pb-8 pt-4">
											<p className="text-sm text-gray-500 dark:text-slate-400 mb-8 text-center max-w-[260px] leading-relaxed">
												Show this code to any <span className="font-bold text-gray-900 dark:text-slate-100">Alliance Cashier</span> and hand them your paper cash.
											</p>
											<div className="w-64 h-64 bg-white dark:bg-slate-800 rounded-[2rem] p-4 mb-6 shadow-md border border-gray-100 dark:border-slate-600">
												<div className="w-full h-full bg-gray-50 dark:bg-slate-900 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden border border-gray-200 dark:border-slate-600">
													<QRCodeCanvas value={storeDepositQrValue} size={200} level="M" includeMargin />
													<div className="absolute bg-white dark:bg-slate-800 p-1 rounded-full shadow-sm border border-gray-100 dark:border-slate-600">
														<div className="w-8 h-8 bg-[#96EB3C] rounded-full flex items-center justify-center text-gray-900 font-bold text-lg" aria-hidden>🌳</div>
													</div>
												</div>
											</div>
											<div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 px-5 py-3 rounded-full border border-gray-200 dark:border-slate-600 shadow-inner mt-2">
												<div className="w-2 h-2 bg-[#65A30D] rounded-full animate-pulse" />
												<span className="text-xs font-bold text-gray-600 dark:text-slate-300 tracking-wide uppercase">{tu('waiting_for_cashier_scan')}</span>
											</div>
										</div>
									</>
								) : addCashMode === 'coinbase' ? (
									<>
										<div className="flex items-center mb-6 w-full relative">
											<button type="button" onClick={() => setAddCashMode('methods')} className="text-[#65A30D] font-bold flex items-center text-sm absolute left-0">
												<ChevronRight className="rotate-180 mr-1" size={16} /> Back
											</button>
											<h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight mx-auto">Coinbase Pay</h3>
										</div>
										<div className="flex flex-col items-center justify-center pt-4 w-full pb-8">
											<div className="w-16 h-16 bg-[#0052FF] rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-6">C</div>
											<h4 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">{tu('buy_usdc_directly')}</h4>
											<p className="text-sm text-gray-500 dark:text-slate-400 mb-8 text-center px-4">
												You will be securely redirected to Coinbase to complete your purchase. The USDC will be deposited to your Base network wallet automatically.
											</p>
											<div className="w-full max-w-[280px] bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 border border-gray-200 dark:border-slate-600 mb-8 shadow-sm">
												<div className="flex justify-between items-center mb-3 gap-2">
													<span className="text-xs text-gray-500 font-medium shrink-0">{tu('to_wallet')}</span>
													<span className="text-xs font-mono text-gray-900 dark:text-slate-100 font-bold bg-white dark:bg-slate-900 px-2 py-1 rounded shadow-sm border border-gray-100 dark:border-slate-600 truncate max-w-[58%]">
														{myAddress && ethers.isAddress(myAddress) ? `${myAddress.slice(0, 6)}…${myAddress.slice(-4)}` : '—'}
													</span>
												</div>
												<div className="flex justify-between items-center">
													<span className="text-xs text-gray-500 font-medium">{tu('network')}</span>
													<div className="flex items-center bg-white dark:bg-slate-900 px-2 py-1 rounded shadow-sm border border-gray-100 dark:border-slate-600">
														<div className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center mr-1.5" />
														<span className="text-xs font-bold text-gray-900 dark:text-slate-100">Base</span>
													</div>
												</div>
											</div>
											<button
												type="button"
												onClick={handleAddCashContinueCoinbase}
												className="w-full max-w-[280px] py-4 bg-[#0052FF] hover:bg-blue-700 active:scale-95 text-white rounded-2xl font-bold transition-all shadow-md flex items-center justify-center"
											>
												Continue to Coinbase
											</button>
										</div>
									</>
								) : (
									<>
										<div className="flex items-center mb-6 w-full relative">
											<button type="button" onClick={() => setAddCashMode('methods')} className="text-[#65A30D] font-bold flex items-center text-sm absolute left-0">
												<ChevronRight className="rotate-180 mr-1" size={16} /> Back
											</button>
											<h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 tracking-tight mx-auto">{tu('top_up')}</h3>
										</div>
										<div className="flex flex-col pt-2 w-full pb-8">
											<div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-3xl p-5 mb-2 relative shadow-inner">
												<div className="flex justify-between items-center mb-2">
													<span className="text-sm font-semibold text-gray-500 dark:text-slate-400">{tu('from_usdc')}</span>
													<span className="text-xs font-bold text-gray-400">Bal: {formatWithThousands(String(usdcbalance ?? '0'))}</span>
												</div>
												<div className="flex items-center justify-between gap-2">
													<input
														type="number"
														placeholder="0.00"
														value={addAmount}
														onChange={(e) => setAddAmount(e.target.value)}
														inputMode="decimal"
														autoComplete="off"
														className="bg-transparent text-3xl font-bold text-gray-900 dark:text-slate-100 outline-none w-1/2 min-w-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
													/>
													<div className="flex items-center bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full shadow-sm border border-gray-100 dark:border-slate-600 shrink-0">
														<div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-[10px] mr-1.5">$</div>
														<span className="text-sm font-bold text-gray-900 dark:text-slate-100">USDC</span>
													</div>
												</div>
											</div>
											<div className="flex justify-center -my-4 relative z-10">
												<div className="w-10 h-10 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-full flex items-center justify-center shadow-sm">
													<ArrowDownToLine size={18} className="text-gray-400" />
												</div>
											</div>
											<div className="bg-white dark:bg-slate-800 border border-[#96EB3C]/50 rounded-3xl p-5 mt-2 relative shadow-sm">
												<div className="flex justify-between items-center mb-2">
													<span className="text-sm font-semibold text-gray-500 dark:text-slate-400">{tu('to_network_balance')}</span>
												</div>
												<div className="flex items-center justify-between gap-2">
													<span className="text-3xl font-bold text-[#65A30D] tabular-nums">{addCashCadPreview}</span>
													<div className="flex items-center bg-gray-50 dark:bg-slate-900 px-3 py-1.5 rounded-full border border-gray-100 dark:border-slate-600 shrink-0">
														<span className="text-sm font-bold text-gray-700 dark:text-slate-200">CA$</span>
													</div>
												</div>
											</div>
											<div className="mt-8 bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 border border-gray-200 dark:border-slate-600">
												<div className="flex justify-between text-sm mb-2">
													<span className="text-gray-500 dark:text-slate-400">Rate</span>
													<span className="font-semibold text-gray-900 dark:text-slate-100">
														{Number.isFinite(addCashCadRate) ? `1 USDC = ${addCashCadRate.toFixed(4)} CAD` : '—'}
													</span>
												</div>
												<div className="flex justify-between items-center text-sm pt-2">
													<span className="text-gray-500 dark:text-slate-400">{tu('network_fee')}</span>
													<div className="flex flex-col items-end">
														<span className="font-bold text-[#65A30D] bg-[#96EB3C]/20 px-2 py-0.5 rounded-md">Free</span>
														<span className="text-[10px] text-gray-400 mt-1">{tu('sponsored_by_cashtrees')}</span>
													</div>
												</div>
											</div>
											<button
												type="button"
												onClick={handleAddCashConfirmConvert}
												className="w-full py-4 mt-6 bg-[#96EB3C] hover:bg-[#8ad936] active:scale-95 text-gray-900 rounded-2xl font-bold transition-all shadow-[0_4px_14px_rgba(150,235,60,0.4)] flex items-center justify-center gap-2"
											>
												<ArrowDownToLine size={20} className="text-gray-900" />
												Confirm Top Up
											</button>
										</div>
									</>
								)}
							</div>
						</div>
					</div>
				)}

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
							{eoaPanelOpen === '支付' && (
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
							{aaPanelOpen === '支付' && (
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

				{/* NFC Check Balance：无卡用户读取 NFC 卡余额 */}
				<NfcCheckBalanceBottomSheet
					open={nfcCheckBalanceOpen}
					onClose={() => {
						setNfcCheckBalanceOpen(false)
						setShowFooter(true)
					}}
					readUid={readNfcUid}
				/>

				{/* AA 扣款 QR：商家 3 分钟内扫码扣款 */}
				<div
					className={`fixed inset-0 z-[100] ${aaRelayQROpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
					aria-hidden={!aaRelayQROpen}
				>
					<div
						className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${aaRelayQROpen ? 'opacity-100' : 'opacity-0'}`}
						onClick={() => {
							setAaRelayQROpen(false)
							setAaRelayQRPayload(null)
							setShowFooter(true)
						}}
					/>
					<div
						className={`absolute inset-x-0 bottom-0 bg-white dark:bg-slate-900 rounded-t-[22px] max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-hidden pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out ${aaRelayQROpen ? 'translate-y-0' : 'translate-y-full'}`}
					>
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
						</div>
						<div className="px-4 pb-4 overflow-y-auto">
							<BeamioNavBack
								title=""
								onClose={() => {
									setAaRelayQROpen(false)
									setAaRelayQRPayload(null)
									setShowFooter(true)
								}}
								onMore={() => {}}
							/>
							{aaRelayQRPayload && (
								<ShowPayQR
									successUrl={'https://beamio.app?beamio=' + (beamio?.accountName ?? '')}
									beamio={beamio ?? null}
									qrValue={encodeOpenContainerRelayQrPayload(aaRelayQRPayload)}
									hideActions
									hideUrl
									hideName
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
									<p className="text-lg font-bold text-slate-900 dark:text-slate-100">{tu('minting_to_aa')}</p>
									<p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{tu('executing_logic_hook')}</p>
								</div>
							) : redeemSuccessTx ? (
								/* Success: Redeemed Successfully */
								<div className="space-y-6">
									<div className="flex items-center justify-center gap-2">
										<div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
											<Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
										</div>
										<p className="text-lg font-bold text-slate-900 dark:text-slate-100">{tu('redeemed_successfully')}</p>
									</div>

									{/* 卡面 - CCSA 或通用 BeamioUserCard（UserCard 使用 metadata 的 image、background） */}
									{redeemDetails && (
										<div className="w-full max-w-[340px] mx-auto">
											<div className="relative w-full aspect-[1.58/1] rounded-[24px] overflow-hidden shadow-2xl">
												{isCcsaCard(redeemCardNumberInput) ? (
													<>
														<IpfsImg src={ccsabackphoto} alt={tu('ccsa_card')} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
														<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.02)_38%,rgba(0,0,0,0.18)_100%)]" />
													</>
												) : (
													<>
														{/* 背景：优先使用 tier metadata 的 backgroundColor，无则用卡级，再则用默认渐变 */}
														{(() => {
															const bg = redeemCardTierMeta?.backgroundColor ?? redeemCardMetadata?.tiers?.[0]?.backgroundColor
															return (
																<div
																	className="absolute inset-0"
																	style={{
																		background: bg
																			? (bg.startsWith('#') ? bg : `#${bg.replace(/^#/, '')}`)
																			: 'linear-gradient(135deg,#1562f0_0%,#0d47a1_50%,#1562f0_100%)',
																	}}
																/>
															)
														})()}
														{/* card image 显示在左上角：优先 tier，无则用卡级 */}
														{(redeemCardTierMeta?.image ?? redeemCardMetadata?.image) && (
															<div className="absolute top-4 left-4 w-14 h-14 rounded-xl overflow-hidden border border-white/20 shadow-lg z-10">
																<IpfsImg src={(redeemCardTierMeta?.image ?? redeemCardMetadata?.image) ?? ''} alt="" className="w-full h-full object-cover" draggable={false} />
															</div>
														)}
													</>
												)}
												<div className={`relative z-10 p-5 h-full flex flex-col justify-between ${!isCcsaCard(redeemCardNumberInput) && (redeemCardTierMeta?.image ?? redeemCardMetadata?.image) ? 'pl-[5.5rem]' : ''}`}>
													<div className="flex justify-between items-start">
														<div className="flex items-center gap-4">
															{!(redeemCardTierMeta?.image ?? redeemCardMetadata?.image) && (
																<div className="w-10 h-10 rounded-full grid place-items-center shrink-0 overflow-hidden" style={isCcsaCard(redeemCardNumberInput) ? { background: 'linear-gradient(135deg, #ffd65a 0%, #d19a00 100%)' } : { background: 'rgba(255,255,255,0.25)' }}>
																	<CreditCard className="h-5 w-5 text-white" />
														</div>
															)}
															<div><div className="text-[18px] font-black tracking-wide text-white drop-shadow-sm font-serif">{isCcsaCard(redeemCardNumberInput) ? 'CCSA' : (redeemCardMetadata?.name ?? redeemDetails.cardName ?? 'User Card')}</div>{!isCcsaCard(redeemCardNumberInput) && redeemCardTierMeta?.name && <div className="text-[14px] font-semibold tracking-wide text-white/90 -mt-0.5">{redeemCardTierMeta.name}</div>}</div>
														</div>
													</div>
													<div>
														<p className="text-[10px] font-bold opacity-80 uppercase mb-0.5 text-white/90">Amount</p>
														<div className="flex items-baseline gap-1">
															<span className="text-3xl font-medium tracking-tighter text-white">{(() => {
																const pts = Number(redeemDetails.pointsHuman)
																const ptsPer1 = Number(redeemDetails.ptsPer1Currency)
																if (!ptsPer1) return formatAmount(pts, 'USDC', 4)
																const amt = pts / ptsPer1
																return formatAmount(amt, redeemDetails.currency as any, amt > 0 && amt < 0.01 ? 4 : undefined)
															})()}</span>
															<span className="text-sm font-semibold opacity-90 text-white">{redeemDetails.currency as string}</span>
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
											<span className="px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-xs font-semibold">{tu('confirmed')}</span>
										</div>
										<div className="rounded-xl bg-white dark:bg-slate-800 p-4 flex items-center gap-4">
											<div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
												<ArrowDownLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
											</div>
											<div className="flex-1 min-w-0">
												<p className="font-semibold text-slate-900 dark:text-slate-100">{tu('stored_value_added')}</p>
												<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tu('just_now')}</p>
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
											<button
												type="button"
												onClick={() => openExternalUrl(`https://basescan.org/tx/${redeemSuccessTx}`)}
												className="text-xs font-mono text-slate-900 dark:text-slate-100 hover:underline"
											>
												{`${redeemSuccessTx.slice(0, 6)}...${redeemSuccessTx.slice(-4)}`}
											</button>
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
											refreshCcsaAssets()
										}}
										className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-base uppercase tracking-wide"
									>{tu('done')}</button>
								</div>
							) : (
								<>
							{/* Header */}
							<h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-0.5 text-center">{tu('redeem_asset')}</h3>
							<p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center">{tu('mint_to_express_pay_smart_account')}</p>

							{/* Asset Card - CCSA 风格（基础设施卡）或通用 BeamioUserCard 风格（使用 metadata image/background）；加载失败时显示错误提示 */}
							{(redeemDetailsLoading || redeemDetails || (redeemCodeInput.trim() && !redeemDetailsLoading && !redeemDetails)) && (
								<div className="w-full max-w-[340px] mx-auto mb-6">
									{redeemDetailsLoading ? (
										<div className="relative w-full aspect-[1.58/1] rounded-[24px] overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
											<Loader className="w-10 h-10 animate-spin text-slate-400" strokeWidth={2} />
										</div>
									) : redeemDetails ? (
										<div className="relative w-full aspect-[1.58/1] rounded-[24px] overflow-hidden shadow-2xl">
											{isCcsaCard(redeemCardNumberInput) ? (
												<>
													<IpfsImg src={ccsabackphoto} alt={tu('ccsa_card')} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
													<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.02)_38%,rgba(0,0,0,0.18)_100%)]" />
												</>
											) : (
												<>
													{/* 背景：优先使用 tier metadata 的 backgroundColor，无则用卡级，再则用默认渐变 */}
													{(() => {
														const bg = redeemCardTierMeta?.backgroundColor ?? redeemCardMetadata?.tiers?.[0]?.backgroundColor
														return (
															<div
																className="absolute inset-0"
																style={{
																	background: bg
																		? (bg.startsWith('#') ? bg : `#${bg.replace(/^#/, '')}`)
																		: 'linear-gradient(135deg,#1562f0_0%,#0d47a1_50%,#1562f0_100%)',
																}}
															/>
														)
													})()}
													{/* card image 显示在左上角：优先 tier，无则用卡级 */}
													{(redeemCardTierMeta?.image ?? redeemCardMetadata?.image) && (
														<div className="absolute top-4 left-4 w-14 h-14 rounded-xl overflow-hidden border border-white/20 shadow-lg z-10">
															<IpfsImg src={(redeemCardTierMeta?.image ?? redeemCardMetadata?.image) ?? ''} alt="" className="w-full h-full object-cover" draggable={false} />
														</div>
													)}
												</>
											)}
											<div className={`relative z-10 p-5 h-full flex flex-col justify-between ${!isCcsaCard(redeemCardNumberInput) && (redeemCardTierMeta?.image ?? redeemCardMetadata?.image) ? 'pl-[5.5rem]' : ''}`}>
												<div className="flex justify-between items-start">
													<div className="flex items-center gap-4">
														{!(redeemCardTierMeta?.image ?? redeemCardMetadata?.image) && (
															<div className="w-10 h-10 rounded-full grid place-items-center shrink-0 overflow-hidden" style={isCcsaCard(redeemCardNumberInput) ? { background: 'linear-gradient(135deg, #ffd65a 0%, #d19a00 100%)' } : { background: 'rgba(255,255,255,0.25)' }}>
																<CreditCard className="h-5 w-5 text-white" />
													</div>
														)}
														<div><div className="text-[18px] font-black tracking-wide text-white drop-shadow-sm font-serif">{isCcsaCard(redeemCardNumberInput) ? 'CCSA' : (redeemCardMetadata?.name ?? redeemDetails.cardName ?? 'User Card')}</div>{!isCcsaCard(redeemCardNumberInput) && redeemCardTierMeta?.name && <div className="text-[14px] font-semibold tracking-wide text-white/90 -mt-0.5">{redeemCardTierMeta.name}</div>}</div>
													</div>
												</div>
												<div>
													<p className="text-[10px] font-bold opacity-80 uppercase mb-0.5 text-white/90">Amount</p>
													<div className="flex items-baseline gap-1">
														<span className="text-3xl font-medium tracking-tighter text-white">{(() => {
															const pts = Number(redeemDetails.pointsHuman)
															const ptsPer1 = Number(redeemDetails.ptsPer1Currency)
															if (!ptsPer1) return formatAmount(pts, 'USDC', 4)
															const amt = pts / ptsPer1
															return formatAmount(amt, redeemDetails.currency as any, amt > 0 && amt < 0.01 ? 4 : undefined)
														})()}</span>
														<span className="text-sm font-semibold opacity-90 text-white">{redeemDetails.currency as string}</span>
													</div>
												</div>
											</div>
										</div>
									) : !redeemDetailsLoading && redeemCodeInput.trim() ? (
										<div className="relative w-full aspect-[1.58/1] rounded-[24px] overflow-hidden bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex flex-col items-center justify-center p-4">
											<Info className="w-10 h-10 text-amber-500 mb-2" strokeWidth={2} />
											<p className="text-sm font-medium text-amber-800 dark:text-amber-200 text-center">无法获取卡信息</p>
											<p className="text-xs text-amber-600 dark:text-amber-400 mt-1 text-center">请检查卡地址与兑换码，或稍后重试（RPC 可能限流）</p>
											<button
												type="button"
												onClick={() => setRedeemDetailsRetryKey((k) => k + 1)}
												className="mt-3 px-4 py-2 rounded-xl bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-sm font-semibold hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors flex items-center gap-2"
											>
												<RefreshCw className="w-4 h-4" strokeWidth={2} />
												重试
											</button>
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
								<summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">{tu('card_address_optional')}</summary>
								<input
									id="redeem-card-number"
									type="text"
									value={redeemCardNumberInput}
									onChange={(e) => setRedeemCardNumberInput(e.target.value)}
									placeholder="Leave empty for default CCSA card"
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
											let err = result.error ?? tu('redeem_failed_2')
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
										>{tu('cancel')}</button>
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
								onClose={() => {
									setTopUpRedeemOpen(false)
									setShowFooter(true)
									setCardRedeemsVersion((v) => v + 1)
								}}
								onSuccess={(newBatches?: CardRedeemBatch[]) => {
									refetchUserCards()
									if (newBatches && newBatches.length > 0) {
										pendingRedeemsFromSuccessRef.current = newBatches
										setCardRedeemsBatches(newBatches)
									}
									setCardRedeemsVersion((v) => v + 1)
								}}
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

				{/* Holder Topup：持有者（非发行方）Reload 打开充值流程 */}
				<div
					className={`fixed inset-0 z-[100] ${holderTopupOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
					aria-hidden={!holderTopupOpen}
				>
					<div
						className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${holderTopupOpen ? 'opacity-100' : 'opacity-0'}`}
						onClick={() => { setHolderTopupOpen(false); setHolderTopupCardAddress(null); setShowFooter(true) }}
					/>
					<div
						className={`absolute inset-x-0 bottom-0 bg-white dark:bg-slate-900 rounded-t-[22px] max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-hidden pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out ${holderTopupOpen ? 'translate-y-0' : 'translate-y-full'}`}
					>
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-500/70" />
						</div>
						<div className="px-4 pb-4 overflow-y-auto max-h-[calc(100dvh-60px)] flex flex-col">
							{holderTopupCardAddress ? (
								<USDCUserCardTopupControl
									cardAddress={holderTopupCardAddress}
									presetAmountEmpty
									onClose={(assets) => {
										setHolderTopupOpen(false)
										setHolderTopupCardAddress(null)
										setShowFooter(true)
										if (assets) refetchUserCards()
									}}
								/>
							) : null}
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
									batches={cardRedeemsBatches}
									refreshVersion={cardRedeemsVersion}
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
