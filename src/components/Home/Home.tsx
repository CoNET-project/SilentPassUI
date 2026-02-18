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
import { createOrGetWallet, storeSystemData, getOracle, postBeamio} from "@/services/beamio"
import BeamioAlphaHowItWorks from './BeamioAlphaHowItWorks'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import BeamioLearnHowItWorksCard from './BeamioLearnHowItWorksCard'
import BeamioAlphaDropConfirm from './BeamioAlphaDropConfirm'
import BeamioTestBalanceDetailsCard from './BeamioTestBalanceDetailsCard'
import {motion, AnimatePresence } from "framer-motion"
import { Settings, Check, ArrowDownCircle, PlusCircle , X, Zap, Shield, Clock, Sparkles, Wallet, Circle, RefreshCw, BadgeCheck, ArrowUpRight, ArrowDownLeft, Plus } 
	from "lucide-react"
import OnrampOfframpGuide from './OnrampOfframpGuide'
import BeamioSearch from './BeamioSearch'
import CoinbaseRamps from '@/components/Setting/CoinbaseRamps'
import BeamioAddUSDCFlow from '@/components/addUSDC/BeamioAddUSDCFlow'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import PayScreen from '@/pages/Pay/send'

import { ethers } from 'ethers'
import { baseEndpoint } from '@/utils/constants'
import beamioConetCoreABI from '@/services/ABI/beamioConetCoreABI.json'
import { CCSA_Card_Address } from '@/utils/constants'
import { getActiveArray } from '@/services/payment'
import { getAAAccount, getMyAssets } from '@/services/BeamioCard'
import ActivePannel from '@/pages/History/components/activePannel'
import BeamioContactProfilePreview from './BeamioContactProfilePreview'
import {BeamioBetaAccess} from './components/BeamioBetaAccess'
import {TransactionsItemDetail} from '@/pages/History/TransactionsItemDetail'
import BeamioPayMe from '@/pages/Pay/BeamioPayMe'



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
	const [ccsaAssets, setCcsaAssets] = useState<Awaited<ReturnType<typeof getMyAssets>> | null>(null)



	const [activeItems, setActiveItems] = useState<TransferHistork[]>([])

	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<'BeamioAlphaHowItWorks'|'BeamioLearnHowItWorksCard'|'Pay'|'TransactionsItemDetail'|
		''|'BeamioAlphaDropConfirm'|'BeamioTestBalance'|'OnrampOfframpGuide'|'Search'|'BeamioContactProfilePreview'|'CoinbaseRamps'|'PayMe'>('')
	const [showPayMeSheet, setShowPayMeSheet] = useState(false)
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(!openSearch)

	const avatarUrl = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(
		avatarName
	)}`


	const getAccountData = (bo: beamio) => {
		if (!bo) return
		setCurrency(bo.currency)
		setLanguage(bo.language)
	}

	const oracle = async () => {
		
		const data = await getOracle ()
		setCurrencyData({
			CAD: Number(data.usdcad),
			JPY: Number(data.usdjpy),
			USD: 1,
			CNY: Number(data.usdcny),
			USDC: Number(data.usdc),
			HKD: Number(data.usdhkd),
			TWD: Number(data.usdtwd),
			EUR: Number(data.usdeur),
			SGD: Number(data.usdsgd)
			
		})
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
		if (CCSA_Card_Address) {
			getMyAssets(profile, CCSA_Card_Address)
				.then(setCcsaAssets)
				.catch(() => setCcsaAssets(null))
		}
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
		// 拉取 CCSA 卡资产（延迟执行，避免首屏阻塞）
		if (CCSA_Card_Address) {
			setTimeout(() => {
				getMyAssets(profile, CCSA_Card_Address)
					.then(setCcsaAssets)
					.catch(() => setCcsaAssets(null))
			}, 150)
		}
		const actives = await getActiveArray(profile)
		setActiveItems(actives)

		const bo: beamio = temp?.beamio || await getUserInfo(profile.keyID)

		if (!bo) return

		bo.initialLoading = true
		
		
		
		oracle()
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



	/**
	 * @returns 1 USDC ≈ X {currency}
	 */
	function fxRateUSDCToCurrency(currency: ICurrency): number {
		// 1 USDC = ? USD
		const usdcToUSD = currencyData.USDC ?? 1

		switch (currency) {
			case 'USD':
				// 1 USDC = ? USD
				return usdcToUSD

			case 'CAD':
				return usdcToUSD * currencyData.CAD

			case 'EUR':
				return usdcToUSD * currencyData.EUR

			case 'JPY':
				return usdcToUSD * currencyData.JPY

			case 'CNY':
				return usdcToUSD * currencyData.CNY

			case 'HKD':
				return usdcToUSD * currencyData.HKD

			case 'TWD':
				return usdcToUSD * currencyData.TWD

			case 'SGD':
				return usdcToUSD * currencyData.SGD

			default: {
				// 理论上不会发生，兜底防炸
				console.warn('Unknown currency:', currency)
				return usdcToUSD
			}
		}
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

	/** 用于 exampleExpress 风格的大数字拆分展示。合计：EOA USDC + AA 账号 CCSA 余额，转换为用户设定的 currency */
	function getValuationParts(): { symbol: string; whole: string; decimal: string } {
		// EOA USDC 转换为目标币种
		const usdcRate = fxRateUSDCToCurrency(currency)
		const eoaValue = currency === 'USDC' ? usdcbalance : usdcbalance * usdcRate

		// CCSA 积分（AA 账号）按卡币种计价，转换为目标币种。CCSA 卡币种通常为 CAD
		const ccsaPoints = Number(ccsaAssets?.points ?? 0)
		const ccsaCurrency = ccsaAssets?.cardCurrency ?? 'CAD'
		let ccsaValue = 0
		if (ccsaCurrency === 'USDC') {
			// 卡币种为 USDC 时，直接按 USDC→目标币种折算
			ccsaValue = currency === 'USDC' ? ccsaPoints : ccsaPoints * usdcRate
		} else {
			// 卡币种为法币（如 CAD），按 1 ccsaCurrency = ? target 折算
			const ccsaRate = currencyData.CAD && (currencyData as Record<string, number>)[ccsaCurrency]
				? ((currencyData as Record<string, number>)[currency] ?? 1) / (currencyData as Record<string, number>)[ccsaCurrency]
				: 0
			ccsaValue = ccsaPoints * ccsaRate
		}

		const total = eoaValue + ccsaValue
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
		setShowAlphaHowItWorks('CoinbaseRamps')
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

	function ActivityPreview() {
		return (
			<div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100">
				<div className="text-center py-6 text-gray-400 text-sm">
					When you send or receive USDC, your payments will show up here.
				</div>
			</div>
		);
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


	return (
		<div className="
		bg-[#F2F2F7]
		pb-[env(safe-area-inset-bottom)]
		pl-[env(safe-area-inset-left)]
		pr-[env(safe-area-inset-right)]
		w-full h-screen
		h-full flex flex-col text-slate-900
		">
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
					<div className="flex items-center space-x-2.5 px-3 py-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full shadow-sm border border-gray-200/80 dark:border-slate-600/50 group active:scale-[0.98] transition-transform">
						{beamio ? (
							<img
								src={beamio.image ? beamio.image : getImg(beamio.accountName)}
								alt={beamio.accountName}
								className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-slate-600 shadow-sm"
								draggable={false}
							/>
						) : (
							<div className="w-9 h-9 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center border border-gray-200 dark:border-slate-500 text-lg text-gray-500">
								?
							</div>
						)}
						<div className="flex flex-col items-start">
							<span className="text-xs font-bold text-gray-500 dark:text-slate-400 leading-tight">
								{displayName(beamio) || 'User'}
							</span>
							<span className="text-base font-bold text-gray-900 dark:text-slate-100 leading-tight">
								@{beamio?.accountName ?? '@Beamio'}
							</span>
						</div>
					</div>
				</button>
			)}

			{/* Phone frame - exampleExpress style */}
			<div ref={setScrollRef} onScroll={onCapsuleScroll} className="flex-1 flex flex-col overflow-y-auto pb-44">
				{!openSearch && (
					<>
						{/* 顶部留白：为固定胶囊让出高度 */}
						<div className="h-[3.75rem] shrink-0" />

						{/* Content - exampleExpress style */}
						<div className="px-5 pt-6 space-y-6">
							{/* Total Valuation - exampleExpress style */}
							<div className="text-center py-4">
								<button
									type="button"
									onClick={reflashProcess}
									disabled={reflash}
									className={`
										inline-flex items-center space-x-1.5 px-3 py-1 bg-white rounded-full shadow-sm border border-gray-100 mb-4
										transition active:scale-[0.98]
										${reflash ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:bg-gray-50'}
									`}
								>
									<Zap className={`w-3.5 h-3.5 text-yellow-500 fill-current ${reflash ? 'animate-spin' : ''}`} />
									<span className="text-xs font-semibold text-gray-600">Beamio Sponsored Gas</span>
								</button>
								<h2 className="text-sm font-medium text-gray-500 mb-1 tracking-wide">
									Total Valuation ({currency})
								</h2>
								<div className="flex justify-center items-baseline text-gray-900">
									{(() => {
										const { symbol, whole, decimal } = getValuationParts()
										return (
											<>
												{symbol && <span className="text-3xl font-medium mr-1">{symbol}</span>}
												<span className="text-5xl font-extrabold tracking-tight">{whole}</span>
												<span className="text-3xl font-bold text-gray-400">.{decimal}</span>
											</>
										)
									})()}
								</div>
							</div>

							{/* Send | Receive + Add Cash - exampleExpress grid，蓝色背景 + 白字 */}
							<div className="grid grid-cols-2 gap-3">
								<button
									type="button"
									onClick={() => {
										setSettingsOpen('Pay')
										setShowFooter(false)
									}}
									className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-4 rounded-[28px] shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-transform flex flex-col justify-between h-32 group text-white"
								>
									<div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center self-start group-hover:bg-white/30 transition-colors">
										<ArrowUpRight className="w-5 h-5 text-white" />
									</div>
									<div className="text-left">
										<span className="block font-bold text-white">Send</span>
										<span className="text-xs text-white/80">0 Gas USDC</span>
									</div>
								</button>
								<div className="space-y-3">
									<button
										type="button"
										onClick={() => setShowPayMeSheet(true)}
										className="w-full bg-white p-3 rounded-[24px] shadow-sm border border-gray-100 active:scale-[0.98] transition-transform flex items-center space-x-3"
									>
										<div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
											<ArrowDownLeft className="w-5 h-5 text-green-600" />
										</div>
										<span className="font-bold text-gray-900 text-sm">Receive</span>
									</button>
									<button
										type="button"
										onClick={handleAddFunds}
										className="w-full bg-white p-3 rounded-[24px] shadow-sm border border-gray-100 active:scale-[0.98] transition-transform flex items-center space-x-3"
									>
										<div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
											<Plus className="w-5 h-5 text-gray-600" />
										</div>
										<span className="font-bold text-gray-900 text-sm">Add Cash</span>
									</button>
								</div>
							</div>

							{/* Recent Activity section */}
							<div className="space-y-4">
								<h3 className="text-lg font-bold text-gray-900 px-1">Recent Activity</h3>
								{/* BeamioBetaCard 已隐藏 */}

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

								{/* Activity area */}
								<div className="mt-6">
									{activeItems?.length ? (
										<ActivePannel
											items={activeItems}
											onOpen={tx => {
												setItemtx(tx)
												setShowAlphaHowItWorks('TransactionsItemDetail')
												setShowFooter(false)
											}}
										/>
									) : (
										<ActivityPreview />
									)}
								</div>
							</div>
						</div>

						<div className="h-[128px] pb-[env(safe-area-inset-bottom)] pointer-events-none" />
					</>
				)}
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
									/>
								</div>
							</motion.div>
						</>
					)}
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
								}} />}
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
							// 如果需要每次打开都重置状态，可以加这个 key
							// key={openSearch ? "active" : "inactive"} 
							
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
