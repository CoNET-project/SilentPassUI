import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
	Receipt,
	Globe,
} from 'lucide-react'
import { formatWithThousands } from '@/services/beamio'
import { fiatPrefix } from '@/services/currency'
import base_icon from '@/components/assets/base-logo.png'
import ccsabackphoto from '../Vouchers/assets/ccsacard.avif'

interface ActionButtonProps {
	icon: React.ReactNode
	label: string
	primary?: boolean
	onClick?: () => void
}

const ActionButton = ({ icon, label, primary = false, onClick }: ActionButtonProps) => (
	<button
		onClick={onClick}
		className={`flex flex-col items-center gap-3 py-4 rounded-2xl active:scale-95 transition-transform ${
			primary
				? 'bg-slate-900 text-white shadow-xl shadow-slate-200'
				: 'bg-gray-50 text-slate-900 hover:bg-gray-100'
		}`}
	>
		<div className={primary ? 'text-emerald-400' : 'text-slate-900'}>{icon}</div>
		<span className="text-xs font-bold">{label}</span>
	</button>
)

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

export default function MyWalletDashboardNew() {
	const navigate = useNavigate()
	const {
		profiles,
		myAddress,
		setMyAddress,
		usdcbalance,
		currencyData,
	} = useDaemonContext()

	const [activeView, setActiveView] = useState<string | null>(null) // 'eoa' | 'aa' | 'ccsa' | null
	const [aaAccountUsdcBalance, setAaAccountUsdcBalance] = useState<string>('0')
	const [ccsaBalance, setCcsaBalance] = useState<string>('0')
	const [reflash, setReflash] = useState(false)
	const [addressCopied, setAddressCopied] = useState<'eoa' | 'aa' | 'ccsa' | null>(null)
	const copyAddressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

	// 加载 AA 账户余额
	useEffect(() => {
		if (!profiles?.[0]?.aaAccount) {
			setAaAccountUsdcBalance('0')
			return
		}

		const loadAABalance = async () => {
			try {
				const usdcContract = new ethers.Contract(
					USDCContract_BASE,
					usdc_abi as ethers.InterfaceAbi,
					baseEndpoint
				)
				const balanceRaw = await usdcContract.balanceOf(profiles[0].aaAccount)
				const balance = ethers.formatUnits(balanceRaw, 6)
				setAaAccountUsdcBalance(balance)
			} catch (e) {
				console.warn('Failed to load AA balance', e)
				setAaAccountUsdcBalance('0')
			}
		}

		loadAABalance()
	}, [profiles])

	// 初始化 myAddress
	useEffect(() => {
		if (!profiles?.length) return
		const profile = profiles[0]
		const address = profile.keyID
		if (!myAddress) setMyAddress(address)
	}, [profiles, myAddress, setMyAddress])

	// 模拟 CCSA 余额（实际应该从服务获取）
	useEffect(() => {
		setCcsaBalance('120.00')
	}, [])

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

	useEffect(
		() => () => {
			if (copyAddressTimeoutRef.current) clearTimeout(copyAddressTimeoutRef.current)
		},
		[]
	)

	const reflashProcess = async () => {
		if (reflash) return
		setReflash(true)
		// 刷新逻辑可以在这里添加
		setTimeout(() => setReflash(false), 1000)
	}

	// 卡片数据
	const cards: Card[] = [
		{
			id: 'eoa',
			name: 'USDC on Base',
			balance: String(usdcbalance ?? 0),
			balanceFiat: balanceFiat,
			address: myAddress || '',
			gradient: 'bg-gradient-to-br from-[#1b6dff] via-[#6d3dff] to-[#f54b8b]',
			badge: 'Gas Sponsored',
			badgeIcon: <Sparkles size={10} className="text-amber-500" strokeWidth={2.2} />,
		},
		{
			id: 'aa',
			name: 'Express Pay',
			balance: aaAccountUsdcBalance,
			balanceFiat: aaBalanceFiat,
			address: profiles?.[0]?.aaAccount || '',
			gradient: 'bg-gradient-to-br from-purple-600 via-violet-500 to-fuchsia-500',
			badge: 'Gas Sponsored',
			badgeIcon: <Zap size={10} className="fill-yellow-300 text-yellow-300" />,
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

	const selectedCard = cards.find((c) => c.id === activeView)

	return (
		<div className="flex justify-center bg-gray-200 min-h-screen font-sans antialiased">
			<div className="w-full max-w-lg bg-[#F2F2F7] min-h-screen shadow-2xl overflow-hidden relative flex flex-col">
				{/* 未选中：显示 Header；选中：不占位，卡片+内容从容器顶部开始 */}
				{!activeView && (
					<header className="px-5 pt-14 pb-2 bg-[#F2F2F7]/90 backdrop-blur-md sticky top-0 z-30 shrink-0">
						<div className="flex justify-between items-center mb-1">
							<h1 className="text-[34px] font-bold text-black tracking-tight">My Wallet</h1>
						</div>
					</header>
				)}

				{/* Cards and Details Container - 选中时增加顶部 2rem 空间 */}
				<div className={`relative flex-1 min-h-0 flex flex-col transition-all duration-[600ms] cubic-bezier(0.19, 1, 0.22, 1) ${activeView ? 'pt-8' : ''}`}>
					{/* Scrollable Main Content */}
					<div className={`flex-1 min-h-0 pb-32 px-4 scroll-smooth relative no-scrollbar ${
						activeView ? 'overflow-hidden' : 'overflow-y-auto'
					}`}>
						{/* LAYER 1: MAIN WALLET (EOA) - 当选中其他卡片时折叠 */}
						<div
							onClick={() => handleCardClick('eoa')}
							className={`relative transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
								activeView && activeView !== 'eoa'
									? 'h-0 mb-0 opacity-0 overflow-hidden pointer-events-none z-40'
									: activeView === 'eoa'
									? 'opacity-100 translate-y-0 mb-6 z-[60]'
									: 'opacity-100 translate-y-0 mb-6 z-40'
						}`}
					>
							<h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1 flex items-center gap-1">
								Main Vault (EOA)
							</h2>
							<div
							className="relative w-full h-52 rounded-[24px] bg-gradient-to-br from-[#1b6dff] via-[#6d3dff] to-[#f54b8b] text-white shadow-lg overflow-hidden group transition-all duration-[600ms] cubic-bezier(0.19, 1, 0.22, 1)"
						>
							<div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-500 opacity-20 rounded-full blur-3xl pointer-events-none" />
							<div className="p-5 h-full flex flex-col justify-between relative z-10">
								<div className="flex justify-between items-start">
									<div className="flex items-center gap-2">
										<button
											type="button"
											className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/60 bg-white/20 backdrop-blur-sm transition hover:bg-white/30 active:scale-[0.95] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60 disabled:active:scale-100"
											onClick={(e) => {
												e.stopPropagation()
												reflashProcess()
											}}
											disabled={reflash}
											aria-label="Refresh"
										>
											<img
												src={base_icon}
												alt="Base"
												className={`w-5 h-5 object-contain ${reflash ? 'animate-spin opacity-80' : ''}`}
											/>
										</button>
										<span className="font-medium">USDC on Base</span>
									</div>
									<div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold flex items-center gap-1">
										<Sparkles size={10} className="text-amber-500" strokeWidth={2.2} />
										Gas Sponsored
									</div>
								</div>

								<div className="text-center mt-4">
									<div className="text-5xl font-bold tracking-tight tabular-nums">
										{formatWithThousands(usdcbalance || '0')}{' '}
										<span className="text-2xl font-normal opacity-80">USDC</span>
									</div>
									<div className="text-white/70 mt-1 text-sm tabular-nums">
										≈ {fiatPrefix('CAD')} {formatWithThousands(balanceFiat)}
									</div>
								</div>

								{/* 地址显示 */}
								{myAddress && (
									<div className="flex justify-start mt-auto">
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation()
												copyAddress(myAddress, 'eoa')
											}}
											className="flex items-center gap-1.5 px-3 py-1 bg-black/20 backdrop-blur-sm rounded-full text-xs font-mono text-white/90 cursor-pointer hover:bg-black/30 transition-colors"
										>
											{`${myAddress.slice(0, 6)}...${myAddress.slice(-4)}`}
											{addressCopied === 'eoa' ? (
												<Check size={10} className="text-emerald-400 shrink-0" />
											) : (
												<Copy size={10} />
											)}
										</button>
									</div>
								)}
							</div>
						</div>
						</div>

						{/* LAYER 2: EXPRESS PAY & CCSA STACK */}
						<div
							className={`relative perspective-1000 min-h-[400px] transition-transform duration-500 ${
								activeView === 'eoa' ? 'translate-y-[100px] opacity-50 blur-sm pointer-events-none' : ''
							}`}
						>
						<div className="flex justify-between items-center mb-3 ml-1">
							<h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
								{activeView === 'aa'
									? 'Express Pay'
									: activeView === 'ccsa'
									? 'CCSA Card'
									: 'Express Pay & Cards'}
							</h2>
						</div>

						<div className="relative transition-all duration-500">
							{cards
								.filter((c) => c.id !== 'eoa')
								.map((card, index) => {
									const isSelected = activeView === card.id

									// 计算卡片位置
									let top = index * 55
									if (activeView && activeView !== 'eoa') {
										top = isSelected ? 0 : 800
									} else if (activeView === 'eoa') {
										top = index * 30
									}

									// Express Pay 卡片 - 如果 AA 账户不存在，显示创建按钮
									if (card.id === 'aa' && !profiles?.[0]?.aaAccount) {
										return (
											<div
												key={card.id}
												className="absolute w-full h-52 rounded-[24px] text-white shadow-lg transition-all duration-[600ms] cubic-bezier(0.19, 1, 0.22, 1) bg-gradient-to-br from-slate-800 to-slate-900"
												style={{
													top: `${top}px`,
													zIndex: isSelected ? 60 : 50 - index,
													transform:
														activeView && activeView !== 'eoa' && !isSelected
															? 'scale(0.95)'
															: 'scale(1)',
													opacity: activeView && activeView !== 'eoa' && !isSelected ? 0 : 1,
												}}
											>
												<button
													type="button"
													onClick={() => navigate('/express')}
													className="relative w-full h-full p-6 flex flex-col justify-center items-center cursor-pointer overflow-hidden border-2 border-dashed border-slate-600 group hover:border-purple-400 transition-colors"
												>
													<div className="absolute inset-0 bg-purple-600/10 group-hover:bg-purple-600/20 transition-colors pointer-events-none" />
													<div className="z-10 bg-white/10 p-4 rounded-full mb-3 backdrop-blur-sm group-hover:scale-110 transition-transform">
														<Plus size={32} className="text-purple-300" />
													</div>
													<h3 className="text-xl font-bold z-10">Create Express Pay</h3>
													<p className="text-slate-400 text-sm mt-2 z-10 text-center px-8">
														Unlock gas-free payments & exclusive vouchers
													</p>
												</button>
											</div>
										)
									}

									// CCSA Card 特殊样式
									if (card.isCCSA) {
										return (
											<div
												key={card.id}
												onClick={() => handleCardClick(card.id)}
												className="absolute w-full h-52 rounded-[24px] text-white shadow-lg transition-all duration-[600ms] cubic-bezier(0.19, 1, 0.22, 1) overflow-hidden"
												style={{
													top: `${top}px`,
													zIndex: isSelected ? 60 : 50 - index,
													transform:
														activeView && activeView !== 'eoa' && !isSelected
															? 'scale(0.95)'
															: 'scale(1)',
													opacity: activeView && activeView !== 'eoa' && !isSelected ? 0 : 1,
												}}
											>
												{/* CCSA Background */}
												<img
													src={ccsabackphoto}
													alt="CCSA Card"
													className="absolute inset-0 h-full w-full object-cover"
													draggable={false}
												/>
												<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.02)_38%,rgba(0,0,0,0.18)_100%)]" />
												<div
													className="absolute inset-0 pointer-events-none"
													style={{
														boxShadow:
															'inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -30px 70px rgba(0,0,0,0.42)',
													}}
												/>

												<div className="p-5 h-full flex flex-col justify-between relative z-10">
													<div className="flex justify-between items-start">
														<div className="flex items-center gap-3">
															<div
																className="w-10 h-10 rounded-full grid place-items-center shrink-0"
																style={{
																	background: 'linear-gradient(135deg, #ffd65a 0%, #d19a00 100%)',
																	boxShadow:
																		'0 14px 30px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.38)',
																}}
															>
																<Globe className="h-5 w-5 text-white drop-shadow" />
															</div>
															<div>
																<div className="text-[18px] font-black tracking-wide text-[#fff2c6] drop-shadow-sm font-serif">
																	CCSA
																</div>
																<div className="text-[18px] font-black tracking-wide text-[#fff2c6] -mt-0.5 drop-shadow-sm font-serif">
																	CARD
																</div>
															</div>
														</div>
														<div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold flex items-center gap-1">
															<Globe size={10} className="text-white" />
															Membership
														</div>
													</div>

													<div className="flex justify-between items-end">
														<div>
															<p className="text-[10px] font-bold opacity-80 uppercase mb-0.5">Balance</p>
															<div className="flex items-baseline gap-1">
																<span className="text-3xl font-medium tracking-tighter text-[#fff2c6]">
																	{formatWithThousands(card.balance)}
																</span>
																<span className="text-sm font-semibold opacity-90 text-[#fff2c6]">CAD</span>
															</div>
														</div>
													</div>
												</div>
											</div>
										)
									}

									// Express Pay 卡片
									return (
										<div
											key={card.id}
											onClick={() => handleCardClick(card.id)}
											className={`absolute w-full h-52 rounded-[24px] text-white shadow-lg transition-all duration-[600ms] cubic-bezier(0.19, 1, 0.22, 1) ${card.gradient}`}
											style={{
												top: `${top}px`,
												zIndex: isSelected ? 60 : 50 - index,
												transform:
													activeView && activeView !== 'eoa' && !isSelected
														? 'scale(0.95)'
														: 'scale(1)',
												opacity: activeView && activeView !== 'eoa' && !isSelected ? 0 : 1,
											}}
										>
											<div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-500 opacity-20 rounded-full blur-3xl pointer-events-none" />
											<div className="p-5 h-full flex flex-col justify-between relative z-10">
												<div className="flex justify-between items-start">
													<div className="flex items-center gap-2">
														<button
															type="button"
															className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/60 bg-white/20 backdrop-blur-sm transition hover:bg-white/30 active:scale-[0.95] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60 disabled:active:scale-100"
															onClick={(e) => {
																e.stopPropagation()
																reflashProcess()
															}}
															disabled={reflash}
															aria-label="Refresh"
														>
															<img
																src={base_icon}
																alt="Base"
																className={`w-5 h-5 object-contain ${reflash ? 'animate-spin opacity-80' : ''}`}
															/>
														</button>
														<span className="font-medium">Express Pay</span>
													</div>
													<div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold flex items-center gap-1">
														<Zap size={10} className="fill-yellow-300 text-yellow-300" />
														Gas Sponsored
													</div>
												</div>

												<div className="text-center mt-4">
													<div className="text-5xl font-bold tracking-tight tabular-nums">
														{formatWithThousands(card.balance)}{' '}
														<span className="text-2xl font-normal opacity-80">USDC</span>
													</div>
													<div className="text-white/70 mt-1 text-sm tabular-nums">
														≈ {fiatPrefix('CAD')} {formatWithThousands(card.balanceFiat)}
													</div>
												</div>

												{/* 地址显示 */}
												{card.address && (
													<div className="flex justify-start mt-auto">
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation()
																copyAddress(card.address, 'aa')
															}}
															className="flex items-center gap-1.5 px-3 py-1 bg-black/20 backdrop-blur-sm rounded-full text-xs font-mono text-white/90 cursor-pointer hover:bg-black/30 transition-colors"
														>
															{`${card.address.slice(0, 6)}...${card.address.slice(-4)}`}
															{addressCopied === 'aa' ? (
																<Check size={10} className="text-emerald-400 shrink-0" />
															) : (
																<Copy size={10} />
															)}
														</button>
													</div>
												)}
											</div>
										</div>
									)
								})}
						</div>
						</div>
					</div>

					{/* DETAILS PANEL - 卡片详情面板，top 上移与卡片重叠（卡片 z 更高压住面板） */}
					<div
						className={`absolute inset-x-0 bottom-0 top-[14rem] bg-white rounded-t-[32px] transition-transform duration-[600ms] cubic-bezier(0.19, 1, 0.22, 1) z-40 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] ${
							activeView ? 'translate-y-0' : 'translate-y-[1000px]'
						}`}
					>
						<div className="px-6 pt-14 pb-4 border-b border-gray-50">
							<span className="text-sm font-bold text-gray-900">Card Details</span>
						</div>

						{/* Action Grid */}
						{selectedCard && (
							<>
								<div className="px-6 py-6 grid grid-cols-3 gap-4">
									<ActionButton
										icon={<ScanLine size={24} />}
										label="Pay / Redeem"
										primary={true}
										onClick={() => {
											// TODO: 实现支付功能
										}}
									/>
									<ActionButton
										icon={<Plus size={24} />}
										label="Top Up"
										primary={false}
										onClick={() => {
											// TODO: 实现充值功能
										}}
									/>
									<ActionButton
										icon={<Receipt size={24} />}
										label="Receipts"
										primary={false}
										onClick={() => {
											// TODO: 实现收据查看
										}}
									/>
								</div>

								<div className="flex-1 overflow-y-auto px-6 pb-24">
									<h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
										Activity Log
									</h4>
									<div className="space-y-2">
										<p className="text-xs text-gray-400 italic text-center py-4">
											No recent activity.
										</p>
									</div>
								</div>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
