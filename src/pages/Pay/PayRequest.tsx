import { useState, useEffect } from "react"
import { CoNET_Data } from "@/utils/globals"
import {formatAmountReadable, formatWithThousands, estimateGasUSDC, generateCODE, getBalance, AuthorizationSign, aesGcmEncrypt} from '@/services/beamio'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import {AppButton} from '@/components/button/AppButton'
import {ethers} from 'ethers'
import {ConformSignInfo} from '@/pages/History/conformX402Sign'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { Copy, ExternalLink } from 'lucide-react'
import { QRCodeCanvas } from "qrcode.react"
import bIcon from '@/components/assets/32x32.svg'
import {RedeemOrLinkCard} from './RedeemOrLinkCard'

const isLocal = false
const remote = 'https://api.settleonbase.xyz'
const local = 'http://localhost:4088'
const showPaylinkSite = 'https://beamio.app'

const aptEndpoint = isLocal ? local : remote

// 0.8% fee, min 0.02, max 2 USDC
function calcFeeFromNumber(base: number) {
  if (!isFinite(base) || base <= 0) return 0;
  const raw = base * 0.008;
  const clamped = Math.min(Math.max(raw, 0.02), 2);
  return Number(clamped.toFixed(2));
}


const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function calcFee(amountStr: string) {
  const amt = parseFloat(amountStr || "0");
  return calcFeeFromNumber(amt);
}

type Mode = "pay" | "request" | 'cashcode';
// form -> sign -> processing -> generated
type Step = "form" | "sign" | "processing" | "generated" | "x402Sign" | "success"
const minAmount = 0.1;



