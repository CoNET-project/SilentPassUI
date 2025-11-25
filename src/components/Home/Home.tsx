// Home.tsx

import { useEffect, useRef, useState } from "react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {formatAmountReadable, formatWithThousands, generateCODE, getBalance, getFaucet} from '@/services/beamio'
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
import styles from '@/components/Home/home.module.scss'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { useNavigate } from "react-router-dom"
import { createOrGetWallet, storeSystemData} from "@/services/wallets"
import { onWalletEvent } from '@/services/beamio'

const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')


const Home = ({}) => {
	const { profiles, setDarkModle, darkModle, beamio, power, setProfiles,setBeamio, setPaymentLink } = useDaemonContext()
	const navigate = useNavigate()
	const hasActivity = false;
	
	const [isSearchOpen, setIsSearchOpen] = useState(false)
	const [myAddress, setMyAddress] = useState('')
	const [usdcAmount, setUsdcAmount] = useState(0)
	const [avatarName, setAvatarName] = useState('')
	const [avatarImageData, setAvatarImageData] = useState<string | null>(null)
	const [processing, setProcessing] = useState(false)
	const [showGetFaucet, setShowGetFaucet] = useState(false)
	const [show200OK, setShow200OK] = useState(false)
	const [show403, setShow403] = useState(false)

		const [showLinkPay, setShowLinkPay] = useState(false)
	const [code, setCode] = useState('')
	const [note, setNote] = useState('')
	const [amt, setAmt] = useState('')
	const [recipient, setRecipient] = useState('')

	const avatarUrl = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(
		avatarName
	)}`

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
			isFaucet: false,
			initialLoading: true
		}

		bo.initialLoading = true
		temp.beamio = bo
		if (bo.isFaucet) {
			setShowGetFaucet(true)
		}

		setDarkModle(bo.darkTheme)
		setBeamio (bo)
		setCoNET_Data(temp)
		storeSystemData()
		
		console.log (temp)

		const url = new URL(window.location.href)
		const codeHash = url.searchParams.get('code')||''
		const amount = url.searchParams.get('amount')||''
		setAmt(amount)
		setCode(codeHash)
		const _note = url.searchParams.get('note')||''
		setNote(_note)
		const address = url.searchParams.get('address')||''
		setRecipient(address)
  	}

  	let first = true
  	useEffect(() => {
		if (first) {
			first = false
			init()
		}
				// 只在挂载时注册一次
		const off = onWalletEvent("scan:url", (url: string) => {
			if (/^0x/.test(url)) {
				setPaymentLink({code: '', note: '', address: url, amount: ''})
				return setRecipient(url)
			}
			// 如果 url 是完整链接，建议这样解析
			let searchParams: URLSearchParams
			try {
				const u = new URL(url)
				searchParams = u.searchParams
			} catch {
				searchParams = new URLSearchParams(url)
			}

			const code = searchParams.get("code")
			const _note = searchParams.get("note")
			const address = searchParams.get("address")
			const amount = searchParams.get("amount")

			if (code) {
				setCode(code)
				setNote(_note || '')
				setAmt(amount || '0.00')
				setRecipient(address || '')
				setShowLinkPay(true)
				setPaymentLink({code, note: _note, address, amount})
			}
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

	useEffect(() => {
		
		if (amt && code && !power) {
			return navigate('/Browser')
		}

		if (recipient) {
			return navigate('/Pay')
		}

		getBa()
	}, [beamio, code, amt, recipient])

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
							<button
								className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-50 border border-slate-200 text-[11px]"
								aria-label="Scan QR"
							>
								<ScanBtn iconSize={18} />
							</button>

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

			
					<>
						{/* Alpha testing banner (optional; can be hidden if campaign ends) */}
						<div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 mb-3 flex gap-3">
							<div className="mt-0.5 w-6 h-6 rounded-xl bg-amber-100 flex items-center justify-center text-[12px]">
							🔥
							</div>
							<div className="flex-1">
							<p className="text-[11px] font-semibold text-amber-900 mb-0.5">
								Alpha drop: 0.1 USDC for testing
							</p>
							<p className="text-[10px] text-amber-900/80 leading-snug mb-1.5">
								First-time users can claim <span className="font-semibold">0.1 USDC</span> and send it gaslessly on Base. Help us reach <span className="font-semibold">500 test transfers</span>.
							</p>
							
								<button 
										onClick={async () => {
											if (show403 || showGetFaucet) return
											if (!profiles?.length || processing || !CoNET_Data) return

											const temp = CoNET_Data
											setProcessing(true)

											const kk = await getFaucet(profiles[0].keyID)
											if (kk) {
											temp.beamio.isFaucet = true
											await setCoNET_Data(temp)
											await storeSystemData()
											setShowGetFaucet(true)
											setShow200OK(true)
											} else {
											setShow403(true)
											}
											setProcessing(false)
										}}
										disabled={processing || show403 || showGetFaucet}
										className={[
											"inline-flex items-center px-2.5 py-1.5 rounded-full text-[10px] font-medium transition",

											processing
											? "bg-amber-900/70 text-amber-200 cursor-wait"

											: show403
											? "bg-slate-400 text-slate-700 cursor-not-allowed"

											: "bg-amber-900 text-amber-50 hover:bg-amber-800"
										].join(" ")}
										>
										{processing ? (
											<span className="flex items-center gap-1">
											<svg
												className="w-3 h-3 animate-spin text-amber-200"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
											>
												<circle
												className="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												strokeWidth="4"
												/>
												<path
												className="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
												/>
											</svg>
											Processing…
											</span>
										) : show403 ? (
											"Sorry, your wallet address or IP address has already claimed"
										) : showGetFaucet ? (
											<span className="flex items-center gap-1">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												className="w-3 h-3 text-emerald-300"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												strokeWidth="3"
											>
												<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
											</svg>
											0.1 USDC claimed for testing
											</span>
										) : (
											"Claim 0.1 USDC & start testing"
										)}
																</button>
							
							</div>
						</div>
					</>
				
			

			{/* Activity area */}
			<div className="flex-1 overflow-hidden">
				<div className="flex items-center justify-between mb-2">
				<p className="text-[11px] font-medium text-slate-800">Activity</p>
				<button className="text-[10px] text-slate-400">Filter</button>
				</div>

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
				<div className="mt-1 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 flex flex-col gap-2">
					<p className="text-[11px] font-semibold text-slate-800">No activity yet</p>
					<p className="text-[10px] text-slate-500 leading-snug">
					Claim your 0.1 USDC, then send your first gasless payment on Base. Your payments and requests will show up here.
					</p>
					<div className="flex gap-2 mt-1">
					<button
					onClick={() => {
						return navigate('/pay')
					}}
						className="flex-1 h-8 rounded-full bg-slate-900 text-slate-50 text-[11px] font-medium">
						Send USDC
					</button>

					<button 
					onClick={() => {
						return navigate('/pay')
					}}
					className="flex-1 h-8 rounded-full bg-white text-[11px] font-medium text-slate-600 border border-slate-200">
						Create pay link
					</button>
					</div>
				</div>
				)}
			</div>

			

			</div>
		</div>
		</div>
	)
}

export default Home
