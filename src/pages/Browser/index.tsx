
import { useState, useRef, useEffect } from 'react'
import { onWalletEvent } from '@/services/beamio'
import { useDaemonContext } from '@/providers/DaemonProvider'
import PayForm from '@/pages/Pay/PayForm'
import {ethers} from 'ethers'
import { useNavigate } from "react-router-dom"
import RedeemScreen from './RedeemScreen'
import ScanBtn from '@/components/scanBtn/ScanButton'
import beamioConetCoreABI from '@/services/ABI/beamioConetCoreABI.json'
import PayMeLink from '@/pages/Pay/payPaymentLink'
const beamioConetContract = {
	address: '0xCE8e2Cda88FfE2c99bc88D9471A3CBD08F519FEd',
	network: 'CONET DePIN',
	abi: beamioConetCoreABI,
	provider: new ethers.JsonRpcProvider('https://mainnet-rpc1.conet.network'),
	
}
const CoreContract = new ethers.Contract(beamioConetContract.address, beamioConetContract.abi, beamioConetContract.provider)
const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const Browser = ({}) => {
	const navigate = useNavigate()
	const { power, setPower, setUsdcbalance, paymentLink, setPaymentLink, secureCode, ignoreUrl, setSecureCode, setIgnoreUrl, setSendToMemo, setRedeemCode, setPaymentLinkCode, paymentLinkCode, payMePayment} = useDaemonContext()
	
	const [showLinkPay, setShowLinkPay] = useState(false)
	const [code, setCode] = useState(paymentLink?.code)
	const [note, setNote] = useState(paymentLink?.note)
	const [amt, setAmt] = useState(paymentLink?.amount)
	const [recipient, setRecipient] = useState(paymentLink?.address)
	const [successHash, setSuccessHash] = useState('')
	const [localSecureCode, setLocalSecureCode] = useState(secureCode)
	const [address, setAddress] = useState('')
	const [value, setValue] = useState("")
	const [valueError, setValueError] = useState(false)

	const handlePaste = async () => {
		setValueError(false)
		if (value?.length ) {
			setValue ('')
			setValueError(false)
			return
		}

		try {
		if (navigator.clipboard && (navigator.clipboard as any).readText) {
			const text = await navigator.clipboard.readText();
			setValue(text);
		}
		} catch (e) {
			console.warn("Clipboard not available", e);
		}
	}

	const handleOpen = () => {
		if (!value.trim()) return
		try {
			const url = new URL(value)

			const isBeamio = url.hostname === "beamio.app"
			const hasParams = [...url.searchParams].length > 0

			if (!isBeamio || !hasParams) {
				return setValueError(true)
			}

			setValueError(false)
			checkUrl(value)
		} catch {
			setValueError(true)
		}

	}

	const checkCodeBalance = async () => {

		if (payMePayment) {
			setAmt(0)
			setRecipient(payMePayment.address)
			setShowLinkPay(true)
			return
		}
		try {
			const fx = await CoreContract.getLinkMemo(paymentLinkCode)
			const amount = Number(ethers.formatUnits(fx.amount, 6))
			setAmt(amount)
			setNote(fx.node)
			setRecipient(fx.to)
			setShowLinkPay(true)
		} catch (ex: any) {
			console.log(`getInfo ex: ${ex.message}`)
		}
	}


	const checkUrl = async (urlPath: string) => {
	
		let searchParams: URLSearchParams
		try {
			const u = new URL(urlPath)
			searchParams = u.searchParams
		} catch {
			searchParams = new URLSearchParams(urlPath)
		}

		let code = searchParams.get("code")||''
		const _secureCode = searchParams.get("secureCode")||''
		const cashcode = searchParams.get("cashcode")||''
		
		if (_secureCode) {
			setSecureCode (_secureCode)
			setShowLinkPay(true)
			setLocalSecureCode(_secureCode)
			setRedeemCode(cashcode)
			return 
		}

		if (code) {
			if (!code.startsWith('0x')) {
				code = ethers.solidityPackedKeccak256(['string'], [code])
				
			}
			setCode(code)
			try {
				const fx = await CoreContract.getLinkMemo(code)
				const amount = Number(ethers.formatUnits(fx.amount, 6))
				setAmt(formatMoney(amount))
				setNote(fx.node)
				setRecipient(fx.to)
				setShowLinkPay(true)
			} catch (ex: any) {
				console.log(`getInfo ex: ${ex.message}`)
			}
			
		}
	}

	const forwardFromHome = async () => {
		
		if (secureCode) {
			setShowLinkPay(true)
			setLocalSecureCode(secureCode)
			setPaymentLinkCode('')
			return
		}

		return checkCodeBalance()
	}


	useEffect(() => {
		forwardFromHome()

						// 只在挂载时注册一次
		const off = onWalletEvent("scan:url", (url: string) => {
			cancel()
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

	const cancel = () => {
		setCode('')
		setAmt('')
		setNote('')
		setRecipient('')
		
		setShowLinkPay(false)
		setPaymentLink(null)
		setSuccessHash('')
		setSecureCode('')
		setIgnoreUrl(true)
		setSendToMemo('')
		setPaymentLinkCode('')

	}

    return (
        <div className='
		flex flex-col h-screen
		pt-[env(safe-area-inset-top)]
		pb-[env(safe-area-inset-bottom)]
		pl-[env(safe-area-inset-left)]
		pr-[env(safe-area-inset-right)]
		'>
			{
				showLinkPay ? 
					localSecureCode ? <RedeemScreen close={() => {
						cancel()
						navigate('/')
					}} /> :
					
					(<>
						<PayMeLink 
							code={paymentLinkCode} 
							address={recipient}
							close={() => {
							cancel()
							navigate('/')
						}} />
						
					</>
						
						
					) 
				: (
						 <div className="flex justify-center mt-8">
							<div className="w-full max-w-md h-full flex flex-col">
								{/* Top bar placeholder, match your existing app shell */}
								<header className="px-4 pt-3 pb-2 border-b border-slate-200 backdrop-blur flex items-center justify-between">
								{/* Left side text block */}
								<div className="flex flex-col">
									<div className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
										Browser
									</div>
									<div className="text-sm text-slate-700">
										Open Beamio links here
									</div>
								</div>

								{/* Right side Scan button */}
								<ScanBtn />
								</header>

								{/* Content */}
								<main className="flex-1 px-4 py-6 flex flex-col items-center justify-start text-center">
									<div className="w-full max-w-md">
										<div className="mb-4">
											<h2 className="text-lg font-semibold text-slate-900 mb-1">
												Paste a Beamio link to open
											</h2>
											<p className="text-xs md:text-sm text-slate-600 leading-relaxed">
												Paste any Beamio payment link or Cashcode URL you&apos;ve received. We&apos;ll open it here so
												you can review and pay with your Beamio wallet.
											</p>
										</div>

										<div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3 md:p-4 mb-3 flex items-center gap-2">
											<input
												value={value}
												onChange={(e) => setValue(e.target.value)}
												placeholder="https://beamio.app/pay/..."
												className="flex-1 bg-transparent outline-none text-xs md:text-sm text-slate-900 placeholder:text-slate-400 text-center"
											/>
											<button
												type="button"
												onClick={handlePaste}
												className="px-2.5 py-1.5 rounded-full text-[11px] md:text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
											>
												{value ? 'Delete' : 'Paste'} 
											</button>
											<button
												type="button"
												onClick={handleOpen}
												className="px-3 py-1.5 rounded-full text-[11px] md:text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
											>
												Open
											</button>
										</div>
										<div className="text-[11px] md:text-xs text-slate-500 space-y-1.5 text-left">

											{/* 🔴 Error message above Mobile text */}
												{valueError && (
													<p className="text-red-500 font-medium">
													The URL is invalid or this type of URL is not supported.
													</p>
												)}
											<p>
												• Mobile: open Beamio from your <span className="font-medium">Home Screen / installed app icon</span>, then
												open links here in the Browser tab.
											</p>

											<p>
												• Desktop: you can open Beamio links in <span className="font-medium">Google Chrome</span> and use your Beamio
												wallet there. Third-party wallets are supported for payment requests only, not for Cashcode redeem.
											</p>

											</div>
										<div className="text-[11px] md:text-xs text-slate-500 space-y-1.5 text-left">
											<p>
												• Mobile: open Beamio from your <span className="font-medium">Home Screen / installed app icon</span>, then
												open links here in the Browser tab.
											</p>
											<p>
												• Desktop: you can open Beamio links in <span className="font-medium">Google Chrome</span> and use your Beamio
												wallet there. Third-party wallets are supported for payment requests only, not for Cashcode redeem.
											</p>
										</div>
									</div>
								</main>
							</div>
						</div>

					)
			}
        </div>
    )
}

export default Browser
