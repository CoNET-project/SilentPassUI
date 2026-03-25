// Home.tsx

import { useEffect, useRef, useState, useMemo, useLayoutEffect } from "react"
import { useScrollCapsuleOpacity } from "@/hooks/useScrollCapsuleOpacity"
import { createPortal } from 'react-dom';
import { useDaemonContext } from "@/providers/DaemonProvider"
import {formatAmountReadable, formatWithThousands, getBalanceProcess, onWalletEvent, getUserInfo, searchUsername} from '@/services/beamio'
import base_icon from '@/components/assets/base-logo.png'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { useNavigate } from "react-router-dom"
import { createOrGetWallet, storeSystemData, postBeamio} from "@/services/beamio"
import BeamioAlphaHowItWorks from './BeamioAlphaHowItWorks'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import BeamioLearnHowItWorksCard from './BeamioLearnHowItWorksCard'
import BeamioAlphaDropConfirm from './BeamioAlphaDropConfirm'
import BeamioTestBalanceDetailsCard from './BeamioTestBalanceDetailsCard'
import {motion, AnimatePresence } from "framer-motion"
import { Settings, Check, ArrowDownCircle, PlusCircle , X, Zap, Shield, Clock, Sparkles, Wallet, Circle, RefreshCw, BadgeCheck, Plus, Send, QrCode, Store, Radio, CreditCard, Loader2, Copy, Info } 
	from "lucide-react"
import OnrampOfframpGuide from './OnrampOfframpGuide'
import BeamioSearch from './BeamioSearch'
import CoinbaseRamps from '@/components/Setting/CoinbaseRamps'
import BeamioAddUSDCFlow from '@/components/addUSDC/BeamioAddUSDCFlow'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import PayScreen from '@/pages/Pay/send'

import { ethers } from 'ethers'
import { QRCodeCanvas } from 'qrcode.react'
import bIcon from '@/components/assets/logo512.png'
import { baseEndpoint } from '@/utils/constants'
import beamioConetCoreABI from '@/services/ABI/beamioConetCoreABI.json'
import { getAAAccount, getMyAssets, getMyAssetsAggregated, getBUnitBalanceOnConet } from '@/services/BeamioCard'
import { BEAMIO_USER_CARD_ASSET_ADDRESS } from '@/config/chainAddresses'
import ActiveHistoryPannelNew from '@/pages/History/components/activeHistoryPannelNew'
import BeamioContactProfilePreview from './BeamioContactProfilePreview'
import {BeamioBetaAccess} from './components/BeamioBetaAccess'
import {TransactionsItemDetail} from '@/pages/History/TransactionsItemDetail'
import BeamioPayMe from '@/pages/Pay/BeamioPayMe'
import BankingBridge from '@/pages/History/components/BankingBridge'
import FuelView from './FuelView'
import ShowPayQR from '@/pages/Vouchers/showPayQR'
import { signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen, type OpenContainerRelayPayload } from '@/services/AAaccount'



