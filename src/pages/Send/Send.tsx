import { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react"
import ScanBtn from '@/components/Wallet/scanBtn/ScanButtonForB'
import styles from './send.module.scss'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
import { CoNET_Data } from '@/utils/globals'
import {getBalance, AuthorizationSign, estimateGasUSDC} from '@/services/beamio'
import SendTabs from './SendTabs'
import SendToInput from './SendToInput'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import ReceiveOverlay from './ReceiveOverlay'
import {ethers} from 'ethers'
import {ConformSignInfo} from './conformX402Sign'
import {SendHistoryTable} from './SendHistory'

import {AppButton} from '@/components/button/AppButton'

const isLocal = false
const remote = 'https://api.settleonbase.xyz'
const local = 'http://localhost:4088'

const endpoint = isLocal ? local : remote

const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatWithThousands = (n: string | number): string => {
	const num = Number(n)
	if (isNaN(num)) return "0.00"

	const [intPart, decPart = "00"] = num.toFixed(2).split(".")
	const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
	return `${intWithCommas}.${decPart}`
}

type gasData = {
	gas: string
	price: string
	ethPrice: string
}

const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

type Step = "amount" | "recipient" | "confirm" | "success" | "sign";

const Send = ({}) => {
	  
	  const { darkModle, setDarkModle, setProfiles } = useDaemonContext()
		const [showReceive, setShowReceive] = useState(false);
		const [amount, setAmount] = useState(0)
		const [preInput, setPreInput] = useState('')
		const [showAmount, setShowAmount] = useState('0.00')
		const [step, setStep] = useState<Step>("amount")
		const [myAddress, setMyAddress] = useState('')
		const [sendAddress, setSendAddress] = useState('')
		const [error, setError] = useState('')
		const [processError, setProcessError] = useState('')
		const [processing, setProcessing] = useState(false)

		const inputRef = useRef<HTMLInputElement | null>(null)

		// Toggle between entering amount in crypto (USDC) vs fiat (USD)
		const [denom, setDenom] = useState<"USDC" | "USD">("USDC")
		

		const [usdcAmount, setUsdcAmount] = useState(0)
		const [usdcToUSDAmount, setUsdcToUSDAmount] = useState(0)
		const [gasETH,setGasETH] = useState('')
		const [gasUSD,setGasUSD] = useState('')
		const [messageData, setMessageData] = useState<any>()
		const [requestEndpoint, setRequestEndpoint] = useState('')
		const [successHash, setSuccessHash] = useState('')


		const isUsdc = denom === "USDC";
		const primaryUnitLabel = isUsdc ? "USDC" : "USD";

		// Because USDC ~= 1 USD, conversion is 1:1 for UI
		const formattedUsd = formatWithThousands(amount)
		const estimateGas = async () => {
			
			
			
		}

	const init = () => {
		const temp = CoNET_Data?.profiles?.[0]
		if (!temp) return
		setMyAddress(temp.keyID)
	}

	useEffect(() => {
		getBa()
	}, [myAddress])

	useEffect(() => {
		if (processError) {
			setTimeout(() => {
				setProcessError('')
				setProcessing(false)
			}, 5000)
		}
	}, [processError])

	const final = (hash: any) => {
		if (!hash) {
			return 
		}
		setStep('success')
		setSuccessHash(hash.USDC_tx)
		console.log(hash)
		getBa()
	}

	const processSend = async (addr: string) => {
		if (!addr|| amount <= 0) {
			return setProcessError('Error')
		}
		setSendAddress(addr)
		setProcessing(true)
		
		
		const params = new URLSearchParams({amount:amount.toFixed(2), toAddress: addr }).toString()
		const path = `/api/BeamioTransfer?${params}`
		const requestEndpoint = endpoint + path
		setRequestEndpoint(requestEndpoint)
		
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
			setMessageData(MessageData)

			const gas: any = await estimateGasUSDC (amount, addr)
			if (!gas) {
				setProcessing(false)
				return setProcessError('RPC Error!')
			}

			const gasCostEth = Number(ethers.formatEther(gas.gas * gas.price))
			setGasETH(gasCostEth.toFixed(7))
			const ethPrice = gas.oracle.eth.eth
			const price = Number(gasCostEth) * ethPrice
			setGasUSD(price.toFixed(5))
			console.log (gas.oracle)
			MessageData.gas = {
				gasETH: gasCostEth.toFixed(7),
				gasUSD: price.toFixed(5)
			}
			//const urlObj = new URL(url)
				setProcessing(false)
			setStep('sign')

			
		} catch (ex) {
			setProcessing(false)
			setProcessError('RPC Error!')
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

		const total = ethUsd + usdcUsd
		setUsdcToUSDAmount(usdcUsd)

	}

	// useEffect(() => {
	// 	handleBlur()
	// }, [preInput])


  	useEffect(() => {
		init()
		window.addEventListener("sign:final", onSignFinal)

		return () => {
			window.removeEventListener("sign:final", onSignFinal)
		}
	}, [])

	const handleBlur = () => {
		const v = Number(String(preInput).replace(/,/g, ""))
		setAmount(0)
		if (isNaN(v)) {
			setError("Amount must be number!")
			// requestAnimationFrame(() => {
			// 	inputRef.current?.focus()
			// 	inputRef.current?.select()
			// })
			return false
		}
		if (v <= 0) {
			setError("Amount must be > 0")
			// requestAnimationFrame(() => {
			// 	inputRef.current?.focus()
			// 	inputRef.current?.select()
			// })

			return false
		}

		if (v > usdcAmount) {
			setError("Amount over available balance!")
			return false
		}
		
		//   // ✅ 增加：不能超过 1000 美元
		// if (v > 1000.1) {
		// 	setError(t("金额不能超过1000美元", "Amount must not exceed 1000 USD", "金額は1000ドルを超えてはいけません"))
		// 	requestAnimationFrame(() => {
		// 	inputRef.current?.focus()
		// 	inputRef.current?.select()
		// 	})
		// 	return
		// }
		// 格式化
		setShowAmount(formatWithThousands(v))
		setError("")
		setAmount(v)
		return true
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
			return final(body)
		} catch (ex) {
			setProcessing (false)
			return setProcessError('RPC Error!')
			
		}

	}

	const onSignFinal = async (e: any) => {
		
		const { action, messageDataRe } = e.detail || {}

		if (action === "sign") {
			console.log("✅ 用户点击签名")
			return signRequest(messageDataRe)
		}
		setProcessing(false)
		console.log("❌ 用户取消签名")
		setStep('amount')
	}

  return (
    
      <div className={styles.home}>
        {step === "amount" && (
          <>
			{/* Top amount area */}
			<div className="px-5 pt-6 flex flex-col gap-2">
				{/* Top right QR */}
				<div className="flex items-start">
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
					 {/* Top right QR */}
					<div className="ml-auto inline-flex">
						<ScanBtn />
					</div>

				</div>

				{/* Amount display */}
				{
					!showReceive && (
						<div>
						<div className="flex flex-col w-full">
							<div className="flex items-center gap-3 mb-1 w-full overflow-hidden">
								
								{/* 左侧 input column */}
								<div className="flex-1 flex flex-col min-w-0">
									<input
										type="text"
										inputMode="decimal"
										value={preInput}
										onChange={e => {
											setError("")
											setPreInput(e.target.value)
										}}
										onBlur={handleBlur}
										className={`
											bg-transparent
											outline-none
											text-5xl font-semibold tracking-tight text-right w-full
											border rounded-xl
											px-4 py-2
											min-w-0
											${error ? "border-red-500" : "border-transparent"}
										`}
										placeholder={primaryUnitLabel}
									/>

									{error && (
										<div className="text-right text-sm text-red-500 mt-1 pr-1">
										{error}
										</div>
									)}
								</div>

								{/* Max 按钮 —— 不允许扩张 container */}
								<button
									className="
										flex-none px-3 py-2 rounded-full text-sm font-medium
										bg-blue-600 text-white border-blue-700/30
										dark:bg-blue-500 dark:text-white dark:border-blue-400/30
										shadow-sm
									"
									onClick={() => {
										setPreInput(usdcAmount.toFixed(2))
										setError("")
										handleBlur()
									}}
								>
									Max
								</button>
							</div>
						</div>
					</div>
					)
				}

			</div>

			{/* Token row */}
			{
				!showReceive && (
					<div className="px-5">
						<div className="flex items-center justify-between py-3 border-t border-b border-white/5">
							<div className="flex items-center gap-3">
								<div className="cryptoAssetIcon">
									<img src={usdcIcon} alt="USDC" className="usdcIcon" />
									<img src={baseIcon} alt="Base" className="baseBadge" />
								</div>
								<div>
									<div className="text-sm font-medium">USDC</div>
								</div>
							</div>
							<div className="flex items-center justify-end gap-3 text-right">
							{/* 左：Available（垂直居中） */}
							<span className="text-sm font-medium text-slate-500 flex items-center">
								Available
							</span>

							{/* 右：两行数值 */}
							<div className="flex flex-col items-end leading-tight">
								{/* 🔥 数字加大一号 → text-lg */}
								<div className="text-lg font-semibold">
								{formatWithThousands(usdcAmount)}
								</div>

								{/* 下方 USD 金额淡一点 */}
								<div className="text-sm opacity-70">
								${formatMoney(usdcToUSDAmount)}
								</div>
							</div>
							</div>
							
						</div>
					</div>
				)
			}
			

			{/* Actions only (no keypad) */}
			
			<div className="px-5 flex flex-col relative">	{/*  */}
				
				
				{/* Receive overlay */}
				{	
					showReceive ? <ReceiveOverlay onClose={() => setShowReceive(false)} address={myAddress} />
					: <div className="mt-6 flex items-center gap-3">
						<div className="flex-1">
							<AppButton variant="secondary" fullWidth onClick={() => setShowReceive(true)}>
							Receive
							</AppButton>
						</div>

						<div className="flex-1">
							<AppButton variant="primary" fullWidth onClick={() => {
							if (handleBlur()) setStep('recipient')
							}}>
								Send
							</AppButton>
						</div>
					</div>
				}
				

			</div>
			{
				!showReceive && 
				<div className="flex-1 min-h-0 flex flex-col px-4 pb-4">
					{/* 你原来这层 */}
					<div className="flex-1 min-h-0 mt-6">
						<SendHistoryTable balance={usdcAmount} />
					</div>
				</div>
			}
			
          </>
        )}

        {step === "recipient" && (
          <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <button
                className="text-2xl leading-none pr-2"
                onClick={() => setStep("amount")}
              >
               {'<'}
              </button>
              <span className="text-lg font-medium">Choose recipient</span>
            </div>

            {/* Send to input */}
            <SendToInput loadingError={processError} sendAction={(address) => {
				
				processSend(address)
				
			}} />

          </div>
        )}

        {step === "success" && (
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
					{formattedUsd} USDC
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
							setStep('amount')
							setAmount(0)
							setShowAmount('0.00')
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
        )}

		{step === "sign" && (
			<ConformSignInfo originUrl='https://beamio.app' messageData={messageData} processError={processError} processing={processing} />
			
		)}

      </div>
   
  );
}

export default Send
