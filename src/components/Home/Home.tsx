// Home.tsx

import { useEffect, useRef, useState } from "react"
import { createPortal } from 'react-dom';
import { useDaemonContext } from "@/providers/DaemonProvider"
import {formatAmountReadable, formatWithThousands, getBalanceProcess, onWalletEvent, getUserInfo} from '@/services/beamio'
import base_icon from '@/components/assets/base-logo.png'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { useNavigate } from "react-router-dom"
import { createOrGetWallet, storeSystemData} from "@/services/beamio"
import BeamioAlphaHowItWorks from './BeamioAlphaHowItWorks'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import BeamioLearnHowItWorksCard from './BeamioLearnHowItWorksCard'
import BeamioAlphaDropConfirm from './BeamioAlphaDropConfirm'
import BeamioTestBalanceDetailsCard from './BeamioTestBalanceDetailsCard'
import {motion, AnimatePresence } from "framer-motion"
import { Search } from "lucide-react"
import OnrampOfframpGuide from './OnrampOfframpGuide'
import BeamioSearch from './BeamioSearch'
import SearchInputWithDropdown, {searchResult} from './SearchBarWithResults'


const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const Home = ({}) => {
	const { setDarkModle, profiles,
		power, setProfiles, setBeamio, setPaymentLink, setSecureCode,  secureCode, ignoreUrl, setMyAddress, myAddress,
		setPayTag, setSendToMemo, setUsdcbalance, listenningProcess, setListenningProcess, setUsdcToUSD, usdcToUSD, usdcbalance, setPaymentLinkCode
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
	const [userPreviewItem, setUserPreviewItem] = useState<searchResult|null>()
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<'BeamioAlphaHowItWorks'|'BeamioLearnHowItWorksCard'|''|'BeamioAlphaDropConfirm'|'BeamioTestBalance'|'OnrampOfframpGuide'|'Search'|'BeamioContactProfilePreview'>('')

	const avatarUrl = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(
		avatarName
	)}`

	const checkUrl = (url: string) => {
	
		const u = new URL(url)
		let searchParams: URLSearchParams
		try {
			const u = new URL(url)
			searchParams = u.searchParams
		} catch {
			searchParams = new URLSearchParams(url)
		}

		const code = searchParams.get("code")||''
		const _note = searchParams.get("note")||''
		const address = searchParams.get("address")||''
		const amount = searchParams.get("amount")||''
		const _secureCode = searchParams.get("secureCode")||''

		if (_secureCode) {
			setSecureCode (_secureCode)
			setShowLinkPay(true)
			navigate('/Browser')
			setPaymentLinkCode('')
			return 
		}

		if (code) {
			setPaymentLinkCode(code)
			navigate('/Browser')
			
		}


	}

	const storee = async () => {
		const temp = CoNET_Data
		if (!temp || !profiles ) {
			return
		}

		const bo: beamio = temp?.beamio || await getUserInfo(profiles[0].keyID)
		bo.isUSDCFaucet = true
		setBeamio (bo)
		temp.beamio = bo
		setCoNET_Data(temp)
		storeSystemData()

	}

	const init = async () => {
		
		const temp = CoNET_Data
		if (!temp || !profiles ) {
			return
		}

		const bo: beamio = temp?.beamio || await getUserInfo(profiles[0].keyID)

		
		bo.initialLoading = true
		
		
		if (bo.isUSDCFaucet) {
			setShowGetFaucet('finished')
		} else {
			setShowGetFaucet('Faucet')
		}
		
		
		setDarkModle(bo.darkTheme)
		setBeamio (bo)
		temp.beamio = bo
		setCoNET_Data(temp)
		storeSystemData()
		
		const profile = profiles[0]
		setMyAddress (profile.keyID)

		getBalanceProcess(profile.keyID, setUsdcbalance, setUsdcToUSD)
		
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

	
	const currentAvatarSrc = avatarImageData || avatarUrl

	const claimFaucet = async () => {
		setShowAlphaHowItWorks('BeamioAlphaDropConfirm')
	}

	/** 余额卡：白底 + 渐变描边 */
	function BalanceCard() {
		return (
			
			<div className="rounded-3xl bg-gradient-to-br from-[#1b6dff] via-[#6d3dff] to-[#f54b8b] p-4 shadow-lg mb-6">
				{/* 顶部：标题 + Base 标识 */}
				<div className="flex items-center justify-between mb-4">
					<div className="text-xs font-medium text-white/80">
						Beamio Balance
					</div>
					<div className="flex items-center gap-1 text-white">

						{/* 圆形图标区域 */}
						<span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/15">
							<img
								src={base_icon}
								alt="Base"
								className="w-3.5 h-3.5 object-contain"
							/>
						</span>

						{/* 文本 */}
						<span className="text-[11px] font-medium tracking-wide">
							Base
						</span>
					</div>
				</div>

				{/* 中间：金额 */}
				<div className="mb-4">
					<div className="text-3xl font-semibold text-white tabular-nums leading-tight">
						{formatWithThousands(usdcbalance)}
					</div>
					<div className="text-xs text-white/80 mt-1">
						USDC
					</div>
				</div>

				{/* 底部：Gas sponsored pill */}
				<div>
					<div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-sm">
						<span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/80 text-[9px] text-[#1652f0] font-bold">
							⚡
						</span>
						<span className="text-[11px] font-medium text-white">
							Gas sponsored
						</span>
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
						setShowAlphaHowItWorks('Search')
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
			<section className="mb-6">
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
		<div className="h-full flex flex-col bg-slate-50 text-slate-900">
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
			<div className="mt-12 flex-1 px-5 pb-3 overflow-y-auto mb-10">
				{/* Status bar stub */}
				{/* Search */}
				<div className="flex items-center gap-2 mb-12">
					 <button 
					onClick={() => {
						setShowAlphaHowItWorks('Search')
					}}
					className="w-full"
					>
					<div className="pointer-events-none">
						<SearchInputWithDropdown
							readonly={true}
							close={ path => {
								setShowAlphaHowItWorks('')
							}}
						/>
					</div>
					</button>
					<div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
						<ScanBtn />
					</div>
				</div>

				{/* Content */}
				<div className="">
					{/* Hero card */}
					{
						showGetFaucet === 'Faucet' ? (
							<div className="mt-3 rounded-2xl bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600 text-white px-4 py-3 mb-6">
	
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
					<ButtonArea />

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
						showAlphaHowItWorks === 'BeamioAlphaHowItWorks'
							? 'How Beamio Alpha works'
							: showAlphaHowItWorks === 'BeamioLearnHowItWorksCard'
							? 'How Beamio works'
							: showAlphaHowItWorks === 'BeamioTestBalance'
							? 'About this 0.2 USDC'
							: ''
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
							{showAlphaHowItWorks === 'Search' && <BeamioSearch close={path => {
								setShowAlphaHowItWorks('')
							}} />}
							{showAlphaHowItWorks === 'OnrampOfframpGuide' && <OnrampOfframpGuide />}
							
						</div>
					</motion.div>
				</AnimatePresence>
				, document.body
			)}
		</div>
	)
}

export default Home