const getImg = (avatarSeed: string|undefined) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed||'@Beamio').toString()}`
const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

/** beamio 表示 name 的 protocol，与 ChatList displayName 一致。兼容 beamio 与 searchResult 两种类型 */
const displayName = (item: beamio | searchResult | null | undefined) => {
	if (!item) return ''
	const first = 'first_name' in item ? item.first_name : (item as beamio).firstName ?? ''
	const lastRaw = 'last_name' in item ? item.last_name : (item as beamio).lastName ?? ''
	const lastname = String(lastRaw || '').split('\r\n') || []
	const fullName = `${first || ''} ${/^\{/.test(lastname[0] || '') ? '' : lastname[0] || ''}`.trim()
	return fullName || (item as beamio).accountName || (item as searchResult).username || (item as beamio).address || (item as searchResult).address || ''
}

const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })




const Home = ({}) => {
	const { setDarkModle, profiles,
		power, setProfiles, setBeamio, setPaymentLink, setSecureCode,  secureCode, ignoreUrl, setMyAddress, myAddress, beamio, setCurrencyData,
		setPayTag, setSendToMemo, setUsdcbalance, listenningProcess, setListenningProcess, setUsdcToUSD, usdcToUSD, usdcbalance, setPaymentLinkCode,
		currencyData, setRedeemCode, setPayMePayment, setAllNodes, setGossip, gossip, setCharts, charts, setShowFooter, scanData, setScanData
	} = useDaemonContext()
	const navigate = useNavigate()
	  const [settingsOpen, setSettingsOpen] = useState<''|'BeamioBetaAccess'|'Pay'>('')
	
	const [avatarName, setAvatarName] = useState('')
	const [processing, setProcessing] = useState(false)
	const [showGetFaucet, setShowGetFaucet] = useState<'Faucet'|'finished'|'sameIP'>('Faucet')
	const [show200OK, setShow200OK] = useState(false)
	const [showLinkPay, setShowLinkPay] = useState(false)
	const [code, setCode] = useState('')
	const [amt, setAmt] = useState('')
	const [recipient, setRecipient] = useState('')
	const [claimLoading, setClaimLoading] = useState(false)
	const [currency, setCurrency] = useState<ICurrency>('USD')
	const [language, setLanguage] = useState<"en">("en")
	const [userPreviewItem, setUserPreviewItem] = useState<searchResult|null>()
	const [openSearch, setOpenSearch]= useState(false)
	const [reflash, setReflash] = useState(false)
	const [itemTx, setItemtx] = useState<TransferHistork>()
	const [ccsaAssets, setCcsaAssets] = useState<Awaited<ReturnType<typeof getMyAssetsAggregated>> | null>(null)
	const [bUnitBalance, setBUnitBalance] = useState<{ total: number; free: number; paid: number } | null>(null)



	const [activeItems, setActiveItems] = useState<TransferHistork[]>([])

	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<'BeamioAlphaHowItWorks'|'BeamioLearnHowItWorksCard'|'Pay'|'TransactionsItemDetail'|
		''|'BeamioAlphaDropConfirm'|'BeamioTestBalance'|'OnrampOfframpGuide'|'Search'|'BeamioContactProfilePreview'|'CoinbaseRamps'|'PayMe'>('')
	const [showPayMeSheet, setShowPayMeSheet] = useState(false)
	/** Home Pay/Receive 底栏（对齐 renderAction Pay|Receive 交互） */
	const [showPayReceiveSheet, setShowPayReceiveSheet] = useState(false)
	const [payReceiveQrMode, setPayReceiveQrMode] = useState<'pay' | 'receive'>('receive')
	/** Pay 模式：与 MyWalletDashboardNew AA relay QR 同源（OpenContainer relay 签名 JSON） */
	const [payRelayQRPayload, setPayRelayQRPayload] = useState<OpenContainerRelayPayload | null>(null)
	const [payRelayQRLoading, setPayRelayQRLoading] = useState(false)
	const [showAddCashSheet, setShowAddCashSheet] = useState(false)
	const [showFuelView, setShowFuelView] = useState(false)
	/** Add Cash 后：底部 sheet 内显示 Coinbase 确认 (204-221)，非全屏 */
	const [showAddUsdcInSheet, setShowAddUsdcInSheet] = useState(false)
	const [aaAddrCopied, setAaAddrCopied] = useState(false)
	/** CashTrees 卡点击：AA USDC + 基础设施卡 points（token #0 口径，与 getMyAssets 一致） */
	const [showCashTreesBalanceDetails, setShowCashTreesBalanceDetails] = useState(false)
	const [cashTreesBalanceLoading, setCashTreesBalanceLoading] = useState(false)
	const [cashTreesBalanceError, setCashTreesBalanceError] = useState<string | null>(null)
	const [cashTreesSheetAaUsdc, setCashTreesSheetAaUsdc] = useState<string | null>(null)
	const [cashTreesSheetPoints0, setCashTreesSheetPoints0] = useState<string | null>(null)
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(!openSearch)

	/** 链上 / 本地已存在与 EOA 不同的 Smart Account 地址时视为已激活 AA */
	const hasAAWallet = useMemo(() => {
		const aa = profiles?.[0]?.aaAccount
		if (!aa || typeof aa !== 'string' || aa.length < 4) return false
		const eoa = (profiles?.[0]?.keyID || '').toLowerCase()
		return aa.toLowerCase() !== eoa
	}, [profiles?.[0]?.aaAccount, profiles?.[0]?.keyID])

	const eoaAddressShort = profiles?.[0]?.keyID ? fmtAddr(profiles[0].keyID) : '—'
	/** 已登录 EOA、尚未部署 AA 时在首页展示激活引导（与 renderAction Activate Wallet 对齐） */
	const showActivateWalletPanel = Boolean(profiles?.[0]?.keyID) && !hasAAWallet

	/** 与 BeamioPayMe `successUrl` 在 EOA 模式下一致：任意金额收款链接，wallet=EOA */
	const activateWalletEoaQrValue = useMemo(() => {
		if (!beamio?.accountName) return ''
		const params = new URLSearchParams({ beamio: beamio.accountName })
		const walletAddr =
			myAddress && ethers.isAddress(myAddress)
				? myAddress
				: profiles?.[0]?.keyID && ethers.isAddress(profiles[0].keyID)
					? profiles[0].keyID
					: null
		if (walletAddr) params.set('wallet', walletAddr)
		return `https://beamio.app?${params.toString()}`
	}, [beamio?.accountName, myAddress, profiles?.[0]?.keyID])

	/** Activate Wallet 引导展示期间隐藏全局 Footer（与 Pay/Receive 等底栏一致） */
	useEffect(() => {
		if (!showActivateWalletPanel) return
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [showActivateWalletPanel, setShowFooter])

	const avatarUrl = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(
		avatarName
	)}`


	const getAccountData = (bo: beamio) => {
		if (!bo) return
		setCurrency(bo.currency)
		setLanguage(bo.language)
	}

	const storee = async () => {
		const temp = CoNET_Data
		if (!temp || !profiles ) {
			return
		}

		const bo: beamio = temp?.beamio || await getUserInfo(profiles[0].keyID)
		bo.isUSDCFaucet = true
		setBeamio ({...bo})
		temp.beamio = bo
		setCoNET_Data(temp)
		storeSystemData()

	}

	const reflashProcess = async () => {
		if (reflash) return
		const profile: profile = profiles?.[0]
		if (!profile) return
		setReflash(true)

		await getBalanceProcess(profile.keyID, setUsdcbalance, setUsdcToUSD)
		getMyAssetsAggregated(profile)
			.then(setCcsaAssets)
			.catch(() => setCcsaAssets(null))
		getBUnitBalanceOnConet(profile.keyID)
			.then(setBUnitBalance)
			.catch(() => setBUnitBalance(null))
		setReflash(false)
	}

	const handleSaveAvatar = async (curr: ICurrency) => {
		if (!CoNET_Data||!beamio ) return
		
		const tmpData = CoNET_Data
		
		const profile: profile = tmpData.profiles[0]
		const bo = beamio
		bo.currency = curr
		await postBeamio(bo, profile.privateKeyArmor)

		tmpData.beamio = bo
		setCoNET_Data(tmpData)
		
		await storeSystemData()
		setBeamio({...bo})

	}

	const init = async () => {
		const temp = CoNET_Data
		if (!temp || !profiles?.length) {
			return
		}
		const profile: profile = profiles[0]
		if (!profile) return
		// 以当前 AA Factory（config 中 0xFD48...）的链上结果为唯一依据，覆盖本地 aaAccount，避免显示旧 Factory 的地址
		try {
			const chainAa = await getAAAccount(profile)
			const nextAa = chainAa ?? undefined
			const currentAa = profile.aaAccount?.toLowerCase()
			if (currentAa !== (nextAa?.toLowerCase() ?? '')) {
				const nextProfiles = profiles.map((p: profile, i: number) => i === 0 ? { ...p, aaAccount: nextAa } : p)
				setProfiles(nextProfiles)
				if (temp.profiles) temp.profiles = nextProfiles
				setCoNET_Data(temp)
				await storeSystemData()
			}
		} catch {
			// 网络失败时再校验：若本地是 EOA 或无 code 则清除
			if (profile.aaAccount) {
				try {
					const code = await baseEndpoint.getCode(profile.aaAccount)
					const isEOA = profile.keyID && profile.aaAccount.toLowerCase() === profile.keyID.toLowerCase()
					if (!code || code === '0x' || code.length <= 2 || isEOA) {
						const nextProfiles = profiles.map((p: profile, i: number) => i === 0 ? { ...p, aaAccount: undefined } : p)
						setProfiles(nextProfiles)
						if (temp.profiles) temp.profiles = nextProfiles
						setCoNET_Data(temp)
						await storeSystemData()
					}
				} catch {
					// 忽略
				}
			}
		}
		reflashProcess()
		// 拉取 CCSA + beamioUserCard 聚合资产（延迟执行，避免首屏阻塞）
		setTimeout(() => {
			getMyAssetsAggregated(profile)
				.then(setCcsaAssets)
				.catch(() => setCcsaAssets(null))
		}, 150)
		const bo: beamio = temp?.beamio || await getUserInfo(profile.keyID)

		if (!bo) return

		bo.initialLoading = true
		
		
		if (bo.isUSDCFaucet) {
			setShowGetFaucet('finished')
		} else {
			setShowGetFaucet('Faucet')
		}
		
		await postBeamio(bo, profile.privateKeyArmor)
		setDarkModle(bo.darkTheme)
		setBeamio ({...bo})
		temp.beamio = bo
		getAccountData(bo)
		setCoNET_Data(temp)
		storeSystemData()
		
		
		setMyAddress (profile.keyID)
		
		
		if (ignoreUrl) {
			return
		}
		//checkUrl(window.location.href)
  	}

  	const firStartRef = useRef<boolean>(false)




  	useEffect(() => {
		setShowFooter(true)
		if (firStartRef.current) {
			return
		}
		
		firStartRef.current = true
		init()

				// 只在挂载时注册一次
		// const off = onWalletEvent("scan:url", (url: string) => {
		// 	if (/^0x/i.test(url)) {
		// 		setPaymentLink({code: '', note: '', address: url, amount: ''})
				
		// 		setSendToMemo(url)
		// 		navigate('/Pay')
		// 		return 
		// 	}
		// 	checkUrl(url)
		// })
				// 卸载时把监听取消，避免旧实例继续吃事件
		// return () => {
		// 	if (typeof off === 'function') off()
		// }

  	}, [])

	/** profiles 可用时刷新 B-Unit 余额（init 可能早于 profiles 加载完成） */
	useEffect(() => {
		if (profiles?.length && profiles[0]?.keyID) {
			reflashProcess()
		}
	}, [profiles?.length, profiles?.[0]?.keyID])



	/** 常见币种相对 USD 的 fallback 汇率（1 USD = X 该币种），用于 currencyData 未加载时 */
	const FALLBACK_RATES: Record<string, number> = { USD: 1, CAD: 1.35, JPY: 150, EUR: 0.92, CNY: 7.2, HKD: 7.8, TWD: 31, SGD: 1.35 }

	/**
	 * @returns 1 USDC ≈ X {currency}
	 */
	function fxRateUSDCToCurrency(currency: ICurrency): number {
		const usdcToUSD = (currencyData.USDC ?? 1) || 1
		if (currency === 'USD') return usdcToUSD
		const raw = (currencyData as Record<string, number>)[currency] ?? FALLBACK_RATES[currency] ?? 1
		const rate = usdcToUSD * (raw || (FALLBACK_RATES[currency] ?? 1))
		return rate > 0 ? rate : (FALLBACK_RATES[currency] ?? 1)
	}

	function formatFiat() {
		// 1 USDC ≈ X {currency}
		const rate = fxRateUSDCToCurrency(currency)

		// 目标币种金额
		const v = currency === 'USDC' ? usdcbalance : usdcbalance * rate

		switch (currency) {
			case 'EUR': {
				// 欧元
				return `€ ${formatWithThousands(v, 2)}`
			}

			case 'TWD': {
				// 新台币（更通用写法）
				return `NT$ ${formatWithThousands(v, 2)}`
			}

			case 'SGD': {
				return `SG$ ${formatWithThousands(v, 2)}`
			}

			case 'HKD': {
				return `HK$ ${formatWithThousands(v, 2)}`
			}

			case 'JPY':
				// 日元无小数
				return `JP¥ ${formatWithThousands(v, 0)}`

			case 'CNY':
				// 人民币
				return `RMB¥ ${formatWithThousands(v, 2)}`

			case 'CAD':
				return `CA$ ${formatWithThousands(v, 2)}`

			case 'USDC':
				// USDC 是 token，不是法币
				return `${formatWithThousands(usdcbalance)} USDC`

			case 'USD':
			default:
				return `US$ ${formatWithThousands(v, 2)}`
		}
	}

	/** 用于 exampleExpress 风格的大数字拆分展示。合计：EOA USDC + AA USDC + CCSA 卡余额，转换为用户设定的 currency */
	function getValuationParts(): { symbol: string; whole: string; decimal: string } {
		// 1) EOA USDC 转换为目标币种
		const usdcRate = fxRateUSDCToCurrency(currency)
		const eoaValue = currency === 'USDC' ? usdcbalance : usdcbalance * usdcRate

		// 2) AA 账号 USDC（getMyAssets 返回，与 EOA 分开）
		const aaUsdc = Number(ccsaAssets?.usdcBalance ?? 0)
		const aaValue = currency === 'USDC' ? aaUsdc : aaUsdc * usdcRate

		// 3) CCSA 积分按卡币种计价，转换为目标币种。CCSA 卡币种通常为 CAD
		const ccsaPoints = Number(ccsaAssets?.points ?? 0)
		const ccsaCurrency = ccsaAssets?.cardCurrency ?? 'CAD'
		let ccsaValue = 0
		if (ccsaCurrency === 'USDC') {
			// 卡币种为 USDC 时，直接按 USDC→目标币种折算
			ccsaValue = currency === 'USDC' ? ccsaPoints : ccsaPoints * usdcRate
		} else {
			// 卡币种为法币（如 CAD）：1 ccsaCurrency = ? target 货币
			// 公式：targetPerCcsa = (1 USD = X target) / (1 USD = Y ccsaCurrency) = X/Y
			const targetPerUsd = (currencyData as Record<string, number>)[currency] ?? (currency === 'USD' ? 1 : 0)
			const ccsaPerUsd = (currencyData as Record<string, number>)[ccsaCurrency] ?? (ccsaCurrency === 'CAD' ? 1.35 : 1)
			const ccsaRate = ccsaPerUsd > 0 ? targetPerUsd / ccsaPerUsd : 0
			ccsaValue = ccsaPoints * ccsaRate
		}

		const total = eoaValue + aaValue + ccsaValue
		const fixed = currency === 'JPY' ? 0 : 2
		const formatted = formatWithThousands(total, fixed)
		const [whole = '0', dec = fixed === 0 ? '00' : '00'] = formatted.split('.')
		let symbol = '$'
		switch (currency) {
			case 'EUR': symbol = '€'; break
			case 'TWD': symbol = 'NT$'; break
			case 'SGD': symbol = 'SG$'; break
			case 'HKD': symbol = 'HK$'; break
			case 'JPY': symbol = 'JP¥'; break
			case 'CNY': symbol = 'RMB¥'; break
			case 'CAD': symbol = 'CA$'; break
			case 'USD': symbol = 'US$'; break
			case 'USDC': symbol = ''; break
			default: symbol = 'US$'
		}
		return { symbol: symbol || '', whole, decimal: dec }
	}

	const claimFaucet = async () => {
		setShowAlphaHowItWorks('BeamioAlphaDropConfirm')
	}

	const handleCashOut = () => {
		setShowAlphaHowItWorks('CoinbaseRamps')
	}

	const handleAddFunds = () => {
		setShowAddCashSheet(true)
		setShowFooter(false)
	}

	/** 余额卡：白底 + 渐变描边 */
	function BalanceCard() {
		const [showSetup, setShowSetup] = useState(false)

		// 🔁 用你真实的 currency state 替换

		const options = useMemo(
			() => [
				{ value: 'USD' as const, label: 'USD', hint: 'US Dollar' },
				{ value: 'CAD' as const, label: 'CAD', hint: 'Canadian Dollar' },
				{ value: 'EUR' as const, label: 'EUR', hint: 'Euro' },                 // 👈 欧元
				{ value: 'JPY' as const, label: 'JPY', hint: 'Japanese Yen' },
				{ value: 'CNY' as const, label: 'CNY', hint: 'Chinese Yuan' },
				{ value: 'HKD' as const, label: 'HKD', hint: 'Hong Kong Dollar' },     // 👈 港币
				{ value: 'TWD' as const, label: 'TWD', hint: 'New Taiwan Dollar' },    // 👈 台币
				{ value: 'SGD' as const, label: 'SGD', hint: 'Singapore Dollar' },     // 👈 新加坡币
			],
			[]
		)

		const closeSetup = () => setShowSetup(false)

		const chooseCurrency = (v: ICurrency) => {

			setCurrency(v)
			// handleSaveAvatar(v)
			// 轻微延迟，保证点击反馈先出现
			setTimeout(() => setShowSetup(false), 80)
			
		}

		return (
			<div className="rounded-3xl bg-gradient-to-br from-[#1b6dff] via-[#6d3dff] to-[#f54b8b] p-4 shadow-lg mb-4 overflow-hidden">
				{/* 顶部：标题 + Base 标识 */}
				<div className="flex items-center justify-between mb-4 w-full max-w-[640px] px-4">
					<div className="text-xs font-medium text-white/80">
						Beamio Balance
					</div>

					<div className="flex items-center gap-1 text-white">
						
						<button
							type="button"
							className="
								inline-flex items-center justify-center
								w-7 h-7
								rounded-full
								border border-white/60
								bg-transparent
								transition
								hover:bg-white/10
								active:scale-[0.95]
								focus:outline-none
								focus-visible:ring-2
								focus-visible:ring-white/40
							"
							onClick={reflashProcess}
							disabled={reflash}
						>
							<img
								src={base_icon}
								alt="Base"
								className={[
									"w-5 h-5 object-contain",
									reflash ? "animate-spin opacity-80" : ""
								].join(" ")}
							/>
						</button>
						<span className="text-[15px] font-medium tracking-wide">
							USDC on Base
						</span>
					</div>
				</div>

				{/* 固定高度视口 */}
				<div className="relative">
					<div
						className={`
							flex w-[200%] h-full
							transition-transform duration-300 ease-out
							${showSetup ? '-translate-x-1/2' : 'translate-x-0'}
						`}
					>
						{/* ===== Page A：主内容 ===== */}
						<div className="w-1/2 h-full flex justify-center">
  							<div className="w-full max-w-[640px] px-4 mb-2">
							{/* 金额 + Setup（右侧） */}
							<div className="mb-4 flex items-center justify-between">
								<div>
									<button
										type="button"
										className="
											inline-flex
											items-center
											rounded-full          /* ⭐ 半圆 / 胶囊 */
											border border-white/30
											bg-white/0
											px-4 py-2
											text-left
											transition
											hover:bg-white/10
											active:scale-[0.98]
											focus:outline-none
											focus-visible:ring-2
											focus-visible:ring-white/40
										"
										onClick={() => setShowSetup(true)}
									>
										<div className="text-3xl font-semibold text-white tabular-nums leading-tight">
											{formatFiat()}
										</div>
									</button>

									<div className="mt-1 flex items-center text-[16px] text-white/80">
										<div className="relative mr-2 flex-shrink-0">
											<img
												src={usdcIcon}
												alt="USDC"
												className="w-5 h-5 rounded-full"
											/>
											<img
												src={baseIcon}
												alt="Base"
												className="
													w-3 h-3
													absolute -bottom-0.5 -right-0.5
													rounded-full
													border border-white dark:border-slate-900
												"
											/>
										</div>
										<span>
											{usdcbalance.toFixed(4)}
										</span>
									</div>
								</div>

								
							</div>

							{/* Gas sponsored */}
							<div className="flex justify-end mb-4">
								<div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-sm">
									<Sparkles
										className="w-4 h-4 text-amber-500"
										strokeWidth={2.2}
									/>
									<span className="text-[11px] font-medium text-white">
										Gas sponsored
									</span>
								</div>
							</div>

							{/* 操作按钮 */}
							<div className="flex items-center gap-2 mt-1">
								<button
									type="button"
									onClick={handleAddFunds}
									className="
										flex-1 flex items-center justify-center gap-1.5
										py-3 rounded-full
										bg-white/15
										text-[10px] font-medium text-white
										hover:bg-white/20 transition
									"
								>
									<PlusCircle className="h-4 w-4 text-white/90" />
									<span>Add funds</span>
								</button>

								<button
									type="button"
									onClick={handleCashOut}
									className="
										flex-1 flex items-center justify-center gap-1.5
										py-3 rounded-full
										bg-white/10
										text-[10px] font-medium text-white
										hover:bg-white/15 transition
									"
								>
									<ArrowDownCircle className="h-4 w-4 text-white/90" />
									<span>Cash out</span>
								</button>
							</div>
						</div>
						</div>

						{/* ===== Page B：Setup ===== */}
						{
							showSetup && <div className="w-1/2 px-4 overflow-y-auto h-[170px]" data-ignore-footer-scroll="1">
							

							<div className="space-y-2">
								{[
									// ⭐ 已选中的永远放第一
									...options.filter(opt => opt.value === currency),
									// 其余的保持原顺序
									...options.filter(opt => opt.value !== currency),
								].map(opt => {
									const active = currency === opt.value

									return (
										<button
											key={opt.value}
											type="button"
											onClick={() => chooseCurrency(opt.value)}
											className={`
												w-full flex items-center justify-between
												rounded-xl px-3 py-1.5
												backdrop-blur
												transition
												${active
													? 'bg-white/25'
													: 'bg-white/12 hover:bg-white/18'}
											`}
										>
											<div className="text-left">
												<div className="text-[12px] font-semibold text-white">
													{opt.label}
												</div>
												<div className="text-[11px] leading-tight text-white/75">
													{opt.hint}
												</div>
											</div>

											<div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10">
												{active ? (
													<Check className="w-4 h-4 text-white" />
												) : (
													<span className="text-[11px] text-white/70">
														{opt.value}
													</span>
												)}
											</div>
										</button>
									)
								})}
							</div>
						</div>
						}
						
					</div>
				</div>
			</div>
		)
	}

	const ButtonArea = () => {
		return (
			<div className="flex gap-3 mt-4">
				<button
					className="flex-1 h-9 rounded-full bg-white text-sm font-semibold text-blue-600 shadow-md"
					onClick={() => {
						setShowAlphaHowItWorks('Pay')
					}}
				>
					Send
				</button>
				<button
					className="flex-1 h-9 rounded-full border border-blue-600 text-sm font-semibold text-blue-600 bg-white/10 shadow-md"
					onClick={() => {
						setPayTag('request')
						navigate('/Pay')
					}}
				>
					Request
				</button>
			</div>	
		)
	}

	const Claim02Pannel = () => {
		return (
			<section className="mb-4">
				<div className="rounded-3xl bg-gradient-to-r from-[#ff8a3c] via-[#f7478f] to-[#8b5cf6] px-5 py-4 text-white shadow-md">
					<div className="flex items-center gap-2">
					<span className="text-lg">🔥</span>
					<div className="flex flex-col">
						<span className="text-sm font-semibold mb-1">
							0.2 USDC added to your wallet
						</span>
						<span className="text-xs text-white/90 mb-4">
							Use this to try a few small test transfers with friends or family. For everyday payments, you can add more USDC later.
						</span>
					</div>
					</div>
					<div className="flex flex-wrap gap-2 mt-1">
					<button className="flex-1 h-9 rounded-full border border-white/60 text-xs font-medium bg-white/10"
						onClick={() => {
							setShowAlphaHowItWorks('Search')
						}}
					>
						Start a payment
					</button>
					<button className="flex-1 h-9 rounded-full bg-white text-xs font-semibold text-orange-500"
						onClick={() => {
							setShowAlphaHowItWorks('BeamioTestBalance')
						}}
					>
						About this 0.2 USDC
					</button>
					</div>
				</div>
			</section>
		)
	}

	useEffect(() => {

		if (!showLinkPay) {
			return
		}
		
		if (recipient && !power) {
			navigate('/Pay')
			return
		}

		if ((secureCode || (amt && code && recipient)) && !power) {
			navigate('/Browser')
			return
		}

	
	}, [showLinkPay])


	/** Home 主视觉：浅灰底 + 青柠强调（与产品 mock 对齐） */
	const homeAccent = '#7ED321'

	const userBeamioTagDisplay = useMemo(
		() => `@${(beamio?.accountName || '').replace(/^@/, '') || 'beamio'}`,
		[beamio?.accountName]
	)

	/** CashTrees 卡片区：AA 短地址、USDC 总余额展示（与 renderAction home 一致） */
	const cashTreesCardDisplay = useMemo(() => {
		const aaFull = (profiles?.[0]?.aaAccount ?? '').trim()
		const n = Number(usdcbalance)
		const safe = Number.isFinite(n) ? Math.max(0, n) : 0
		const [whole, frac = '00'] = safe.toFixed(2).split('.')
		// 实体 NFC 绑定状态暂无单一链上字段；未接 NFC 旗标前与 renderAction 默认一致（Virtual + Bind）
		return { aaFull, aaShort: fmtAddr(aaFull), whole, frac, isPhysicalCardBound: false }
	}, [profiles?.[0]?.aaAccount, usdcbalance])

	const copyCashTreesAaAddress = async () => {
		if (!cashTreesCardDisplay.aaFull) return
		try {
			await navigator.clipboard.writeText(cashTreesCardDisplay.aaFull)
			setAaAddrCopied(true)
			window.setTimeout(() => setAaAddrCopied(false), 2000)
		} catch {
			// ignore
		}
	}

	const openCashTreesBalanceSheet = () => {
		setShowCashTreesBalanceDetails(true)
		setShowFooter(false)
	}

	const closeCashTreesBalanceSheet = () => {
		setShowCashTreesBalanceDetails(false)
		setShowFooter(true)
		setCashTreesBalanceError(null)
	}

	const formatCashTreesUsd2 = (raw: string | null | undefined) => {
		const n = Number(raw ?? '')
		if (!Number.isFinite(n)) return '—'
		return `$${n.toFixed(2)}`
	}

	useEffect(() => {
		if (!showCashTreesBalanceDetails || !profiles?.[0]) return
		const profile = profiles[0]
		let cancelled = false
		setCashTreesBalanceLoading(true)
		setCashTreesBalanceError(null)
		setCashTreesSheetAaUsdc(null)
		setCashTreesSheetPoints0(null)
		getMyAssets(profile, BEAMIO_USER_CARD_ASSET_ADDRESS)
			.then((res) => {
				if (cancelled) return
				setCashTreesSheetAaUsdc(res?.usdcBalance ?? '0')
				setCashTreesSheetPoints0(res?.points ?? '0')
			})
			.catch((e: unknown) => {
				if (!cancelled) setCashTreesBalanceError(e instanceof Error ? e.message : 'Failed to load balances')
			})
			.finally(() => {
				if (!cancelled) setCashTreesBalanceLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [showCashTreesBalanceDetails, profiles?.[0]?.keyID])

	const closePayReceiveSheet = () => {
		setShowPayReceiveSheet(false)
		setPayReceiveQrMode('receive')
		setPayRelayQRPayload(null)
		setPayRelayQRLoading(false)
		setShowFooter(true)
	}

	/** Pay tab：生成 / 每分钟刷新 Open Relay QR（与 MyWalletDashboardNew handleAaRelayQR 一致） */
	useEffect(() => {
		if (!showPayReceiveSheet || payReceiveQrMode !== 'pay') return
		const profile = profiles?.[0]
		if (!profile?.privateKeyArmor || !profile?.aaAccount) {
			setPayRelayQRPayload(null)
			setPayRelayQRLoading(false)
			return
		}
		let cancelled = false
		let intervalId: number | undefined

		const signOnce = async (isInitial: boolean) => {
			if (isInitial) {
				setPayRelayQRLoading(true)
				setPayRelayQRPayload(null)
			}
			try {
				const payload = await signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen(
					{ privateKeyArmor: profile.privateKeyArmor, aaAccount: profile.aaAccount },
					'0',
					{ deadlineSeconds: 300 }
				)
				if (!cancelled) setPayRelayQRPayload(payload)
			} catch (e) {
				console.error('[Home] signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen failed:', e)
				if (isInitial && !cancelled) setPayRelayQRPayload(null)
			} finally {
				if (isInitial && !cancelled) setPayRelayQRLoading(false)
			}
		}

		void signOnce(true)
		intervalId = window.setInterval(() => void signOnce(false), 60_000)

		return () => {
			cancelled = true
			if (intervalId) clearInterval(intervalId)
			setPayRelayQRPayload(null)
			setPayRelayQRLoading(false)
		}
	}, [showPayReceiveSheet, payReceiveQrMode, profiles?.[0]?.privateKeyArmor, profiles?.[0]?.aaAccount])

	/** Android WebView：Activate 场景下外层 overflow-hidden + flex 常导致滚动视口高度塌成一条；改为单层 flex 链并写死 flex-basis */
	const homeScrollUsesSingleFlexChain = showActivateWalletPanel && !openSearch

	return (
		<div
			className="
		box-border flex h-full min-h-[100vh] w-full flex-col bg-[#F1F8ED] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] text-slate-900
		"
		>
			{/* <div className="px-5 pt-6 flex flex-col gap-2">
				<button
					type="button"
							className={styles.headerBtn}
							aria-label="Toggle theme"
							onClick={() => setDarkModle(!darkModle)}
				>
					<span className={styles.headerBtnIcon}>
						{darkModle ? <LightDrakMode /> : <LightDrakModeBlue />}
					</span>
				</button>
			</div> */}
			{/* 固定独立胶囊：头像 + @username，悬浮于顶部，左对齐，随滚动渐隐 */}
			{!openSearch && (
				<button
					type="button"
					onClick={() => navigate('/myWallet')}
					className="fixed left-4 z-30 flex items-center justify-start transition-opacity duration-300"
					style={{ top: 'max(1rem, env(safe-area-inset-top))', opacity: capsuleOpacity, pointerEvents: capsuleOpacity < 0.05 ? 'none' : 'auto' }}
					aria-label="Open wallet"
				>
					<div
						className="flex items-center gap-2.5 pl-2 pr-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-[0_4px_24px_rgba(15,23,42,0.08)] border border-slate-100/90 dark:border-slate-700/80 group active:scale-[0.98] transition-transform"
					>
						<div
							className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shrink-0 text-base font-bold text-white"
							style={{ backgroundColor: homeAccent }}
						>
							{beamio?.image ? (
								<img
									src={beamio.image}
									alt={beamio.accountName}
									className="w-full h-full object-cover"
									draggable={false}
								/>
							) : (
								<span className="leading-none">
									{(beamio?.accountName || 'B').replace(/^@/, '').charAt(0).toUpperCase() || '?'}
								</span>
							)}
						</div>
						<span
							className="text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100"
						>
							@{beamio?.accountName?.replace(/^@/, '') || 'Beamio'}
						</span>
					</div>
				</button>
			)}

			{/*
				默认：外层 overflow-hidden + 内层 overflow-y-auto。
				Activate Wallet：去掉外层 overflow-hidden，并对滚动层写 flex: 1 1 0% + minHeight: 0，避免 Android WebView 可视区域塌条只露出顶部胶囊。
			*/}
			<div
				className={
					homeScrollUsesSingleFlexChain
						? 'flex min-h-0 flex-1 flex-col'
						: 'flex min-h-0 flex-1 flex-col overflow-hidden'
				}
			>
				<div
					ref={setScrollRef}
					onScroll={onCapsuleScroll}
					className={
						homeScrollUsesSingleFlexChain
							? 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-24'
							: 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-44'
					}
					style={
						homeScrollUsesSingleFlexChain
							? { WebkitOverflowScrolling: 'touch', flex: '1 1 0%', minHeight: 0 }
							: { WebkitOverflowScrolling: 'touch' }
					}
				>
					{!openSearch && (
						<>
							{/* 顶部留白：刘海 + 5rem，统一各页首内容距顶距离 */}
							<div
								className="shrink-0"
								style={{ minHeight: 'calc(env(safe-area-inset-top, 0px) + 5rem)' }}
							/>

							{/* Content — 浅底、白卡片、青柠强调 */}
							<div className="space-y-8 px-5 pt-4">
							{showActivateWalletPanel ? (
								<div className="px-1 pt-2 pb-4">
									{/* WebView：isolate 限制叠层；避免负 z-index 在部分 WebView 下吞掉后续兄弟节点绘制 */}
									<div className="relative isolate flex flex-col items-center rounded-[2.5rem] border border-gray-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
										<div className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[10px] font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
											Action Required
										</div>
										<h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2 text-center tracking-tight">
											Activate Wallet
										</h2>
										<p className="text-sm text-gray-500 dark:text-slate-400 mb-8 text-center leading-relaxed">
											Your app is currently in EOA mode. Load cash or sync a card to deploy your Smart Account.
										</p>

										<div className="w-full bg-gray-50 dark:bg-slate-800/80 rounded-3xl p-5 mb-4 border border-gray-200 dark:border-slate-600 flex flex-col items-center">
											<span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
												<Store size={14} aria-hidden /> Option 1: Store Deposit
											</span>
											<div
												className="mb-3 flex flex-col items-center justify-center w-full max-w-[min(100%,280px)] select-none"
												role="img"
												aria-label="Store deposit payment QR code. Show to cashier to scan."
											>
												{/* 与 BeamioPayMe EOA 收款 QR 同款：仅展示，不触发 Pay Me 底栏 */}
												<div className="mt-1 flex w-full justify-center">
													<div className="relative">
														<div
															aria-hidden
															className="pointer-events-none absolute inset-[-8px] z-0 rounded-[28px] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(132,120,255,0.22),rgba(132,120,255,0.06)_55%,transparent_72%)] opacity-90"
														/>
														<div className="relative z-10 flex justify-center">
															<div
																className="
																	rounded-[20px] bg-white
																	p-2
																	shadow-[0_26px_50px_rgba(132,120,255,0.22),0_10px_22px_rgba(0,0,0,0.08)]
																	border-2 border-[#96EB3C]
																"
															>
																{activateWalletEoaQrValue ? (
																	<QRCodeCanvas
																		value={activateWalletEoaQrValue}
																		size={180}
																		level="H"
																		includeMargin={false}
																		bgColor="#ffffff"
																		fgColor="#000000"
																		imageSettings={{
																			src: bIcon,
																			height: 56,
																			width: 56,
																			excavate: true,
																		}}
																		className="block"
																	/>
																) : (
																	<div className="w-[180px] h-[180px] flex items-center justify-center text-xs text-gray-400 text-center px-4">
																		Loading payment link…
																	</div>
																)}
															</div>
														</div>
													</div>
												</div>
											</div>
											<div className="flex items-center gap-1.5 bg-gray-200/50 dark:bg-slate-700/50 px-2 py-1 rounded-md mb-2 max-w-full">
												<span className="text-[10px] text-gray-500 dark:text-slate-400 font-mono font-semibold truncate">
													EOA: {eoaAddressShort}
												</span>
											</div>
											<p className="text-xs text-gray-500 dark:text-slate-400 text-center font-medium">
												Show QR to cashier to load cash.
											</p>
										</div>

										<button
											type="button"
											className="w-full bg-gray-50 dark:bg-slate-800/80 hover:bg-[#96EB3C]/10 dark:hover:bg-[#96EB3C]/15 transition-colors rounded-3xl p-5 border border-gray-200 dark:border-slate-600 flex flex-col items-center cursor-pointer group text-left"
										>
											<span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
												<CreditCard size={14} aria-hidden /> Option 2: Got a Card?
											</span>
											<div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mb-2 shadow-sm border border-gray-100 dark:border-slate-600 group-hover:scale-110 transition-transform">
												<Radio size={20} className="text-[#65A30D]" aria-hidden />
											</div>
											<p className="text-sm font-bold text-gray-900 dark:text-slate-100">Sync NFC Card</p>
											<p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Tap funded card to phone.</p>
										</button>
									</div>
								</div>
							) : (
								<>
							{/* CashTrees 卡（对齐 renderAction index 199–266） */}
							<div className="pt-2 pb-2">
								<div
									role="button"
									tabIndex={0}
									onClick={openCashTreesBalanceSheet}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault()
											openCashTreesBalanceSheet()
										}
									}}
									className="relative bg-gradient-to-br from-[#8AE131] to-[#67AD0F] dark:from-[#6fb828] dark:to-[#4f9410] rounded-[2rem] p-6 text-gray-900 shadow-xl shadow-[#96EB3C]/20 dark:shadow-[#65A30D]/15 overflow-hidden transform transition-transform hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer border border-[#96EB3C]/40 dark:border-[#65A30D]/50"
								>
									<div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />

									<div className="flex justify-between items-center mb-8 relative z-10">
										<div className="flex items-center min-w-0">
											<img
												src={`${process.env.PUBLIC_URL ?? ''}/logo512.png`}
												alt="CashTrees"
												className="w-[4.5rem] h-[4.5rem] mr-3 shrink-0 object-contain"
												draggable={false}
											/>
											<div className="flex flex-col items-start justify-center min-w-0">
												<span className="font-extrabold text-[22px] tracking-tight text-gray-900 leading-none mb-1.5">CashTrees</span>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation()
														void copyCashTreesAaAddress()
													}}
													disabled={!cashTreesCardDisplay.aaFull}
													className="flex items-center gap-1.5 bg-gray-900/10 border border-gray-900/5 px-2 py-0.5 rounded-md shadow-sm hover:bg-gray-900/20 transition-colors max-w-full disabled:opacity-50"
													aria-label="Copy Smart Account address"
												>
													<span className="text-[10px] text-gray-800 font-mono tracking-widest font-semibold uppercase truncate">
														{cashTreesCardDisplay.aaShort}
													</span>
													{aaAddrCopied ? (
														<Check size={10} className="text-gray-800 shrink-0" strokeWidth={3} aria-hidden />
													) : (
														<Copy size={10} className="text-gray-700 shrink-0" aria-hidden />
													)}
												</button>
											</div>
										</div>
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation()
												openCashTreesBalanceSheet()
											}}
											className="w-8 h-8 rounded-full bg-gray-900/10 flex items-center justify-center text-gray-900 backdrop-blur-sm border border-gray-900/5 hover:bg-gray-900/20 transition-colors shadow-sm shrink-0"
											aria-label="Balance details"
										>
											<Info size={16} strokeWidth={2.5} aria-hidden />
										</button>
									</div>

									<div className="relative z-10 flex justify-between items-end gap-3">
										<div className="min-w-0">
											<p className="text-sm text-gray-800 font-bold mb-0.5 opacity-90 tracking-wide">Total Balance</p>
											<div className="flex items-baseline flex-wrap">
												<span className="text-3xl font-bold mr-1 opacity-80">$</span>
												<p className="text-[44px] font-extrabold tracking-tighter text-gray-900 leading-none">
													{cashTreesCardDisplay.whole}
													<span className="text-3xl font-bold text-gray-800/80">.{cashTreesCardDisplay.frac}</span>
												</p>
											</div>
										</div>

										<div className="flex items-center bg-gray-900/10 backdrop-blur-md border border-gray-900/5 px-3 py-1.5 rounded-full shadow-sm mb-1.5 shrink-0">
											<div className="relative flex h-2 w-2 mr-2">
												<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
												<span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
											</div>
											<span className="text-[10px] font-bold text-gray-900 tracking-wider uppercase">
												{cashTreesCardDisplay.isPhysicalCardBound ? 'Card Linked' : 'Virtual Active'}
											</span>
										</div>
									</div>
								</div>

								{!cashTreesCardDisplay.isPhysicalCardBound && (
									<div className="flex justify-center mt-4 animate-in zoom-in-95 duration-300">
										<button
											type="button"
											onClick={() => navigate('/myWallet')}
											className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 px-4 py-2 rounded-full shadow-sm border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:text-[#65A30D] dark:hover:text-[#9AE66E] hover:border-[#96EB3C]/50 transition-all active:scale-95"
										>
											<Plus size={14} strokeWidth={2.5} aria-hidden />
											<Radio size={14} aria-hidden />
											<span className="text-[12px] font-bold uppercase tracking-wider ml-0.5">Bind Physical Card</span>
										</button>
									</div>
								)}
							</div>

							{/* Add Cash | Send | Pay */}
							<div className="grid grid-cols-3 gap-2.5">
								<button
									type="button"
									onClick={handleAddFunds}
									className="flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-800 rounded-[26px] shadow-[0_8px_28px_rgba(15,23,42,0.07)] border border-slate-100/90 dark:border-slate-700/50 py-5 px-2 active:scale-[0.97] transition-transform"
								>
									<div
										className="w-12 h-12 rounded-full flex items-center justify-center"
										style={{ backgroundColor: homeAccent }}
									>
										<Plus className="w-6 h-6 text-[#0F172A]" strokeWidth={2.5} />
									</div>
									<span className="text-[13px] font-bold text-center leading-tight text-[#0F172A] dark:text-slate-100">
										Add Cash
									</span>
								</button>
								<button
									type="button"
									onClick={() => {
										setSettingsOpen('Pay')
										setShowFooter(false)
									}}
									className="flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-800 rounded-[26px] shadow-[0_8px_28px_rgba(15,23,42,0.07)] border border-slate-100/90 dark:border-slate-700/50 py-5 px-2 active:scale-[0.97] transition-transform"
								>
									<div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
										<Send className="w-5 h-5 text-[#0F172A] dark:text-slate-100" strokeWidth={2.2} />
									</div>
									<span className="text-[13px] font-bold text-[#0F172A] dark:text-slate-100">Send</span>
								</button>
								<button
									type="button"
									onClick={() => {
										setPayReceiveQrMode('receive')
										setShowPayReceiveSheet(true)
										setShowFooter(false)
									}}
									className="flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-800 rounded-[26px] shadow-[0_8px_28px_rgba(15,23,42,0.07)] border border-slate-100/90 dark:border-slate-700/50 py-5 px-2 active:scale-[0.97] transition-transform"
								>
									<div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
										<QrCode className="w-5 h-5 text-[#0F172A] dark:text-slate-100" strokeWidth={2.2} />
									</div>
									<span className="text-[13px] font-bold text-[#0F172A] dark:text-slate-100">Pay/Receive</span>
								</button>
							</div>


							{show200OK && (
								<div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100">
									<p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-1">Beamio Alpha Reward</p>
									<h4 className="font-bold text-gray-900">You've claimed 0.1 USDC</h4>
									<p className="mt-1 text-[11px] text-gray-500 leading-snug">
										Thank you for testing Beamio on Base. Your Beamio wallet has been funded with{" "}
										<span className="font-semibold text-gray-900">0.1 USDC</span> so you can try your first gasless payment.
									</p>
								</div>
							)}

							{/* Recent Activity - 与 Total Valuation、Send/Receive 同层级，左右边距统一 px-5；bare 无外层圆角/边框/边距，内部控件与上方对齐 */}
							<ActiveHistoryPannelNew
								title="Recent Activity"
								compact
								compactLimit={5}
								bare
								sectionTitleClassName="text-base font-bold text-[#0F172A] dark:text-slate-100 tracking-tight"
								viewAllClassName="text-[#7ED321] hover:text-[#6bc11a]"
							/>
								</>
							)}
						</div>

							<div className="pointer-events-none h-[128px] shrink-0 pb-[env(safe-area-inset-bottom,0px)]" />
						</>
					)}
				</div>
			</div>




			{/* Receive - BeamioPayMe 底部滑出 */}
			{createPortal(
				<AnimatePresence>
					{showPayMeSheet && (
						<>
							<motion.div
								className="fixed inset-0 z-[9997] bg-black/40"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								onClick={() => setShowPayMeSheet(false)}
							/>
							<motion.div
								className="fixed left-0 right-0 bottom-0 z-[9998] bg-white dark:bg-slate-900 rounded-t-[24px] shadow-2xl flex flex-col max-h-[92dvh] pb-[calc(env(safe-area-inset-bottom)+2rem)] min-[480px]:pb-[calc(env(safe-area-inset-bottom)+4rem)]"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 30, stiffness: 300 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="flex-shrink-0 flex items-center justify-between px-4 py-2">
									<div className="w-10" />
									<div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
									<button
										type="button"
										onClick={() => setShowPayMeSheet(false)}
										className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
										aria-label="Close"
									>
										<X className="w-5 h-5" />
									</button>
								</div>
								<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
									<BeamioPayMe
										showActiveTab={false}
										hideOuterFrame
										onClose={() => setShowPayMeSheet(false)}
										onShowFuelCenter={() => {
											setShowPayMeSheet(false)
											setShowFuelView(true)
										}}
									/>
								</div>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body
			)}

			{/* CashTrees 卡：Balance Details（链上 AA USDC + 基础设施卡 points / token #0，对齐 renderAction 1082–1131） */}
			{createPortal(
				<AnimatePresence>
					{showCashTreesBalanceDetails && (
						<motion.div
							key="cash-trees-balance-details"
							className="fixed inset-0 z-[10050] flex flex-col justify-end pointer-events-none"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
						>
							{/* 单根子树：避免 Fragment 下双 motion 时 AnimatePresence 只驱动第一个，底栏卡在 y:100% 仅见蒙版 */}
							<div
								className="absolute inset-0 pointer-events-auto bg-gray-900/40 dark:bg-black/50 backdrop-blur-md"
								onClick={closeCashTreesBalanceSheet}
								aria-hidden
							/>
							<motion.div
								className="relative z-10 w-full max-h-[85dvh] pointer-events-auto bg-[#F1F8ED] dark:bg-slate-900 rounded-t-[2.5rem] p-6 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-gray-200/80 dark:border-slate-700 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] overflow-y-auto overscroll-contain"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 30, stiffness: 300 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="mx-auto w-12 h-1.5 bg-gray-300 dark:bg-slate-600 rounded-full mb-6 shrink-0" />

								<h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2 tracking-tight text-center">Balance Details</h3>
								<p className="text-sm text-gray-500 dark:text-slate-400 mb-8 text-center">AA USDC and infrastructure card (token #0) balance</p>

								{cashTreesBalanceLoading && (
									<div className="flex flex-col items-center justify-center py-10 gap-3 mb-4">
										<Loader2 className="w-10 h-10 text-[#65A30D] animate-spin" aria-hidden />
										<span className="text-sm text-gray-500 dark:text-slate-400">Loading balances…</span>
									</div>
								)}

								{cashTreesBalanceError && !cashTreesBalanceLoading && (
									<p className="text-sm text-amber-600 dark:text-amber-400 text-center mb-6">{cashTreesBalanceError}</p>
								)}

								{!cashTreesBalanceLoading && !cashTreesBalanceError && (
									<div className="w-full bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col mb-8">
										{/* 1：AA 钱包 USDC（getMyAssets 内对 aaAccount 的 USDC balanceOf） */}
										<div className="p-4 flex items-center justify-between border-b border-gray-100/50 dark:border-slate-700">
											<div className="flex items-center gap-3 min-w-0">
												<div className="w-10 h-10 bg-gray-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center border border-gray-200 dark:border-slate-600 shrink-0 relative">
													<div className="relative w-7 h-7 shrink-0">
														<img src={usdcIcon} alt="" className="block w-7 h-7 rounded-full object-contain" />
														<img src={baseIcon} alt="" className="block w-4 h-4 absolute -bottom-0.5 -right-0.5 rounded-full border border-white dark:border-slate-900 bg-white" />
													</div>
												</div>
												<div className="flex flex-col min-w-0">
													<span className="text-sm font-bold text-gray-900 dark:text-slate-100 tracking-tight">AA Wallet (USDC)</span>
													<span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Smart Account on Base</span>
												</div>
											</div>
											<div className="text-right shrink-0 pl-2">
												<span className="text-lg font-bold text-gray-900 dark:text-slate-100">{formatCashTreesUsd2(cashTreesSheetAaUsdc)}</span>
											</div>
										</div>

										{/* 2：基础设施卡 token #0 / points（合约 points 余额，与 getMyAssets.points 一致） */}
										<div className="p-4 flex items-center justify-between bg-gradient-to-r from-[#96EB3C]/15 to-transparent dark:from-[#65A30D]/20 dark:to-transparent">
											<div className="flex items-center gap-3 min-w-0">
												<div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm border border-[#96EB3C]/30 dark:border-[#65A30D]/40 text-lg shrink-0" aria-hidden>
													🌳
												</div>
												<div className="flex flex-col min-w-0">
													<span className="text-sm font-bold text-gray-900 dark:text-slate-100 tracking-tight">Infrastructure Card</span>
													<span className="text-[10px] text-[#65A30D] dark:text-[#9AE66E] font-bold uppercase tracking-wider mt-0.5">Eligible for Store Discounts</span>
												</div>
											</div>
											<div className="text-right shrink-0 pl-2">
												<span className="text-lg font-bold text-gray-900 dark:text-slate-100">{formatCashTreesUsd2(cashTreesSheetPoints0)}</span>
											</div>
										</div>
									</div>
								)}

								<button
									type="button"
									onClick={closeCashTreesBalanceSheet}
									className="w-full py-4 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-[0.98] text-gray-900 dark:text-slate-100 rounded-2xl font-bold transition-all shadow-sm border border-gray-200 dark:border-slate-600 shrink-0"
								>
									Close
								</button>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>,
				document.body
			)}

			{/* Pay / Receive 底栏（对齐 renderAction index Pay|Receive） */}
			{createPortal(
				<AnimatePresence>
					{showPayReceiveSheet && (
						<>
							<motion.div
								className="fixed inset-0 z-[10020] bg-gray-900/40 dark:bg-black/50 backdrop-blur-sm"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								onClick={closePayReceiveSheet}
							/>
							<motion.div
								className="fixed left-0 right-0 bottom-0 z-[10021] bg-white dark:bg-slate-900 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col max-h-[90dvh] pb-[calc(env(safe-area-inset-bottom)+1rem)]"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 32, stiffness: 320 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mt-4 mb-2 shrink-0" />
								<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain px-6 pb-4">
									<div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-full mb-6 w-full max-w-[240px] mx-auto shadow-inner">
										<button
											type="button"
											onClick={() => setPayReceiveQrMode('pay')}
											className={`flex-1 py-2 text-sm font-bold rounded-full transition-all duration-300 ${
												payReceiveQrMode === 'pay'
													? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-slate-100'
													: 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
											}`}
										>
											Pay
										</button>
										<button
											type="button"
											onClick={() => setPayReceiveQrMode('receive')}
											className={`flex-1 py-2 text-sm font-bold rounded-full transition-all duration-300 ${
												payReceiveQrMode === 'receive'
													? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-slate-100'
													: 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
											}`}
										>
											Receive
										</button>
									</div>

									{payReceiveQrMode === 'pay' ? (
										<div className="flex flex-col items-center w-full min-h-[min(460px,55dvh)]">
											<h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1 tracking-tight text-center">
												Pay with {userBeamioTagDisplay}
											</h3>
											<p className="text-sm text-gray-500 dark:text-slate-400 mb-4 text-center">
												Show this code to cashier to pay.
											</p>
											<div className="w-full flex flex-col items-center mb-4">
												{payRelayQRLoading && !payRelayQRPayload && (
													<div className="flex flex-col items-center justify-center py-10 gap-3">
														<Loader2 className="w-10 h-10 text-[#65A30D] animate-spin" aria-hidden />
														<span className="text-sm text-gray-500 dark:text-slate-400">Generating pay code...</span>
													</div>
												)}
												{payRelayQRPayload && (
													<ShowPayQR
														successUrl={'https://beamio.app?beamio=' + (beamio?.accountName ?? '')}
														beamio={beamio ?? null}
														qrValue={JSON.stringify({
															...payRelayQRPayload,
															validBefore: payRelayQRPayload.deadline,
														})}
														hideActions
														hideUrl
														hideName
													/>
												)}
												{!payRelayQRLoading && !payRelayQRPayload && (
													<p className="text-sm text-center text-amber-600 dark:text-amber-400 px-4 max-w-sm">
														{!profiles?.[0]?.aaAccount
															? 'Smart Account required to show pay QR.'
															: 'Could not generate pay code. Close and try again.'}
													</p>
												)}
											</div>
											<div className="flex items-center gap-2 mb-6">
												<div className="w-2 h-2 bg-[#65A30D] rounded-full animate-pulse" />
												<span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
													Auto-refreshes every minute
												</span>
											</div>
											<button
												type="button"
												onClick={closePayReceiveSheet}
												className="mt-auto w-full rounded-full border border-[#96EB3C]/50 bg-gradient-to-r from-[#8AE131] to-[#67AD0F] py-4 font-bold text-gray-900 shadow-md shadow-[#96EB3C]/25 transition-all hover:opacity-95 active:scale-[0.98] dark:border-[#65A30D]/50 dark:from-[#6fb828] dark:to-[#4f9410] dark:shadow-[#65A30D]/20"
											>
												Done
											</button>
										</div>
									) : (
										<div className="w-full flex flex-col min-h-[min(460px,55dvh)]">
											{/* Receive：与 BeamioPayMe / Alliance PayMe 一致（AmountCurrency、备注、Valid for days、requestAccounting、B-Unit 摘要） */}
											<div className="w-full max-w-[540px] mx-auto px-0">
												<BeamioPayMe
													showActiveTab={false}
													hideOuterFrame
													hideEoaReceivingToggle
													hideReceivingWalletHeading
													receivePanelLimeButtons
													onClose={closePayReceiveSheet}
													onShowFuelCenter={() => {
														closePayReceiveSheet()
														setShowFuelView(true)
													}}
												/>
											</div>
											<button
												type="button"
												onClick={closePayReceiveSheet}
												className="mt-4 w-full shrink-0 rounded-full border border-[#96EB3C]/50 bg-gradient-to-r from-[#8AE131] to-[#67AD0F] py-4 font-bold text-gray-900 shadow-md shadow-[#96EB3C]/25 transition-all hover:opacity-95 active:scale-[0.98] dark:border-[#65A30D]/50 dark:from-[#6fb828] dark:to-[#4f9410] dark:shadow-[#65A30D]/20"
											>
												Done
											</button>
										</div>
									)}
								</div>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body
			)}

			{/* Add Cash - BankingBridge 底部滑出 */}
			{createPortal(
				<AnimatePresence>
					{showAddCashSheet && (
						<>
							<motion.div
								className="fixed inset-0 z-[9997] bg-black/40"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								onClick={() => {
									setShowAddCashSheet(false)
									setShowAddUsdcInSheet(false)
									setShowFooter(true)
								}}
							/>
							<motion.div
								className="fixed left-0 right-0 bottom-0 z-[9998] bg-white dark:bg-slate-900 rounded-t-[24px] shadow-2xl flex flex-col max-h-[92dvh] pb-[calc(env(safe-area-inset-bottom)+2rem)]"
								initial={{ y: '100%' }}
								animate={{ y: 0 }}
								exit={{ y: '100%' }}
								transition={{ type: 'spring', damping: 30, stiffness: 300 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="flex-shrink-0 flex items-center justify-between px-4 py-2">
									<div className="w-10" />
									<div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
									<button
										type="button"
										onClick={() => {
											setShowAddCashSheet(false)
											setShowAddUsdcInSheet(false)
											setShowFooter(true)
										}}
										className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
										aria-label="Close"
									>
										<X className="w-5 h-5" />
									</button>
								</div>
								<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
									{!showAddUsdcInSheet && (
										<BankingBridge
											onAddCash={() => setShowAddUsdcInSheet(true)}
											onCashOut={() => setShowAddUsdcInSheet(true)}
										/>
									)}
									{showAddUsdcInSheet && (
										<>
											<BeamioNavBack
												title=""
												onClose={() => setShowAddUsdcInSheet(false)}
												onMore={() => {}}
											/>
											<BeamioAddUSDCFlow
												embedInSheet
												onCancel={() => setShowAddUsdcInSheet(false)}
											/>
										</>
									)}
								</div>
							</motion.div>
						</>
					)}
				</AnimatePresence>,
				document.body
			)}

			{showFuelView && createPortal(
				<AnimatePresence>
					<motion.div
						key="fuel-view-overlay"
						className="fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.28, ease: "easeOut" }}
					>
						<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain pt-[env(safe-area-inset-top)]">
							<FuelView
								onClose={() => setShowFuelView(false)}
								bUnitBalance={bUnitBalance}
								account={profiles?.[0]?.keyID}
								onRefresh={() => {
									const p = profiles?.[0]
									if (p?.keyID) getBUnitBalanceOnConet(p.keyID).then(setBUnitBalance).catch(() => setBUnitBalance(null))
								}}
							/>
						</div>
					</motion.div>
				</AnimatePresence>,
				document.body
			)}

			{!openSearch && showAlphaHowItWorks && createPortal(
				<AnimatePresence>
					<motion.div
						key="modal-overlay"
						className="
							fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col
						"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.28, ease: "easeOut" }}
						onTouchMove={(e) => e.stopPropagation()}
					>
					{/* 顶部 Header */}
					<BeamioNavBack
						title={
							showAlphaHowItWorks === 'BeamioAlphaHowItWorks' ? 'How Beamio Alpha works'
							: showAlphaHowItWorks === 'BeamioLearnHowItWorksCard' ? 'How Beamio works'
							: showAlphaHowItWorks === 'BeamioTestBalance' ? 'About this 0.2 USDC'
							: showAlphaHowItWorks === 'Pay' ? 'Pay'
							: ''
						}
						onClose={() => {
							setShowAlphaHowItWorks('')
							setShowFooter(true)
						}}
						onMore={() => {

						}}
					/>

						{/* 内容区域 */}
						<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
							{showAlphaHowItWorks === 'BeamioAlphaHowItWorks' && <BeamioAlphaHowItWorks />}
							{showAlphaHowItWorks === 'BeamioLearnHowItWorksCard' && <BeamioLearnHowItWorksCard />}
							{showAlphaHowItWorks === 'BeamioAlphaDropConfirm' && (
							<BeamioAlphaDropConfirm
								wallet={myAddress}
								close={(success) => {
									setShowAlphaHowItWorks('')

									if (!success) return
									if (success === 'error') {
										return setShowGetFaucet('sameIP')
									}
									storee()
									setShowGetFaucet('finished')
								}}
							/>
							)}
							{showAlphaHowItWorks === 'BeamioTestBalance' && <BeamioTestBalanceDetailsCard />}
							
							
							{showAlphaHowItWorks === 'Pay' && <PayScreen 
								beamioer={userPreviewItem||undefined}
								close={path => {
									setShowAlphaHowItWorks('')
								}}
								onShowFuelCenter={() => {
									setShowAlphaHowItWorks('')
									setShowFuelView(true)
								}}
							/>}
							{showAlphaHowItWorks === 'OnrampOfframpGuide' && <OnrampOfframpGuide />}
							{showAlphaHowItWorks === 'CoinbaseRamps' && <BeamioAddUSDCFlow />}
							{showAlphaHowItWorks === 'BeamioContactProfilePreview' && userPreviewItem && 
								<BeamioContactProfilePreview 
								item={userPreviewItem} 
								close={item => {
									setShowAlphaHowItWorks('')
									setSettingsOpen('Pay')
									setShowFooter(false)
							}} />}

							{
								showAlphaHowItWorks === 'TransactionsItemDetail' && itemTx &&
								<TransactionsItemDetail
									localMode='pay' tx={itemTx}
								/>
							}

						</div>
					</motion.div>
				</AnimatePresence>
				, document.body
			)}



			{/**		检索	 */}
			{createPortal(
				<div
					className={[
						"fixed inset-0 z-[9998] bg-white w-full h-full overscroll-none touch-action-none",
						
						// ✅ 修改点 1: 时间改为 500ms (0.5秒)，ease-in-out 让加减速更自然
						"transition-opacity duration-500 ease-in-out",
						
						// 状态切换：控制透明度和点击穿透
						openSearch ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
					].join(" ")}
					style={{ top: 0, left: 0, bottom: 0, right: 0 }}
				>
					{/* ✅ 修改点 2: 移除了 {openSearch && (...)} 
					让内容常驻 DOM，这样“关闭”时，内容会跟随背景一起慢慢淡出，
					而不是瞬间消失只剩下背景在淡出。
					
					注意：如果 BeamioSearch 内部有需要每次打开都重置的逻辑（比如 useEffect），
					请确保它监听了 openSearch 或者是通过 key={openSearch ? 'open' : 'closed'} 来强制刷新。
					*/}
					<div className="h-full w-full flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
						<BeamioSearch
							isOpen={openSearch}
							close={(item) => {
								
								if (!item || typeof item === "string") {
									
								} else {
									setUserPreviewItem(item)
									setShowAlphaHowItWorks('BeamioContactProfilePreview')
								}
								setShowFooter(true)
								setOpenSearch(false)
							}}
						/>
					</div>
				</div>,
				document.body
			)}

			{/* 底部向上弹出窗口 */}
			<div
			className={[
				"fixed inset-0 z-40",
				settingsOpen ? "pointer-events-auto" : "pointer-events-none"
			].join(" ")}
			>
				{/* 灰色遮罩：父页面不可用 */}
				<div
					className={[
					"absolute inset-0",
					"bg-black/50 transition-opacity duration-300 ease-out",
					settingsOpen ? "opacity-100" : "opacity-0"
					].join(" ")}
					onClick={() => {
						setShowFooter(true)
						setSettingsOpen('')
					}}
				/>

				{/* Bottom Sheet：全宽，从底部上来 */}
				<div
					className={[
					"absolute inset-x-0 bottom-0",
					"transition-transform duration-300 ease-out",
					settingsOpen ? "translate-y-0" : "translate-y-full"
					].join(" ")}
					onTouchMove={(e) => e.stopPropagation()}
				>
					{/* Sheet 本体：h-auto 自适应内容高度 */}
					<div
					className={[
						"w-full",
						"bg-white dark:bg-slate-900",
						"rounded-t-[22px]",

						// ✅ 自适应高度，但最多不超过屏幕（避免顶到状态栏）
						// 你也可以改成 90dvh
						"max-h-[calc(100dvh-env(safe-area-inset-top)-12px)]",
						"h-auto",

						// ✅ 安全区：底部留出 Home indicator
						"pb-[env(safe-area-inset-bottom)]"
					].join(" ")}
					>
						{/* 顶部拖拽条（可选） */}
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
						</div>


						{/* 内容区：内容少就不滚动；内容多才滚动 */}
						<div className="px-4 pb-4 overflow-y-auto">
							{ settingsOpen === 'BeamioBetaAccess' && 
							<BeamioBetaAccess 

							onClose={() => {
								setShowFooter(true)
								setSettingsOpen('')
							}} />}

							{ settingsOpen === 'Pay' && (
								<PayScreen 
									beamioer={userPreviewItem || undefined}
									close={() => {
										setSettingsOpen('')
										setShowFooter(true)
									}}
									onShowFuelCenter={() => {
										setSettingsOpen('')
										setShowFooter(true)
										setShowFuelView(true)
									}}
								/>
							)}
							{/* <div
								className="
								h-[24px]
								pb-[env(safe-area-inset-bottom)]
								pointer-events-none
								"
							/> */}
						</div>
					</div>
				</div>
			</div>

			
		</div>
	)
}

export default Home
