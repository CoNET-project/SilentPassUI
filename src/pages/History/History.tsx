import { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react"

import styles from './send.module.scss'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { CoNET_Data } from '@/utils/globals'
import {AuthorizationSign, getBalanceProcess} from '@/services/beamio'

import {SendHistoryTable} from './SendHistory'
import {MyWalletDashboard} from './MyWalletDashboard'

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
	  
	const { usdcToUSD, usdcbalance } = useDaemonContext()
	const [amount, setAmount] = useState(0)
	const [preInput, setPreInput] = useState('')
	const [showAmount, setShowAmount] = useState('0.00')
	const [step, setStep] = useState<Step>("amount")
	const [myAddress, setMyAddress] = useState('')
	const [error, setError] = useState('')
	const [processError, setProcessError] = useState('')
	const [processing, setProcessing] = useState(false)

	const inputRef = useRef<HTMLInputElement | null>(null)

	// Toggle between entering amount in crypto (USDC) vs fiat (USD)
	const [denom, setDenom] = useState<"USDC" | "USD">("USDC")
	const [successHash, setSuccessHash] = useState('')


	const isUsdc = denom === "USDC";
	const primaryUnitLabel = isUsdc ? "USDC" : "USD";

	// Because USDC ~= 1 USD, conversion is 1:1 for UI
	const formattedUsd = formatWithThousands(amount)


	const init = () => {
		const temp = CoNET_Data?.profiles?.[0]
		if (!temp) return
		setMyAddress(temp.keyID)
	}

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

		if (v > usdcbalance) {
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
    
      <div className="
			
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

				
			</div>
			 */}
			
		
			<MyWalletDashboard />
		
      </div>
   
  );
}

export default History
