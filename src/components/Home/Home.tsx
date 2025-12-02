// Home.tsx

import { useEffect, useRef, useState } from "react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {formatAmountReadable, formatWithThousands, generateCODE, getBalance, getUSDCFaucet, getETHFaucet, onWalletEvent} from '@/services/beamio'
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
import styles from '@/components/Home/home.module.scss'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { useNavigate } from "react-router-dom"
import { createOrGetWallet, storeSystemData} from "@/services/beamio"
import BeamioAlphaHowItWorks from './BeamioAlphaHowItWorks'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import BeamioLearnHowItWorksCard from './BeamioLearnHowItWorksCard'
import BeamioAlphaDropConfirm from './BeamioAlphaDropConfirm'
import BeamioTestBalanceDetailsCard from './BeamioTestBalanceDetailsCard'
import {motion } from "framer-motion"

const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

const Home = ({}) => {
	const { profiles, setDarkModle, darkModle, beamio, power, setProfiles, setBeamio, setPaymentLink, paymentLink, setSecureCode,  secureCode, ignoreUrl, setPayTag} = useDaemonContext()
	const navigate = useNavigate()
	const hasActivity = false;
	
	const [isSearchOpen, setIsSearchOpen] = useState(false)
	const [myAddress, setMyAddress] = useState('')
	const [usdcAmount, setUsdcAmount] = useState(0)
	const [avatarName, setAvatarName] = useState('')
	const [avatarImageData, setAvatarImageData] = useState<string | null>(null)
	const [processing, setProcessing] = useState(false)
	const [showGetFaucet, setShowGetFaucet] = useState<'Faucet'|'finished'|'sameIP'>('Faucet')
	const [show200OK, setShow200OK] = useState(false)
	const [show403, setShow403] = useState(false)

	const [showLinkPay, setShowLinkPay] = useState(false)
	const [code, setCode] = useState('')
	const [note, setNote] = useState('')
	const [amt, setAmt] = useState('')
	const [recipient, setRecipient] = useState('')
	const [claimLoading, setClaimLoading] = useState(false)
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<'BeamioAlphaHowItWorks'|'BeamioLearnHowItWorksCard'|''|'BeamioAlphaDropConfirm'|'BeamioTestBalance'>('')

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
			return 
		}

		if (code && amount) {
			setCode(code)
			setNote(_note || '')
			setAmt(amount || '0.00')
			setRecipient(address || '')

			setPaymentLink({code, note: _note, address, amount})
			setShowLinkPay(true)
			
		}


	}

	const storee = () => {
		const temp = CoNET_Data
		if (!temp || !profiles ) {
			return
		}
		const bo: beamio = temp?.beamio || {
			accountName: '',
			image: '',
			darkTheme: false,
			initialLoading: true,
			isUSDCFaucet: false,
			isETHFaucet: false,
			firstName: '',
			lastName: ''
		}
		bo.isUSDCFaucet = true
		setBeamio (bo)
		temp.beamio = bo
		setCoNET_Data(temp)
		storeSystemData()

	}

	const init = async () => {
		
		const profiles = await createOrGetWallet('', false, '', '')
		setProfiles(profiles)

		const temp = CoNET_Data
		if (!temp || !profiles ) {
			return
		}

		const bo: beamio = temp?.beamio || {
			accountName: '',
			image: '',
			darkTheme: false,
			initialLoading: true,
			isUSDCFaucet: false,
			isETHFaucet: false,
			firstName: '',
			lastName: ''
		}

		
		bo.initialLoading = true
		
		if (!bo.isETHFaucet) {
			await getETHFaucet(profiles[0].keyID)
			bo.isETHFaucet = true
		}
		
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
		
		console.log (temp)
		
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
				setShowLinkPay(true)
				setRecipient(url)
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
	const getBa = async () => {

		if (!beamio) return
		
		const profile: profile = profiles[0]
		if (!profile) return

		const key = profile.keyID
		
		setMyAddress(key)
		

			
		const _ba = await getBalance(key)
		if (!_ba) return
		const ba = _ba
		const eth = Number(ba.eth)
		const ethUsd = eth * Number(ba.oracle.eth.eth)

		const usdc = Number(ba.usdc)
		setUsdcAmount(usdc)
		setAvatarName(beamio?.accountName||'@Beamio')

		if (beamio?.image) {
			setAvatarImageData(beamio.image)
		}

	
	}

	const claimFaucet = async () => {
		setShowAlphaHowItWorks('BeamioAlphaDropConfirm')
	}

	useEffect(() => {
	
		// ② 异步逻辑必须包在内部 async 函数里
		getBa()
	

	}, [beamio])

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
		<div className="">
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
			<div className="mt-6">
				{/* Status bar stub */}
				

				{/* Content */}
				<div className="flex flex-col h-[calc(100%-2.5rem)] px-5 pb-3">
				
					{/* Top bar: wallet pill + icons */}
					<div className="flex items-center justify-between mb-2">

						{/* Wallet pill */}
						<button
							className="
								flex items-center gap-2 
								px-2.5 py-1.5 rounded-full 
								bg-slate-200 dark:bg-slate-900 
								text-slate-800 dark:text-slate-50 
								text-[10px] shadow-sm
							"
							onClick={() => {
								navigate("/settings")
							}}
						>
							<div
							className="
								w-5 h-5 rounded-full 
								bg-slate-900/5 dark:bg-slate-50/10 
								flex items-center justify-center 
								overflow-hidden
							"
							>
							<img
								src={currentAvatarSrc}
								alt="Avatar preview"
								className="
								w-full h-full 
								rounded-full 
								object-cover
								"
							/>
							</div>

						<div className="flex flex-col items-start leading-snug">
						<span
							className="
							text-[9px] uppercase tracking-[0.14em]
							text-slate-500 dark:text-slate-400
							"
						>
							{avatarName}
						</span>

						<span
							className="
							text-[10px] font-medium 
							text-slate-800 dark:text-slate-100
							"
						>
							{fmtAddr(myAddress)}
						</span>
						</div>

						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							className="w-3 h-3 text-slate-500 dark:text-slate-300"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="m9 6 6 6-6 6" />
						</svg>
						</button>

						{/* Icons: search, QR, bell */}
						<div className="flex items-center gap-3 text-slate-500">
							{/* Search */}
							<button
								className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-50 border border-slate-200 text-[11px]"
								aria-label="Search"
								onClick={() => setIsSearchOpen((v) => !v)}
							>
								<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								className="w-[18px] h-[18px]"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinecap="round"
								strokeLinejoin="round"
								>
								<circle cx="11" cy="11" r="6" />
								<path d="m16 16 3.5 3.5" />
								</svg>
							</button>

							{/* Scan */}
							<div
								className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-50 border border-slate-200 text-[11px] cursor-pointer"
								aria-label="Scan QR"
								role="button"
								tabIndex={0}
								
							>
								<ScanBtn iconSize={18} />
							</div>

							{/* Notifications */}
							<button
								className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-50 border border-slate-200 text-[11px]"
								aria-label="Notifications"
							>
								<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								className="w-[18px] h-[18px]"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinecap="round"
								strokeLinejoin="round"
								>
								<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
								<path d="M10 21h4" />
								</svg>
							</button>
						</div>
					</div>

					{/* Wallet balance */}
					<div className="mb-3">
						<p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 leading-tight">
							{formatWithThousands(usdcAmount)}
						</p>

						<p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
							USDC on Base · gasless tier
						</p>
					</div>

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

					{
						showGetFaucet === 'Faucet' ? (
							<section className="mb-6">
								<div className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-2">
									<div className="flex items-center gap-2">
										<span className="text-lg">🔥</span>
										<div className="flex flex-col">
											<span className="text-sm font-semibold text-amber-900">
												Claim 0.2 USDC to get started
											</span>
											<span className="text-xs text-amber-800">
												Get 0.2 USDC to try Beamio and send your first gasless payment on Base. Help us reach 500 test transfers.
											</span>
										</div>
									</div>
									<div className="flex flex-wrap gap-2 mt-1">
										<button 
											className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-xs font-medium text-amber-900 px-4 py-1.5 hover:bg-amber-100"
											onClick={() => setShowAlphaHowItWorks('BeamioAlphaHowItWorks')}
											>
											Learn how Alpha works
										</button>
										<button
											onClick={async () => {
												claimFaucet()
											}}
											disabled={claimLoading}
											className={`
												inline-flex items-center justify-center rounded-full 
												bg-amber-500 text-white text-xs font-medium 
												px-4 py-1.5 shadow-sm 
												hover:bg-amber-600
												disabled:opacity-70 disabled:cursor-not-allowed
											`}
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
							</section>
						) : showGetFaucet === 'sameIP' ? (
							    <section className="mb-6">
									<div className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-2">
										<div className="flex items-center gap-2">
										<span className="text-lg">⚠️</span>
										<div className="flex flex-col">
											<span className="text-sm font-semibold text-amber-900">
											Starter balance not available
											</span>
											<span className="text-xs text-amber-800">
											It looks like the 0.2 USDC starter balance has already been claimed from this
											network. This wallet won&apos;t receive an extra 0.2 USDC.
											</span>
										</div>
										</div>
										<div className="flex flex-wrap gap-2 mt-1">
										<button className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-medium px-4 py-1.5 shadow-sm hover:bg-slate-800"
											onClick={() => {
												setPayTag('receive')
												navigate('/settings')
											}}
										>
											Receive USDC to start
										</button>
										</div>
									</div>
								</section>
						) : (
							<section className="mb-6">
								<div className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-2">
									<div className="flex items-center gap-2">
									<span className="text-lg">🔥</span>
									<div className="flex flex-col">
										<span className="text-sm font-semibold text-amber-900">
										0.2 USDC added to your wallet
										</span>
										<span className="text-xs text-amber-800">
										Use this to try a few small test transfers with friends or family. For everyday payments, you can add more USDC later.
										</span>
									</div>
									</div>
									<div className="flex flex-wrap gap-2 mt-1">
									<button className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-medium px-4 py-1.5 shadow-sm hover:bg-amber-600"
										onClick={() => {
											navigate('/Pay')
										}}
									>
										Start a payment
									</button>
									<button className="text-[11px] text-amber-800 underline underline-offset-2"
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

					{/* Activity area */}
					<div className="flex-1 overflow-hidden">
						

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
							<section>
								
								<div className="relative rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-5 flex flex-col items-start gap-4">
									<button
										type="button"
										onClick={() => {
											setShowAlphaHowItWorks('BeamioLearnHowItWorksCard')
										}}
										className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#1652f0] text-white text-[11px] font-semibold flex items-center justify-center shadow-sm hover:bg-[#1346cc]"
									>
									i
									</button>
									<div>
									<p className="text-sm font-semibold text-slate-800 mb-1">No activity yet</p>
									<p className="text-xs text-slate-500 leading-snug">
										When you send or receive USDC, your payments will show up here.
									</p>
									</div>

									<div className="flex flex-wrap gap-3 w-full">
									<button 
										className="flex-1 min-w-[140px] rounded-full bg-[#1652f0] text-sm font-medium text-white py-2.5 hover:bg-[#1346cc]"
										onClick={() => {
											
											navigate('/Pay')
										}}
									>
										Send USDC
									</button>
									<button 
										className="flex-1 min-w-[140px] rounded-full border border-slate-300 bg-white text-sm font-medium text-slate-800 py-2.5 hover:bg-slate-50"
										onClick={() => {
											setPayTag('receive')
											navigate('/settings')
										}}
										>
										Receive USDC
									</button>
									</div>

									<p className="text-[11px] text-slate-400 mt-1">
										Note: this wallet is stored in your browser. Clearing browser data will reset it.
									</p>
								</div>
							</section>
						)}
					</div>
				</div>
			</div>
				{showAlphaHowItWorks && (
					<motion.div
						className="
							fixed inset-0 z-40 
							bg-white dark:bg-slate-900
							flex flex-col
						"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.28, ease: "easeOut" }}
					>
						{/* 顶部 Header */}
						<BeamioNavBack
							title={ showAlphaHowItWorks === 'BeamioAlphaHowItWorks' ? 'How Beamio Alpha works' 
								: showAlphaHowItWorks === 'BeamioLearnHowItWorksCard' ? 'How Beamio works' 
								: showAlphaHowItWorks === 'BeamioTestBalance' ? 'About this 0.2 USDC'
								: 'Confirm 0.2 USDC'}
							onClose={() => {
								setShowAlphaHowItWorks('')
							}} 
						/>

					{/* 内容区域：放你的 BeamioAccountScreen */}
						<div className="flex-1 overflow-y-auto">
							{
								showAlphaHowItWorks === 'BeamioAlphaHowItWorks' && <BeamioAlphaHowItWorks />
							}
							{
								showAlphaHowItWorks === 'BeamioLearnHowItWorksCard' && <BeamioLearnHowItWorksCard />
							}
							{
								showAlphaHowItWorks === 'BeamioAlphaDropConfirm' && <BeamioAlphaDropConfirm wallet={myAddress} close={(success) => {
									setShowAlphaHowItWorks('')
									
									if (!success) {
										return
									}

									if (success ==='error') {

										return setShowGetFaucet('sameIP')
									}


									storee()
									setShowGetFaucet('finished')
									
								}} />
							}
							{
								showAlphaHowItWorks === 'BeamioTestBalance' && <BeamioTestBalanceDetailsCard />
							}
							
							
						</div>
					</motion.div>
				)}
		</div>
	)
}

export default Home
