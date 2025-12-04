
import { useState, useRef, useEffect } from 'react'
import { onWalletEvent } from '@/services/beamio'
import { useDaemonContext } from '@/providers/DaemonProvider'
import PayForm from '@/pages/Pay/PayForm'
import {getBalance, AuthorizationSign, estimateGasUSDC} from '@/services/beamio'
import {ethers} from 'ethers'
import { useNavigate } from "react-router-dom"
import RedeemScreen from './RedeemScreen'
import ScanBtn from '@/components/scanBtn/ScanButton'

const Browser = ({}) => {
	const navigate = useNavigate()
	const { power, setPower, setUsdcbalance, paymentLink, setPaymentLink, secureCode, ignoreUrl, setSecureCode, setIgnoreUrl, setSendToMemo} = useDaemonContext()
	
	const [showLinkPay, setShowLinkPay] = useState(false)
	const [code, setCode] = useState(paymentLink?.code)
	const [note, setNote] = useState(paymentLink?.note)
	const [amt, setAmt] = useState(paymentLink?.amount)
	const [recipient, setRecipient] = useState(paymentLink?.address)
	const [myAddress, setMyAddress] = useState('')
	const [usdcAmount, setUsdcAmount] = useState(0)
	const [usdcToUSDAmount, setUsdcToUSDAmount] = useState(0)
	const [processing, setProcessing] = useState(false)
	const [processError, setProcessError] = useState('')
	const [signx402Show, setSignx402Show] = useState(false)
	const [successHash, setSuccessHash] = useState('')
	const [successPayLink, setSuccessPayLink] = useState<string>('')
	const [amount, setAmount] = useState<string|undefined>(amt)
	const [popupOpen, setPopupOpen] = useState(true)
	const [localSecureCode, setLocalSecureCode] = useState(secureCode)

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

	const checkUrl = (urlPath: string) => {
	
		let searchParams: URLSearchParams
		try {
			const u = new URL(urlPath)
			searchParams = u.searchParams
		} catch {
			searchParams = new URLSearchParams(urlPath)
		}

		const code = searchParams.get("code")||''
		const _note = searchParams.get("note")||''
		const address = searchParams.get("address")||''
		const amount = searchParams.get("amount")||''
		const _secureCode = searchParams.get("secureCode")||''

		if (_secureCode) {
			setSecureCode (_secureCode)
			setShowLinkPay(true)
			setLocalSecureCode(_secureCode)
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
	
	const getBa = async () => {
		if (!myAddress) return
		const _ba = await getBalance(myAddress)
		if (!_ba) return
		const ba = _ba
		const eth = Number(ba.eth)
		const ethUsd = eth * Number(ba.oracle.eth.eth)

		const usdc = Number(ba.usdc)
		setUsdcAmount(usdc)
		const usdcUsd = usdc * Number(ba.oracle.eth.usdc)
		setUsdcbalance(usdc)
		const total = ethUsd + usdcUsd
		setUsdcToUSDAmount(usdcUsd)
	}
	

	useEffect(() => {
		if (ignoreUrl) {
			cancel()
			return
		}

		if (secureCode) {
			setShowLinkPay(true)
			setLocalSecureCode(secureCode)
			return
		}

		const url = new URL(window.location.href)
		const codeHash = url.searchParams.get('code')||''
		const amount = url.searchParams.get('amount')||''
		const _secureCode = url.searchParams.get('secureCode')||''

		if (_secureCode) {
			setSecureCode(_secureCode)
		}

		if (codeHash && amount ) {

			setNote(url.searchParams.get('note')||'')
			setRecipient(url.searchParams.get('address')||'')
			setAmt(amount)
			setCode(codeHash)
		}

		if ((_secureCode || amount && codeHash) && !power) {
			setShowLinkPay(true)
		}

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

	useEffect(() => {

		if (code && amt) {
			setShowLinkPay(true)
		}
	},[code, amt])

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
	}

    return (
        <div className='flex flex-col h-screen'>
			{
				showLinkPay ? 
					localSecureCode ? <RedeemScreen close={() => {
						cancel()
					}} /> :
					
					(
						<PayForm code={code} amt={amt} note={note} recipient={recipient} closeWin={()=> {
							cancel()
						}} />
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
