// Home.tsx

import { useEffect, useRef, useState, useMemo, useLayoutEffect} from "react"
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
import { Search, Settings, Check, ArrowDownCircle, PlusCircle , X, Zap, Shield, Clock, Sparkles, Wallet, Circle, RefreshCw } 
	from "lucide-react"
import OnrampOfframpGuide from './OnrampOfframpGuide'
import BeamioSearch from './BeamioSearch'
import SearchInputWithDropdown from './SearchBarWithResults'
import CoinbaseRamps from '@/components/Setting/CoinbaseRamps'
import BeamioAddUSDCFlow from '@/components/addUSDC/BeamioAddUSDCFlow'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import PayScreen from '@/pages/Pay/send'
import {ethers} from 'ethers'
import beamioConetCoreABI from '@/services/ABI/beamioConetCoreABI.json'



const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })

const beamioConetContract = {
	address: '0xCE8e2Cda88FfE2c99bc88D9471A3CBD08F519FEd',
	network: 'CONET DePIN',
	abi: beamioConetCoreABI,
	provider: new ethers.JsonRpcProvider('https://mainnet-rpc.conet.network'),
	
}
const CoreContract = new ethers.Contract(beamioConetContract.address, beamioConetContract.abi, beamioConetContract.provider)

const Home = ({}) => {
	const { setDarkModle, profiles,
		power, setProfiles, setBeamio, setPaymentLink, setSecureCode,  secureCode, ignoreUrl, setMyAddress, myAddress, beamio, setCurrencyData,
		setPayTag, setSendToMemo, setUsdcbalance, listenningProcess, setListenningProcess, setUsdcToUSD, usdcToUSD, usdcbalance, setPaymentLinkCode,
		currencyData, setRedeemCode, setPayMePayment
	} = useDaemonContext()
	const navigate = useNavigate()
	const hasActivity = false;
	
	const [isSearchOpen, setIsSearchOpen] = useState(false)
	const [avatarName, setAvatarName] = useState('')
	const [avatarImageData, setAvatarImageData] = useState<string | null>(null)
	const [processing, setProcessing] = useState(false)
	const [showGetFaucet, setShowGetFaucet] = useState<'Faucet'|'finished'|'sameIP'>('Faucet')
	const [show200OK, setShow200OK] = useState(false)
	const [show403, setShow403] = useState(false)
	const [searchBeamioAccount, setSearchBeamioAccount] = useState('')
	const [showLinkPay, setShowLinkPay] = useState(false)
	const [code, setCode] = useState('')
	const [note, setNote] = useState('')
	const [amt, setAmt] = useState('')
	const [recipient, setRecipient] = useState('')
	const [claimLoading, setClaimLoading] = useState(false)
	const [currency, setCurrency] = useState<ICurrency>('USD')
	const [language, setLanguage] = useState<"en">("en")
	const [userPreviewItem, setUserPreviewItem] = useState<searchResult|null>()
	const [openSearch, setOpenSearch]= useState(false)
	const [reflash, setReflash] = useState(false)
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<'BeamioAlphaHowItWorks'|'BeamioLearnHowItWorksCard'|'Pay'|
		''|'BeamioAlphaDropConfirm'|'BeamioTestBalance'|'OnrampOfframpGuide'|'Search'|'BeamioContactProfilePreview'|'CoinbaseRamps'>('')

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

	const checkUrl = async (url: string) => {
	
		
		let searchParams: URLSearchParams
		try {
			const u = new URL(url)
			searchParams = u.searchParams
		} catch {
			searchParams = new URLSearchParams(url)
		}

		let code = searchParams.get("code")||''
		const _secureCode = searchParams.get("secureCode")||searchParams.get("securecode")||''
		const cashcode = searchParams.get("cashcode")||''
		const _beamio = searchParams.get("beamio")||''
		if (_beamio) {
			
			const user = await searchUsername(_beamio)
			const results: searchResult[] = user?.results
			if (!results.length) {
				return
			}
			const filtered = results.filter(n => n.username === _beamio)
			if (!filtered.length) {
				return
			}

			setPayMePayment(filtered[0])
			return navigate('/browser')

		}
		if (_secureCode) {
			setSecureCode (_secureCode)
			setRedeemCode(cashcode)
			return navigate('/browser')
		}

		if (code) {

			if (!code.startsWith('0x')) {
				code = ethers.solidityPackedKeccak256(['string'], [code])
				
			}
			try {
				const fx = await CoreContract.getLinkMemo(code)
				if (fx.to !== ethers.ZeroAddress) {
					setPaymentLinkCode(code)
					return navigate('/browser')
				}
				
			} catch (ex) {
				console.log(`await CoreContract.getLinkMemo(code) Error`)
			}
			
			
		}


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
		if (!myAddress) return
		setReflash(true)
		await getBalanceProcess(myAddress, setUsdcbalance, setUsdcToUSD)
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
		if (!temp || !profiles) {
			return
		}

		const bo: beamio = temp?.beamio || await getUserInfo(profiles[0].keyID)

		if (!bo) return

		bo.initialLoading = true
		
		
		
		oracle()
		if (bo.isUSDCFaucet) {
			setShowGetFaucet('finished')
		} else {
			setShowGetFaucet('Faucet')
		}
		
		
		setDarkModle(bo.darkTheme)
		setBeamio ({...bo})
		temp.beamio = bo
		getAccountData(bo)
		setCoNET_Data(temp)
		storeSystemData()
		
		const profile = profiles[0]
		setMyAddress (profile.keyID)
		setTimeout(() => {
			getBalanceProcess(profile.keyID, setUsdcbalance, setUsdcToUSD)
		}, 1500)
		
		
		if (ignoreUrl) {
			return
		}
		checkUrl(window.location.href)

  	}

  	let first = true

  	useEffect(() => {
		if (first) {
			first = false
			init()
		}

				// 只在挂载时注册一次
		const off = onWalletEvent("scan:url", (url: string) => {
			if (/^0x/i.test(url)) {
				setPaymentLink({code: '', note: '', address: url, amount: ''})
				
				setSendToMemo(url)
				navigate('/Pay')
				return 
			}
			checkUrl(url)
		})
				// 卸载时把监听取消，避免旧实例继续吃事件
		return () => {
			if (typeof off === 'function') off()
		}

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

	const currentAvatarSrc = avatarImageData || avatarUrl

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
			<div className="pt-6 pb-4">
				<div className="text-xs font-medium text-slate-500 mb-2">No activity yet</div>
				<div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3">
					<div className="text-xs text-slate-500">
						When you send or receive USDC, your payments will show up here.
					</div>
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
		<div className="h-full flex flex-col text-slate-900">
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
			{/* Phone frame */}
			<div className="flex-1 px-5 pb-3 overflow-y-auto">
				
				{/* Search */}
				{
					!openSearch && <div className="flex items-center gap-2 mb-4 mt-6">
						<div 
							onClick={() => {
								setOpenSearch(true)
							}}
							className="w-full"
						>
							<div className="pointer-events-none">
								<SearchInputWithDropdown
									showHistory={false}
									close={ path => {
										setShowAlphaHowItWorks('')
									}}
								/>
							</div>
						</div>
						<div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
							<ScanBtn />
						</div>
					</div>
				}
				

				{/* Content */}
				<div className="">
					{/* Hero card */}
					{
						showGetFaucet === 'Faucet' ? (
							<div className="mt-3 rounded-2xl bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600 text-white px-4 py-3 mb-4">
	
								<div className="text-[12px] font-semibold mb-1">
									Claim 0.2 USDC to get started
								</div>
								<p className="text-[11px] text-orange-50 leading-snug mb-3">
									Send your first gasless payment on Base. Help us reach 500 test
									transfers.
								</p>
								<div className="flex gap-2">
									<button 
										className="flex-1 h-8 rounded-full bg-white/10 border border-white/40 text-[11px]"
										onClick={() => setShowAlphaHowItWorks('BeamioAlphaHowItWorks')}
									>
										Learn how Alpha works
									</button>
									<button 
										className="flex-1 h-8 rounded-full bg-white text-[11px] text-orange-600 font-medium"
										onClick={async () => {
											claimFaucet()
										}}
									>
										{claimLoading ? (
										<svg
										className="w-4 h-4 animate-spin text-white"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										>
										<circle
											className="opacity-25"
											cx="12" cy="12" r="10"
											stroke="currentColor" strokeWidth="4"
										/>
										<path
											className="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8v4l3-3-3-3v4a12 12 0 00-12 12h4z"
										/>
										</svg>
									) : (
										"Claim 0.2 USDC"
									)}
									</button>
								</div>
							</div>
						) : (
							
								<Claim02Pannel />
							
						)
					}

					

						
					<BalanceCard />
					

					{/* Optional inline search bar, only when user taps search icon */}
					{isSearchOpen && (
						<div className="mb-3">
							<div className="flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 px-3 py-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									className="w-4 h-4 text-slate-400"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="round"
									strokeLinejoin="round"
									>
									<circle cx="11" cy="11" r="6" />
									<path d="m16 16 3.5 3.5" />
								</svg>
									<input
									className="flex-1 bg-transparent text-[11px] placeholder:text-slate-400 focus:outline-none"
									placeholder="Find a person, @handle, or business"
								/>
							</div>
						</div>
					)}
					{
						show200OK && <>
							{/* Top header */}
								<div className="mb-3">
									<p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-400 mb-1">
										Beamio Alpha Reward
									</p>
									<h1 className="text-xl font-semibold text-slate-900">You’ve claimed 0.1 USDC</h1>
									<p className="mt-1 text-[11px] text-slate-500 leading-snug">
										Thank you for testing Beamio on Base. Your Beamio wallet has been funded with
									{" "}
									<span className="font-semibold text-slate-900">0.1 USDC</span>
									{" "}
										so you can try your first gasless payment.
									</p>
								</div>
						</>
					}

					{/* Activity area */}
					<div className="">
					
						{hasActivity ? (
						<div className="space-y-2 overflow-y-auto pb-2">
							{/* Example activity row */}
							<div className="flex items-center justify-between py-2 border-b border-slate-100">
							<div className="flex items-center gap-2">
								<div className="w-7 h-7 rounded-full bg-slate-900/5 flex items-center justify-center text-[10px] font-medium text-slate-700">
									A
								</div>
								<div>
								<p className="text-[11px] text-slate-800">You paid Alice</p>
								<p className="text-[10px] text-slate-400">Just now · Gasless on Base</p>
								</div>
							</div>
							<p className="text-[11px] font-medium text-slate-900">-0.05 USDC</p>
							</div>
						</div>
						) : (
							<ActivityPreview />
							
						)}
					</div>
				</div>
			</div>
			{showAlphaHowItWorks && createPortal(
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
							: 'Search'
						}
						onClose={() => {
							setShowAlphaHowItWorks('')
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
							
						</div>
					</motion.div>
				</AnimatePresence>
				, document.body
			)}
			<div
				className={`
					fixed inset-0 z-50
					bg-white
					transition-transform duration-100 ease-out
					${ openSearch ? 'translate-y-0' : 'translate-y-full'}
				`}
			>
				{
					openSearch && <BeamioSearch close={(item) => {
						if (!item || typeof item === 'string') {
							setOpenSearch(false)
						} else {
							setUserPreviewItem(item)
							setShowAlphaHowItWorks('Pay')
						}
						
					} }/>
				}
				
			</div>
		</div>
	)
}

export default Home