export default function BeamioPayRequest() {

	const { profiles, paymentLink } = useDaemonContext()
	const [mode, setMode] = useState<Mode>("request")
	const [step, setStep] = useState<Step>("form")
	const [defaultNodeText, setDefaultNodeText] = useState('')

	const [amount, setAmount] = useState("0.00")
	const [note, setNote] = useState("");
	const [securityCode, setSecurityCode] = useState("");
	const [tipAmount, setTipAmount] = useState("0.00"); // Request 模式的 tip

  	const [sendTo, setSendTo] = useState("")
	const [sendAmount, setSendAmount] = useState("")
	const [usdcAmount, setUsdcAmount] = useState(0)
	const [usdcToUSD, setUsdcToUSD] = useState(0)

	const [myAddress, setMyAddress] = useState('')
	const [processing, setProcessing] = useState(false)
	const [processError, setProcessError] = useState('')
	const [messageData, setMessageData] = useState<any>()
	const [successHash, setSuccessHash] = useState('')
	const [successUrl, setSuccessUrl] = useState('')

	const [sendToAddressError, setSendToAddressError] = useState(false)
	const [sendAmountError, setSendAmountError] = useState('')

	const isPay = mode === "pay";

	
	const defaultTextTemp = mode === 'pay' ? 'This is a test transfer via Beamio' : mode === 'request' 
	? "This is a test Payment Request via Beamio"
	: "This is a test USDC Check via Beamio"

	useEffect(() => {
		setDefaultNodeText(defaultTextTemp)
	}, [mode])


	// Amount = target amount on the check / link
	const amt = parseFloat(sendAmount || "0") || 0;
	const tip = !isPay ? parseFloat(tipAmount || "0") || 0 : 0;

	// Fee base: Pay = amount; Request = amount + tip
	const feeBase = isPay ? amt : amt + tip;
	const fee = feeBase > 0 ? calcFeeFromNumber(feeBase) : 0;

	// Pay (Issue Check): recipient gets amt, initiator pays amt + fee
	const payTotal = amt > 0 ? amt + fee : 0;

	// Request (Payment Link): payer pays amount + tip, initiator receives gross - fee
	const requestGross = amt + tip; // payer will pay
	const requestNet = requestGross > 0 ? Math.max(requestGross - fee, 0) : 0;

	// Display amount on generated screen
	const displayGeneratedAmount = isPay ? amt : requestGross;

	const vaultEstimate = isPay ? payTotal : amt; // only used in sign step

    const overbalance = (isNaN(Number(sendAmount)) || Number(sendAmount) <= 0 || Number(sendAmount) > usdcAmount)
	const numericAmount = Number(sendAmount || "0")
	const isAmountValid = numericAmount > minAmount;

	const checkError = () => {
		setSendToAddressError (false)
		const addr = ethers.isAddress(sendTo)
		if (!addr) {
			setSendToAddressError (true)
		}

		let AmountError = ''
		const _sendAmount = Number(sendAmount)
		if (isNaN(_sendAmount) || _sendAmount <= 0) {
			AmountError = `Please entry a valid Amount`
		}

		if (_sendAmount > usdcAmount) {
			AmountError = `Insufficient balance`
		}

		setSendAmountError(AmountError)
		

		return (!addr || !!AmountError)


	}

	const checkRequestError = () => {
		let AmountError = ''
		const _sendAmount = Number(sendAmount)
		if (isNaN(_sendAmount) || _sendAmount <= 0) {
			AmountError = `Please entry a valid Amount`
		}

		if (numericAmount < minAmount) {
			AmountError = `Amount must be greater than 0.1 USDC to cover the minimum Beamio service fee.`
		}


		setSendAmountError(AmountError)
		

		return (!!AmountError)
	}


	const handleCopySuccessUrl = async () => {
		if (!successUrl) return
		try {
			await navigator.clipboard.writeText(successUrl)
			// 这里可以触发一个 toast / 提示，比如 setToast("Link copied")
		} catch (e) {
			console.error("Copy failed", e)
		}
	}

	//	setPaymentLink({code: '', note: '', address: url, amount: ''})
	useEffect(() => {
		getBa()
		if (paymentLink && paymentLink?.address) {
			setSendTo (paymentLink.address)
		}
		window.addEventListener("sign:final", onSignFinal)

		return () => {
			window.removeEventListener("sign:final", onSignFinal)
		}
	}, [paymentLink])

	const getBa = async () => {
		const temp = CoNET_Data?.profiles?.[0]
		if (!temp) return
		if (!temp.keyID) return
		setMyAddress(temp.keyID)
		const _ba = await getBalance(temp.keyID)
		if (!_ba) return
		const ba = _ba
		const eth = Number(ba.eth)
		const ethUsd = eth * Number(ba.oracle.eth.eth)

		const usdc = Number(ba.usdc)
		setUsdcAmount(usdc)
		const usdcToUSD = usdc * Number(ba.oracle.eth.usdc)
		setUsdcToUSD(usdcToUSD)
	}

	useEffect(() => {
		if (step === "processing") {
			const timer = setTimeout(() => setStep("generated"), 1500)
			return () => clearTimeout(timer)
		}
	}, [step])

	useEffect(() => {
		if (!processError) {
			return
		}
		setTimeout(() => {
			setProcessError ('')
		}, 4000)
	}, [processError])

  	const onSignFinal = async (e: any) => {
		
		const { action, messageDataRe } = e.detail || {}

		if (action === "sign") {
			console.log("✅ 用户点击签名")
			return signRequest(messageDataRe)
		}
		setProcessing(false)
		console.log("❌ 用户取消签名")
		setStep('form')

	}

	const issueRequestLink = async () => {
	

		if (!profiles?.length) {
			return
		}

		if (checkRequestError()) return 

	
		setProcessing(true)

		const numberAmount = Number(sendAmount)
		if (isNaN(numberAmount) || numberAmount <= 0.02) {
			return 
		}
			
			/**
			 * 
			 * 		UI test
			 * 
			 */
	
		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setProcessError('RPC ERROR!')
		// }, 3000)
		setNote(note||defaultNodeText)
		
		const profile: profile = profiles[0]
		const code = generateCODE ('')

		const fixedAmount = ethers.parseUnits(sendAmount, 6).toString()
		const params = new URLSearchParams({amount: fixedAmount, code: code.hash, note, address: profile.keyID }).toString()
		const showparams = new URLSearchParams({amount: numberAmount.toFixed(2), code: code.hash, note: note||defaultNodeText, address: profile.keyID }).toString()
		const requestUrl = `${aptEndpoint}/api/BeamioPaymentLink?${params}`
		const showUrl = `${showPaylinkSite}?${showparams}`

		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setStep('generated')
		// 	setSuccessUrl(showUrl)
		// }, 3000)
		try {
			const res = await fetch(requestUrl, {method: 'GET'})

			setProcessing(false)
			if (res.status !== 200) {
				return setProcessError(`Beamio RPC Error!`)
			}
			console.log(note)
			setSuccessUrl(showUrl)
			setStep('generated')
			

		} catch (ex) {
			setProcessing(false)
			return setProcessError(`Beamio RPC Error!`)
		}
		
	}

	const generateCheck = async () => {
		if (checkRequestError()|| !profiles?.length) return 

		const numberAmount = Number(sendAmount)
		
		const privateKey = profiles[0].privateKey

		const secureCode = generateCODE(securityCode.replace('-',''))
		
		const data = {secureCode: secureCode.code, passcode: securityCode.replace('-','')}
		const encryText = await aesGcmEncrypt(JSON.stringify(data), privateKey)
		const postNode = note||defaultNodeText + '\r\n' + encryText
		const params = new URLSearchParams({amount: numberAmount.toFixed(2), note: postNode, secureCode: secureCode.hash}).toString()
		const path = `/api/generateCheck?${params}`
		

		
		const url = aptEndpoint + path
		const requestEndpoint = aptEndpoint + path
		
		try {
			const response = await fetch(url, {
				method: 'GET'
			})
			if (response.status !== 402) {
				setProcessing(false)
				return setProcessError('RPC Error!')
			}

			const { x402Version, accepts } = await response.json()
			const MessageData = accepts[0]
			MessageData.reqUrl = requestEndpoint
			

			const gas: any = await estimateGasUSDC (Number(sendAmount), sendTo)
			if (!gas) {
				setProcessing(false)
				return setProcessError('RPC Error!')
			}

			const gasCostEth = Number(ethers.formatEther(gas.gas * gas.price))
			
			const ethPrice = gas.oracle.eth.eth
			const price = Number(gasCostEth) * ethPrice
			
			console.log (gas.oracle)
			MessageData.gas = {
				gasETH: gasCostEth.toFixed(7),
				gasUSD: price.toFixed(5),
				secureCode: secureCode + '\r\n' + securityCode.replace('-','')
			}

			setProcessing(false)
			setStep('x402Sign')
			setMessageData(MessageData)

		} catch (ex: any) {
			setProcessing(false)
			setProcessError('RPC Error!')
		}
		

	}
	

	const signRequest = async (messageDataRe: any) => {
		setProcessing (true)
		
		const paymentHeader = await AuthorizationSign(messageDataRe.maxAmountRequired, messageDataRe.payTo)
		const newInit = {
			method: 'GET',
			headers: {
				
				"X-PAYMENT": paymentHeader,
				"Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE"
			},
			__is402Retry: true
		}

		const reqUrl = messageDataRe.reqUrl
		try {
			const secondResponse = await fetch(reqUrl, newInit)
			const body = await secondResponse.json()
			console.log(secondResponse.ok)
			setProcessing (false)
			if (!secondResponse.ok) {
				return setProcessError('RPC Error!')
			}
			const _amount = Number(ethers.formatUnits(messageDataRe.maxAmountRequired, 6)).toFixed(2)
			setAmount (_amount)
			setStep('success')
			return setSuccessHash(body.USDC_tx)
		} catch (ex) {
			setProcessing (false)
			return setProcessError('RPC Error!')
			
		}

	}

	const cleanup = () => {
		setNote('')
		setSendAmount('')
		setSendTo('')
	}


	const handleGenerate = () => {

		if (mode === 'cashcode') {
			generateCheck()
		} else {
		// Request Link 不需要签名，也不需要 processing，直接进入生成结果
			issueRequestLink()
		}
	};

	const Success = () => {
			return (
				<div className="flex-1 px-5 pt-6 pb-8 flex flex-col items-center justify-center
								bg-transparent text-inherit">

					{/* 蓝色圆圈 ✔ */}
					<div className="w-20 h-20 rounded-full
									bg-blue-600 text-white
									flex items-center justify-center mb-6">
						<span className="text-3xl">✔</span>
					</div>

					{/* 成功文字 */}
					<div className="text-sm text-slate-600 dark:text-slate-300 mb-2">
						Successfully sent
					</div>

					{/* 金额 */}
					<div className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mb-2">
						{amount} USDC
					</div>

					{/* 提示 */}
					<div className="text-xs text-slate-500 dark:text-slate-400 mb-10">
						This takes a few seconds
					</div>

					{/* 按钮组 */}
					<div className="w-full space-y-3">

						{/* 完成按钮 */}
						<button
							className="w-full h-11 rounded-full
									bg-blue-600 text-white
									text-sm font-medium"
							onClick={() => {
								cleanup()
								setStep('form')
							}}
						>
							Done
						</button>

						{/* 查看交易按钮 */}
						<button
							className="
								w-full h-11 rounded-full
								bg-black/5 text-slate-700
								dark:bg-white/10 dark:text-slate-100
								text-sm
							"
							onClick={() => {
								window.open(`https://basescan.org/tx/${successHash}`, '_blank', 'noopener,noreferrer')
							}}
						>
							View transactions
						</button>
					</div>
				</div>
			)
	}

	const TipInput = () => {
		return (
			<div className="mb-5">
					<div className="flex items-baseline justify-between mb-1">
					<span className="text-xs text-slate-500 dark:text-slate-400">
						Tip (optional)
					</span>
					<span className="text-[11px] text-slate-400 dark:text-slate-500">
						Added on top of the amount, paid by customer
					</span>
					</div>
					<div className="h-11 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 flex items-center px-3 mb-2">
					<span className="text-sm text-slate-500 dark:text-slate-400 mr-1">
						USDC
					</span>
					<input
						type="text"
						inputMode="decimal"
						value={tipAmount}
						onChange={(e) => setTipAmount(e.target.value)}
						className="flex-1 bg-transparent border-none outline-none text-right text-base font-medium text-slate-900 dark:text-slate-50"
						placeholder="0.00"
					/>
					</div>
					{/* Quick tip percentages */}
					<div className="flex items-center gap-2 text-[11px]">
					<span className="text-slate-500 dark:text-slate-400 mr-1">
						Quick tip (US/CA):
					</span>
					{[0, 15, 18, 20].map((p) => (
						<button
						key={p}
						type="button"
						className="px-2.5 py-1 rounded-full border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-slate-900/5 dark:bg-black/40 hover:border-slate-500 dark:hover:border-slate-300 transition"
						onClick={() => {
							const base = isNaN(amt) ? 0 : amt;
							const t = base > 0 ? base * (p / 100) : 0;
							setTipAmount(t.toFixed(2));
						}}
						>
						{p}%
						</button>
					))}
					</div>
				</div>
		)
	}

	const handleSendConfirm = async () => {

		
		if (checkError()) return
				
		const params = new URLSearchParams({amount: sendAmount, toAddress: sendTo, note: note||defaultNodeText }).toString()
		const path = `/api/BeamioTransfer?${params}`
		const requestEndpoint = aptEndpoint + path

		
		
		try {
			
			const response = await fetch(requestEndpoint, {
				method: 'GET'
			})
			

			if (response.status !== 402) {
				setProcessing(false)
				return setProcessError('RPC Error!')
			}

			const { x402Version, accepts } = await response.json()
			const MessageData = accepts[0]
			MessageData.reqUrl = requestEndpoint
			

			const gas: any = await estimateGasUSDC (Number(sendAmount), sendTo)
			if (!gas) {
				setProcessing(false)
				return setProcessError('RPC Error!')
			}

			const gasCostEth = Number(ethers.formatEther(gas.gas * gas.price))
			
			const ethPrice = gas.oracle.eth.eth
			const price = Number(gasCostEth) * ethPrice
			
			console.log (gas.oracle)
			MessageData.gas = {
				gasETH: gasCostEth.toFixed(7),
				gasUSD: price.toFixed(5)
			}
			
			setProcessing(false)
			setStep('x402Sign')
			setMessageData(MessageData)
			
		} catch (ex) {
			setProcessing(false)
			setProcessError('RPC Error!')
		}
	}

	const handleResetToForm = () => {
		setStep("form");
	};



  return (
	<div className="">
		{/* Header */}
		{
			(step !== 'x402Sign' && step !== "generated") && (
				<>
					<div className="flex items-center justify-between mb-3">
						<div className="flex flex-col">
							<span className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
								Beamio
							</span>
							<h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
								Payments
							</h1>
						</div>

						<div className="text-right ">
							<p className="text-[12px] font-medium text-slate-900 dark:text-slate-100">
								USDC {formatWithThousands(usdcToUSD)}
							</p>
							<p className="text-[11px] text-slate-500 dark:text-slate-400">
								Available on Base
							</p>
						</div>
					</div>

					<div className="flex items-center justify-between mb-3">
					<p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
						Choose how you want to pay or get paid. All flows are gasless on Base.
					</p>
					</div>
				</>
				


				
			)
		}
		
		{/* Mode pills buttons */}
		{
			(step !== 'x402Sign' && step !== 'success' && step !== 'generated') && (
				<>

					<div className="flex items-center justify-between mb-3">
						<div className="inline-flex w-full rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">

							{/* SEND */}
							<button
								type="button"
								className={`flex-1 h-8 rounded-full text-[13px] transition-all
									${mode === 'pay'
									? "bg-white dark:bg-slate-100 text-slate-900 dark:text-slate-900 shadow-sm"
									: "bg-transparent text-slate-500 dark:text-slate-300"
									}`}
								onClick={() => { setMode("pay"); setStep("form") }}
							>
								Send
							</button>

							{/* REQUEST */}

							
							<button
							type="button"
								className={`flex-1 h-8 rounded-full text-[13px] transition-all
									${mode === 'request'
									? "bg-white dark:bg-slate-100 text-slate-900 dark:text-slate-900 shadow-sm"
									: "bg-transparent text-slate-500 dark:text-slate-300"
									}`}
								onClick={() => { setMode("request"); setStep("form") }}
							>
								Payment Link
							</button>

							{/* cashcode */}
							<button
								type="button"
								className={`flex-1 h-8 rounded-full text-[13px] transition-all
									${mode === 'cashcode'
									? "bg-white dark:bg-slate-100 text-slate-900 dark:text-slate-900 shadow-sm"
									: "bg-transparent text-slate-500 dark:text-slate-300"
									}`}
								onClick={() => { setMode('cashcode'); setStep("form") }}
							>
									Cashcode
							</button>

						</div>
									
						{/* Note */}
						
					</div>
					<div className="flex-1 flex flex-col">
						<div className="mb-5">
							<div className="flex items-center justify-between text-xs">
								<span className="text-xs text-slate-500 dark:text-slate-400">Notes (required)</span>
								<span className="text-slate-400">Visible to the payer · required</span>
							</div>
							<textarea
								value={note}
								onFocus={(e) => {
									if (note === defaultNodeText) {
										setNote('') // 清空默认文本
									}
								}}
								
								placeholder={defaultNodeText}
								onChange={(e) => {
									setNote(e.target.value)
								}}
								rows={2}
								className="w-full rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
							/>

						</div>
						
					</div>
				
				</>
				
			)
		}

		{
			(step !== 'x402Sign' && step !== 'success') && (
				<div className="flex-1 flex flex-col">
					{/* FORM STEP */}

					{step === "form" && mode !== 'pay' && (
						<div className="lex items-center justify-between mb-3">

							{/* Amount */}
							<div className="mb-5">
								<div className="flex items-center justify-between text-xs">
									<span className="text-xs text-slate-500 dark:text-slate-400">Amount (required)</span>
									<span className="text-slate-400">Min amount &gt; 0.02 USDC</span>
								</div>
								<div
									className="h-12 rounded-xl bg-slate-900/5 dark:bg-white/5 border 
									border-slate-200 dark:border-slate-700 flex items-center px-3 relative"
								>
									{/* USDC Icon + Base 角标（现在在最左） */}
									<div className="relative mr-3">
									{/* USDC 主图标 */}
									<img
										src={usdcIcon}
										alt="USDC"
										className="w-6 h-6 rounded-full"
									/>

									{/* Base 小角标 */}
									<img
										src={baseIcon}
										alt="Base"
										className="w-3 h-3 absolute bottom-0 right-0 rounded-full border border-white dark:border-slate-900"
									/>
									</div>

									{/* Max 按钮（现在紧跟在 icon 右边） */}
									{
										mode == 'cashcode' && <button
												onClick={() => setSendAmount(usdcAmount.toString())}
												className="
													text-xs font-medium
													px-2 py-0.5
													rounded-full
													bg-blue-200/60 dark:bg-blue-700/60
													text-slate-600 dark:text-slate-300
													active:scale-95 transition-transform
													mr-2
												"
											>
												Max
											</button>
									}
									

									{/* 输入框（仍然右对齐） */}
									<input
										type="text"
										inputMode="decimal"
										value={sendAmount}
										onChange={(e) => {
											setSendAmountError('')
											setSendAmount(e.target.value)
										}}
										className="flex-1 bg-transparent border-none outline-none text-right 
											text-base font-medium text-slate-900 dark:text-slate-50"
										placeholder="0.00"
									/>
								</div>
								{sendAmountError && (
									<p className="text-[11px] text-red-500">
										{sendAmountError}
									</p>
								)}
							</div>

							
							{/* Summey */}
							<section className="rounded-2xl bg-slate-100 px-4 py-3 text-xs text-slate-600 space-y-1">
								<div className="flex items-center justify-between">
									<span>Beamio service fee (0.8%)</span>
									<span className="font-mono">{formatMoney(fee)} USDC</span>
								</div>
								<div className="flex items-center justify-between text-[11px]">
									<span>Min / max per transaction</span>
									<span className="font-mono">0.02 - 2.00 USDC</span>
								</div>
								<div className="border-t border-slate-200 mt-2 pt-2 space-y-1">
									<div className="flex items-center justify-between">
									<span className="text-slate-500">Payer will pay</span>
									<span className="font-mono text-slate-900 font-semibold">
										{formatMoney(displayGeneratedAmount)} USDC
									</span>
									</div>
									<div className="flex items-center justify-between">
									<span className="text-slate-500">You will receive</span>
									<span className="font-mono text-slate-900 font-semibold">
										{formatMoney(requestNet)} USDC
									</span>
									</div>
								</div>
								<p className="mt-1 text-[11px] text-slate-500">
									Beamio fee is capped at 2.00 USDC per transaction. Direct Send/Receive is 0% Beamio fee.
								</p>
							</section>

							{/* Fee + summary */}
							{/* <div className="mb-6 rounded-2xl bg-slate-900/5 dark:bg-black/40 border border-slate-200 dark:border-slate-800 px-4 py-3 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
								<div className="flex items-center justify-between">
									<span>Beamio service fee (0.8%)</span>
									<span>{fee > 0 ? `${fee.toFixed(2)} USDC` : "0.00 USDC"}</span>
								</div>
								<div className="flex items-center justify-between">
									<span>Min / max per transaction</span>
									<span>0.02 – 2.00 USDC</span>
								</div>
								<div className="pt-1 border-top border-slate-200 dark:border-slate-800 mt-1 space-y-1.5 border-t">
									{isPay ? (
									<>
										<div className="flex items-center justify-between">
										<span className="text-slate-500 dark:text-slate-400">
											Recipient will receive
										</span>
										<span className="text-slate-900 dark:text-slate-100 font-medium">
											{amt > 0 ? amt.toFixed(2) : "0.00"} USDC
										</span>
										</div>
										<div className="flex items-center justify-between">
										<span className="text-slate-500 dark:text-slate-400">
											You will pay
										</span>
										<span className="text-slate-900 dark:text-slate-100 font-medium">
											{payTotal > 0 ? payTotal.toFixed(2) : "0.00"} USDC
										</span>
										</div>
									</>
									) : (
									<>
										<div className="flex items-center justify-between">
										<span className="text-slate-500 dark:text-slate-400">
											Payer will pay
										</span>
										<span className="text-slate-900 dark:text-slate-100 font-medium">
											{requestGross > 0 ? requestGross.toFixed(2) : "0.00"} USDC
										</span>
										</div>
										{tip > 0 && (
										<div className="flex items-center justify-between">
											<span className="text-slate-500 dark:text-slate-400">
											Includes tip
											</span>
											<span className="text-slate-900 dark:text-slate-100 font-medium">
											{tip.toFixed(2)} USDC
											</span>
										</div>
										)}
										<div className="flex items-center justify-between">
										<span className="text-slate-500 dark:text-slate-400">
											You will receive
										</span>
										<span className="text-slate-900 dark:text-slate-100 font-medium">
											{requestNet > 0 ? requestNet.toFixed(2) : "0.00"} USDC
										</span>
										</div>
									</>
									)}
								</div>
							</div> */}

							{/* Generate button */}
							
							<AppButton
								
								onClick={handleGenerate}
								loading={processing}
								fullWidth
								errorText={processError}

							>
								{mode === 'cashcode' ? "Generate Check Code" : "Generate Payment Link"}
							</AppButton>

						</div>
					)}

					{step === "form" && mode === 'pay' && (
						<div className="flex-1 overflow-y-auto flex flex-col gap-2">

							{/* Send to */}
							<div className="mb-0">
								<div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
									Send to (username or address)
								</div>
								<input
									value={sendTo}
									onChange={(e) => {
										setSendToAddressError (false)
										setSendTo(e.target.value)
									}}
									placeholder="Entry or paste a valid address or a user name"
									className="
										w-full rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100
									"
								/>
								{
									sendToAddressError &&
									<p className="text-[11px] text-[11px] text-red-500 dark:text-red-400">
										Please entry Send to a valid address!
									</p>
								}
							</div>
							

							{/* Amount */}
							<div className="mb-1">
								{/* 顶部 label + amount in words */}
								<div className="flex items-baseline justify-between mb-1">
									<span className="text-xs text-slate-500 dark:text-slate-400">Amount</span>
									{/* <span className="text-[11px] text-slate-400 dark:text-slate-500">
										Min amount &gt; 0.02 USDC
									</span> */}
								</div>

								{/* 输入框容器 */}
								<div
									className="h-12 rounded-xl bg-slate-900/5 dark:bg-white/5 border 
									border-slate-200 dark:border-slate-700 flex items-center px-3 relative"
								>
									{/* USDC Icon + Base 角标（现在在最左） */}
									<div className="relative mr-3">
									{/* USDC 主图标 */}
									<img
										src={usdcIcon}
										alt="USDC"
										className="w-6 h-6 rounded-full"
									/>

									{/* Base 小角标 */}
									<img
										src={baseIcon}
										alt="Base"
										className="w-3 h-3 absolute bottom-0 right-0 rounded-full border border-white dark:border-slate-900"
									/>
									</div>

									{/* Max 按钮（现在紧跟在 icon 右边） */}
									<button
										onClick={() => setSendAmount(usdcAmount.toString())}
										className="
											text-xs font-medium
											px-2 py-0.5
											rounded-full
											bg-blue-200/60 dark:bg-blue-700/60
											text-slate-600 dark:text-slate-300
											active:scale-95 transition-transform
											mr-2
										"
									>
										Max
									</button>

									{/* 输入框（仍然右对齐） */}
									<input
										type="text"
										inputMode="decimal"
										value={sendAmount}
										onChange={(e) => {
											setSendAmountError('')
											setSendAmount(e.target.value)
										}}
										className="flex-1 bg-transparent border-none outline-none text-right 
											text-base font-medium text-slate-900 dark:text-slate-50"
										placeholder="0.00"
									/>
								</div>
								{
									sendAmountError &&
									<p className="text-[11px] text-[11px] text-red-500 dark:text-red-400">
										Please entry a valid Amount!
									</p>
								}
							</div>
						

							
							
							{/* Confirm button */}
							<div className="flex  w-full">
								
								<AppButton
									variant={'primary'}
									
									onClick={handleSendConfirm}
									errorText={processError}
									loading={processing}
									fullWidth
								>
									Confirm Send
								</AppButton>
								
								
							</div>

						</div>
					)}

					{/* SIGN STEP */}
					{step === "sign" && (
						<div className="flex-1 px-5 pb-6 pt-2 flex flex-col bg-slate-50 dark:bg-black">
							<div className="rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 py-4 flex flex-col gap-3 mt-2 flex-1 shadow-sm dark:shadow-none">
							<div className="text-center mb-2">
								<div className="text-sm font-semibold mb-1">Beamio Wallet</div>
								<div className="text-xs text-slate-500 dark:text-slate-400">
								Confirm vault transfer to issue check
								</div>
							</div>

							<div className="text-xs flex items-center justify-between border-t border-b border-slate-200 dark:border-slate-700 py-3 mt-1">
								<span className="text-slate-500 dark:text-slate-400">
								Signing with
								</span>
								<span className="font-mono text-[11px] text-slate-800 dark:text-slate-100">
								0x1BBC...c9f2F8a9D3
								</span>
							</div>

							<div className="text-xs">
								<div className="text-slate-500 dark:text-slate-400 mb-1">
								Asset changes (estimate)
								</div>
								<div className="flex items-center justify-between">
								<span className="text-lg font-semibold">
									{vaultEstimate.toFixed(2)} USDC
								</span>
								<span className="text-[11px] text-slate-500 dark:text-slate-400">
									Sent to Beamio vault
								</span>
								</div>
							</div>

							<div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
								By signing this request, you will move the above amount into a Beamio
								vault smart contract. This enables issuing a secure check code. These
								funds can only be withdrawn with the generated check code.
							</div>

							<div className="mt-auto pt-4 flex items-center gap-3">
								<button
								className="flex-1 h-11 rounded-full border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-100 bg-white dark:bg-transparent"
								onClick={handleResetToForm}
								>
								Cancel
								</button>
								<button
								className="flex-1 h-11 rounded-full bg-blue-600 text-sm font-medium text-white"
								onClick={() => setStep("processing")}
								>
								Sign
								</button>
							</div>
							</div>
						</div>
					)}

					

					{/* PROCESSING STEP */}
					{step === "processing" && (
						<div className="flex-1 px-5 pb-6 pt-2 flex flex-col overflow-y-auto">
							<div className="rounded-3xl bg-slate-900/5 dark:bg-black/40 border border-slate-200 dark:border-slate-800 px-4 py-4 flex flex-col gap-4 mt-2 flex-1">
							<div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
								{isPay ? "Issuing check" : "Creating payment link"}
							</div>

							<div className="rounded-2xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-slate-700 px-4 py-3 text-center">
								<div className="text-2xl font-semibold text-slate-900 dark:text-slate-50 mb-1">
								{amt.toFixed(2)} USDC
								</div>
								<div className="text-[11px] text-slate-500 dark:text-slate-400">
								Zero and{" "}
								{Math.round(amt * 100)
									.toString()
									.padStart(2, "0")}{" "}
								/ 100 dollars
								</div>
							</div>

							<div className="text-xs text-slate-500 dark:text-slate-400">
								{isPay ? "Recipient will receive" : "You will receive"}
							</div>
							<div className="flex items-center justify-between text-xs">
								<span className="text-slate-500 dark:text-slate-400">
								Net amount
								</span>
								<span className="text-slate-900 dark:text-slate-100 font-medium">
								{isPay ? amt.toFixed(2) : requestNet.toFixed(2)} USDC
								</span>
							</div>
							<div className="flex items-center justify-between text-xs">
								<span className="text-slate-500 dark:text-slate-400">
									Beamio fee
								</span>
								<span className="text-slate-900 dark:text-slate-100">
									{fee.toFixed(2)} USDC
								</span>
							</div>

							{isPay ? (
								<div className="flex items-center justify-between text-xs">
								<span className="text-slate-500 dark:text-slate-400">
									You will pay
								</span>
								<span className="text-slate-900 dark:text-slate-100">
									{payTotal.toFixed(2)} USDC
								</span>
								</div>
							) : (
								<div className="flex items-center justify-between text-xs">
								<span className="text-slate-500 dark:text-slate-400">
									Payer will pay
								</span>
								<span className="text-slate-900 dark:text-slate-100">
									{requestGross > 0 ? requestGross.toFixed(2) : "0.00"} USDC
								</span>
								</div>
							)}

							<div className="mt-auto pt-6">
								<button className="w-full h-11 rounded-full bg-slate-200 text-sm text-slate-700 dark:bg-slate-700 dark:text-slate-300 cursor-wait">
									Processing...
								</button>
							</div>
							</div>
						</div>
					)}

					{/* GENERATED STEP */}
					{step === "generated" && 
						<RedeemOrLinkCard 
							createdAt={new Date().getTime()} 
							isCompleted={false} isPay={isPay} amt={amt} successUrl={successUrl} tip={tip} note={note} 
							onReset={() => {
							setSendAmount('0')
							setSuccessUrl('')
							setNote('')
							setStep('form')
						}} />}
				</div>
			)
		}
		
		{step === 'x402Sign' && (
			<ConformSignInfo originUrl='https://beamio.app' messageData={messageData} processError={processError} processing={processing} />
		)}

		{step === "success" && (
			<Success />	
		)}
	</div>

  )
}
