import { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react"

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

type Step = "amount" | "recipient" | "confirm" | "success" | "sign"| "x402Sign"

const History = ({}) => {
	  
	  const { darkModle, setDarkModle, setProfiles, setUsdcbalance } = useDaemonContext()
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
		
		
		const params = new URLSearchParams({amount:amount.toFixed(2), toAddress: addr}).toString()
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
			setStep('x402Sign')

			
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
		setUsdcbalance(usdc)
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

				
			</div>
			 */}
			
		
			<SendHistoryTable />
		
      </div>
   
  );
}

export default History
